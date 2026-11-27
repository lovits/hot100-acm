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

    def test_retry_only_transient_get_failures(self):
        class Response:
            status = 200
            def read(self, limit):
                return b'{}'

        class Connection:
            attempts = 0
            def __init__(self, host, address):
                pass
            def request(self, method, path, body, headers):
                Connection.attempts += 1
                if Connection.attempts == 1:
                    raise TimeoutError('simulated timeout')
            def getresponse(self):
                return Response()
            def close(self):
                pass

        with tempfile.TemporaryDirectory() as directory:
            transport = SyncTransport(directory)
            transport.configure(CONFIG)
            with patch('sync_transport.PrivateHTTPSConnection', Connection), patch('sync_transport.time.sleep'):
                self.assertEqual(transport.request('GET', '/v1/meta'), (200, {}))
                self.assertEqual(Connection.attempts, 2)
                Connection.attempts = 0
                with self.assertRaises(TimeoutError):
                    transport.request('POST', '/v1/sync', payload={})
                self.assertEqual(Connection.attempts, 1)


if __name__ == '__main__':
    unittest.main()
