import json
import unittest
from unittest.mock import patch

from leetcode_session import LeetCodeSession, build_cookie


class LeetCodeSessionTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        def runner(cookie, path, data=None):
            self.calls.append((path, data))
            if path == '/graphql':
                query = data['query']
                if 'globalData' in query: return {'data': {'userStatus': {'isSignedIn': True, 'username': 'tester'}}}
                if 'problemsetQuestionList' in query:
                    return {'data': {'problemsetQuestionList': {'hasMore': False, 'questions': [{'frontendQuestionId': '1', 'status': 'ac'}, {'frontendQuestionId': '2', 'status': None}]}}}
                if 'questionData' in query: return {'data': {'question': {'questionId': '1', 'questionFrontendId': '1'}}}
                if 'submissionList' in query: return {'data': {'submissionList': {'submissions': [{'id': '123', 'lang': 'python3'}]}}}
                if 'submissionDetail' in query: return {'data': {'submissionDetail': {'id': '123', 'code': 'print(1)', 'lang': 'python3'}}}
            if path.endswith('/submit/'): return {'submission_id': 123}
            if path.endswith('/check/'): return {'state': 'SUCCESS', 'status_msg': 'Accepted'}
            raise AssertionError(path)
        self.session = LeetCodeSession('node', runner=runner)

    def test_cookie_parsing_and_login(self):
        self.assertEqual(build_cookie('LEETCODE_SESSION=abc==; csrftoken=xyz', ''), 'LEETCODE_SESSION=abc==; csrftoken=xyz')
        self.assertEqual(build_cookie('abc==', 'xyz'), 'LEETCODE_SESSION=abc==; csrftoken=xyz')
        with self.assertRaises(ValueError): build_cookie('LEETCODE_SESSION=abc', '')
        self.assertEqual(self.session.manual('abc', 'xyz')['username'], 'tester')
        self.assertNotIn('cookie', self.session.status())
        self.assertEqual(self.session.logout()['signedIn'], False)

    def test_operations_verify_problem_and_submission(self):
        self.session.manual('abc', 'xyz')
        self.assertEqual(self.session.solved(), [1])
        self.assertEqual(self.session.detail(1, '123')['code'], 'print(1)')
        with self.assertRaises(ValueError): self.session.detail(1, '999')
        with self.assertRaises(ValueError): self.session.submit(9999, 'python3', 'pass')
        self.assertEqual(self.session.submit(1, 'python3', 'pass')['submission_id'], 123)
        self.assertEqual(self.session.check('123')['status_msg'], 'Accepted')

    def test_isolated_browser_result_is_validated_and_not_returned(self):
        payload = json.dumps({'status': 'success', 'cookie': 'LEETCODE_SESSION=abc; csrftoken=xyz'}).encode()
        with patch('leetcode_session.subprocess.run') as run:
            run.return_value.stdout = payload
            result = self.session.browser()
            self.assertTrue(result['signedIn'])
            self.assertNotIn('cookie', result)


if __name__ == '__main__': unittest.main()
