"""Collect the already compiled, vendored login runtime for desktop archives."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def runtime_files():
    compiled = ROOT / 'vscode-extension/out/core/browserLogin.js'
    vendor = ROOT / 'vscode-extension/vendor/playwright-core'
    if not compiled.is_file() or not (vendor / 'index.js').is_file():
        raise RuntimeError('请先在 vscode-extension 运行 npm run compile，并确认 playwright-core 副本存在')
    yield 'leetcode_runtime/browserLogin.js', compiled
    for file in vendor.rglob('*'):
        if file.is_file():
            yield 'leetcode_runtime/playwright-core/' + file.relative_to(vendor).as_posix(), file
