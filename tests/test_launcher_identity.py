import importlib.util
import importlib.machinery
from pathlib import Path
import socket
import tempfile
import threading
import unittest
from unittest.mock import patch

import local_server


class LauncherIdentityTests(unittest.TestCase):
    def test_health_identifies_installed_copy_and_rejects_another_copy(self):
        file = Path(__file__).resolve().parents[1] / 'launch.pyw'
        loader = importlib.machinery.SourceFileLoader('hot100_launcher', str(file))
        spec = importlib.util.spec_from_loader(loader.name, loader)
        launcher = importlib.util.module_from_spec(spec)
        with tempfile.TemporaryDirectory() as data, patch.dict('os.environ', {'LOCALAPPDATA': data}):
            loader.exec_module(launcher)
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', 0))
                port = probe.getsockname()[1]
            server = local_server.make_server(port, data)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with patch.object(launcher, 'URL', f'http://127.0.0.1:{server.server_port}'):
                    self.assertTrue(launcher.identity())
                    with patch.object(launcher, 'INSTANCE_ID', 'different-installation'):
                        self.assertFalse(launcher.identity())
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == '__main__':
    unittest.main()
