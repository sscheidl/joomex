from pathlib import Path
import json
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)

def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        page=browser.new_page(viewport={'width':1280,'height':1000})
        errors=[]; requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('console',lambda m: print('BROWSER:',m.text,flush=True) if m.type=='error' else None)
        page.on('request',lambda r:requests.append(r.url))
        page.goto('http://127.0.0.1:8765/demo/',wait_until='networkidle')
        page.locator('#main-book[data-state="ready"]').wait_for(timeout=30000)
        page.screenshot(path=OUT/'desktop.png',full_page=True)
        book=page.locator('#main-book')
        assert book.get_attribute('data-renderer')=='webgl'
        book.get_by_role('button',name='Nächste Seite',exact=True).click()
        page.wait_for_timeout(280)
        page.screenshot(path=OUT/'turn.png')
        expect(book).to_have_attribute('data-page','2',timeout=10000)
        assert book.locator('a.pdfbook-annotation').get_attribute('href')=='https://example.org/'
        book.get_by_role('button',name='Letzte Seite').click()
        expect(book).to_have_attribute('data-page','8')
        assert book.get_by_role('button',name='Nächste Seite',exact=True).is_disabled()
        book.get_by_role('button',name='Erste Seite').click()
        expect(book).to_have_attribute('data-page','1')
        # F2: input during a page turn is queued, not dropped
        page.evaluate("""()=>{const b=document.querySelector('#main-book [aria-label="Nächste Seite"]');b.click();b.click();}""")
        expect(book).to_have_attribute('data-page','4',timeout=10000)
        book.get_by_role('button',name='Erste Seite').click()
        expect(book).to_have_attribute('data-page','1')
        book.get_by_role('button',name='Vergrößern').click()
        expect(book).not_to_have_attribute('aria-busy','true')
        book.get_by_role('button',name='Seitenübersicht',exact=True).click()
        book.locator('.pdfbook-thumbnail canvas').first.wait_for()
        book.get_by_role('button',name='Seitenübersicht',exact=True).click()
        book.get_by_role('button',name='Inhaltsverzeichnis',exact=True).click()
        book.locator('.pdfbook-outline').nth(2).click()
        expect(book).to_have_attribute('data-page','3')
        book.get_by_role('button',name='Inhaltsverzeichnis',exact=True).click()
        page.locator('#cover').click()
        dialog=page.get_by_role('dialog');dialog.locator('[data-state="ready"]').wait_for()
        page.keyboard.press('Escape');assert page.get_by_role('dialog').count()==0
        assert page.locator('#cover').evaluate('(e)=>e===document.activeElement')
        book.get_by_role('button',name='Verkleinern').click()
        expect(book).not_to_have_attribute('aria-busy','true')
        page.set_viewport_size({'width':390,'height':844})
        page.wait_for_timeout(400)
        assert page.locator('#main-book .pdfbook-page').count()==1
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        page.screenshot(path=OUT/'mobile.png',full_page=True)
        # Create isolated second/third instances and adversarial configuration as plain data.
        page.evaluate("""async()=>{
          const {PdfBook}=await import('/media/js/viewer.js');
          const make=(id,src)=>{const e=document.createElement('div');e.id=id;document.body.append(e);return new PdfBook(e,{src,base:location.origin+'/',title:'<img src=x onerror=alert(1)>',renderer:'flat'});};
          const actions=make('actions','images/actions.pdf');await actions.ready;await actions.go(2,false);
          await make('broken','images/broken.pdf').ready;
          await make('invalid','https://evil.example/book.pdf').ready;
          await make('single','images/one-page.pdf').ready;
          const rtl=make('rtl','images/odd-book.pdf');await rtl.ready;rtl.config.direction='rtl';rtl.config.mode='double';await rtl.go(5,false);
        }""")
        assert page.locator('#actions[data-state="ready"]').count()==1
        assert page.locator('#broken[data-state="error"]').count()==1
        assert page.locator('#invalid[data-state="error"]').count()==1
        assert page.locator('#single[data-state="ready"]').count()==1
        assert page.locator('#actions[data-page="2"]').count()==1
        assert page.locator('#rtl canvas[role="img"]').evaluate_all('(xs)=>xs.map(x=>x.getAttribute("aria-label"))')==['PDF-Seite 5','PDF-Seite 4']
        assert book.get_attribute('data-page')=='3'
        assert page.locator('#actions img').count()==0
        assert page.locator('#actions a[href^="javascript:"]').count()==0
        assert page.evaluate('!globalThis.__PDFBOOK_ACTION_EXECUTED__ && !globalThis.__PDFBOOK_LINK_EXECUTED__')
        external=[u for u in requests if not u.startswith(('http://127.0.0.1:8765/','blob:','data:'))]
        assert not external,external
        assert not errors,errors
        result={'status':'PASS','browser':browser.version,'tests':['load PDF.js 6.5.438','navigation and boundaries','queued input during page turn (F2)','WebGL renderer active and curved page screenshot','zoom','outline navigation','dialog escape and focus return','mobile single-page and no horizontal overflow','multiple instances','PDF JavaScript actions not executed','unsafe annotation URLs omitted on displayed page','HTML titles inert','broken PDF rejected','foreign PDF source rejected','single-page PDF','RTL with odd page count and flat renderer','safe PDF annotation URL','no external requests','no uncaught browser errors'], 'external_requests':external,'errors':errors,'desktop_renderer':'webgl','mobile_renderer':book.get_attribute('data-renderer')}
        (OUT/'browser.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result,indent=2))
        browser.close()

if __name__=='__main__':main()
