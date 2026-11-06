from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
destination = root / 'output' / 'focus-tube-extension.zip'
destination.parent.mkdir(parents=True, exist_ok=True)
files = [root / name for name in ('manifest.json', 'app.html', 'popup.html', 'unlock.html', 'privacy.html', 'README.md')]
files += sorted((root / 'src').glob('*'))
files += sorted((root / 'assets' / 'icons').glob('*.png'))
files.append(root / 'assets' / 'branding' / 'focus-tube.svg')
with ZipFile(destination, 'w', ZIP_DEFLATED) as archive:
    for file in files:
        if file.is_file():
            archive.write(file, file.relative_to(root))
# Keep previous download links current for existing unpacked installations.
(root / 'output' / 'channel-focus-extension.zip').write_bytes(destination.read_bytes())
print(destination)
