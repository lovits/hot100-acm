"""Index author-attributed public articles without copying unlicensed article bodies."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import json
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / 'reference' / 'author-index-cache'
CACHE.mkdir(exist_ok=True)
AUTHORS = {'endlesscheng': '灵茶山艾府', 'jyd': 'Krahets'}
QUERY = '''query($slug: String!, $first: Int, $skip: Int) {
  questionSolutionArticles(questionSlug: $slug, first: $first, skip: $skip) {
    totalNum edges { node { title slug topic { id } tags { nameTranslated name slug }
      author { profile { userSlug realName } } } }
  }
}'''


def fetch_page(slug, first=20, skip=0):
    cached = CACHE / f'{slug}-{skip}.json'
    if cached.exists():
        return json.loads(cached.read_text(encoding='utf-8'))
    payload = json.dumps({'query': QUERY, 'variables': {'slug': slug, 'first': first, 'skip': skip}}).encode()
    request = urllib.request.Request('https://leetcode.cn/graphql/', data=payload, headers={
        'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0',
        'Referer': f'https://leetcode.cn/problems/{slug}/solutions/'})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                data = json.load(response)
            if data.get('errors') or not data.get('data'):
                raise RuntimeError(str(data.get('errors')))
            result = data['data']['questionSolutionArticles']
            cached.write_text(json.dumps(result, ensure_ascii=False), encoding='utf-8')
            return result
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def collect(question):
    slug = question['titleSlug']
    data = fetch_page(slug)
    found = {key: [] for key in AUTHORS}
    for edge in data['edges']:
        node = edge['node']
        author = (node.get('author') or {}).get('profile') or {}
        key = author.get('userSlug')
        if key not in AUTHORS:
            continue
        found[key].append({
            'id': f"{key}-{node['topic']['id']}", 'author': AUTHORS[key], 'authorSlug': key,
            'authorUrl': f'https://leetcode.cn/u/{key}/', 'title': node['title'],
            'url': f"https://leetcode.cn/problems/{slug}/solutions/{node['topic']['id']}/{node['slug']}/",
            'articleId': node['topic']['id'], 'articleSlug': node['slug'],
            'questionSlug': slug, 'questionId': int(question['questionFrontendId']),
            'tags': [tag['nameTranslated'] or tag['name'] for tag in node['tags']],
            'kind': 'external', 'verifiedAt': '2026-11-02',
        })
    return {'questionId': int(question['questionFrontendId']), 'questionSlug': slug,
            'title': question['translatedTitle'], 'authors': found,
            'checkedArticles': len(data['edges']), 'totalArticles': data['totalNum']}


def main():
    questions = json.loads((ROOT / 'reference/question-links.json').read_text(encoding='utf-8'))
    results = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(collect, question): question for question in questions}
        for future in as_completed(futures):
            item = future.result()
            results.append(item)
            if len(results) % 20 == 0:
                print(f'Indexed {len(results)} / {len(questions)}', flush=True)
    order = {int(q['questionFrontendId']): i for i, q in enumerate(questions)}
    results.sort(key=lambda item: order[item['questionId']])
    (ROOT / 'reference/author-index.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({name: {'found': sum(bool(row['authors'][key]) for row in results),
                             'notInFirst20': [row['questionId'] for row in results if not row['authors'][key]]}
                      for key, name in AUTHORS.items()}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
