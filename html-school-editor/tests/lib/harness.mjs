// Shared helpers for the browser acceptance suite: editor page object, local request sink, fixtures, checks.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sleep } from './cdp.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ARTEFACT = path.join(ROOT, 'dist', 'school-editor.html');
export const TMP = path.join(ROOT, 'tests', 'results', 'tmp');
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures');
export { sleep };

export const PV = 'document.getElementById("pv").contentDocument';
const NO_FSA = 'for (const k of ["showOpenFilePicker", "showSaveFilePicker", "showDirectoryPicker"]) Object.defineProperty(window, k, { value: undefined, configurable: true });';

// Counts every request that actually reaches a local HTTP server.
export async function startSink() {
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.method + ' ' + req.url);
    res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*' });
    res.end('sink');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { hits, origin: 'http://127.0.0.1:' + server.address().port, close: () => new Promise((resolve) => server.close(resolve)) };
}

export function tmpFile(name, content) {
  fs.mkdirSync(TMP, { recursive: true });
  const file = path.join(TMP, name);
  fs.writeFileSync(file, content);
  return file;
}

export const fixture = (name) => path.join(FIXTURES, name);
export const readFixture = (name) => fs.readFileSync(fixture(name), 'utf8');

// Minimal PNG writer for synthetic test images (truecolour, no dependencies).
export function makePng(width, height, noise) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let seed = 12345;
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    for (let x = 0; x < width * 3; x++) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;          // xorshift32: incompressible but repeatable
      raw[row + 1 + x] = noise ? seed & 255 : (x * 7 + y * 3) & 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw, { level: noise ? 1 : 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Collects named checks of one test case.
export class Checks {
  constructor() { this.items = []; }
  ok(condition, label, detail) { this.items.push({ pass: !!condition, label, detail: detail === undefined ? undefined : String(detail).slice(0, 600) }); return !!condition; }
  eq(actual, expected, label) {
    const pass = actual === expected;
    return this.ok(pass, label, pass ? undefined : 'expected ' + JSON.stringify(expected).slice(0, 280) + ' got ' + JSON.stringify(actual).slice(0, 280));
  }
  note(label, detail) { this.items.push({ pass: true, note: true, label, detail: String(detail).slice(0, 900) }); }
  // A part of the case that could not be carried out. It is reported as NOT MEASURED and never counts as passed.
  skip(label, reason) { this.items.push({ pass: true, note: true, notMeasured: true, label, detail: 'NOT MEASURED: ' + String(reason).slice(0, 600) }); }
  get failed() { return this.items.filter((i) => !i.pass); }
}

export class Editor {
  constructor(browser, page) { this.browser = browser; this.page = page; }

  // `noFsa` hides the File System Access pickers before the page starts, like a browser without that API.
  // `artefact`: another copy of the delivered file (a test that needs files next to the editor copies it).
  static async open(browser, { noFsa = false, init = '', offline = false, artefact = ARTEFACT } = {}) {
    const page = await browser.newPage();
    if (offline) await page.setOffline(true);
    if (noFsa) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: NO_FSA });
    if (init) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: init });
    await page.goto(pathToFileURL(artefact).href);
    const ed = new Editor(browser, page);
    await ed.until('document.documentElement.dataset.ready === "yes"', 'editor ready');
    return ed;
  }

  eval(expr) { return this.page.eval(expr); }
  async until(expr, what, timeout = 6000) {
    const t0 = Date.now();
    for (;;) {
      if (await this.page.eval('!!(' + expr + ')')) return;
      if (Date.now() - t0 > timeout) throw new Error('timeout: ' + (what || expr));
      await sleep(25);
    }
  }
  synced() { return this.until('document.documentElement.dataset.sync === "yes"', 'panes in sync'); }
  async settle(ms = 60) { await this.synced(); await sleep(ms); await this.synced(); }
  syncFlag() { return this.eval('document.documentElement.dataset.sync'); }
  source() { return this.eval('document.getElementById("src").value'); }
  body() { return this.eval(PV + '.body.innerHTML'); }
  status() { return this.eval('document.getElementById("msg").textContent'); }
  dirtyText() { return this.eval('document.getElementById("docState").textContent'); }
  errors() {
    return this.page.events.filter((e) => e.method === 'Runtime.exceptionThrown' || (e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && !/Content Security Policy|Refused to|sandboxed/i.test(e.params.entry.text)))
      .map((e) => (e.params.exceptionDetails ? (e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description) || e.params.exceptionDetails.text : e.params.entry.text));
  }

  // Loads a file through the real file input. Over unsaved work the product asks first; a test that simply
  // moves on to its next document answers like a pupil who agrees. The question itself is the subject of T-15
  // and RV-01, which pass `wait: false` and handle the dialog themselves.
  async openFile(file, { wait = true } = {}) {
    await this.page.setFiles('#fileIn', [file]);
    if (!wait) return;
    const opened = 'document.getElementById("docName").textContent === ' + JSON.stringify(path.basename(file));
    await this.until(opened + ' || document.getElementById("dlgConfirm").open', 'file opened or question shown');
    if (await this.dialogOpen('dlgConfirm')) await this.dialogButton('dlgConfirm', 'Änderungen verwerfen');
    await this.until(opened, 'file opened');
    await this.synced();
  }
  // Clicks "Code aufräumen" and waits for the outcome: 'applied', 'tidy' (nothing to do), 'aborted' or
  // 'refused' (with the explanation shown to the pupil; the dialog is closed).
  async format() {
    await this.eval('document.getElementById("msg").textContent = ""');
    await this.click('bFormat');
    await this.until('document.getElementById("dlgInfo").open || /aufgeräumt|abgebrochen/.test(document.getElementById("msg").textContent)', 'formatting finished', 10000);
    if (await this.dialogOpen('dlgInfo')) {
      const text = await this.eval('document.getElementById("infoText").textContent');
      await this.dialogButton('dlgInfo', 'OK');
      return { outcome: 'refused', text };
    }
    const text = await this.status();
    await this.synced();
    return { outcome: text.includes('schon') ? 'tidy' : text.includes('abgebrochen') ? 'aborted' : 'applied', text };
  }
  async openText(name, text) { const file = tmpFile(name, text); await this.openFile(file); return file; }

  click(id) { return this.page.clickOn('document.getElementById(' + JSON.stringify(id) + ')'); }
  dialogOpen(id) { return this.eval('document.getElementById(' + JSON.stringify(id) + ').open'); }
  async dialogButton(id, label) {
    await this.page.clickOn('Array.from(document.getElementById(' + JSON.stringify(id) + ').querySelectorAll("button")).find((b) => b.textContent.trim() === ' + JSON.stringify(label) + ')');
    await sleep(40);
  }

  // Real mouse click on an element of the preview (expression relative to the preview document `d`).
  clickPv(expr, count = 1) { return this.page.clickOn('((d) => ' + expr + ')(' + PV + ')', count); }
  // Places the preview caret or selection through the DOM (the following keystrokes are real key events).
  async caret(textFragment, offsetInFragment = 0, endFragmentOffset = null) {
    const ok = await this.eval(`((d, w) => { const walker = d.createTreeWalker(d.body, 4); let n; const needle = ${JSON.stringify(textFragment)};
      while ((n = walker.nextNode())) { const i = n.data.indexOf(needle); if (i >= 0) { w.focus(); d.body.focus(); const s = d.getSelection();
        const end = ${endFragmentOffset === null ? 'null' : endFragmentOffset};
        if (end === null) s.collapse(n, i + ${offsetInFragment}); else s.setBaseAndExtent(n, i + ${offsetInFragment}, n, i + end); return true; } } return false; })(${PV}, document.getElementById("pv").contentWindow)`);
    if (!ok) throw new Error('text not found in preview: ' + textFragment);
    await sleep(30);
  }
  selectPv(text) { return this.caret(text, 0, text.length); }
  async selectNodes(exprStart, exprEnd) {
    await this.eval(`((d, w) => { w.focus(); const r = d.createRange(); r.setStartBefore(${exprStart}); r.setEndAfter(${exprEnd}); const s = d.getSelection(); s.removeAllRanges(); s.addRange(r); })(${PV}, document.getElementById("pv").contentWindow)`);
    await sleep(30);
  }
  async sourceCaret(needle, delta = 0) {
    const ok = await this.eval(`(() => { const t = document.getElementById("src"); t.focus(); const i = t.value.indexOf(${JSON.stringify(needle)}); if (i < 0) return false; t.setSelectionRange(i + ${delta}, i + ${delta}); return true; })()`);
    if (!ok) throw new Error('text not found in source: ' + needle);
    await sleep(30);
  }
  type(text, delay = 0) { return this.page.type(text, delay); }
  // Replaces the content of a text field of a dialog with real key events.
  async field(id, text) {
    await this.eval(`(() => { const f = document.getElementById(${JSON.stringify(id)}); f.focus(); f.select(); })()`);
    if (text) await this.type(text); else await this.key('Delete');
  }
  // Chooses a file in the open image dialog through its real file input and waits until it was checked.
  async pickImage(file) {
    await this.page.setFiles('#imgIn', [file]);
    await this.until('document.getElementById("imgName").textContent.includes(' + JSON.stringify(path.basename(file)) + ')', 'image accepted', 30000);
  }
  inactiveNote() { return this.eval('document.getElementById("inactive").hidden ? "" : document.getElementById("inactiveText").textContent'); }
  key(name, mods) { return this.page.key(name, mods); }

  // Clicks a button that triggers a real browser download and returns the downloaded bytes.
  async download(buttonId = 'bDownload', trigger = null) {
    const at = this.browser.downloadEvents.length;
    if (trigger) await trigger(); else await this.click(buttonId);
    const done = await this.browser.waitDownload(at);
    for (let i = 0; i < 40 && !fs.existsSync(done.path); i++) await sleep(50);
    const bytes = fs.readFileSync(done.path);
    fs.rmSync(done.path, { force: true });
    return { bytes, text: bytes.toString('utf8'), name: done.name };
  }
  close() { return this.page.close(); }
}
