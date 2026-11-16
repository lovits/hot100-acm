"""Hot100 local static server. Practice programs run ONLY in the browser worker."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import argparse
import json
import logging
import os
import secrets
import shutil
import threading
import sys
import subprocess

APP_ID = 'hot100-acm-local-v2'
ROOT = Path(__file__).resolve().parent
DEFAULT_DATA = (Path.home() / 'Library/Application Support' if sys.platform == 'darwin' else Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local')))) / 'Hot100ACM'


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

    def relocate(self, requested, settings):
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
            saved = target / 'learning.json'
            backup = target / 'learning.backup.json'
            if saved.exists() or backup.exists():
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
                raise
            finally:
                temporary.unlink(missing_ok=True)
            self.directory, self.path, self.backup = target, saved, backup
            self.invalid_files = []
            self.recovered = False
            self.recovery_warning = ''
            return str(target)

    def read(self):
        with self.lock:
            return {**self.value, 'recovered': self.recovered, 'recoveryWarning': self.recovery_warning}

    def write(self, value):
        with self.lock:
            if not isinstance(value, dict):
                raise ValueError('学习数据必须是 JSON 对象')
            if value.get('revision') != self.value['revision']:
                return False, self.read()
            if not isinstance(value.get('state'), dict):
                raise ValueError('学习数据格式不正确')
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
            recovery_warning = '原进度目录不可用，已切换到本机默认目录；原目录配置已备份，可连接原磁盘后导入进度。' + str(error)
    store = Store(preferred)
    if recovery_warning:
        store.recovery_warning = recovery_warning
    token = secrets.token_urlsafe(32)
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
            return same and (not write or self.headers.get('X-Hot100-Token') == token)

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
                return self.reply(200, {'app': APP_ID, 'version': 2})
            if path.startswith('/api/'):
                if not self.valid_origin():
                    return self.reply(403, {'error': '数据仅供本站访问'})
                if path == '/api/session':
                    return self.reply(200, {'token': token, 'dataDirectory': str(store.directory), **store.read()})
                if path == '/api/progress':
                    return self.reply(200, store.read())
                return self.reply(404, {'error': '没有这个接口'})
            # SimpleHTTPRequestHandler prevents '..' escapes; no source/data files are in dist.
            return super().do_GET()

        def do_POST(self):
            if not self.valid_origin(write=True):
                return self.reply(403, {'error': '数据仅接受本站请求'})
            path = urlsplit(self.path).path
            if path == '/api/directory':
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if not 0 < size <= 16384:
                        return self.reply(400, {'error': '路径过长或为空。'})
                    payload = json.loads(self.rfile.read(size))
                    return self.reply(200, {'directory': store.relocate(payload.get('directory'), settings)})
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

    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    server.daemon_threads = True
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

