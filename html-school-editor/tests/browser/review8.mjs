// Cases A8-01 … A8-03 for the findings F1 to F3 of the interim review of 0.1.0-alpha.8. Each case follows the
// reviewer's input; expected source texts are written by hand.
import { Editor, PV, sleep, tmpFile } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body, head = '') => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>A8</title>\n' + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const tableEdit = async (ed, label) => { await ed.click('bTable'); await ed.dialogButton('dlgTable', label); await ed.settle(); };
const inCell = (ed, r, c) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const cell = d.querySelector("table").rows[${r}].cells[${c}]; d.getSelection().collapse(cell, cell.childNodes.length); })(${PV}, document.getElementById("pv").contentWindow)`).then(() => sleep(30));
const atEnd = (ed, sel, i) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const el = d.querySelectorAll(${JSON.stringify(sel)})[${i}]; const r = d.createRange(); r.selectNodeContents(el); r.collapse(false); const s = d.getSelection(); s.removeAllRanges(); s.addRange(r); })(${PV}, document.getElementById("pv").contentWindow)`).then(() => sleep(30));
// A file handle of a labelled mock: every close waits until the test releases it; the writes are recorded with
// the name of the handle they went to. The picker is counted.
const HELD_SAVE = `window.a8 = { picker: 0, writes: [], gates: [] };
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async (o) => { window.a8.picker++; const name = (o && o.suggestedName) || 'neu.html';
    return { name, createWritable: async () => { let text = ''; return { write: async (b) => { text = await b.text(); },
      close: () => new Promise((r) => { window.a8.gates.push(() => { window.a8.writes.push([name, text]); r(); }); }) }; } }; } });`;

export const review8 = [
  {
    id: 'A8-01', title: 'interim review F1: a save that waits behind a hanging write belongs to its page; another page opened meanwhile is not saved',
    async run(c, { browser }) {
      for (const answer of ['Änderungen verwerfen', 'Abbrechen']) {
        await withEditor(browser, { init: HELD_SAVE }, async (ed) => {
          await ed.openText('a8-01.html', page('<p>eins</p>'));
          await atEnd(ed, 'p', 0);
          await ed.type('1');
          await ed.settle();
          await ed.key('s', ['ctrl']);
          await ed.until('window.a8.gates.length === 1', 'first write held in close');
          await atEnd(ed, 'p', 0);
          await ed.type('2');
          await ed.settle();
          await ed.key('s', ['ctrl']);
          await sleep(200);
          await ed.openFile(tmpFile('a8-01-zweite.html', page('<p>zweite</p>')), { wait: false });
          await ed.until('document.getElementById("dlgConfirm").open', 'question before the page is replaced');
          await ed.dialogButton('dlgConfirm', answer);
          await sleep(300);
          await ed.eval('window.a8.gates[0]()');
          await sleep(500);
          if (answer === 'Abbrechen') {
            await ed.until('window.a8.gates.length === 2', 'the waiting save writes');
            await ed.eval('window.a8.gates[1]()');
            await sleep(300);
          }
          const w = await ed.eval('JSON.stringify(window.a8)').then(JSON.parse);
          if (answer === 'Abbrechen') {
            c.eq(JSON.stringify(w.writes), JSON.stringify([['a8-01.html', page('<p>eins1</p>')], ['a8-01.html', page('<p>eins12</p>')]]), 'the page stays: the waiting save writes its newest text last');
          } else {
            c.eq(JSON.stringify(w.writes), JSON.stringify([['a8-01.html', page('<p>eins1</p>')]]), 'another page opened after "Änderungen verwerfen": the waiting save is dropped, only the first write happened');
            c.eq(w.picker, 1, 'and nothing is asked or saved for the new page');
            c.eq(await ed.source(), page('<p>zweite</p>'), 'the new page is open');
            c.eq(await ed.dirtyText(), 'gespeichert', 'and counts as saved, as it was opened');
          }
        });
      }
      c.note('mock', 'showSaveFilePicker returns a labelled mock handle whose closes are held by the test; the writes are recorded');
    },
  },
  {
    id: 'A8-02', title: 'interim review F2: in a table with rows or cells partly on lines, adding and deleting gives the text back; the line break behind a deleted cell stays',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const rows = page('<table><tr><td>a</td><td>b</td></tr>\n<tr><td>c</td><td>d</td></tr>\n</table>');
        await ed.openText('a8-02.html', rows);
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Zeile darunter einfügen');
        c.eq(await ed.source(), page('<table><tr><td>a</td><td>b</td></tr><tr><td></td><td></td></tr>\n<tr><td>c</td><td>d</td></tr>\n</table>'), 'the new row follows the first row directly, as that one is written');
        await inCell(ed, 1, 0);
        await tableEdit(ed, 'Zeile löschen');
        c.eq(await ed.source(), rows, 'deleting it gives the text back, with the line break in front of the third row');
        const cells = page('<table>\n  <tr><td>a</td>\n    <td>b</td>\n  </tr>\n</table>');
        await ed.openText('a8-02b.html', cells);
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Spalte rechts einfügen');
        c.eq(await ed.source(), page('<table>\n  <tr><td>a</td><td></td>\n    <td>b</td>\n  </tr>\n</table>'), 'the new cell follows the first cell directly');
        await inCell(ed, 0, 1);
        await tableEdit(ed, 'Spalte löschen');
        c.eq(await ed.source(), cells, 'deleting it gives the text back, with the line break and indentation in front of b');
        await ed.openText('a8-02c.html', page('<table><tr><td>a</td><td>b</td>\n<td>c</td></tr></table>'));
        await inCell(ed, 0, 1);
        await tableEdit(ed, 'Spalte löschen');
        c.eq(await ed.source(), page('<table><tr><td>a</td>\n<td>c</td></tr></table>'), 'a cell of the source deleted: the line break in front of c stays');
        const open = page('<table>\n<tr><td>a<td>b\n</table>');
        await ed.openText('a8-02d.html', open);
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Zeile darunter einfügen');
        await inCell(ed, 1, 0);
        await tableEdit(ed, 'Zeile löschen');
        c.eq(await ed.source(), open, 'behind a row without end tag the white space of the deleted row goes too: the text is as before');
      });
    },
  },
  {
    id: 'A8-03', title: 'interim review F3: a new list item behind one without end tag: the item gets its end tag, so the line break is not part of its text',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const head = '  <style>li { white-space: pre }</style>\n';
        await ed.openText('a8-03.html', page('<ul><li>a<li>b</ul>', head));
        const before = await ed.eval(PV + '.querySelector("li").getBoundingClientRect().height');
        await atEnd(ed, 'li', 0);
        await ed.key('Enter');
        await ed.type('x');
        await ed.settle(1300);
        c.eq(await ed.source(), page('<ul><li>a</li>\n  <li>x</li><li>b</ul>', head), 'Enter behind a: a gets </li>, the new item stands on its own line, b keeps its omitted end tag');
        c.eq(await ed.eval('new DOMParser().parseFromString(document.getElementById("src").value, "text/html").querySelector("li").textContent'), 'a', 'the first item still holds only "a"');
        c.eq(await ed.eval(PV + '.querySelector("li").getBoundingClientRect().height'), before, 'and is as high as before');
        await ed.openText('a8-03b.html', page('<dl><dt>T1<dd>D1</dl>'));
        await atEnd(ed, 'dt', 0);
        await ed.key('Enter');
        await ed.type('n');
        await ed.settle(1300);
        c.eq(await ed.eval('JSON.stringify(Array.from(new DOMParser().parseFromString(document.getElementById("src").value, "text/html").querySelectorAll("dt, dd"), (e) => e.textContent))'), JSON.stringify(['T1', 'n', 'D1']), 'definition list: T1 keeps its text, D1 too');
        await ed.openText('a8-03c.html', page('<ul>\n  <li>a\n  <li>b\n</ul>'));
        await atEnd(ed, 'li', 0);
        await ed.key('Enter');
        await ed.type('x');
        await ed.settle(1300);
        // the new item is written directly in front of b, as in alpha.8: the line break in front of it belongs to a
        c.eq(await ed.source(), page('<ul>\n  <li>a\n  <li>x</li><li>b\n</ul>'), 'an item that ends with its own line break keeps its omitted end tag');
      });
    },
  },
];
