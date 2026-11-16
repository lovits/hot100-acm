from hashlib import file_digest
from pathlib import Path
from subprocess import check_output
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT
RELEASE = ROOT / 'release-work'
OUTPUT = RELEASE / 'publish'
OUTPUT.mkdir(parents=True, exist_ok=True)

ARCHIVES = {
    'Hot100-macOS-arm64-release.zip': 'c37e5e7572650f3de1b6a9fb4e106b58a21b6d19c56415441e33759554f0ed3c',
    'Hot100-macOS-x64-release.zip': '037d5d985ed88d72cf8951492123425c7582022fed292ff970e86f6d57c99a05',
    'Hot100-Windows-x64-release.zip': '1b46be72224095800f5c873244031c2be99934e19bdfa3498567293014a04dbc',
}

SOURCES = {
    'app/main.cjs': 'desktop/main.cjs',
    'dist/index.html': 'dist/index.html',
    'dist/local.js': 'dist/local.js',
    'dist/workspace-settings.js': 'dist/workspace-settings.js',
}


def source_for(name):
    for suffix, source in SOURCES.items():
        if name == suffix or name.endswith('/' + suffix):
            return source
    return None


for archive_name, digest in ARCHIVES.items():
    old_path = RELEASE / archive_name
    with old_path.open('rb') as file:
        assert file_digest(file, 'sha256').hexdigest() == digest, archive_name
    new_path = OUTPUT / archive_name
    changed = []
    with ZipFile(old_path) as old, ZipFile(new_path, 'w', allowZip64=True) as new:
        for item in old.infolist():
            data = old.read(item)
            source = source_for(item.filename)
            if source:
                previous = check_output(['git', 'show', f'v1.0.0:{source}'], cwd=REPO)
                assert data.replace(b'\r\n', b'\n') == previous.replace(b'\r\n', b'\n'), (archive_name, item.filename)
                data = (REPO / source).read_bytes()
                changed.append((item.filename, source))
            new.writestr(item, data)
    assert {source for _, source in changed} == set(SOURCES.values()), (archive_name, changed)
    with ZipFile(new_path) as new:
        for name, source in changed:
            assert new.read(name) == (REPO / source).read_bytes()
        assert not any('/dist/authors/' in name for name in new.namelist()), archive_name
        assert new.testzip() is None, archive_name
    print(f'{archive_name}: replaced {len(changed)} files, ZIP verified', flush=True)
    for name, _ in changed:
        print(' ', name, flush=True)
