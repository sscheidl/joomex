"""Reviewer re-check of two observations reported by Codex (loopback only)."""
import json, os, sys
from playwright.sync_api import sync_playwright
sys.stdout.reconfigure(encoding='utf-8')
B = 'http://127.0.0.1:8766/sub/'
out = []
with sync_playwright() as pw:
    for name, launch in [('edge', lambda: pw.chromium.launch(channel='msedge', headless=True)), ('firefox', lambda: pw.firefox.launch(headless=True))]:
        b = launch()
        for w, h in [(320, 225), (640, 300), (568, 320), (844, 390)]:
            c = b.new_context(viewport={'width': w, 'height': h}); p = c.new_page()
            p.goto(B + 'page/two.html'); p.locator('[data-pdfbook][data-state="ready"] >> nth=0').wait_for(timeout=30000)
            p.locator('[data-pdfbook-open]').click(); p.locator('dialog [data-state="ready"]').wait_for(timeout=30000)
            m = p.evaluate("""()=>{const d=document.querySelector('dialog'),bk=d.querySelector('.pdfbook'),t=d.querySelector('.pdfbook-toolbar');const r=e=>e.getBoundingClientRect();
              return {dialogBottom:Math.round(r(d).bottom),bookBottom:Math.round(r(bk).bottom),toolbarTop:Math.round(r(t).top),toolbarBottom:Math.round(r(t).bottom),
                dialogScroll:d.scrollHeight-d.clientHeight,bookScroll:bk.scrollHeight-bk.clientHeight,bookOverflow:getComputedStyle(bk).overflowY}}""")
            m['toolbar_reachable'] = m['toolbarBottom'] <= m['dialogBottom'] + 1 or m['dialogScroll'] > 0 or (m['bookScroll'] > 0 and m['bookOverflow'] != 'hidden')
            out.append({'browser': name, 'viewport': f'{w}x{h}', **m}); c.close()
        c = b.new_context(viewport={'width': 1280, 'height': 900}); p = c.new_page()
        p.goto(B + 'page/eight.html'); p.locator('[data-state="ready"]').wait_for(timeout=30000)
        r = p.evaluate("""async()=>{const {PdfBook}=await import('/sub/media/mod_pdfbook/js/viewer.mjs?v=0.1.0-alpha.3');const el=document.createElement('div');document.body.append(el);
          const bk=new PdfBook(el,{src:'images/eight.pdf',base:'/sub/',renderer:'flat'});await bk.ready;bk.pdf.render=async()=>{throw new Error('injected')};await bk.go(4,false);
          await new Promise(r=>setTimeout(r,300));const o={state:el.dataset.state,status:el.querySelector('.pdfbook-status').textContent,pdfDisposed:bk.pdf.disposed,docKept:!!bk.pdf.doc,cache:bk.pdf.cache.size};
          await bk.dispose();o.afterDispose=bk.pdf.disposed;el.remove();return o}""")
        out.append({'browser': name, 'test': 'render failure', **r}); c.close(); b.close()
print(json.dumps(out, indent=1, ensure_ascii=False))
