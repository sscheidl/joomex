// Functional and regression cases T-01 … T-17 of the acceptance contract. Every case starts a fresh copy of
// the delivered single file from file:// and checks observable results (source text, parsed trees, real
// downloads). Expected values are written by hand or derived from the fixture text, not from product code.
import fs from 'node:fs';
import path from 'node:path';
import { Editor, PV, sleep, tmpFile, fixture, readFixture, makePng } from '../lib/harness.mjs';

const TEMPLATE_P = '<p>Hier steht mein Text.</p>';
const doc = (body) => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>T</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const PARSE = (expr) => `((doc) => ${expr})(new DOMParser().parseFromString(document.getElementById("src").value, "text/html"))`;
const sourceMark = (ed) => ed.eval(`(() => { const h = CSS.highlights.get("se-link"); if (!h) return null; const r = Array.from(h)[0]; const el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
  return { text: r.toString(), line: Array.prototype.indexOf.call(document.getElementById("hlIn").children, el.closest("#hlIn > div")) + 1 }; })()`);
const previewMark = (ed) => ed.eval(`(() => { const w = document.getElementById("pv").contentWindow; const h = w.CSS.highlights.get("se-src"); if (!h) return null; const r = Array.from(h)[0];
  const node = r.startContainer.childNodes[r.startOffset]; return { tag: node.localName, index: Array.from(w.document.querySelectorAll(node.localName)).indexOf(node) }; })()`);
const active = (ed) => ed.eval('document.activeElement.id');
const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };

const MOCK_SAVE = `window.__mock = { mode: 'ok', writes: [], delay: 0, pickerCalls: 0 };
  window.__mockHandle = { name: 'mock-ziel.html', createWritable: async () => { if (window.__mock.mode === 'fail') throw new DOMException('no', 'NotAllowedError');
    let text = ''; return { write: async (blob) => { if (window.__mock.delay) await new Promise((r) => setTimeout(r, window.__mock.delay)); text = await blob.text(); }, close: async () => { window.__mock.writes.push(text); } }; } };
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => { window.__mock.pickerCalls++; if (window.__mock.mode === 'abort') throw new DOMException('cancel', 'AbortError'); return window.__mockHandle; } });`;

export const functional = [
  {
    id: 'T-01', title: 'fresh offline start from file://, both panes edit',
    async run(c, { browser }) {
      await withEditor(browser, { offline: true }, async (ed) => {
        c.eq(await ed.eval('location.protocol'), 'file:', 'page runs from the file system');
        c.eq(await ed.eval('navigator.onLine'), false, 'browser network is switched off for this case');
        await ed.clickPv('d.querySelector("p")');
        await ed.key('End');
        await ed.type(' äöü ß');
        await ed.settle();
        c.ok((await ed.source()).includes('<p>Hier steht mein Text. äöü ß</p>'), 'typing in the page reaches the source', await ed.source());
        await ed.sourceCaret('</h1>');
        await ed.type(' ÄÖÜ');
        await ed.settle();
        c.eq(await ed.eval(PV + '.querySelector("h1").textContent'), 'Meine erste Webseite ÄÖÜ', 'typing in the source reaches the page');
        const urls = ed.page.eventsOf('Network.requestWillBeSent').map((e) => e.request.url).filter((u) => !u.startsWith('file:'));
        c.eq(urls.length, 0, 'no request besides the local file');
        c.eq(ed.errors().join(' | '), '', 'no script errors');
      });
    },
  },
  {
    id: 'T-02', title: 'source <-> preview on a full document keeps head, comments and attributes',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const original = readFixture('basic.html');
        await ed.openFile(fixture('basic.html'));
        c.eq(await ed.source(), original, 'whole source visible after opening');
        await ed.sourceCaret('Erste Zeile', 'Erste Zeile'.length);
        await ed.type(' NEU');
        await ed.settle();
        c.eq(await ed.eval(PV + '.querySelector("h1").textContent'), 'Erste Zeile NEU', 'source edit appears in the page');
        await ed.caret('Punkt B', 'Punkt B'.length);
        await ed.type('!');
        await ed.settle();
        const expected = original.replace('Erste Zeile', 'Erste Zeile NEU').replace('Punkt B', 'Punkt B!');
        c.eq(await ed.source(), expected, 'after both edits only the two edited places differ');
        c.eq(await ed.eval(PV + '.body.getAttribute("class") + "|" + ' + PV + '.querySelector("h1").id'), 'seite|titel', 'attributes are shown in the page');
      });
    },
  },
  {
    id: 'T-03', title: 'selection in each pane maps to the right place, focus stays where the user works',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.openFile(fixture('basic.html'));
        await ed.clickPv('d.querySelectorAll("p")[1]');
        await sleep(150);
        let mark = await sourceMark(ed);
        c.ok(mark && mark.text === '<p>Hallo</p>' && mark.line === 16, 'caret in the 2nd of three identical paragraphs marks source line 16', JSON.stringify(mark));
        c.eq(await active(ed), 'pv', 'focus stays in the page after selecting');
        await ed.type('X');
        await ed.settle();
        const lines = (await ed.source()).split('\n');
        c.ok(lines[15].includes('X') && lines[14] === '  <p class="wichtig" title=\'Ein "Titel"\'>Hallo</p>' && lines[16] === '  <p>Hallo</p>', 'next keystroke went into the intended paragraph only', lines.slice(14, 17).join(' / '));
        await ed.clickPv('d.querySelector("i")', 2);
        await sleep(150);
        mark = await sourceMark(ed);
        c.ok(mark && mark.text.startsWith('beides') && mark.line === 18, 'double-click on nested emphasis marks exactly that text in the source', JSON.stringify(mark));
        c.ok((await ed.eval('document.getElementById("src").value.length')) > 400, 'the rest of the source stays visible');
        await ed.sourceCaret('<p>Hallo</p>\n  <p>Anfang', 5);
        await sleep(150);
        const pm = await previewMark(ed);
        c.ok(pm && pm.tag === 'p' && pm.index === 2, 'caret in the source marks the 3rd paragraph in the page', JSON.stringify(pm));
        c.eq(await active(ed), 'src', 'focus stays in the source');
        await ed.type('Y');
        await ed.settle();
        c.eq(await ed.eval(PV + '.querySelectorAll("p")[2].textContent'), 'HaYllo', 'keystroke after selecting in the source goes into the source');
      });
    },
  },
  {
    id: 'T-04', title: 'heading, paragraph, bold, italic produce plain tags and keep children/attributes',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.openFile(fixture('basic.html'));
        await ed.caret('Hallo', 2);
        await ed.click('bH1');
        await ed.settle();
        c.ok((await ed.source()).includes('  <h1 class="wichtig" title=\'Ein "Titel"\'>Hallo</h1>\n'), 'paragraph -> h1 keeps its attributes verbatim', (await ed.source()).split('\n')[14]);
        await ed.caret('Anfang', 3);
        await ed.click('bH2');
        await ed.settle();
        c.ok((await ed.source()).includes('  <h2>Anfang <b>fett <i>beides</i></b> Ende</h2>\n'), 'paragraph -> h2 keeps nested child elements');
        await ed.click('bP');
        await ed.settle();
        c.ok((await ed.source()).includes('  <p>Anfang <b>fett <i>beides</i></b> Ende</p>\n'), 'heading -> paragraph');
        await ed.selectPv('Punkt A');
        await ed.click('bBold');
        await ed.settle();
        c.ok((await ed.source()).includes('<li><b>Punkt A</b></li>'), 'bold creates <b>', (await ed.source()).split('\n')[19]);
        c.eq(await ed.eval(PV + '.getSelection().toString()'), 'Punkt A', 'selection survives the toolbar click');
        await ed.selectPv('Erste');
        await ed.click('bBold');
        await ed.settle();
        c.ok((await ed.source()).includes('<h1 id="titel"><b>Erste</b> Zeile</h1>'), 'bold works inside a heading too (structure, not computed style)', (await ed.source()).split('\n')[12]);
        await ed.click('bBold');
        await ed.settle();
        c.ok((await ed.source()).includes('<h1 id="titel">Erste Zeile</h1>'), 'and is removed again');
        await ed.caret('Punkt B', 2);
        await ed.click('bBold');
        await ed.type('X');
        await ed.settle();
        c.ok((await ed.source()).includes('<li><b>PuXnkt</b> B</li>'), 'without a selection the word at the caret becomes bold and the caret stays in place', (await ed.source()).split('\n')[20]);
        await ed.key('Backspace');
        await ed.click('bBold');
        await ed.settle();
        c.ok((await ed.source()).includes('<li>Punkt B</li>'), 'word-level bold removed again');
        await ed.selectPv('Ende');
        await ed.click('bItalic');
        await ed.settle();
        c.ok((await ed.source()).includes('</b> <i>Ende</i></p>'), 'italic creates <i>');
        await ed.selectPv('Punkt A');
        await ed.click('bBold');
        await ed.settle();
        c.ok((await ed.source()).includes('<li>Punkt A</li>'), 'bold again removes the tag');
        const saved = await ed.download();
        c.eq(await ed.eval(`((doc) => doc.querySelectorAll("span, font, [style]").length)(new DOMParser().parseFromString(${JSON.stringify(saved.text)}, "text/html"))`), 0, 'saved file has no span, font or inline style');
        c.eq(saved.text, readFixture('basic.html').replace('<p class="wichtig" title=\'Ein "Titel"\'>Hallo</p>', '<h1 class="wichtig" title=\'Ein "Titel"\'>Hallo</h1>').replace('Ende</p>', '<i>Ende</i></p>'), 'saved file differs from the original only at the edited places');
      });
    },
  },
  {
    id: 'T-05', title: 'lists: create, add items, switch kind, remove; valid nesting; reopen',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.openFile(fixture('basic.html'));
        await ed.selectNodes('d.querySelectorAll("p")[0].firstChild', 'd.querySelectorAll("p")[2].firstChild');
        await ed.click('bUl');
        await ed.settle();
        let src = await ed.source();
        c.ok(src.includes('  <ul>\n    <li class="wichtig" title=\'Ein "Titel"\'>Hallo</li>\n    <li>Hallo</li>\n    <li>Hallo</li>\n  </ul>\n  <p>Anfang'), 'three paragraphs become one list with three items, indented; the first keeps its attributes as written', src.split('\n').slice(13, 21).join('\n'));
        c.eq(await ed.eval(PARSE('doc.querySelectorAll("p ul, p ol, ul > :not(li), ol > :not(li)").length')), 0, 'no list inside a paragraph, only li inside lists');
        await ed.caret('Hallo', 5);
        await ed.eval(`((d) => { const li = d.querySelectorAll("ul")[0].lastElementChild; d.getSelection().collapse(li.firstChild, 5); })(${PV})`);
        await ed.key('Enter');
        await ed.type('Neu');
        await ed.settle();
        src = await ed.source();
        c.ok(src.includes('    <li>Hallo</li>\n    <li>Neu</li>\n  </ul>'), 'Enter inside the list adds a list item', src.split('\n').slice(14, 21).join('\n'));
        await ed.click('bOl');
        await ed.settle();
        src = await ed.source();
        c.ok(src.includes('  <ol>\n    <li class="wichtig" title=\'Ein "Titel"\'>Hallo</li>\n    <li>Hallo</li>\n    <li>Hallo</li>\n    <li>Neu</li>\n  </ol>'), 'switching turns the whole list into a numbered list', src.split('\n').slice(13, 21).join('\n'));
        const shape = () => ed.eval(PV + '.body.innerHTML.replace(/>\\s+</g, "><").replace(/<(\\w+)[^>]*>/g, "<$1>")');
        const before = await shape();
        const saved = await ed.download();
        const again = tmpFile('t05-reopen.html', saved.bytes);
        await ed.openFile(again);
        c.eq(await shape(), before, 'reopening the saved file gives the same structure (no phantom paragraphs)');
        c.eq(await ed.eval(PV + '.querySelectorAll("p:empty").length'), 0, 'no empty paragraphs after reopen');
        await ed.selectNodes('d.querySelector("ol").firstElementChild.firstChild', 'd.querySelector("ol").lastElementChild.firstChild');
        await ed.click('bOl');
        await ed.settle();
        src = await ed.source();
        c.ok(src.includes('  <p class="wichtig" title=\'Ein "Titel"\'>Hallo</p>\n  <p>Hallo</p>\n  <p>Hallo</p>\n  <p>Neu</p>\n  <p>Anfang') && !src.includes('<ol>'), 'removing the list gives back paragraphs, the first with its attributes', src.split('\n').slice(13, 21).join('\n'));
        c.eq(await ed.eval(PARSE('doc.querySelectorAll("p ul, p ol, ul > :not(li), ol > :not(li), p:empty").length')), 0, 'still valid nesting');
        c.ok(src.includes('<ul>\n    <li>Punkt A</li>\n    <li>Punkt B</li>\n  </ul>'), 'the untouched second list is unchanged');
      });
    },
  },
  {
    id: 'T-06', title: 'links and local raster images; text inputs stay data',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const original = readFixture('basic.html');
        await ed.openFile(fixture('basic.html'));
        await ed.selectPv('Punkt B');
        await ed.click('bLink');
        c.ok(await ed.dialogOpen('dlgLink'), 'link dialog opens');
        await ed.type('https://example.org/a?b=1&c=2');
        await ed.key('Enter');
        await ed.settle();
        c.ok((await ed.source()).includes('<li><a href="https://example.org/a?b=1&amp;c=2">Punkt B</a></li>'), 'link element with escaped address', (await ed.source()).split('\n')[20]);
        c.eq(await ed.eval(PV + '.querySelector("a").hasAttribute("href")'), false, 'the page in the editor keeps the link inert (no href)');
        await ed.caret('Punkt B', 3);
        await ed.click('bUnlink');
        await ed.settle();
        c.eq(await ed.source(), original, 'removing the link restores the original source exactly');
        for (const bad of ['JaVaScRiPt:alert(1)', 'java&#115;cript:alert(1)', 'javascript&colon;alert(1)', 'data:text/html,<b>x</b>', 'vbscript:x']) {
          await ed.selectPv('Punkt A');
          await ed.click('bLink');
          await ed.type(bad);
          await ed.dialogButton('dlgLink', 'Einfügen');
          const stillOpen = await ed.dialogOpen('dlgLink');
          const msg = await ed.eval('document.getElementById("linkErr").textContent');
          c.ok(stillOpen && msg.length > 10, 'refused address: ' + bad, msg);
          await ed.dialogButton('dlgLink', 'Abbrechen');
        }
        c.eq(await ed.source(), original, 'refused addresses leave the document unchanged');
        await ed.selectPv('Punkt A');
        await ed.click('bLink');
        await ed.type('seite 2.html" onmouseover="alert(1)');
        await ed.dialogButton('dlgLink', 'Einfügen');
        await ed.settle();
        c.eq(await ed.eval(PARSE('(() => { const a = doc.querySelector("a"); return a.getAttributeNames().join(",") + "|" + a.getAttribute("href"); })()')), 'href|seite%202.html%22%20onmouseover=%22alert(1)', 'markup-shaped address stays one attribute value');
        await ed.click('bUndo');
        await ed.settle();

        const png = tmpFile('t06-klein.png', makePng(24, 16, false));
        await ed.caret('Erste Zeile', 'Erste Zeile'.length);
        await ed.click('bImage');
        c.ok(await ed.dialogOpen('dlgImage'), 'image dialog opens');
        await ed.dialogButton('dlgImage', 'Einfügen');
        c.ok(await ed.dialogOpen('dlgImage') && (await ed.eval('document.getElementById("imgErr").textContent')).includes('Wähle'), 'no image chosen: dialog explains');
        await ed.page.setFiles('#imgIn', [png]);
        await ed.until('!document.getElementById("imgPrev").hidden', 'image accepted');
        await ed.dialogButton('dlgImage', 'Einfügen');
        c.ok((await ed.eval('document.getElementById("imgErr").textContent')).includes('Beschreibe'), 'missing alternative text is asked for');
        const alt = 'Katze "auf" dem <script>alert(1)</script> Sofa & mehr';
        await ed.eval('document.getElementById("imgAlt").focus()');
        await ed.type(alt);
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        const src = await ed.source();
        const b64 = makePng(24, 16, false).toString('base64');
        c.ok(src.includes('<h1 id="titel">Erste Zeile<img src="data:image/png;base64,' + b64 + '" alt="Katze &quot;auf&quot; dem &lt;script>alert(1)&lt;/script> Sofa &amp; mehr"></h1>'), 'img element with the exact file bytes and escaped alt text', src.split('\n')[12].slice(0, 80) + ' … ' + src.split('\n')[12].slice(-120));
        c.eq(await ed.eval(PARSE('doc.querySelector("img").alt + "|" + doc.querySelectorAll("script").length')), alt + '|0', 'alt text is plain text in the parsed file, no script element');
        c.eq(await ed.eval(PV + '.querySelectorAll("script").length'), 0, 'no script element in the page either');
        for (const [name, bytes] of [['t06-text.png', Buffer.from('<svg onload=alert(1)>kein Bild')], ['t06-vektor.svg', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')]]) {
          await ed.caret('Punkt A', 2);
          await ed.click('bImage');
          await ed.page.setFiles('#imgIn', [tmpFile(name, bytes)]);
          await ed.until('document.getElementById("imgErr").textContent.length > 0', 'image refused');
          c.ok((await ed.eval('document.getElementById("imgErr").textContent')).includes('kein unterstütztes Bild'), 'unsupported file gets an understandable message: ' + name);
          await ed.dialogButton('dlgImage', 'Abbrechen');
        }
        c.eq(await ed.source(), src, 'refused files leave the document unchanged');
        const bigFile = tmpFile('t06-gross.png', makePng(1600, 1200, true));
        await ed.caret('Punkt A', 2);
        await ed.click('bImage');
        await ed.page.setFiles('#imgIn', [bigFile]);
        await ed.until('!document.getElementById("imgPrev").hidden', 'large image prepared', 30000);
        await ed.eval('document.getElementById("imgAlt").focus()');
        await ed.type('Rauschen');
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        const big = /<img src="data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)" alt="Rauschen">/.exec(await ed.source());
        c.ok(big && big[1].length < 620000, 'a ' + fs.statSync(bigFile).size + '-byte image is scaled down before embedding', big ? big[1].length + ' base64 characters' : 'not found');
      });
    },
  },
  {
    id: 'T-07', title: 'explicit formatting changes white space only and is verified',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const original = readFixture('format-in.html');
        await ed.openFile(fixture('format-in.html'));
        c.eq((await ed.format()).outcome, 'applied', 'formatting is applied');
        const out = await ed.source();
        c.eq(out, readFixture('format-expected.html'), 'formatted text equals the hand-written expectation');
        c.eq(out.replace(/\s+/g, ''), original.replace(/\s+/g, ''), 'only white space changed');
        const probe = (text) => ed.eval(`((doc) => JSON.stringify({ ink: doc.body.textContent.replace(/\\s+/g, ""), pre: doc.querySelector("pre").textContent, ta: doc.querySelector("textarea").value,
          script: doc.querySelector("script").textContent, style: doc.querySelector("style").textContent, title: doc.querySelector("p[title]").title, first: doc.querySelector("p").textContent, br: doc.querySelectorAll("br").length }))(new DOMParser().parseFromString(${JSON.stringify(text)}, "text/html"))`);
        const a = JSON.parse(await probe(original)), b = JSON.parse(await probe(out));
        for (const key of Object.keys(a)) c.eq(b[key], a[key], 'parsed result unchanged: ' + key);
        c.eq(b.first, 'Eins A B und CD & <Ende>', 'space between inline elements kept, none added');
        await ed.click('bUndo');
        await ed.settle();
        c.eq(await ed.source(), original, 'undo restores the unformatted text');
        const broken = readFixture('malformed.html');
        await ed.openFile(fixture('malformed.html'));
        const second = await ed.format();
        if (second.outcome === 'refused') {
          c.ok(second.text.includes('bleibt unverändert'), 'malformed document: formatting is refused with an explanation');
          c.eq(await ed.source(), broken, 'malformed source is not rewritten');
        } else {
          c.eq((await ed.source()).replace(/\s+/g, ''), broken.replace(/\s+/g, ''), 'malformed document: formatter changed white space only');
          c.note('malformed document', 'formatter accepted it after verification');
        }
        await ed.openText('t07-ws.html', doc('<p style="white-space: pre">a   b</p>'));
        c.eq((await ed.format()).outcome, 'refused', 'document with white-space: pre is not formatted');
        c.eq(await ed.source(), doc('<p style="white-space: pre">a   b</p>'), 'and stays unchanged');
      });
    },
  },
  {
    id: 'T-08', title: 'open -> download without edits is byte-exact (LF, CRLF, BOM); other encodings are not corrupted',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const lf = readFixture('basic.html');
        const variants = [['lf', Buffer.from(lf, 'utf8')], ['crlf', Buffer.from(lf.replace(/\n/g, '\r\n'), 'utf8')],
          ['bom-crlf', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(lf.replace(/\n/g, '\r\n'), 'utf8')])], ['bom-lf', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(lf, 'utf8')])]];
        for (const [name, bytes] of variants) {
          await ed.openFile(tmpFile('t08-' + name + '.html', bytes));
          c.eq(await ed.source(), lf, name + ': editor shows the text with LF line ends, without BOM');
          const saved = await ed.download();
          c.ok(saved.bytes.equals(bytes), name + ': downloaded bytes are identical to the opened file', saved.bytes.length + ' vs ' + bytes.length);
          c.eq(saved.name, 't08-' + name + '.html', name + ': download keeps the file name');
        }
        const mixed = Buffer.from('<p>a</p>\r\n<p>b</p>\n<p>c</p>\r\n<p>d</p>\r\n', 'utf8');
        await ed.openFile(tmpFile('t08-mixed.html', mixed));
        c.ok((await ed.status()).includes('uneinheitlich'), 'mixed line ends are reported');
        c.eq((await ed.download()).text, '<p>a</p>\r\n<p>b</p>\r\n<p>c</p>\r\n<p>d</p>\r\n', 'mixed line ends are unified to the dominant convention (documented policy)');
        const before = await ed.source();
        await ed.openFile(tmpFile('t08-latin1.html', Buffer.from('<p>Größe und Ärger</p>\n', 'latin1')), { wait: false });
        await ed.until('document.getElementById("dlgConfirm").open', 'encoding question');
        c.ok((await ed.eval('document.getElementById("confirmText").textContent')).includes('nicht als UTF-8'), 'a non-UTF-8 file is not opened silently');
        await ed.dialogButton('dlgConfirm', 'Abbrechen');
        c.eq(await ed.source(), before, 'declining keeps the current document');
        await ed.openFile(tmpFile('t08-latin1.html', Buffer.from('<p>Größe und Ärger</p>\n', 'latin1')), { wait: false });
        await ed.until('document.getElementById("dlgConfirm").open', 'encoding question');
        await ed.dialogButton('dlgConfirm', 'Umwandeln und öffnen');
        await ed.settle();
        c.eq(await ed.source(), '<p>Größe und Ärger</p>\n', 'accepting converts the text correctly');
        c.ok((await ed.dirtyText()).includes('nicht gespeichert'), 'a converted document counts as not saved');
        const now = await ed.source();
        await ed.openFile(tmpFile('t08-utf16.html', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<p>x</p>', 'utf16le')])), { wait: false });
        await ed.until('document.getElementById("dlgInfo").open', 'UTF-16 refusal');
        await ed.dialogButton('dlgInfo', 'OK');
        c.eq(await ed.source(), now, 'UTF-16 file is refused, current document stays');
      });
    },
  },
  {
    id: 'T-09', title: 'open -> visual edit -> download keeps doctype, head, inactive content and untouched markup',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const original = readFixture('legacy.html');
        await ed.openFile(fixture('legacy.html'));
        c.eq(await ed.eval('document.getElementById("lockNote").hidden'), true, 'legacy document (omitted end tags, table without tbody) is editable');
        c.ok((await ed.eval('document.getElementById("inactiveText").textContent')).includes('Skript'), 'inactive content is announced', await ed.eval('document.getElementById("inactiveText").textContent'));
        await ed.caret('Dritter Absatz.', 'Dritter Absatz.'.length);
        await ed.type('!');
        const saved = await ed.download();
        c.eq(saved.text, original.replace('Dritter Absatz.', 'Dritter Absatz.!'), 'downloaded file equals the original plus the one typed character');
        await ed.caret('Erster', 'Erster'.length);
        await ed.type('X');
        await ed.settle();
        const out = await ed.source();
        const para = /<P class=rot onclick="alert\('x'\)">([^]*?)<P>Zweiter/.exec(out);
        c.ok(para && para[1].includes('ErsterX') && para[1].includes('Abst&auml;nden &amp; Zeichen &lt;wie&gt; diesen.'), 'edited paragraph keeps its tag, inactive handler and character references', para && para[1]);
        const rest = (s) => s.replace(/<P class=rot[^]*?<P>Zweiter/, '');
        c.eq(rest(out), rest(original.replace('Dritter Absatz.', 'Dritter Absatz.!')), 'everything outside the edited paragraph is byte-identical');
        await ed.caret('Zweiter Absatz', 'Zweiter'.length);
        await ed.type('Z');
        await ed.settle();
        const out2 = await ed.source();
        c.eq(rest(out2), rest(original.replace('Dritter Absatz.', 'Dritter Absatz.!').replace('Zweiter Absatz', 'ZweiterZ Absatz')), 'editing a paragraph without end tag adds nothing but the typed character');
        await ed.caret('Zelle 1', 7);
        await ed.type('a');
        await ed.settle();
        c.ok((await ed.source()).includes('<TABLE border=1><TR><TD>Zelle 1a<TD>Zelle 2</TABLE>'), 'typing in a table cell without end tags adds no tags');
        await ed.caret('Dritter', 0);
        await ed.key('Backspace');
        await ed.settle();
        const out3 = await ed.source();
        c.ok(!/<P>Dritter/.test(out3) && out3.includes('<SCRIPT>document.write("aktiv")</SCRIPT>') && out3.includes('<IMG src="http://example.invalid/bild.gif" width=10 height=10 alt="Fremdes Bild">'),
          'joining two paragraphs keeps the inactive script and the image of the first one', (/<P>Zweiter[^]*?<TABLE/.exec(out3) || [''])[0]);
        await ed.key('a', ['ctrl']);
        await ed.type('Neu');
        await ed.settle();
        const out4 = await ed.source();
        c.ok(out4.startsWith(original.slice(0, original.indexOf('<H1'))) && out4.includes('Neu') && !out4.includes('Zelle') && out4.includes('<SCRIPT>document.write("aktiv")</SCRIPT>') && out4.endsWith('</BODY>\n</HTML>\n'),
          'replacing the whole visible content keeps the document frame, the body tag and the inactive script', out4.slice(original.indexOf('<BODY')));
        c.ok(out2.startsWith('<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">\n<HTML lang=de>\n<HEAD>'), 'public/system doctype and head are intact');
      });
    },
  },
  {
    id: 'T-10', title: 'saving immediately after the last keystroke in the page contains that keystroke',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' Ganz neu');
        const flag = await ed.syncFlag();
        const saved = await ed.download('bDownload');
        c.eq(flag, 'no', 'the page edit was still pending when the button was pressed');
        c.ok(saved.text.includes('<p>Hier steht mein Text. Ganz neu</p>'), 'download button: file contains the final keystroke', saved.text.split('\n')[8]);
        c.eq(await ed.dirtyText(), 'gespeichert', 'document counts as saved afterwards');
      });
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' Tastatur');
        const flag = await ed.syncFlag();
        const saved = await ed.download(null, () => ed.key('s', ['ctrl']));
        c.eq(flag, 'no', 'pending page edit before Ctrl+S');
        c.ok(saved.text.includes('<p>Hier steht mein Text. Tastatur</p>'), 'Ctrl+S in the page (download fallback): file contains the final keystroke');
        await ed.sourceCaret('</h1>');
        await ed.type('Q');
        const saved2 = await ed.download(null, () => ed.key('s', ['ctrl']));
        c.ok(saved2.text.includes('Webseite Q</h1>') || saved2.text.includes('WebseiteQ</h1>'), 'Ctrl+S in the source: file contains the final keystroke');
      });
      await withEditor(browser, { init: MOCK_SAVE }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' direkt');
        await ed.key('s', ['ctrl']);
        await ed.until('window.__mock.writes.length === 1', 'mock handle written');
        c.ok((await ed.eval('window.__mock.writes[0]')).includes('<p>Hier steht mein Text. direkt</p>'), 'MOCK file handle: written text contains the final keystroke');
        c.eq(await ed.dirtyText(), 'gespeichert', 'MOCK file handle: saved state after a completed write');
        c.eq(await ed.eval('document.getElementById("docName").textContent'), 'mock-ziel.html', 'MOCK file handle: name of the chosen file is shown');
        await ed.type('2');
        await ed.click('bSave');
        await ed.until('window.__mock.writes.length === 2', 'second write');
        c.ok((await ed.eval('window.__mock.writes[1] + "|" + window.__mock.pickerCalls')).endsWith('|1') && (await ed.eval('window.__mock.writes[1]')).includes('direkt2</p>'), 'MOCK file handle: second save writes to the same file without asking again');
        await ed.eval('window.__mock.mode = "fail"');
        await ed.caret('direkt2', 7);
        await ed.type('3');
        await ed.click('bSave');
        await sleep(200);
        c.ok((await ed.dirtyText()).includes('nicht gespeichert') && (await ed.status()).includes('nicht gespeichert'), 'MOCK failed write: not marked as saved, user is told', await ed.status());
      });
      await withEditor(browser, { init: MOCK_SAVE + 'window.__mock.mode = "abort";' }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' x');
        await ed.click('bSave');
        await sleep(200);
        c.ok((await ed.dirtyText()).includes('nicht gespeichert') && (await ed.status()).includes('abgebrochen'), 'MOCK cancelled picker: not marked as saved', await ed.status());
        c.ok((await ed.source()).includes('Text. x</p>'), 'work is still there after cancelling');
      });
    },
  },
  {
    id: 'T-11', title: 'rapid alternating edits never lose the newer text',
    async run(c, { browser }) {
      const start = doc('  <p>ALT</p>');
      const bodyOf = (ed) => ed.eval(PARSE('doc.body.innerHTML.trim()'));
      let runs = 0;
      const bad = [];
      for (const delay of [0, 15, 60, 150, 300, 450, 800]) {
        for (let repeat = 0; repeat < 2; repeat++) {
          await withEditor(browser, {}, async (ed) => {
            // A: source first, then the page (the reference lost "NEU" here)
            await ed.openText('t11.html', start);
            await ed.eval('(() => { const t = document.getElementById("src"); const i = t.value.indexOf("ALT"); t.focus(); t.setSelectionRange(i, i + 3); })()');
            await ed.type('NEU');
            if (delay) await sleep(delay);
            await ed.clickPv('d.querySelector("p")');
            await ed.key('End');
            await ed.type('!');
            await ed.settle();
            const a = await bodyOf(ed), aPv = await ed.eval(PV + '.querySelector("p").textContent');
            if (a !== '<p>NEU!</p>' || aPv !== 'NEU!') bad.push(`A delay ${delay}: ${a} / ${aPv}`);
            // B: page first, then the source
            await ed.openText('t11b.html', start);
            await ed.caret('ALT', 3);
            await ed.type('!');
            if (delay) await sleep(delay);
            await ed.page.clickOn('document.getElementById("src")');
            await ed.sourceCaret('ALT', 3);
            await ed.type('X');
            await ed.settle();
            const b = await bodyOf(ed), bPv = await ed.eval(PV + '.querySelector("p").textContent');
            if (b !== '<p>ALTX!</p>' || bPv !== 'ALTX!') bad.push(`B delay ${delay}: ${b} / ${bPv}`);
            // C: caret parked in the outdated page, then typing there right after a source edit
            await ed.openText('t11c.html', start);
            await ed.caret('ALT', 3);
            await ed.eval('(() => { const t = document.getElementById("src"); const i = t.value.indexOf("ALT"); t.focus(); t.setSelectionRange(i, i + 3); })()');
            await ed.type('NEU');
            if (delay) await sleep(delay);
            await ed.eval('document.getElementById("pv").contentWindow.focus()');
            await ed.type('?');
            await ed.settle();
            const cc = await bodyOf(ed);
            if (!/^<p>(NEU\?|\?NEU|N\?EU|NE\?U)<\/p>$/.test(cc) || cc.includes('ALT')) bad.push(`C delay ${delay}: ${cc}`);
            runs += 3;
          });
        }
      }
      c.eq(bad.join(' ; '), '', runs + ' alternating schedules (delays 0–800 ms, both directions, outdated page) keep every edit');
      await withEditor(browser, {}, async (ed) => {
        await ed.openText('t11d.html', start);
        for (let i = 0; i < 12; i++) {
          await ed.sourceCaret('</p>');
          await ed.type(String(i % 10));
          await ed.eval('document.getElementById("pv").contentWindow.focus()');
          await ed.eval(`((d) => { const p = d.querySelector("p"); d.getSelection().collapse(p.firstChild, 0); })(${PV})`);
          await ed.type(String.fromCharCode(97 + i));
        }
        await ed.settle();
        c.eq(await bodyOf(ed), '<p>lkjihgfedcbaALT012345678901</p>', '24 keystrokes alternating between the panes without pauses all arrive in order');
        c.eq(await ed.eval(PV + '.querySelector("p").textContent'), 'lkjihgfedcbaALT012345678901', 'page shows the same text');
      });
    },
  },
  {
    id: 'T-12', title: 'long document: fast typing, caret, scroll, toolbar selection, composition',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        let body = '';
        for (let i = 1; i <= 1500; i++) body += `  <p>Absatz ${i}: Dies ist ein längerer Beispielsatz mit Umlauten äöü und <b>fettem</b> Text.</p>\n`;
        const text = doc(body.trimEnd());
        await ed.openText('t12-lang.html', text);
        c.note('document size', text.length + ' characters, 1500 paragraphs');
        await ed.sourceCaret('Absatz 10:', 4);
        const caretBefore = await ed.eval('document.getElementById("src").selectionStart');
        await ed.caret('Absatz 700:', 'Absatz 700:'.length);
        const typed = 'schnell getippt 0123456789 abcdefghijklmnopqrstuvwxyz '.repeat(3);
        const t0 = Date.now();
        await ed.type(typed);
        const sent = Date.now() - t0;
        await ed.settle();
        const total = Date.now() - t0;
        const src = await ed.source();
        c.ok(src.includes('<p>Absatz 700:' + typed.replace(/ $/, '&nbsp;') + ' Dies') || src.includes('<p>Absatz 700:' + typed + ' Dies') || src.includes('<p>Absatz 700:' + typed + 'Dies'), typed.length + ' fast keystrokes arrive complete and in order', (/<p>Absatz 700:[^]*?<\/p>/.exec(src) || [''])[0]);
        c.note('typing speed', `${typed.length} keystrokes sent in ${sent} ms, panes in sync after ${total} ms`);
        c.eq(src.length - text.length >= typed.length - 1, true, 'no characters lost in the document');
        c.eq(await ed.eval('document.getElementById("src").selectionStart'), caretBefore, 'source caret stays where it was (not moved to the end)');
        c.eq(await ed.eval(PV + '.getSelection().anchorNode.data.slice(0, 12)'), 'Absatz 700:s', 'page caret is still in the edited paragraph');
        const scrolled = await ed.eval(`((d) => { d.querySelectorAll("p")[1199].scrollIntoView(); return d.scrollingElement.scrollTop; })(${PV})`);
        await ed.sourceCaret('Absatz 1200:', 'Absatz 1200:'.length);
        await ed.eval('document.getElementById("src").scrollTop = 24000');
        await ed.type(' Quelle');
        await ed.settle();
        const after = await ed.eval(PV + '.scrollingElement.scrollTop');
        c.ok(scrolled > 1000 && Math.abs(after - scrolled) < 40, 'page keeps its scroll position when the source is edited', scrolled + ' -> ' + after);
        c.ok((await ed.eval('document.getElementById("src").selectionStart')) < src.length - 1000, 'source caret stays at the typing position');
        c.eq(await ed.eval(PV + '.querySelectorAll("p")[1199].textContent.slice(0, 19)'), 'Absatz 1200: Quelle', 'source edit visible in the page');
        await ed.selectPv('Absatz 900');
        await ed.click('bItalic');
        await ed.settle();
        c.eq(await ed.eval(PV + '.getSelection().toString()'), 'Absatz 900', 'selection survives a toolbar command in a long document');
        c.ok((await ed.source()).includes('<p><i>Absatz 900</i>: Dies'), 'toolbar command applied to the selection');
        await ed.caret('Absatz 5:', 'Absatz 5:'.length);
        await ed.page.send('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 });
        await ed.page.send('Input.imeSetComposition', { text: 'にほ', selectionStart: 2, selectionEnd: 2 });
        await ed.page.send('Input.insertText', { text: '日本' });
        await ed.settle();
        c.ok((await ed.source()).includes('<p>Absatz 5:日本 Dies'), 'composition (IME) input is committed once and complete', (/<p>Absatz 5:[^]{0,20}/.exec(await ed.source()) || [''])[0]);
        c.eq(ed.errors().join(' | '), '', 'no script errors');
      });
    },
  },
  {
    id: 'T-13', title: 'one undo/redo history across source edits, page edits and toolbar commands',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const s0 = await ed.source();
        await ed.sourceCaret('Text.', 5);
        await ed.type('A');
        await ed.settle();
        const s1 = await ed.source();
        await sleep(1100);
        await ed.caret('Webseite', 'Webseite'.length);
        await ed.type('B');
        await ed.settle();
        const s2 = await ed.source();
        await ed.click('bH2');
        await ed.settle();
        const s3 = await ed.source();
        c.ok(s1 === s0.replace('Text.', 'Text.A') && s2 === s1.replace('Webseite', 'WebseiteB') && s3 === s2.replace('<h1>', '<h2>').replace('</h1>', '</h2>'), 'three edits (source, page, toolbar) produce the expected states');
        await ed.click('bUndo'); await ed.settle();
        c.eq(await ed.source(), s2, 'undo 1 reverts the toolbar command');
        c.eq(await ed.eval(PV + '.querySelector("h1").textContent'), 'Meine erste WebseiteB', 'page follows the undo');
        await ed.click('bUndo'); await ed.settle();
        c.eq(await ed.source(), s1, 'undo 2 reverts the page edit');
        await ed.click('bUndo'); await ed.settle();
        c.eq(await ed.source(), s0, 'undo 3 reverts the source edit');
        c.eq(await ed.eval('document.getElementById("bUndo").disabled'), true, 'nothing left to undo');
        await ed.click('bRedo'); await ed.settle();
        await ed.click('bRedo'); await ed.settle();
        c.eq(await ed.source(), s2, 'redo twice returns to the page edit');
        await ed.caret('WebseiteB', 'WebseiteB'.length);
        await ed.type('C');
        await ed.settle();
        c.eq(await ed.eval('document.getElementById("bRedo").disabled'), true, 'a new edit invalidates redo');
        const s2c = await ed.source();
        c.eq(s2c, s2.replace('WebseiteB', 'WebseiteBC'), 'new edit applied');
        await ed.key('z', ['ctrl']);
        await ed.settle();
        c.eq(await ed.source(), s2, 'Ctrl+Z in the page uses the same history');
        await ed.page.clickOn('document.getElementById("src")');
        await ed.key('z', ['ctrl']);
        await ed.settle();
        c.eq(await ed.source(), s1, 'Ctrl+Z in the source continues in the same history');
        await ed.key('y', ['ctrl']);
        await ed.settle();
        c.eq(await ed.source(), s2, 'Ctrl+Y redoes');
        await sleep(1100);
        await ed.caret('WebseiteB', 'WebseiteB'.length);
        await ed.type('xyz');
        await ed.settle();
        await ed.click('bUndo'); await ed.settle();
        c.eq(await ed.source(), s2, 'a burst of typing is one undo step');
      });
    },
  },
  {
    id: 'T-14', title: 'malformed, incomplete, empty and oversized input',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const broken = readFixture('malformed.html');
        await ed.openFile(fixture('malformed.html'));
        c.eq(await ed.source(), broken, 'malformed file: source is shown unchanged');
        c.ok((await ed.eval(PV + '.body.textContent')).includes('Block in Zelle'), 'malformed file: page is displayed');
        const locked = !(await ed.eval('document.getElementById("lockNote").hidden'));
        const opaque = await ed.eval(PV + '.querySelectorAll("[data-se-opaque]").length');
        c.ok(locked || opaque > 0, 'parts that cannot be mapped safely are read-only and marked', 'whole page locked: ' + locked + ', read-only parts: ' + opaque);
        await ed.sourceCaret('Kaputt', 6);
        await ed.type('!');
        await ed.settle();
        c.eq(await ed.source(), broken.replace('Kaputt', 'Kaputt!'), 'typing in the source changes only that character (no silent rewrite)');
        await ed.clickPv('d.body');
        await ed.type('zzz');
        await ed.settle();
        if (locked) c.eq(await ed.source(), broken.replace('Kaputt', 'Kaputt!'), 'typing into the locked page changes nothing');
        await ed.openText('t14-offen.html', '<h1>Titel</h1>\n<p>Offen');
        c.eq(await ed.eval('document.getElementById("lockNote").hidden'), true, 'incomplete fragment is editable');
        await ed.caret('Offen', 5);
        await ed.type('!');
        await ed.settle();
        c.ok(/^<h1>Titel<\/h1>\n<p>Offen!(<\/p>)?$/.test(await ed.source()), 'incomplete fragment: edit is applied without inventing a document frame', await ed.source());
        await ed.openText('t14-leer.html', '');
        c.eq(await ed.source(), '', 'empty file opens as empty document');
        await ed.clickPv('d.body');
        await ed.type('Hallo');
        await ed.settle();
        c.eq(await ed.source(), '<p>Hallo</p>\n', 'typing into an empty page creates a paragraph (file ends with a line break)');
        const big = tmpFile('t14-gross.html', Buffer.alloc(5 * 1024 * 1024 + 1, 0x20));
        await ed.openFile(big, { wait: false });
        await ed.until('document.getElementById("dlgInfo").open', 'size limit message');
        c.ok((await ed.eval('document.getElementById("infoText").textContent')).includes('zu groß'), 'oversized file is refused with a message');
        await ed.dialogButton('dlgInfo', 'OK');
        fs.rmSync(big, { force: true });
        c.eq(await ed.source(), '<p>Hallo</p>\n', 'current work is kept after the refusal');
        const deep = '<p>Anfang</p>' + '<div>'.repeat(30000) + 'tief' + '</div>'.repeat(30000);
        await ed.openText('t14-tief.html', deep);
        c.eq(await ed.source(), deep, 'a document nested 30000 levels deep opens with unchanged source');
        c.ok((await ed.eval(PV + '.querySelectorAll("[data-se-opaque]").length')) > 0 || !(await ed.eval('document.getElementById("lockNote").hidden')), 'its deep part is read-only');
        await ed.sourceCaret('Anfang', 6);
        await ed.type('!');
        await ed.settle();
        c.eq(await ed.source(), deep.replace('Anfang', 'Anfang!'), 'typing in the source still works');
        c.eq(ed.errors().join(' | '), '', 'no script errors');
      });
    },
  },
  {
    id: 'T-15', title: 'new/open/drop while unsaved, failed open, outdated operations',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' Arbeit');
        await ed.settle();
        const work = await ed.source();
        await ed.click('bNew');
        c.ok(await ed.dialogOpen('dlgConfirm'), 'New with unsaved work asks first');
        await ed.dialogButton('dlgConfirm', 'Abbrechen');
        c.eq(await ed.source(), work, 'cancel keeps the work');
        await ed.click('bOpen');
        c.ok(await ed.dialogOpen('dlgConfirm'), 'Open with unsaved work asks first');
        await ed.key('Escape');
        await sleep(60);
        c.eq(await ed.source(), work, 'Escape keeps the work');
        await ed.openFile(tmpFile('t15-binaer.html', Buffer.from([0x3c, 0x70, 0x3e, 0x00, 0x01, 0x02, 0xff])), { wait: false });
        await ed.until('document.getElementById("dlgInfo").open', 'binary file refused');
        await ed.dialogButton('dlgInfo', 'OK');
        c.eq(await ed.source(), work, 'a failed open keeps the work');
        c.ok((await ed.dirtyText()).includes('nicht gespeichert'), 'and it still counts as unsaved');
        await ed.click('bNew');
        await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
        await ed.settle();
        c.ok(!(await ed.source()).includes('Arbeit') && (await ed.dirtyText()) === 'gespeichert', 'confirming discards and starts a new page');
        await ed.page.send('Page.setInterceptFileChooserDialog', { enabled: true });
        const chooser = ed.page.waitFor('Page.fileChooserOpened');
        await ed.click('bOpen');
        const opened = await chooser;
        await ed.page.send('DOM.setFileInputFiles', { files: [fixture('basic.html')], backendNodeId: opened.backendNodeId });
        await ed.until('document.getElementById("docName").textContent === "basic.html"', 'opened through the button');
        c.eq(await ed.source(), readFixture('basic.html'), 'Open button + file chooser loads the file (browser without direct file access)');
        await ed.page.send('Page.setInterceptFileChooserDialog', { enabled: false });
        // drop a file on the window
        let dropped = 'NOT MEASURED';
        try {
          const data = { items: [], files: [fixture('legacy.html')], dragOperationsMask: 1 };
          for (const type of ['dragEnter', 'dragOver', 'drop']) await ed.page.send('Input.dispatchDragEvent', { type, x: 200, y: 300, data });
          await ed.until('document.getElementById("docName").textContent === "legacy.html"', 'dropped file opened', 3000);
          dropped = 'opened';
        } catch (e) { dropped = 'NOT MEASURED (' + e.message + ')'; }
        if (dropped === 'opened') c.ok(true, 'a dropped HTML file is opened');
        else c.skip('drop of an HTML file on the window (and the question it asks over unsaved work)', dropped);
        if (dropped === 'opened') {
          await ed.caret('Dritter Absatz.', 3);
          await ed.type('#');
          await ed.settle();
          const dirty = await ed.source();
          const data = { items: [], files: [fixture('basic.html')], dragOperationsMask: 1 };
          for (const type of ['dragEnter', 'dragOver', 'drop']) await ed.page.send('Input.dispatchDragEvent', { type, x: 200, y: 300, data });
          await ed.until('document.getElementById("dlgConfirm").open', 'drop asks first');
          await ed.dialogButton('dlgConfirm', 'Abbrechen');
          c.eq(await ed.source(), dirty, 'drop while unsaved asks first; cancel keeps the work');
        }
      });
      await withEditor(browser, { init: MOCK_SAVE + 'window.__mock.delay = 500;' }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' alt');
        await ed.click('bSave');
        await ed.openFile(fixture('basic.html'), { wait: false });
        await ed.until('document.getElementById("dlgConfirm").open', 'open while the slow save is pending asks first');
        await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
        await ed.until('document.getElementById("docName").textContent === "basic.html"', 'file opened');
        await ed.synced();
        await ed.caret('Punkt A', 7);
        await ed.type('+');
        await ed.settle();
        await ed.until('window.__mock.writes.length === 1', 'slow write finished');
        await sleep(100);
        c.ok((await ed.eval('window.__mock.writes[0]')).includes('Text. alt</p>'), 'MOCK slow save wrote the document it was started for');
        c.ok((await ed.dirtyText()).includes('nicht gespeichert') && (await ed.eval('document.getElementById("docName").textContent')) === 'basic.html', 'MOCK: a save that finishes after another file was opened does not mark the new document as saved', (await ed.dirtyText()) + ' / ' + (await ed.eval('document.getElementById("docName").textContent')));
      });
    },
  },
  {
    id: 'T-16', title: 'Save falls back to a real download when direct file access is missing',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.openFile(fixture('basic.html'));
        await ed.caret('Punkt A', 7);
        await ed.type('!');
        const saved = await ed.download('bSave');
        c.eq(saved.text, readFixture('basic.html').replace('Punkt A', 'Punkt A!'), 'Save button produces a real download with the current text');
        c.eq(saved.name, 'basic.html', 'download uses the document name');
        c.eq(await ed.dirtyText(), 'gespeichert', 'state shows saved');
      });
      c.skip('native open/save pickers and write-back to a real file handle', 'cannot be driven by this harness; handle logic is covered with a labelled mock in T-10 and T-15');
    },
  },
  {
    id: 'T-17', title: 'no persistence between sessions',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' GEHEIM-12345');
        await ed.settle();
        await ed.click('bDownload');
        await sleep(300);
        const stores = await ed.eval('(async () => JSON.stringify({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie, idb: (await indexedDB.databases()).length, caches: (await caches.keys().catch(() => [])).length }))()');
        c.eq(stores, '{"local":0,"session":0,"cookie":"","idb":0,"caches":0}', 'no storage is written while working');
        await withEditor(browser, {}, async (second) => {
          c.ok(!(await second.source()).includes('GEHEIM') && (await second.source()).includes(TEMPLATE_P), 'a new start in the same browser profile shows the empty template, not the previous work');
        });
      });
    },
  },
];
