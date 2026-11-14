"""1.0.0 GPU-budget regression, using synthetic PDFs and the loopback preview.

Run after make_fixtures.py with serve.py running. REVIEW_BROWSER=msedge/firefox.
The 1024-edge cap is simulated, not evidence from a physical low-end GPU.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results' / 'release-1.0.0'
OUT.mkdir(parents=True, exist_ok=True)
writer = PdfWriter()
for width, height in [(420, 4200), (842, 420), (420, 594), (420, 4200)]:
    page = writer.add_blank_page(width, height)
    stream = DecodedStreamObject()
    stream.set_data(f'0.8 0.9 0.8 rg 0 0 {width} {height} re f'.encode())
    page[NameObject('/Contents')] = writer._add_object(stream)
with (ROOT / 'images/resource-formats.pdf').open('wb') as f:
    writer.write(f)

kind = os.environ.get('REVIEW_BROWSER', 'msedge')
with sync_playwright() as pw:
    browser = pw.firefox.launch(headless=True) if kind == 'firefox' else pw.chromium.launch(channel='msedge', headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 900})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.add_init_script("""(() => {
      const proto = WebGLRenderingContext.prototype;
      const parameter = proto.getParameter, image = proto.texImage2D;
      window.textureUploads = [];
      proto.getParameter = function(p) {
        const value = parameter.call(this, p);
        return p === this.MAX_TEXTURE_SIZE ? Math.min(value, 1024) : value;
      };
      proto.texImage2D = function(...args) {
        const source = args.length === 6 ? args[5] : null;
        if (source?.width && source?.height) {
          let red = null;
          const ctx = source.getContext('2d'), w = source.width, h = source.height;
          if (ctx) {
            const pixels = ctx.getImageData(0, 0, w, h).data;
            let left = w, right = -1, top = h, bottom = -1;
            for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 220 && pixels[i+1] < 40 && pixels[i+2] < 40) {
              const x = (i/4) % w, y = Math.floor(i/4/w);
              left = Math.min(left,x); right = Math.max(right,x); top = Math.min(top,y); bottom = Math.max(bottom,y);
            }
            if (right >= left) red = (right-left+1)/(bottom-top+1);
          }
          window.textureUploads.push({width:w, height:h, redRatio:red});
        }
        return image.apply(this, args);
      };
    })();""")
    results = []
    for source in ['images/resource-formats.pdf', 'images/mixed-formats.pdf']:
        page.goto('http://127.0.0.1:8765/demo/')
        result = page.evaluate("""async source => {
          const version = (await (await fetch('/package.json')).json()).version;
          const {PdfBook} = await import('/media/js/viewer.js?v=' + version);
          const target = document.createElement('div'); document.body.replaceChildren(target);
          const book = new PdfBook(target, {src:source,base:location.origin+'/',title:'Texture budget',mode:'double',renderer:'webgl',height:600,duration:150});
          await book.ready; window.textureUploads = []; await book.go(2);
          return {source, state:target.dataset.state, page:target.dataset.page, renderer:target.dataset.renderer,
                  gpuLimit:book.turn?.maxTextureSize, uploads:window.textureUploads,
                  glError:book.turn?.gl.getError()};
        }""", source)
        assert result['state'] == 'ready' and result['page'] == '2', result
        assert result['renderer'] == 'webgl' and result['uploads'], result
        assert result['gpuLimit'] <= 1024 and result['glError'] == 0, result
        assert all(u['width'] <= result['gpuLimit'] and u['height'] <= result['gpuLimit'] and u['width']*u['height'] <= 2400000 for u in result['uploads']), result
        if source.endswith('mixed-formats.pdf'):
            ratios = [u['redRatio'] for u in result['uploads'] if u['redRatio'] is not None]
            assert ratios and all(abs(r-200/60) < .15 for r in ratios), result
        results.append(result)
        page.screenshot(path=OUT / f'{kind}-{Path(source).stem}.png')
    assert not errors, errors
    report = {'browser':kind,'version':browser.version,'scope':'simulated 1024-edge GPU texture limit, synthetic fixtures','results':results,'page_errors':errors}
    (OUT / f'{kind}-textures.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))
    browser.close()
