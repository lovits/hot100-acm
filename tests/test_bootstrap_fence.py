import http.client
import json
import re
import socket
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import patch

import local_server


class FakeTransport:
    entered = None
    release = None

    def __init__(self, directory):
        pass

    def request(self, method, path, payload=None, query=None):
        if self.entered:
            self.entered.set()
            if not self.release.wait(5):
                raise TimeoutError('test barrier timed out')
        return 200, {'epoch': 1, 'planEpoch': 1, 'revision': 28}


class BootstrapFenceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patch = patch.object(local_server, 'SyncTransport', FakeTransport)
        self.patch.start()
        self.start_server()

    def tearDown(self):
        FakeTransport.entered = FakeTransport.release = None
        self.stop_server()
        self.patch.stop()
        self.tmp.cleanup()

    def start_server(self):
        sock = socket.socket()
        sock.bind(('127.0.0.1', 0))
        self.port = sock.getsockname()[1]
        sock.close()
        self.server = local_server.make_server(self.port, self.tmp.name)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(5)

    def request(self, method, path, payload=None, token=None, page=None, protocol=False):
        conn = http.client.HTTPConnection('127.0.0.1', self.port, timeout=8)
        headers = {'Referer': f'http://127.0.0.1:{self.port}/'}
        if token is not None:
            headers['X-Hot100-Token'] = token
        if page is not None:
            headers['X-Hot100-Page'] = page
        if protocol:
            headers['X-Hot100-Session-Protocol'] = '2'
        if payload is not None:
            headers['Content-Type'] = 'application/json'
        conn.request(method, path, None if payload is None else json.dumps(payload), headers)
        response = conn.getresponse()
        raw = response.read()
        conn.close()
        return response.status, raw

    def new_page(self, path='/'):
        status, body = self.request('GET', path)
        self.assertEqual(status, 200)
        match = re.search(rb'<meta name="hot100-page" content="([^"]+)">', body)
        self.assertIsNotNone(match)
        return match.group(1).decode()

    def session(self, page):
        status, body = self.request('GET', '/api/session', page=page, protocol=True)
        return status, json.loads(body)

    @staticmethod
    def fresh():
        return {'accepted': [], 'favorites': [], 'conflicts': [], 'codes': {}, 'notes': {}, 'history': {},
                'progressMeta': {}, 'studyPlan': {'learned': {}, 'events': []},
                'studySettings': {'dailyGoal': 5, 'reviewLimit': 20, 'intervals': [1, 2, 4, 7, 15, 30]}}

    def bootstrap(self, token, revision=0, state=None):
        status, body = self.request('POST', '/api/sync/bootstrap', {'epoch': 1, 'planEpoch': 1,
                                    'revision': revision, 'state': state if state is not None else self.fresh()}, token)
        return status, json.loads(body)

    def test_old_page_revoked_and_namespace_survives_restart(self):
        old_page = self.new_page()
        self.assertEqual(self.request('GET', '/api/session', page=old_page)[0], 409)
        status, old = self.session(old_page)
        self.assertEqual(status, 200)
        status, result = self.bootstrap(old['token'])
        self.assertEqual(status, 200)
        namespace = result['state']['storageNamespace']
        self.assertNotEqual(old['token'], result['token'])
        self.assertEqual(self.session(old_page)[0], 403)
        self.assertEqual(self.request('POST', '/api/progress', {'revision': 1, 'state': {'codes': {'1': 'old'}}}, old['token'])[0], 403)
        for path in ('/', '/training/'):
            self.assertEqual(self.new_page(path), result['page'])
        self.stop_server()
        self.start_server()
        self.assertEqual(self.session(result['page'])[0], 403)
        status, current = self.session(self.new_page())
        self.assertEqual(status, 200)
        self.assertEqual(current['state']['storageNamespace'], namespace)
        self.assertEqual(self.request('POST', '/api/progress', {'revision': current['revision'], 'state': {'codes': {'1': 'old'}}}, current['token'])[0], 409)

    def test_old_requests_cannot_pass_lock_during_rotation(self):
        page = self.new_page()
        _, old = self.session(page)
        FakeTransport.entered, FakeTransport.release = threading.Event(), threading.Event()
        results = {}
        bootstrap = threading.Thread(target=lambda: results.update(bootstrap=self.bootstrap(old['token'])))
        bootstrap.start()
        self.assertTrue(FakeTransport.entered.wait(5))
        progress = threading.Thread(target=lambda: results.update(progress=self.request('POST', '/api/progress', {'revision': 1, 'state': {'codes': {'1': 'old'}}}, old['token'])[0]))
        renewal = threading.Thread(target=lambda: results.update(renewal=self.session(page)[0]))
        progress.start(); renewal.start()
        FakeTransport.release.set()
        bootstrap.join(8); progress.join(8); renewal.join(8)
        self.assertEqual(results['bootstrap'][0], 200)
        self.assertEqual(results['progress'], 403)
        self.assertEqual(results['renewal'], 403)

    def test_stale_local_revision_refuses_bootstrap(self):
        page = self.new_page()
        _, old = self.session(page)
        self.assertEqual(self.request('POST', '/api/progress', {'revision': 0, 'state': {'codes': {'1': 'kept'}}}, old['token'])[0], 200)
        self.assertEqual(self.bootstrap(old['token'])[0], 409)
        self.assertFalse((Path(self.tmp.name) / 'storage-fence.json').exists())

    def test_normal_save_cannot_install_foreign_namespace(self):
        page = self.new_page()
        _, session = self.session(page)
        state = self.fresh(); state['storageNamespace'] = 'from-another-device'
        self.assertEqual(self.request('POST', '/api/progress', {'revision': 0, 'state': state}, session['token'])[0], 409)
        self.assertEqual(self.session(page)[0], 200)
        self.assertFalse((Path(self.tmp.name) / 'storage-fence.json').exists())

    def test_valid_namespaced_backup_restores_after_corruption(self):
        page = self.new_page()
        _, old = self.session(page)
        status, result = self.bootstrap(old['token'])
        self.assertEqual(status, 200)
        self.stop_server()
        (Path(self.tmp.name) / 'learning.json').write_text('corrupt', encoding='utf-8')
        self.start_server()
        status, restored = self.session(self.new_page())
        self.assertEqual(status, 200)
        self.assertEqual(restored['state']['storageNamespace'], result['state']['storageNamespace'])
        self.assertTrue(restored['recovered'])

    def test_damaged_fence_and_interrupted_bootstrap_fail_closed(self):
        self.stop_server()
        fence = Path(self.tmp.name) / 'storage-fence.json'
        fence.write_text('corrupt', encoding='utf-8')
        self.start_server()
        self.assertEqual(self.session(self.new_page())[0], 503)
        self.stop_server()
        fence.write_text(json.dumps({'namespace': 'unfinished'}), encoding='utf-8')
        self.start_server()
        self.assertEqual(self.session(self.new_page())[0], 503)

    def test_older_backup_cannot_remove_persistent_fence(self):
        page = self.new_page()
        _, old = self.session(page)
        self.assertEqual(self.bootstrap(old['token'])[0], 200)
        self.stop_server()
        (Path(self.tmp.name) / 'learning.json').write_text('corrupt', encoding='utf-8')
        (Path(self.tmp.name) / 'learning.backup.json').write_text(json.dumps({'revision': 0, 'state': {}}), encoding='utf-8')
        self.start_server()
        self.assertEqual(self.session(self.new_page())[0], 503)

    def assert_pending_recovers(self, old_page):
        self.assertEqual(self.session(old_page)[0], 503)
        self.stop_server()
        self.start_server()
        self.assertEqual(self.session(old_page)[0], 403)
        status, result = self.session(self.new_page())
        self.assertEqual(status, 200)
        self.assertTrue(result['state']['storageNamespace'])
        self.assertEqual(result['state']['cloudSync']['epoch'], 1)
        self.assertTrue(result['state']['cloudSync']['initialPullPending'])
        self.assertEqual(json.loads((Path(self.tmp.name) / 'storage-fence.json').read_text())['phase'], 'committed')
        self.assertEqual(json.loads((Path(self.tmp.name) / 'learning.backup.json').read_text())['state'], result['state'])

    def test_interruption_after_fence_recovers(self):
        page = self.new_page(); _, old = self.session(page)
        with patch.object(local_server.Store, 'write', side_effect=OSError('simulated interruption')):
            self.assertEqual(self.bootstrap(old['token'])[0], 503)
        self.assert_pending_recovers(page)

    def test_interruption_after_data_before_backup_recovers(self):
        page = self.new_page(); _, old = self.session(page)
        with patch.object(local_server, 'backup_bootstrap', side_effect=OSError('simulated interruption')):
            self.assertEqual(self.bootstrap(old['token'])[0], 503)
        self.assert_pending_recovers(page)

    def test_interruption_after_backup_recovers_if_primary_is_corrupt(self):
        page = self.new_page(); _, old = self.session(page)
        original = local_server.write_atomic_json
        def interrupt_commit(path, value, create=False):
            if value.get('phase') == 'committed':
                raise OSError('simulated interruption')
            return original(path, value, create)
        with patch.object(local_server, 'write_atomic_json', side_effect=interrupt_commit):
            self.assertEqual(self.bootstrap(old['token'])[0], 503)
        (Path(self.tmp.name) / 'learning.json').write_text('corrupt', encoding='utf-8')
        self.assert_pending_recovers(page)

    def test_pending_recovery_rejects_unexpected_data_without_overwrite(self):
        page = self.new_page(); _, old = self.session(page)
        with patch.object(local_server.Store, 'write', side_effect=OSError('simulated interruption')):
            self.assertEqual(self.bootstrap(old['token'])[0], 503)
        self.stop_server()
        path = Path(self.tmp.name) / 'learning.json'
        unexpected = {'revision': 1, 'state': {'codes': {'1': 'user data'}}}
        path.write_text(json.dumps(unexpected), encoding='utf-8')
        self.start_server()
        self.assertEqual(self.session(self.new_page())[0], 503)
        self.assertEqual(json.loads(path.read_text()), unexpected)

    def test_interruption_before_fence_freezes_old_token_until_restart(self):
        page = self.new_page(); _, old = self.session(page)
        with patch.object(local_server, 'write_atomic_json', side_effect=OSError('simulated interruption')):
            self.assertEqual(self.bootstrap(old['token'])[0], 503)
        self.assertEqual(self.session(page)[0], 503)
        self.stop_server(); self.start_server()
        self.assertEqual(self.session(self.new_page())[0], 200)
        self.assertFalse((Path(self.tmp.name) / 'storage-fence.json').exists())


if __name__ == '__main__':
    unittest.main()
