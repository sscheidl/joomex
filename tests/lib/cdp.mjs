// Minimal Chrome DevTools Protocol driver for the acceptance suite.
// Needs Node >= 22 (global WebSocket) and an installed Chromium-based browser. No npm dependencies.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PF = process.env['ProgramFiles'] || 'C:/Program Files';
const PF86 = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
const LOCAL = process.env['LOCALAPPDATA'] || '';
const CANDIDATES = {
  edge: [`${PF86}/Microsoft/Edge/Application/msedge.exe`, `${PF}/Microsoft/Edge/Application/msedge.exe`],
  chrome: [`${PF}/Google/Chrome/Application/chrome.exe`, `${PF86}/Google/Chrome/Application/chrome.exe`, `${LOCAL}/Google/Chrome/Application/chrome.exe`],
};

export function findBrowser(name) {
  const override = process.env['SE_BROWSER_' + name.toUpperCase()];
  if (override) return fs.existsSync(override) ? override : null;
  return (CANDIDATES[name] || []).find((p) => p && fs.existsSync(p)) || null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export { sleep };

const KEYS = {
  Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
  Backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
  Delete: { key: 'Delete', code: 'Delete', vk: 46 },
  Tab: { key: 'Tab', code: 'Tab', vk: 9 },
  Escape: { key: 'Escape', code: 'Escape', vk: 27 },
  ArrowLeft: { key: 'ArrowLeft', code: 'ArrowLeft', vk: 37 },
  ArrowUp: { key: 'ArrowUp', code: 'ArrowUp', vk: 38 },
  ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', vk: 39 },
  ArrowDown: { key: 'ArrowDown', code: 'ArrowDown', vk: 40 },
  End: { key: 'End', code: 'End', vk: 35 },
  Home: { key: 'Home', code: 'Home', vk: 36 },
};
const MOD = { alt: 1, ctrl: 2, meta: 4, shift: 8 };

class Connection {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Set();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        for (const h of this.handlers) h(msg);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, method });
      this.ws.send(JSON.stringify(payload));
    });
  }
}

export class Page {
  constructor(conn, sessionId, targetId) {
    this.conn = conn;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.events = [];
    this.waiters = [];
    conn.handlers.add((msg) => {
      if (msg.sessionId !== sessionId) return;
      this.events.push(msg);
      this.waiters = this.waiters.filter((w) => {
        if (w.method === msg.method && (!w.test || w.test(msg.params))) { w.resolve(msg.params); return false; }
        return true;
      });
    });
  }
  send(method, params) { return this.conn.send(method, params, this.sessionId); }
  waitFor(method, test, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const w = { method, test, resolve };
      this.waiters.push(w);
      setTimeout(() => { this.waiters = this.waiters.filter((x) => x !== w); reject(new Error('timeout waiting for ' + method)); }, timeout);
    });
  }
  async goto(url) {
    const loaded = this.waitFor('Page.loadEventFired');
    await this.send('Page.navigate', { url });
    await loaded;
  }
  // Evaluate an expression in the top document; returns the JSON value. Throws on page exceptions.
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('page exception: ' + (d.exception && d.exception.description || d.text));
    }
    return r.result.value;
  }
  async key(name, mods = []) {
    const k = KEYS[name] || { key: name, code: 'Key' + name.toUpperCase(), vk: name.toUpperCase().charCodeAt(0) };
    const modifiers = mods.reduce((m, x) => m | MOD[x], 0);
    const base = { key: k.key, code: k.code, windowsVirtualKeyCode: k.vk, nativeVirtualKeyCode: k.vk, modifiers };
    const plain = k.text && (modifiers === 0 || modifiers === MOD.shift);
    const down = { ...base, type: plain ? 'keyDown' : 'rawKeyDown' };
    if (plain) down.text = k.text;
    await this.send('Input.dispatchKeyEvent', down);
    await this.send('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
  }
  // Types printable characters as real key events (keydown with text → beforeinput/input).
  async type(text, delay = 0) {
    for (const ch of text) {
      if (ch === '\n') { await this.key('Enter'); }
      else {
        await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
        await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      }
      if (delay) await sleep(delay);
    }
  }
  async mouse(type, x, y, extra = {}) {
    await this.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
  }
  async click(x, y, clickCount = 1) {
    await this.mouse('mouseMoved', x, y, { button: 'none' });
    for (let i = 1; i <= clickCount; i++) {
      await this.mouse('mousePressed', x, y, { clickCount: i });
      await this.mouse('mouseReleased', x, y, { clickCount: i });
    }
  }
  async drag(x1, y1, x2, y2) {
    await this.mouse('mouseMoved', x1, y1, { button: 'none' });
    await this.mouse('mousePressed', x1, y1);
    await this.mouse('mouseMoved', (x1 + x2) / 2, (y1 + y2) / 2);
    await this.mouse('mouseMoved', x2, y2);
    await this.mouse('mouseReleased', x2, y2);
  }
  // Centre of an element in top-level viewport coordinates. `expr` evaluates to an Element (may live in the preview frame).
  async centerOf(expr) {
    return this.eval(`(() => { const el = ${expr}; const r = el.getBoundingClientRect(); let x = r.left + r.width / 2, y = r.top + r.height / 2;
      const fr = el.ownerDocument.defaultView.frameElement; if (fr) { const f = fr.getBoundingClientRect(); x += f.left + fr.clientLeft; y += f.top + fr.clientTop; }
      return { x, y }; })()`);
  }
  async clickOn(expr, clickCount = 1) { const p = await this.centerOf(expr); await this.click(p.x, p.y, clickCount); }
  async setFiles(selector, files) {
    const r = await this.send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(selector)})` });
    await this.send('DOM.setFileInputFiles', { objectId: r.result.objectId, files });
  }
  async setOffline(offline) {
    await this.send('Network.emulateNetworkConditions', { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  eventsOf(method) { return this.events.filter((e) => e.method === method).map((e) => e.params); }
  async close() { await this.conn.send('Target.closeTarget', { targetId: this.targetId }); }
}

export async function launch(name, { headless = true } = {}) {
  const exe = findBrowser(name);
  if (!exe) return null;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'se-profile-'));
  const downloads = fs.mkdtempSync(path.join(os.tmpdir(), 'se-downloads-'));
  const args = ['--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-sync', '--disable-component-update', '--window-size=1400,900'];
  if (headless) args.push('--headless=new');
  args.push('about:blank');
  const proc = spawn(exe, args, { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 300 && !fs.existsSync(portFile); i++) await sleep(50);
  if (!fs.existsSync(portFile)) { proc.kill(); throw new Error('browser did not expose a DevTools port'); }
  let lines = [];
  for (let i = 0; i < 40 && lines.length < 2; i++) { lines = fs.readFileSync(portFile, 'utf8').trim().split('\n'); if (lines.length < 2) await sleep(50); }
  const ws = new WebSocket(`ws://127.0.0.1:${lines[0]}${lines[1]}`);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', () => reject(new Error('DevTools socket failed'))); });
  const conn = new Connection(ws);
  const version = await conn.send('Browser.getVersion');
  const downloadEvents = [];
  conn.handlers.add((m) => { if (m.method && m.method.startsWith('Browser.download')) downloadEvents.push(m); });
  await conn.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads, eventsEnabled: true });
  return {
    name, exe, version: version.product, userAgent: version.userAgent, downloads, downloadEvents, conn,
    async newPage() {
      const { targetId } = await conn.send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true });
      const page = new Page(conn, sessionId, targetId);
      await page.send('Page.enable');
      await page.send('Runtime.enable');
      await page.send('Network.enable');
      await page.send('Audits.enable');
      await page.send('Log.enable');
      return page;
    },
    // Resolves with the path of the next completed download.
    async waitDownload(sinceIndex, timeout = 10000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeout) {
        const done = downloadEvents.slice(sinceIndex).find((m) => m.method === 'Browser.downloadProgress' && m.params.state === 'completed');
        if (done) {
          const begin = downloadEvents.find((m) => m.method === 'Browser.downloadWillBegin' && m.params.guid === done.params.guid);
          return { path: path.join(downloads, begin ? begin.params.suggestedFilename : done.params.guid), name: begin && begin.params.suggestedFilename };
        }
        await sleep(40);
      }
      throw new Error('timeout waiting for download');
    },
    async close() {
      try { await conn.send('Browser.close'); } catch (e) { /* already gone */ }
      await sleep(300);
      try { proc.kill(); } catch (e) { /* ignore */ }
      for (const dir of [profile, downloads]) {
        for (let i = 0; i < 10; i++) { try { fs.rmSync(dir, { recursive: true, force: true }); break; } catch (e) { await sleep(200); } }
      }
    },
  };
}
