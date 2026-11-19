// Cases F-01 … F-03 for the functions the owner asked for after trying 0.1.0-alpha.2: images addressed by
// file name (optional folder, optional description, width), changing existing images and links through the
// dialogs, and text alignment. Expected source texts are written by hand.
import fs from 'node:fs';
import path from 'node:path';
import { Editor, PV, ARTEFACT, TMP, sleep, tmpFile, makePng } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body) => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>F</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const imgState = (ed, index = 0) => ed.eval(`((d) => { const i = d.querySelectorAll("img")[${index}]; return JSON.stringify({ kind: (i.getAttribute("src") || "").split(":")[0], natural: i.naturalWidth, shown: Math.round(i.getBoundingClientRect().width), box: i.hasAttribute("data-se-src") }); })(${PV})`).then(JSON.parse);
const imgError = (ed) => ed.eval('document.getElementById("imgErr").textContent');
const pressed = (ed) => ed.eval('["bAlignLeft", "bAlignCenter", "bAlignRight", "bAlignJustify"].filter((id) => document.getElementById(id).getAttribute("aria-pressed") === "true").join(",")');
// a 16 x 16 picture embedded in the code (large enough to be clicked)
const SMALL_GIF = 'data:image/png;base64,' + makePng(16, 16, false).toString('base64');

export const features = [
  {
    id: 'F-01', title: 'images are addressed by file name: folder, width, optional description; files next to the editor are never read',
    async run(c, { browser, sink }) {
      const png = tmpFile('f01-katze.png', makePng(120, 80, false));
      let saved = '';
      await withEditor(browser, {}, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.click('bImage');
        await ed.pickImage(png);
        await ed.field('imgDir', 'a:b');
        await ed.dialogButton('dlgImage', 'Einfügen');
        c.ok(await ed.dialogOpen('dlgImage') && (await imgError(ed)).includes('Unterordner'), 'a folder name with a colon is refused with an explanation', await imgError(ed));
        await ed.field('imgDir', ' bilder\\fotos/ ');
        for (const bad of ['abc', '0', '12.5']) {
          await ed.field('imgWidth', bad);
          await ed.dialogButton('dlgImage', 'Einfügen');
          c.ok(await ed.dialogOpen('dlgImage') && (await imgError(ed)).includes('Breite'), 'width "' + bad + '" is refused with an explanation');
        }
        await ed.field('imgWidth', '60');
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        c.ok((await ed.source()).includes('  <p>Hier steht mein Text.<img src="bilder/fotos/f01-katze.png" alt="" width="60"></p>'), 'folder, file name, empty description and width are written as plain attributes', (await ed.source()).split('\n')[8]);
        let state = await imgState(ed);
        c.ok(state.kind === 'blob' && state.natural === 120 && state.shown === 60, 'the page pane shows the chosen file in the given width', JSON.stringify(state));
        c.eq(await ed.inactiveNote(), '', 'a picture the editor knows is not reported as switched off');
        c.ok((await ed.status()).includes('„bilder/fotos“'), 'the hint names the folder', await ed.status());
        // the folder is remembered for the next picture; a file name with characters that mean something in an address
        const odd = tmpFile('f01 mein bild #1 100%.png', makePng(10, 10, false));
        await ed.caret('Meine erste', 0);
        await ed.click('bImage');
        c.eq(await ed.eval('document.getElementById("imgDir").value'), 'bilder/fotos', 'the folder of the last picture is suggested again');
        await ed.pickImage(odd);
        await ed.field('imgDir', '');
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        c.ok((await ed.source()).includes('<h1><img src="f01 mein bild %231 100%25.png" alt="">Meine erste Webseite</h1>'), 'the characters # and % of a file name are written so that the address still means this file', (await ed.source()).split('\n')[7]);
        state = await imgState(ed, 0);
        c.ok(state.kind === 'blob' && state.natural === 10, 'and the page pane shows it', JSON.stringify(state));
        saved = (await ed.download()).text;
        c.ok(!/data:|blob:/.test(saved), 'the saved file holds file names only, no image data and no internal address');
        // the same file name in another document of this session is shown as well
        await ed.openText('f01-zweite.html', page('<p><img src="f01-katze.png" alt="x"></p>'));
        state = await imgState(ed);
        c.ok(state.kind === 'blob' && state.natural === 120, 'a picture chosen earlier in this session is shown in another page that names the same file', JSON.stringify(state));
      });
      // a fresh editor does not know the files; a copy of the editor with a real picture next to it must not read it
      const dir = path.join(TMP, 'f01-ordner');
      fs.mkdirSync(path.join(dir, 'bilder', 'fotos'), { recursive: true });
      const copy = path.join(dir, 'schuleditor-kopie.html');
      fs.copyFileSync(ARTEFACT, copy);
      fs.copyFileSync(png, path.join(dir, 'f01-katze.png'));
      fs.copyFileSync(png, path.join(dir, 'bilder', 'fotos', 'f01-katze.png'));
      await withEditor(browser, { artefact: copy }, async (ed) => {
        const source = page('<p>A<img src="f01-katze.png" alt="Katze"></p>\n<p>B<img src="bilder/fotos/f01-katze.png"></p>\n<p>C<img src="' + sink.origin + '/f01/aussen.png" alt="von außen"></p>\n<p>D<img alt="klein" src="' + SMALL_GIF + '"></p>');
        const before = sink.hits.length;
        await ed.openText('f01-wieder.html', source);
        await sleep(500);
        const states = [await imgState(ed, 0), await imgState(ed, 1), await imgState(ed, 2), await imgState(ed, 3)];
        c.ok(states[0].box && states[1].box && states[0].natural === 0 && states[1].natural === 0, 'pictures that lie next to the editor are not read: both are shown as a box', JSON.stringify(states.slice(0, 2)));
        c.eq(await ed.eval(PV + '.querySelectorAll("img[src]:not([src^=\\"data:\\"])").length'), 0, 'no image element of the page pane has an address that could be loaded');
        const requests = ed.page.eventsOf('Network.requestWillBeSent').map((e) => e.request.url).filter((u) => /f01-katze|aussen/.test(u));
        c.eq(requests.join(','), '', 'the browser reports no request for any of the pictures');
        c.eq(sink.hits.slice(before).join(','), '', 'nothing reaches the local counter');
        c.ok(states[2].box && states[3].kind === 'data' && states[3].natural === 16, 'a picture from the network is a box, a picture embedded in the code is shown as before', JSON.stringify(states.slice(2)));
        const note = await ed.inactiveNote();
        c.ok(note.includes('2 Bilder aus Dateien') && note.includes('1 Bild von außerhalb'), 'the note tells both kinds apart', note);
        c.ok((await ed.eval(PV + '.querySelector("img").title')).includes('kennt dieses Bild noch nicht'), 'the box explains what to do');
        // choosing the file makes both boxes pictures and leaves the code alone
        await ed.clickPv('d.querySelectorAll("img")[0]');
        await ed.click('bImage');
        c.eq(await ed.eval('document.getElementById("imgTitle").textContent + "|" + document.getElementById("imgName").textContent + "|" + document.getElementById("imgAlt").value'), 'Bild ändern|Jetzt: f01-katze.png|Katze', 'a click on the box and "Bild" opens the dialog for this picture');
        await ed.pickImage(png);
        await ed.dialogButton('dlgImage', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), source, 'choosing the file again does not change the code');
        const again = [await imgState(ed, 0), await imgState(ed, 1)];
        c.ok(again.every((s) => s.kind === 'blob' && s.natural === 120 && !s.box), 'both places that name this file now show it', JSON.stringify(again));
        c.ok((await ed.inactiveNote()).includes('1 Bild von außerhalb') && !(await ed.inactiveNote()).includes('Dateien'), 'the note no longer lists them', await ed.inactiveNote());
        c.eq(sink.hits.slice(before).join(','), '', 'still nothing reached the local counter');
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
        await edit(2, () => ed.pickImage(png));
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
];
