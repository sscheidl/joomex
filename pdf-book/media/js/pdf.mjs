// Every relative import and the worker URL carry ?v=<version> so a module update never mixes cached files (checked by scripts/build.py).
import { getDocument, GlobalWorkerOptions, version } from '../vendor/pdfjs/build/pdf.mjs?v=0.1.0-alpha.3';
import { LIMITS, ViewerError, renderDimensions } from './model.mjs?v=0.1.0-alpha.3';

const vendor = new URL('../vendor/pdfjs/', import.meta.url);
GlobalWorkerOptions.workerSrc = new URL('build/pdf.worker.mjs?v=0.1.0-alpha.3', vendor).href;
export const pdfVersion = version;

export class PdfDocument {
  constructor() { this.cache = new Map(); this.tasks = new Set(); this.abort = new AbortController(); this.disposed = false; this.timedOut = false; }

  /**
   * Downloads at most LIMITS.bytes with three separate timeouts: until the response headers arrive,
   * between two received chunks (inactivity), and for parsing. A slow but steady download is not aborted.
   */
  async open(url, onProgress) {
    let timer = 0;
    const arm = ms => { clearTimeout(timer); timer = setTimeout(() => { this.timedOut = true; this.abort.abort(); this.loading?.destroy().catch(() => {}); }, ms); };
    const failure = error => this.disposed ? new ViewerError('closed', error) : this.timedOut ? new ViewerError('timeout', error)
      : error instanceof ViewerError ? error : new ViewerError('network', error);
    try {
      arm(LIMITS.responseTimeout);
      let response;
      try { response = await fetch(url, {signal: this.abort.signal, redirect: 'error', credentials: 'same-origin'}); }
      catch (error) { throw failure(error); }
      if (!response.ok) throw new ViewerError('unreachable');
      const total = Number(response.headers.get('content-length')) || 0;
      if (total > LIMITS.bytes) throw new ViewerError('too-large');
      const reader = response.body.getReader();
      const chunks = []; let length = 0;
      for (;;) {
        arm(LIMITS.idleTimeout);
        let part;
        try { part = await reader.read(); } catch (error) { throw failure(error); }
        if (part.done) break;
        length += part.value.length;
        if (length > LIMITS.bytes) { await reader.cancel().catch(() => {}); throw new ViewerError('too-large'); }
        chunks.push(part.value);
        onProgress?.(length, total);
      }
      const data = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
      if (!new TextDecoder().decode(data.subarray(0, 1024)).includes('%PDF-')) throw new ViewerError('not-pdf');
      if (this.disposed) throw new ViewerError('closed');
      arm(LIMITS.parseTimeout);
      this.loading = getDocument({
        data, cMapUrl: new URL('web/cmaps/', vendor).href, cMapPacked: true,
        standardFontDataUrl: new URL('web/standard_fonts/', vendor).href,
        wasmUrl: new URL('web/wasm/', vendor).href, iccUrl: new URL('web/iccs/', vendor).href,
        maxImageSize: LIMITS.imagePixels, canvasMaxAreaInBytes: 16000000,
        // No scripting manager is used, so PDF JavaScript is never run. PDF.js 6.5 has no eval code path any more.
        enableXfa: false, useWasm: false,
      });
      let doc;
      try { doc = await this.loading.promise; }
      catch (error) { throw this.timedOut || this.disposed ? failure(error) : error; }
      // Check the limit before the document becomes visible to the viewer, then release it.
      if (doc.numPages > LIMITS.pages) { await this.loading.destroy().catch(() => {}); this.loading = null; throw new ViewerError('too-many-pages'); }
      this.doc = doc;
      this.count = doc.numPages;
      return this;
    } finally { clearTimeout(timer); }
  }

  async render(number, width) {
    const key = `${number}:${Math.round(width / 100) * 100}`;
    if (this.cache.has(key)) { const value = this.cache.get(key); this.cache.delete(key); this.cache.set(key, value); return value; }
    if (this.disposed) throw new ViewerError('closed');
    const page = await this.doc.getPage(number);
    const base = page.getViewport({scale: 1});
    const size = renderDimensions(base.width, base.height, width);
    const viewport = page.getViewport({scale: size.scale});
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    const task = page.render({canvasContext: canvas.getContext('2d', {alpha: false}), viewport});
    this.tasks.add(task);
    try { await task.promise; } finally { this.tasks.delete(task); }
    if (this.disposed) throw new ViewerError('closed');
    const annotations = await page.getAnnotations({intent: 'display'});
    const result = {canvas, viewport, annotations, number};
    this.cache.set(key, result);
    while (this.cache.size > LIMITS.cache) this.cache.delete(this.cache.keys().next().value);
    return result;
  }

  async destination(dest) {
    if (typeof dest === 'string') dest = await this.doc.getDestination(dest);
    if (!Array.isArray(dest) || !dest.length) return null;
    const number = typeof dest[0] === 'number' ? dest[0] + 1 : (await this.doc.getPageIndex(dest[0])) + 1;
    return number >= 1 && number <= this.count ? number : null;
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true; this.abort.abort();
    for (const task of this.tasks) task.cancel();
    this.cache.clear();
    if (this.loading) await this.loading.destroy();
  }
}
