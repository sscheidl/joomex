// Cases F-05 … F-11 for the small functions the owner asked for in 0.1.0-alpha.5: underline, superscript,
// subscript and highlight; "open in a new tab" for links; a link on a picture; movable dialogs; "Im Browser
// öffnen"; the page title; the look of the top bar. Expected source texts are written by hand.
import { Editor, PV, sleep, tmpFile, makePng, editorFolder } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body, title = 'F') => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>' + title + '</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const pressed = (ed, id) => ed.eval('document.getElementById(' + JSON.stringify(id) + ').getAttribute("aria-pressed")');
const rect = (ed, id) => ed.eval('JSON.stringify((({ left, top, width, height }) => ({ left: Math.round(left), top: Math.round(top), width: Math.round(width), height: Math.round(height) }))(document.getElementById(' + JSON.stringify(id) + ').getBoundingClientRect()))').then(JSON.parse);
// Drags with the real mouse from the centre of an element by (dx, dy). The pointer stays inside the window
// (WebDriver refuses to move it outside); a far drag ends at the edge, which is enough to push a dialog over it.
async function dragBy(ed, expr, dx, dy) {
  const p = await ed.page.centerOf(expr);
  const [w, h] = JSON.parse(await ed.eval('JSON.stringify([innerWidth, innerHeight])'));
  dx = Math.max(1, Math.min(w - 2, p.x + dx)) - p.x;
  dy = Math.max(1, Math.min(h - 2, p.y + dy)) - p.y;
  await ed.page.mouse('mouseMoved', p.x, p.y, { button: 'none' });
  await ed.page.mouse('mousePressed', p.x, p.y);
  await ed.page.mouse('mouseMoved', p.x + dx / 2, p.y + dy / 2);
  await ed.page.mouse('mouseMoved', p.x + dx, p.y + dy);
  await ed.page.mouse('mouseReleased', p.x + dx, p.y + dy);
  await sleep(40);
}
// Records window.open instead of opening a tab (a labelled mock); the editor's own call is what is checked.
const OPEN_MOCK = 'window.f09Opened = []; window.open = function (...args) { window.f09Opened.push(args); return null; };';

export const features5 = [
  {
    id: 'F-05', title: 'underline, superscript, subscript and highlight are written as u, sup, sub and mark; superscript and subscript exclude each other',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const source = page('<p>Wasser ist H2O und hat m2 Fläche.</p>');
        await ed.openText('f05.html', source);
        const at = (text, from, to) => ed.caret(text, from, to);
        await at('H2O', 1, 2);
        await ed.click('bSub');
        await ed.settle();
        c.eq(await ed.source(), page('<p>Wasser ist H<sub>2</sub>O und hat m2 Fläche.</p>'), 'subscript wraps the selected digit in <sub>');
        c.eq(await pressed(ed, 'bSub'), 'true', 'the button shows the subscript at the caret');
        await ed.selectNodes('d.querySelector("sub").firstChild', 'd.querySelector("sub").firstChild');
        await ed.click('bSup');
        await ed.settle();
        c.eq(await ed.source(), page('<p>Wasser ist H<sup>2</sup>O und hat m2 Fläche.</p>'), 'superscript on a subscript digit takes the subscript away: only <sup> is left');
        c.eq(await pressed(ed, 'bSup') + await pressed(ed, 'bSub'), 'truefalse', 'and the buttons show superscript, not subscript');
        await ed.selectNodes('d.querySelector("sup").firstChild', 'd.querySelector("sup").firstChild');
        await ed.click('bSup');
        await ed.settle();
        c.eq(await ed.source(), source, 'superscript again removes it: the original text is back');
        await at('m2 ', 1, 2);
        await ed.click('bSup');
        await ed.settle();
        await at('Wasser', 0, 6);
        await ed.click('bUnderline');
        await ed.settle();
        await at('Fläche', 0, 6);
        await ed.key('u', ['ctrl']);
        await ed.settle();
        await at('ist', 0, 3);
        await ed.click('bMark');
        await ed.settle();
        const expected = page('<p><u>Wasser</u> <mark>ist</mark> H2O und hat m<sup>2</sup> <u>Fläche</u>.</p>');
        c.eq(await ed.source(), expected, 'underline by button and by Ctrl+U, highlight and superscript are plain tags');
        c.eq(await ed.eval(PV + '.querySelectorAll("[style], span, font").length'), 0, 'no style attribute, span or font in the page');
        await at('ist', 1);
        c.eq(await pressed(ed, 'bMark') + await pressed(ed, 'bUnderline'), 'truefalse', 'the caret in the highlighted word lights up "Marker" only');
        await at('ist', 0, 3);
        await ed.click('bMark');
        await ed.settle();
        c.eq(await ed.source(), page('<p><u>Wasser</u> ist H2O und hat m<sup>2</sup> <u>Fläche</u>.</p>'), 'highlight again removes the <mark>');
        for (let i = 0; i < 4; i++) { await ed.click('bUndo'); await ed.settle(); }
        c.eq(await ed.source(), page('<p>Wasser ist H2O und hat m<sup>2</sup> Fläche.</p>'), 'each command is one undo step');
        const saved = (await ed.download()).text;
        c.eq(saved, page('<p>Wasser ist H2O und hat m<sup>2</sup> Fläche.</p>'), 'the saved file holds exactly that');
      });
    },
  },
  {
    id: 'F-06', title: 'the link dialog writes target="_blank" for "In neuem Tab öffnen"; changing it rewrites only that attribute',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const source = page('<p>Zur Seite zwei und <A TARGET=_blank HREF=\'alt.html\' class="x">alt</A> und <a href="oben.html" target="_top">oben</a>.</p>');
        await ed.openText('f06.html', source);
        await ed.selectPv('Seite zwei');
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkNew").checked'), false, 'a new link starts without "new tab"');
        await ed.type('seite2.html');
        await ed.eval('document.getElementById("linkNew").click()');
        await ed.dialogButton('dlgLink', 'Einfügen');
        await ed.settle();
        const made = source.replace('Zur Seite zwei', 'Zur <a href="seite2.html" target="_blank">Seite zwei</a>');
        c.eq(await ed.source(), made, 'the new link has href and target="_blank", no rel');
        c.eq(await ed.eval(PV + '.querySelectorAll("a[href], a[target]").length'), 0, 'in the page pane no link has an address or a target');
        await ed.caret('alt', 1);
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkNew").checked'), true, 'an existing link with TARGET=_blank shows the box ticked (read from the source)');
        await ed.eval('document.getElementById("linkNew").click()');
        await ed.dialogButton('dlgLink', 'Übernehmen');
        await ed.settle();
        const unticked = made.replace('<A TARGET=_blank HREF=\'alt.html\' class="x">', '<A HREF=\'alt.html\' class="x">');
        c.eq(await ed.source(), unticked, 'unticking removes only the target attribute; spelling and quotes of the rest stay');
        await ed.caret('oben', 1);
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkNew").checked'), false, 'target="_top" is not "new tab": the box is not ticked');
        await ed.dialogButton('dlgLink', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), unticked, 'accepting unchanged keeps target="_top"');
        await ed.caret('oben', 1);
        await ed.click('bLink');
        await ed.eval('document.getElementById("linkNew").click()');
        await ed.dialogButton('dlgLink', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), unticked.replace('target="_top"', 'target="_blank"'), 'ticking it writes target="_blank" in place of the other target');
        await ed.caret('Seite zwei', 2);
        await ed.key('End');
        await ed.key('Enter');
        await ed.type('Neu');
        await ed.settle();
        c.ok((await ed.source()).includes('target="_blank">Seite zwei</a>'), 'typing next to the new link keeps its target');
        await ed.click('bUndo'); await ed.settle();
        await ed.click('bUndo'); await ed.settle();
        await ed.click('bUndo'); await ed.settle();
        await ed.click('bUndo'); await ed.settle();
        c.eq(await ed.source(), source, 'undo leads back to the original text');
      });
    },
  },
  {
    id: 'F-07', title: 'a link on a picture: made, its address changed, the picture inside it changed, the link removed',
    async run(c, { browser }) {
      const folder = editorFolder('f07-ordner');
      folder.put('f07.png', makePng(40, 30, false));
      await withEditor(browser, { artefact: folder.artefact }, async (ed) => {
        const source = page('<p>Bild: <img src="f07.png" alt="Katze"> Ende</p>');
        await ed.openText('f07.html', source);
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkTitle").textContent + "|" + document.getElementById("linkTextRow").hidden'), 'Link einfügen|true', 'with a clicked picture, "Link" makes a link around it and asks for no text');
        await ed.type('ziel.html');
        await ed.key('Enter');
        await ed.settle();
        const linked = page('<p>Bild: <a href="ziel.html"><img src="f07.png" alt="Katze"></a> Ende</p>');
        c.eq(await ed.source(), linked, 'the picture stands inside the new link, unchanged');
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkTitle").textContent + "|" + document.getElementById("linkUrl").value'), 'Link ändern|ziel.html', 'a click on the linked picture and "Link" changes that link');
        await ed.field('linkUrl', 'neu.html');
        await ed.key('Enter');
        await ed.settle();
        c.eq(await ed.source(), linked.replace('ziel.html', 'neu.html'), 'only the address changes');
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bImage');
        await ed.field('imgAlt', 'Unsere Katze');
        await ed.dialogButton('dlgImage', 'Übernehmen');
        await ed.settle();
        const changed = linked.replace('ziel.html', 'neu.html').replace('alt="Katze"', 'alt="Unsere Katze"');
        c.eq(await ed.source(), changed, 'the picture inside the link is changed through its own dialog; the link stays');
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bUnlink');
        await ed.settle();
        c.eq(await ed.source(), source.replace('alt="Katze"', 'alt="Unsere Katze"'), '"Link entfernen" with the picture clicked removes the link and keeps the picture');
        c.eq(await ed.eval(PV + '.querySelector("img").naturalWidth'), 40, 'the picture is still shown from the folder');
      });
    },
  },
  {
    id: 'F-08', title: 'dialogs are moved by their heading, never out of the window, and open centred again',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.click('bHelp');
        const first = await rect(ed, 'dlgHelp');
        await dragBy(ed, 'document.querySelector("#dlgHelp h3")', -150, -30);
        const moved = await rect(ed, 'dlgHelp');
        c.eq((moved.left - first.left) + ',' + (moved.top - first.top), '-150,-30', 'dragging the heading moves the help dialog by the same distance');
        c.eq(moved.width + 'x' + moved.height, first.width + 'x' + first.height, 'and keeps its size');
        await dragBy(ed, 'document.querySelector("#dlgHelp h3")', -3000, -3000);
        const corner = await rect(ed, 'dlgHelp');
        c.eq(corner.left + ',' + corner.top, '0,0', 'dragged far out it stops at the edge of the window');
        await dragBy(ed, 'document.querySelector("#dlgHelp h3")', 5000, 5000);
        const size = JSON.parse(await ed.eval('JSON.stringify([innerWidth, innerHeight])'));
        const far = await rect(ed, 'dlgHelp');
        c.ok(far.left + far.width <= size[0] && far.top + far.height <= size[1] && far.left > 0, 'and on the other side too', JSON.stringify([far, size]));
        await ed.dialogButton('dlgHelp', 'Schließen');
        await ed.click('bHelp');
        c.eq(JSON.stringify(await rect(ed, 'dlgHelp')), JSON.stringify(first), 'opened again, it is centred as before');
        await dragBy(ed, 'document.querySelector("#dlgHelp ul")', 100, 100);
        c.eq(JSON.stringify(await rect(ed, 'dlgHelp')), JSON.stringify(first), 'dragging on its text does not move a dialog with a heading');
        await ed.dialogButton('dlgHelp', 'Schließen');
        // a dialog without heading is moved by its text: the question before discarding changes
        await ed.caret('mein Text.', 3);
        await ed.type('x');
        await ed.settle();
        await ed.click('bNew');
        await ed.until('document.getElementById("dlgConfirm").open', 'question shown');
        const q = await rect(ed, 'dlgConfirm');
        await dragBy(ed, 'document.getElementById("confirmText")', 80, -40);
        const qm = await rect(ed, 'dlgConfirm');
        c.eq((qm.left - q.left) + ',' + (qm.top - q.top), '80,-40', 'the question is moved by its text');
        await ed.dialogButton('dlgConfirm', 'Abbrechen');
        c.ok((await ed.source()).includes('<p>Hier steht meixn Text.</p>'), 'cancelling keeps the page with the typed letter');
        for (const id of ['dlgLink', 'dlgImage', 'dlgInfo']) c.ok(await ed.eval('!!document.getElementById("' + id + '").querySelector("h3, #infoText")'), 'dialog ' + id + ' has a grip');
      });
    },
  },
  {
    id: 'F-09', title: '"Im Browser öffnen" opens the saved file next to the editor in a new tab without connection; unsaved pages are saved first',
    async run(c, { browser }) {
      const folder = editorFolder('f09-ordner');
      const file = folder.put('meine seite #1.html', page('<p>Gespeichert</p>'));
      await withEditor(browser, { artefact: folder.artefact, init: OPEN_MOCK, noFsa: true }, async (ed) => {
        const opened = () => ed.eval('JSON.stringify(window.f09Opened)').then(JSON.parse);
        await ed.click('bBrowse');
        await ed.until('document.getElementById("dlgConfirm").open', 'question for a page never saved');
        c.ok((await ed.eval('document.getElementById("confirmText").textContent')).includes('noch nicht gespeichert'), 'a page that was never saved is not opened: the pupil is asked to save first');
        await ed.dialogButton('dlgConfirm', 'Abbrechen');
        c.eq((await opened()).length, 0, 'cancelled: nothing is opened');
        await ed.openFile(file);
        await ed.click('bBrowse');
        await sleep(100);
        const calls = await opened();
        const here = await ed.eval('location.href.slice(0, location.href.lastIndexOf("/") + 1)');
        c.eq(JSON.stringify(calls), JSON.stringify([[here + 'meine%20seite%20%231.html', '_blank', 'noopener']]), 'an opened, unchanged page: its file next to the editor in a new tab, with noopener');
        c.ok((await ed.status()).includes('Datei nicht gefunden'), 'the status line says what "file not found" would mean', await ed.status());
        await ed.caret('Gespeichert', 3);
        await ed.type('x');
        await ed.settle();
        await ed.click('bBrowse');
        await ed.until('document.getElementById("dlgConfirm").open', 'question for unsaved changes');
        c.ok((await ed.eval('document.getElementById("confirmText").textContent')).includes('Änderungen'), 'with unsaved changes the pupil is asked "Erst speichern?"');
        const saved = await ed.download(null, () => ed.dialogButton('dlgConfirm', 'Speichern'));
        c.ok(saved.text.includes('<p>Gesxpeichert</p>'), 'saving is a download in a browser without file access, with the typed letter');
        await sleep(100);
        c.eq((await opened()).length, 1, 'then nothing is opened: the saved copy is in "Downloads", not next to the editor');
        c.ok((await ed.status()).includes('Downloads'), 'and the status line says where it is', await ed.status());
        c.note('mock', 'window.open is replaced by a recorder (init script); the tab itself is not opened by the test. Opening a neighbouring file with noopener was observed by hand in Edge 157 before this version');
      });
    },
  },
  {
    id: 'F-10', title: 'the title field changes <title> in the head and nothing else; a page without a title gets one',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {      // Ctrl+S is a download, as without file access
        const titleField = () => ed.eval('document.getElementById("pvTitle").value');
        const setTitle = async (text) => { await ed.field('pvTitle', text); await ed.key('Enter'); await ed.settle(); };
        c.eq(await titleField(), 'Meine Seite', 'the field shows the title of the new page');
        const start = await ed.source();
        await setTitle('Mein Hobby & ich <3');
        c.eq(await ed.source(), start.replace('<title>Meine Seite</title>', '<title>Mein Hobby &amp; ich &lt;3</title>'), 'the title is written with & and < escaped, nothing else changes');
        c.eq(await ed.eval('new DOMParser().parseFromString(document.getElementById("src").value, "text/html").title'), 'Mein Hobby & ich <3', 'the parsed page has this title');
        await ed.click('bUndo');
        await ed.settle();
        c.eq(await ed.source() + '|' + await titleField(), start + '|Meine Seite', 'undo restores the title, also in the field');
        const noTitle = '<!DOCTYPE html>\n<html>\n<head>\n  <meta charset="utf-8">\n</head>\n<body>\n<p>x</p>\n</body>\n</html>\n';
        await ed.openText('f10-ohne.html', noTitle);
        c.eq(await titleField(), '', 'a page without title shows an empty field');
        await setTitle('Neu');
        c.eq(await ed.source(), noTitle.replace('<head>\n', '<head>\n  <title>Neu</title>\n'), 'a missing title is added as the first line of the head, indented like the next line');
        await ed.openText('f10-svg.html', '<html><body><p>x<svg width="10" height="10"><title>Kreis</title></svg></p></body></html>');
        await setTitle('Seite');
        c.eq(await ed.source(), '<html>\n<title>Seite</title><body><p>x<svg width="10" height="10"><title>Kreis</title></svg></p></body></html>', 'the title of an SVG drawing is not the page title: a page title is added after <html>');
        await ed.openText('f10-teil.html', '<p>Nur ein Absatz</p>\n');
        await setTitle('Teil');
        c.eq(await ed.source(), '<title>Teil</title>\n<p>Nur ein Absatz</p>\n', 'a page without head, html and doctype gets the title in front');
        const unclosed = '<!DOCTYPE html>\n<title>Hallo\n<p>Text</p>\n';
        await ed.openText('f10-offen.html', unclosed);
        await setTitle('Anders');
        c.eq(await ed.source(), unclosed, 'a title element that is not closed is left alone');
        c.ok((await ed.status()).includes('links im Code'), 'and the pupil is told to change it in the code', await ed.status());
        await ed.openText('f10-speichern.html', page('<p>Text</p>', 'Alt'));
        await ed.field('pvTitle', 'Gespeichert');
        const saved = await ed.download(null, () => ed.key('s', ['ctrl']));
        c.ok(saved.text.includes('<title>Gespeichert</title>'), 'Ctrl+S while typing in the field saves the new title');
        await ed.openText('f10-gesperrt.html', page('<p>offen <b>fett</p>', 'Alt'));
        await setTitle('Trotzdem');
        c.ok((await ed.source()).includes('<title>Trotzdem</title>') && (await ed.source()).includes('<p>offen <b>fett</p>'), 'a page whose body cannot be edited still gets its new title; the body stays as written');
      });
    },
  },
  {
    id: 'F-11', title: 'the top bar: save state bold and coloured, groups of buttons separated',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const look = () => ed.eval('JSON.stringify(((s) => [document.getElementById("docState").textContent, s.fontWeight, s.color])(getComputedStyle(document.getElementById("docState"))))').then(JSON.parse);
        const clean = await look();
        await ed.caret('mein Text.', 3);
        await ed.type('x');
        await ed.settle();
        const dirty = await look();
        c.ok(clean[0] === 'gespeichert' && Number(clean[1]) >= 700, '"gespeichert" is bold', JSON.stringify(clean));
        c.ok(dirty[0] === '● nicht gespeichert' && Number(dirty[1]) >= 700 && dirty[2] !== clean[2], '"nicht gespeichert" is bold in another colour', JSON.stringify(dirty));
        const groups = JSON.parse(await ed.eval('JSON.stringify(Array.from(document.querySelectorAll("#top > .group, #fmt > .group"), (g) => [getComputedStyle(g).borderLeftWidth, parseFloat(getComputedStyle(g).columnGap)]))'));
        // four groups in the top bar, then the groups above the page; the first of those needs no line in front
        c.ok(groups.length === 9 && groups[4][0] === '0px' && groups.filter((g, i) => i !== 4).every((g) => g[0] === '1px') && groups.every((g) => g[1] <= 4), 'groups are separated by a line; buttons inside a group stand close together', JSON.stringify(groups));
      });
    },
  },
];
