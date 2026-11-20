"""Browser regression checks for the alpha.15 review findings R1, R2, R5 and R6 (fixed in 0.1.0-alpha.17).

Needs: python scripts/make_fixtures.py, then python scripts/serve.py in a second terminal.
Run:   python tests/alpha17_regressions.py            (Playwright's Chromium)
       PDFBOOK_CHROME=/path/to/chrome python tests/alpha17_regressions.py
       PDFBOOK_BROWSER=firefox python tests/alpha17_regressions.py
"""
import json, os, sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:8765/demo/'
results = []


def check(label, ok, detail=''):
    results.append(ok)
    print('PASS' if ok else 'FAIL', label, detail)


def open_book(page, **config):
    page.goto(URL)
    cfg = {'src': 'images/test-book.pdf', 'title': 'Regression', 'height': 520, **config}
    page.evaluate("""async cfg => {
      cfg.base = new URL('../', location.href).href;
      document.body.style.margin = '0';
      document.body.innerHTML = '<div id="t"></div>';
      const el = document.getElementById('t');
      const { PdfBook } = await import('../media/js/viewer.js?v=' + document.documentElement.dataset.v);
      window.book = new PdfBook(el, cfg); await window.book.ready;
    }""", cfg)
    page.wait_for_selector('#t[data-state=ready]')


def settle(page):
    page.wait_for_function('() => !window.book.busy && !window.book.pending')
    page.wait_for_timeout(300)


def main():
    with sync_playwright() as p:
        kind = os.environ.get('PDFBOOK_BROWSER', 'chromium')
        exe = os.environ.get('PDFBOOK_CHROME')
        browser = getattr(p, kind).launch(**({'executable_path': exe} if exe and kind == 'chromium' else {}))
        version = browser.version
        page = browser.new_page(viewport={'width': 1280, 'height': 900})
        page.add_init_script("document.addEventListener('DOMContentLoaded',()=>{})")
        page.goto(URL)
        v = page.evaluate("async () => (await (await fetch('../package.json')).json()).version")
        page.add_init_script(f"document.documentElement.dataset.v = {json.dumps(v)}")

        # R1: automatic height follows a height-only window change, both ways, and stays within the window
        open_book(page, mode='single', autoHeight=True, renderer='flat')
        h = lambda: page.evaluate("() => document.querySelector('#t .pdfbook-stage').getBoundingClientRect().height")
        tall = h()
        page.set_viewport_size({'width': 1280, 'height': 450}); page.wait_for_timeout(700); settle(page)
        small = h(); whole = page.evaluate("() => document.getElementById('t').getBoundingClientRect().height")
        page.set_viewport_size({'width': 1280, 'height': 900}); page.wait_for_timeout(700); settle(page)
        again = h()
        check('R1 height-only shrink refits', small < tall - 100, f'{tall:.0f} -> {small:.0f} px')
        check('R1 book stays within a 450 px window', whole <= 450 + 1, f'book {whole:.0f} px')
        check('R1 height-only enlarge refits', abs(again - tall) <= 2, f'back to {again:.0f} px')

        # R2: link rectangle over the red area of a landscape page next to a portrait page
        open_book(page, src='images/mixed-formats.pdf', mode='double', renderer='flat')
        page.evaluate("() => window.book.go(2, false)"); settle(page)
        r = page.evaluate("""() => {
          const pages = [...document.querySelectorAll('#t .pdfbook-page')];
          const wrap = pages.find(p => p.querySelector('.pdfbook-annotation'));
          const c = wrap.querySelector('canvas'), a = wrap.querySelector('.pdfbook-annotation').getBoundingClientRect();
          const box = c.getBoundingClientRect(), own = c.width / c.height, outer = box.width / box.height;
          const img = own > outer ? {x: box.x, y: box.y + (box.height - box.width / own) / 2, w: box.width, h: box.width / own}
                                  : {x: box.x + (box.width - box.height * own) / 2, y: box.y, w: box.height * own, h: box.height};
          // red rectangle in PDF units on an 842 x 420 page: x 500..700, y 80..140 (origin bottom left)
          const e = {x: img.x + 500 / 842 * img.w, y: img.y + (1 - 140 / 420) * img.h, w: 200 / 842 * img.w, h: 60 / 420 * img.h};
          return {dx: a.x - e.x, dy: a.y - e.y, dw: a.width - e.w, dh: a.height - e.h};
        }""")
        err = max(abs(x) for x in r.values())
        check('R2 link on a letterboxed page within 2 px', err <= 2, json.dumps({k: round(x, 2) for k, x in r.items()}))

        # R6: sidebar toggles expose their state
        open_book(page, renderer='flat')
        state = lambda: page.evaluate("""() => ['Seitenübersicht','Inhaltsverzeichnis'].map(l => {
          const b = document.querySelector(`#t .pdfbook-button[aria-label="${l}"]`);
          return [b.getAttribute('aria-expanded'), b.getAttribute('aria-controls') === document.querySelector('#t .pdfbook-sidebar').id];})""")
        s0 = state(); page.click('#t .pdfbook-button[aria-label="Inhaltsverzeichnis"]'); s1 = state()
        page.click('#t .pdfbook-button[aria-label="Seitenübersicht"]'); s2 = state()
        page.click('#t .pdfbook-button[aria-label="Seitenübersicht"]'); s3 = state()
        check('R6 aria-controls names the sidebar', all(x[1] for x in s0 + s1 + s2 + s3))
        check('R6 aria-expanded follows open, switch and close',
              [x[0] for x in s0 + s1 + s2 + s3] == ['false', 'false', 'false', 'true', 'true', 'false', 'false', 'false'],
              str([x[0] for x in s0 + s1 + s2 + s3]))

        # R5: dispose during a long fold cancels animations and removes transient layers at once
        for renderer in ['flip', 'slide', 'fade']:
            open_book(page, renderer=renderer, mode='double', duration=1800)
            out = page.evaluate("""async () => {
              window.book.go(4); await new Promise(r => setTimeout(r, 300));
              const running = document.getAnimations().length;
              await window.book.dispose();
              return {running, after: document.getAnimations().filter(a => a.playState === 'running').length,
                      layers: document.querySelectorAll('#t .pdfbook-fold, #t .pdfbook-slide').length, busy: window.book.busy};
            }""")
            page.wait_for_timeout(2200)
            late = page.evaluate("() => document.getElementById('t').dataset.page")
            check(f'R5 {renderer}: nothing left after dispose', out['running'] > 0 and out['after'] == 0 and out['layers'] == 0 and not out['busy'],
                  json.dumps(out) + f' page {late}')
        browser.close()
    print(f'{sum(results)}/{len(results)} checks passed ({kind} {version})')
    sys.exit(0 if all(results) else 1)


main()
