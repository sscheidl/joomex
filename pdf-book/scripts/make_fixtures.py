"""Synthetic PDF fixtures for renderer/annotation tests, not copies of real documents."""
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject,NameObject,DecodedStreamObject,ArrayObject,FloatObject,TextStringObject
ROOT=Path(__file__).resolve().parents[1]

def make_book(path,count=8,malicious_actions=False):
    writer=PdfWriter()
    font=writer._add_object(DictionaryObject({NameObject('/Type'):NameObject('/Font'),NameObject('/Subtype'):NameObject('/Type1'),NameObject('/BaseFont'):NameObject('/Helvetica')}))
    titles=['Neugier braucht Raum.','Lernen und entdecken','Gemeinsam wachsen','Perspektiven wechseln','Wissen ausprobieren','Zeit fuer Ideen','Unsere Gemeinschaft','Bis bald.']
    for i in range(count):
        page=writer.add_blank_page(420,594)
        page[NameObject('/Resources')]=DictionaryObject({NameObject('/Font'):DictionaryObject({NameObject('/F1'):font})})
        title=titles[i%len(titles)]
        dark=i in (0,count-1)
        bg='0.11 0.33 0.29' if dark else '0.98 0.97 0.93'
        fg='1 1 1' if dark else '0.13 0.23 0.22'
        commands=[f'{bg} rg 0 0 420 594 re f',f'{fg} rg','BT /F1 10 Tf 38 548 Td (PDF BOOK / TEST) Tj ET',f'BT /F1 28 Tf 38 430 Td ({title}) Tj ET']
        commands+=['0.71 0.80 0.62 rg 38 180 344 170 re f','0.90 0.72 0.39 rg 210 180 172 85 re f',f'{fg} rg','BT /F1 11 Tf 38 136 Td (Ein synthetisches Testheft fuer PDF Book.) Tj ET','BT /F1 11 Tf 38 114 Td (Blaettern. Vergroessern. Neues entdecken.) Tj ET',f'BT /F1 10 Tf 38 38 Td (SEITE {i+1} / {count}) Tj ET']
        stream=DecodedStreamObject();stream.set_data(('\n'.join(commands)).encode('ascii'));page[NameObject('/Contents')]=writer._add_object(stream)
        writer.add_outline_item(title,i)
    annotation=DictionaryObject({NameObject('/Type'):NameObject('/Annot'),NameObject('/Subtype'):NameObject('/Link'),NameObject('/Rect'):ArrayObject([FloatObject(x) for x in [38,105,300,132]]),NameObject('/A'):DictionaryObject({NameObject('/S'):NameObject('/URI'),NameObject('/URI'):TextStringObject('https://example.org/')})})
    writer.pages[1 if count>1 else 0][NameObject('/Annots')]=ArrayObject([writer._add_object(annotation)])
    if malicious_actions:
        writer.add_js("globalThis.__PDFBOOK_ACTION_EXECUTED__ = true;")
        annotation['/A'][NameObject('/URI')]=TextStringObject('javascript:globalThis.__PDFBOOK_LINK_EXECUTED__=true')
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('wb') as f:writer.write(f)

if __name__=='__main__':
    for filename,count,actions in [('test-book.pdf',8,False),('odd-book.pdf',5,False),('one-page.pdf',1,False),('actions.pdf',3,True)]:make_book(ROOT/'images'/filename,count,actions)
    (ROOT/'images/broken.pdf').write_bytes(b'not a PDF')
    print('Created five bounded PDF test fixtures')
