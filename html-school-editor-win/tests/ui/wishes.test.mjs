// Browser tests of the owner's collection after alpha.18 (2026-11-27): bugs B1 to B5 and wishes W1 to W13. One
// test per item; each was run against the alpha.18 interface first and failed there (negative control, see
// docs/STATUS.md). MOCK of the C++ core as in ui.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, openUi, b64, PROJECT } from './harness.mjs';
import { ROOT } from '../../tools/stage-ui.mjs';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// Opens `source` (CRLF breaks) as index.html and waits until the page side can be edited.
async function openPage(source, editable = true) {
  const ui = await openUi(browser);
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(Buffer.from(source)) });
  ui.frame = ui.page.frameLocator('#visualFrame');
  if (!editable) return ui;
  await ui.page.waitForSelector('#visualFrame', { state: 'visible' });
  await ui.frame.locator('body').waitFor();
  return ui;
}
const lf = (s) => s.replace(/\r\n/g, '\n');
// Sets the caret (or a selection) in the page: the `n`th element matching `selector`, offsets in its first text.
async function caret(ui, selector, from, to = from, n = 0) {
  await ui.frame.locator(selector).nth(n).evaluate((el, [a, b]) => {
    el.ownerDocument.defaultView.focus();
    el.ownerDocument.body.focus();
    const t = el.firstChild;
    el.ownerDocument.getSelection().setBaseAndExtent(t, a, t, b);
  }, [from, to]);
}
// Saves with Ctrl+S and returns the text sent to the core (the bytes that would be written, as a string).
async function saveText(ui) {
  await ui.page.keyboard.press('Control+s');
  return (await ui.last('save')).text;
}

test('B2: project list, code, page from left to right; the texts point to the code on the left', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo</p>\r\n');
  const [proj, src, split, pv] = await Promise.all(['#projectPane', '#srcPane', '#split', '#pvPane'].map((s) => ui.page.locator(s).boundingBox()));
  assert.ok(proj.x < src.x && src.x < split.x && split.x < pv.x, 'list, code, divider, page');
  const order = await ui.page.$$eval('#work > *', (els) => els.map((e) => e.id));
  assert.deepEqual(order, ['projectPane', 'srcPane', 'split', 'pvPane'], 'also in the order of the document (Tab, screen readers)');
  // the page view the core lays over the page pane is reported at the right
  await ui.page.waitForFunction(() => { const l = window.__sent.filter((m) => m.type === 'layout').pop(); const r = document.getElementById('pvSlot').getBoundingClientRect(); return Math.abs(l.x - r.left) <= 1 && Math.abs(l.w - r.width) <= 1; });
  assert.ok((await ui.last('layout')).x > src.x + src.width - 1, 'the native page view lies right of the code');
  // a page the projection cannot show: the hint names the code on the left
  const ui2 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<table>Text</table>\r\n', false);
  await ui2.page.waitForFunction(() => document.getElementById('visualHint').textContent !== '');
  assert.equal(await ui2.page.textContent('#visualHint'), 'Bearbeite den HTML-Code links.');
  const ui3 = await openPage('<!doctype html>\r\n<html><head><template><title>V</title></template><title>Alt</title></head><body><p>Hallo</p></body></html>\r\n');
  await ui3.page.focus('#pageTitle');
  assert.match(await ui3.page.textContent('#status'), /nur links im HTML-Code/);
  for (const u of [ui, ui2, ui3]) assert.deepEqual(u.errors, []);
});

test('B1: undo and redo show the curved arrows of office programs', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo</p>\r\n');
  const shape = (id) => ui.page.$eval(id, (s) => Array.from(s.querySelectorAll('path')).map((p) => p.getAttribute('d') + (p.getAttribute('transform') || '')).join(' '));
  const undo = await shape('#i-undo'), redo = await shape('#i-redo');
  assert.match(undo, /A8\.5 8\.5 0 0 1 20 13\.5/, 'one arc from the arrow head on the left over to the right');
  assert.doesNotMatch(undo + redo, /translate/, 'no loop (the alpha.18 symbol looked like "reload")');
  assert.match(redo, /A8\.5 8\.5 0 0 0 4 13\.5/, 'redo: the mirror image');
  const box = await ui.page.locator('#bUndo svg').boundingBox();
  assert.ok(box.width === 18 && box.height === 18, 'same size as the other symbols');
  assert.deepEqual(ui.errors, []);
});

test('B3: a sentence split with Enter at its spaces and made a list leaves no &nbsp; and no leading space', async () => {
  // the owner's steps: type a sentence, split it with Enter at spaces, select all, "Liste"
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<body>\r\n</body>\r\n');
  const slot = await ui.page.locator('#pvSlot').boundingBox();
  await ui.page.mouse.click(slot.x + 60, slot.y + 30);
  await ui.page.keyboard.type('Der schnelle braune Fuchs');
  await caret(ui, 'p', 4);            // behind the space after "Der"
  await ui.page.keyboard.press('Enter');
  await caret(ui, 'p', 8, 8, 1);      // in front of the space after "schnelle"
  await ui.page.keyboard.press('Enter');
  await ui.frame.locator('body').evaluate((b) => b.ownerDocument.getSelection().selectAllChildren(b));
  await ui.page.click('[data-edit="ul"]');
  const text = await ui.text();
  assert.match(text, /<li>Der<\/li>\s*<li>schnelle<\/li>\s*<li>braune Fuchs<\/li>/, JSON.stringify(text));
  assert.doesNotMatch(text, /&nbsp;|<li> /);
  // typed straight on: a space, then Enter
  await caret(ui, 'li', 12, 12, 2);
  await ui.page.keyboard.type(' ');
  await ui.page.keyboard.press('Enter');
  await ui.page.keyboard.type('Ende');
  assert.match(await ui.text(), /<li>braune Fuchs<\/li>\s*<li>Ende<\/li>/);
  assert.doesNotMatch(await ui.text(), /&nbsp;/);
  // Shift+Enter at a space: no &nbsp; in front of the <br>, no space behind it
  const ui2 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Eins zwei</p>\r\n');
  await caret(ui2, 'p', 5);
  await ui2.page.keyboard.press('Shift+Enter');
  assert.match(await ui2.text(), /<p>Eins<br>zwei<\/p>/);
  // a &nbsp; written in the code stays where nothing is split
  const ui3 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>5&nbsp;km weit</p>\r\n<p>B</p>\r\n');
  await caret(ui3, 'p', 9);
  await ui3.page.keyboard.press('Enter');
  await ui3.page.keyboard.type('x');
  assert.match(await ui3.text(), /<p>5&nbsp;km weit<\/p>\s*<p>x<\/p>/);
  assert.equal(await saveText(ui3), lf('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>5&nbsp;km weit</p>\r\n<p>x</p>\r\n<p>B</p>\r\n').replace(/\n/g, '\r\n'), 'saved with the CRLF breaks of the file');
  for (const u of [ui, ui2, ui3]) assert.deepEqual(u.errors, []);
});

test('B4: links are seen in the page as in the browser; the page\'s own rules for links still apply', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo <a href="x.html">Link</a></p>\r\n');
  const look = (u) => u.frame.locator('a').first().evaluate((a) => { const s = getComputedStyle(a); return [s.color, s.textDecorationLine]; });
  assert.deepEqual(await look(ui), ['rgb(0, 0, 238)', 'underline']);
  const ui2 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<style>a { color: green; text-decoration: none }</style>\r\n<p>Hallo <a href="x.html">Link</a></p>\r\n');
  await ui2.page.waitForFunction(() => getComputedStyle(document.getElementById('visualFrame').contentDocument.querySelector('a')).color === 'rgb(0, 128, 0)');
  assert.deepEqual(await look(ui2), ['rgb(0, 128, 0)', 'none']);
  assert.equal(await ui.frame.locator('a').first().getAttribute('href'), null, 'still no href: a click goes nowhere');
  for (const u of [ui, ui2]) assert.deepEqual(u.errors, []);
});

test('B5: Enter at the end of a link starts a paragraph without the link, also three times', async () => {
  const source = '<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo <a href="x.html">zum Link</a></p>\r\n';
  const ui = await openPage(source);
  await ui.frame.locator('p').click();
  await ui.page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await ui.page.keyboard.press('Enter');
  await ui.page.keyboard.type('weiter');
  const text = await ui.text();
  assert.equal((text.match(/<a /g) || []).length, 1, 'one link: ' + JSON.stringify(text));
  assert.match(text, /<p>Hallo <a href="x\.html">zum Link<\/a><\/p>\n<p><br><\/p>\n<p><br><\/p>\n<p>weiter<\/p>/);
  // Enter inside a link still splits it (both parts stay links)
  const ui2 = await openPage(source);
  await caret(ui2, 'a', 3);
  await ui2.page.keyboard.press('Enter');
  assert.equal(((await ui2.text()).match(/<a href="x\.html">/g) || []).length, 2);
  for (const u of [ui, ui2]) assert.deepEqual(u.errors, []);
});

test('W1: "Hilfe" shows a short guide, the version, the developer, the year and both licences', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo</p>\r\n');
  const help = await ui.page.locator('#bHelp').boundingBox();
  const files = await ui.page.locator('#topFiles').boundingBox();
  assert.ok(help.y < files.y + files.height && help.x + help.width > files.x + files.width - 120, 'in the first row, on the right');
  await ui.page.click('#bHelp');
  await ui.page.waitForSelector('dialog[open]');
  const body = await ui.page.textContent('#dlgBody');
  for (const part of ['So fängst du an', 'Version 0.1.0-test', 'Stefan Scheidl', '2026', 'MIT License', 'Copyright (c) 2026 Stefan Scheidl', 'WebView2', 'Copyright (C) Microsoft Corporation', 'Umschalt+Enter'])
    assert.ok(body.includes(part), 'help names ' + part);
  assert.equal((await ui.last('layout')).visible, false, 'the native page view gives way to the dialog');
  await ui.answer('#dlg button[value="ok"]');
  await ui.page.keyboard.press('F1');
  await ui.page.waitForSelector('dialog[open]');
  assert.equal(await ui.page.textContent('#dlgTitle'), 'Hilfe', 'F1 opens it too');
  await ui.page.keyboard.press('Escape');
  // the licence of the Windows editor names the developer; the repository and the single-file editor stay as they are
  assert.match(fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8'), /^MIT License\r?\n\r?\nCopyright \(c\) 2026 Stefan Scheidl\r?\n/);
  assert.match(fs.readFileSync(path.join(ROOT, '..', 'LICENSE'), 'utf8'), /Copyright \(c\) 2026 tAUREON/);
  assert.deepEqual(ui.errors, []);
});

test('W3: "Zeilenumbruch" and Shift+Enter put a <br> into the paragraph, in the middle and at the end', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>EinsZwei</p>\r\n');
  await caret(ui, 'p', 4);
  await ui.page.click('[data-edit="br"]');
  assert.match(await ui.text(), /<p>Eins<br>Zwei<\/p>/, 'button in the middle');
  await ui.page.click('#bUndo');
  assert.match(await ui.text(), /<p>EinsZwei<\/p>/, 'one undo step');
  await caret(ui, 'p', 8);
  await ui.page.keyboard.press('Shift+Enter');
  await ui.page.keyboard.type('Drei');
  assert.match(await ui.text(), /<p>EinsZwei<br>Drei<\/p>/, 'Shift+Enter at the end, then typing');
  assert.equal(await ui.frame.locator('p').evaluate((p) => p.getClientRects().length && Math.round(p.getBoundingClientRect().height) > 30), true, 'two lines are seen');
  const save = await saveText(ui);
  assert.equal(save, '<!DOCTYPE html>\r\n<title>T</title>\r\n<p>EinsZwei<br>Drei</p>\r\n', 'bytes as saved');
  // the button at the very end: the new line is seen at once, and typing goes into it
  const ui2 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Eins</p>\r\n');
  await caret(ui2, 'p', 4);
  await ui2.page.click('[data-edit="br"]');
  await ui2.page.keyboard.type('Zwei');
  assert.match(await ui2.text(), /<p>Eins<br>Zwei<\/p>/);
  for (const u of [ui, ui2]) assert.deepEqual(u.errors, []);
});

test('W4: alignment as four symbol buttons that switch on and off', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo</p>\r\n');
  assert.equal(await ui.page.locator('#visualAlign').count(), 0, 'no list any more');
  for (const v of ['left', 'center', 'right', 'justify']) {
    const b = ui.page.locator(`[data-edit="align-${v}"]`);
    assert.ok(await b.getAttribute('aria-label') && await b.getAttribute('title'), v + ': German name and tooltip');
    assert.equal(await b.locator('svg').count(), 1, v + ': a symbol');
  }
  await caret(ui, 'p', 2);
  await ui.page.click('[data-edit="align-center"]');
  assert.match(await ui.text(), /<p style="text-align: center">Hallo<\/p>/);
  await caret(ui, 'p', 2);
  assert.equal(await ui.page.getAttribute('[data-edit="align-center"]', 'aria-pressed'), 'true');
  assert.equal(await ui.page.getAttribute('[data-edit="align-left"]', 'aria-pressed'), 'false');
  await ui.page.click('[data-edit="align-center"]');
  assert.match(await ui.text(), /<p>Hallo<\/p>/, 'pressed again: taken away');
  await caret(ui, 'p', 2);
  await ui.page.click('[data-edit="align-justify"]');
  assert.match(await ui.text(), /<p style="text-align: justify">Hallo<\/p>/);
  assert.deepEqual(ui.errors, []);
});

test('W5: text colour from a palette: named colours, shades as hex, more colours, colour removed', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo Welt</p>\r\n');
  assert.equal(await ui.page.locator('#visualColor').count(), 0, 'no list any more');
  await caret(ui, 'p', 0, 5);
  await ui.page.click('#bColorMenu');
  assert.equal(await ui.page.isVisible('#palette'), true);
  const named = await ui.page.$$eval('#palette .swatch.named', (b) => b.map((x) => x.getAttribute('aria-label')));
  assert.deepEqual(named, ['Rot', 'Orange', 'Grün', 'Blau', 'Dunkelblau', 'Violett', 'Braun', 'Grau']);
  const grid = await ui.page.$$eval('#palette .palGrid .swatch', (b) => b.map((x) => x.dataset.color));
  assert.equal(grid.length, 50, 'a grid of 10 × 5 shades');
  assert.ok(grid.every((c) => /^#[0-9a-f]{6}$/.test(c)), 'as hex values');
  await ui.page.click('#palette [data-color="navy"]');
  assert.equal(await ui.page.isVisible('#palette'), false, 'closed after the choice');
  assert.match(await ui.text(), /<p><span style="color: navy">Hallo<\/span> Welt<\/p>/);
  assert.equal(await ui.page.$eval('#colorBar', (b) => getComputedStyle(b).backgroundColor), 'rgb(0, 0, 128)', 'the bar shows the colour chosen last');
  // the "A" applies the colour of the bar
  await ui.frame.locator('p').evaluate((p) => { const t = p.lastChild; p.ownerDocument.getSelection().setBaseAndExtent(t, 1, t, 5); });
  await ui.page.click('#bColor');
  assert.match(await ui.text(), /<p><span style="color: navy">Hallo<\/span> <span style="color: navy">Welt<\/span><\/p>/);
  // a shade of the grid is written as its hex value
  const shade = grid[23];
  await ui.frame.locator('p').evaluate((p) => { const t = p.firstChild.firstChild; p.ownerDocument.getSelection().setBaseAndExtent(t, 0, t, 5); });
  await ui.page.click('#bColorMenu');
  await ui.page.click(`#palette .palGrid [data-color="${shade}"]`);
  assert.match(await ui.text(), new RegExp(`<span style="color: ${shade}">Hallo</span>`));
  // "Weitere Farben …": the colour the engine's dialog answers (the dialog itself is checked natively)
  await ui.frame.locator('p').evaluate((p) => { const t = p.lastChild.firstChild; p.ownerDocument.getSelection().setBaseAndExtent(t, 0, t, 4); });
  await ui.page.$eval('#colorInput', (i) => { i.value = '#123abc'; i.dispatchEvent(new Event('change')); });
  assert.match(await ui.text(), /<span style="color: #123abc">Welt<\/span>/);
  // removed again: the spans go, the text stays
  await ui.frame.locator('p').evaluate((p) => p.ownerDocument.getSelection().selectAllChildren(p));
  await ui.page.click('#bColorMenu');
  await ui.page.click('#palette >> text=Farbe entfernen');
  assert.match(await ui.text(), /<p>Hallo Welt<\/p>/);
  // a new paragraph typed this session, coloured whole with a hex value: the colour reaches the code
  await ui.frame.locator('p').click();
  await ui.page.keyboard.press('End');
  await ui.page.keyboard.press('Enter');
  await ui.page.keyboard.type('Neu');
  await ui.frame.locator('p').nth(1).evaluate((p) => p.ownerDocument.getSelection().selectAllChildren(p));
  await ui.page.click('#bColorMenu');
  await ui.page.click(`#palette .palGrid [data-color="${grid[0]}"]`);
  assert.match(await ui.text(), new RegExp(`<p style="color: ${grid[0]}">Neu</p>`));
  // Esc closes the palette, the focus goes back to its button
  await ui.page.focus('#bColorMenu');
  await ui.page.keyboard.press('Enter');
  assert.equal(await ui.page.isVisible('#palette'), true);
  await ui.page.keyboard.press('Escape');
  assert.equal(await ui.page.isVisible('#palette'), false);
  assert.equal(await ui.page.evaluate(() => document.activeElement.id), 'bColorMenu');
  assert.deepEqual(ui.errors, []);
});

test('W6 and W7: the link dialog opens in a new window on request and makes e-mail links', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Seite Post</p>\r\n');
  await caret(ui, 'p', 0, 5);
  await ui.page.click('[data-edit="link"]');
  await ui.page.waitForSelector('dialog[open]');
  const boxes = await ui.page.$$eval('#dlg label.check', (l) => l.map((x) => x.textContent));
  assert.deepEqual(boxes, ['In neuem Fenster öffnen', 'Das ist eine E-Mail-Adresse']);
  await ui.page.fill('#dlg input[type="text"]', 'https://example.org/');
  await ui.page.locator('#dlg label.check').nth(0).locator('input').check();
  await ui.answer('#dlg button[value="insert"]');
  assert.match(await ui.text(), /<a href="https:\/\/example\.org\/" target="_blank">Seite<\/a>/);
  await ui.frame.locator('p').evaluate((p) => { const t = p.lastChild; p.ownerDocument.getSelection().setBaseAndExtent(t, 1, t, 5); });
  await ui.page.click('[data-edit="link"]');
  await ui.page.waitForSelector('dialog[open]');
  await ui.page.fill('#dlg input[type="text"]', 'klasse7b@example.org');
  await ui.page.locator('#dlg label.check').nth(1).locator('input').check();
  await ui.answer('#dlg button[value="insert"]');
  assert.match(await ui.text(), /<a href="mailto:klasse7b@example\.org">Post<\/a>/);
  // an e-mail address without @ is refused, nothing changes
  const ui2 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Post</p>\r\n');
  await caret(ui2, 'p', 0, 4);
  await ui2.page.click('[data-edit="link"]');
  await ui2.page.waitForSelector('dialog[open]');
  await ui2.page.fill('#dlg input[type="text"]', 'keine-adresse');
  await ui2.page.locator('#dlg label.check').nth(1).locator('input').check();
  await ui2.answer('#dlg button[value="insert"]');
  assert.match(await ui2.page.textContent('#status'), /E-Mail-Adresse ist ungültig/);
  assert.match(await ui2.text(), /<p>Post<\/p>/);
  for (const u of [ui, ui2]) assert.deepEqual(u.errors, []);
});

test('W11: table cells are big enough to click and show guide lines, in the edit view only', async () => {
  const source = '<!DOCTYPE html>\r\n<title>T</title>\r\n<table><tr><td></td><td>x</td></tr></table>\r\n';
  const ui = await openPage(source);
  const cell = ui.frame.locator('td').first();
  const box = await cell.boundingBox();
  assert.ok(box.width >= 30 && box.height >= 20, 'an empty cell can be clicked: ' + box.width + ' × ' + box.height);
  assert.equal(await cell.evaluate((c) => getComputedStyle(c).outlineStyle), 'dashed', 'guide line');
  await cell.click();
  await ui.page.keyboard.type('A');
  assert.match(await ui.text(), /<td>A<\/td><td>x<\/td>/);
  assert.doesNotMatch(await ui.text(), /outline|min-width/, 'nothing of it in the code');
  // a page's own cell style wins over the size of the edit view
  const ui2 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<style>td { height: 60px }</style>\r\n<table><tr><td>x</td></tr></table>\r\n');
  await ui2.page.waitForFunction(() => document.getElementById('visualFrame').contentDocument.querySelector('td')?.getBoundingClientRect().height >= 59);
  for (const u of [ui, ui2]) assert.deepEqual(u.errors, []);
});

test('W13: search marks every hit in the code, the current one strongly, while the search field has the focus', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hund</p>\r\n<p>Katze und\tHund</p>\r\n<p>HUND</p>\r\n');
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+f');
  await ui.page.keyboard.type('hund');
  assert.equal(await ui.page.evaluate(() => document.activeElement.id), 'findText');
  assert.equal(await ui.page.locator('#marksIn > i').count(), 3, 'three hits marked');
  assert.equal(await ui.page.locator('#marksIn > i.now').count(), 1, 'one of them is the current one');
  // the mark lies on the word: same line as the selection in the text area, same width as the word
  const mark = await ui.page.locator('#marksIn > i.now').boundingBox();
  const line = await ui.page.evaluate(() => { const t = document.getElementById('src'); return t.value.slice(0, t.selectionStart).split('\n').length; });
  const ta = await ui.page.locator('#src').boundingBox();
  assert.ok(Math.abs(mark.y - (ta.y + 8 + (line - 1) * 20)) <= 1, 'on the line of the hit');
  const where = () => ui.page.locator('#marksIn > i.now').evaluate((i) => i.style.left + ' ' + i.style.top);
  const first = await where();
  await ui.page.keyboard.press('Enter');
  assert.notEqual(await where(), first, 'Enter moves the current hit on');
  assert.match(await ui.page.textContent('#findCount'), /^[123] von 3$/);
  // the hit after a tab is drawn behind the tab (two columns), as the text area shows it
  const tabbed = await ui.page.$$eval('#marksIn > i', (m) => m.map((i) => [i.style.top, parseFloat(i.style.left)]));
  const charW = await ui.page.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(document.getElementById('src')).font; return c.measureText('0').width; });
  const row = tabbed.find(([top]) => top === '60px');
  assert.ok(row && Math.abs(row[1] - '<p>Katze und  '.length * charW) < 1, 'after the tab: ' + JSON.stringify(tabbed));
  await ui.page.keyboard.press('Escape');
  assert.equal(await ui.page.locator('#marksIn > i').count(), 0, 'gone with the search');
  assert.deepEqual(ui.errors, []);
});
