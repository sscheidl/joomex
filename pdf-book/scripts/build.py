"""Build a deterministic Joomla module ZIP, excluding tests, originals and local tools.

Checks before packing:
* every vendored PDF.js file matches dependencies.json, and media/vendor contains nothing else
* one version everywhere: manifest <version>, Dispatcher::VERSION, every ?v= suffix in media/js, package.json
* no dead security options (isEvalSupported does not exist in PDF.js 6.x)
* no .mjs files (hosts often serve them as text/plain; browsers then refuse the module)
"""
from pathlib import Path
import hashlib, json, re, zipfile, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]


def check_vendor() -> None:
    lock = json.loads((ROOT / 'dependencies.json').read_text(encoding='utf-8'))['pdfjs']
    vendor = ROOT / 'media/vendor/pdfjs'
    listed = {entry.get('shipped_as', entry['path']) for entry in lock['files']}
    for entry in lock['files']:
        path = vendor / entry.get('shipped_as', entry['path'])
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256'], path
    present = {p.relative_to(vendor).as_posix() for p in vendor.rglob('*') if p.is_file()}
    assert present == listed, f'vendor files not in lock: {sorted(present - listed)}; missing: {sorted(listed - present)}'


def check_version() -> tuple[str, tuple[int, int, int]]:
    manifest = ET.parse(ROOT / 'module/mod_pdfbook.xml').getroot()
    version = manifest.findtext('version')
    year, month, day = (int(x) for x in manifest.findtext('creationDate').split('-'))
    dispatcher = (ROOT / 'module/src/Dispatcher/Dispatcher.php').read_text(encoding='utf-8')
    assert f"public const VERSION = '{version}';" in dispatcher, 'Dispatcher::VERSION differs from manifest'
    assert json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version'] == version, 'package.json version differs'
    mjs = sorted(p.relative_to(ROOT).as_posix() for p in (ROOT / 'media').rglob('*.mjs'))
    assert not mjs, f'.mjs files are served as text/plain by many hosts; use .js: {mjs}'
    for js in (ROOT / 'media/js').glob('*.js'):
        text = js.read_text(encoding='utf-8')
        assert 'isEvalSupported' not in text, f'{js.name}: dead option isEvalSupported'
        relative = re.findall(r"""(?:from\s+|import\(\s*|new URL\(\s*)['"](\.{1,2}/[^'"]+|build/[^'"]+\.js[^'"]*)['"]""", text)
        for spec in relative:
            if spec.endswith('/'):
                continue  # directory bases (vendor root, cmaps, fonts) carry no query
            assert spec.endswith(f'?v={version}'), f'{js.name}: unversioned or stale import {spec}'
    return version, (year, month, day)


def main() -> None:
    check_vendor()
    version, date = check_version()
    files = {p.relative_to(ROOT / 'module').as_posix(): p for p in (ROOT / 'module').rglob('*') if p.is_file()}
    files.update({'media/' + p.relative_to(ROOT / 'media').as_posix(): p for p in (ROOT / 'media').rglob('*') if p.is_file()})
    for name in ['LICENSE.txt', 'THIRD-PARTY-NOTICES.md']:
        files[name] = ROOT / name
    assert files['LICENSE.txt'].read_text(encoding='utf-8').startswith('                    GNU GENERAL PUBLIC LICENSE')
    out = ROOT / 'dist'
    out.mkdir(exist_ok=True)
    target = out / f'mod_pdfbook-{version}.zip'
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for name, path in sorted(files.items()):
            info = zipfile.ZipInfo(name, date_time=(*date, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, path.read_bytes())
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    (out / 'SHA256SUMS.txt').write_text(digest + '  ' + target.name + '\n', encoding='utf-8')
    (out / 'manifest.json').write_text(json.dumps({'package': target.name, 'sha256': digest, 'status': 'ALPHA - Joomla installation not yet tested',
                                                   'files': list(sorted(files))}, indent=2), encoding='utf-8')
    print(target.name, len(files), 'files', target.stat().st_size, 'bytes', digest)


if __name__ == '__main__':
    main()
