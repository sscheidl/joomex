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
  await ui.page.waitForSelector('#visualFrame', { state: 'visible' });
  assert.equal((await ui.last('layout')).visible, false, 'native page view yields to the visual editor');
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

test('the core learns when text could be lost and whether a page is open (logging off asks first)', async () => {
  const ui = await openUi(browser);
  const state = async () => { const m = await ui.last('unsaved'); return m && [m.value, m.open]; };
  assert.deepEqual(await state(), [false, false], 'no page at start');
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from(PAGE)) });
  assert.deepEqual(await state(), [false, true], 'a page as it is on disk');
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('x');
  assert.deepEqual(await state(), [true, true], 'typing reports unsaved text');
  const n = await ui.count('unsaved');
  await ui.page.keyboard.press('Control+s');
  await ui.page.keyboard.type('y');
  assert.equal(await ui.count('unsaved'), n, 'a save on its way and later typing stay unsaved');
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.deepEqual(await state(), [true, true], 'text typed during the save is still unsaved');
  await ui.page.keyboard.press('Control+s');
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.deepEqual(await state(), [false, true], 'saved without later typing');
  await ui.page.keyboard.type('z');
  assert.deepEqual(await state(), [true, true]);
  await ui.deliver({ type: 'projectChanged', name: 'anderes' });
  assert.deepEqual(await state(), [false, false], 'no page open');
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
  await ui.page.locator('#src').evaluate((field) => {
    const caret = field.value.indexOf('</title>');
    field.setSelectionRange(caret, caret);
  });
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
  await ui.page.waitForSelector('#visualFrame', { state: 'visible' });
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
  await ui.deliver({ type: 'dialogDone' });  // the core after every save dialog
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

// Owner's decision of 2026-11-25 (F-01): open and save without a change keeps the file byte for byte,
// BOM and mixed LF, CRLF and CR included; a change keeps the breaks of the lines it does not touch.
test('line breaks: mixed LF, CRLF and CR are saved byte for byte as they were read', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  const RAW = '<!DOCTYPE html>\r\n<p>eins</p>\n<p>zwei</p>\r<p>drei</p>\r\n\r\n<p>vier</p>\n';
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64([...BOM, ...Buffer.from(RAW)]) });
  assert.equal(await ui.page.locator('#status.warn').count(), 0, 'no warning about mixed line endings any more');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).text, '\ufeff' + RAW, 'unchanged: the same bytes');
  await ui.reply({ type: 'saved', path: 'index.html' });
  // typing in the line that ends with a lone CR
  await ui.page.click('#src');
  await ui.page.evaluate(() => { const s = document.getElementById('src'); const i = s.value.indexOf('zwei') + 4; s.setSelectionRange(i, i); });
  await ui.page.keyboard.type('!');
  await ui.page.keyboard.press('Control+s');
  let expected = RAW.replace('zwei', 'zwei!');
  assert.equal((await ui.last('save')).text, '\ufeff' + expected);
  await ui.reply({ type: 'saved', path: 'index.html' });
  // Enter in that line: the new break is a CR as well; the other lines keep theirs
  await ui.page.keyboard.press('ArrowLeft');
  await ui.page.keyboard.press('Enter');
  await ui.page.keyboard.press('Control+s');
  expected = RAW.replace('zwei', 'zwei\r!');
  assert.equal((await ui.last('save')).text, '\ufeff' + expected);
  await ui.reply({ type: 'saved', path: 'index.html' });
  // deleting the last line and undoing it gives the saved bytes again
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.press('Shift+ArrowUp');
  await ui.page.keyboard.press('Delete');
  await ui.page.keyboard.press('Control+z');
  assert.equal(await ui.page.textContent('#docState'), 'gespeichert');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).text, '\ufeff' + expected);
  assert.deepEqual(ui.errors, []);
});

// Review of alpha.4 (2026-11-25): each undo step and each save on its way needs its own line breaks.
test('line breaks: undo to an unsaved step and a late save confirmation keep a lone CR', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  const RAW = 'eins\r\nzwei\rdrei\nvier';
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from(RAW)) });
  const caretAfter = (word) => ui.page.evaluate((w) => { const s = document.getElementById('src'); s.focus(); const i = s.value.indexOf(w) + w.length; s.setSelectionRange(i, i); }, word);
  // an unsaved step, a new step that deletes the lone CR, undo to the unsaved step
  await ui.page.click('#src');
  await caretAfter('eins');
  await ui.page.keyboard.type('1');
  await ui.page.waitForTimeout(1100);                 // the next keystroke starts a new undo step
  await caretAfter('zwei');
  await ui.page.keyboard.press('Delete');
  assert.equal(await ui.text(), 'eins1\nzweidrei\nvier');
  await ui.page.keyboard.press('Control+z');
  assert.equal(await ui.text(), 'eins1\nzwei\ndrei\nvier');
  await ui.page.keyboard.press('Control+s');
  const sent = (await ui.last('save')).text;
  assert.equal(sent, 'eins1\r\nzwei\rdrei\nvier', 'the undo step has its CR again');
  // the save is on its way; the lone CR is deleted meanwhile; then the confirmation arrives
  await caretAfter('zwei');
  await ui.page.keyboard.press('Delete');
  await ui.reply({ type: 'saved', path: 'index.html' });
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).text, 'eins1\r\nzweidrei\nvier', 'typed on: only the deleted break is missing');
  await ui.reply({ type: 'saved', path: 'index.html' });
  // undo back to the first saved state, and Enter typed back by hand: both give the bytes of that save
  await ui.page.keyboard.press('Control+z');
  assert.equal(await ui.text(), 'eins1\nzwei\ndrei\nvier');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).text, sent);
  await ui.reply({ type: 'saved', path: 'index.html' });
  await caretAfter('zwei');
  await ui.page.keyboard.press('Delete');
  await ui.page.keyboard.press('Enter');
  assert.equal(await ui.page.textContent('#docState'), 'gespeichert', 'the same bytes as saved');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).text, sent);
  assert.deepEqual(ui.errors, []);
});

// Review of alpha.5 (2026-11-25): a<CR>b<LF>c with "b" deleted was saved as a<CRLF>c, one line less.
test('line breaks: two breaks that meet after a deletion are saved as two', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('a\rb\nc')) });
  await ui.page.click('#src');
  await ui.page.evaluate(() => { const s = document.getElementById('src'); s.focus(); s.setSelectionRange(2, 3); });
  await ui.page.keyboard.press('Delete');
  assert.equal(await ui.text(), 'a\n\nc');
  await ui.page.keyboard.press('Control+z');
  await ui.page.keyboard.press('Control+y');
  assert.equal(await ui.text(), 'a\n\nc', 'redo keeps the empty line');
  await ui.page.keyboard.press('Control+s');
  const sent = (await ui.last('save')).text;
  assert.equal(sent, 'a\r\r\nc');
  await ui.reply({ type: 'saved', path: 'index.html' });
  // opened again from these bytes: the same three lines, and unchanged
  await ui.page.click('#files li[data-path="seiten/tiere.html"]');
  await ui.opened({ type: 'opened', path: 'seiten/tiere.html', name: 'tiere.html', data: b64(Buffer.from(sent)) });
  assert.equal(await ui.text(), 'a\n\nc');
  await ui.page.keyboard.press('Control+s');
  assert.equal((await ui.last('save')).text, sent);
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

test('one file dialog at a time: further dialog actions wait until the dialog is confirmed or cancelled', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from(PAGE)) });
  await ui.page.dblclick('#bOpen');
  assert.equal(await ui.count('openDialog'), 1, 'a double click asks for one dialog');
  for (const id of ['#bOpen', '#bProject', '#bSaveAs', '#bPicture']) assert.equal(await ui.page.isDisabled(id), true, id + ' locked while the dialog is open');
  await ui.page.keyboard.press('Control+Shift+s');
  assert.equal(await ui.count('saveAs'), 0, 'no save as while the dialog is open');
  await ui.deliver({ type: 'openFailed', op: (await ui.last('openDialog')).op });  // cancelled
  assert.equal(await ui.page.isDisabled('#bOpen'), true, 'still locked until the core says the dialog closed');
  await ui.deliver({ type: 'dialogDone' });
  assert.equal(await ui.page.isEnabled('#bOpen'), true, 'free again after cancelling');
  await ui.page.click('#bPicture');
  await ui.page.click('#bProject', { force: true });
  assert.equal(await ui.count('pickPicture'), 1);
  assert.equal(await ui.count('openProject'), 0, 'no folder dialog while the picture dialog is open');
  await ui.pictureReply({ type: 'picture', src: 'bilder/katze.png' });  // confirmed
  assert.equal(await ui.page.isDisabled('#bPicture'), true);
  await ui.deliver({ type: 'dialogDone' });
  await ui.page.click('#bPicture');
  assert.equal(await ui.count('pickPicture'), 2, 'free again after confirming');
  assert.deepEqual(ui.errors, []);
});

test('rescue copy: while a save hangs, the text with BOM and line breaks goes to a local file; the saved state is kept', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  const mixed = '<p>a</p>\r\n<p>b</p>\n<p>c</p>\r<p>d</p>\r\n';
  await ui.opened({ type: 'opened', path: 'seiten/tiere.html', name: 'tiere.html', data: b64([...BOM, ...Buffer.from(mixed)]) });
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.keyboard.type('x');
  await ui.page.keyboard.press('Control+s');
  assert.equal(await ui.page.isHidden('#bRescue'), true, 'not offered for a save that has just started');
  await ui.page.keyboard.type('y');
  await ui.page.waitForSelector('#bRescue', { state: 'visible', timeout: 5000 });
  await ui.page.click('#bRescue');
  const r = await ui.last('rescue');
  assert.equal(r.path, 'seiten/tiere.html');
  assert.equal(r.text, '\ufeff' + mixed + 'xy', 'BOM, every line break and the text typed during the save');
  assert.equal(await ui.page.isDisabled('#bRescue'), true, 'one rescue copy at a time');
  assert.equal(await ui.page.textContent('#docState'), 'wird gespeichert …');
  const where = String.raw`L:\Profil\HtmlSchoolEditor\Rettungskopien\tiere_2026-11-26_10-00-00.html`;  // as the core reports it
  await ui.deliver({ type: 'rescued', id: r.id, path: where });
  await ui.page.waitForFunction(() => document.getElementById('dlg').open);
  assert.match(await ui.page.textContent('#dlgBody'), /Rettungskopien\\tiere_2026-11-26_10-00-00\.html.*noch nicht gespeichert/s);
  assert.match(await ui.page.textContent('#status'), /Rettungskopie: L:\\Profil\\HtmlSchoolEditor/);
  assert.equal(await ui.page.textContent('#docState'), 'wird gespeichert …', 'the original is still on its way');
  // the save fails while the rescue dialog is open: its question waits instead of being lost
  await ui.reply({ type: 'saveFailed', message: 'Das Netzlaufwerk antwortet nicht.' });
  await ui.answerThen('#dlg button[value="ok"]', 'Speichern hat nicht geklappt');
  await ui.answer('#dlg button[value="ok"]');
  assert.equal(await ui.page.textContent('#docState'), 'nicht gespeichert', 'the original stays unsaved');
  assert.equal(await ui.page.isHidden('#bRescue'), true, 'no save on its way, no rescue offer');
  await ui.page.keyboard.press('Control+s');
  const s = await ui.last('save');
  assert.equal(s.text, '\ufeff' + mixed + 'xy', 'the next save writes the same bytes');
  assert.deepEqual(ui.errors, []);
});

test('a close request while another question is open is answered after it (logoff during "Neue Seite")', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from(PAGE)) });
  await ui.page.click('#src');
  await ui.page.keyboard.type('x');
  await ui.page.click('#bNew');
  await ui.page.waitForSelector('dialog[open]');
  await ui.deliver({ type: 'closeRequest' });
  assert.match(await ui.page.textContent('#dlgTitle'), /Neue Seite/, 'the open question stays');
  await ui.answerThen('#dlg button[value="cancel"]', 'nicht gespeichert');  // then the question about unsaved text
  await ui.answer('#dlg button[value="cancel"]');
  assert.equal(await ui.count('closeOk'), 0, 'cancelled: the window stays open with the text');
  assert.ok((await ui.text()).includes('x'));
  // with everything saved, the kept request closes the window after the question
  await ui.page.keyboard.press('Control+s');
  await ui.reply({ type: 'saved', path: 'index.html' });
  await ui.page.click('#bNew');
  await ui.page.waitForSelector('dialog[open]');
  await ui.deliver({ type: 'closeRequest' });
  await ui.answer('#dlg button[value="cancel"]');
  await ui.page.waitForFunction(() => window.__sent.some((m) => m.type === 'closeOk'));
  assert.deepEqual(ui.errors, []);
});

test('questions take turns: an answer is never taken by the next question', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.page.click('#bNew');
  await ui.page.waitForSelector('dialog[open]');
  await ui.page.fill('#npName', 'rennen');
  // confirm "Neue Seite" and let another question of the core arrive in the same task, before the close event
  await ui.page.evaluate(() => {
    document.querySelector('#dlg button[value="ok"]').click();
    window.__deliver({ type: 'error', title: 'Zweite Frage', message: 'Kam dazwischen.' });
  });
  await ui.page.waitForFunction(() => window.__sent.some((m) => m.type === 'newPage'));
  assert.equal(await ui.count('newPage'), 1, 'the new page is asked for exactly once');
  assert.equal((await ui.last('newPage')).path, 'rennen.html');
  await ui.page.waitForFunction(() => document.getElementById('dlg').open);
  assert.match(await ui.page.textContent('#dlgTitle'), /Zweite Frage/, 'the second question comes after the first');
  await ui.answer('#dlg button[value="ok"]');
  assert.deepEqual(ui.errors, []);
});

test('every page the core hands over is acknowledged, also one that is not taken (logoff right after opening)', async () => {
  const ui = await openUi(browser);
  const report = async () => { const m = await ui.last('unsaved'); return [m.value, m.open, m.seen]; };
  await ui.deliver(PROJECT);
  await ui.page.click('#files li[data-path="index.html"]');
  await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(Buffer.from(PAGE)) });
  assert.deepEqual(await report(), [false, true, 1], 'the first page: open, and seen');
  // an answer to an older request is not taken, but acknowledged
  await ui.deliver({ type: 'opened', seq: 2, op: 999, path: 'seiten/tiere.html', name: 'tiere.html', base: '1-0000000000000000', data: b64(Buffer.from(PAGE)) });
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'unsaved').pop().seen === 2);
  assert.deepEqual(await report(), [false, true, 2]);
  assert.equal(await ui.page.textContent('#docName'), 'index.html');
  // a new page as the first page of another project
  await ui.deliver({ type: 'projectChanged', name: 'anderes' });
  assert.deepEqual(await report(), [false, false, 2], 'no page after the change');
  await ui.deliver({ ...PROJECT, name: 'anderes' });
  await ui.page.click('#bNew');
  await ui.page.fill('#npName', 'erste');
  await ui.answer('#dlg button[value="ok"]');
  await ui.opened({ type: 'opened', seq: 3, path: 'erste.html', name: 'erste.html', data: b64(Buffer.from('<p>neu</p>')) });
  assert.deepEqual(await report(), [false, true, 3]);
  // a page that is refused (too large) is acknowledged with the page open before it
  await ui.page.click('#files li[data-path="index.html"]');
  await ui.opened({ type: 'opened', seq: 4, path: 'index.html', name: 'index.html', data: b64(Buffer.alloc(5 * 1024 * 1024 + 1, 0x61)) });
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'unsaved').pop().seen === 4);
  assert.deepEqual(await report(), [false, true, 4]);
  assert.equal(await ui.page.textContent('#docName'), 'erste.html');
  assert.deepEqual(ui.errors, []);
});

test('a page is acknowledged only once it is taken or refused (encoding question, project refresh, two handovers)', async () => {
  const cp1252 = [0x3c, 0x70, 0x3e, 0xe4, 0x3c, 0x2f, 0x70, 0x3e, 0x0d, 0x0a];  // <p>ä</p> in Windows-1252
  const seen = async () => (await ui.last('unsaved')).seen;
  let ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.page.click('#files li[data-path="index.html"]');
  await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(cp1252) });
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgTitle'), /Zeichenkodierung/);
  // the project list is refreshed while the question is open: the page is still being handled
  await ui.deliver({ ...PROJECT, files: [...PROJECT.files, { path: 'neu.html', kind: 'page' }] });
  // a second handover (an answer to an older request) arrives meanwhile
  await ui.deliver({ type: 'opened', seq: 2, op: 999, path: 'seiten/tiere.html', name: 'tiere.html', base: '1-0000000000000000', data: b64(Buffer.from(PAGE)) });
  await ui.page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
  assert.ok((await seen()) < 1, 'nothing acknowledged while the first page waits for its question');
  await ui.answer('#dlg button[value="convert"]');
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'unsaved').pop().seen === 2);
  assert.deepEqual([(await ui.last('unsaved')).open, await ui.text()], [true, '<p>ä</p>\n'], 'taken: open, both acknowledged');
  // cancelled: acknowledged with no page open
  ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.page.click('#files li[data-path="index.html"]');
  await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(cp1252) });
  await ui.page.waitForSelector('dialog[open]');
  await ui.deliver(PROJECT);
  assert.ok((await seen()) < 1);
  await ui.answer('#dlg button[value="cancel"]');
  await ui.page.waitForFunction(() => window.__sent.filter((m) => m.type === 'unsaved').pop().seen === 1);
  assert.equal((await ui.last('unsaved')).open, false, 'refused: no page');
  assert.deepEqual(ui.errors, []);
});

test('the page is editable on open, and both panes share a byte-preserving undo and save', async () => {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  const source = '<!doctype html>\r\n<title>Äpfel</title>\r<p>Hallo</p>\n<p>Welt</p>';
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64([...BOM, ...Buffer.from(source)]) });
  const frame = ui.page.frameLocator('#visualFrame');
  const first = frame.locator('p').first();
  await first.click();
  await ui.page.keyboard.press('End');
  await ui.page.keyboard.type('!');
  assert.equal(await ui.text(), source.replace(/\r\n?/g, '\n').replace('Hallo', 'Hallo!'));
  await ui.page.keyboard.press('Control+z');
  assert.equal(await first.textContent(), 'Hallo');
  await ui.page.keyboard.press('Control+y');
  assert.equal(await first.textContent(), 'Hallo!');
  await ui.page.fill('#pageTitle', 'Käse & Brot');
  await ui.page.locator('#pageTitle').press('Enter');
  await ui.page.click('#bSave');
  const save = await ui.last('save');
  assert.equal(save.text, '\ufeff' + source.replace('Äpfel', 'Käse &amp; Brot').replace('Hallo', 'Hallo!'));
  assert.deepEqual(ui.errors, []);
});

test('the toolbar edits through the shared commands and only admits local assets in the edit frame', async () => {
  const ui = await openUi(browser);
  const requests = [];
  await ui.page.route('https://projekt.example/**', (route) => {
    const name = new URL(route.request().url()).pathname;
    requests.push(name);
    if (name.endsWith('.css')) return route.fulfill({ contentType: 'text/css', body: 'p { color: rgb(4, 5, 6) }' });
    return route.fulfill({ status: 404, body: '' });
  });
  await ui.deliver(PROJECT);
  const source = '<!doctype html><link rel="stylesheet" href="../css/stil.css"><p>Hallo Welt</p><img src="../bilder/katze.png"><img src="https://outside.example/katze.png"><iframe title="Andere Seite"></iframe>';
  await ui.opened({ type: 'opened', path: 'seiten/tiere.html', name: 'tiere.html', data: b64(Buffer.from(source)) });
  const frame = ui.page.frameLocator('#visualFrame');
  const paragraph = frame.locator('p');
  await paragraph.click();
  await paragraph.evaluate((p) => {
    const selection = p.ownerDocument.getSelection();
    selection.setBaseAndExtent(p.firstChild, 0, p.firstChild, 5);
  });
  await ui.page.click('[data-edit="bold"]');
  assert.match(await ui.text(), /<p><b>Hallo<\/b> Welt<\/p>/);
  assert.equal(await frame.locator('iframe').count(), 0);
  await paragraph.evaluate((p) => new Promise((resolve, reject) => {
    const deadline = performance.now() + 2500;
    function check() {
      if (getComputedStyle(p).color === 'rgb(4, 5, 6)') resolve();
      else if (performance.now() > deadline) reject(new Error('project stylesheet did not apply'));
      else requestAnimationFrame(check);
    }
    check();
  }));
  assert.ok(requests.includes('/css/stil.css'));
  assert.ok(requests.includes('/bilder/katze.png'));
  assert.equal(await frame.locator('img[src^="https://outside.example"]').count(), 0);
  assert.deepEqual(ui.errors, []);
});

test('Save As moves the base of the visual projection to the saved path', async () => {
  const ui = await openUi(browser);
  await ui.page.route('https://projekt.example/**', (route) => route.fulfill({ status: 404, body: '' }));
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', path: 'index.html', name: 'index.html', data: b64(Buffer.from('<!doctype html><img src="icon.png">')) });
  const image = ui.page.frameLocator('#visualFrame').locator('img');
  assert.equal(await image.getAttribute('src'), 'https://projekt.example/icon.png');
  await ui.page.click('#bSaveAs');
  await ui.reply({ type: 'saved', path: 'seiten/kopie.html', name: 'kopie.html' });
  assert.equal(await image.getAttribute('src'), 'https://projekt.example/seiten/icon.png');
  assert.deepEqual(ui.errors, []);
});

test('a page-side edit still open counts before saving and closing (title field, composition)', async () => {
  const source = '<!doctype html>\r\n<title>Alt</title>\r\n<p>Hallo</p>\r\n';
  const open = async () => {
    const ui = await openUi(browser);
    await ui.deliver(PROJECT);
    await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(Buffer.from(source)) });
    await ui.page.frameLocator('#visualFrame').locator('p').waitFor();
    return ui;
  };
  // a title typed but not confirmed, then the window is to close (also a logoff): the question comes
  let ui = await open();
  await ui.page.fill('#pageTitle', 'Neu');
  assert.equal(await ui.page.textContent('#docState'), 'gespeichert', 'not taken over yet');
  await ui.deliver({ type: 'closeRequest' });
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgTitle'), /nicht gespeichert/);
  assert.equal(await ui.count('closeOk'), 0, 'the title is not lost');
  assert.match(await ui.text(), /<title>Neu<\/title>/);
  await ui.answer('#dlg button[value="cancel"]');
  // a title typed but not confirmed, then Ctrl+S: the save holds it
  ui = await open();
  await ui.page.fill('#pageTitle', 'Gespeichert');
  await ui.page.locator('#pageTitle').press('Control+s');
  assert.equal((await ui.last('save')).text, source.replace('Alt', 'Gespeichert'));
  // a composition not finished, then the window is to close
  ui = await open();
  await ui.page.frameLocator('#visualFrame').locator('p').click();
  await ui.page.keyboard.press('End');
  const cdp = await ui.page.context().newCDPSession(ui.page);
  await cdp.send('Input.imeSetComposition', { text: 'ê', selectionStart: 1, selectionEnd: 1 });
  await ui.deliver({ type: 'closeRequest' });
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgTitle'), /nicht gespeichert/);
  assert.match(await ui.text(), /<p>Halloê<\/p>/, 'the composed character is in the code');
  assert.deepEqual(ui.errors, []);
});

test('a title that cannot be applied stops saving and closing, and stays until it is applied or reset', async () => {
  const source = '<!doctype html>\r\n<html><head><template><title>Vorlage</title></template><title>Alt</title></head><body><p>Hallo</p></body></html>\r\n';
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(Buffer.from(source)) });
  await ui.page.frameLocator('#visualFrame').locator('p').waitFor();
  // the field says at once that this title is changed in the code
  await ui.page.focus('#pageTitle');
  assert.equal(await ui.page.$eval('#pageTitle', (i) => i.readOnly), true, 'read-only where the title cannot be written');
  assert.match(await ui.page.textContent('#status'), /nur links im HTML-Code/);
  // a typed title that got into the field anyway: closing and saving stop, nothing is lost
  await ui.page.$eval('#pageTitle', (i) => { i.readOnly = false; i.value = 'Neu'; });
  await ui.deliver({ type: 'closeRequest' });
  await ui.page.waitForSelector('dialog[open]');
  assert.match(await ui.page.textContent('#dlgTitle'), /noch nicht übernommen/);
  await ui.answer('#dlg button[value="ok"]');
  assert.equal(await ui.count('closeOk'), 0, 'the window stays open');
  assert.equal(await ui.page.inputValue('#pageTitle'), 'Neu', 'the typed title is kept');
  assert.equal(await ui.text(), source.replace(/\r\n/g, '\n'), 'the template and the code are untouched');
  await ui.page.keyboard.press('Control+s');
  await ui.page.waitForSelector('dialog[open]');
  assert.equal(await ui.count('save'), 0, 'nothing is saved without the title');
  await ui.answer('#dlg button[value="ok"]');
  assert.equal(await ui.page.inputValue('#pageTitle'), 'Neu', 'still kept after the second attempt');
  // Esc in the field resets it; then closing goes on
  await ui.page.focus('#pageTitle');
  await ui.page.keyboard.press('Escape');
  assert.equal(await ui.page.inputValue('#pageTitle'), 'Alt');
  await ui.deliver({ type: 'closeRequest' });
  await ui.page.waitForFunction(() => window.__sent.some((m) => m.type === 'closeOk'));
  assert.deepEqual(ui.errors, []);
});
