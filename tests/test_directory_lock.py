import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SERVER = '''import sys,local_server
server=local_server.make_server(int(sys.argv[1]),sys.argv[2])
print('READY',flush=True)
server.serve_forever()
'''


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def run_server(port, data):
    return subprocess.Popen([sys.executable, '-u', '-c', SERVER, str(port), str(data)],
                            cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def request(port, path, payload=None, token=None):
    base = f'http://127.0.0.1:{port}'
    headers = {'Referer': base + '/', 'X-Hot100-Session-Protocol': '2'}
    if token is not None:
        headers.update({'X-Hot100-Token': token, 'Content-Type': 'application/json'})
    req = Request(base + path, None if payload is None else json.dumps(payload).encode(), headers)
    with urlopen(req, timeout=4) as response:
        return json.load(response)


class DirectoryLockTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.processes = []

    def tearDown(self):
        for proc in self.processes:
            if proc.poll() is None:
                proc.kill()
            proc.communicate(timeout=5)
        self.temp.cleanup()

    def start(self, directory):
        port = free_port()
        proc = run_server(port, directory); self.processes.append(proc)
        self.assertEqual(proc.stdout.readline().strip(), 'READY')
        return proc, port

    def assert_locked(self, directory):
        proc = run_server(free_port(), directory); self.processes.append(proc)
        stdout, stderr = proc.communicate(timeout=5)
        self.assertNotEqual(proc.returncode, 0)
        self.assertNotIn('READY', stdout)
        self.assertIn('Hot100', stderr)

    def test_same_directory_alias_is_exclusive_and_crash_releases(self):
        data = self.root / 'data'; data.mkdir()
        (data / 'child').mkdir()
        first, _ = self.start(data)
        self.assert_locked(data / 'child' / '..')
        first.kill(); first.communicate(timeout=5)
        self.start(data)

    def test_separate_roots_sharing_progress_directory_are_exclusive(self):
        a, b, shared = self.root/'a', self.root/'b', self.root/'shared'
        for path in (a, b, shared): path.mkdir()
        (shared/'learning.json').write_text(json.dumps({'revision':1,'state':{}}), encoding='utf-8')
        for path in (a, b): (path/'location.json').write_text(json.dumps({'directory':str(shared)}), encoding='utf-8')
        self.start(a)
        self.assert_locked(b)

    def test_symlink_alias_is_exclusive(self):
        data, alias = self.root/'data', self.root/'alias'
        data.mkdir()
        try:
            os.symlink(data, alias, target_is_directory=True)
        except OSError as error:
            self.skipTest('directory symlinks unavailable: ' + str(error))
        self.start(data)
        self.assert_locked(alias)

    def test_case_alias_to_base_does_not_lock_itself(self):
        data = self.root/'MiXeD'; data.mkdir()
        alias = data.with_name('mixed')
        if not alias.exists():
            self.skipTest('filesystem is case sensitive')
        (data/'learning.json').write_text(json.dumps({'revision':1,'state':{}}), encoding='utf-8')
        (data/'location.json').write_text(json.dumps({'directory':str(alias)}), encoding='utf-8')
        self.start(data)

    def test_relocation_holds_new_lock_and_releases_old(self):
        a, b, target, next_target = (self.root/name for name in ('a','b','target','next'))
        a.mkdir(); b.mkdir(); target.mkdir(); next_target.mkdir()
        _, port = self.start(a)
        token = request(port, '/api/session')['token']
        request(port, '/api/directory', {'directory': str(target)}, token)
        (b/'location.json').write_text(json.dumps({'directory':str(target)}), encoding='utf-8')
        self.assert_locked(b)
        request(port, '/api/directory', {'directory':str(next_target)}, token)
        self.start(b)


if __name__ == '__main__':
    unittest.main()
