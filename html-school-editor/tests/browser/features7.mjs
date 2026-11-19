// Cases F-12 … F-16 for step B of the owner's list in 0.1.0-alpha.7: text colour with a fixed palette and
// tables. Expected source texts are written by hand. The cases also try the kinds of input that earlier review
// findings were about (style text with references, cut elements, the order of neighbours, a page that changes
// while a dialog is open).
import { Editor, PV, sleep } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body) => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>F</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const color = async (ed, label) => { await ed.click('bColor'); await ed.dialogButton('dlgColor', label); await ed.settle(); };
// Places the caret at the end of a table cell (the cell may be empty, so it cannot be found by its text).
const inCell = (ed, r, c) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const cell = d.querySelector("table").rows[${r}].cells[${c}]; d.getSelection().collapse(cell, cell.childNodes.length); })(${PV}, document.getElementById("pv").contentWindow)`).then(() => sleep(30));
const tableEdit = async (ed, label) => { await ed.click('bTable'); await ed.dialogButton('dlgTable', label); await ed.settle(); };
const caretCell = (ed) => ed.eval(`((d) => { const n = d.getSelection().anchorNode; const cell = (n.nodeType === 1 ? n : n.parentElement).closest("td, th"); if (!cell) return ""; return cell.parentNode.rowIndex + "," + cell.cellIndex; })(${PV})`);
const rows = (...r) => r.map((cells) => '  <tr>\n' + cells.map((x) => '    ' + x + '\n').join('') + '  </tr>\n').join('');

export const features7 = [
  {
    id: 'F-12', title: 'text colour: a part of a text gets a span, one whole element or a whole paragraph gets the colour on its own tag; changing and removing',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const p2 = '<p style="text-align: center">Zweiter Absatz</p>';
        await ed.openText('f12.html', page('<p>Ein roter Satz mit <b>fett</b> und Rest.</p>\n' + p2));
        await ed.selectPv('roter');
        await color(ed, 'Rot');
        c.eq(await ed.source(), page('<p>Ein <span style="color: red">roter</span> Satz mit <b>fett</b> und Rest.</p>\n' + p2), 'a word inside a paragraph: <span style="color: red">');
        await ed.selectPv('fett');
        await color(ed, 'Blau');
        c.eq(await ed.source(), page('<p>Ein <span style="color: red">roter</span> Satz mit <b style="color: blue">fett</b> und Rest.</p>\n' + p2), 'exactly one whole element: the colour goes on its tag, no span');
        await ed.selectPv('Zweiter Absatz');
        await color(ed, 'Grün');
        const green = '<p style="text-align: center; color: green">Zweiter Absatz</p>';
        c.eq(await ed.source(), page('<p>Ein <span style="color: red">roter</span> Satz mit <b style="color: blue">fett</b> und Rest.</p>\n' + green), 'a whole paragraph: the colour is added to its style; the alignment stays');
        await ed.caret('roter', 2);
        await color(ed, 'Lila');
        c.eq(await ed.source(), page('<p>Ein <span style="color: purple">roter</span> Satz mit <b style="color: blue">fett</b> und Rest.</p>\n' + green), 'the caret in a coloured word: the colour of that span is changed');
        await ed.selectPv('roter');
        await color(ed, 'Farbe entfernen');
        c.eq(await ed.source(), page('<p>Ein roter Satz mit <b style="color: blue">fett</b> und Rest.</p>\n' + green), '"Farbe entfernen" on the span: the span goes');
        const before = await ed.source();
        await ed.selectPv('Zweiter');
        await color(ed, 'Farbe entfernen');
        c.eq(await ed.source(), before, 'removing from a part of a coloured paragraph changes nothing');
        c.ok((await ed.status()).includes('größeren Teil'), 'and says that the colour comes from a larger part', await ed.status());
        await ed.caret('Rest', 1, 3);
        await color(ed, 'Orange');
        c.eq(await ed.source(), page('<p>Ein roter Satz mit <b style="color: blue">fett</b> und R<span style="color: orange">es</span>t.</p>\n' + green), 'letters inside a word get a span');
        await ed.selectNodes('d.querySelector("p").firstChild', 'd.querySelector("p").lastChild');
        await color(ed, 'Rot');
        const whole = page('<p style="color: red">Ein roter Satz mit <b>fett</b> und Rest.</p>\n' + green);
        c.eq(await ed.source(), whole, 'the whole first paragraph: the colour goes on the paragraph and the colours inside it go');
        c.eq(await ed.eval(PV + '.querySelectorAll("span").length'), 0, 'no span is left in the page');
        await ed.click('bUndo');
        await ed.settle();
        c.eq(await ed.source(), page('<p>Ein roter Satz mit <b style="color: blue">fett</b> und R<span style="color: orange">es</span>t.</p>\n' + green), 'one undo step per colour');
        await ed.click('bRedo');
        await ed.settle();
        c.eq((await ed.download()).text, whole, 'the saved file holds exactly the source');
      });
    },
  },
  {
    id: 'F-13', title: 'text colour keeps what it does not change: style text with references, cut colour spans, unreadable style',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const refs = page('<p>Mit <b style="font-family: &#34;A B&#34;">fett</b> hier.</p>');
        await ed.openText('f13.html', refs);
        await ed.selectPv('fett');
        await color(ed, 'Braun');
        c.eq(await ed.source(), page('<p>Mit <b style="font-family: &#34;A B&#34;; color: brown">fett</b> hier.</p>'), 'the colour is added; the rest of the style keeps its references');
        await ed.selectPv('fett');
        await color(ed, 'Farbe entfernen');
        c.eq(await ed.source(), refs, 'removed again: the original text');
        await ed.openText('f13-schnitt.html', page('<p><span style="color: red">abc</span>def</p>'));
        await ed.caret('abc', 2, 3);
        const range = await ed.eval(`((d) => { const s = d.getSelection(), r = s.getRangeAt(0), t = d.querySelector("p").lastChild; r.setEnd(t, 2); s.removeAllRanges(); s.addRange(r); return s.toString(); })(${PV})`);
        c.eq(range, 'cde', 'the selection runs from inside the red span into the text behind it');
        await color(ed, 'Blau');
        c.eq(await ed.source(), page('<p><span style="color: red">ab</span><span style="color: blue">cde</span>f</p>'), 'the red span is cut, the selected text gets one blue span');
        await ed.openText('f13-klasse.html', page('<p><span class="k" style="color: red">abc</span> x</p>'));
        await ed.selectPv('abc');
        await color(ed, 'Grün');
        c.eq(await ed.source(), page('<p><span class="k" style="color: green">abc</span> x</p>'), 'a span with a class keeps it; only the colour value changes');
        await ed.selectPv('abc');
        await color(ed, 'Farbe entfernen');
        c.eq(await ed.source(), page('<p><span class="k">abc</span> x</p>'), 'without colour the span with a class stays');
        await ed.openText('f13-liste.html', page('<ul>\n<li>eins</li>\n<li>zwei</li>\n</ul>\n<p>abc</p>\n<p>def</p>'));
        await ed.selectNodes('d.querySelectorAll("li")[0].firstChild', 'd.querySelectorAll("li")[1].firstChild');
        await color(ed, 'Grün');
        c.eq(await ed.source(), page('<ul>\n<li style="color: green">eins</li>\n<li style="color: green">zwei</li>\n</ul>\n<p>abc</p>\n<p>def</p>'), 'two whole list items: each item gets the colour');
        await ed.caret('abc', 1);
        await ed.eval(`((d) => { const s = d.getSelection(), r = s.getRangeAt(0); r.setEnd(d.querySelectorAll("p")[1].firstChild, 2); s.removeAllRanges(); s.addRange(r); })(${PV})`);
        await color(ed, 'Rot');
        c.eq(await ed.source(), page('<ul>\n<li style="color: green">eins</li>\n<li style="color: green">zwei</li>\n</ul>\n<p>a<span style="color: red">bc</span></p>\n<p><span style="color: red">de</span>f</p>'), 'parts of two paragraphs: one span in each, the order stays');
        const odd = page('<p><b style="x:\'a">fett</b> und mehr</p>');
        await ed.openText('f13-offen.html', odd);
        await ed.selectPv('fett');
        await color(ed, 'Rot');
        c.eq(await ed.source(), odd, 'a style text that is not closed is left alone');
        c.ok((await ed.status()).includes('nicht sicher lesen'), 'with a message', await ed.status());
        await ed.selectPv('fett');
        await ed.click('bColor');
        await ed.eval('document.getElementById("src").value += " "');
        await ed.eval('document.getElementById("src").dispatchEvent(new Event("input", { bubbles: true }))');
        await ed.dialogButton('dlgColor', 'Rot');
        await ed.settle();
        c.ok(!(await ed.source()).includes('color'), 'the code changed while the dialog was open: the colour is not applied', await ed.source());
      });
    },
  },
  {
    id: 'F-14', title: 'tables: a new table is written as plain, indented HTML with th, td and border="1"; Tab moves between cells',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.openText('f14.html', page('<p>Vor der Tabelle</p>\n<p>Danach</p>'));
        await ed.caret('Vor der', 2);
        await ed.click('bTable');
        c.eq(await ed.eval('[document.getElementById("tblTitle").textContent, document.getElementById("tblNew").hidden, document.getElementById("tblEdit").hidden].join("|")'), 'Tabelle einfügen|false|true', 'outside a table the dialog asks for rows and columns');
        await ed.field('tblRows', '2');
        await ed.field('tblCols', '3');
        await ed.dialogButton('dlgTable', 'Einfügen');
        await ed.settle();
        const empty = '<table border="1">\n' + rows(['<th></th>', '<th></th>', '<th></th>'], ['<td></td>', '<td></td>', '<td></td>']) + '</table>';
        c.eq(await ed.source(), page('<p>Vor der Tabelle</p>\n' + empty + '\n<p>Danach</p>'), 'two rows, three columns, header row, border="1", behind the paragraph');
        c.eq(await caretCell(ed), '0,0', 'the caret stands in the first cell');
        await inCell(ed, 0, 0);
        await ed.type('Name');
        await ed.key('Tab');
        c.eq(await caretCell(ed), '0,1', 'Tab: the next cell');
        await ed.type('Alter');
        await ed.key('Tab');
        await ed.key('Tab');
        c.eq(await caretCell(ed), '1,0', 'Tab at the end of a row: the first cell of the next row');
        await ed.type('Mia');
        await ed.key('Tab', ['shift']);
        c.eq(await caretCell(ed), '0,2', 'Shift+Tab: the cell before');
        await ed.settle();
        const typed = '<table border="1">\n' + rows(['<th>Name</th>', '<th>Alter</th>', '<th></th>'], ['<td>Mia</td>', '<td></td>', '<td></td>']) + '</table>';
        c.eq(await ed.source(), page('<p>Vor der Tabelle</p>\n' + typed + '\n<p>Danach</p>'), 'the typed text is in its cells');
        await ed.openText('f14-ohne.html', page('<p>Text</p>'));
        await ed.caret('Text', 4);
        await ed.click('bTable');
        await ed.field('tblRows', '1');
        await ed.field('tblCols', '2');
        await ed.eval('document.getElementById("tblHead").click(); document.getElementById("tblBorder").click()');
        await ed.dialogButton('dlgTable', 'Einfügen');
        await ed.settle();
        c.eq(await ed.source(), page('<p>Text</p>\n<table>\n' + rows(['<td></td>', '<td></td>']) + '</table>'), 'without header row and without border: only td, no attribute');
        await ed.caret('Text', 4);
        await ed.click('bTable');
        await ed.field('tblRows', '0');
        await ed.dialogButton('dlgTable', 'Einfügen');
        c.ok(await ed.dialogOpen('dlgTable') && (await ed.eval('document.getElementById("tblErr").textContent')).includes('1 bis 20'), '0 rows: the dialog stays open with a message');
        await ed.dialogButton('dlgTable', 'Abbrechen');
        const saved = (await ed.download()).text;
        c.eq(saved, page('<p>Text</p>\n<table>\n' + rows(['<td></td>', '<td></td>']) + '</table>'), 'the saved file holds exactly the source');
        await ed.openText('f14-liste.html', page('<ul>\n<li>Punkt</li>\n</ul>\n<p>Ende</p>'));
        await ed.caret('Punkt', 2);
        await ed.click('bTable');
        await ed.field('tblRows', '1');
        await ed.field('tblCols', '1');
        await ed.dialogButton('dlgTable', 'Einfügen');
        await ed.settle();
        c.eq(await ed.source(), page('<ul>\n<li>Punkt</li>\n</ul>\n<table border="1">\n' + rows(['<th></th>']) + '</table>\n<p>Ende</p>'), 'the caret in a list item: the table comes behind the list, not into it');
        const list = await ed.source();
        await ed.caret('Ende', 2);
        await ed.click('bTable');
        await ed.eval('document.getElementById("src").value += " "; document.getElementById("src").dispatchEvent(new Event("input", { bubbles: true }))');
        await ed.dialogButton('dlgTable', 'Einfügen');
        await ed.settle();
        c.eq(await ed.source(), list + ' ', 'the code changed while the dialog was open: no table is inserted');
      });
    },
  },
  {
    id: 'F-15', title: 'tables: rows and columns are added and deleted; neighbours keep their place; merged cells and the last row are left alone',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const t = (body) => page('<p>Vor</p>\n<!-- Hinweis -->\n<table border="1">\n' + body + '</table>\n<p>Nach</p>');
        const start = t(rows(['<th>A</th>', '<th>B</th>'], ['<td>1</td>', '<td>2</td>']));
        await ed.openText('f15.html', start);
        await ed.caret('A', 1);
        await ed.click('bTable');
        c.eq(await ed.eval('[document.getElementById("tblTitle").textContent, document.getElementById("tblNew").hidden, document.getElementById("tblEdit").hidden].join("|")'), 'Tabelle ändern|true|false', 'in a table the dialog offers rows and columns');
        await ed.dialogButton('dlgTable', 'Zeile darunter einfügen');
        await ed.settle();
        const rowAdded = t(rows(['<th>A</th>', '<th>B</th>'], ['<td></td>', '<td></td>'], ['<td>1</td>', '<td>2</td>']));
        c.eq(await ed.source(), rowAdded, 'a row of td below the header row');
        await ed.caret('A', 1);
        await tableEdit(ed, 'Spalte rechts einfügen');
        const colAdded = t(rows(['<th>A</th>', '<th></th>', '<th>B</th>'], ['<td></td>', '<td></td>', '<td></td>'], ['<td>1</td>', '<td></td>', '<td>2</td>']));
        c.eq(await ed.source(), colAdded, 'a column right of A: th in the header row, td below');
        await inCell(ed, 1, 1);
        await tableEdit(ed, 'Zeile löschen');
        c.eq(await ed.source(), t(rows(['<th>A</th>', '<th></th>', '<th>B</th>'], ['<td>1</td>', '<td></td>', '<td>2</td>'])), 'deleting the new row');
        await inCell(ed, 0, 1);
        await tableEdit(ed, 'Spalte löschen');
        c.eq(await ed.source(), start, 'deleting the new column: the table is as written, the comment and the paragraphs are where they were');
        await ed.caret('1', 1);
        await tableEdit(ed, 'Spalte löschen');
        await ed.caret('2', 1);
        await tableEdit(ed, 'Zeile löschen');
        c.eq(await ed.source(), t('  <tr>\n    <th>B</th>\n  </tr>\n'), 'first column and second row deleted');
        await ed.caret('B', 1);
        await tableEdit(ed, 'Zeile löschen');
        c.ok((await ed.status()).includes('letzte Zeile'), 'the last row stays, with a message', await ed.status());
        await tableEdit(ed, 'Spalte löschen');
        c.eq(await ed.source(), t('  <tr>\n    <th>B</th>\n  </tr>\n'), 'the last column stays too');
        for (let i = 0; i < 2; i++) { await ed.click('bUndo'); await ed.settle(); }
        c.eq(await ed.source(), start, 'two undo steps lead back to the table as written: the refused commands made none');
        const joined = page('<table border="1">\n  <tr>\n    <td colspan="2">A</td>\n  </tr>\n</table>');
        await ed.openText('f15-verbunden.html', joined);
        await ed.caret('A', 1);
        await tableEdit(ed, 'Spalte rechts einfügen');
        c.eq(await ed.source(), joined, 'a table with merged cells is not changed');
        c.ok((await ed.status()).includes('verbundene Zellen'), 'with a message', await ed.status());
        await ed.caret('A', 1);
        await ed.click('bTable');
        c.eq(await ed.eval('document.getElementById("tblOk").hidden'), true, 'with the caret in a table there is no "Einfügen": no table inside a table');
        await ed.dialogButton('dlgTable', 'Abbrechen');
      });
    },
  },
  {
    id: 'F-16', title: 'tables in the code as written: "Code aufräumen" with a table, and a table from the source is edited in place',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const compact = '<!DOCTYPE html><html><head><title>T</title></head><body><table border="1"><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table></body></html>';
        await ed.openText('f16.html', compact);
        const r = await ed.format();
        c.eq(r.outcome, 'applied', 'a compact page with a table is tidied', r.text);
        const tidy = await ed.source();
        const parsed = (text) => ed.eval('Array.from(new DOMParser().parseFromString(' + JSON.stringify(text) + ', "text/html").querySelectorAll("th, td"), (x) => x.localName + ":" + x.textContent).join()');
        c.eq(await parsed(tidy), await parsed(compact), 'the cells are the same after tidying');
        await ed.caret('B', 1);
        await tableEdit(ed, 'Spalte rechts einfügen');
        const after = await ed.source();
        c.eq(await parsed(after), 'th:A,th:B,th:,td:1,td:2,td:', 'a column added to the tidied table');
        c.ok(after.replace(/\n\s*<t[hd]><\/t[hd]>/g, '') === tidy, 'nothing else changed', after);
      });
    },
  },
];
