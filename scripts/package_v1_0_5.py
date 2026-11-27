"""Update the latest per-platform release runtimes with the current app sources."""
import json
import plistlib
import sys
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from leetcode_package import runtime_files

VERSION = sys.argv[1] if len(sys.argv) > 1 else '1.0.5'

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'release-work'
OUT = WORK / 'publish'
OUT.mkdir(parents=True, exist_ok=True)

sources = {}
for directory in ['dist', 'native_judge']:
    for path in (ROOT / directory).rglob('*'):
        if path.is_file() and 'authors' not in path.relative_to(ROOT).parts and '__pycache__' not in path.parts:
            sources[path.relative_to(ROOT).as_posix()] = path.read_bytes()
for name in ['local_server.py', 'sync_transport.py', 'leetcode_session.py', 'leetcode_browser.cjs']:
    sources[name] = (ROOT / name).read_bytes()
for name, path in runtime_files():
    sources[name] = path.read_bytes()

for platform in ['macOS-arm64', 'macOS-x64', 'Windows-x64']:
    filename = f'Hot100-{platform}-release.zip'
    mac = platform.startswith('macOS')
    prefix = 'Hot100.app/Contents/Resources/app/' if mac else 'Hot100/'
    replacements = {prefix + name: data for name, data in sources.items()}
    if mac:
        replacements[prefix + 'main.cjs'] = (ROOT / 'desktop/main.cjs').read_bytes()
        replacements[prefix + 'preload.cjs'] = (ROOT / 'desktop/preload.cjs').read_bytes()
        replacements['Hot100.app/Contents/Resources/Hot100.icns'] = (ROOT / 'dist/assets/app.icns').read_bytes()
    else:
        for name in ['launch.pyw', 'README.md']:
            replacements[prefix + name] = (ROOT / name).read_bytes()
    with ZipFile(WORK / filename) as old, ZipFile(OUT / filename, 'w', ZIP_DEFLATED, compresslevel=6) as new:
        for item in old.infolist():
            data = replacements.pop(item.filename, None)
            if data is None:
                data = old.read(item)
            if mac and item.filename == prefix + 'package.json':
                package = json.loads(data)
                package['version'] = VERSION
                data = json.dumps(package, ensure_ascii=False).encode()
            if mac and item.filename == 'Hot100.app/Contents/Info.plist':
                info = plistlib.loads(data)
                info['CFBundleShortVersionString'] = VERSION
                info['CFBundleVersion'] = VERSION.replace('.', '')
                data = plistlib.dumps(info)
            new.writestr(item, data)
        for name, data in replacements.items():
            new.writestr(name, data)
    with ZipFile(OUT / filename) as check:
        assert check.testzip() is None
        if mac:
            assert check.read('Hot100.app/Contents/Resources/Hot100.icns') == (ROOT / 'dist/assets/app.icns').read_bytes()
        for name, data in sources.items():
            assert check.read(prefix + name) == data, name
        assert not any('/dist/authors/' in name for name in check.namelist())
        rows = json.loads(check.read(prefix + 'dist/training/data/problems.json'))
        assert len(rows) == 100 and sum(len(row['freq']['companies']) for row in rows) == 1399
        assert b'polish.css' in check.read(prefix + 'dist/index.html')
        assert b'judge-rules.js' in check.read(prefix + 'dist/index.html')
        main=json.loads(check.read(prefix + 'dist/problems.json'))
        assert all(row['topicTags'] and all(tag.strip() for tag in row['topicTags']) for row in main)
    print(filename, 'source contents, frequency data and ZIP integrity verified', flush=True)
