"""Bundle the submission materials without mixing them into the extension ZIP."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parent.parent
extension = root / 'output' / 'focus-tube-extension.zip'
version = json.loads((root / 'manifest.json').read_text())['version']
with ZipFile(extension) as package:
    assert json.loads(package.read('manifest.json'))['version'] == version, 'Rebuild the extension ZIP first.'
    assert package.testzip() is None

destination = root / 'output' / 'focus-tube-publishing-kit.zip'
with ZipFile(destination, 'w', ZIP_DEFLATED) as bundle:
    bundle.write(extension, 'focus-tube-extension.zip')
    for file in sorted((root / 'publishing').rglob('*')):
        if file.is_file() and not file.name.startswith('.'):
            bundle.write(file, file.relative_to(root))
    bundle.writestr('START-HERE.txt', 'Focus Tube ' + version + '\n\nUpload focus-tube-extension.zip to the Chrome Web Store.\nThe publishing/ folder contains listing copy, privacy documents, reviewer instructions, screenshots, and the store icon.\nRead publishing/README.md for the upload map and remaining account/hosting steps.\nDo not upload this entire publishing-kit ZIP as the extension.\nNothing in this kit has been published externally.\n')
print(destination)
