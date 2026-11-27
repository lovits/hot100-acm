"""Hot100 local static server. Practice programs run ONLY in the browser worker."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from http.client import HTTPException
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import hashlib
import json
import logging
import os
import secrets
import shutil
import threading
import sys
import subprocess
sys.path.insert(0, str(Path(__file__).resolve().parent))
from sync_transport import SyncTransport
from leetcode_session import LeetCodeSession

APP_ID = 'hot100-acm-local-v2'
ROOT = Path(__file__).resolve().parent
DEFAULT_DATA = (Path.home() / 'Library/Application Support' if sys.platform == 'darwin' else Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local')))) / 'Hot100ACM'


def instance_id():
    digest = hashlib.sha256(os.path.normcase(str(ROOT)).encode('utf-8'))
    for name in ('local_server.py', 'sync_transport.py', 'leetcode_session.py', 'leetcode_browser.cjs', 'dist/index.html', 'dist/app.js', 'dist/local.js', 'dist/practice.js', 'dist/test-workspace.js', 'dist/study-ui.js', 'dist/study-plan.js', 'dist/sync-core.js', 'dist/sync-controller.js', 'dist/training/index.html', 'dist/training/app.js', 'native_judge/judge.js', 'native_judge/runner.js'):
        digest.update((ROOT / name).read_bytes())
    return digest.hexdigest()


INSTANCE_ID = instance_id()


class DirectoryLeases:
    def __init__(self, base):
        self.held = {}
        self.base = self.acquire(base)
        self.progress = None

    def acquire(self, directory):
        path = Path(directory).resolve()
        key = os.path.normcase(str(path))
        if key in self.held:
            return key
        path.mkdir(parents=True, exist_ok=True)
        for existing in self.held:
            if os.path.samefile(path, existing):
                return existing
        stream = (path / '.hot100-instance.lock').open('a+b')
        try:
            if os.name == 'nt':
                import msvcrt
                stream.seek(0)
                msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as error:
            stream.close()
            raise ValueError('该进度目录已被另一个 Hot100 服务使用，请先保存并关闭旧服务。') from error
        self.held[key] = stream
        return key

    def discard(self, key):
        if key not in (self.base, self.progress):
            stream = self.held.pop(key, None)
            if stream:
                stream.close()

    def set_progress(self, key):
        previous, self.progress = self.progress, key
        if previous and previous != key:
            self.discard(previous)

    def close(self):
        for stream in self.held.values():
            stream.close()
        self.held.clear()


def sync_directory(path):
    if os.name != 'nt':
        descriptor = os.open(path, os.O_RDONLY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def write_atomic_json(path, value, create=False):
    temporary = path.with_name(path.name + '.' + secrets.token_hex(8) + '.tmp')
    try:
        with temporary.open('xb') as stream:
            stream.write(json.dumps(value, ensure_ascii=False).encode('utf-8'))
            stream.flush()
            os.fsync(stream.fileno())
        if create:
            os.link(temporary, path)
        else:
            os.replace(temporary, path)
        sync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def backup_bootstrap(store):
    temporary = store.directory / ('learning.bootstrap.' + secrets.token_hex(8) + '.tmp')
    try:
        shutil.copy2(store.path, temporary)
        with temporary.open('r+b') as stream:
            os.fsync(stream.fileno())
        os.replace(temporary, store.backup)
        sync_directory(store.directory)
    finally:
        temporary.unlink(missing_ok=True)


def is_pristine_for_bootstrap(state):
    if not isinstance(state, dict) or state.get('cloudSync') or state.get('pendingCloudReset') or state.get('localEpoch') or state.get('storageNamespace'):
        return False
    for key in ('accepted', 'favorites', 'conflicts'):
        value = state.get(key, [])
        if not isinstance(value, list) or value:
            return False
    for key in ('progressMeta', 'codes', 'notes', 'history', 'testInputs', 'testWorkspaces', 'codeBookmarks'):
        value = state.get(key, {})
        if not isinstance(value, dict) or value:
            return False
    plan = state.get('studyPlan', {})
    if not isinstance(plan, dict) or plan.get('resetAt'):
        return False
    if any(not isinstance(plan.get(key, {}), dict) or plan.get(key, {}) for key in ('learned', 'learnedMeta')):
        return False
    if not isinstance(plan.get('events', []), list) or plan.get('events', []):
        return False
    if state.get('studySettingsAt') not in (None, 0, 1):
        return False
    defaults = {'dailyGoal': 5, 'reviewLimit': 20, 'intervals': [1, 2, 4, 7, 15, 30]}
    return state.get('studySettings', defaults) == defaults


class Store:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / 'learning.json'
        self.backup = self.directory / 'learning.backup.json'
        self.lock = threading.RLock()
        self.recovered = False
        self.recovery_warning = ''
        self.invalid_files = []
        self.value = {'revision': 0, 'state': {}}
        for path in (self.path, self.backup):
            if not path.exists():
                continue
            try:
                value = json.loads(path.read_text(encoding='utf-8'))
                if not isinstance(value, dict) or not isinstance(value.get('state'), dict) or not isinstance(value.get('revision'), int):
                    raise ValueError('Invalid learning data structure')
                self.value = value
                self.recovered = path == self.backup
                break
            except (ValueError, KeyError, OSError):
                logging.exception('Invalid data file: %s', path)
                self.invalid_files.append(path)
                shutil.copy2(path, self.directory / (path.stem + '.corrupt.' + secrets.token_hex(4) + '.json'))
        if self.invalid_files and not self.recovered:
            self.recovery_warning = '学习数据及可用备份未能读取。损坏文件已保留，可在“我的进度”中导入之前导出的 JSON 备份。'

    def relocate(self, requested, settings, leases):
        if not isinstance(requested, str) or not requested.strip():
            raise ValueError('请输入完整的文件夹路径。')
        target = Path(requested).expanduser()
        if not target.is_absolute():
            raise ValueError('请使用绝对路径。')
        target = target.resolve()
        if target == (ROOT / 'dist').resolve() or (ROOT / 'dist').resolve() in target.parents:
            raise ValueError('请选择网页资源目录以外的文件夹。')
        with self.lock:
            if target == self.directory.resolve():
                return str(target)
            target.mkdir(parents=True, exist_ok=True)
            lease = leases.acquire(target)
            saved = target / 'learning.json'
            backup = target / 'learning.backup.json'
            if saved.exists() or backup.exists():
                leases.discard(lease)
                raise ValueError('该目录已有进度文件。请选择空目录或新建子文件夹，以保留两份记录。')
            created = []
            temporary = settings.with_name('location.' + secrets.token_hex(6) + '.tmp')
            try:
                for path, data in [(saved, json.dumps(self.value, ensure_ascii=False).encode('utf-8')),
                                   (backup, self.backup.read_bytes() if self.backup.exists() else None)]:
                    if data is None:
                        continue
                    with path.open('xb') as stream:
                        created.append(path)
                        stream.write(data)
                        stream.flush()
                        os.fsync(stream.fileno())
                settings.parent.mkdir(parents=True, exist_ok=True)
                temporary.write_text(json.dumps({'directory': str(target)}, ensure_ascii=False), encoding='utf-8')
                os.replace(temporary, settings)
            except Exception:
                for path in created:
                    path.unlink(missing_ok=True)
                leases.discard(lease)
                raise
            finally:
                temporary.unlink(missing_ok=True)
            self.directory, self.path, self.backup = target, saved, backup
            leases.set_progress(lease)
            self.invalid_files = []
            self.recovered = False
            self.recovery_warning = ''
            return str(target)

    def read(self):
        with self.lock:
            return {**self.value, 'recovered': self.recovered, 'recoveryWarning': self.recovery_warning}

    def write(self, value, allow_namespace=False):
        with self.lock:
            if not isinstance(value, dict):
                raise ValueError('学习数据必须是 JSON 对象')
            if value.get('revision') != self.value['revision']:
                return False, self.read()
            if not isinstance(value.get('state'), dict):
                raise ValueError('学习数据格式不正确')
            current_namespace = self.value['state'].get('storageNamespace')
            if not allow_namespace and value['state'].get('storageNamespace') != current_namespace:
                return False, self.read()
            next_value = {'revision': self.value['revision'] + 1, 'state': value['state']}
            raw = json.dumps(next_value, ensure_ascii=False).encode('utf-8')
            temporary = self.directory / ('learning.' + secrets.token_hex(8) + '.tmp')
            try:
                with temporary.open('xb') as stream:
                    stream.write(raw)
                    stream.flush()
                    os.fsync(stream.fileno())
                if self.path.exists() and not self.recovered and not self.invalid_files:
                    backup_tmp = self.directory / 'learning.backup.tmp'
                    shutil.copy2(self.path, backup_tmp)
                    os.replace(backup_tmp, self.backup)
                os.replace(temporary, self.path)
                self.value = next_value
                self.recovered = False
                self.invalid_files = []
            finally:
                temporary.unlink(missing_ok=True)
            return True, self.read()


def make_server(port=18765, data_dir=DEFAULT_DATA):
    leases = DirectoryLeases(data_dir)
    try:
        return _make_server(port, data_dir, leases)
    except Exception:
        leases.close()
        raise


def _make_server(port, data_dir, leases):
    settings = Path(data_dir) / 'location.json'
    preferred = Path(data_dir)
    recovery_warning = ''
    if settings.exists():
        try:
            preferred = Path(json.loads(settings.read_text(encoding='utf-8'))['directory'])
            if preferred.resolve() != Path(data_dir).resolve() and not (preferred / 'learning.json').is_file() and not (preferred / 'learning.backup.json').is_file():
                raise OSError('Saved progress directory is unavailable: ' + str(preferred))
        except (OSError, ValueError, KeyError, TypeError) as error:
            # Preserve the previous location so users can recover data from a disconnected disk.
            shutil.copy2(settings, settings.with_name('location.unavailable.' + secrets.token_hex(4) + '.json'))
            preferred = Path(data_dir)
            settings.write_text(json.dumps({'directory': str(preferred)}), encoding='utf-8')
            logging.warning('Progress location unavailable; using %s: %s', preferred, error)
            if not any((preferred / name).is_file() for name in ('learning.json', 'learning.backup.json')):
                recovery_warning = '原进度目录不可用，已切换到本机默认目录。原目录配置已备份；如需恢复之前的进度，请在原目录可用后导入进度文件。'
    leases.set_progress(leases.acquire(preferred))
    store = Store(preferred)
    fence_path = Path(data_dir) / 'storage-fence.json'
    fence = {'namespace': None, 'invalid': False, 'pending': False}
    if fence_path.exists():
        try:
            saved_fence = json.loads(fence_path.read_text(encoding='utf-8'))
            namespace = saved_fence.get('namespace')
            if not isinstance(namespace, str) or not namespace:
                raise ValueError('Invalid storage fence')
            phase = saved_fence.get('phase', 'committed')
            if phase not in ('pending', 'committed'):
                raise ValueError('Invalid storage fence phase')
            if phase == 'pending':
                base, candidate = saved_fence['base'], saved_fence['candidate']
                if (not isinstance(base, dict) or type(base.get('revision')) is not int or base['revision'] < 0
                        or not is_pristine_for_bootstrap(base.get('state')) or not isinstance(candidate, dict)
                        or candidate.get('storageNamespace') != namespace or not isinstance(candidate.get('cloudSync'), dict)
                        or not is_pristine_for_bootstrap({k: v for k, v in candidate.items() if k not in ('storageNamespace', 'cloudSync')})
                        or (store.invalid_files and not store.recovered)):
                    raise ValueError('Invalid pending bootstrap')
                target = {'revision': base['revision'] + 1, 'state': candidate}
                if store.value == base:
                    ok, _ = store.write({'revision': base['revision'], 'state': candidate}, allow_namespace=True)
                    if not ok:
                        raise ValueError('Bootstrap base changed')
                elif store.value != target:
                    raise ValueError('Bootstrap data changed')
                elif store.recovered:
                    write_atomic_json(store.path, store.value)
                backup_bootstrap(store)
                write_atomic_json(fence_path, {'namespace': namespace, 'phase': 'committed'})
            fence['namespace'] = namespace
        except (OSError, ValueError, TypeError, AttributeError, KeyError):
            fence['invalid'] = True

    def fence_consistent():
        namespace = store.value['state'].get('storageNamespace')
        return not fence['invalid'] and not fence['pending'] and namespace == fence['namespace']

    sync_transport = SyncTransport(data_dir)
    leetcode = LeetCodeSession(os.environ.get('HOT100_NODE') or 'node')
    if recovery_warning and not store.recovery_warning:
        store.recovery_warning = recovery_warning
    auth = {'token': secrets.token_urlsafe(32), 'page': secrets.token_urlsafe(32)}
    origin = f'http://127.0.0.1:{port}'

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(ROOT / 'dist'), **kwargs)

        def log_message(self, fmt, *args):
            logging.info(fmt, *args)

        def end_headers(self):
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'same-origin')
            self.send_header('Cache-Control', 'no-cache')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'")
            super().end_headers()

        def valid_host(self):
            return self.headers.get('Host') == f'127.0.0.1:{port}'

        def valid_origin(self, write=False):
            if not self.valid_host():
                return False
            supplied = self.headers.get('Origin')
            referer = self.headers.get('Referer', '')
            same_referer = referer == origin or referer.startswith(origin + '/')
            same = supplied == origin or (supplied is None and same_referer)
            if self.headers.get('Sec-Fetch-Site') == 'cross-site':
                return False
            return same and (not write or self.headers.get('X-Hot100-Token') == auth['token'])

        def reply(self, status, payload):
            raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
            self.send_response(status)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            path = urlsplit(self.path).path
            if not self.valid_host():
                return self.reply(403, {'error': '请求地址不被允许'})
            if path == '/api/health':
                return self.reply(200, {'app': APP_ID, 'version': 2, 'instance': INSTANCE_ID})
            if path.startswith('/api/'):
                if not self.valid_origin():
                    return self.reply(403, {'error': '数据仅供本站访问'})
                if path == '/api/session':
                    if self.headers.get('X-Hot100-Session-Protocol') != '2':
                        return self.reply(409, {'error': '页面版本已过期，请刷新页面后重试'})
                    with store.lock:
                        if not fence_consistent():
                            return self.reply(503, {'error': '同步初始化状态不一致，请保留数据并联系支持'})
                        if fence['namespace'] and self.headers.get('X-Hot100-Page') != auth['page']:
                            return self.reply(403, {'error': '页面已过期，请刷新后重试'})
                        return self.reply(200, {'token': auth['token'], 'dataDirectory': str(store.directory), **store.read()})
                if path == '/api/progress':
                    return self.reply(200, store.read())
                if path == '/api/sync/status':
                    try:
                        return self.reply(200, sync_transport.status())
                    except (OSError, ValueError, TypeError):
                        return self.reply(500, {'error': '同步配置无法读取'})
                if path == '/api/leetcode/status':
                    return self.reply(200, leetcode.status())
                return self.reply(404, {'error': '没有这个接口'})
            if path in ('/', '/index.html', '/training', '/training/', '/training/index.html'):
                filename = ROOT / 'dist' / ('training/index.html' if path.startswith('/training') else 'index.html')
                with store.lock:
                    page = filename.read_bytes().replace(b'<head>', b'<head><meta name="hot100-page" content="' + auth['page'].encode('ascii') + b'">', 1)
                self.send_response(200)
                self.send_header('Content-Type', 'text/html; charset=utf-8')
                self.send_header('Content-Length', str(len(page)))
                self.end_headers()
                self.wfile.write(page)
                return
            # SimpleHTTPRequestHandler prevents '..' escapes; no source/data files are in dist.
            return super().do_GET()

        def do_POST(self):
            path = urlsplit(self.path).path
            if path in ('/api/check', '/api/run', '/api/judge'):
                return self.post_locked()
            with store.lock:
                return self.post_locked()

        def post_locked(self):
            if not self.valid_origin(write=True):
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if 0 < size <= 65536:
                        self.connection.settimeout(2)
                        self.rfile.read(size)
                except (ValueError, OSError):
                    pass
                self.close_connection = True
                return self.reply(403, {'error': '数据仅接受本站请求'})
            if not fence_consistent():
                return self.reply(503, {'error': '同步初始化状态不一致，请保留数据并联系支持'})
            path = urlsplit(self.path).path
            if path == '/api/sync/bootstrap':
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if not 0 < size <= 5 * 1024 * 1024:
                        return self.reply(413, {'error': '同步请求过大'})
                    payload = json.loads(self.rfile.read(size))
                    epoch, plan_epoch = payload.get('epoch'), payload.get('planEpoch')
                    candidate = payload.get('state')
                    if (type(epoch) is not int or epoch < 0 or type(plan_epoch) is not int or plan_epoch < 0
                            or type(payload.get('revision')) is not int or not is_pristine_for_bootstrap(candidate)):
                        return self.reply(400, {'error': '本地数据不是空的新设备'})
                    if payload['revision'] != store.value['revision'] or not is_pristine_for_bootstrap(store.value['state']):
                        return self.reply(409, {'error': '本地数据已变化，请检查后重试'})
                    status, meta = sync_transport.request('GET', '/v1/meta')
                    if status != 200 or meta.get('epoch') != epoch or meta.get('planEpoch') != plan_epoch:
                        return self.reply(409, {'error': '云端重置状态已变化，请重试'})
                    if fence['namespace']:
                        return self.reply(409, {'error': '本地同步已初始化'})
                    namespace = secrets.token_urlsafe(24)
                    candidate['storageNamespace'] = namespace
                    candidate['cloudSync'] = {'deviceId': secrets.token_urlsafe(24), 'epoch': epoch,
                        'planEpoch': plan_epoch, 'revision': 0, 'initialPullPending': True, 'known': {'progress': {}, 'learned': {},
                        'events': {}, 'drafts': {}, 'submissions': {}, 'recoveries': {}, 'settings': None}, 'outbox': None}
                    fence['pending'] = True
                    auth['page'], auth['token'] = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
                    write_atomic_json(fence_path, {'namespace': namespace, 'phase': 'pending',
                                                  'base': store.value, 'candidate': candidate}, create=True)
                    fence['namespace'] = namespace
                    ok, result = store.write({'revision': payload['revision'], 'state': candidate}, allow_namespace=True)
                    if not ok:
                        return self.reply(409, {'error': '本地数据已变化，请检查后重试'})
                    backup_bootstrap(store)
                    write_atomic_json(fence_path, {'namespace': namespace, 'phase': 'committed'})
                    fence['pending'] = False
                    return self.reply(200, {'page': auth['page'], 'token': auth['token'], **result})
                except (OSError, HTTPException, ValueError, TypeError, AttributeError):
                    return self.reply(503, {'error': '无法安全初始化同步，请检查连接后重试'})
            if path.startswith('/api/leetcode/'):
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 512 * 1024:
                        return self.reply(413, {'error': '请求数据过大'})
                    payload = json.loads(self.rfile.read(length))
                    action = path.removeprefix('/api/leetcode/')
                    if action == 'manual': result = leetcode.manual(payload.get('session', ''), payload.get('csrf', ''))
                    elif action == 'browser': result = leetcode.browser()
                    elif action == 'logout': result = leetcode.logout()
                    elif action == 'solved': result = {'ids': leetcode.solved()}
                    elif action == 'submissions': result = {'submissions': leetcode.submissions(payload.get('id'))}
                    elif action == 'detail': result = {'detail': leetcode.detail(payload.get('id'), payload.get('submissionId'))}
                    elif action == 'submit': result = leetcode.submit(payload.get('id'), payload.get('language'), payload.get('code'))
                    elif action == 'check': result = leetcode.check(payload.get('submissionId'))
                    else: return self.reply(404, {'error': '没有这个接口'})
                    return self.reply(200, result)
                except (ValueError, TypeError, AttributeError, KeyError, OSError, HTTPException, subprocess.SubprocessError):
                    return self.reply(400, {'error': '力扣操作失败，请检查登录状态、网络或输入后重试'})
            if path in ('/api/sync/config', '/api/sync/request'):
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 5 * 1024 * 1024:
                        return self.reply(413, {'error': '同步请求过大'})
                    payload = json.loads(self.rfile.read(length))
                    if path == '/api/sync/config':
                        sync_transport.configure(payload)
                        return self.reply(200, sync_transport.status())
                    status, value = sync_transport.request(payload.get('method'), payload.get('path'), payload.get('body'), payload.get('query'))
                    return self.reply(status, value)
                except (ValueError, TypeError, AttributeError) as exc:
                    return self.reply(400, {'error': str(exc)})
                except (OSError, HTTPException):
                    return self.reply(503, {'error': '无法连接私网同步服务，请检查 Tailscale 连接'})
            if path == '/api/directory':
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if not 0 < size <= 16384:
                        return self.reply(400, {'error': '路径过长或为空。'})
                    payload = json.loads(self.rfile.read(size))
                    return self.reply(200, {'directory': store.relocate(payload.get('directory'), settings, leases)})
                except (OSError, ValueError, TypeError, AttributeError) as exc:
                    return self.reply(400, {'error': str(exc)})
            if path in ('/api/check', '/api/run', '/api/judge'):
                try:
                    length = int(self.headers.get('Content-Length', '0'))
                    if not 0 < length <= 512 * 1024:
                        return self.reply(413, {'error': '代码过长'})
                    payload = self.rfile.read(length)
                    runtime = ROOT / 'native_judge/runtime.json'
                    config = json.loads(runtime.read_text('utf-8-sig')) if runtime.exists() else {}
                    env = dict(os.environ)
                    python = Path(sys.executable)
                    if python.name.lower() == 'pythonw.exe':
                        python = python.with_name('python.exe')
                    env['HOT100_PYTHON'] = str(python)
                    compiler = env.get('HOT100_COMPILER_DIR') or config.get('compilerDirectory', '')
                    if compiler:
                        env['PATH'] = compiler + os.pathsep + env.get('PATH', '')
                    node = env.get('HOT100_NODE') or config.get('node') or 'node'
                    result = subprocess.run([node, str(ROOT / 'native_judge/cli.js'), path.split('/')[-1]],
                                            input=payload, capture_output=True, env=env, timeout=180,
                                            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
                    response = json.loads(result.stdout)
                    return self.reply(response['status'], response['value'])
                except (OSError, ValueError, subprocess.SubprocessError) as exc:
                    logging.exception('Local judge failed')
                    return self.reply(500, {'ok': False, 'error': str(exc)})
            if path == '/api/shutdown':
                self.reply(200, {'ok': True})
                threading.Thread(target=self.server.shutdown, daemon=True).start()
                return
            if path != '/api/progress':
                return self.reply(404, {'error': '没有这个接口'})
            try:
                length = int(self.headers.get('Content-Length', '0'))
                if not 0 < length <= 64 * 1024 * 1024:
                    return self.reply(413, {'error': '学习数据过大，请导出备份'})
                if self.headers.get_content_type() != 'application/json':
                    return self.reply(415, {'error': '需要 JSON 数据'})
                value = json.loads(self.rfile.read(length))
                ok, result = store.write(value)
                self.reply(200 if ok else 409, result)
            except (ValueError, TypeError, OSError) as exc:
                logging.exception('Save failed')
                self.reply(400, {'error': str(exc)})

    class LockedServer(ThreadingHTTPServer):
        def server_close(self):
            try:
                super().server_close()
            finally:
                leases.close()

    server = LockedServer(('127.0.0.1', port), Handler)
    server.daemon_threads = False
    return server


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=18765)
    parser.add_argument('--data-dir', default=str(DEFAULT_DATA))
    options = parser.parse_args()
    Path(options.data_dir).mkdir(parents=True, exist_ok=True)
    logging.basicConfig(filename=str(Path(options.data_dir) / 'server.log'), encoding='utf-8', level=logging.INFO, format='%(asctime)s %(message)s')
    server = make_server(options.port, options.data_dir)
    try:
        server.serve_forever()
    finally:
        server.server_close()

