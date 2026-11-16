"""Patch the verified portable runtime without rebuilding third-party dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
root = Path(__file__).resolve().parent.parent
work = root / 'release-work'
output = work / 'publish/Hot100-Windows-x64-release.zip'
replacement = (root / 'local_server.py').read_bytes()
with ZipFile(work / output.name) as old, ZipFile(output, 'w', ZIP_DEFLATED, compresslevel=9) as new:
    assert 'Hot100/local_server.py' in old.namelist()
    for item in old.infolist():
        data = replacement if item.filename == 'Hot100/local_server.py' else old.read(item)
        new.writestr(item.filename, data)
with ZipFile(output) as archive:
    assert archive.read('Hot100/local_server.py') == replacement
    assert archive.testzip() is None
print('Portable Windows archive patched and verified:', output.stat().st_size)
