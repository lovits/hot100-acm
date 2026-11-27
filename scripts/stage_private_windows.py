"""Create a private Windows package from the existing release runtime."""
import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

from leetcode_package import ROOT, runtime_files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-zip', required=True, type=Path)
    parser.add_argument('--output-zip', required=True, type=Path)
    args = parser.parse_args()
    if args.output_zip.exists():
        raise ValueError('输出文件已存在')
    sources = {}
    for folder in ('dist', 'native_judge'):
        for file in (ROOT / folder).rglob('*'):
            if file.is_file() and '__pycache__' not in file.parts and 'authors' not in file.relative_to(ROOT).parts:
                sources['Hot100/' + file.relative_to(ROOT).as_posix()] = file
    for name in ('launch.pyw', 'local_server.py', 'sync_transport.py', 'leetcode_session.py', 'leetcode_browser.cjs'):
        sources['Hot100/' + name] = ROOT / name
    for name, file in runtime_files():
        sources['Hot100/' + name] = file
    expected = dict(sources)
    with ZipFile(args.source_zip) as old, ZipFile(args.output_zip, 'x', ZIP_DEFLATED, compresslevel=6) as new:
        if 'Hot100/runtime/python/python.exe' not in old.namelist() or 'Hot100/runtime/node.exe' not in old.namelist():
            raise ValueError('源压缩包缺少 Windows 运行时')
        for item in old.infolist():
            replacement = sources.pop(item.filename, None)
            new.writestr(item, replacement.read_bytes() if replacement else old.read(item))
        for name, file in sources.items():
            new.writestr(name, file.read_bytes())
    with ZipFile(args.output_zip) as check:
        if check.testzip(): raise ValueError('压缩包校验失败')
        for name, file in expected.items():
            if check.read(name) != file.read_bytes(): raise ValueError(f'打包内容不一致：{name}')
    print(f'已生成私有 Windows 测试包：{args.output_zip}')


if __name__ == '__main__':
    main()
