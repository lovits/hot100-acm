"""Stage a private macOS build using an installed Hot100 runtime."""
import argparse
import shutil
from pathlib import Path

from leetcode_package import ROOT, runtime_files


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-app', required=True, type=Path)
    parser.add_argument('--output-app', required=True, type=Path)
    args = parser.parse_args()
    source, output = args.source_app.resolve(), args.output_app.absolute()
    if not (source / 'Contents/Resources/app/main.cjs').is_file():
        raise ValueError('源应用不是预期的 Hot100 macOS 应用')
    if output.exists() or output == source or source in output.parents:
        raise ValueError('输出路径已存在或位于源应用内')
    shutil.copytree(source, output, symlinks=True)
    shutil.copy2(ROOT / 'dist/assets/app.icns', output / 'Contents/Resources/Hot100.icns')
    target = output / 'Contents/Resources/app'
    for folder in ('dist', 'native_judge'):
        shutil.copytree(ROOT / folder, target / folder, dirs_exist_ok=True)
    for name in ('local_server.py', 'sync_transport.py', 'leetcode_session.py', 'leetcode_browser.cjs'):
        shutil.copy2(ROOT / name, target / name)
    for name in ('main.cjs', 'preload.cjs'):
        shutil.copy2(ROOT / 'desktop' / name, target / name)
    for name, file in runtime_files():
        destination = target / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, destination)
    print(f'已生成私有测试应用：{output}')


if __name__ == '__main__':
    main()
