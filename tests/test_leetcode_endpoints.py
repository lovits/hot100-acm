import json
import socket
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import local_server


class FakeLeetCode:
    def __init__(self, _node): self.signed_in = False
    def status(self): return {'signedIn': self.signed_in, 'username': 'tester' if self.signed_in else ''}
    def manual(self, session, csrf):
        if session != 'session' or csrf != 'csrf': raise ValueError('invalid')
        self.signed_in = True
        return self.status()
    def solved(self): return [1, 2]


class EndpointTests(unittest.TestCase):
    def test_login_and_solved_require_local_origin_and_token(self):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0)); port = probe.getsockname()[1]
        with tempfile.TemporaryDirectory() as directory, patch.object(local_server, 'LeetCodeSession', FakeLeetCode):
            server = local_server.make_server(port, directory)
            thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
            origin = f'http://127.0.0.1:{port}'
            def request(path, data=None, headers=None):
                req = Request(origin + path, data=None if data is None else json.dumps(data).encode(), headers=headers or {})
                try:
                    with urlopen(req, timeout=4) as response: return response.status, json.load(response)
                except HTTPError as error:
                    with error: return error.code, json.load(error)
            try:
                status, session = request('/api/session', headers={'Referer': origin + '/', 'X-Hot100-Session-Protocol':'2'})
                self.assertEqual(status, 200)
                headers = {'Origin': origin, 'Content-Type': 'application/json', 'X-Hot100-Token': session['token']}
                self.assertEqual(request('/api/leetcode/manual', {'session':'session', 'csrf':'csrf'}, {'Origin':'https://example.com'})[0], 403)
                self.assertEqual(request('/api/leetcode/manual', {'session':'session', 'csrf':'csrf'}, headers)[1]['signedIn'], True)
                self.assertEqual(request('/api/leetcode/solved', {}, headers)[1]['ids'], [1, 2])
                self.assertNotIn('cookie', request('/api/leetcode/status', headers={'Referer': origin + '/'})[1])
            finally:
                server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__': unittest.main()
