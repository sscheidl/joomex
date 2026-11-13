"""Regression test for the archive check of ../scripts/check_publication.py (review finding R3, alpha.15).

Run after `python scripts/build.py`: python tests/publication_zip.py
The genuine package and a recompressed copy must pass; manipulated copies must fail.
"""
import subprocess, sys, tempfile, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CHECK = ROOT.parent / 'scripts' / 'check_publication.py'
genuine = sorted((ROOT / 'dist').glob('mod_pdfbook-*.zip'))[-1]


def check(archive: Path) -> int:
    return subprocess.run([sys.executable, str(CHECK), '--zip', str(archive)], capture_output=True, text=True).returncode


def variant(name: str, change) -> Path:
    target = Path(tmp) / name
    with zipfile.ZipFile(genuine) as src, zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as out:
        entries = [(info, src.read(info)) for info in src.infolist()]
        for info, data in change(entries):
            out.writestr(info, data)
    return target


def altered(entries):
    for info, data in entries:
        yield info, (data + b'\n// changed' if info.filename == 'media/vendor/pdfjs/build/pdf.js' else data)


def stored(entries):
    for info, data in entries:
        info.compress_type = zipfile.ZIP_STORED
        yield info, data


cases = {
    'genuine package passes': (genuine, 0),
    'recompressed copy passes (identity does not depend on compression, R4)': (None, 0),
    'unlisted binary fails': (lambda e: [*e, (zipfile.ZipInfo('unlisted.dat'), b'\0\1\2binary')], 1),
    'changed vendor file fails': (altered, 1),
    'missing file fails': (lambda e: [x for x in e if x[0].filename != 'media/js/viewer.js'], 1),
    'duplicate entry fails': (lambda e: [*e, e[0]], 1),
}
failed = 0
with tempfile.TemporaryDirectory() as tmp:
    import warnings
    warnings.simplefilter('ignore')   # zipfile warns about the deliberate duplicate name
    for i, (label, (change, expected)) in enumerate(cases.items()):
        archive = genuine if change is genuine else variant(f'case{i}.zip', stored if change is None else change)
        code = check(archive)
        ok = code == expected
        failed += not ok
        print('PASS' if ok else 'FAIL', label, f'(exit {code})')
print(f'{len(cases) - failed}/{len(cases)} archive checks passed')
sys.exit(1 if failed else 0)
