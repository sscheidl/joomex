"""Independent CLI reproductions for N18-1--3, written for e4be505.

Build first: python pdf-book/scripts/build.py
Run from any directory: python <this-script>
Optional: add --denylist <private list outside repository>.
The expected safe outcome is rejection of all three manipulated archives.
Only the untracked-file probe briefly creates a benign source file; it is removed in finally.
"""
import copy
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[4]
GENUINE = ROOT / 'pdf-book/dist/mod_pdfbook-0.1.0-alpha.18.zip'
CHECK = ROOT / 'scripts/check_publication.py'


def run(target):
    result = subprocess.run([sys.executable, str(CHECK), *sys.argv[1:], '--zip', str(target)],
                            cwd=ROOT, capture_output=True, text=True)
    return {'accepted': result.returncode == 0, 'exit': result.returncode}


with zipfile.ZipFile(GENUINE) as source:
    original = [(info, source.read(info)) for info in source.infolist()]

with tempfile.TemporaryDirectory() as folder:
    folder = Path(folder)

    def variant(name, entries):
        target = folder / name
        with zipfile.ZipFile(target, 'w') as archive:
            for info, data in entries:
                archive.writestr(info, data)
        return run(target)

    print('genuine', json.dumps(run(GENUINE)))
    print('directory payload', json.dumps(variant('directory.zip', [
        *original, (zipfile.ZipInfo('extra/'), b'\x00PRIVATE_REVIEW_SENTINEL\x00')])) )
    changed = [(copy.copy(info), data) for info, data in original]
    changed[0][0].create_system = 3
    changed[0][0].external_attr = 0o120777 << 16
    print('symlink mode', json.dumps(variant('symlink.zip', changed)))
    probe = ROOT / 'pdf-book/media/js/probe-untracked.js'
    if probe.exists():
        raise RuntimeError('Refusing to overwrite an existing probe file')
    try:
        probe.write_text('// benign independent untracked-file probe\n', encoding='utf-8')
        print('untracked source', json.dumps(variant('untracked.zip', [
            *original, (zipfile.ZipInfo('media/js/probe-untracked.js'), probe.read_bytes())])))
    finally:
        probe.unlink(missing_ok=True)
