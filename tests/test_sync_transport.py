import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from sync_transport import SyncTransport, validate_config


CONFIG = {'host': 'hot100.example.ts.net', 'address': '100.64.0.1', 'token': 'a' * 64}


class SyncTransportTests(unittest.TestCase):
    def test_config_restricts_server_to_tailscale_and_hides_token(self):
        with tempfile.TemporaryDirectory() as directory:
            transport = SyncTransport(directory)
            transport.configure(CONFIG)
            self.assertEqual(transport.status(), {'configured': True, 'host': CONFIG['host'], 'address': CONFIG['address']})
            self.assertEqual(transport.load(), CONFIG)
            if os.name != 'nt':
                self.assertEqual(Path(transport.path).stat().st_mode & 0o777, 0o600)
            for address in ['127.0.0.1', '8.8.8.8', '192.168.1.1']:
                with self.assertRaises(ValueError):
                    validate_config({**CONFIG, 'address': address})
            with self.assertRaises(ValueError):
                validate_config({**CONFIG, 'host': 'attacker.example'})

    def test_transport_only_allows_sync_routes_and_does_not_follow_redirects(self):
        class Response:
            status = 302
            def read(self, limit):
                return json.dumps({'redirect': True}).encode()

        class Connection:
            def __init__(self, host, address):
                self.host, self.address = host, address
            def request(self, method, path, body, headers):
                self.args = method, path, body, headers
            def getresponse(self):
                return Response()
            def close(self):
                pass

        with tempfile.TemporaryDirectory() as directory:
            transport = SyncTransport(directory)
            transport.configure(CONFIG)
            with patch('sync_transport.PrivateHTTPSConnection', Connection):
                self.assertEqual(transport.request('GET', '/v1/meta')[0], 302)
                with self.assertRaises(ValueError):
                    transport.request('GET', '/v1/private')
                with self.assertRaises(ValueError):
                    transport.request('GET', '/v1/changes', query={'epoch': 0, 'after': -1})


if __name__ == '__main__':
    unittest.main()
