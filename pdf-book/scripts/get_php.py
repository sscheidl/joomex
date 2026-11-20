"""Install an official portable PHP CLI locally, with published checksum verification."""
from pathlib import Path,PurePosixPath
import urllib.request,json,hashlib,zipfile,io
ROOT=Path(__file__).resolve().parents[1]
def get(url):
    with urllib.request.urlopen(url,timeout=60) as r:return r.read()
def main():
    release=json.loads(get('https://windows.php.net/downloads/releases/releases.json'))['8.4']
    build=next(v for k,v in release.items() if k=='nts-vs17-x64')
    item=build['zip'];raw=get('https://windows.php.net/downloads/releases/'+item['path'])
    assert hashlib.sha256(raw).hexdigest()==item['sha256']
    dest=ROOT/'.tools/php';dest.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        for member in z.infolist():
            p=PurePosixPath(member.filename)
            assert not p.is_absolute() and '..' not in p.parts and ':' not in member.filename and '\\' not in member.filename
            if not member.is_dir():
                target=dest/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(z.read(member))
    (dest/'origin.json').write_text(json.dumps({'version':release['version'],'file':item},indent=2))
    print('Verified portable PHP',release['version'])
    license=get('https://www.gnu.org/licenses/gpl-3.0.txt')
    (ROOT/'LICENSE.txt').write_bytes(license)
if __name__=='__main__':main()
