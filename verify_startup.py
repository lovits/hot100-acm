"""Regression checks for unavailable progress locations and fast startup failure."""
import json
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock
from importlib.machinery import SourceFileLoader
import local_server

with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    settings = root / 'location.json'
    settings.write_text(json.dumps({'directory': str(root / 'missing')}))
    server = local_server.make_server(0, root)
    server.server_close()
    assert list(root.glob('location.unavailable.*.json'))
    assert json.loads(settings.read_text())['directory'] == str(root)
    server = local_server.make_server(0, root)
    server.server_close()

# A stale location must not hide valid default data or report a recovery error.
with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp)
    progress = {'revision': 7, 'state': {'notes': {'1': 'keep my progress'}}}
    (root / 'learning.json').write_text(json.dumps(progress))
    (root / 'location.json').write_text(json.dumps({'directory': str(root / 'missing')}))
    server = local_server.make_server(23868, root)
    import threading
    import urllib.request
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        for _ in range(2):
            request = urllib.request.Request('http://127.0.0.1:23868/api/session', headers={'Referer': 'http://127.0.0.1:23868/'})
            with urllib.request.urlopen(request) as response:
                session = json.load(response)
            assert session['state'] == progress['state']
            assert session['revision'] == 7
            assert session['recoveryWarning'] == ''
        assert json.loads((root / 'learning.json').read_text()) == progress
    finally:
        server.shutdown()
        server.server_close()
        thread.join()

launcher = SourceFileLoader('startup_launcher', str(Path(__file__).with_name('launch.pyw'))).load_module()
with patch.object(launcher, 'identity', return_value=False), patch.object(launcher, 'occupied', return_value=False), patch.object(launcher.subprocess, 'Popen') as spawn, patch.object(launcher.time, 'sleep') as sleep:
    spawn.return_value.poll.return_value = 1
    try:
        launcher.main()
        raise AssertionError('Expected startup error')
    except RuntimeError as error:
        assert '启动失败' in str(error)
    sleep.assert_not_called()
print('Startup regression checks passed')
