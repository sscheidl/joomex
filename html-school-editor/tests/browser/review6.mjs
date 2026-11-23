// Cases A5-01 … A5-14 for the findings of the independent review of 0.1.0-alpha.4 and 0.1.0-alpha.5. Each case
// follows the reviewer's reproduction; expected source texts and bytes are written by hand.
import { Editor, PV, sleep, tmpFile, makePng, editorFolder } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body, head = '') => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>A5</title>\n' + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const rect = (ed, expr) => ed.eval('JSON.stringify((({ left, right, top, bottom }) => ({ left: Math.round(left), right: Math.round(right), top: Math.round(top), bottom: Math.round(bottom) }))((' + expr + ').getBoundingClientRect()))').then(JSON.parse);
// The attributes of the first element `name` of an HTML text, as the browser's parser reads them.
const parsedAttrs = (ed, text, name) => ed.eval('JSON.stringify(Array.from(new DOMParser().parseFromString(' + JSON.stringify(text) + ', "text/html").querySelector("' + name + '").attributes, (a) => [a.name, a.value]))').then(JSON.parse);
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
// A file handle of a labelled mock: the first close waits until the test releases it.
// Where the browser allows it (Firefox), the writes go into a real origin-private file; otherwise (Edge from a
// file address refuses it) they are only recorded.
const HELD_SAVE = `window.a5 = { opened: 0, closes: [], held: null, medium: '' };
  window.a5File = async () => (await (await navigator.storage.getDirectory()).getFileHandle('a5-ziel.html', { create: true }));
  const a5Handle = { name: 'a5-ziel.html', createWritable: async () => { const n = ++window.a5.opened; let text = '', real = null;
    try { real = await (await window.a5File()).createWritable(); window.a5.medium = 'real origin-private file'; } catch (e) { window.a5.medium = 'recorded only (' + e.name + ')'; }
    return { write: async (blob) => { text = await blob.text(); if (real) await real.write(blob); },
      close: async () => { if (n === 1) await new Promise((r) => { window.a5.held = r; }); if (real) await real.close(); window.a5.closes.push(text); } }; } };
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => a5Handle });`;
const OPEN_MOCK = 'window.a5Opened = []; window.open = function (...args) { window.a5Opened.push(args); return null; };';
const HELD_DECODE = `window.a5Held = 0; window.a5Release = [];
  const a5Bitmap = window.createImageBitmap;
  window.createImageBitmap = async (...args) => {
    const bitmap = await a5Bitmap.apply(window, args);
    if (args[0].name && args[0].name.startsWith('a5-langsam')) { window.a5Held++; await new Promise((resolve) => { window.a5Release.push(resolve); }); }
    return bitmap;
  };`;

export const review6 = [
  {
    id: 'A5-01', title: 'review finding ATTR: removing the width of <img src=tile.png width="20"alt=diagram> keeps address and description',
    async run(c, { browser }) {
      const folder = editorFolder('a5-01-ordner');
      folder.put('tile.png', makePng(40, 20, false));
      await withEditor(browser, { artefact: folder.artefact }, async (ed) => {
        const source = page('<p><img src=tile.png width="20"alt=diagram></p>');
        await ed.openText('a5-01.html', source);
        c.eq(JSON.stringify(await parsedAttrs(ed, source, 'img')), JSON.stringify([['src', 'tile.png'], ['width', '20'], ['alt', 'diagram']]), 'the browser reads three attributes');
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bImage');
        await ed.field('imgWidth', '');
        await ed.dialogButton('dlgImage', 'Übernehmen');
        await ed.settle();
        const expected = page('<p><img src=tile.png alt=diagram></p>');
        c.eq(await ed.source(), expected, 'only the width goes; the space in front of alt stays and separates it from the address');
        const saved = (await ed.download()).text;
        c.eq(saved, expected, 'the downloaded file is exactly that');
        c.eq(JSON.stringify(await parsedAttrs(ed, saved, 'img')), JSON.stringify([['src', 'tile.png'], ['alt', 'diagram']]), 'and the browser reads address and description from it');
      });
    },
  },
  {
    id: 'A5-02', title: 'review finding IMG-QUERY: accepting the image dialog unchanged keeps "tile.png?view=class/2"',
    async run(c, { browser }) {
      const folder = editorFolder('a5-02-ordner');
      folder.put('tile.png', makePng(40, 20, false));
      await withEditor(browser, { artefact: folder.artefact }, async (ed) => {
        const source = page('<p><img src="tile.png?view=class/2" alt="Kachel"></p>');
        await ed.openText('a5-02.html', source);
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bImage');
        c.eq(await ed.eval('document.getElementById("imgDir").value + "|" + document.getElementById("imgCode").textContent'), '|Im Code steht dann: <img src="tile.png?view=class/2">', 'the dialog proposes the address as written, with no folder');
        await ed.dialogButton('dlgImage', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), source, 'accepting unchanged changes nothing');
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bImage');
        await ed.field('imgDir', 'bilder');
        await ed.dialogButton('dlgImage', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), page('<p><img src="bilder/tile.png?view=class/2" alt="Kachel"></p>'), 'another folder changes only the folder; the query stays');
        c.eq((await ed.download()).text, page('<p><img src="bilder/tile.png?view=class/2" alt="Kachel"></p>'), 'the downloaded file is exactly that');
      });
    },
  },
  {
    id: 'A5-03', title: 'review finding MEDIA: "Code aufräumen" refuses when a style element applies only under a media condition',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const compact = (media, css) => '<!DOCTYPE html><html><head><title>M</title><style media="' + media + '">' + css + '</style></head><body><p>Eins</p><p>Zwei</p></body></html>';
        const risky = compact('(min-width:1500px)', 'p{display:inline}');
        await ed.openText('a5-03.html', risky);
        const r = await ed.format();
        c.eq(r.outcome, 'refused', 'tidying is refused', r.text);
        c.ok(r.text.includes('nur unter bestimmten Bedingungen'), 'with the explanation for conditional rules', r.text);
        c.eq(await ed.source(), risky, 'the code is unchanged');
        const plain = compact('all', 'p{color:red}');
        await ed.openText('a5-03-alle.html', plain);
        const p = await ed.format();
        c.eq(p.outcome, 'applied', 'control: media="all" with a colour rule is tidied', p.text);
      });
    },
  },
  {
    id: 'A5-04', title: 'review finding WRITES: a second save waits for the first, so the newest text is written last',
    async run(c, { browser }) {
      await withEditor(browser, { init: HELD_SAVE }, async (ed) => {
        await ed.caret('mein Text.', 3);
        await ed.type('X');
        await ed.settle();
        await ed.key('s', ['ctrl']);
        await ed.until('!!window.a5.held', 'first save waits in close');
        await ed.caret('meiXn Text.', 4);
        await ed.type('Y');
        await ed.settle();
        await ed.key('s', ['ctrl']);
        await sleep(300);
        c.eq(await ed.eval('window.a5.opened'), 1, 'the second save has not started writing while the first is not finished');
        await ed.eval('window.a5.held()');
        await ed.until('window.a5.closes.length === 2', 'both saves finished');
        const closes = await ed.eval('JSON.stringify(window.a5.closes)').then(JSON.parse);
        c.ok(closes[0].includes('meiXn Text.') && closes[1].includes('meiXYn Text.'), 'the file gets the older text first and the newer text last', JSON.stringify(closes.map((t) => /mei\w*n Text/.exec(t)[0])));
        c.eq(await ed.dirtyText(), 'gespeichert', 'and the editor shows the page as saved');
        const medium = await ed.eval('window.a5.medium');
        if (medium.startsWith('real')) c.eq(await ed.eval('window.a5File().then((h) => h.getFile()).then((f) => f.text())'), await ed.source(), 'the real file holds the newest text');
        else c.skip('real file', 'the browser refuses an origin-private file here: ' + medium);
        c.note('mock', 'showSaveFilePicker returns a labelled mock handle whose first close is held by the test; medium: ' + medium);
      });
    },
  },
  {
    id: 'A5-05', title: 'review finding BROWSE-SWITCH: another page opened while "Im Browser öffnen" saves is not opened in a tab',
    async run(c, { browser }) {
      const folder = editorFolder('a5-05-ordner');
      const a = folder.put('a5-a.html', page('<p>Seite A</p>'));
      const b = folder.put('a5-b.html', page('<p>Seite B</p>'));
      await withEditor(browser, { artefact: folder.artefact, init: HELD_SAVE + OPEN_MOCK }, async (ed) => {
        await ed.openFile(a);
        await ed.caret('Seite A', 2);
        await ed.type('x');
        await ed.settle();
        await ed.click('bBrowse');
        await ed.until('document.getElementById("dlgConfirm").open', 'question before saving');
        await ed.dialogButton('dlgConfirm', 'Speichern');
        await ed.until('!!window.a5.held', 'save of A waits in close');
        await ed.openFile(b);
        await ed.eval('window.a5.held()');
        await ed.until('window.a5.closes.length === 1', 'save of A finished');
        await sleep(300);
        c.ok((await ed.eval('window.a5.closes[0]')).includes('<p>Sexite A</p>'), 'the file holds page A with the change');
        c.eq(await ed.eval('JSON.stringify(window.a5Opened)'), '[]', 'no tab is opened: page B was not asked for');
        c.ok((await ed.source()).includes('<p>Seite B</p>'), 'the editor shows page B');
        c.note('mock', 'showSaveFilePicker returns a labelled mock handle with a held close; window.open is recorded');
      });
    },
  },
  {
    id: 'A5-06', title: 'review finding STYLE-SPLIT: removing bold from one letter keeps the colour of the bold rest',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.openText('a5-06.html', page('<p><b style="color:red">ABCD</b> und <i class="k">efgh</i></p>'));
        await ed.caret('ABCD', 1, 2);
        await ed.click('bBold');
        await ed.settle();
        const expected = page('<p><b style="color:red">A</b>B<b style="color:red">CD</b> und <i class="k">efgh</i></p>');
        c.eq(await ed.source(), expected, 'the part behind the cut is a copy with the same style');
        await ed.caret('efgh', 1, 3);
        await ed.click('bItalic');
        await ed.settle();
        const both = expected.replace('<i class="k">efgh</i>', '<i class="k">e</i>fg<i class="k">h</i>');
        c.eq(await ed.source(), both, 'the same for a class');
        c.eq((await ed.download()).text, both, 'the downloaded file is exactly that');
      });
    },
  },
  {
    id: 'A5-07', title: 'review finding LIST: a list over two paragraphs with a line between them keeps the order',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const source = page('<p>A eins</p>\n<hr>\n<p>B zwei</p>');
        await ed.openText('a5-07.html', source);
        await ed.selectNodes('d.querySelectorAll("p")[0].firstChild', 'd.querySelectorAll("p")[1].firstChild');
        await ed.click('bUl');
        await ed.settle();
        const order = await ed.eval('JSON.stringify(Array.from(new DOMParser().parseFromString(document.getElementById("src").value, "text/html").body.children, (e) => e.localName + (e.children.length ? ":" + Array.from(e.children, (k) => k.localName + "=" + k.textContent).join() : "")))');
        c.eq(order, JSON.stringify(['ul:li=A eins', 'hr', 'ul:li=B zwei']), 'each paragraph becomes a list of its own, the line stays between them');
        await ed.click('bUndo');
        await ed.settle();
        c.eq(await ed.source(), source, 'undo gives back the text as written');
      });
    },
  },
  {
    id: 'A5-08', title: 'review finding IMG-PENDING: "Einfügen" waits while the newest picture is still being checked',
    async run(c, { browser }) {
      const folder = editorFolder('a5-08-ordner');
      const fast = folder.put('a5-schnell.png', makePng(30, 15, false)), slow = folder.put('a5-langsam.png', makePng(20, 10, false));
      await withEditor(browser, { init: HELD_DECODE, artefact: folder.artefact }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.click('bImage');
        await ed.pickImage(fast);
        await ed.page.setFiles('#imgIn', [slow]);
        await ed.until('window.a5Held === 1', 'check of the second picture is held');
        await ed.dialogButton('dlgImage', 'Einfügen');
        c.eq(await ed.dialogOpen('dlgImage'), true, 'the dialog stays open');
        c.ok((await ed.eval('document.getElementById("imgErr").textContent')).includes('noch geprüft'), 'and says that the picture is still being checked');
        c.ok(!(await ed.source()).includes('<img'), 'nothing is inserted yet');
        await ed.eval('window.a5Release.shift()()');
        await ed.until('document.getElementById("imgName").textContent.startsWith("a5-langsam.png (")', 'second picture accepted');
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        const src = await ed.source();
        c.ok(src.includes('<img src="a5-langsam.png"') && !src.includes('a5-schnell'), 'the newest choice is inserted', src.split('\n')[8]);
      });
    },
  },
  {
    id: 'A5-09', title: 'review finding NOTICE: a switched-off icon link in the head is named in the note',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const source = page('<p>x</p>', '  <link rel="icon" href="symbol.png">\n');
        await ed.openText('a5-09.html', source);
        c.eq(await ed.inactiveNote(), 'Im Editor ausgeschaltet: 1 weiterer Verweis.', 'the note names the link');
        c.eq(await ed.eval(PV + '.querySelectorAll("link").length'), 0, 'the page pane has no link element');
        c.eq((await ed.download()).text, source, 'the link stays in the saved file');
      });
    },
  },
  {
    id: 'A5-10', title: 'review finding TITLE-RELOAD: a title typed into the field and not taken over counts as unsaved',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const leave = () => ed.eval('(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })()');
        c.eq(await ed.dirtyText() + '|' + await leave(), 'noch keine Datei|false', 'a fresh page is saved and may be closed');
        await ed.field('pvTitle', 'Neuer Titel');
        c.eq(await ed.eval('document.activeElement.id'), 'pvTitle', 'the field keeps the focus');
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'while typing the page shows "nicht gespeichert"');
        c.eq(await leave(), true, 'and closing the tab asks first (beforeunload is prevented)');
        await ed.key('Escape');
        c.eq(await ed.dirtyText() + '|' + await leave(), 'noch keine Datei|false', 'Escape takes the typing back: saved again');
      });
    },
  },
  {
    id: 'A5-11', title: 'review finding DIALOG-RESIZE: a moved dialog stays inside the window when the window becomes narrower',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.page.setViewport(1400, 800);
        await sleep(200);
        await ed.click('bHelp');
        await dragBy(ed, 'document.querySelector("#dlgHelp h3")', 3000, 0);
        const wide = await rect(ed, 'document.getElementById("dlgHelp")');
        c.ok(wide.right >= 1390, 'the help dialog is dragged to the right edge', JSON.stringify(wide));
        await ed.page.setViewport(640, 800);
        await ed.until('innerWidth === 640', 'viewport narrowed');
        await sleep(200);
        const narrow = await rect(ed, 'document.getElementById("dlgHelp")');
        const button = await rect(ed, 'Array.from(document.querySelectorAll("#dlgHelp button")).pop()');
        c.ok(narrow.left >= 0 && narrow.right <= 640, 'after narrowing it lies inside the window', JSON.stringify(narrow));
        c.ok(button.left >= 0 && button.right <= 640 && button.bottom <= 800, 'its button can be reached', JSON.stringify(button));
        await ed.dialogButton('dlgHelp', 'Schließen');
        c.eq(await ed.dialogOpen('dlgHelp'), false, 'and closes the dialog');
        await ed.page.setViewport();
      });
    },
  },
  {
    id: 'A5-12', title: 'review finding TARGET-CASE: TARGET="_BLANK" is shown as "new tab" and can be unticked',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.openText('a5-12.html', page('<p><a href="x.html" TARGET="_BLANK">Ziel</a></p>'));
        await ed.caret('Ziel', 1);
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkNew").checked'), true, 'the box is ticked');
        await ed.eval('document.getElementById("linkNew").click()');
        await ed.dialogButton('dlgLink', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), page('<p><a href="x.html">Ziel</a></p>'), 'unticking removes the target');
      });
    },
  },
  {
    id: 'A5-13', title: 'review finding ALIGN: changing the alignment keeps the spelling of the rest of the style, references and outer spaces included',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const source = page('<p style=" color: red; font-family: &#34;A B&#34;; text-align: center ">Text</p>');
        await ed.openText('a5-13.html', source);
        await ed.caret('Text', 1);
        await ed.click('bAlignLeft');
        await ed.settle();
        c.eq(await ed.source(), page('<p style=" color: red; font-family: &#34;A B&#34; ">Text</p>'), 'left: only the text-align declaration goes');
        await ed.caret('Text', 1);
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), source, 'centred again: the original text is back');
        c.eq((await ed.download()).text, source, 'the downloaded file is exactly that');
      });
    },
  },
  {
    id: 'A5-14', title: 'review finding BYTES: three line feeds in a row outnumber two CRLF; BOM and text are kept',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const text = '<!DOCTYPE html>\r\n<p>Grüße 😀</p>\r\n<p>a</p>\n\n\n<p>b</p>';
        await ed.openFile(tmpFile('a5-14.html', '﻿' + text));
        const saved = await ed.download();
        const expected = Buffer.from('﻿' + text.replace(/\r\n/g, '\n'), 'utf8');
        c.ok(saved.bytes.equals(expected), 'written with LF, the line end of the majority, and with BOM', JSON.stringify(saved.text.slice(0, 60)));
      });
    },
  },
];
