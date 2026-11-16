"""Render attributed, locally stored articles; all runtime resources stay offline."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html import escape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, quote
import base64
import hashlib
import io
import json
import re
import tarfile
import urllib.request
import markdown

ROOT = Path(__file__).resolve().parent
DIST = ROOT / 'dist'
ASSETS = DIST / 'authors/assets'
ASSETS.mkdir(parents=True, exist_ok=True)
IMAGE_RE = re.compile(r'!\[([^\]]*)\]\((https?://[^\s)]+)(?:\s+"[^"]*")?\)')


def url_bytes(url):
    safe = quote(url, safe=':/?=&%#@+;,~')
    request = urllib.request.Request(safe, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read()


def vendor_math():
    target = DIST / 'vendor/katex'
    if (target / 'katex.min.js').exists():
        return
    package = json.loads(url_bytes('https://registry.npmjs.org/katex/0.16.22'))
    payload = url_bytes(package['dist']['tarball'])
    digest = 'sha512-' + base64.b64encode(hashlib.sha512(payload).digest()).decode()
    assert digest == package['dist']['integrity']
    target.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=io.BytesIO(payload), mode='r:gz') as archive:
        for member in archive.getmembers():
            name = member.name
            if not member.isfile():
                continue
            if name in ['package/dist/katex.min.js', 'package/dist/katex.min.css']:
                relative = name.removeprefix('package/dist/')
            elif name.startswith('package/dist/fonts/'):
                relative = name.removeprefix('package/dist/')
            elif name == 'package/LICENSE':
                relative = 'LICENSE'
            else:
                continue
            output = target / relative
            assert output.resolve().is_relative_to(target.resolve())
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_bytes(archive.extractfile(member).read())


def image_path(url):
    suffix = Path(urlsplit(url).path).suffix.lower()
    if suffix not in ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']:
        suffix = '.png'
    return ASSETS / (hashlib.sha256(url.encode()).hexdigest() + suffix)


def download_image(url):
    assert urlsplit(url).hostname in ['pic.leetcode-cn.com', 'pic.leetcode.cn']
    output = image_path(url)
    if not output.exists():
        data = url_bytes(url)
        if len(data) < 50:
            raise ValueError(f'Image unavailable: {url}')
        output.write_bytes(data)
    return url, output.relative_to(DIST).as_posix()


LANGUAGES = {'py': 'Python3', 'python': 'Python3', 'python3': 'Python3',
             'java': 'Java', 'cpp': 'C++', 'c++': 'C++', 'c': 'C', 'go': 'Go',
             'golang': 'Go', 'js': 'JavaScript', 'javascript': 'JavaScript', 'rust': 'Rust'}


def render_article(raw, images):
    blocks = []

    def protect(html):
        token = f'\n\nAUTHORPROTECTEDBLOCK{len(blocks)}TOKEN\n\n'
        blocks.append(html)
        return token

    def code(match):
        info, source = match.group(1), match.group(2)
        key = info.strip().split()[0].lower() if info.strip() else 'text'
        label = LANGUAGES.get(key, key)
        variant = re.search(r'\[sol-([^\]]+)\]', info)
        if variant:
            label = variant.group(1)
        # Keep original algorithm code verbatim, including its original comments.
        lang = {'py': 'python', 'python3': 'python', 'cpp': 'cpp', 'c++': 'cpp', 'js': 'javascript', 'golang': 'go', 'text': 'plaintext'}.get(key, key)
        return protect(f'<div class="author-code-box"><div class="author-code-bar"><span>{escape(label)}</span><button type="button" class="author-copy">复制代码</button></div><pre class="code-block annotated-code" data-language="{escape(lang)}">{escape(source.rstrip())}</pre></div>')

    raw = re.sub(r'```([^\n]*)\n(.*?)\n```', code, raw, flags=re.S)
    def gallery(match):
        figures = list(IMAGE_RE.finditer(match.group(1)))
        if len(figures) < 2:
            return match.group(0)
        pictures = ''.join(f'<img class="author-figure" src="{escape(images[figure.group(2)])}" alt="{escape(figure.group(1))}" loading="lazy" {"hidden" if i else ""}>' for i, figure in enumerate(figures))
        return protect(f'<div class="author-gallery">{pictures}<div class="author-gallery-controls"><button type="button" data-gallery-step="-1">上一张</button><span class="author-frame-count">1 / {len(figures)}</span><button type="button" data-gallery-step="1">下一张</button></div></div>')
    raw = re.sub(r'<(!\[.*?\))>', gallery, raw, flags=re.S)
    # Strip LeetCode's slideshow delimiters, retaining every licensed picture.
    raw = re.sub(r'<(?=!\[)', '', raw)
    raw = re.sub(r'(?<=\))>(?=\s|$)', '', raw)
    raw = IMAGE_RE.sub(lambda match: f'\n\n<img class="author-figure" src="{escape(images[match.group(2)])}" alt="{escape(match.group(1))}" loading="lazy">\n\n', raw)
    math_blocks = []

    def math_token(tex, display):
        token = f'AUTHORMATH{len(math_blocks)}TOKEN'
        math_blocks.append(f'<span class="author-math" data-display="{str(display).lower()}" data-tex="{escape(tex, quote=True)}">{escape(tex)}</span>')
        return token

    raw = re.sub(r'\$\$(.*?)\$\$', lambda match: math_token(match.group(1).strip(), True), raw, flags=re.S)
    raw = re.sub(r'(?<![\\$])\$(?!\$)([^\n]*?)(?<!\\)\$', lambda match: math_token(match.group(1), False), raw)
    html = markdown.markdown(raw, extensions=['tables', 'sane_lists', 'nl2br'])
    for i, block in enumerate(blocks):
        html = html.replace(f'<p>AUTHORPROTECTEDBLOCK{i}TOKEN</p>', block)
    for i, block in enumerate(math_blocks):
        html = html.replace(f'AUTHORMATH{i}TOKEN', block)
    sanitizer = SafeArticle()
    sanitizer.feed(html)
    return ''.join(sanitizer.output)


class SafeArticle(HTMLParser):
    allowed = {'p','br','hr','strong','em','b','i','s','del','blockquote','ul','ol','li',
               'h1','h2','h3','h4','h5','h6','a','img','div','span','pre','code','button',
               'table','thead','tbody','tr','th','td','sup','sub','details','summary'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.output = []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag in ['script','style','iframe','object','embed','form']:
            self.blocked += 1
        if self.blocked or tag not in self.allowed:
            return
        clean = []
        for key, value in attrs:
            value = value or ''
            if key == 'class' and all(x.startswith('author-') or x in ['code-block','annotated-code'] for x in value.split()):
                clean.append((key, value))
            elif key in ['data-language','data-tex','data-display','data-gallery-step','alt','title','colspan','rowspan']:
                clean.append((key, value))
            elif tag == 'img' and key == 'hidden':
                clean.append(('hidden', ''))
            elif tag == 'button' and key == 'type':
                clean.append((key, 'button'))
            elif tag == 'img' and key == 'src' and value.startswith('authors/assets/'):
                clean += [('src', value), ('loading', 'lazy')]
            elif tag == 'a' and key == 'href' and value.startswith(('https://', 'http://')):
                clean += [('href', value), ('target', '_blank'), ('rel', 'noopener noreferrer')]
        self.output.append('<' + tag + ''.join(f' {key}="{escape(value, quote=True)}"' for key, value in clean) + '>')

    def handle_endtag(self, tag):
        if tag in ['script','style','iframe','object','embed','form']:
            self.blocked = max(0, self.blocked - 1)
            return
        if not self.blocked and tag in self.allowed and tag not in ['img','br','hr']:
            self.output.append(f'</{tag}>')

    def handle_data(self, data):
        if not self.blocked:
            self.output.append(escape(data))


def main():
    vendor_math()
    items = json.loads((ROOT / 'reference/author-imports.json').read_text(encoding='utf-8'))
    raw_files = {item['markdownPath']: (ROOT / item['markdownPath']).read_text(encoding='utf-8') for item in items}
    urls = {match.group(2) for raw in raw_files.values() for match in IMAGE_RE.finditer(raw)}
    images, errors = {}, []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(download_image, url): url for url in urls}
        for i, future in enumerate(as_completed(futures), 1):
            try:
                url, path = future.result()
                images[url] = path
            except Exception as error:
                errors.append({'url': futures[future], 'error': str(error)})
            if i % 100 == 0:
                print(f'Downloaded {i} / {len(urls)} illustrations', flush=True)
    if errors:
        (ROOT / 'reference/author-image-errors.json').write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding='utf-8')
        raise RuntimeError(f'{len(errors)} illustrations could not be downloaded; see author-image-errors.json')
    manifest = []
    for item in items:
        raw = raw_files[item['markdownPath']]
        output = DIST / 'authors' / item['authorSlug'] / f"{item['problemId']}.html"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(render_article(raw, images), encoding='utf-8')
        output.with_suffix('.md').write_text(raw, encoding='utf-8')
        manifest.append({'id': f"{item['authorSlug']}-{item['problemId']}",
                         'problemId': item['problemId'], 'author': item['author'], 'authorSlug': item['authorSlug'],
                         'title': item['title'], 'sourceType': item['sourceType'], 'sourceUrl': item['sourceUrl'],
                         'license': item['license'], 'htmlFile': output.relative_to(DIST).as_posix(),
                         'markdownFile': output.with_suffix('.md').relative_to(DIST).as_posix(),
                         'summary': '原作者完整讲解、示意图与代码 · 已保存在本机',
                         'contentSha256': hashlib.sha256(raw.encode()).hexdigest()})
    (DIST / 'authors/index.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    report = {'articles': len(manifest), 'endlesscheng': sum(x['authorSlug']=='endlesscheng' for x in manifest),
              'krahets': sum(x['authorSlug']=='jyd' for x in manifest), 'localImages': len(images),
              'sourceAttribution': True, 'remoteRuntimeImages': 0}
    (ROOT / 'reference/author-library-check.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
