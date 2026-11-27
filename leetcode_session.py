"""LeetCode login and API access, scoped to the current local-server process."""
import json
import re
import subprocess
import threading
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MAX_RESPONSE = 8 * 1024 * 1024
USER_QUERY = 'query globalData { userStatus { isSignedIn username } }'
LIST_QUERY = '''query problemsetQuestionList($categorySlug:String,$limit:Int,$skip:Int,$filters:QuestionListFilterInput) {
  problemsetQuestionList(categorySlug:$categorySlug,limit:$limit,skip:$skip,filters:$filters) {
    hasMore total questions { frontendQuestionId status }
  }
}'''
QUESTION_QUERY = 'query questionData($titleSlug:String!) { question(titleSlug:$titleSlug) { questionId questionFrontendId } }'
SUBMISSIONS_QUERY = '''query submissionList($offset:Int,$limit:Int,$lastKey:String,$questionSlug:String!) {
  submissionList(offset:$offset,limit:$limit,lastKey:$lastKey,questionSlug:$questionSlug) {
    submissions { id statusDisplay lang timestamp }
  }
}'''
DETAIL_QUERY = 'query submissionDetail($submissionId:ID!) { submissionDetail(submissionId:$submissionId) { id code lang statusDisplay timestamp } }'


def build_cookie(session, csrf):
    if not isinstance(session, str) or not isinstance(csrf, str):
        raise ValueError('Cookie 格式不正确')
    combined = session.strip() + '; ' + csrf.strip()
    def extract(key, fallback):
        match = re.search(r'(?:^|[;\s])' + re.escape(key) + r'=([^;\s]+)', combined, re.I)
        if match:
            return match.group(1)
        value = fallback.strip()
        return value if re.fullmatch(r'[^;\s]+', value) and not re.match(r'^(?:LEETCODE_SESSION|csrftoken)=', value, re.I) else ''
    a, b = extract('LEETCODE_SESSION', session), extract('csrftoken', csrf)
    if not a or not b or len(a) + len(b) > 16384:
        raise ValueError('请提供 LEETCODE_SESSION 和 csrftoken')
    return f'LEETCODE_SESSION={a}; csrftoken={b}'


class LeetCodeSession:
    def __init__(self, node, runner=None):
        self.node = node
        self.runner = runner or self._request
        self.cookie = None
        self.username = None
        self.lock = threading.Lock()
        self.browser_lock = threading.Lock()
        rows = json.loads((ROOT / 'dist/training/data/problems.json').read_text('utf-8'))
        self.problems = {str(row['id']): row['url'].rstrip('/').split('/')[-1] for row in rows}

    def _request(self, cookie, path, data=None):
        csrf = re.search(r'(?:^|;\s*)csrftoken=([^;]+)', cookie)
        headers = {'Content-Type': 'application/json', 'Cookie': cookie, 'Origin': 'https://leetcode.cn', 'Referer': 'https://leetcode.cn/', 'User-Agent': 'Mozilla/5.0 Hot100-ACM', 'x-csrftoken': csrf.group(1) if csrf else ''}
        body = None if data is None else json.dumps(data).encode('utf-8')
        request = urllib.request.Request('https://leetcode.cn' + path, data=body, headers=headers, method='GET' if data is None else 'POST')
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read(MAX_RESPONSE + 1)
            if len(raw) > MAX_RESPONSE:
                raise ValueError('力扣响应过大')
            return json.loads(raw)

    def graphql(self, cookie, query, variables=None):
        response = self.runner(cookie, '/graphql', {'query': query, 'variables': variables or {}})
        if not isinstance(response, dict) or response.get('errors') or response.get('status_code') == 1002:
            raise ValueError('力扣请求失败或登录已过期')
        return response.get('data') or {}

    def login(self, cookie):
        profile = self.graphql(cookie, USER_QUERY).get('userStatus') or {}
        if not profile.get('isSignedIn'):
            raise ValueError('力扣登录未验证成功，请检查 Cookie')
        with self.lock:
            self.cookie, self.username = cookie, str(profile.get('username') or '')
        return self.status()

    def manual(self, session, csrf):
        return self.login(build_cookie(session, csrf))

    def browser(self):
        if not self.browser_lock.acquire(blocking=False):
            raise ValueError('浏览器登录已在进行中')
        try:
            proc = subprocess.run([self.node, str(ROOT / 'leetcode_browser.cjs')], capture_output=True, timeout=660, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            result = json.loads(proc.stdout)
            if result.get('status') != 'success':
                raise ValueError(result.get('message') or '浏览器登录已取消或超时')
            return self.login(result['cookie'])
        finally:
            self.browser_lock.release()

    def status(self):
        with self.lock:
            return {'signedIn': bool(self.cookie), 'username': self.username or ''}

    def logout(self):
        with self.lock:
            self.cookie = self.username = None
        return self.status()

    def get_cookie(self):
        with self.lock:
            cookie = self.cookie
        if not cookie:
            raise ValueError('请先登录力扣')
        return cookie

    def slug(self, problem_id):
        slug = self.problems.get(str(problem_id))
        if not slug or not re.fullmatch(r'[a-z0-9-]+', slug):
            raise ValueError('题目不在 Hot100 中')
        return slug

    def solved(self):
        cookie, results, skip = self.get_cookie(), [], 0
        while True:
            data = self.graphql(cookie, LIST_QUERY, {'categorySlug': '', 'limit': 100, 'skip': skip, 'filters': {}})
            page = data.get('problemsetQuestionList')
            if not isinstance(page, dict) or not isinstance(page.get('questions'), list):
                raise ValueError('力扣题库响应格式不正确')
            for row in page['questions']:
                if str(row.get('frontendQuestionId')) in self.problems and row.get('status') == 'ac':
                    results.append(int(row['frontendQuestionId']))
            if not page.get('hasMore'):
                return sorted(set(results))
            skip += 100
            if skip > 10000 or not page['questions']:
                raise ValueError('力扣题库分页异常')

    def submissions(self, problem_id):
        slug = self.slug(problem_id)
        data = self.graphql(self.get_cookie(), SUBMISSIONS_QUERY, {'offset': 0, 'limit': 20, 'questionSlug': slug})
        return (data.get('submissionList') or {}).get('submissions') or []

    def detail(self, problem_id, submission_id):
        submission_id = str(submission_id)
        if not re.fullmatch(r'\d{1,24}', submission_id) or not any(str(item.get('id')) == submission_id for item in self.submissions(problem_id)):
            raise ValueError('提交记录不属于当前题目')
        return self.graphql(self.get_cookie(), DETAIL_QUERY, {'submissionId': submission_id}).get('submissionDetail')

    def submit(self, problem_id, language, code):
        slug = self.slug(problem_id)
        if language not in ('python3', 'cpp') or not isinstance(code, str) or not code.strip() or len(code.encode('utf-8')) > 512 * 1024:
            raise ValueError('代码或语言不受支持')
        cookie = self.get_cookie()
        question = self.graphql(cookie, QUESTION_QUERY, {'titleSlug': slug}).get('question') or {}
        if str(question.get('questionFrontendId')) != str(problem_id) or not str(question.get('questionId', '')).isdigit():
            raise ValueError('无法核对力扣题目编号')
        return self.runner(cookie, f'/problems/{slug}/submit/', {'lang': language, 'question_id': question['questionId'], 'typed_code': code})

    def check(self, submission_id):
        if not re.fullmatch(r'\d{1,24}', str(submission_id)):
            raise ValueError('提交编号不正确')
        return self.runner(self.get_cookie(), f'/submissions/detail/{submission_id}/check/')
