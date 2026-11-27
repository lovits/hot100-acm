"""Double-click launcher: verify identity, start quietly, open default browser."""
from pathlib import Path
import ctypes
import hashlib
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
import webbrowser

ROOT = Path(__file__).resolve().parent
PORT = 18765
URL = f'http://127.0.0.1:{PORT}'
DATA = Path(os.environ.get('LOCALAPPDATA', str(Path.home() / 'AppData/Local'))) / 'Hot100ACM'
DATA.mkdir(parents=True, exist_ok=True)


def instance_id():
    digest = hashlib.sha256(os.path.normcase(str(ROOT)).encode('utf-8'))
    for name in ('local_server.py', 'sync_transport.py', 'leetcode_session.py', 'leetcode_browser.cjs', 'dist/index.html', 'dist/app.js', 'dist/local.js', 'dist/practice.js', 'dist/test-workspace.js', 'dist/study-ui.js', 'dist/study-plan.js', 'dist/sync-core.js', 'dist/sync-controller.js', 'dist/training/index.html', 'dist/training/app.js', 'native_judge/judge.js', 'native_judge/runner.js'):
        digest.update((ROOT / name).read_bytes())
    return digest.hexdigest()


INSTANCE_ID = instance_id()


def identity():
    try:
        request = urllib.request.Request(URL + '/api/health')
        with urllib.request.build_opener(urllib.request.ProxyHandler({})).open(request, timeout=.2) as response:
            data = json.load(response)
            return data.get('app') == 'hot100-acm-local-v2' and data.get('instance') == INSTANCE_ID
    except Exception:
        return False


def occupied():
    with socket.socket() as client:
        client.settimeout(.3)
        return client.connect_ex(('127.0.0.1', PORT)) == 0


def main():
    # A Windows mutex serializes simultaneous double-clicks, avoiding duplicate launches.
    kernel = ctypes.windll.kernel32
    kernel.CreateMutexW.restype = ctypes.c_void_p
    kernel.WaitForSingleObject.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    kernel.ReleaseMutex.argtypes = [ctypes.c_void_p]
    kernel.CloseHandle.argtypes = [ctypes.c_void_p]
    handle = kernel.CreateMutexW(None, False, f'Local\\Hot100ACM-{PORT}-Launcher')
    acquired = kernel.WaitForSingleObject(handle, 15000) in (0, 0x80)
    try:
        if not acquired:
            raise RuntimeError('另一个启动窗口仍在准备，请稍后再试。')
        if not identity():
            if occupied():
                raise RuntimeError('本地端口 18765 已被旧版 Hot100 或其他程序使用。请先保存未保存的内容，关闭旧程序及其本地服务后重试。')
            interpreter = Path(sys.executable).with_name('pythonw.exe')
            if not interpreter.exists():
                interpreter = Path(sys.executable)
            env = os.environ.copy()
            runtime = ROOT / 'runtime'
            if (runtime / 'node.exe').is_file():
                env['HOT100_NODE'] = str(runtime / 'node.exe')
            if (runtime / 'mingw64/bin').is_dir():
                env['HOT100_COMPILER_DIR'] = str(runtime / 'mingw64/bin')
            with (DATA / 'launcher.log').open('ab') as log:
                process = subprocess.Popen([str(interpreter), str(ROOT / 'local_server.py')], cwd=str(ROOT), stdout=log, stderr=log, env=env, creationflags=subprocess.CREATE_NO_WINDOW)
            for _ in range(60):
                if identity():
                    break
                if process.poll() is not None:
                    raise RuntimeError('本地服务启动失败。请查看日志：' + str(DATA / 'launcher.log'))
                time.sleep(.1)
            else:
                raise RuntimeError('本地服务未能启动。请查看日志：' + str(DATA / 'launcher.log'))
        webbrowser.open(URL + '/')
    finally:
        if acquired:
            kernel.ReleaseMutex(handle)
        kernel.CloseHandle(handle)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        with (DATA / 'launcher.log').open('a', encoding='utf-8') as log:
            log.write(time.strftime('%Y-%m-%d %H:%M:%S ') + str(error) + '\n')
        ctypes.windll.user32.MessageBoxW(None, str(error), 'Hot100 ACM 刷题 · 启动提示', 0x10)
