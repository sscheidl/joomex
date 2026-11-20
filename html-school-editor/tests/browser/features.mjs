// Cases F-01 … F-03 for the functions the owner asked for after trying 0.1.0-alpha.2: images addressed by
// file name (optional folder, optional description, width) and shown from the folder of the editor, changing existing images and links through the
// dialogs, and text alignment. Expected source texts are written by hand.
import fs from 'node:fs';
import path from 'node:path';
import { Editor, PV, TMP, sleep, tmpFile, makePng, editorFolder } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body) => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>F</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const imgState = (ed, index = 0) => ed.eval(`((d) => { const i = d.querySelectorAll("img")[${index}]; return JSON.stringify({ kind: (i.getAttribute("src") || "").split(":")[0], natural: i.naturalWidth, shown: Math.round(i.getBoundingClientRect().width), box: i.hasAttribute("data-se-src") }); })(${PV})`).then(JSON.parse);
const imgError = (ed) => ed.eval('document.getElementById("imgErr").textContent');
const found = (ed) => ed.eval('document.getElementById("imgFound").textContent');
const lostNote = (ed) => ed.eval('document.getElementById("lostNote").hidden ? "" : document.getElementById("lostNote").textContent');
// waits until image `index` of the page pane has finished: loaded, or turned into a box
const loaded = (ed, index) => ed.until(`((i) => i && i.complete && (i.naturalWidth > 0 || i.hasAttribute("data-se-src")))(${PV}.querySelectorAll("img")[${index}])`, 'image ' + index + ' settled');
const pressed = (ed) => ed.eval('["bAlignLeft", "bAlignCenter", "bAlignRight", "bAlignJustify"].filter((id) => document.getElementById(id).getAttribute("aria-pressed") === "true").join(",")');
// a 16 x 16 picture embedded in the code (large enough to be clicked)
const SMALL_GIF = 'data:image/png;base64,' + makePng(16, 16, false).toString('base64');

export const features = [
  {
    id: 'F-01', title: 'images are addressed relative to the page and shown from the folder of the editor; missing files are named; other computers and the network are never asked',
    async run(c, { browser, sink }) {
      // the pupil's folder: the editor, a picture in a subfolder, one with an odd name; one picture above the folder
      const folder = editorFolder('f01-ordner');
      const katze = folder.put('bilder/fotos/f01-katze.png', makePng(120, 80, false));
      const odd = folder.put('f01 mein bild #1 100%.png', makePng(10, 10, false));
      fs.writeFileSync(path.join(TMP, 'f01-oben.png'), makePng(14, 14, false));
      await withEditor(browser, { artefact: folder.artefact }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.click('bImage');
        // a file above the size limit is refused before anything of it is decoded
        const huge = Buffer.alloc(20 * 1024 * 1024 + 1);
        makePng(4, 4, false).copy(huge);
        await ed.page.setFiles('#imgIn', [tmpFile('f01-riesig.png', huge)]);
        await ed.until('document.getElementById("imgErr").textContent.length > 0', 'oversized image refused');
        c.ok((await imgError(ed)).includes('zu groß'), 'a picture file above 20 MB is refused with an explanation', await imgError(ed));
        await ed.pickImage(katze);
        await ed.until('document.getElementById("imgFound").classList.contains("no")', 'not found without the folder');
        c.ok((await found(ed)).startsWith('Nicht gefunden'), 'without the folder the dialog says at once that the file is not there', await found(ed));
        await ed.field('imgDir', 'a:b');
        await ed.dialogButton('dlgImage', 'Einfügen');
        c.ok(await ed.dialogOpen('dlgImage') && (await imgError(ed)).includes('Unterordner'), 'a folder name with a colon is refused with an explanation', await imgError(ed));
        await ed.field('imgDir', ' bilder\\fotos/ ');
        await ed.until('document.getElementById("imgFound").classList.contains("yes")', 'found with the folder');
        c.eq(await found(ed), 'Gefunden: Das Bild liegt an dieser Stelle.', 'with the folder typed in, the dialog finds the file');
        c.eq(await ed.eval('document.getElementById("imgPrev").hidden + "|" + document.getElementById("imgPrev").naturalWidth'), 'false|120', 'and shows it');
        for (const bad of ['abc', '0', '12.5']) {
          await ed.field('imgWidth', bad);
          await ed.dialogButton('dlgImage', 'Einfügen');
          c.ok(await ed.dialogOpen('dlgImage') && (await imgError(ed)).includes('Breite'), 'width "' + bad + '" is refused with an explanation');
        }
        await ed.field('imgWidth', '60');
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        c.ok((await ed.source()).includes('  <p>Hier steht mein Text.<img src="bilder/fotos/f01-katze.png" alt="" width="60"></p>'), 'folder, file name, empty description and width are written as plain attributes', (await ed.source()).split('\n')[8]);
        await loaded(ed, 0);
        let state = await imgState(ed);
        c.ok(state.kind === 'file' && state.natural === 120 && state.shown === 60 && !state.box, 'the page pane shows the file from the folder in the given width', JSON.stringify(state));
        c.eq(await ed.inactiveNote() + '|' + await lostNote(ed), '|', 'a picture that is there is neither switched off nor missing');
        c.ok(!(await ed.status()).includes('Lege'), 'no hint where to put a file that is already there', await ed.status());
        // the folder is remembered for the next picture; a file name with characters that mean something in an address
        await ed.caret('Meine erste', 0);
        await ed.click('bImage');
        c.eq(await ed.eval('document.getElementById("imgDir").value'), 'bilder/fotos', 'the folder of the last picture is suggested again');
        await ed.pickImage(odd);
        await ed.field('imgDir', '');
        await ed.until('document.getElementById("imgFound").classList.contains("yes")', 'odd name found');
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        c.ok((await ed.source()).includes('<h1><img src="f01 mein bild %231 100%25.png" alt="">Meine erste Webseite</h1>'), 'the characters # and % of a file name are written so that the address still means this file', (await ed.source()).split('\n')[7]);
        await loaded(ed, 0);
        state = await imgState(ed, 0);
        c.ok(state.kind === 'file' && state.natural === 10, 'and the page pane finds that file', JSON.stringify(state));
        const saved = (await ed.download()).text;
        c.ok(!/data:|blob:|file:/.test(saved), 'the saved file holds relative addresses only, no image data and no address of the computer');

        // another page names a file that is not there: it is a box that says so, and the note above the page names it
        await ed.openText('f01-zweite.html', page('<p>A<img src="f01-katze.png" alt="Katze"></p>\n<p>B<img src="bilder/fotos/f01-katze.png"></p>'));
        await ed.until(`((d) => d.querySelector("img").hasAttribute("data-se-src"))(${PV})`, 'missing picture becomes a box');
        await loaded(ed, 1);
        state = await imgState(ed, 0);
        c.ok(state.box && state.kind === 'data' && state.natural > 200, 'the missing file becomes a box with a text in it', JSON.stringify(state));
        c.ok(decodeURIComponent(await ed.eval(PV + '.querySelector("img").getAttribute("src")')).includes('Bild nicht gefunden: f01-katze.png'), 'the box says "Bild nicht gefunden" with the address');
        c.ok((await ed.eval(PV + '.querySelector("img").title')).startsWith('Unter dieser Adresse liegt keine Bilddatei'), 'resting on the box explains what to do');
        c.ok((await imgState(ed, 1)).kind === 'file', 'the picture that is there is shown');
        c.eq(await lostNote(ed), 'Nicht gefunden: f01-katze.png. Lege die Bilddatei an diese Stelle im Ordner deiner Seite oder ändere die Adresse.', 'the note above the page names the missing file');
        c.eq(await ed.inactiveNote(), '', 'and the note "switched off" does not list it');
        c.eq(await ed.source(), page('<p>A<img src="f01-katze.png" alt="Katze"></p>\n<p>B<img src="bilder/fotos/f01-katze.png"></p>'), 'the code stays as it was');
        // the pupil copies the file into the folder and comes back to the editor
        folder.put('f01-katze.png', makePng(120, 80, false));
        await ed.eval('void (window.f01Focus = document.hasFocus, document.hasFocus = () => false, window.dispatchEvent(new Event("blur")))');
        await sleep(50);
        await ed.eval('void (document.hasFocus = window.f01Focus, window.dispatchEvent(new Event("focus")))');
        await ed.until(`((d) => !d.querySelector("img").hasAttribute("data-se-src") && d.querySelector("img").naturalWidth === 120)(${PV})`, 'picture found after coming back');
        c.eq(await lostNote(ed), '', 'coming back to the editor looks again: the picture is shown and the note is gone');
        c.note('return to the editor', 'the test replaces document.hasFocus for one moment and sends blur and focus to the window; leaving for another program cannot be done in a headless browser');
        // a file that appears while the editor stays in front is found after the image dialog
        await ed.openText('f01-dritte.html', page('<p>C<img src="f01-spaeter.png" alt="später"></p>'));
        await ed.until(`((d) => d.querySelector("img").hasAttribute("data-se-src"))(${PV})`, 'missing picture becomes a box');
        folder.put('f01-spaeter.png', makePng(20, 20, false));
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bImage');
        await ed.until('document.getElementById("imgFound").classList.contains("yes")', 'dialog finds it');
        c.eq(await ed.eval('document.getElementById("imgTitle").textContent + "|" + document.getElementById("imgName").textContent'), 'Bild ändern|Jetzt: f01-spaeter.png', 'a click on the box and "Bild" opens the dialog for this picture');
        await ed.dialogButton('dlgImage', 'Abbrechen');
        await ed.until(`((d) => d.querySelector("img").naturalWidth === 20)(${PV})`, 'picture shown after the dialog');
        c.eq(await lostNote(ed), '', 'after the dialog the page pane looks again and shows the file');
      });
      // a page with pictures of every kind of address: only plain relative ones are looked for, on this computer
      await withEditor(browser, { artefact: folder.artefact }, async (ed) => {
        const port = sink.origin.split(':').pop();
        const source = page('<p>A<img src="bilder/fotos/f01-katze.png" alt="Katze"></p>\n<p>B<img src="../f01-oben.png"></p>\n<p>C<img src="' + sink.origin + '/f01/aussen.png" alt="von außen"></p>\n<p>D<img src="//127.0.0.1:' + port + '/f01/ohne.png"></p>\n<p>E<img src="file://rechner/freigabe/f01-katze.png"></p>\n<p>F<img alt="klein" src="' + SMALL_GIF + '"></p>');
        const before = sink.hits.length;
        await ed.openText('f01-alle.html', source);
        await loaded(ed, 0);
        await loaded(ed, 1);
        await sleep(300);
        const states = [];
        for (let i = 0; i < 6; i++) states.push(await imgState(ed, i));
        c.ok(states[0].kind === 'file' && states[0].natural === 120, 'a picture in a subfolder of the editor is shown', JSON.stringify(states[0]));
        c.ok(states[1].kind === 'file' && states[1].natural === 14, 'a picture in the folder above is shown as well', JSON.stringify(states[1]));
        c.ok(states[2].box && states[3].box && states[4].box, 'pictures from the network, without a scheme and from another computer are boxes', JSON.stringify(states.slice(2, 5)));
        c.ok(states[5].kind === 'data' && states[5].natural === 16 && !states[5].box, 'a picture embedded in the code is shown as before', JSON.stringify(states[5]));
        const here = await ed.eval('location.href.slice(0, location.href.lastIndexOf("/f01-ordner/"))');
        const addresses = await ed.eval(PV + '.querySelectorAll("img").length && JSON.stringify(Array.from(' + PV + '.querySelectorAll("img"), (i) => i.getAttribute("src")))');
        c.ok(JSON.parse(addresses).every((a) => a.startsWith('data:') || a.startsWith(here + '/')), 'every image element has a data address or one inside the test folder on this computer', JSON.parse(addresses).map((a) => a.slice(0, 50)).join(' '));
        const requests = ed.page.eventsOf('Network.requestWillBeSent').map((e) => e.request.url).filter((u) => /aussen|ohne|rechner/.test(u));
        c.eq(requests.join(','), '', 'the browser reports no request for the other pictures');
        c.eq(sink.hits.slice(before).join(','), '', 'nothing reaches the local counter');
        const net = decodeURIComponent(await ed.eval(PV + '.querySelectorAll("img")[2].getAttribute("src")'));
        c.ok(net.includes('Bild aus dem Internet'), 'the box of a picture from the network says so');
        c.ok((await ed.eval(PV + '.querySelectorAll("img")[2].title')) === 'Bilder aus dem Internet zeigt der Editor nicht an. Lade das Bild herunter (denk an das Urheberrecht), lege es in den Ordner deiner Seite und verlinke es mit dem Dateinamen.', 'and explains how to use it instead');
        const note = await ed.inactiveNote();
        c.ok(note.includes('3 Bilder von außerhalb') && !note.includes('Datei'), 'the note "switched off" counts the three pictures from outside', note);
        c.eq(await lostNote(ed), '', 'nothing is reported missing');
        c.eq(await ed.source(), source, 'the code stays as it was');
      });
    },
  },
  {
    id: 'F-02', title: 'existing images and links are changed through the dialogs; only the changed attribute is rewritten',
    async run(c, { browser, sink }) {
      await withEditor(browser, {}, async (ed) => {
        const line = '<p>Vor <IMG  ALT = \'Alt\'  SRC="bilder/a.png"  class=x  HEIGHT=40 width=80 onclick="los()" > nach</p>';
        const source = page(line + '\n<p><a HREF=\'alt.html\' title="t" onclick="x()">Zum <b>Ziel</b></a> und <a name="anker">Anker</a></p>\n<p>E<img alt="klein" src="' + SMALL_GIF + '"> X<img src="' + sink.origin + '/f02/aussen.png"></p>');
        await ed.openText('f02.html', source);
        const edit = async (index, fill, button = 'Übernehmen') => {
          await ed.clickPv(`d.querySelectorAll("img")[${index}]`);
          await ed.click('bImage');
          await fill();
          await ed.dialogButton('dlgImage', button);
          await ed.settle();
        };
        c.eq(await ed.eval(`((d) => { d.defaultView.focus(); return ""; })(${PV})`), '', 'page pane focused');
        await edit(0, async () => {
          c.eq(await ed.eval('JSON.stringify([document.getElementById("imgDir").value, document.getElementById("imgAlt").value, document.getElementById("imgWidth").value])'), '["bilder","Alt","80"]', 'the dialog shows folder, description and width of the clicked picture');
        });
        c.eq(await ed.source(), source, 'accepting the dialog without a change leaves the code as it is');
        c.eq(await ed.eval('document.getElementById("bUndo").disabled'), true, 'and adds no undo step');
        await edit(0, () => ed.field('imgWidth', '120'));
        const widthLine = '<p>Vor <IMG  ALT = \'Alt\'  SRC="bilder/a.png"  class=x width="120" onclick="los()" > nach</p>';
        c.eq(await ed.source(), source.replace(line, widthLine), 'new width: the width attribute is rewritten, the height attribute goes, everything else stays as written');
        await edit(0, () => ed.field('imgAlt', 'Neu \'x\' & "y"'));
        const altLine = widthLine.replace("ALT = 'Alt'", "ALT = 'Neu &#39;x&#39; &amp; \"y\"'");
        c.eq(await ed.source(), source.replace(line, altLine), 'new description: written inside the single quotes the pupil used');
        await edit(0, () => ed.field('imgDir', 'img'));
        const dirLine = altLine.replace('SRC="bilder/a.png"', 'SRC="img/a.png"');
        c.eq(await ed.source(), source.replace(line, dirLine), 'new folder: only the folder part of the address changes');
        // owner's report: the same file chosen again from another folder. The browser does not tell the folder,
        // so the code changes only through the folder field, and the dialog shows what the code will be.
        const again = tmpFile('a.png', makePng(12, 12, false));
        const code = () => ed.eval('document.getElementById("imgCode").textContent');
        await ed.clickPv('d.querySelectorAll("img")[0]');
        await ed.click('bImage');
        c.eq(await code(), 'Im Code steht dann: <img src="img/a.png">', 'the dialog shows the address that stands in the code');
        await ed.pickImage(again);
        c.eq(await code(), 'Im Code steht dann: <img src="img/a.png">', 'choosing the same file name again, from whatever folder, leaves the address: the folder comes from the field only');
        await ed.field('imgDir', 'fotos/2026');
        c.eq(await code(), 'Im Code steht dann: <img src="fotos/2026/a.png">', 'typing a folder shows the new address at once');
        await ed.dialogButton('dlgImage', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), source.replace(line, dirLine.replace('SRC="img/a.png"', 'SRC="fotos/2026/a.png"')), 'and accepting writes exactly this address into the code');
        await ed.click('bUndo');
        await ed.settle();
        await edit(0, () => ed.field('imgWidth', ''));
        c.eq(await ed.source(), source.replace(line, dirLine.replace(' width="120"', '')), 'empty width removes the attribute');
        for (let i = 0; i < 4; i++) { await ed.click('bUndo'); await ed.settle(); }
        c.eq(await ed.source(), source, 'four undo steps restore the original text');
        // a picture embedded in the code and a picture from the network keep their address
        await edit(1, () => ed.field('imgWidth', '20'));
        c.ok((await ed.source()).includes('<img alt="klein" src="' + SMALL_GIF + '" width="20">'), 'embedded picture: width added, the embedded data stays', (await ed.source()).split('\n')[9].slice(0, 60));
        await edit(2, () => ed.field('imgAlt', 'außen'));
        c.ok((await ed.source()).includes('X<img src="' + sink.origin + '/f02/aussen.png" alt="außen"></p>'), 'picture from the network: description added, address untouched');
        const png = tmpFile('f02-neu.png', makePng(30, 30, false));
        await edit(2, async () => { await ed.pickImage(png); await ed.field('imgDir', ''); });       // the field suggests the folder used last
        c.ok((await ed.source()).includes('X<img src="f02-neu.png" alt="außen"></p>'), 'choosing a file for it replaces the address by the file name');
        // links
        await ed.caret('Zum ', 2);
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkTitle").textContent + "|" + document.getElementById("linkUrl").value + "|" + document.getElementById("linkTextRow").hidden + "|" + document.getElementById("linkOk").textContent'), 'Link ändern|alt.html|true|Übernehmen', 'with the caret in a link, "Link" opens the dialog with its address');
        await ed.type('javascript:alert(1)');
        await ed.dialogButton('dlgLink', 'Übernehmen');
        c.ok(await ed.dialogOpen('dlgLink') && (await ed.eval('document.getElementById("linkErr").textContent')).length > 10, 'an address that is not allowed is refused here as well');
        await ed.field('linkUrl', 'neu.html');
        await ed.key('Enter');
        await ed.settle();
        c.ok((await ed.source()).includes('<p><a HREF=\'neu.html\' title="t" onclick="x()">Zum <b>Ziel</b></a> und'), 'new address: only the value of the attribute changes, inside its quotes', (await ed.source()).split('\n')[8]);
        c.eq(await ed.eval(PV + '.querySelectorAll("a[href]").length'), 0, 'links in the page pane stay inert');
        await ed.selectPv('Ziel');
        await ed.click('bLink');
        c.eq(await ed.eval('document.getElementById("linkUrl").value'), 'neu.html', 'a selection inside the link changes the same link');
        await ed.dialogButton('dlgLink', 'Abbrechen');
        await ed.caret('Anker', 2);
        await ed.click('bLink');
        await ed.type('#oben');
        await ed.key('Enter');
        await ed.settle();
        c.ok((await ed.source()).includes('<a name="anker" href="#oben">Anker</a>'), 'an anchor without address gets one as a new attribute');
        await ed.selectNodes('d.querySelector("b").firstChild', 'd.querySelectorAll("a")[1].previousSibling');
        await ed.click('bLink');
        c.ok(!(await ed.dialogOpen('dlgLink')) && (await ed.status()).includes('über einen Link hinaus'), 'a selection that reaches beyond a link is explained instead', await ed.status());
      });
    },
  },
  {
    id: 'F-03', title: 'alignment left, centre, right, justified for text and pictures; the only style the editor writes',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const body = '  <h1>Titel</h1>\n  <p>Eins</p>\n  <p>Zwei</p>\n  <P STYLE=\'color:red\' class="a">Drei</P>\n  <ul>\n    <li>Punkt</li>\n  </ul>\n  <table><tr><td>Zelle</td></tr></table>\n  <p>Bild: <img alt="klein" src="' + SMALL_GIF + '"></p>\n  <img alt="lose" src="' + SMALL_GIF + '">';
        const source = page(body);
        await ed.openText('f03.html', source);
        const click = async (id) => { await ed.click(id); await ed.settle(); };
        await ed.caret('Eins', 2);
        c.eq(await pressed(ed), 'bAlignLeft', 'an ordinary paragraph shows "Links" as active');
        await click('bAlignCenter');
        c.eq(await ed.source(), source.replace('<p>Eins</p>', '<p style="text-align: center">Eins</p>'), 'centre: one style attribute on the paragraph, nothing else changes');
        c.eq(await pressed(ed), 'bAlignCenter', 'the button shows the alignment');
        await click('bAlignJustify');
        c.eq(await ed.source(), source.replace('<p>Eins</p>', '<p style="text-align: justify">Eins</p>'), 'justified replaces the value');
        await click('bAlignRight');
        c.eq(await ed.source(), source.replace('<p>Eins</p>', '<p style="text-align: right">Eins</p>'), 'right replaces the value');
        await click('bAlignLeft');
        c.eq(await ed.source(), source, 'left removes the attribute: the original text is back');
        // several blocks at once, and blocks of other kinds
        await ed.selectNodes('d.querySelector("h1").firstChild', 'd.querySelectorAll("p")[1].firstChild');
        await click('bAlignCenter');
        c.eq(await ed.source(), source.replace('<h1>', '<h1 style="text-align: center">').replace('<p>Eins', '<p style="text-align: center">Eins').replace('<p>Zwei', '<p style="text-align: center">Zwei'), 'a selection over three blocks aligns all three');
        await click('bAlignLeft');
        c.eq(await ed.source(), source, 'and left restores them');
        await ed.caret('Drei', 2);
        await click('bAlignRight');
        c.eq(await ed.source(), source.replace("STYLE='color:red'", "STYLE='color:red; text-align: right'"), 'an existing style attribute keeps its own declaration, its spelling and its quotes');
        await click('bAlignLeft');
        c.eq(await ed.source(), source, 'and gets it back unchanged');
        await ed.caret('Punkt', 2);
        await click('bAlignCenter');
        await ed.caret('Zelle', 2);
        await click('bAlignRight');
        c.eq(await ed.source(), source.replace('<li>Punkt', '<li style="text-align: center">Punkt').replace('<td>Zelle', '<td style="text-align: right">Zelle'), 'list item and table cell');
        await ed.click('bUndo'); await ed.settle();
        await ed.click('bUndo'); await ed.settle();
        c.eq(await ed.source(), source, 'each alignment is one undo step');
        // pictures
        await ed.clickPv('d.querySelectorAll("img")[0]');
        await click('bAlignCenter');
        c.eq(await ed.source(), source.replace('<p>Bild: ', '<p style="text-align: center">Bild: '), 'a clicked picture is aligned through the paragraph it stands in');
        await ed.clickPv('d.querySelectorAll("img")[1]');
        await click('bAlignRight');
        const loose = await ed.source();
        c.ok(loose.includes('<p style="text-align: right"><img alt="lose" src="' + SMALL_GIF + '"></p>'), 'a picture that stands directly in the page gets a paragraph of its own for the alignment', loose.split('\n').slice(16, 19).join('\n'));
        c.eq(await ed.eval(`((d) => { const i = d.querySelectorAll("img")[1], w = d.documentElement.clientWidth; return i.getBoundingClientRect().right > w - 40; })(${PV})`), true, 'and it stands at the right edge of the page pane');
        // nothing else is ever written as a style, and formatting still works
        const saved = (await ed.download()).text;
        c.eq((saved.match(/style=/gi) || []).length, 3, 'the saved file has the three style attributes the pupil asked for or wrote (two alignments, one colour) and no other');
        const formatted = await ed.format();
        c.ok(formatted.outcome === 'applied' || formatted.outcome === 'tidy', '"Code aufräumen" accepts the aligned page', formatted.outcome + ' ' + formatted.text);
      });
      await withEditor(browser, {}, async (ed) => {
        // the page's own rule centres paragraphs: "left" must then say so
        const source = page('<style>p { text-align: center }</style>\n<p>Mitte durch Regel</p>');
        await ed.openText('f03-regel.html', source);
        await ed.caret('Mitte', 2);
        c.eq(await pressed(ed), 'bAlignCenter', 'the buttons show the alignment that the page rule gives');
        await ed.click('bAlignLeft');
        await ed.settle();
        c.eq(await ed.source(), source.replace('<p>Mitte', '<p style="text-align: left">Mitte'), 'left is written out when a rule of the page would align differently');
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), source.replace('<p>Mitte', '<p style="text-align: center">Mitte'), 'and can be changed again');
        // new paragraph typed after an aligned one
        await ed.openText('f03-neu.html', page('  <p style="text-align: center">Erste</p>'));
        await ed.caret('Erste', 5);
        await ed.key('Enter');
        await ed.type('Zweite');
        await ed.settle();
        const typed = await ed.source();
        c.ok(/<p style="text-align: center">Erste<\/p>\n  <p( style="text-align: center")?>Zweite<\/p>/.test(typed), 'Enter after an aligned paragraph gives a paragraph with at most this alignment as style', typed.split('\n').slice(7, 10).join('\n'));
        c.note('alignment of the paragraph made by Enter', /Zweite/.test(typed) && /center">Zweite/.test(typed) ? 'continues the alignment (browser behaviour)' : 'starts without alignment');
      });
    },
  },
  {
    id: 'F-04', title: 'the version stands small next to the name in the top bar and does not wrap',
    async run(c, { browser }) {
      const version = JSON.parse(fs.readFileSync(path.join(TMP, '..', '..', '..', 'package.json'), 'utf8')).version;
      await withEditor(browser, {}, async (ed) => {
        c.eq(await ed.eval('document.querySelector("#top .brand strong").textContent'), 'HTML-Schuleditor ' + version, 'the name is followed by the version ' + version);
        const look = JSON.parse(await ed.eval('(() => { const s = getComputedStyle(document.getElementById("appVer")), n = getComputedStyle(document.querySelector("#top .brand strong")); return JSON.stringify({ small: parseFloat(s.fontSize) < parseFloat(n.fontSize), grey: s.color !== n.color }); })()'));
        c.ok(look.small && look.grey, 'smaller and in another colour than the name', JSON.stringify(look));
        for (const width of [1800, 1000, 640]) {
          const lines = await ed.eval(`(() => { const top = document.getElementById("top"); top.style.width = "${width}px"; const r = document.createRange(); r.selectNodeContents(document.querySelector("#top .brand strong").firstChild); const name = r.getBoundingClientRect(), ver = document.getElementById("appVer").getBoundingClientRect(); top.style.width = ""; return ver.left >= name.right - 1 && ver.top < name.bottom && ver.bottom > name.top; })()`);
          c.ok(lines, 'name and version stay on one line in a top bar ' + width + ' pixels wide');
        }
      });
    },
  },
];
