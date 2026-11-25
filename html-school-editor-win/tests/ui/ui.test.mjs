// Browser tests of the user interface in Chromium (the engine of WebView2), with a MOCK of the C++ core:
// window.chrome.webview is replaced by an object that records the messages the interface sends and lets the
// test deliver the core's answers. The real core, the page view and the file system are NOT part of these
// tests. Run: node --test tests/ui/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { stageUi, ROOT } from '../../tools/stage-ui.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
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
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

async function openUi(browser) {
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
    // Delivers the answer to the last picture request (`pickPicture` or `copyPicture`).
    pictureReply: async (m) => ui.deliver({ ...m, op: (await ui.sent()).filter((x) => x.type === 'pickPicture' || x.type === 'copyPicture').pop().op }),
    reply: async (m) => ui.deliver({ ...m, id: (await ui.sent()).filter((x) => x.type === 'save' || x.type === 'saveAs').pop().id }),
    text: () => page.evaluate(() => document.getElementById('src').value),
    // Clicks a button of the open dialog and waits until the dialog has closed and its answer was handled.
    answer: async (selector) => {
      await page.click(selector);
      await page.waitForFunction(() => !document.getElementById('dlg').open);
      await page.evaluate(() => new Promise((r) => setTimeout(r, 0)));
    },
  };
  await ui.deliver({ type: 'init', version: '0.1.0-test' });
  return ui;
}

const PROJECT = { type: 'project', name: 'projekt', files: [
  { path: 'index.html', kind: 'page' }, { path: 'seiten/tiere.html', kind: 'page' }, { path: 'bilder/katze.png', kind: 'picture' }, { path: 'css/stil.css', kind: 'style' },
] };

const PAGE = '<!DOCTYPE html>\r\n<html lang="de">\r\n<head>\r\n  <meta charset="utf-8">\r\n  <title>Tiere</title>\r\n</head>\r\n<body>\r\n  <img src="../../weg.png" alt="">\r\n</body>\r\n</html>\r\n';
const BOM = [0xef, 0xbb, 0xbf];

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

test('start, project list, opening a page with BOM and CRLF, notes, page view layout', async () => {
  const ui = await openUi(browser);
  const first = await ui.last('layout');
  assert.equal(first.visible, false, 'no page view without a page');
  await ui.deliver(PROJECT);
  assert.equal(await ui.page.locator('#files li.page').count(), 2);
  assert.equal(await ui.page.isEnabled('#bNew'), true);
  await ui.page.click('#files li[data-path="seiten/tiere.html"]');
  assert.equal((await ui.last('openFile')).path, 'seiten/tiere.html');
  await ui.opened({ type: 'opened', path: 'seiten/tiere.html', name: 'tiere.html', data: b64([...BOM, ...Buffer.from(PAGE)]) });
  assert.equal(await ui.text(), PAGE.replace(/\r\n/g, '\n'), 'text with LF inside the editor');
  const pv = await ui.last('preview');
  assert.equal(pv.path, 'seiten/tiere.html');
  assert.equal(pv.text, PAGE.replace(/\r\n/g, '\n'));
  await ui.page.waitForFunction(() => !document.getElementById('notes').hidden);
  assert.match(await ui.page.textContent('#bNotes'), /1 Hinweis/);
  await ui.page.click('#bNotes');
  assert.match(await ui.page.textContent('#noteList'), /\.\.\/\.\.\/weg\.png.*aus deinem Projektordner hinaus/s);
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'layout').pop().visible === true);
  const lay = await ui.last('layout');
  assert.ok(lay.w > 200 && lay.h > 200, 'page view has a size');
  assert.equal(await ui.page.textContent('#docState'), 'gespeichert');
  assert.deepEqual(ui.errors, []);
});

test('typing, preview after a pause, saving keeps BOM and CRLF, undo', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64([...BOM, ...Buffer.from(PAGE)]) });
  const before = await ui.count('preview');
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('<!-- neu -->');
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert');
  await ui.page.waitForFunction((n) => window.__sent.filter((m) => m.type === 'preview').length > n, before);
  assert.ok((await ui.last('preview')).text.endsWith('<!-- neu -->'));
  await ui.page.keyboard.press('Control+s');
  const s = await ui.last('save');
  assert.equal(s.path, 'index.html');
  assert.ok(s.text.startsWith('﻿<!DOCTYPE html>\r\n'), 'BOM and CRLF restored');
  assert.ok(s.text.endsWith('</html>\r\n<!-- neu -->'));
  assert.equal(await ui.page.textContent('#docState'), 'wird gespeichert …');
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.equal(await ui.page.textContent('#docState'), 'gespeichert');
  await ui.page.keyboard.press('Control+z');
  assert.equal(await ui.text(), PAGE.replace(/\r\n/g, '\n'), 'undo');
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert');
  await ui.page.keyboard.press('Control+y');
  assert.ok((await ui.text()).endsWith('<!-- neu -->'), 'redo');
  assert.deepEqual(ui.errors, []);
});

test('Enter keeps the indentation, Tab inserts two spaces', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<ul>\n    <li>a</li>\n</ul>\n')) });
  await ui.page.click('#src');
  await ui.page.evaluate(() => { const t = document.getElementById('src'); const i = t.value.indexOf('</li>') + 5; t.setSelectionRange(i, i); });
  await ui.page.keyboard.press('Enter');
  await ui.page.keyboard.type('<li>b</li>');
  assert.equal(await ui.text(), '<ul>\n    <li>a</li>\n    <li>b</li>\n</ul>\n');
  await ui.page.keyboard.press('Tab');
  assert.equal(await ui.text(), '<ul>\n    <li>a</li>\n    <li>b</li>  \n</ul>\n');
});

test('conflict: nothing overwritten, the page view is hidden while the dialog is open, save as offered', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from(PAGE)) });
  await ui.page.click('#src');
  await ui.page.keyboard.type('x');
  await ui.page.click('#bSave');
  await ui.reply({ type: 'conflict', path: 'index.html', kind: 'changed' });
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgBody'), /anderen Programm oder Fenster geändert/);
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'layout').pop().visible === false);
  await ui.answer('dialog button.primary');
  const sa = await ui.last('saveAs');
  assert.ok(sa && sa.text.includes('x'), 'save as sent');
  await ui.reply({ type: 'saved', path: 'neu.html', name: 'neu.html' });
  assert.equal(await ui.page.textContent('#docName'), 'neu.html');
  assert.equal((await ui.last('preview')).path, 'neu.html', 'page view follows the new file');
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'layout').pop().visible === true);
});

test('picture: inserted at the caret, caret inside alt; picture outside the project offers a copy', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'seiten/tiere.html', name: 'tiere.html', data: b64(Buffer.from('<p></p>')) });
  await ui.page.click('#src');
  await ui.page.evaluate(() => document.getElementById('src').setSelectionRange(3, 3));
  await ui.page.click('#bPicture');
  assert.equal((await ui.last('pickPicture')).page, 'seiten/tiere.html');
  await ui.pictureReply({ type: 'picture', src: '../bilder/Meine%20Katze & Hund.png' });
  assert.equal(await ui.text(), '<p><img src="../bilder/Meine%20Katze &amp; Hund.png" alt=""></p>');
  await ui.page.keyboard.type('Katze');
  assert.equal(await ui.text(), '<p><img src="../bilder/Meine%20Katze &amp; Hund.png" alt="Katze"></p>');
  await ui.pictureReply({ type: 'pictureOutside', name: 'urlaub.jpg', token: 't1' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button.primary');
  const copy = await ui.last('copyPicture');
  assert.equal(copy.token, 't1');
  assert.equal(copy.page, 'seiten/tiere.html');
  assert.equal(copy.op, (await ui.last('pickPicture')).op, 'the copy answers the same picture request');
});

test('missing files and case differences reported by the core are shown', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<img src="Katze.png"><img src="fehlt.png">')) });
  await ui.deliver({ type: 'missing', path: 'index.html', items: [{ address: 'Katze.png', reason: 'case', actual: 'katze.png' }, { address: 'fehlt.png', reason: 'notFound' }] });
  await ui.page.click('#bNotes');
  const t = await ui.page.textContent('#noteList');
  assert.match(t, /Katze\.png.*„katze\.png“/s);
  assert.match(t, /fehlt\.png gibt es nicht/);
  await ui.deliver({ type: 'missing', path: 'andere.html', items: [{ address: 'x.png', reason: 'notFound' }] });
  assert.doesNotMatch(await ui.page.textContent('#noteList'), /x\.png/, 'reports for another page are ignored');
});

test('closing with unsaved changes asks; viewing in the browser saves first', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<p>a</p>')) });
  await ui.deliver({ type: 'closeRequest' });
  assert.equal(await ui.count('closeOk'), 1, 'saved page closes at once');
  await ui.page.click('#src');
  await ui.page.keyboard.type('b');
  await ui.page.click('#bBrowser');
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button.primary');
  assert.ok(await ui.last('save'));
  assert.equal(await ui.count('viewInBrowser'), 0, 'not before the save');
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.deepEqual(await ui.last('viewInBrowser'), { type: 'viewInBrowser', path: 'index.html' });
  await ui.page.click('#src');
  await ui.page.keyboard.type('c');
  await ui.deliver({ type: 'closeRequest' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button[value="discard"]');
  assert.equal(await ui.count('closeOk'), 2);
});

// Review of stage 1 (2026-11-24), finding 1: the answer to a save that left before the last typing closed
// the window and lost that typing.
test('closing: text typed while the save is on its way is not lost', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<p>a</p>')) });
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('b');
  await ui.deliver({ type: 'closeRequest' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button[value="save"]');
  const first = await ui.last('save');
  assert.ok(first.text.endsWith('</p>b'));
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('c');
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.equal(await ui.count('closeOk'), 0, 'the window stays open: "c" is not saved yet');
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert');
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgBody'), /schließt/, 'asked again');
  await ui.answer('dialog button[value="save"]');
  const second = await ui.last('save');
  assert.notEqual(second.id, first.id);
  assert.ok(second.text.endsWith('</p>bc'), 'the second save holds the new text');
  assert.equal(await ui.count('closeOk'), 0);
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.equal(await ui.count('closeOk'), 1, 'closes once everything is saved');

  // a close request while a save of Ctrl+S is still on its way waits for its answer instead of asking
  await ui.page.click('#src');
  await ui.page.keyboard.type('d');
  await ui.page.keyboard.press('Control+s');
  await ui.deliver({ type: 'closeRequest' });
  assert.equal(await ui.page.locator('dialog[open]').count(), 0, 'no question while saving');
  assert.equal(await ui.count('closeOk'), 1);
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.equal(await ui.count('closeOk'), 2);

  // a failed save keeps the window open
  await ui.page.click('#src');
  await ui.page.keyboard.type('e');
  await ui.deliver({ type: 'closeRequest' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button[value="save"]');
  await ui.reply({ type: 'saveFailed', message: 'Der Datenträger ist voll.' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button.primary');
  assert.equal(await ui.count('closeOk'), 2, 'not closed after a failed save');
  assert.ok((await ui.text()).endsWith('de'), 'the text is still in the editor');
  assert.deepEqual(ui.errors, []);
});

// Review of stage 1 (2026-11-24), finding 2: the answer to the save of page A arrived while page B was
// open and gave B's text the name of A.
test('switching pages: an answer to the save of another page never touches the page open now', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('A')) });
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('1');
  await ui.page.keyboard.press('Control+s');
  const saveA = await ui.last('save');
  await ui.page.click('#files li[data-path="seiten/tiere.html"]');
  assert.equal(await ui.page.locator('dialog[open]').count(), 0, 'no question while saving');
  assert.equal(await ui.count('openFile'), 0, 'the other page waits for the answer');
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.equal((await ui.last('openFile')).path, 'seiten/tiere.html');
  await ui.opened({ type: 'opened', path: 'seiten/tiere.html', name: 'tiere.html', data: b64(Buffer.from('B')) });
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('2');
  // a late or repeated answer to the save of A
  await ui.deliver({ type: 'saved', id: saveA.id, path: 'index.html' });
  assert.equal(await ui.page.textContent('#docName'), 'seiten/tiere.html', 'B keeps its name');
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert', 'B is not marked saved');
  await ui.page.keyboard.press('Control+s');
  const saveB = await ui.last('save');
  assert.equal(saveB.path, 'seiten/tiere.html');
  assert.equal(saveB.text, 'B2');

  // a new project folder while the save of B is on its way; its answer must not reach the next page
  await ui.deliver({ type: 'projectChanged', name: 'anderes' });
  await ui.deliver({ type: 'project', name: 'anderes', files: [{ path: 'a.html', kind: 'page' }] });
  await ui.opened({ type: 'opened', path: 'a.html', name: 'a.html', data: b64(Buffer.from('C')) });
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('3');
  await ui.page.keyboard.press('Control+s');
  const saveC = await ui.last('save');
  await ui.deliver({ type: 'saved', id: saveB.id, path: 'seiten/tiere.html' });
  await ui.deliver({ type: 'saveFailed', id: saveB.id, message: 'alt' });
  assert.equal(await ui.page.textContent('#docName'), 'a.html');
  assert.equal(await ui.page.textContent('#docState'), 'wird gespeichert …', 'still waiting for its own answer');
  assert.equal(await ui.page.locator('dialog[open]').count(), 0, 'no message about the old save');
  await ui.deliver({ type: 'saved', id: saveC.id, path: 'a.html' });
  assert.equal(await ui.page.textContent('#docState'), 'gespeichert');
  assert.deepEqual(ui.errors, []);
});

// Review of stage 1 (2026-11-25): open and new-page answers could arrive in another order, replace text
// typed after the request or bring a page of an older request.
test('opening: only the answer to the latest request is taken; the code field is locked meanwhile', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<p>a</p>')) });
  await ui.page.click('#files li[data-path="seiten/tiere.html"]');
  const first = await ui.last('openFile');
  assert.ok(first.op > 0);
  assert.equal(await ui.page.evaluate(() => document.getElementById('src').readOnly), true, 'locked while the page is on its way');
  await ui.page.click('#src');
  await ui.page.keyboard.type('x');
  assert.equal(await ui.text(), '<p>a</p>', 'nothing typed that the answer would replace');
  await ui.page.click('#bOpen');
  const second = await ui.last('openDialog');
  assert.ok(second.op > first.op);
  // the slow answer to the first request arrives last but one: not taken
  await ui.deliver({ type: 'opened', op: first.op, path: 'seiten/tiere.html', name: 'tiere.html', base: '1-0000000000000000', data: b64(Buffer.from('ALT')) });
  assert.equal(await ui.page.textContent('#docName'), 'index.html');
  await ui.deliver({ type: 'openFailed', op: first.op, title: 'alt', message: 'alt' });
  assert.equal(await ui.page.locator('dialog[open]').count(), 0, 'no message about an older request');
  assert.equal(await ui.page.evaluate(() => document.getElementById('src').readOnly), true, 'still waiting for the latest');
  await ui.deliver({ type: 'opened', op: second.op, path: 'neu.html', name: 'neu.html', base: '3-0000000000000000', data: b64(Buffer.from('NEU')) });
  assert.equal(await ui.page.textContent('#docName'), 'neu.html');
  assert.equal(await ui.text(), 'NEU');
  assert.equal(await ui.page.evaluate(() => document.getElementById('src').readOnly), false);
  // a repeated answer to the same request does not open the page again over new typing
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('!');
  await ui.deliver({ type: 'opened', op: second.op, path: 'neu.html', name: 'neu.html', base: '3-0000000000000000', data: b64(Buffer.from('NEU')) });
  assert.equal(await ui.text(), 'NEU!');
  // a failure of the latest request unlocks and is told
  await ui.page.click('#files li[data-path="index.html"]');
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button[value="discard"]');
  const third = await ui.last('openFile');
  await ui.deliver({ type: 'openFailed', op: third.op, title: 'Die Seite kann nicht geöffnet werden', message: 'Die Verbindung zum Netzlaufwerk ist unterbrochen.' });
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgBody'), /Netzlaufwerk/);
  await ui.answer('dialog button.primary');
  assert.equal(await ui.page.evaluate(() => document.getElementById('src').readOnly), false);
  assert.equal(await ui.text(), 'NEU!', 'the open page stays');
  // a page given at program start (op 0) is not taken once a page is open
  await ui.deliver({ type: 'opened', op: 0, path: 'index.html', name: 'index.html', base: '1-0000000000000000', data: b64(Buffer.from('START')) });
  assert.equal(await ui.text(), 'NEU!');
  assert.deepEqual(ui.errors, []);
});

test('saving: the base of the open page goes with every save; out of a conflict only a new file', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', base: '8-00000000000000b1', data: b64(Buffer.from('<p>a</p>')) });
  await ui.page.click('#src');
  await ui.page.keyboard.type('1');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).base, '8-00000000000000b1');
  await ui.reply({ type: 'saved', path: 'index.html', base: '9-00000000000000b2' });
  await ui.page.keyboard.type('2');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).base, '9-00000000000000b2', 'the base of the last save');
  assert.equal((await ui.last('save')).createOnly, undefined);
  await ui.reply({ type: 'conflict', path: 'index.html', kind: 'changed' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button.primary');
  assert.equal((await ui.last('saveAs')).createOnly, true, 'the way out of a conflict never replaces a file');
  await ui.reply({ type: 'saveCancelled' });
  await ui.page.click('#bSaveAs');
  assert.equal((await ui.last('saveAs')).createOnly, undefined, 'an ordinary save as may replace after the question of the dialog');
  await ui.reply({ type: 'saveCancelled' });
  // larger than the editor can open again: not sent
  const saves = await ui.count('save');
  await ui.page.evaluate(() => { const s = document.getElementById('src'); s.value = 'x'.repeat(5 * 1024 * 1024 + 1); s.dispatchEvent(new Event('input', { bubbles: true })); });
  await ui.page.click('#bSave');
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgTitle'), /zu groß/);
  await ui.answer('dialog button.primary');
  assert.equal(await ui.count('save'), saves);
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert');
  assert.deepEqual(ui.errors, []);
});

test('pictures: an answer for a page that is no longer open is not inserted', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<p></p>')) });
  await ui.page.click('#bPicture');
  const pick = await ui.last('pickPicture');
  await ui.page.click('#files li[data-path="seiten/tiere.html"]');
  await ui.opened({ type: 'opened', path: 'seiten/tiere.html', name: 'tiere.html', data: b64(Buffer.from('<p>B</p>')) });
  await ui.deliver({ type: 'picture', op: pick.op, src: 'bilder/katze.png' });
  await ui.deliver({ type: 'pictureOutside', op: pick.op, name: 'x.png', token: 't' });
  assert.equal(await ui.text(), '<p>B</p>');
  assert.equal(await ui.page.locator('dialog[open]').count(), 0);
  assert.deepEqual(ui.errors, []);
});

test('a page in Windows-1252 is converted only after asking', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'alt.html', name: 'alt.html', data: b64([0x3c, 0x70, 0x3e, 0xe4, 0x3c, 0x2f, 0x70, 0x3e]) });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button.primary');
  assert.equal(await ui.text(), '<p>ä</p>');
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert');
});

test('new page: spaces refused, skeleton with CRLF sent', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.page.click('#bNew');
  await ui.page.fill('#npName', 'meine katze');
  await ui.page.click('dialog button.primary');
  await ui.page.waitForFunction(() => document.getElementById('dlg').open && /Leerzeichen/.test(document.querySelector('#dlgBody .err').textContent));
  await ui.page.fill('#npName', 'meine-katze');
  await ui.page.selectOption('#npFolder', 'seiten');
  await ui.answer('dialog button.primary');
  const n = await ui.last('newPage');
  assert.equal(n.path, 'seiten/meine-katze.html');
  assert.ok(n.text.startsWith('<!DOCTYPE html>\r\n<html lang="de">'));
  assert.match(n.text, /<title>meine katze<\/title>/);
});

test('search finds without case and counts', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<p>Katze</p>\n<p>katze</p>\n<p>Hund</p>')) });
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+f');
  await ui.page.keyboard.type('KATZE');
  assert.equal(await ui.page.textContent('#findCount'), '1 von 2');
  await ui.page.keyboard.press('Enter');
  assert.equal(await ui.page.textContent('#findCount'), '2 von 2');
  const sel = await ui.page.evaluate(() => { const t = document.getElementById('src'); return [t.selectionStart, t.selectionEnd]; });
  assert.deepEqual(sel, [16, 21]);
  await ui.page.keyboard.press('Escape');
  assert.equal(await ui.page.isHidden('#findBar'), true);
});

test('a new project folder closes the open page; shortcuts from the page view reach the interface', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<p>a</p>')) });
  await ui.page.click('#src');
  await ui.page.keyboard.type('b');
  await ui.deliver({ type: 'shortcut', key: 'save' });
  assert.ok((await ui.last('save')).text.includes('<p>a</p>b'));
  await ui.reply({ type: 'saved', path: 'index.html' });
  await ui.deliver({ type: 'projectChanged', name: 'anderes' });
  assert.equal(await ui.text(), '');
  assert.equal(await ui.page.textContent('#docName'), '');
  assert.equal(await ui.page.textContent('#projectName'), 'anderes');
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'layout').pop().visible === false);
  await ui.deliver({ type: 'missing', path: 'index.html', items: [{ address: 'x.png', reason: 'error', message: 'Die Verbindung zum Netzlaufwerk ist unterbrochen.' }] });
  assert.equal(await ui.page.isHidden('#notes'), true, 'no page, no notes');
});
