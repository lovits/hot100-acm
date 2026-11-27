"""Build portable browser edition and optional offline C/C++ compiler addon."""
import io
import shutil
import subprocess
import urllib.request
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from leetcode_package import runtime_files

ROOT = Path(__file__).resolve().parent.parent
WORK = ROOT / 'release-work'
OUT = WORK / 'publish'
OUT.mkdir(parents=True, exist_ok=True)


def download(url, destination):
    urllib.request.urlretrieve(url, destination)


def write_tree(archive, directory, prefix):
    for file in sorted(directory.rglob('*')):
        if file.is_file() and '__pycache__' not in file.parts:
            archive.write(file, prefix + file.relative_to(directory).as_posix())


python_zip = WORK / 'python.zip'
node_zip = WORK / 'node.zip'
download('https://www.python.org/ftp/python/3.12.10/python-3.12.10-embed-amd64.zip', python_zip)
download('https://nodejs.org/dist/v22.16.0/node-v22.16.0-win-x64.zip', node_zip)
prefix = 'Hot100/'
with ZipFile(OUT / 'Hot100-Windows-x64-release.zip', 'w', ZIP_DEFLATED, compresslevel=9) as out:
    for directory in ['dist', 'native_judge']:
        write_tree(out, ROOT / directory, prefix + directory + '/')
    for name in ['launch.pyw', 'local_server.py', 'sync_transport.py', 'leetcode_session.py', 'leetcode_browser.cjs', 'README.md']:
        out.write(ROOT / name, prefix + name)
    for name, source in runtime_files():
        out.write(source, prefix + name)
    with ZipFile(python_zip) as source:
        for name in source.namelist():
            out.writestr(prefix + 'runtime/python/' + name, source.read(name))
    with ZipFile(node_zip) as source:
        for name in ['node.exe', 'LICENSE']:
            out.writestr(prefix + 'runtime/' + name, source.read('node-v22.16.0-win-x64/' + name))
    out.writestr(prefix + 'Start-Hot100.vbs', '\r\n'.join([
        'Set shell = CreateObject("WScript.Shell")',
        'Set fso = CreateObject("Scripting.FileSystemObject")',
        'root = fso.GetParentFolderName(WScript.ScriptFullName)',
        'shell.CurrentDirectory = root',
        'shell.Run Chr(34) & root & "\\runtime\\python\\pythonw.exe" & Chr(34) & " " & Chr(34) & root & "\\launch.pyw" & Chr(34), 0, False',
    ]))
    out.writestr(prefix + 'Create-Desktop-Shortcut.vbs', '\r\n'.join([
        'Set shell = CreateObject("WScript.Shell")',
        'Set fso = CreateObject("Scripting.FileSystemObject")',
        'root = fso.GetParentFolderName(WScript.ScriptFullName)',
        'Set link = shell.CreateShortcut(shell.SpecialFolders("Desktop") & "\\Hot100 ACM.lnk")',
        'link.TargetPath = root & "\\Start-Hot100.vbs"',
        'link.WorkingDirectory = root',
        'link.IconLocation = root & "\\dist\\assets\\app-hot100oj.ico"',
        'link.Save',
    ]))
old = WORK / 'Hot100-Windows-x64-release.zip'
with ZipFile(old) as source, ZipFile(OUT / 'Hot100-Windows-C-Cpp-addon.zip', 'w', ZIP_DEFLATED, compresslevel=9) as out:
    count = 0
    for item in source.infolist():
        marker = '/runtime/mingw64/'
        if marker in item.filename and not item.is_dir():
            out.writestr(prefix + 'runtime/mingw64/' + item.filename.split(marker, 1)[1], source.read(item))
            count += 1
    assert count > 0, 'Compiler runtime not found in old release'
for archive in OUT.glob('Hot100-Windows*.zip'):
    with ZipFile(archive) as check:
        assert check.testzip() is None
    print(archive.name, archive.stat().st_size, flush=True)
