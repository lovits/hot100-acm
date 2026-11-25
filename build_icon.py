"""Build desktop icons with the white rounded tile retained."""
from pathlib import Path
from PIL import Image, ImageDraw


def build_icon():
    assets = Path(__file__).parent / 'dist' / 'assets'
    image = Image.open(assets / 'app-logo.png').convert('RGBA')
    # Keep the portrait master unchanged; the tile is part of desktop packaging.
    portrait = image.resize((820, 820), Image.Resampling.LANCZOS)
    image = Image.new('RGBA', (1024, 1024))
    ImageDraw.Draw(image).rounded_rectangle((52, 52, 972, 972), radius=190, fill='white')
    image.alpha_composite(portrait, (102, 102))
    assert image.getpixel((512, 65)) == (255, 255, 255, 255)
    assert image.getpixel((512, 512))[3] == 255
    assert image.getpixel((0, 0))[3] == 0
    image.save(assets / 'app-framed.png')
    sizes = [(size, size) for size in (16, 24, 32, 48, 64, 128, 256)]
    image.save(assets / 'app.ico', sizes=sizes)
    # Existing Windows shortcuts and older app bundles reference this name.
    (assets / 'app-hot100oj.ico').write_bytes((assets / 'app.ico').read_bytes())
    image.resize((1024, 1024), Image.Resampling.LANCZOS).save(assets / 'app.icns')


if __name__ == '__main__':
    build_icon()
    print('White-tile Taffy PNG, Windows ICO and macOS ICNS generated.')
