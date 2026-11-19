// Stock Firefox over WebDriver BiDi, Node standard library only. No user profile is opened.
// The small compatibility surface lets existing Editor/acceptance helpers use real Firefox input.
// Unsupported Chromium-specific automation is an explicit measurement gap, never a simulated success.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export class UnsupportedAutomation extends Error {}
const SPECIAL = { Enter: '\uE007', Backspace: '\uE003', Delete: '\uE017', Tab: '\uE004', Escape: '\uE00C',
  ArrowLeft: '\uE012', ArrowUp: '\uE013', ArrowRight: '\uE014', ArrowDown: '\uE015', End: '\uE010', Home: '\uE011',
  ctrl: '\uE009', shift: '\uE008', alt: '\uE00A', meta: '\uE03D' };

function value(remote) {
  if (remote.type === 'undefined') return undefined;
  if (remote.type === 'null') return null;
  if (remote.type === 'array') return remote.value.map(value);
  if (remote.type === 'object') return Object.fromEntries(remote.value.map(([k, v]) => [typeof k === 'string' ? k : value(k), value(v)]));
  return remote.value;
}

class Connection {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map(); this.listeners = new Set();
    socket.addEventListener('message', event => {
      const msg = JSON.parse(event.data);
      if (msg.id !== undefined) {
        const call = this.pending.get(msg.id); if (!call) return;
        this.pending.delete(msg.id); clearTimeout(call.timer);
        if (msg.type === 'error') call.reject(new Error(call.method + ': ' + msg.error + ': ' + msg.message));
        else call.resolve(msg.result);
      } else for (const fn of this.listeners) fn(msg);
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('BiDi timeout: ' + method)); }, 20000);
      this.pending.set(id, { resolve, reject, timer, method });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
}

class Page {
  constructor(browser, context) {
    this.browser = browser; this.context = context; this.events = []; this.contexts = new Set([context]);
    this.listener = event => {
      const p = event.params;
      if (event.method === 'browsingContext.contextCreated' && this.contexts.has(p.parent)) this.contexts.add(p.context);
      if (!p || (!this.contexts.has(p.context) && !this.contexts.has(p.source?.context))) return;
      if (event.method === 'network.beforeRequestSent') this.events.push({ method: 'Network.requestWillBeSent', params: { request: { url: p.request.url } } });
      if (event.method === 'log.entryAdded') {
        if (p.text?.startsWith('__SE_TEST_CSP__')) {
          const details = JSON.parse(p.text.slice('__SE_TEST_CSP__'.length));
          this.events.push({ method: 'Audits.issueAdded', params: { issue: { details: { contentSecurityPolicyIssueDetails: details } } } });
        } else this.events.push({ method: 'Log.entryAdded', params: { entry: { level: p.level,
          text: String(p.text || '').replace(/Content-Security-Policy/g, 'Content Security Policy'), rawText: p.text } } });
      }
    };
    browser.raw.listeners.add(this.listener);
  }
  async eval(expression) {
    const result = await this.browser.raw.send('script.evaluate', { expression, target: { context: this.context }, awaitPromise: true, userActivation: true });
    if (result.type === 'exception') throw new Error('Firefox page exception: ' + result.exceptionDetails.text);
    return value(result.result);
  }
  async goto(url) {
    await this.browser.raw.send('browsingContext.navigate', { context: this.context, url, wait: 'complete' });
    // Observe genuine policy events from the parent, without changing the projection or resource policy.
    await this.eval(`(() => { const d = document.getElementById('pv')?.contentDocument;
      if (d) d.addEventListener('securitypolicyviolation', e => console.info('__SE_TEST_CSP__' + JSON.stringify({ blockedURL: e.blockedURI })));
    })()`);
  }
  async send(method, params = {}) {
    if (method === 'Page.addScriptToEvaluateOnNewDocument') return this.browser.raw.send('script.addPreloadScript', {
      functionDeclaration: '() => {\n' + params.source + '\n}', contexts: [this.context] });
    if (method === 'Input.dispatchMouseEvent') {
      const mods = params.modifiers || 0;
      const keys = [[2, 'ctrl'], [8, 'shift'], [1, 'alt'], [4, 'meta']].filter(([n]) => mods & n).map(([, k]) => k);
      for (const key of keys) await this.keyAction('keyDown', SPECIAL[key]);
      await this.mouse(params.type, params.x, params.y, params);
      for (const key of keys.reverse()) await this.keyAction('keyUp', SPECIAL[key]);
      return {};
    }
    throw new UnsupportedAutomation(method + ' has no implemented Firefox automation equivalent');
  }
  waitFor(method) { return Promise.reject(new UnsupportedAutomation(method + ' is Chromium-specific')); }
  async setFiles(selector, files) {
    const result = await this.browser.raw.send('script.evaluate', { expression: 'document.querySelector(' + JSON.stringify(selector) + ')',
      target: { context: this.context }, awaitPromise: false });
    if (!result.result?.sharedId) throw new Error('File input not found: ' + selector);
    await this.browser.raw.send('input.setFiles', { context: this.context, element: { sharedId: result.result.sharedId }, files });
  }
  setOffline(offline) { return this.browser.raw.send('emulation.setNetworkConditions', {
    contexts: [this.context], networkConditions: offline ? { type: 'offline' } : null }); }
  async keyAction(type, character) {
    await this.browser.raw.send('input.performActions', { context: this.context, actions: [{ type: 'key', id: 'keyboard', actions: [{ type, value: character }] }] });
  }
  async key(name, mods = []) {
    for (const mod of mods) await this.keyAction('keyDown', SPECIAL[mod]);
    const character = SPECIAL[name] || name;
    await this.keyAction('keyDown', character); await this.keyAction('keyUp', character);
    for (const mod of [...mods].reverse()) await this.keyAction('keyUp', SPECIAL[mod]);
  }
  async type(text, delay = 0) { for (const ch of text) { await this.key(ch === '\n' ? 'Enter' : ch); if (delay) await sleep(delay); } }
  async mouse(type, x, y, extra = {}) {
    const actions = [{ type: 'pointerMove', x: Math.round(x), y: Math.round(y), duration: 0, origin: 'viewport' }];
    const button = extra.button === 'middle' ? 1 : extra.button === 'right' ? 2 : 0;
    if (type === 'mousePressed') actions.push({ type: 'pointerDown', button });
    if (type === 'mouseReleased') actions.push({ type: 'pointerUp', button });
    await this.browser.raw.send('input.performActions', { context: this.context,
      actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }] });
  }
  async click(x, y, count = 1) {
    // One action batch retains Firefox's native click count and produces a real dblclick.
    const actions = [{ type: 'pointerMove', x: Math.round(x), y: Math.round(y), duration: 0, origin: 'viewport' }];
    for (let i = 0; i < count; i++) actions.push({ type: 'pointerDown', button: 0 }, { type: 'pointerUp', button: 0 });
    await this.browser.raw.send('input.performActions', { context: this.context,
      actions: [{ type: 'pointer', id: 'mouse', parameters: { pointerType: 'mouse' }, actions }] });
  }
  async centerOf(expression) {
    return this.eval(`(() => { const el = ${expression}; const r = el.getBoundingClientRect(); let x = r.left + r.width / 2, y = r.top + r.height / 2;
      const fr = el.ownerDocument.defaultView.frameElement;
      if (fr) { const f = fr.getBoundingClientRect(); x += f.left + fr.clientLeft; y += f.top + fr.clientTop; }
      return { x, y }; })()`);
  }
  async clickOn(expression, count = 1) { const p = await this.centerOf(expression); await this.click(p.x, p.y, count); }
  eventsOf(method) { return this.events.filter(e => e.method === method).map(e => e.params); }
  async close() { this.browser.raw.listeners.delete(this.listener); await this.browser.raw.send('browsingContext.close', { context: this.context }); }
}

export async function launchFirefox() {
  const exe = process.env.SE_BROWSER_FIREFOX || 'C:/Program Files/Mozilla Firefox/firefox.exe';
  if (!fs.existsSync(exe)) return null;
  const base = path.resolve(os.tmpdir());
  const profile = fs.mkdtempSync(path.join(base, 'se-firefox-profile-'));
  const downloads = fs.mkdtempSync(path.join(base, 'se-firefox-downloads-'));
  const preferences = {
    'browser.shell.checkDefaultBrowser': false, 'browser.startup.homepage_override.mstone': 'ignore',
    'browser.startup.page': 0, 'browser.startup.homepage': 'about:blank',
    'browser.download.folderList': 2, 'browser.download.dir': downloads, 'browser.download.useDownloadDir': true,
    'browser.download.alwaysOpenPanel': false, 'browser.helperApps.neverAsk.saveToDisk': 'text/html,application/octet-stream',
    'browser.safebrowsing.downloads.enabled': false, 'browser.download.manager.showWhenStarting': false,
    'datareporting.policy.dataSubmissionEnabled': false, 'toolkit.telemetry.enabled': false,
    'app.update.auto': false, 'extensions.update.enabled': false, 'remote.active-protocols': 1,
  };
  fs.writeFileSync(path.join(profile, 'user.js'), Object.entries(preferences).map(([k, v]) => 'user_pref(' + JSON.stringify(k) + ', ' + JSON.stringify(v) + ');').join('\n'));
  const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port; await new Promise(resolve => server.close(resolve));
  const processHandle = spawn(exe, ['--headless', '--no-remote', '--profile', profile, '--remote-debugging-port', String(port), '--width', '1400', '--height', '900', 'about:blank'],
    { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, env: { ...process.env, MOZ_CRASHREPORTER_DISABLE: '1' } });
  let stderr = ''; processHandle.stderr.on('data', chunk => { stderr += chunk.toString(); });
  let socket;
  for (let i = 0; i < 120; i++) {
    try {
      socket = new WebSocket('ws://127.0.0.1:' + port + '/session');
      await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
      break;
    } catch { socket = null; await sleep(100); }
  }
  if (!socket) { processHandle.kill(); throw new Error('Firefox BiDi unavailable: ' + stderr.slice(-400)); }
  const raw = new Connection(socket);
  const session = await raw.send('session.new', { capabilities: { alwaysMatch: { browserName: 'firefox' } } });
  await raw.send('session.subscribe', { events: ['log.entryAdded', 'network.beforeRequestSent', 'browsingContext.contextCreated',
    'browsingContext.downloadWillBegin', 'browsingContext.downloadEnd'] });
  const browser = {
    raw, downloads, downloadEvents: [], version: 'Firefox/' + session.capabilities.browserVersion,
    capabilities: session.capabilities,
    conn: { async send(method) {
      if (method === 'Target.getTargets') {
        const tree = await raw.send('browsingContext.getTree', { maxDepth: 0 });
        return { targetInfos: tree.contexts.map(c => ({ targetId: c.context, url: c.url })) };
      }
      throw new UnsupportedAutomation(method + ' is Chromium-specific');
    } },
    async newPage() { const { context } = await raw.send('browsingContext.create', { type: 'tab' }); return new Page(browser, context); },
    async waitDownload(sinceIndex = 0) {
      for (let i = 0; i < 300; i++) {
        const begin = browser.downloadEvents.slice(sinceIndex).find(e => e.method === 'browsingContext.downloadWillBegin');
        const end = begin && browser.downloadEvents.find(e => e.method === 'browsingContext.downloadEnd' && e.params.download === begin.params.download);
        if (end?.params.status === 'complete') {
          const name = begin.params.suggestedFilename, file = end.params.filepath || path.join(downloads, name);
          if (!path.resolve(file).startsWith(path.resolve(downloads) + path.sep)) throw new Error('Unexpected Firefox download location');
          if (fs.existsSync(file)) return { path: file, name };
        }
        await sleep(40);
      }
      throw new Error('Firefox download did not finish');
    },
    async close() {
      try { await raw.send('browser.close'); } catch { try { await raw.send('session.end'); } catch {} }
      socket.close(); await sleep(500); try { processHandle.kill(); } catch {}
      // Only our freshly created, verified child directories may be removed recursively.
      for (const folder of [profile, downloads]) {
        const resolved = path.resolve(folder);
        if (!resolved.startsWith(base + path.sep) || !path.basename(resolved).startsWith('se-firefox-')) throw new Error('Unexpected Firefox scratch path');
        for (let i = 0; i < 15; i++) { try { fs.rmSync(resolved, { recursive: true, force: true }); break; } catch { await sleep(200); } }
      }
    },
  };
  raw.listeners.add(event => { if (event.method === 'browsingContext.downloadWillBegin' || event.method === 'browsingContext.downloadEnd') browser.downloadEvents.push(event); });
  return browser;
}
