// Browser tests of the owner's collection after alpha.18 (2026-11-27): bugs B1 to B5 and wishes W1 to W13. One
// test per item; each was run against the interface before it first and failed there (negative control, see
// docs/STATUS.md): the tests of version A (alpha.19) against alpha.18, those of version B (alpha.20) against
// alpha.19. MOCK of the C++ core as in ui.test.mjs.
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

// ---------------------------------------------------------------- version B (0.1.0-alpha.20)

test('W2: Ctrl+wheel zooms each pane on its own, Ctrl+0 resets, the level goes to the core, never into the code', async () => {
  const source = '<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo</p>\r\n';
  const ui = await openPage(source);
  const font = () => ui.page.$eval('#src', (t) => [getComputedStyle(t).fontSize, getComputedStyle(t).lineHeight]);
  const pageZoom = () => ui.frame.locator('html').evaluate((h) => getComputedStyle(h).zoom);
  assert.deepEqual(await font(), ['14px', '20px']);
  const src = await ui.page.locator('#src').boundingBox();
  await ui.page.mouse.move(src.x + 100, src.y + 100);
  await ui.page.keyboard.down('Control');
  await ui.page.mouse.wheel(0, -100);
  await ui.page.mouse.wheel(0, -100);
  await ui.page.keyboard.up('Control');
  assert.deepEqual(await font(), ['17.5px', '25px'], 'code at 125 %');
  assert.equal(await pageZoom(), '1', 'the page keeps its level');
  assert.equal(await ui.page.evaluate(() => getComputedStyle(document.body).zoom), '1', 'the interface itself never zooms');
  // the gutter and the colours follow the text area: line 3 of the numbers and of the colours lies on line 3
  const lines = await ui.page.evaluate(() => [document.querySelectorAll('#hlIn > div')[2].getBoundingClientRect().height, getComputedStyle(document.getElementById('gutterIn')).lineHeight]);
  assert.deepEqual(lines, [25, '25px']);
  await ui.page.waitForFunction(() => window.__sent.some((m) => m.type === 'zoom'));
  assert.deepEqual(await ui.last('zoom'), { type: 'zoom', code: 125, page: 100 }, 'the level goes to the core (HKCU)');
  // the page pane: Ctrl+wheel in the page
  const slot = await ui.page.locator('#pvSlot').boundingBox();
  await ui.page.mouse.move(slot.x + 100, slot.y + 50);
  await ui.page.keyboard.down('Control');
  await ui.page.mouse.wheel(0, 100);
  await ui.page.keyboard.up('Control');
  assert.equal(await pageZoom(), '0.9', 'page at 90 %');
  assert.deepEqual(await font(), ['17.5px', '25px'], 'the code keeps its level');
  // Ctrl+0 in the page resets the page only; in the code it resets the code
  await ui.frame.locator('p').click();
  await ui.page.keyboard.press('Control+0');
  assert.equal(await pageZoom(), '1');
  assert.deepEqual(await font(), ['17.5px', '25px']);
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+0');
  assert.deepEqual(await font(), ['14px', '20px']);
  // nothing of it in the code or the saved bytes
  assert.equal(await ui.text(), lf(source));
  assert.equal(await saveText(ui), source);
  // the levels the core remembered come back at the start; the native page view's own zoom reaches the frame
  const ui2 = await openUi(browser);
  await ui2.deliver({ type: 'init', version: '0.1.0-test', zoomCode: 150, zoomPage: 80 });
  await ui2.deliver(PROJECT);
  await ui2.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(Buffer.from(source)) });
  await ui2.page.waitForSelector('#visualFrame', { state: 'visible' });
  assert.equal(await ui2.page.$eval('#src', (t) => getComputedStyle(t).fontSize), '21px');
  assert.equal(await ui2.page.frameLocator('#visualFrame').locator('html').evaluate((h) => getComputedStyle(h).zoom), '0.8');
  await ui2.deliver({ type: 'zoom', page: 110 });
  assert.equal(await ui2.page.frameLocator('#visualFrame').locator('html').evaluate((h) => getComputedStyle(h).zoom), '1.1');
  await ui2.deliver({ type: 'zoom', page: 100 });  // Ctrl+0 in the native page view: the core sets 100 and says so
  assert.equal(await ui2.page.frameLocator('#visualFrame').locator('html').evaluate((h) => getComputedStyle(h).zoom), '1', 'Ctrl+0 in the native page view');
  for (const u of [ui, ui2]) assert.deepEqual(u.errors, []);
});

test('W8: what is marked or clicked in the page is marked in the code, and the page keeps the focus', async () => {
  const source = '<!DOCTYPE html>\r\n<title>T</title>\r\n<h1>Titel</h1>\r\n<p>Hallo schöne Welt</p>\r\n<ul>\r\n  <li>Eins</li>\r\n  <li>Zwei</li>\r\n</ul>\r\n';
  const ui = await openPage(source);
  const marks = () => ui.page.$$eval('#marksIn > i.src', (m) => m.map((i) => [i.style.top, Math.round(parseFloat(i.style.left)), Math.round(parseFloat(i.style.width))]));
  const charW = await ui.page.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(document.getElementById('src')).font; return c.measureText('0').width; });
  // a selection: "schöne" in line 4, from its first to its last character
  await caret(ui, 'p', 6, 12);
  await ui.page.waitForFunction(() => document.querySelectorAll('#marksIn > i.src').length > 0);
  const [m] = await marks();
  assert.equal(m[0], '60px', 'line 4');
  assert.ok(Math.abs(m[1] - '<p>Hallo '.length * charW) <= 1 && Math.abs(m[2] - 6 * charW) <= 1, 'exactly "schöne": ' + JSON.stringify(m));
  assert.equal(await ui.page.evaluate(() => document.activeElement.id), 'visualFrame', 'the focus stays in the page');
  // a click into a list item marks the item
  await ui.frame.locator('li').nth(1).click();
  await ui.page.waitForFunction(() => document.querySelector('#marksIn > i.src')?.style.top === '120px');
  const [li] = await marks();
  assert.ok(Math.abs(li[1] - 2 * charW) <= 1 && Math.abs(li[2] - '<li>Zwei</li>'.length * charW) <= 1, 'the whole <li>…</li>: ' + JSON.stringify(li));
  // a selection over two lines marks both
  await ui.frame.locator('body').evaluate((b) => { const d = b.ownerDocument, l = d.querySelectorAll('li'); d.getSelection().setBaseAndExtent(l[0].firstChild, 1, l[1].firstChild, 2); });
  await ui.page.waitForFunction(() => document.querySelectorAll('#marksIn > i.src').length === 2);
  // the code is scrolled to the place, its caret and focus untouched
  assert.equal(await ui.page.$eval('#src', (t) => t.selectionStart), 0);
  // back in the code: the mark goes
  await ui.page.click('#src');
  assert.equal(await ui.page.locator('#marksIn > i.src').count(), 0);
  assert.equal(await ui.text(), lf(source), 'marking changes nothing');
  assert.deepEqual(ui.errors, []);
});

test('W9: a click chooses a picture and marks its code, a double click replaces it, Delete takes it out', async () => {
  const source = '<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo <img src="bilder/katze.png" alt="Katze" width="40"> Welt</p>\r\n<img src="bilder/hund.png" alt="Hund">\r\n<p>Ende</p>\r\n';
  const ui = await openPage(source);
  const img = ui.frame.locator('img').first();
  await img.click();
  assert.equal(await img.getAttribute('data-se-picked'), '', 'outlined');
  await ui.page.waitForFunction(() => document.querySelectorAll('#marksIn > i.src').length === 1);
  const charW = await ui.page.evaluate(() => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(document.getElementById('src')).font; return c.measureText('0').width; });
  const w = await ui.page.$eval('#marksIn > i.src', (i) => parseFloat(i.style.width));
  assert.ok(Math.abs(w - '<img src="bilder/katze.png" alt="Katze" width="40">'.length * charW) <= 1, 'the <img> tag is marked');
  // double click: "Bild einfügen" for this picture; the new file replaces it, alt and width stay
  await img.dblclick();
  assert.equal(await ui.count('pickPicture'), 1);
  await ui.pictureReply({ type: 'picture', src: 'bilder/maus.png' });
  await ui.deliver({ type: 'dialogDone' });
  assert.equal(await ui.page.locator('dialog[open]').count(), 0, 'no size step when replacing');
  assert.match(await ui.text(), /<p>Hallo <img src="bilder\/maus\.png" alt="Katze" width="40"> Welt<\/p>/);
  // Delete with the picture chosen takes it out, as one undo step
  await ui.frame.locator('img').first().click();
  await ui.page.keyboard.press('Delete');
  assert.match(await ui.text(), /<p>Hallo  Welt<\/p>/);
  await ui.page.keyboard.press('Control+z');
  assert.match(await ui.text(), /<p>Hallo <img src="bilder\/maus\.png" alt="Katze" width="40"> Welt<\/p>/, 'undo brings it back');
  // a picture on a line of its own goes with its line
  await ui.frame.locator('img').nth(1).click();
  await ui.page.keyboard.press('Backspace');
  assert.equal((await ui.text()).split('\n').slice(3).join('\n'), '<p>Ende</p>\n', 'no empty line left');
  // a click elsewhere: the picture is no longer chosen, Delete deletes text as always
  await ui.frame.locator('img').first().click();
  await ui.frame.locator('p').last().click();
  await ui.page.waitForFunction(() => !document.getElementById('visualFrame').contentDocument.querySelector('[data-se-picked]'), null, { timeout: 2000 });
  await ui.page.keyboard.press('End');
  await ui.page.keyboard.press('Backspace');
  assert.match(await ui.text(), /<p>End<\/p>/, 'Backspace deletes a character again');
  assert.match(await ui.text(), /<img src="bilder\/maus\.png"/, 'the picture stays');
  assert.deepEqual(ui.errors, []);
});

test('W10: the size step writes width and height in pixels or a width in percent, and names the formats', async () => {
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo</p>\r\n');
  const pick = async (fill) => {
    await ui.frame.locator('p').click();
    await ui.page.keyboard.press('End');
    await ui.page.click('#bPicture');
    assert.match(await ui.page.textContent('#status'), /jpg, png, gif, webp und svg/, 'formats named on opening');
    await ui.pictureReply({ type: 'picture', src: 'bilder/katze.png' }, true);
    await ui.deliver({ type: 'dialogDone' });
    await ui.page.waitForSelector('dialog[open]');
    assert.equal(await ui.page.textContent('#dlgTitle'), 'Bildgröße');
    await fill();
    await ui.page.click('#dlg button[value="ok"]');
    await ui.page.evaluate(() => new Promise((r) => setTimeout(r, 50)));
  };
  await pick(async () => { await ui.page.fill('#psWidth', '200'); await ui.page.fill('#psHeight', '150'); });
  assert.match(await ui.text(), /<p>Hallo<img src="bilder\/katze\.png" alt="" width="200" height="150"><\/p>/);
  await ui.page.keyboard.press('Control+z');
  await pick(async () => { await ui.page.selectOption('#psUnit', '%'); assert.equal(await ui.page.isDisabled('#psHeight'), true, 'percent: the height follows'); await ui.page.fill('#psWidth', '50'); });
  assert.match(await ui.text(), /<p>Hallo<img src="bilder\/katze\.png" alt="" style="width: 50%"><\/p>/);
  await ui.page.keyboard.press('Control+z');
  // a wrong value is refused with a hint, nothing is inserted until it is right
  await pick(async () => { await ui.page.fill('#psWidth', '20px'); });
  assert.match(await ui.page.textContent('#dlgBody .err'), /ganze Zahl/);
  assert.match(await ui.text(), /<p>Hallo<\/p>/);
  await ui.page.fill('#psWidth', '');
  await ui.answer('#dlg button[value="ok"]');
  assert.match(await ui.text(), /<p>Hallo<img src="bilder\/katze\.png" alt=""><\/p>/, 'empty: the picture keeps its own size');
  // into the code, with a size, at the caret of the code (also after the questions on the way)
  await ui.page.click('#src');
  await ui.page.keyboard.press('Control+End');
  await ui.page.click('#bPicture');
  await ui.pictureReply({ type: 'pictureOutside', name: 'urlaub.jpg', token: 't1' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button.primary');
  await ui.pictureReply({ type: 'picture', src: 'bilder/urlaub.jpg' }, true);
  await ui.page.waitForFunction(() => document.getElementById('dlgTitle').textContent === 'Bildgröße');
  await ui.page.fill('#psWidth', '120');
  await ui.answer('#dlg button[value="ok"]');
  const text = await ui.text();
  assert.ok(text.startsWith('<!DOCTYPE html>'), 'nothing before the doctype');
  assert.ok(text.endsWith('<img src="bilder/urlaub.jpg" alt="" width="120">'), 'at the end of the code: ' + JSON.stringify(text.slice(-60)));
  assert.deepEqual(ui.errors, []);
});

test('W12: a table is chosen as a whole and marked in the code; Delete takes it out without a question', async () => {
  const source = '<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Vorher</p>\r\n<table border="1">\r\n  <tr><td>A</td><td>B</td></tr>\r\n</table>\r\n<p>Nachher</p>\r\n';
  const ui = await openPage(source);
  assert.equal(await ui.page.isVisible('#bPickTable'), false, 'only offered in a table');
  await ui.frame.locator('td').first().click();
  await ui.page.waitForSelector('#bPickTable', { state: 'visible', timeout: 2000 });
  await ui.page.click('#bPickTable');
  assert.equal(await ui.frame.locator('table').getAttribute('data-se-picked'), '');
  await ui.page.waitForFunction(() => document.querySelectorAll('#marksIn > i.src').length === 3);
  const tops = await ui.page.$$eval('#marksIn > i.src', (m) => m.map((i) => i.style.top));
  assert.deepEqual(tops, ['60px', '80px', '100px'], 'the three lines of the table');
  await ui.page.keyboard.press('Delete');
  assert.equal(await ui.page.locator('dialog[open]').count(), 0, 'no question');
  assert.equal(await ui.text(), '<!DOCTYPE html>\n<title>T</title>\n<p>Vorher</p>\n<p>Nachher</p>\n');
  await ui.page.click('#bUndo');
  assert.equal(await ui.text(), lf(source), 'undo brings it back');
  // a click on the frame of the table (not into a cell) chooses it too
  await ui.frame.locator('table').evaluate((t) => t.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.equal(await ui.frame.locator('table').getAttribute('data-se-picked'), '');
  await ui.page.keyboard.press('Backspace');
  assert.doesNotMatch(await ui.text(), /<table/);
  assert.deepEqual(ui.errors, []);
});

// ---------------------------------------------------------------- review of alpha.20 by Codex (2026-11-28)

test('review of alpha.20, finding 1: a late picture never replaces code typed while it was on its way', async () => {
  const source = '<!DOCTYPE html>\r\n<title>T</title>\r\n<p>abcDEFghi</p>\r\n';
  const ui = await openPage(source);
  const at = (await ui.text()).indexOf('DEF');
  await ui.page.click('#src');
  await ui.page.evaluate((a) => document.getElementById('src').setSelectionRange(a, a + 3), at);
  await ui.page.click('#bPicture');
  // a picture outside the project: the copy is confirmed and runs (on Windows on a worker)
  await ui.pictureReply({ type: 'pictureOutside', name: 'review.png', token: 't1' });
  await ui.page.waitForSelector('dialog[open]');
  await ui.answer('dialog button.primary');
  // meanwhile the pupil types in the code
  await ui.page.click('#src');
  await ui.page.evaluate((a) => document.getElementById('src').setSelectionRange(a, a), at);
  await ui.page.keyboard.type('123');
  // the copy's answer, then the size step
  await ui.pictureReply({ type: 'picture', src: 'bilder/review.png' }, true);
  await ui.page.waitForFunction(() => document.getElementById('dlgTitle').textContent === 'Bildgröße');
  await ui.answer('#dlg button[value="ok"]');
  await ui.page.waitForSelector('dialog[open]');
  assert.equal(await ui.page.textContent('#dlgTitle'), 'Bild nicht eingefügt');
  assert.match(await ui.text(), /<p>abc123DEFghi<\/p>/, 'the typed text and the selection stay');
  assert.doesNotMatch(await ui.text(), /<img/);
  // without typing in between, the picture goes to the place as before (V-14)
  await ui.answer('#dlg button[value="ok"]');
  await ui.deliver({ type: 'dialogDone' });
  const at2 = (await ui.text()).indexOf('ghi');
  await ui.page.click('#src');
  await ui.page.evaluate((a) => document.getElementById('src').setSelectionRange(a, a), at2);
  await ui.page.click('#bPicture');
  await ui.pictureReply({ type: 'picture', src: 'bilder/review.png' });
  assert.match(await ui.text(), /<p>abc123DEF<img src="bilder\/review\.png" alt="">ghi<\/p>/);
  assert.deepEqual(ui.errors, []);
});

test('review of alpha.20, finding 2: Enter takes away spaces only at its own split, never written or kept ones', async () => {
  // Enter in an empty list item ends the list; the paragraph before it is not touched
  const ui = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Leave this&nbsp;</p><ul><li><br></li></ul>\r\n');
  await ui.frame.locator('li').click();
  await ui.page.keyboard.press('Enter');
  assert.match(await ui.text(), /<p>Leave this&nbsp;<\/p>/, JSON.stringify(await ui.text()));
  // a paragraph that keeps its spaces (pre-wrap): split after three spaces, all three stay
  const ui2 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p style="white-space: pre-wrap">eins   zwei</p>\r\n');
  await caret(ui2, 'p', 7);
  await ui2.page.keyboard.press('Enter');
  assert.match(await ui2.text(), /<p style="white-space: pre-wrap">eins {3}<\/p>/, JSON.stringify(await ui2.text()));
  await caret(ui2, 'p', 7);
  // a no-break space written in the code at the end of a paragraph, Enter at the very end: it stays
  const ui3 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Seite&nbsp;</p>\r\n');
  await caret(ui3, 'p', 6);
  await ui3.page.keyboard.press('Enter');
  await ui3.page.keyboard.type('x');
  assert.match(await ui3.text(), /<p>Seite&nbsp;<\/p>\s*<p>x<\/p>/, JSON.stringify(await ui3.text()));
  // the same with Shift+Enter
  const ui4 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Seite&nbsp;mehr</p>\r\n');
  await caret(ui4, 'p', 6);
  await ui4.page.keyboard.press('Shift+Enter');
  assert.match(await ui4.text(), /<p>Seite&nbsp;<br>mehr<\/p>/, JSON.stringify(await ui4.text()));
  // the original case still works: ordinary spaces at a split go (B3)
  const ui5 = await openPage('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Der schnelle Fuchs</p>\r\n');
  await caret(ui5, 'p', 4);
  await ui5.page.keyboard.press('Enter');
  assert.match(await ui5.text(), /<p>Der<\/p>\s*<p>schnelle Fuchs<\/p>/);
  for (const u of [ui, ui2, ui3, ui4, ui5]) assert.deepEqual(u.errors, []);
});

test('review of alpha.20, finding 3: one list of zoom steps for the edit frame, the native page view and HKCU', async () => {
  const { ZOOM_STEPS, nearestZoom, nextZoom } = await import('../../ui/js/zoom.js');
  const header = fs.readFileSync(path.join(ROOT, 'src', 'core', 'zoom.hpp'), 'utf8');
  const native = /kZoomSteps\{([^}]*)\}/.exec(header)[1].split(',').map((x) => Number(x.trim()));
  assert.deepEqual(ZOOM_STEPS, native, 'the same steps as the core');
  // the same rounding as nearestZoomStep in the core (tests/core/core_tests.cpp)
  for (const [p, want] of [[144, 150], [137.5, 125], [66.67, 67], [33, 50], [250, 200], [0, 100], [-5, 100], [NaN, 100]]) assert.equal(nearestZoom(p), want, String(p));
  assert.equal(nextZoom(144, 1), 175);
  // an off-step level from the core is shown as its step
  const ui = await openUi(browser);
  await ui.deliver({ type: 'init', version: '0.1.0-test', zoomPage: 144 });
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(Buffer.from('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>x</p>\r\n')) });
  await ui.page.waitForSelector('#visualFrame', { state: 'visible' });
  assert.equal(await ui.page.frameLocator('#visualFrame').locator('html').evaluate((h) => getComputedStyle(h).zoom), '1.5');
  assert.deepEqual(ui.errors, []);
});
