"""Launch the packaged embedded Python/Node runtime and exercise the real API."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory() as temporary:
    folder = Path(temporary)
    with ZipFile(ROOT / 'release-work/publish/Hot100-Windows-x64-release.zip') as archive:
        archive.extractall(folder)
    app = folder / 'Hot100'
    env = {**os.environ, 'HOT100_NODE': str(app / 'runtime/node.exe'), 'LOCALAPPDATA': str(folder / 'progress')}
    log_path = folder / 'server.log'
    with log_path.open('wb') as log:
        process = subprocess.Popen([str(app / 'runtime/python/python.exe'), str(app / 'local_server.py')], cwd=app, env=env, stdout=log, stderr=log)
    origin = 'http://127.0.0.1:18765'
    def read(path, data=None, token=None):
        headers = {'Referer': origin + '/', 'X-Hot100-Session-Protocol': '2'}
        if data is not None:
            headers.update({'Content-Type': 'application/json', 'Origin': origin, 'X-Hot100-Token': token})
        request = urllib.request.Request(origin + path, data=json.dumps(data).encode() if data is not None else None, headers=headers)
        with urllib.request.urlopen(request, timeout=60) as response:
            return json.load(response)
    try:
        for attempt in range(60):
            if process.poll() is not None:
                raise RuntimeError(log_path.read_text(errors='replace'))
            try:
                health = read('/api/health')
                break
            except OSError:
                time.sleep(.2)
        else:
            raise AssertionError('Packaged server did not start')
        assert health['app'] == 'hot100-acm-local-v2'
        session = read('/api/session')
        token = session['token']
        problems = read('/training/data/problems.json')
        assert len(problems) == 100
        solutions = read('/training/data/solutions.json')
        for ident in [3, 23, 79, 138, 142, 160, 200, 215, 236, 994]:
            for mode in ['acm', 'core']:
                result = read('/api/judge', {'problemId': ident, 'mode': mode, 'language': 'python3', 'code': solutions[str(ident)]['python3'][mode]}, token)
                assert result['ok'] and all(case['ok'] for case in result['results']), result
        saved = read('/api/progress', {'revision': session['revision'], 'state': {'notes': {'1': 'Windows release smoke test'}}}, token)
        assert saved['revision'] == session['revision'] + 1
        assert read('/api/session')['state']['notes']['1'] == 'Windows release smoke test'
        print('Packaged Windows startup, data, Python ACM/core judge and progress save passed')
    finally:
        if process.poll() is None:process.terminate()
        process.communicate(timeout=10)
