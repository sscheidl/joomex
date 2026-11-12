import { getDocument, GlobalWorkerOptions, version } from '../vendor/pdfjs/build/pdf.mjs';
import { LIMITS, renderDimensions } from './model.mjs';

const vendor = new URL('../vendor/pdfjs/', import.meta.url);
GlobalWorkerOptions.workerSrc = new URL('build/pdf.worker.mjs', vendor).href;
export const pdfVersion = version;

export class PdfDocument {
  constructor() { this.cache = new Map(); this.tasks = new Set(); this.abort = new AbortController(); this.disposed = false; }
  async open(url) {
    const timer = setTimeout(() => { this.abort.abort(); this.loading?.destroy().catch(()=>{}); }, 30000);
    try {
      const response = await fetch(url, {signal: this.abort.signal, redirect: 'error', credentials: 'same-origin'});
      if (!response.ok) throw new Error('Die PDF-Datei ist nicht erreichbar.');
      if (Number(response.headers.get('content-length')) > LIMITS.bytes) throw new Error('PDF ist größer als 32 MB.');
      const reader = response.body.getReader();
      const chunks = []; let length = 0;
      for (;;) {
        const {value, done} = await reader.read(); if (done) break;
        length += value.length;
        if (length > LIMITS.bytes) { await reader.cancel(); throw new Error('PDF ist größer als 32 MB.'); }
        chunks.push(value);
      }
      const data = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
      if (!new TextDecoder().decode(data.subarray(0, 1024)).includes('%PDF-')) throw new Error('Die Datei ist kein PDF.');
      if (this.disposed) throw new Error('Ansicht geschlossen.');
      this.loading = getDocument({
        data, cMapUrl: new URL('web/cmaps/', vendor).href, cMapPacked: true,
        standardFontDataUrl: new URL('web/standard_fonts/', vendor).href,
        wasmUrl: new URL('web/wasm/', vendor).href, iccUrl: new URL('web/iccs/', vendor).href,
        maxImageSize: 16000000, canvasMaxAreaInBytes: 16000000,
        isEvalSupported: false, enableXfa: false, useWasm: false,
      });
      this.doc = await this.loading.promise;
      if (this.doc.numPages > LIMITS.pages) throw new Error('Das PDF enthält mehr als 1000 Seiten.');
      this.count = this.doc.numPages;
      return this;
    } finally { clearTimeout(timer); }
  }
  async render(number, width) {
    const key = `${number}:${Math.round(width / 100) * 100}`;
    if (this.cache.has(key)) { const value = this.cache.get(key); this.cache.delete(key); this.cache.set(key,value); return value; }
    if (this.disposed) throw new Error('Ansicht geschlossen.');
    const page = await this.doc.getPage(number);
    const base = page.getViewport({scale: 1});
    const size = renderDimensions(base.width, base.height, width);
    const viewport = page.getViewport({scale: size.scale});
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    const task = page.render({canvasContext: canvas.getContext('2d', {alpha: false}), viewport});
    this.tasks.add(task);
    try { await task.promise; } finally { this.tasks.delete(task); }
    if (this.disposed) throw new Error('Ansicht geschlossen.');
    const annotations = await page.getAnnotations({intent: 'display'});
    const result = {canvas, viewport, annotations, number};
    this.cache.set(key,result);
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
