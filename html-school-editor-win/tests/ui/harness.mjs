// Shared helpers of the browser tests: a MOCK of the C++ core (window.chrome.webview is replaced by an object
// that records the messages the interface sends and lets the test deliver the core's answers) and the staged
// user interface. The real core, the page view and the file system are NOT part of these tests.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { stageUi, ROOT } from '../../tools/stage-ui.mjs';

const require = createRequire(import.meta.url);
export const { chromium } = require('playwright');
const stage = stageUi(path.join(ROOT, 'tests', '.stage', 'browser'));

const MOCK_CORE = `
  window.__sent = [];
  window.chrome = { webview: {
    postMessage(m) { window.__sent.push(JSON.parse(JSON.stringify(m))); },
    addEventListener(type, fn) { if (type === 'message') window.__recv = fn; },
  } };
  window.__deliver = (m) => window.__recv({ data: m });
`;

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript' };
export const b64 = (bytes) => Buffer.from(bytes).toString('base64');

export async function openUi(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(MOCK_CORE);
  await page.route('https://app.example/**', (route) => {
    const p = new URL(route.request().url()).pathname;
    const file = path.join(stage, p);
    if (!file.startsWith(stage) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.goto('https://app.example/index.html');
  await page.waitForFunction(() => window.__sent && window.__sent.some((m) => m.type === 'ready'));
  const answered = new Set();
  const ui = {
    page, errors,
    sent: () => page.evaluate(() => window.__sent),
    last: async (type) => (await ui.sent()).filter((m) => m.type === type).pop(),
    count: async (type) => (await ui.sent()).filter((m) => m.type === type).length,
    deliver: (m) => page.evaluate((x) => window.__deliver(x), m),
    // Delivers the core's answer to the last save or save as, with the id of that request.
    // Delivers an `opened` answer: to the last open request not answered yet, else as the page given at
    // program start (op 0).
    opened: async (m) => {
      const req = (await ui.sent()).filter((x) => ['openFile', 'openDialog', 'newPage'].includes(x.type)).pop();
      const op = req && !answered.has(req.op) ? req.op : 0;
      if (op) answered.add(op);
      return ui.deliver({ base: '1-0000000000000000', ...m, op });
    },
    // Delivers the answer to the last picture request (`pickPicture` or `copyPicture`). A chosen picture is
    // followed by the size step (from alpha.20); it is confirmed with empty fields (the picture's own size),
    // unless `keepSizeStep` is set.
    pictureReply: async (m, keepSizeStep = false) => {
      await ui.deliver({ ...m, op: (await ui.sent()).filter((x) => x.type === 'pickPicture' || x.type === 'copyPicture').pop().op });
      if (m.type !== 'picture' || keepSizeStep) return;
      const asked = await page.waitForFunction(() => document.getElementById('dlg').open && document.getElementById('dlgTitle').textContent === 'Bildgröße', null, { timeout: 2000 }).then(() => true, () => false);
      if (asked) await ui.answer('#dlg button[value="ok"]');
    },
    reply: async (m) => ui.deliver({ ...m, id: (await ui.sent()).filter((x) => x.type === 'save' || x.type === 'saveAs').pop().id }),
    text: () => page.evaluate(() => document.getElementById('src').value),
    // Clicks a button of the open dialog and waits until the dialog has closed and its answer was handled.
    answer: async (selector) => {
      await page.click(selector);
      await page.waitForFunction(() => !document.getElementById('dlg').open);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    },
    // Clicks a button of the open dialog when another question waits in line, and waits for that question
    // (by its title). The dialog is closed only for a moment in between, which polling can miss.
    answerThen: async (selector, title) => {
      await page.click(selector);
      await page.waitForFunction((t) => document.getElementById('dlg').open && document.getElementById('dlgTitle').textContent.includes(t), title);
    },
  };
  await ui.deliver({ type: 'init', version: '0.1.0-test' });
  return ui;
}

export const PROJECT = { type: 'project', name: 'projekt', files: [
  { path: 'index.html', kind: 'page' }, { path: 'seiten/tiere.html', kind: 'page' }, { path: 'bilder/katze.png', kind: 'picture' }, { path: 'css/stil.css', kind: 'style' },
] };

export const PAGE = '<!DOCTYPE html>\r\n<html lang="de">\r\n<head>\r\n  <meta charset="utf-8">\r\n  <title>Tiere</title>\r\n</head>\r\n<body>\r\n  <img src="../../weg.png" alt="">\r\n</body>\r\n</html>\r\n';
export const BOM = [0xef, 0xbb, 0xbf];

