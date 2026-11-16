"""Fetch author-verified articles for the local copy authorized by the user."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import hashlib
import json
import urllib.request
import time

ROOT = Path(__file__).resolve().parent
QUERY = '''query($slug: String!) { solutionArticle(slug: $slug) {
 title content author { profile { userSlug realName } } } }'''


def fetch(row):
    qid = row['questionId']
    item = row['authors']['endlesscheng'][0] if row['authors']['endlesscheng'] else {
        'articleSlug': 'ru-he-xiang-chu-zhuang-tai-ding-yi-he-zh-1wt1',
        'articleId': 2102725,
        'url': 'https://leetcode.cn/problems/house-robber/solutions/2102725/ru-he-xiang-chu-zhuang-tai-ding-yi-he-zh-1wt1/'}
    path = ROOT / 'reference/author-markdown/endlesscheng-lc' / f'{qid}.md'
    meta_path = path.with_suffix('.json')
    if path.exists() and meta_path.exists():
        return json.loads(meta_path.read_text(encoding='utf-8'))
    request = urllib.request.Request('https://leetcode.cn/graphql/',
        data=json.dumps({'query': QUERY, 'variables': {'slug': item['articleSlug']}}).encode(),
        headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        data = json.load(response)
    article = (data.get('data') or {}).get('solutionArticle')
    if data.get('errors'):
        raise RuntimeError(str(data['errors']))
    if not article or article['author']['profile']['userSlug'] != 'endlesscheng':
        raise ValueError(f'Article author not verified: {qid}')
    if not article['content'] or len(article['content']) < 100:
        raise ValueError(f'Article content unavailable: {qid}')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(article['content'], encoding='utf-8')
    meta = {'problemId': qid, 'authorSlug': 'endlesscheng', 'author': '灵茶山艾府',
            'title': article['title'], 'sourceUrl': item['url'],
            'sourceType': 'user-authorized-leetcode', 'license': '作者授权（用户确认）',
            'permissionNote': '用户于 2026-11-02 明确确认作者已授权给其转载，用于本地个人学习站。',
            'markdownPath': str(path.relative_to(ROOT)).replace('\\', '/'),
            'contentSha256': hashlib.sha256(article['content'].encode()).hexdigest()}
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    return meta


def main():
    rows = json.loads((ROOT / 'reference/author-index.json').read_text(encoding='utf-8'))
    results = []
    # Respect the site's request limit; cached bodies never cause a network call.
    for row in rows:
        cached = (ROOT / 'reference/author-markdown/endlesscheng-lc' / f"{row['questionId']}.md").exists()
        for attempt in range(4):
            try:
                results.append(fetch(row))
                break
            except RuntimeError as error:
                if '请求过于频繁' not in str(error) or attempt == 3:
                    raise
                print('Site requested a slower rate; waiting before continuing.', flush=True)
                time.sleep(65)
        if len(results) % 10 == 0:
            print(f'Imported {len(results)} / 100 author articles', flush=True)
        if not cached:
            time.sleep(4)
    results.sort(key=lambda item: item['problemId'])
    files = json.loads((ROOT / 'reference/author-licensed-files.json').read_text(encoding='utf-8'))
    for file in files:
        if file['authorSlug'] == 'jyd':
            results.append({**file, 'title': file['name'].removesuffix('.md'),
                            'sourceUrl': file['html_url'], 'sourceType': 'licensed-repository',
                            'markdownPath': f"reference/author-markdown/jyd/{file['problemId']}.md"})
    (ROOT / 'reference/author-imports.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'endlesscheng': sum(x['authorSlug']=='endlesscheng' for x in results),
                      'krahets': sum(x['authorSlug']=='jyd' for x in results)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
