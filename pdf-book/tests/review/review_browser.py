"""Independent browser review tests for PDF Book 0.1.0-alpha.2 (Playwright + headless Edge)."""
import json, os, sys, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
ONLY = set(sys.argv[2:])
B = f"http://127.0.0.1:{os.environ.get('REVIEW_PORT', '8766')}/sub/page/"
results = []

def rec(test, status, detail):
    results.append({'test': test, 'status': status, 'detail': detail}); print(f'[{status}] {test}: {detail}', flush=True)

def ready(page, sel='[data-pdfbook]', state='ready', timeout=30000, n=0):
    page.locator(f'{sel} >> nth={n}').wait_for(state='attached', timeout=timeout)
    page.wait_for_function(f"(s)=>document.querySelectorAll('{sel}')[{n}]?.dataset.state===s", arg=state, timeout=timeout)

def new(browser, url, **kw):
    ctx = browser.new_context(**{'viewport': {'width': 1280, 'height': 900}, **kw})
    page = ctx.new_page(); ev = {'errors': [], 'console': [], 'requests': [], 'dialogs': [], 'popups': [], 'csp': []}
    page.on('pageerror', lambda e: ev['errors'].append(str(e)))
    page.on('console', lambda m: ev['console'].append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    page.on('request', lambda r: ev['requests'].append(r.url))
    page.on('dialog', lambda d: (ev['dialogs'].append(d.message), d.dismiss()))
    page.on('popup', lambda p: ev['popups'].append(p.url))
    page.add_init_script("document.addEventListener('securitypolicyviolation',e=>{(window.__csp=window.__csp||[]).push(e.violatedDirective+' '+e.blockedURI)})")
    if url: page.goto(url, wait_until='domcontentloaded')
    return ctx, page, ev

GERMAN = {'Ungültiger PDF-Pfad.', 'Nur PDFs im eigenen Medienverzeichnis sind erlaubt.', 'Die PDF-Datei ist nicht erreichbar.',
          'Die PDF-Datei konnte nicht geladen werden. Bitte später erneut versuchen.', 'Die PDF-Datei lädt zu langsam. Bitte später erneut versuchen oder das PDF direkt öffnen.',
          'PDF ist größer als 32 MB.', 'Die Datei ist kein PDF.', 'Das PDF enthält mehr als 1000 Seiten.', 'Dieses PDF ist passwortgeschützt.',
          'Die PDF-Datei ist beschädigt oder ungültig.', 'Die Seite konnte nicht dargestellt werden.', 'Das PDF konnte nicht angezeigt werden.'}

def t_two_modules(browser):
    ctx, page, ev = new(browser, B + 'two.html')
    ready(page, n=0); ready(page, n=1)
    st = page.evaluate("[...document.querySelectorAll('[data-pdfbook]')].map(e=>[e.dataset.state,e.dataset.renderer,e.dataset.page,e.querySelector('.pdfbook-heading strong').textContent.slice(0,40)])")
    scripts = page.evaluate("[...document.scripts].map(s=>s.src)")
    pdfreq = [u for u in ev['requests'] if '.pdf' in u]
    vendor = sorted({u.split('/sub/')[1].split('?')[0] for u in ev['requests'] if 'vendor' in u})
    rtl = page.evaluate("[...document.querySelectorAll('[data-pdfbook]')[1].querySelectorAll('canvas[role=img]')].map(c=>c.getAttribute('aria-label'))")
    dl = page.evaluate("[...document.querySelectorAll('[data-pdfbook] a.pdfbook-button')].map(a=>[a.hidden,a.href])")
    page.locator('button[data-pdfbook-open]').click()
    page.locator('dialog [data-state="ready"]').wait_for(timeout=30000)
    inj = page.evaluate("({img:document.querySelectorAll('img').length,b:document.querySelectorAll('[data-pdfbook] b, dialog b').length,t:!!(globalThis.__TITLE__||globalThis.__T2__)})")
    css = page.evaluate("({sheets:[...document.styleSheets].map(s=>s.href),radius:getComputedStyle(document.querySelector('[data-pdfbook]')).borderRadius})")
    guest = page.evaluate("[...document.querySelectorAll('section.mod')].slice(3).map(s=>s.innerHTML.trim())")
    ok = all(s[0] == 'ready' for s in st) and not ev['errors'] and inj == {'img': 0, 'b': 0, 't': False} and css['radius'] == '8px' and guest == ['', '']
    ext = [u for u in ev['requests'] if not u.startswith(B.rsplit('/page/', 1)[0] + '/')]
    rec('two modules + cover on one page, subdirectory /sub/', 'PASS' if ok and not ext else 'FAIL',
        {'states': st, 'stylesheet': css, 'guest_error_sections': guest, 'module_scripts': scripts, 'pdf_requests': pdfreq, 'vendor_files': vendor, 'rtl_first_spread': rtl, 'download_links': dl, 'injection': inj, 'external': ext, 'errors': ev['errors'], 'console': ev['console'][:5]})
    page.screenshot(path=OUT / 'two-modules.png', full_page=True)
    ctx.close()
    ctx, page, ev = new(browser, B + 'two-editor.html')
    shown = page.evaluate("[...document.querySelectorAll('section.mod')].map(s=>s.textContent.trim())")
    rec('F15 configuration errors: hidden for guests, shown to editors', 'PASS' if guest == ['', ''] and len(shown) == 2 and all(shown) else 'FAIL', {'guest': guest, 'editor': shown})
    ctx.close()

def t_actions(browser):
    ctx, page, ev = new(browser, B + 'actions-ext.html')
    ready(page); page.wait_for_timeout(1500)
    anns = page.evaluate("[...document.querySelectorAll('.pdfbook-annotation')].map(a=>[a.tagName,a.getAttribute('href'),a.getAttribute('rel'),a.getAttribute('target')])")
    nbtn = page.locator('button.pdfbook-annotation').count(); targets = []
    for i in range(nbtn):
        page.locator('.pdfbook-stage').focus(); page.keyboard.press('Home'); page.wait_for_timeout(500)
        page.locator('button.pdfbook-annotation').nth(i).click(); page.wait_for_timeout(1200)
        targets.append(page.locator('[data-pdfbook]').get_attribute('data-page'))
    flags = page.evaluate("['__OPENACTION__','__PAGE_AA__','__LINKJS__','__URIJS__','__DATA__','__ATTR__','__FIELD_AA__','__XFA__','__DOCJS__'].filter(k=>globalThis[k])")
    evil = [u for u in ev['requests'] if 'evil.example' in u]
    page_after = page.locator('[data-pdfbook]').get_attribute('data-page')
    ok = not flags and not evil and not ev['dialogs'] and not ev['popups'] and not ev['errors']
    rec('PDF actions (OpenAction/AA/JS link/Launch/SubmitForm/GoToR/XFA/doc JS) inert', 'PASS' if ok else 'FAIL',
        {'annotation_elements': anns, 'executed_flags': flags, 'evil_requests': evil, 'dialogs': ev['dialogs'], 'popups': ev['popups'], 'page_after_internal_clicks': page_after, 'internal_button_targets': targets, 'errors': ev['errors']})
    ctx.close()

def t_outline(browser):
    ctx, page, ev = new(browser, B + 'outline.html'); ready(page)
    page.get_by_role('button', name='Inhaltsverzeichnis', exact=True).click(); page.wait_for_timeout(800)
    n = page.locator('.pdfbook-outline').count()
    first = page.evaluate("[...document.querySelectorAll('.pdfbook-outline')].slice(0,4).map(b=>b.textContent)")
    inj = page.evaluate("({img:document.querySelectorAll('.pdfbook img, .pdfbook svg').length,f:['__OUTLINE__','__OUTLINE2__','__OUTLINE3__','__INFO__'].filter(k=>globalThis[k])})")
    # invalid destination entry (dest page 999) is the last one; may be beyond the 300 cap
    for i in range(3):
        page.get_by_role('button', name='Inhaltsverzeichnis', exact=True).click(); page.wait_for_timeout(100)
    rec('outline titles inert, entries capped, repeated toggling', 'PASS' if not inj['img'] and not inj['f'] and n <= 300 and not ev['errors'] else 'FAIL',
        {'entries_rendered': n, 'first_titles': first, 'injection': inj, 'errors': ev['errors']})
    ctx.close()

def t_errors(browser):
    out = {}
    for name in ['password', 'owner-only', 'truncated', 'fake-header', 'too-many', 'net-redirect', 'net-e500', 'net-html-mime', 'net-big-len', 'net-big-nolen']:
        ctx, page, ev = new(browser, B + name + '.html')
        try:
            page.wait_for_function("()=>['ready','error'].includes(document.querySelector('[data-pdfbook]')?.dataset.state)", timeout=60000)
        except Exception as e: pass
        el = page.locator('[data-pdfbook]')
        out[name] = {'state': el.get_attribute('data-state'), 'status': page.locator('.pdfbook-status').text_content(), 'errors': ev['errors'][:2], 'console': [c[:120] for c in ev['console']][:2]}
        if name == 'too-many':   # resize after the error: does the message survive?
            page.set_viewport_size({'width': 900, 'height': 800}); page.wait_for_timeout(1200)
            out[name]['status_after_resize'] = page.locator('.pdfbook-status').text_content()
            out[name]['state_after_resize'] = el.get_attribute('data-state'); out[name]['pages_after_resize'] = page.locator('.pdfbook-page').count()
            out[name]['controls_enabled'] = page.evaluate("[...document.querySelectorAll('.pdfbook-toolbar button')].filter(b=>!b.disabled).map(b=>b.getAttribute('aria-label'))")
            page.screenshot(path=OUT / 'too-many-after-resize.png')
        ctx.close()
    expect = {'password': 'error', 'owner-only': 'ready', 'truncated': 'error', 'fake-header': 'error', 'too-many': 'error', 'net-redirect': 'error',
              'net-e500': 'error', 'net-html-mime': 'ready', 'net-big-len': 'error', 'net-big-nolen': 'error'}
    bad = [n for n, r in out.items() if r['state'] != expect[n] or (r['state'] == 'error' and r['status'] not in GERMAN) or r['errors']]
    tm = out['too-many']
    if tm.get('state_after_resize') != 'error' or tm.get('status_after_resize') != tm['status'] or tm.get('controls_enabled'):
        bad.append('too-many after resize (F3)')
    rec('error fixtures and HTTP edge cases (F3, F5)', 'FAIL' if bad else 'PASS', {'failed': bad, **out})

def t_slow(browser):
    for name in ['net-slow', 'net-hang']:
        ctx, page, ev = new(browser, B + name + '.html'); t0 = time.time()
        try: page.wait_for_function("()=>['ready','error'].includes(document.querySelector('[data-pdfbook]')?.dataset.state)", timeout=70000)
        except Exception: pass
        r = {'seconds': round(time.time() - t0, 1), 'state': page.locator('[data-pdfbook]').get_attribute('data-state'), 'status': page.locator('.pdfbook-status').text_content(), 'errors': ev['errors'][:2]}
        ok = r['state'] == 'ready' if name == 'net-slow' else (r['state'] == 'error' and r['seconds'] <= 26 and r['status'].startswith('Die PDF-Datei lädt zu langsam'))
        rec(f'F4 slow/hanging response ({name})', 'PASS' if ok else 'FAIL', r)
        ctx.close()

def t_lost_input(browser):
    ctx, page, ev = new(browser, B + 'eight.html'); ready(page)
    el = page.locator('[data-pdfbook]')
    page.evaluate("()=>{const b=document.querySelector('[aria-label=\"Nächste Seite\"]');b.click();b.click();}")
    page.wait_for_function("()=>!document.querySelector('[data-pdfbook]').hasAttribute('aria-busy')", timeout=10000); page.wait_for_timeout(300)
    two_clicks = el.get_attribute('data-page')
    # keyboard: two quick ArrowRight
    page.locator('.pdfbook-stage').focus(); page.keyboard.press('ArrowRight'); page.wait_for_timeout(50); page.keyboard.press('ArrowRight'); page.wait_for_timeout(1500)
    keys = el.get_attribute('data-page')
    # resize during animation
    page.locator('.pdfbook-stage').focus(); page.keyboard.press('Home'); page.wait_for_timeout(800)
    before = page.evaluate("document.querySelector('.pdfbook-spread').getBoundingClientRect().width")
    page.keyboard.press('ArrowRight'); page.wait_for_timeout(100); page.set_viewport_size({'width': 900, 'height': 900}); page.wait_for_timeout(2000)
    after = page.evaluate("({spread:document.querySelector('.pdfbook-spread').getBoundingClientRect().width,stage:document.querySelector('.pdfbook-stage').clientWidth,canvas:document.querySelector('.pdfbook-page canvas').width})")
    page.set_viewport_size({'width': 1280, 'height': 900}); page.wait_for_timeout(1500)
    settle = page.evaluate("({spread:document.querySelector('.pdfbook-spread').getBoundingClientRect().width,stage:document.querySelector('.pdfbook-stage').clientWidth})")
    rec('F2 rapid input / resize while busy', 'PASS' if (two_clicks == '4' and keys == '8' and after['spread'] <= after['stage']) else 'FAIL',
        {'after_two_rapid_next_clicks_page': two_clicks, 'expected': '4', 'after_two_quick_arrowright_from_4': keys, 'expected_keys': '8', 'spread_width_before': before, 'after_resize_during_animation_to_900px': after, 'after_resize_back': settle, 'errors': ev['errors']})
    ctx.close()

def t_resize2(browser):
    ctx, page, ev = new(browser, B + 'eight.html'); ready(page)
    page.locator('[aria-label="Nächste Seite"]').click(); page.wait_for_timeout(120)
    busy = page.locator('[data-pdfbook]').get_attribute('aria-busy')
    page.set_viewport_size({'width': 520, 'height': 900}); page.wait_for_timeout(2500)
    r = page.evaluate("({pages:document.querySelectorAll('.pdfbook-page').length,stage:document.querySelector('.pdfbook-stage').clientWidth,spread:Math.round(document.querySelector('.pdfbook-spread').getBoundingClientRect().width),docOverflow:document.documentElement.scrollWidth-innerWidth,page:document.querySelector('[data-pdfbook]').dataset.page})")
    page.screenshot(path=OUT / 'resize-during-animation.png')
    ctx2, page2, _ = new(browser, B + 'eight.html'); ready(page2); page2.set_viewport_size({'width': 520, 'height': 900}); page2.wait_for_timeout(1500)
    ctrl = page2.evaluate("({pages:document.querySelectorAll('.pdfbook-page').length,spread:Math.round(document.querySelector('.pdfbook-spread').getBoundingClientRect().width)})")
    rec('F2 resize to 520 px during page-turn animation', 'FAIL' if r['pages'] != ctrl['pages'] or r['spread'] > r['stage'] else 'PASS', {'busy_at_resize': busy, 'result': r, 'control_resize_when_idle': ctrl})
    ctx.close(); ctx2.close()

def t_zoom(browser):
    ctx, page, ev = new(browser, B + 'eight.html'); ready(page)
    for _ in range(6):
        page.get_by_role('button', name='Vergrößern').click(); page.wait_for_function("()=>!document.querySelector('[data-pdfbook]').hasAttribute('aria-busy')")
    r = page.evaluate("""()=>{const s=document.querySelector('.pdfbook-stage'),p=document.querySelector('.pdfbook-spread');s.scrollLeft=0;s.scrollTop=0;
      const a=s.getBoundingClientRect(),b=p.getBoundingClientRect();return {stageLeft:a.left,spreadLeft:b.left,stageTop:a.top,spreadTop:b.top,scrollW:s.scrollWidth,clientW:s.clientWidth,spreadW:b.width,canvasW:document.querySelector('.pdfbook-page canvas').width}}""")
    page.screenshot(path=OUT / 'zoom-250.png')
    clipped = r['spreadLeft'] < r['stageLeft'] - 1 or r['spreadTop'] < r['stageTop'] - 1
    rec('zoom 250 % reachable by scrolling', 'FAIL' if clipped else 'PASS', r)
    ctx.close()

def t_dialog_lifecycle(browser):
    ctx, page, ev = new(browser, B + 'two.html'); ready(page, n=0); ready(page, n=1)
    base = len(page.workers)
    for i in range(12):
        page.locator('button[data-pdfbook-open]').click()
        if i % 3 == 0: page.wait_for_timeout(30)          # during load
        elif i % 3 == 1:
            page.locator('dialog [data-state="ready"]').wait_for(timeout=30000)
            page.locator('dialog [aria-label="Nächste Seite"]').click(); page.wait_for_timeout(120)   # during animation
        else:
            page.locator('dialog [data-state="ready"]').wait_for(timeout=30000)
            page.locator('dialog [aria-label="Seitenübersicht"]').click(); page.wait_for_timeout(50)   # during thumbnails
        page.keyboard.press('Escape'); page.wait_for_timeout(80)
    page.wait_for_timeout(1500)
    focus = page.evaluate("document.activeElement?.matches('button[data-pdfbook-open]')")
    st = {'workers_before': base, 'workers_after': len(page.workers), 'dialogs_left': page.locator('dialog').count(), 'focus_returned': focus,
          'webgl_warnings': [c for c in ev['console'] if 'WebGL' in c][:3], 'errors': ev['errors'][:3]}
    rec('dialog open/close x12 during load/animation/thumbnails', 'PASS' if st['workers_after'] <= base and not st['dialogs_left'] and focus and not ev['errors'] else 'FAIL', st)
    # focus trap / background interaction
    page.locator('button[data-pdfbook-open]').click(); page.locator('dialog [data-state="ready"]').wait_for(timeout=30000)
    tabs = []
    for _ in range(25): page.keyboard.press('Tab'); tabs.append(page.evaluate("!!document.activeElement.closest('dialog')||document.activeElement===document.body"))
    rec('dialog keeps focus (Tab x25; body = browser UI step)', 'PASS' if all(tabs) else 'FAIL', {'inside_dialog': f'{sum(tabs)}/25'})
    ctx.close()

def t_mode_swipe(browser):
    ctx, page, ev = new(browser, B + 'eight.html'); ready(page)
    labels = []
    for _ in range(3):
        b = page.locator('.pdfbook-toolbar button[aria-label^="Seitenansicht"]'); b.click(); page.wait_for_timeout(900)
        labels.append((b.get_attribute('aria-label'), page.locator('.pdfbook-page').count()))
    page.set_viewport_size({'width': 500, 'height': 900}); page.wait_for_timeout(1500)
    auto_narrow = page.locator('.pdfbook-page').count()
    rec('F11 page-mode switch returns to automatic', 'PASS' if labels[-1][0].endswith('automatisch') and auto_narrow == 1 else 'FAIL', {'cycle': labels, 'pages_at_500px_after_cycle': auto_narrow})
    page.set_viewport_size({'width': 1280, 'height': 900}); page.wait_for_timeout(1200)
    for _ in range(6):
        page.get_by_role('button', name='Vergrößern').click(); page.wait_for_timeout(400)
    page.wait_for_function("()=>!document.querySelector('[data-pdfbook]').hasAttribute('aria-busy')")
    touch = page.evaluate("document.querySelector('.pdfbook-stage').style.touchAction")

    def swipe():
        box = page.locator('.pdfbook-stage').bounding_box(); y = box['y'] + box['height'] / 2; x = box['x'] + box['width'] / 2
        page.mouse.move(x + 150, y); page.mouse.down(); page.mouse.move(x - 50, y, steps=5); page.mouse.up(); page.wait_for_timeout(1200)
        return page.locator('[data-pdfbook]').get_attribute('data-page')
    start = page.locator('[data-pdfbook]').get_attribute('data-page')
    page.evaluate("document.querySelector('.pdfbook-stage').scrollLeft=0"); mid = swipe()
    page.evaluate("(()=>{const s=document.querySelector('.pdfbook-stage');s.scrollLeft=s.scrollWidth})()"); edge = swipe()
    rec('F13 zoomed swipe scrolls first, turns only at the edge', 'PASS' if touch == 'pan-x pan-y' and mid == start and edge != start else 'FAIL',
        {'touch_action': touch, 'start': start, 'after_swipe_not_at_edge': mid, 'after_swipe_at_right_edge': edge})
    ctx.close()

def t_jpx_spaces(browser):
    ctx, page, ev = new(browser, B + 'jpx.html'); ready(page)
    px = page.evaluate("(()=>{const c=document.querySelector('.pdfbook-page canvas');const d=c.getContext('2d').getImageData(Math.floor(c.width*.5),Math.floor(c.height*.41),1,1).data;return [...d]})()")
    decoders = [u.split('/sub/')[1] for u in ev['requests'] if 'wasm' in u]
    errs = [u for u in ev['console'] if '404' in u or 'Failed to load' in u]
    rec('F7 JPEG 2000 via JavaScript fallback, no .wasm requests', 'PASS' if px[:3] != [255, 255, 255] and not any('.wasm' in u for u in decoders) and not errs else 'FAIL',
        {'pixel_rgba': px, 'decoder_requests': decoders, 'load_errors': errs[:3]})
    ctx.close()
    ctx, page, ev = new(browser, B + 'spaces.html'); ready(page)
    src = [u.split('/sub/')[1] for u in ev['requests'] if '.pdf' in u]
    rec('F9 legacy "/images/…" path with spaces', 'PASS' if src == ['images/mit%20leerzeichen.pdf'] else 'FAIL', {'pdf_requests': src})
    ctx.close()

def t_low_dialog(browser):
    out = {}
    for w, h in [(320, 225), (640, 300), (568, 320), (844, 390)]:
        ctx, page, ev = new(browser, B + 'two.html', viewport={'width': w, 'height': h}); ready(page, n=0)
        page.locator('button[data-pdfbook-open]').click(); page.locator('dialog [data-state="ready"]').wait_for(timeout=30000)
        m = page.evaluate("""()=>{const d=document.querySelector('dialog').getBoundingClientRect(),t=document.querySelector('dialog .pdfbook-toolbar').getBoundingClientRect(),
          n=document.querySelector('dialog [aria-label="Nächste Seite"]').getBoundingClientRect();
          return {dialog:[Math.round(d.top),Math.round(d.bottom)],toolbar:[Math.round(t.top),Math.round(t.bottom)],visible:t.top>=d.top-1&&t.bottom<=d.bottom+1,nextHeight:Math.round(n.height)}}""")
        before = page.locator('dialog .pdfbook').get_attribute('data-page')
        page.locator('dialog [aria-label="Nächste Seite"]').click(); page.wait_for_timeout(1200)
        m['next_click'] = [before, page.locator('dialog .pdfbook').get_attribute('data-page')]
        out[f'{w}x{h}'] = m; ctx.close()
    bad = [k for k, m in out.items() if not m['visible'] or m['next_click'][0] == m['next_click'][1]]
    rec('N1 dialog toolbar visible and usable at low heights', 'FAIL' if bad else 'PASS', {'failed': bad, **out})

def t_render_failure(browser):
    ctx, page, ev = new(browser, B + 'eight.html'); ready(page)
    workers_before = len(page.workers)
    r = page.evaluate("""async()=>{const {PdfBook}=await import(document.querySelector('script[type=module]').src);  // same URL as the page: one module instance
      const el=document.createElement('div');document.body.append(el);const b=new PdfBook(el,{src:'images/eight.pdf',base:'/sub/',renderer:'flat'});await b.ready;
      b.pdf.render=async()=>{throw new Error('injected')};await b.go(4,false);await new Promise(r=>setTimeout(r,500));
      return {state:el.dataset.state,status:el.querySelector('.pdfbook-status').textContent,pdfDisposed:b.pdf.disposed,cache:b.pdf.cache.size,
        controlsEnabled:[...el.querySelectorAll('.pdfbook-toolbar button')].filter(x=>!x.disabled).length}}""")
    page.wait_for_timeout(2500); r['workers_before_extra_instance'] = workers_before; r['workers_after'] = len(page.workers)
    ok = r['state'] == 'error' and r['pdfDisposed'] and r['cache'] == 0 and r['controlsEnabled'] == 0 and r['workers_after'] <= workers_before
    rec('N2 resources released after a render error', 'PASS' if ok else 'FAIL', r)
    ctx.close()

def t_click_keys(browser):
    ctx, page, ev = new(browser, B + 'two.html'); ready(page, n=0); ready(page, n=1)
    book = page.locator('[data-pdfbook]').nth(0); other = page.locator('[data-pdfbook]').nth(1)
    def settled(): page.wait_for_function("()=>!document.querySelector('[aria-busy]')", timeout=10000); page.wait_for_timeout(250)
    box = book.locator('.pdfbook-spread').bounding_box(); seq = []
    page.mouse.click(box['x'] + box['width'] * 0.75, box['y'] + box['height'] / 2); settled(); seq.append(('click right half', book.get_attribute('data-page')))
    page.mouse.click(box['x'] + box['width'] * 0.75, box['y'] + box['height'] / 2); settled(); seq.append(('click right half', book.get_attribute('data-page')))
    page.mouse.click(box['x'] + box['width'] * 0.25, box['y'] + box['height'] / 2); settled(); seq.append(('click left half', book.get_attribute('data-page')))
    page.evaluate("document.activeElement.blur()"); page.mouse.move(box['x'] + 5, box['y'] + 5)
    page.keyboard.press('ArrowRight'); settled(); seq.append(('ArrowRight without focus', book.get_attribute('data-page')))
    page.keyboard.press('ArrowLeft'); settled(); seq.append(('ArrowLeft without focus', book.get_attribute('data-page')))
    untouched = other.get_attribute('data-page')
    book.locator('input[aria-label="Seitennummer"]').focus(); page.keyboard.press('ArrowRight'); settled(); in_input = book.get_attribute('data-page')
    ok = [s[1] for s in seq] == ['2', '4', '2', '4', '2'] and untouched == '1' and in_input == '2' and not ev['errors']
    rec('page click and arrow keys (active book only, not while typing)', 'PASS' if ok else 'FAIL', {'sequence': seq, 'second_book_page': untouched, 'arrow_inside_page_input': in_input, 'errors': ev['errors']})
    ctx.close()

def t_slide_look(browser):
    out = {}
    for label, size in [('double 1280', (1280, 900)), ('single 500', (500, 900))]:
        ctx, page, ev = new(browser, B + 'slide.html', viewport={'width': size[0], 'height': size[1]}); ready(page)
        book = page.locator('[data-pdfbook]')
        page.locator('[aria-label="Nächste Seite"]').click()
        try: page.locator('.pdfbook-slide').first.wait_for(state='attached', timeout=3000)   # starts once the new pages are rendered
        except Exception: pass
        during = page.evaluate("({layers:document.querySelectorAll('.pdfbook-slide').length,overflow:document.querySelector('.pdfbook-stage').scrollWidth-document.querySelector('.pdfbook-stage').clientWidth})")
        page.wait_for_timeout(900)
        out[label] = {'during': during, 'after_layers': page.locator('.pdfbook-slide').count(), 'page': book.get_attribute('data-page'), 'renderer': book.get_attribute('data-renderer'),
                      'pages_in_spread': page.locator('.pdfbook-spread > .pdfbook-page').count(), 'errors': ev['errors']}
        ctx.close()
    ok = all(r['during']['layers'] == 2 and r['during']['overflow'] <= 0 and r['after_layers'] == 0 and r['page'] == '2' and r['renderer'] == 'slide' and not r['errors'] for r in out.values())
    ok = ok and out['double 1280']['pages_in_spread'] == 2 and out['single 500']['pages_in_spread'] == 1
    rec('slide animation (double and single page)', 'PASS' if ok else 'FAIL', out)
    ctx, page, ev = new(browser, B + 'look.html'); ready(page, n=0); ready(page, n=1)
    cfg = page.evaluate("[...document.querySelectorAll('[data-pdfbook]')].map(e=>{const c=JSON.parse(e.dataset.pdfbook);return [c.curvature,c.shadowDensity,c.shadowSoftness,c.shadowWidth,c.duration]})")
    for n in (0, 1): page.locator('[data-pdfbook]').nth(n).locator('[aria-label="Nächste Seite"]').click()
    page.wait_for_timeout(700); page.screenshot(path=OUT / 'look-extremes.png'); page.wait_for_timeout(1600)
    pages = page.evaluate("[...document.querySelectorAll('[data-pdfbook]')].map(e=>e.dataset.page)")
    rec('adjustable curvature and shadow (maximum and rigid/no shadow)', 'PASS' if cfg == [[100, 60, 0, 100, 1800], [0, 0, 50, 50, 1800]] and pages == ['2', '2'] and not ev['errors'] else 'FAIL',
        {'config': cfg, 'pages': pages, 'errors': ev['errors']})
    ctx.close()

def t_webgl(browser, pw):
    ctx, page, ev = new(browser, B + 'eight.html'); ready(page)
    page.locator('[aria-label="Nächste Seite"]').click(); page.wait_for_timeout(150)
    page.evaluate("document.querySelector('.pdfbook-turn').getContext('webgl').getExtension('WEBGL_lose_context').loseContext()")
    page.wait_for_timeout(1500)
    s1 = {'page': page.locator('[data-pdfbook]').get_attribute('data-page'), 'renderer': page.locator('[data-pdfbook]').get_attribute('data-renderer'), 'busy': page.locator('[data-pdfbook]').get_attribute('aria-busy'), 'overlay_hidden': page.evaluate("document.querySelector('.pdfbook-turn').hidden")}
    page.locator('[aria-label="Nächste Seite"]').click(); page.wait_for_timeout(1500)
    s1['page_after_next'] = page.locator('[data-pdfbook]').get_attribute('data-page'); s1['renderer_after'] = page.locator('[data-pdfbook]').get_attribute('data-renderer')
    rec('WebGL context lost during animation', 'PASS' if s1['page'] == '2' and s1['page_after_next'] == '4' and not ev['errors'] else 'FAIL', {**s1, 'errors': ev['errors']})
    ctx.close()
    b2 = (pw.firefox.launch(headless=True, firefox_user_prefs={'webgl.disabled': True}) if os.environ.get('REVIEW_BROWSER') == 'firefox'
          else pw.chromium.launch(channel='msedge', headless=True, args=['--disable-webgl', '--disable-3d-apis']))
    ctx, page, ev = new(b2, B + 'eight.html'); ready(page)
    page.locator('[aria-label="Nächste Seite"]').click(); page.wait_for_timeout(1200)
    rec('WebGL disabled in browser', 'PASS' if page.locator('[data-pdfbook]').get_attribute('data-page') == '2' and not ev['errors'] else 'FAIL',
        {'renderer': page.locator('[data-pdfbook]').get_attribute('data-renderer'), 'page': page.locator('[data-pdfbook]').get_attribute('data-page'), 'errors': ev['errors']})
    ctx.close(); b2.close()
    ctx, page, ev = new(browser, B + 'eight.html', reduced_motion='reduce'); ready(page)
    page.locator('[aria-label="Nächste Seite"]').click(); page.wait_for_timeout(100)
    vis = page.evaluate("!document.querySelector('.pdfbook-turn')?.hidden")
    rec('prefers-reduced-motion disables animation', 'PASS' if not vis else 'FAIL', {'overlay_visible_100ms_after_click': vis})
    ctx.close()

def t_autoplay(browser):
    ctx, page, ev = new(browser, B + 'four-page.html'); ready(page)
    page.locator('[aria-label="Automatisch blättern"]').click()
    page.wait_for_timeout(10500)
    s = {'page': page.locator('[data-pdfbook]').get_attribute('data-page'), 'pressed': page.locator('[aria-label="Automatisch blättern"]').get_attribute('aria-pressed')}
    page.locator('[aria-label="Automatisch blättern"]').click()
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
    s['pressed_after_hidden'] = page.locator('[aria-label="Automatisch blättern"]').get_attribute('aria-pressed')
    rec('autoplay stops at end and on hidden tab', 'PASS' if s['pressed'] == 'false' and s['pressed_after_hidden'] == 'false' else 'FAIL', s)
    ctx.close()

def t_keyboard_rtl(browser):
    ctx, page, ev = new(browser, B + 'two.html'); ready(page, n=1)
    book = page.locator('[data-pdfbook]').nth(1); stage = book.locator('.pdfbook-stage')
    stage.focus(); seq = []
    for k in ['ArrowLeft', 'ArrowLeft', 'End', 'ArrowRight', 'Home']:
        page.keyboard.press(k); page.wait_for_timeout(500); seq.append((k, book.get_attribute('data-page'), book.locator('canvas[role=img]').evaluate_all('xs=>xs.map(x=>x.getAttribute("aria-label"))')))
    rec('RTL keyboard navigation (module 2, double, flat)', 'INFO', seq)
    ctx.close()

def t_widths(browser):
    out = {}
    for w, h, dsf in [(320, 640, 1), (390, 844, 3), (768, 1024, 2), (1280, 900, 1), (640, 450, 2)]:
        ctx, page, ev = new(browser, B + 'two.html', viewport={'width': w, 'height': h}, device_scale_factor=dsf); ready(page, n=0); ready(page, n=1)
        r = page.evaluate("""()=>({docOverflow:document.documentElement.scrollWidth-innerWidth,
          toolbars:[...document.querySelectorAll('.pdfbook-toolbar')].map(t=>Math.round(t.getBoundingClientRect().height)),
          pages:[...document.querySelectorAll('[data-pdfbook]')].map(b=>b.querySelectorAll('.pdfbook-page').length),
          smallTargets:[...document.querySelectorAll('.pdfbook-toolbar button')].filter(b=>{const r=b.getBoundingClientRect();return r.width<24||r.height<24}).length})""")
        page.locator('button[data-pdfbook-open]').click(); page.locator('dialog [data-state="ready"]').wait_for(timeout=30000)
        r['dialog'] = page.evaluate("(()=>{const d=document.querySelector('dialog'),t=d.querySelector('.pdfbook-toolbar').getBoundingClientRect(),b=d.getBoundingClientRect();return {scrollH:d.scrollHeight,clientH:d.clientHeight,vh:innerHeight,toolbarInside:t.bottom<=b.bottom+1}})()")
        page.screenshot(path=OUT / f'width-{w}x{h}@{dsf}.png'); out[f'{w}x{h}@{dsf}'] = r; ctx.close()
    bad = [k for k, r in out.items() if r['docOverflow'] > 0 or r['dialog']['scrollH'] > r['dialog']['clientH'] + 1 or not r['dialog']['toolbarInside']]
    rec('F10 layout at 320/390/768/1280 and 640x450@2 (~200 % zoom)', 'FAIL' if bad else 'PASS', {'failed': bad, **out})

def t_resources(browser):
    out = {}
    for name in ['many-links', 'image-15mp', 'image-25mp', 'thousand']:
        ctx, page, ev = new(browser, B + name + '.html'); t0 = time.time()
        try: page.wait_for_function("()=>['ready','error'].includes(document.querySelector('[data-pdfbook]')?.dataset.state)", timeout=60000)
        except Exception: pass
        r = {'s': round(time.time() - t0, 1), 'state': page.locator('[data-pdfbook]').get_attribute('data-state'), 'status': page.locator('.pdfbook-status').text_content()}
        if name == 'geometry':
            seq = []
            for _ in range(4):
                page.locator('[aria-label="Nächste Seite"]').click(); page.wait_for_function("()=>!document.querySelector('[data-pdfbook]').hasAttribute('aria-busy')", timeout=20000); page.wait_for_timeout(300)
                seq.append(page.evaluate("[...document.querySelectorAll('.pdfbook-page canvas')].map(c=>c.width+'x'+c.height)"))
            r['canvas_sizes'] = seq
            r['rotated_link'] = page.evaluate("[...document.querySelectorAll('a.pdfbook-annotation')].map(a=>[a.href,a.style.left,a.style.top,a.style.width,a.style.height])")
            page.screenshot(path=OUT / 'geometry.png')
        if name == 'many-links': r['annotation_nodes'] = page.locator('.pdfbook-annotation').count()
        if name == 'cjk':
            r['bcmap'] = [u.split('/sub/')[1] for u in ev['requests'] if 'bcmap' in u or 'standard_fonts' in u]
            page.screenshot(path=OUT / 'cjk.png')
        if name == 'thousand':
            page.get_by_role('button', name='Seitenübersicht', exact=True).click(); page.wait_for_timeout(1500)
            r['thumb_buttons'] = page.locator('.pdfbook-thumbnail').count(); r['thumb_canvases'] = page.locator('.pdfbook-thumbnail canvas').count()
            page.locator('.pdfbook-sidebar').evaluate('s=>s.scrollTop=s.scrollHeight'); page.wait_for_timeout(1500)
            r['thumb_canvases_after_scroll'] = page.locator('.pdfbook-thumbnail canvas').count()
            page.locator('[aria-label="Letzte Seite"]').click(); page.wait_for_timeout(1500); r['last_page'] = page.locator('[data-pdfbook]').get_attribute('data-page')
            r['heap_mb'] = page.evaluate("performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):null")
        r['errors'] = ev['errors'][:2]; r['warnings'] = [c[:140] for c in ev['console']][:3]
        out[name] = r; ctx.close()
    rec('resource/geometry fixtures', 'INFO', out)

def t_csp(browser):
    out = {}
    for q in ['default', 'strictstyle', 'nonce']:
        url = B + ('eight-nonce.html' if q == 'nonce' else 'eight.html') + f'?csp={q}'
        ctx, page, ev = new(browser, url)
        try: page.wait_for_function("()=>['ready','error'].includes(document.querySelector('[data-pdfbook]')?.dataset.state)", timeout=30000)
        except Exception: pass
        page.locator('[aria-label="Nächste Seite"]').click(timeout=3000) if page.locator('[data-pdfbook]').get_attribute('data-state') == 'ready' else None
        page.wait_for_timeout(1200)
        out[q] = {'state': page.locator('[data-pdfbook]').get_attribute('data-state'), 'page': page.locator('[data-pdfbook]').get_attribute('data-page'),
                  'violations': sorted(set(page.evaluate('window.__csp||[]')))[:8], 'spread_style': page.evaluate("document.querySelector('.pdfbook-spread')?.style.cssText"), 'errors': ev['errors'][:2]}
        page.screenshot(path=OUT / f'csp-{q}.png'); ctx.close()
    rec('CSP variants (no bypass)', 'INFO', out)

with sync_playwright() as pw:
    FIREFOX = os.environ.get('REVIEW_BROWSER', 'msedge') == 'firefox'
    browser = pw.firefox.launch(headless=True) if FIREFOX else pw.chromium.launch(channel='msedge', headless=True)
    rec('environment', 'INFO', {'browser': ('firefox ' if FIREFOX else 'msedge ') + browser.version, 'playwright': '1.65.0', 'date': time.strftime('%Y-%m-%d %H:%M')})
    tests = [('two', t_two_modules), ('actions', t_actions), ('outline', t_outline), ('errors', t_errors), ('lost', t_lost_input), ('resize2', t_resize2), ('mode', t_mode_swipe), ('jpx', t_jpx_spaces), ('lowdialog', t_low_dialog), ('clickkeys', t_click_keys), ('slidelook', t_slide_look), ('renderfail', t_render_failure), ('zoom', t_zoom),
             ('dialog', t_dialog_lifecycle), ('webgl', lambda b: t_webgl(b, pw)), ('autoplay', t_autoplay), ('rtl', t_keyboard_rtl), ('widths', t_widths),
             ('resources', t_resources), ('csp', t_csp), ('slow', t_slow)]
    for key, fn in tests:
        if ONLY and key not in ONLY: continue
        try: fn(browser)
        except Exception as e: rec(key, 'ERROR', traceback.format_exc()[-1500:])
    browser.close()
(OUT / ('results-' + ('-'.join(sorted(ONLY)) or 'all') + '.json')).write_text(json.dumps(results, indent=1, ensure_ascii=False), encoding='utf-8')
sys.exit(1 if any(r['status'] in ('FAIL', 'ERROR') for r in results) else 0)
