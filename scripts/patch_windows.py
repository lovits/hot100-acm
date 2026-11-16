"""Patch the verified portable runtime without rebuilding third-party dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
work = root / 'release-work'
output = work / 'publish/Hot100-Windows-x64-release.zip'
replacements = {'Hot100/' + name: (root / name).read_bytes() for name in ('local_server.py', 'dist/authors.js', 'dist/local.js')}
with ZipFile(work / output.name) as old, ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as new:
    assert replacements.keys() <= set(old.namelist())
    for item in old.infolist():
        data = replacements.get(item.filename) if item.filename in replacements else old.read(item)
        new.writestr(item.filename, data)
with ZipFile(output) as archive:
    for name, data in replacements.items():
        assert archive.read(name) == data
    assert archive.testzip() is None
print('Portable Windows archive patched and verified:', output.stat().st_size)
