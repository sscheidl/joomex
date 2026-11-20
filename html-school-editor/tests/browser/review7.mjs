// Cases A7-01 … A7-08 for the findings of the independent review of 0.1.0-alpha.6 and 0.1.0-alpha.7. Each case
// follows the reviewer's input; expected source texts are written by hand.
import { Editor, PV, sleep } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body, head = '') => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>A7</title>\n' + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const color = async (ed, label) => { await ed.click('bColor'); await ed.dialogButton('dlgColor', label); await ed.settle(); };
const tableEdit = async (ed, label) => { await ed.click('bTable'); await ed.dialogButton('dlgTable', label); await ed.settle(); };
// Places the caret at the end of cell `c` of row `r` of the first table (the cell may be empty).
const inCell = (ed, r, c) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const cell = d.querySelector("table").rows[${r}].cells[${c}]; d.getSelection().collapse(cell, cell.childNodes.length); })(${PV}, document.getElementById("pv").contentWindow)`).then(() => sleep(30));
// A file handle of a labelled mock: the first close waits until the test releases it; the writes are recorded.
const HELD_SAVE = `window.a7 = { opened: 0, closes: [], held: null };
  const a7Handle = { name: 'a7-ziel.html', createWritable: async () => { const n = ++window.a7.opened; let text = '';
    return { write: async (blob) => { text = await blob.text(); },
      close: async () => { if (n === 1) await new Promise((r) => { window.a7.held = r; }); window.a7.closes.push(text); } }; } };
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => a7Handle });`;

export const review7 = [
  {
    id: 'A7-01', title: 'review finding 1.1h: a comment in the declaration that the colour or the alignment would change: the style stays as written, with a message',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const one = '<p style="/* x */ color: blue">Text eins</p>', two = '<p style="text-align: right /* r */">Text zwei</p>';
        const source = page(one + '\n' + two + '\n<p style="font-family: A /* f */; color: blue">Text drei</p>');
        await ed.openText('a7-01.html', source);
        await ed.selectPv('Text eins');
        await color(ed, 'Rot');
        c.eq(await ed.source(), source, 'red on a paragraph whose colour declaration holds a comment: nothing changes, the comment stays');
        c.ok((await ed.status()).includes('nicht sicher lesen'), 'with a message', await ed.status());
        await ed.caret('Text zwei', 2);
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), source, 'centre on a paragraph whose alignment holds a comment: nothing changes');
        c.ok((await ed.status()).includes('nicht sicher lesen'), 'with a message', await ed.status());
        await ed.selectPv('Text drei');
        await color(ed, 'Rot');
        const red = page(one + '\n' + two + '\n<p style="font-family: A /* f */; color: red">Text drei</p>');
        c.eq(await ed.source(), red, 'a comment in another declaration stays where it is written and the colour changes');
        await color(ed, 'Farbe entfernen');
        c.eq(await ed.source(), page(one + '\n' + two + '\n<p style="font-family: A /* f */">Text drei</p>'), 'removing the colour keeps the other declaration with its comment');
      });
    },
  },
  {
    id: 'A7-02', title: 'review finding 2.3: "Links" writes text-align: left when a rule of the page centres the paragraph only in print',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const cases = [
          ['a print style element', '  <style media="print">p { text-align: center }</style>\n', '<p style="text-align: left">x</p>'],
          ['@media print in a style element', '  <style>@media print { p { text-align: center } }</style>\n', '<p style="text-align: left">x</p>'],
          ['a rule for the hovered paragraph', '  <style>p:hover { text-align: center }</style>\n', '<p style="text-align: left">x</p>'],
          ['print rules without an alignment', '  <style media="print">p { color: gray }</style>\n', '<p>x</p>'],
          ['no style element', '', '<p>x</p>'],
        ];
        for (const [what, head, want] of cases) {
          await ed.openText('a7-02.html', page('<p style="text-align: right">x</p>', head));
          await ed.caret('x', 0);
          await ed.click('bAlignLeft');
          await ed.settle();
          c.eq(await ed.source(), page(want, head), what + ': ' + (want.includes('left') ? 'the left alignment is written out' : 'the declaration goes'));
        }
      });
    },
  },
  {
    id: 'A7-03', title: 'review finding 1.4d: a table whose columns are defined by <colgroup>: columns are not added or deleted, with a message; rows still work',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const cols = '<colgroup><col><col></colgroup>';
        const source = page('<table>' + cols + '<tr><td>a</td><td>b</td></tr></table>');
        await ed.openText('a7-03.html', source);
        for (const label of ['Spalte rechts einfügen', 'Spalte löschen']) {
          await inCell(ed, 0, 0);
          await tableEdit(ed, label);
          c.eq(await ed.source(), source, '"' + label + '" changes nothing');
          c.ok((await ed.status()).includes('Spalten'), 'with a message', await ed.status());
        }
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Zeile darunter einfügen');
        c.eq(await ed.source(), page('<table>' + cols + '<tr><td>a</td><td>b</td></tr><tr><td></td><td></td></tr></table>'), 'a row is still added');
        // <col> without <colgroup>: the browser adds the <colgroup> itself; such a table was never editable in the page
        await ed.openText('a7-03b.html', page('<table><col><col><tr><td>a</td><td>b</td></tr></table>'));
        c.eq(await ed.eval(PV + '.querySelector("table").getAttribute("contenteditable")'), 'false', '<col> without <colgroup>: the table is shown, but changed in the code only (as before)');
      });
    },
  },
  {
    id: 'A7-04', title: 'review finding 2.4: while a save writes, the status says so; saves asked for meanwhile are joined into one that writes the newest text',
    async run(c, { browser }) {
      await withEditor(browser, { init: HELD_SAVE }, async (ed) => {
        await ed.caret('mein Text.', 3);
        await ed.type('X');
        await ed.settle();
        await ed.key('s', ['ctrl']);
        await ed.until('!!window.a7.held', 'first save waits in close');
        c.ok((await ed.status()).startsWith('Speichert'), 'while the file is written the status says "Speichert …"', await ed.status());
        await ed.caret('meiXn Text.', 4);
        await ed.type('Y');
        await ed.settle();
        await ed.key('s', ['ctrl']);
        await ed.caret('meiXYn Text.', 5);
        await ed.type('Z');
        await ed.settle();
        await ed.key('s', ['ctrl']);
        await sleep(300);
        c.ok((await ed.status()).startsWith('Speichert'), 'still "Speichert …" while the first save hangs', await ed.status());
        await sleep(9500);
        c.ok((await ed.status()).startsWith('Speichert'), 'the message does not disappear after nine seconds, as other messages do', await ed.status());
        // since alpha.10 the save state in the top bar says "Speichert …" while the file is written (F5)
        c.eq(await ed.dirtyText(), 'Speichert …', 'and the top bar shows that the page is being saved, not that it is saved');
        c.eq(await ed.eval('window.a7.opened'), 1, 'nothing else is written while the first save is not finished');
        await ed.eval('window.a7.held()');
        await ed.until('window.a7.closes.length === 2', 'the waiting save finished');
        await sleep(300);
        const closes = await ed.eval('JSON.stringify(window.a7.closes)').then(JSON.parse);
        c.eq(JSON.stringify(closes.map((t) => /mei\w*n Text/.exec(t)[0])), JSON.stringify(['meiXn Text', 'meiXYZn Text']), 'two writes, not three: the older text first, then the newest');
        c.eq(await ed.status(), 'Gespeichert: a7-ziel.html', 'then the status says "Gespeichert"');
        c.eq(await ed.dirtyText(), 'gespeichert', 'and the page is shown as saved');
        c.note('mock', 'showSaveFilePicker returns a labelled mock handle whose first close is held by the test; the writes are recorded');
      });
    },
  },
  {
    id: 'A7-05', title: 'review finding 1.4c: in a table written without line breaks, rows and columns are written without line breaks too, and deleting them gives the text back',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const t = (head, bodyRows, foot) => page('<table border="1"><caption>K</caption><thead>' + head + '</thead><tbody>' + bodyRows + '</tbody><tfoot>' + foot + '</tfoot></table>');
        const H = '<tr><th>a</th><th>b</th></tr>', B = '<tr><td>1</td><td>2</td></tr>', F = '<tr><td>s</td><td>t</td></tr>', E = '<tr><td></td><td></td></tr>';
        const source = t(H, B, F);
        await ed.openText('a7-05.html', source);
        const sections = [['thead', 0, t(H + E, B, F)], ['tbody', 1, t(H, B + E, F)], ['tfoot', 2, t(H, B, F + E)]];
        for (const [name, r, added] of sections) {
          await inCell(ed, r, 0);
          await tableEdit(ed, 'Zeile darunter einfügen');
          c.eq(await ed.source(), added, name + ': the new row follows its neighbour directly, as the table is written');
          await inCell(ed, r, 0);
          await tableEdit(ed, 'Spalte rechts einfügen');
          const wide = await ed.source();
          c.ok(wide.includes(name === 'thead' ? '<th>a</th><th></th><th>b</th>' : name === 'tbody' ? '<td>1</td><td></td><td>2</td>' : '<td>s</td><td></td><td>t</td>'), name + ': the new cell follows its neighbour directly', wide);
          await inCell(ed, r, 1);
          await tableEdit(ed, 'Spalte löschen');
          c.eq(await ed.source(), added, name + ': deleting the column gives the text before back');
          await inCell(ed, r + 1, 0);
          await tableEdit(ed, 'Zeile löschen');
          c.eq(await ed.source(), source, name + ': deleting the row gives the original text back, byte for byte');
        }
      });
    },
  },
  {
    id: 'A7-06', title: 'review finding 1.4e: cells and rows written without end tags keep them omitted when a row or column is added and deleted',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const body = (rowsText) => '<p>vor</p>\n<!-- k1 -->\n<table>\n' + rowsText + '</table>\n<p>nach</p>';
        const source = page(body('<tr><td>a<td>b\n<!-- k2 -->\n<tr><td>c<td>d\n'));
        await ed.openText('a7-06.html', source);
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Spalte rechts einfügen');
        c.eq(await ed.source(), page(body('<tr><td>a<td></td><td>b\n<!-- k2 -->\n<tr><td>c<td></td><td>d\n')), 'a new column: the cells as written keep their omitted end tags');
        await inCell(ed, 0, 1);
        await tableEdit(ed, 'Spalte löschen');
        c.eq(await ed.source(), source, 'deleting it again gives the original text back');
        await inCell(ed, 1, 0);
        await tableEdit(ed, 'Zeile löschen');
        c.eq(await ed.source(), page(body('<tr><td>a<td>b\n<!-- k2 -->\n')), 'deleting the second row: the first row keeps its omitted end tags, both comments stay');
      });
    },
  },
  {
    id: 'A7-07', title: 'review finding 2.2-7: an image address without a file name: a changed folder is refused with a message instead of being ignored',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const source = page('<p><img src="?nur" alt="Bild"></p>');
        await ed.openText('a7-07.html', source);
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bImage');
        await ed.dialogButton('dlgImage', 'Übernehmen');
        await ed.settle();
        c.eq(await ed.source(), source, 'accepting the dialog unchanged changes nothing');
        await ed.clickPv('d.querySelector("img")');
        await ed.click('bImage');
        await ed.field('imgDir', 'neu');
        await ed.dialogButton('dlgImage', 'Übernehmen');
        c.eq(await ed.dialogOpen('dlgImage'), true, 'with another folder the dialog stays open');
        c.ok((await ed.eval('document.getElementById("imgErr").textContent')).includes('im Code'), 'and says that this address is changed in the code', await ed.eval('document.getElementById("imgErr").textContent'));
        await ed.dialogButton('dlgImage', 'Abbrechen');
        await ed.settle();
        c.eq(await ed.source(), source, 'the code is unchanged');
      });
    },
  },
  {
    id: 'A7-08', title: 'review finding 2.9-2: white space around a style attribute that holds only the alignment stays as written',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const source = page('<p style="  text-align:center  ">A</p>');
        await ed.openText('a7-08.html', source);
        await ed.caret('A', 0);
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), source, 'centre on a centred paragraph: the text stays exactly as written');
        await ed.click('bAlignRight');
        await ed.settle();
        c.eq(await ed.source(), page('<p style="  text-align: right  ">A</p>'), 'right: the declaration changes, the white space around it stays');
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), page('<p style="  text-align: center  ">A</p>'), 'and back to centre');
      });
    },
  },
];
