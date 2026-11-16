"""Reuse the exact icon selected from the retired Hot100 OJ application."""
from pathlib import Path
from shutil import copyfile


def build_icon():
    assets = Path(__file__).parent / 'dist' / 'assets'
    # Keep the original ICO bytes and all of its embedded sizes intact.
    copyfile(assets / 'app-hot100oj.ico', assets / 'app.ico')
    copyfile(assets / 'avatar-hot100oj.png', assets / 'avatar.png')


if __name__ == '__main__':
    build_icon()
    print('Original Hot100 OJ icon applied.')
