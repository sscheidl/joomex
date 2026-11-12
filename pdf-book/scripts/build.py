"""Build a deterministic Joomla module ZIP, excluding tests, originals and local tools."""
from pathlib import Path
import hashlib,json,zipfile,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
def main():
    lock=json.loads((ROOT/'dependencies.json').read_text())['pdfjs']
    for entry in lock['files']:
        path=ROOT/'media/vendor/pdfjs'/entry['path']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256'],path
    ET.parse(ROOT/'module/mod_pdfbook.xml')
    files={p.relative_to(ROOT/'module').as_posix():p for p in (ROOT/'module').rglob('*') if p.is_file()}
    files.update({'media/'+p.relative_to(ROOT/'media').as_posix():p for p in (ROOT/'media').rglob('*') if p.is_file()})
    for name in ['LICENSE.txt','THIRD-PARTY-NOTICES.md']:files[name]=ROOT/name
    assert files['LICENSE.txt'].read_text().startswith('                    GNU GENERAL PUBLIC LICENSE')
    out=ROOT/'dist';out.mkdir(exist_ok=True)
    target=out/'mod_pdfbook-0.1.0-alpha.2.zip'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for name,path in sorted(files.items()):
            info=zipfile.ZipInfo(name,date_time=(2026,11,12,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,path.read_bytes())
    digest=hashlib.sha256(target.read_bytes()).hexdigest()
    (out/'SHA256SUMS.txt').write_text(digest+'  '+target.name+'\n',encoding='utf-8')
    (out/'manifest.json').write_text(json.dumps({'package':target.name,'sha256':digest,'status':'ALPHA - Joomla installation not yet tested','files':list(sorted(files))},indent=2),encoding='utf-8')
    print(target.name,len(files),'files',target.stat().st_size,'bytes',digest)
if __name__=='__main__':main()
