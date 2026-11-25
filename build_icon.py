"""Build desktop icon formats from the selected transparent color portrait."""
from pathlib import Path
from PIL import Image


def build_icon():
    assets = Path(__file__).parent / 'dist' / 'assets'
    image = Image.open(assets / 'app-logo.png').convert('RGBA')
    image.resize((512, 512), Image.Resampling.LANCZOS).save(assets / 'avatar.png')
    sizes = [(size, size) for size in (16, 24, 32, 48, 64, 128, 256)]
    image.save(assets / 'app.ico', sizes=sizes)
    # Existing Windows shortcuts and older app bundles reference this name.
    (assets / 'app-hot100oj.ico').write_bytes((assets / 'app.ico').read_bytes())
    image.resize((1024, 1024), Image.Resampling.LANCZOS).save(assets / 'app.icns')


if __name__ == '__main__':
    build_icon()
    print('Transparent Taffy PNG, Windows ICO and macOS ICNS generated.')
