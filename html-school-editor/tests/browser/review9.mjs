// Cases A9-01 … A9-07 for the findings of the second reading review of 0.1.0-alpha.9 and the interim findings left
// open (F4, F5, F6). Each case follows the reviewer's input or the reproduction that confirmed it; expected source
// texts are written by hand.
import { Editor, PV, sleep } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body, head = '') => '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>A9</title>\n' + head + '</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const tableEdit = async (ed, label) => { await ed.click('bTable'); await ed.dialogButton('dlgTable', label); await ed.settle(); };
const color = async (ed, label) => { await ed.click('bColor'); await ed.dialogButton('dlgColor', label); await ed.settle(); };
const inCell = (ed, r, c) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const cell = d.querySelector("table").rows[${r}].cells[${c}]; d.getSelection().collapse(cell, cell.childNodes.length); })(${PV}, document.getElementById("pv").contentWindow)`).then(() => sleep(30));
const atEnd = (ed, sel, i) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const el = d.querySelectorAll(${JSON.stringify(sel)})[${i}]; const r = d.createRange(); r.selectNodeContents(el); r.collapse(false); const s = d.getSelection(); s.removeAllRanges(); s.addRange(r); })(${PV}, document.getElementById("pv").contentWindow)`).then(() => sleep(30));
const msg = (ed) => ed.status();

// Labelled mock of files with handles: every file has a content "on disk" that changes only when a writer
// closes, as with the File System Access API. The open picker hands out the next handle of `a9.queue`; the save
// picker hands out a new handle. close() of a write waits while `a9.hold` is set; `a9.release(i, fail)` ends it.
const FILES = `window.a9 = { disk: {}, writes: [], gates: [], hold: true, queue: [], saved: 0, handles: {} };
  window.a9.file = (name, text) => { a9.disk[name] = text; const h = a9.handles[name] || { name, kind: 'file',
    getFile: async () => new File([a9.disk[name]], name, { type: 'text/html' }),
    isSameEntry: async (o) => o === h,
    createWritable: async () => { let text = ''; return { write: async (b) => { text = await b.text(); },
      close: () => new Promise((res, rej) => { const done = (fail) => { if (fail) { rej(new DOMException('mock', 'InvalidStateError')); return; } a9.disk[name] = text; a9.writes.push([name, text]); res(); };
        if (a9.hold) a9.gates.push(done); else done(false); }) }; } }; a9.handles[name] = h; return h; };
  window.a9.release = (i, fail) => a9.gates[i](fail);
  Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: async () => [a9.queue.shift()] });
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async (o) => { a9.saved++; return a9.file((o && o.suggestedName) || 'neu.html', ''); } });`;
const openMock = async (ed, name, text) => {
  await ed.eval(`a9.queue.push(a9.file(${JSON.stringify(name)}, ${JSON.stringify(text)}))`);
  await ed.eval('document.getElementById("msg").textContent = ""');
  await ed.click('bOpen');
  await ed.until('document.getElementById("dlgConfirm").open || document.getElementById("msg").textContent.startsWith("Geöffnet")', 'opened or question');
};
const typeAt = async (ed, sel, text) => { await atEnd(ed, sel, 0); await ed.type(text); await ed.settle(); };
const state = (ed) => ed.eval('JSON.stringify({ writes: a9.writes, disk: a9.disk, gates: a9.gates.length, saved: a9.saved })').then(JSON.parse);

export const review9 = [
  {
    id: 'A9-01', title: 'review of alpha.9, S1 (F9): the same file opened again while its first write hangs; after the write it counts as not saved, with a message. Another page: "Die vorige Seite … ist gespeichert"',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'seite-a.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', '1');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.gates.length === 1', 'first write held in close');
        await typeAt(ed, 'p', '2');
        await ed.key('s', ['ctrl']);
        await sleep(200);
        await openMock(ed, 'seite-a.html', '<p>alt</p>');
        c.ok(await ed.dialogOpen('dlgConfirm'), 'opening the file again asks first');
        c.ok((await ed.eval('document.getElementById("confirmText").textContent')).includes('gerade noch gespeichert'), 'and the question says that the page is still being saved', await ed.eval('document.getElementById("confirmText").textContent'));
        await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
        await ed.until('document.getElementById("msg").textContent.startsWith("Geöffnet")', 'opened again');
        await ed.synced();
        c.eq(await ed.source(), '<p>alt</p>', 'the file is read as it is on disk while the write has not ended');
        await ed.eval('a9.release(0)');
        await sleep(400);
        const s = await state(ed);
        c.eq(JSON.stringify(s.writes), JSON.stringify([['seite-a.html', '<p>alt1</p>']]), 'the first write ends, the waiting save of the page that was discarded is dropped');
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'the open page differs from the file now: it counts as not saved');
        c.ok((await msg(ed)).includes('früheren Stand'), 'and the pupil is told', await msg(ed));
      });
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'seite-a.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', '1');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.gates.length === 1', 'first write held in close');
        await typeAt(ed, 'p', '2');
        await openMock(ed, 'seite-b.html', '<p>bee</p>');
        await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
        await ed.until('document.getElementById("msg").textContent.startsWith("Geöffnet")', 'B opened');
        await ed.eval('a9.release(0)');
        await sleep(400);
        c.eq(await msg(ed), 'Die vorige Seite „seite-a.html“ ist gespeichert.', 'another page is open: the footer names the page that was saved');
        c.eq(await ed.dirtyText(), 'gespeichert', 'and B counts as saved, as it was opened');
      });
      c.note('mock', 'showOpenFilePicker and showSaveFilePicker return labelled mock handles whose content changes on close(), which the test holds');
    },
  },
  {
    id: 'A9-02', title: 'interim review F5: while the file is written the top bar says "Speichert …", also when another message takes the footer',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'seite-a.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', '1');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.gates.length === 1', 'first write held in close');
        c.eq(await ed.dirtyText(), 'Speichert …', 'the top bar says "Speichert …"');
        await ed.eval('(() => { const f = document.getElementById("pvTitle"); f.focus(); f.select(); })()');
        await ed.type('Neu');
        await ed.key('Enter');
        await sleep(200);
        c.ok((await msg(ed)).startsWith('Der Titel'), 'another message takes the footer', await msg(ed));
        c.eq(await ed.dirtyText(), 'Speichert …', 'the top bar still says "Speichert …"');
        await ed.eval('a9.release(0)');
        await sleep(300);
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'after the write: not saved, because the title changed meanwhile');
      });
      c.note('mock', 'labelled mock handles as in A9-01');
    },
  },
  {
    id: 'A9-03', title: 'interim review F6: a colour or alignment declaration with !important is left as written, with a message',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const src = page('<p style="color: red !important">Text eins</p>\n<p style="text-align:center !important">Text zwei</p>');
        await ed.openText('a9-03.html', src);
        for (const [what, act] of [['red again', () => color(ed, 'Rot')], ['another colour', () => color(ed, 'Blau')], ['colour removed', () => color(ed, 'Farbe entfernen')]]) {
          await ed.selectPv('Text eins');
          await act();
          c.eq(await ed.source(), src, what + ': the style text stays exactly as written');
          c.ok((await msg(ed)).includes('nicht sicher lesen'), 'with a message', await msg(ed));
        }
        for (const button of ['bAlignCenter', 'bAlignLeft']) {
          await ed.caret('Text zwei', 2);
          await ed.click(button);
          await ed.settle();
          c.eq(await ed.source(), src, button + ': the alignment with !important stays exactly as written');
        }
      });
    },
  },
  {
    id: 'A9-04', title: 'interim review F4: "Links" next to a rule of the page with !important says that the rule can override it',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const head = '  <style>@media print { p { text-align: center !important } }</style>\n';
        await ed.openText('a9-04.html', page('<p style="text-align: right">x</p>', head));
        await ed.caret('x', 0);
        await ed.click('bAlignLeft');
        await ed.settle();
        c.eq(await ed.source(), page('<p style="text-align: left">x</p>', head), 'the left alignment is written out as before');
        c.ok((await msg(ed)).includes('!important'), 'and the pupil is told that a rule with !important can override it', await msg(ed));
        const plainHead = '  <style>@media print { p { text-align: center } }</style>\n';
        await ed.openText('a9-04b.html', page('<p style="text-align: right">x</p>', plainHead));
        await ed.eval('document.getElementById("msg").textContent = ""');
        await ed.caret('x', 0);
        await ed.click('bAlignLeft');
        await ed.settle();
        c.ok(!(await msg(ed)).includes('!important'), 'a print rule without !important: no such message', await msg(ed));
      });
    },
  },
  {
    id: 'A9-05', title: 'review of alpha.9, S3-01: a new item behind the last item without end tag; that item gets its end tag, so the line break is not part of its text',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const head = '  <style>li, dd, dt { white-space: pre }</style>\n';
        await ed.openText('a9-05.html', page('<ul><li>a</ul>', head));
        const before = await ed.eval(PV + '.querySelector("li").getBoundingClientRect().height');
        await atEnd(ed, 'li', 0);
        await ed.key('Enter');
        await ed.type('x');
        await ed.settle(1300);
        c.eq(await ed.source(), page('<ul><li>a</li>\n  <li>x</li>\n</ul>', head), 'Enter behind the only item a: a gets </li>');
        c.eq(await ed.eval(PV + '.querySelector("li").getBoundingClientRect().height'), before, 'a is as high as before');
        await ed.openText('a9-05b.html', page('<ol><li>a<li>b</ol>', head));
        await atEnd(ed, 'li', 1);
        await ed.key('Enter');
        await ed.type('x');
        await ed.settle(1300);
        c.eq(await ed.source(), page('<ol><li>a<li>b</li>\n  <li>x</li>\n</ol>', head), 'behind the last of two items: b gets </li>, a keeps its omitted end tag');
        await ed.openText('a9-05c.html', page('<dl><dt>T1<dd>D1</dl>', head));
        await atEnd(ed, 'dt', 0);
        await ed.key('Enter');
        await ed.type('n');
        await ed.settle(1300);
        // Edge makes a new dt behind a dt, Firefox a dd; the expected text follows the element the browser made
        const kind = await ed.eval(PV + '.querySelectorAll("dt, dd")[1].localName');
        c.eq(await ed.source(), page('<dl><dt>T1</dt>\n  <' + kind + '>n</' + kind + '><dd>D1</dl>', head), 'definition list, exact text: T1 gets </dt>, D1 keeps its omitted end tag');
      });
    },
  },
  {
    id: 'A9-06', title: 'review of alpha.9, S2 case 3: deleting the first cell of a row keeps the indentation of the next cell',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.openText('a9-06.html', page('<table><tr>\n  <td>a</td>\n      <td>b</td>\n</tr></table>'));
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Spalte löschen');
        c.eq(await ed.source(), page('<table><tr>\n      <td>b</td>\n</tr></table>'), 'b keeps the six spaces in front of it');
        const rows = page('<table>\n  <tr><td>a</td></tr>\n  <tr><td>b</td></tr>\n</table>');
        await ed.openText('a9-06b.html', rows);
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Zeile darunter einfügen');
        await inCell(ed, 0, 0);
        await tableEdit(ed, 'Zeile löschen');
        c.eq(await ed.source(), page('<table>\n  <tr>\n    <td></td>\n  </tr>\n  <tr><td>b</td></tr>\n</table>'), 'deleting the first row of a table on lines: the next row keeps its line');
      });
    },
  },
  {
    id: 'A9-07', title: 'review of alpha.9, S1 points 3 and 5: another page saved while the first one writes; a failed first write and a waiting second one',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'seite-a.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', '1');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.gates.length === 1', 'first write held in close');
        await openMock(ed, 'seite-b.html', '<p>bee</p>');
        if (await ed.dialogOpen('dlgConfirm')) await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
        await ed.until('document.getElementById("msg").textContent.startsWith("Geöffnet")', 'B opened');
        await ed.synced();
        await typeAt(ed, 'p', '2');
        await ed.key('s', ['ctrl']);
        await sleep(200);
        await ed.eval('a9.release(0)');
        await ed.until('a9.gates.length === 2', 'the save of B writes');
        await ed.eval('a9.release(1)');
        await sleep(300);
        const s = await state(ed);
        c.eq(JSON.stringify(s.writes), JSON.stringify([['seite-a.html', '<p>alt1</p>'], ['seite-b.html', '<p>bee2</p>']]), 'A is written, then B through its own handle');
        c.eq(s.saved, 0, 'no save picker is asked for either page');
        c.eq(await ed.dirtyText(), 'gespeichert', 'B counts as saved');
      });
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'seite-a.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', '1');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.gates.length === 1', 'first write held in close');
        await typeAt(ed, 'p', '2');
        await ed.key('s', ['ctrl']);
        await sleep(200);
        await ed.eval('a9.release(0, true)');
        await ed.until('a9.gates.length === 2', 'the waiting save writes after the failure');
        await ed.eval('a9.release(1)');
        await sleep(300);
        c.eq(JSON.stringify((await state(ed)).writes), JSON.stringify([['seite-a.html', '<p>alt12</p>']]), 'the first write fails, the waiting one writes the newest text');
        c.eq(await ed.dirtyText(), 'gespeichert', 'and the page counts as saved');
      });
      c.note('mock', 'labelled mock handles as in A9-01');
    },
  },
];
