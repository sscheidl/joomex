// Cases A10-01 and A10-02 for the two findings left by the reading review of 0.1.0-alpha.10. Each case follows
// the reproduction that confirmed the finding in Edge and Firefox; expected texts are written by hand.
import { PV, sleep } from '../lib/harness.mjs';
import { FILES, withEditor, page, color, msg, openMock, typeAt } from './review9.mjs';

// A file without a handle: a File object in a drop event on the editor window (labelled stand-in for the drag
// of the operating system; the product's own drop handler reads it).
const drop = async (ed, name, text) => {
  await ed.eval('document.getElementById("msg").textContent = ""');
  await ed.eval(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, { type: 'text/html' }));
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); })()`);
  await ed.until('document.getElementById("dlgConfirm").open', 'the drop asks first');
  await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
  await ed.until('document.getElementById("msg").textContent.startsWith("Geöffnet")', 'dropped file opened');
  await ed.synced();
};
// Selects from the start of one element to the end of another.
const pick = (ed, sel, from, to) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const all = d.querySelectorAll(${JSON.stringify(sel)}), a = all[${from}], b = all[${to}];
  const r = d.createRange(); r.setStart(a, 0); r.setEnd(b, b.childNodes.length); const s = d.getSelection(); s.removeAllRanges(); s.addRange(r); })(${PV}, document.getElementById("pv").contentWindow)`).then(() => sleep(30));

// A is opened with a handle, changed and saved; its write is held in close(). Then a file comes without a handle.
const heldWriteOfA = async (ed) => {
  await openMock(ed, 'seite-a.html', '<p>alt</p>');
  await ed.synced();
  await typeAt(ed, 'p', '1');
  await ed.key('s', ['ctrl']);
  await ed.until('a9.gates.length === 1', 'write of A held in close');
};
const endWrite = async (ed) => { await ed.eval('a9.release(0)'); await sleep(400); };

export const review10 = [
  {
    id: 'A10-01', title: 'review of alpha.10, T1-6: while the write of A hangs, a file of the same name from another folder is opened without a handle; it is not taken for A',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        await heldWriteOfA(ed);
        await drop(ed, 'seite-a.html', '<p>ganz anders</p>');
        await endWrite(ed);
        c.eq(await ed.dirtyText(), 'gespeichert', 'B is as its file is: it stays saved when the write of A ends');
        c.eq(await msg(ed), 'Die vorige Seite „seite-a.html“ ist gespeichert.', 'and the footer speaks of the page before');
      });
      await withEditor(browser, { init: FILES }, async (ed) => {
        await heldWriteOfA(ed);
        await drop(ed, 'seite-a.html', '<p>al</p>');
        await typeAt(ed, 'p', 't1');
        c.eq(await ed.source(), '<p>alt1</p>', 'B now reads like the text that is being written to A');
        await endWrite(ed);
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'B was changed and its file was not written: it stays not saved');
      });
      await withEditor(browser, { init: FILES }, async (ed) => {
        await heldWriteOfA(ed);
        await drop(ed, 'seite-a.html', '<p>alt</p>');
        await endWrite(ed);
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'guard: the file A itself dropped while its write hangs (same name, same text as before the write) counts as not saved afterwards');
        c.ok((await msg(ed)).includes('früheren Stand'), 'guard: and the pupil is told', await msg(ed));
      });
      c.note('mock', 'A: labelled mock handle whose content changes on close(), which the test holds. B: a File object in a drop event made by the test');
    },
  },
  {
    id: 'A10-02', title: 'review of alpha.10, T2-3: a part whose own colour cannot be changed (!important, comment) keeps the colours inside it too',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        for (const [what, style] of [['!important', 'color:red !important'], ['a comment', 'color:red /* x */']]) {
          const src = page('<p style="' + style + '">\n  <span style="color:blue">Hallo</span>\n</p>');
          for (const [label, name] of [['Grün', 'green'], ['Farbe entfernen', 'removed']]) {
            await ed.openText('a10-02.html', src);
            await pick(ed, 'p', 0, 0);
            await color(ed, label);
            c.eq(await ed.source(), src, what + ', ' + name + ': nothing changes, the blue inside stays');
            c.ok((await msg(ed)).includes('nicht sicher lesen'), 'with a message', await msg(ed));
          }
        }
        const three = page('<p>eins</p>\n<p style="color:red !important">zwei <span style="color:blue">blau</span></p>\n<p>drei</p>');
        await ed.openText('a10-02b.html', three);
        await pick(ed, 'p', 0, 2);
        await color(ed, 'Grün');
        c.eq(await ed.source(), page('<p style="color: green">eins</p>\n<p style="color:red !important">zwei <span style="color:blue">blau</span></p>\n<p style="color: green">drei</p>'),
          'three paragraphs: the two that can be coloured are green, the one with !important stays whole');
        c.ok((await msg(ed)).includes('nicht sicher lesen'), 'with a message', await msg(ed));
        await ed.key('z', ['ctrl']);
        await ed.settle();
        c.eq(await ed.source(), three, 'one undo gives the text before');
        const plain = page('<p style="color:red">\n  <span style="color:blue">Hallo</span>\n</p>');
        await ed.openText('a10-02c.html', plain);
        await pick(ed, 'p', 0, 0);
        await color(ed, 'Grün');
        c.eq(await ed.source(), page('<p style="color: green">\n  Hallo\n</p>'), 'guard: without !important the paragraph is coloured and the colour inside goes, as before');
      });
    },
  },
];
