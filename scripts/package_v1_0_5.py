"""Update the latest per-platform release runtimes with the current app sources."""
import json
import plistlib
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'release-work'
OUT = WORK / 'publish'
OUT.mkdir(parents=True, exist_ok=True)

sources = {}
for directory in ['dist', 'native_judge']:
    for path in (ROOT / directory).rglob('*'):
        if path.is_file() and 'authors' not in path.relative_to(ROOT).parts and '__pycache__' not in path.parts:
            sources[path.relative_to(ROOT).as_posix()] = path.read_bytes()
sources['local_server.py'] = (ROOT / 'local_server.py').read_bytes()

for platform in ['macOS-arm64', 'macOS-x64', 'Windows-x64']:
    filename = f'Hot100-{platform}-release.zip'
    mac = platform.startswith('macOS')
    prefix = 'Hot100.app/Contents/Resources/app/' if mac else 'Hot100/'
    replacements = {prefix + name: data for name, data in sources.items()}
    if mac:
        replacements[prefix + 'main.cjs'] = (ROOT / 'desktop/main.cjs').read_bytes()
        replacements[prefix + 'preload.cjs'] = (ROOT / 'desktop/preload.cjs').read_bytes()
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
                package['version'] = '1.0.5'
                data = json.dumps(package, ensure_ascii=False).encode()
            if mac and item.filename == 'Hot100.app/Contents/Info.plist':
                info = plistlib.loads(data)
                info['CFBundleShortVersionString'] = '1.0.5'
                info['CFBundleVersion'] = '105'
                data = plistlib.dumps(info)
            new.writestr(item, data)
        for name, data in replacements.items():
            new.writestr(name, data)
    with ZipFile(OUT / filename) as check:
        assert check.testzip() is None
        for name, data in sources.items():
            assert check.read(prefix + name) == data, name
        assert not any('/dist/authors/' in name for name in check.namelist())
        rows = json.loads(check.read(prefix + 'dist/training/data/problems.json'))
        assert len(rows) == 100 and sum(len(row['freq']['companies']) for row in rows) == 1399
        assert b'polish.css' in check.read(prefix + 'dist/index.html')
    print(filename, 'source contents, frequency data and ZIP integrity verified', flush=True)
