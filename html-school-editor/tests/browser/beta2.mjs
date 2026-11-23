// Cases B2-01 … B2-06 for 1.0.0-beta.2, from the owner's first day with a class (2026-11-23): the file buttons,
// "Speichern unter …", the note for browsers that cannot write a file, "Im Browser öffnen" after a download, the
// arrangement of the toolbar and alignment as a switch. Expected texts and orders are written by hand.
import { sleep } from '../lib/harness.mjs';
import { withEditor, page } from './review9.mjs';

// two labelled mock handles; the save picker hands them out in turn and every write is recorded with its target
const PICKERS = `window.b2 = { picker: 0, writes: [], opened: [] };
  const b2Handle = (name) => ({ name, createWritable: async () => { let text = '';
    return { write: async (blob) => { text = await blob.text(); }, close: async () => { window.b2.writes.push([name, text]); } }; } });
  const b2Queue = [b2Handle('erste.html'), b2Handle('zweite.html')];
  Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => { window.b2.picker++; return b2Queue.shift(); } });
  window.open = function (...args) { window.b2.opened.push(args); return null; };`;
const OPEN_MOCK = 'window.b2o = []; window.open = function (...args) { window.b2o.push(args); return null; };';

const labels = (ed, sel) => ed.eval(`JSON.stringify(Array.from(document.querySelectorAll(${JSON.stringify(sel)})).map((g) => Array.from(g.querySelectorAll("button")).map((b) => b.textContent.trim()).join("|")))`);
const visible = (ed, id) => ed.eval(`(() => { const e = document.getElementById(${JSON.stringify(id)}); return !!e && !e.hidden && e.getClientRects().length > 0; })()`);

export const beta2 = [
  {
    id: 'B2-01', title: 'beta.2: "Im Browser öffnen" right after a save that was a download does not ask to save again and downloads nothing more',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true, init: OPEN_MOCK }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' neu');
        const saved = await ed.download('bSave');
        c.ok(saved.text.includes('mein Text. neu'), 'Speichern without file access is a download of the page', saved.name);
        c.eq(await ed.dirtyText(), 'gespeichert', 'afterwards the page counts as saved');
        const before = ed.browser.downloadEvents.length;
        await ed.click('bBrowse');
        await sleep(800);
        c.eq(await ed.dialogOpen('dlgConfirm'), false, 'no question "Erst speichern?" for a page that was just saved');
        c.eq(ed.browser.downloadEvents.length, before, 'no further copy is downloaded');
        c.eq(await ed.eval('window.b2o.length'), 0, 'no tab opens: the copy lies in "Downloads", not next to the editor');
        c.eq(await ed.status(), 'Deine Seite liegt als Kopie im Ordner „Downloads“. Der Editor kann sie dort nicht im Browser öffnen. Öffne sie in „Downloads“ mit einem Doppelklick.', 'the pupil is told where the saved copy lies');
      });
    },
  },
  {
    id: 'B2-02', title: 'beta.2: "Speichern unter …" always asks for a new place; later saves go to the new file',
    async run(c, { browser }) {
      await withEditor(browser, { init: PICKERS }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' eins');
        await ed.key('s', ['ctrl']);
        await ed.until('window.b2.writes.length === 1', 'first save written');
        c.eq(await ed.eval('JSON.stringify([window.b2.picker, window.b2.writes[0][0]])'), '[1,"erste.html"]', 'the first save of a new page asks for a place once');
        await ed.type(' zwei');
        await ed.click('bSaveAs');
        await ed.until('window.b2.writes.length === 2', 'save as written');
        c.eq(await ed.eval('JSON.stringify([window.b2.picker, window.b2.writes[1][0]])'), '[2,"zweite.html"]', '"Speichern unter …" asks again although the page has a file');
        c.ok((await ed.eval('window.b2.writes[1][1]')).includes('mein Text. eins zwei'), 'the new file holds the page as it is');
        c.eq(await ed.status(), 'Gespeichert: zweite.html', 'the message names the new file');
        c.eq(await ed.eval('document.getElementById("docName").textContent'), 'zweite.html', 'the top bar names the new file');
        await ed.type(' drei');
        await ed.key('s', ['ctrl']);
        await ed.until('window.b2.writes.length === 3', 'third save written');
        c.eq(await ed.eval('JSON.stringify([window.b2.picker, window.b2.writes[2][0]])'), '[2,"zweite.html"]', 'Speichern afterwards writes to the new file without asking');
        c.eq(await ed.eval('window.b2.writes.filter((w) => w[0] === "erste.html").length'), 1, 'the first file was written once only');
        c.note('mock', 'showSaveFilePicker hands out two labelled mock handles in turn ; writes are recorded with their target');
      });
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' x');
        const saved = await ed.download('bSaveAs');
        c.ok(saved.text.includes('mein Text. x'), 'without file access "Speichern unter …" is a download', saved.name);
      });
    },
  },
  {
    id: 'B2-03', title: 'beta.2: the file buttons and the groups of the toolbar',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        c.eq(await labels(ed, '#top > .group[aria-label="Datei"]'), JSON.stringify(['Neu|Öffnen|Speichern|Speichern unter …']), 'file buttons: no "Herunterladen" any more');
        c.eq(await ed.eval('document.getElementById("bDownload") === null'), true, 'the download button is gone');
        c.eq(await labels(ed, '#fmt > .group'), JSON.stringify(['Absatz|Ü1|Ü2|Ü3', 'F|K|U|x²|x₂', 'Marker|Farbe', '• Liste|1. Liste|Tabelle', 'Links|Mitte|Rechts|Block', 'Link|Link entfernen|Bild']), 'groups: marker and colour on their own, the table next to the lists');
        c.eq(await ed.eval('JSON.stringify(["bLink", "bImage", "bUnlink", "bBold"].map((id) => document.getElementById(id).classList.contains("insert")))'), '[true,true,false,false]', '"Link" and "Bild" are marked as insert buttons');
        c.ok(await ed.eval('(() => { const a = getComputedStyle(document.getElementById("bLink")).backgroundColor, b = getComputedStyle(document.getElementById("bUnlink")).backgroundColor; return a !== b; })()'), '"Link" has another colour than "Link entfernen"');
      });
    },
  },
  {
    id: 'B2-04', title: 'beta.2: in a browser that cannot write a file the editor says so from the start',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        c.eq(await visible(ed, 'noWrite'), true, 'without file access the note is shown');
        c.eq(await ed.eval('document.getElementById("noWrite").textContent.trim()'), 'In diesem Browser kann der Editor deine Datei nicht überschreiben. Jedes Speichern legt eine neue Kopie im Ordner „Downloads“ an. Arbeite deshalb mit Microsoft Edge.', 'the text of the note');
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' x');
        await ed.download('bSave');
        c.eq(await ed.status(), 'Eine neue Kopie „meine-seite.html“ liegt jetzt im Ordner „Downloads“.', 'the save message says that a new copy was made');
      });
      await withEditor(browser, {}, async (ed) => {
        if (await ed.eval('!!window.showSaveFilePicker')) c.eq(await visible(ed, 'noWrite'), false, 'with file access there is no note');
        else c.eq(await visible(ed, 'noWrite'), true, 'this browser has no file access API itself (Firefox): the note is shown here too');
      });
    },
  },
  {
    id: 'B2-05', title: 'beta.2: an alignment button pressed again removes the alignment it wrote',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const plain = page('<p>Text eins</p>\n<p style="color: red; text-align: right">Text zwei</p>');
        await ed.openText('b2-05.html', plain);
        await ed.caret('Text eins', 2);
        await ed.click('bAlignCenter');
        await ed.settle();
        const centred = page('<p style="text-align: center">Text eins</p>\n<p style="color: red; text-align: right">Text zwei</p>');
        c.eq(await ed.source(), centred, '"Mitte" once: the paragraph is centred');
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), plain, '"Mitte" again: the alignment is removed, the paragraph is as before');
        await ed.key('z', ['ctrl']);
        await ed.settle();
        c.eq(await ed.source(), centred, 'one undo gives the centred paragraph back');
        await ed.caret('Text zwei', 2);
        await ed.click('bAlignRight');
        await ed.settle();
        c.eq(await ed.source(), page('<p style="text-align: center">Text eins</p>\n<p style="color: red">Text zwei</p>'), '"Rechts" on a right-aligned paragraph: only the alignment goes, the colour stays');
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), page('<p style="text-align: center">Text eins</p>\n<p style="color: red; text-align: center">Text zwei</p>'), 'another button still sets its alignment');
      });
    },
  },
  {
    id: 'B2-06', title: 'beta.2: a failed write points to "Speichern unter …", not to a download button',
    async run(c, { browser }) {
      const FAIL = `Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => ({ name: 'kaputt.html', createWritable: async () => { throw new DOMException('disk', 'InvalidStateError'); } }) });`;
      await withEditor(browser, { init: FAIL }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' x');
        await ed.key('s', ['ctrl']);
        await sleep(500);
        c.eq(await ed.status(), 'Die Datei konnte nicht gespeichert werden. Deine Seite ist noch nicht gespeichert – nutze „Speichern unter …“ und wähle einen anderen Ort.', 'the message for a failed write');
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'the page stays unsaved');
        c.note('mock', 'showSaveFilePicker returns a mock handle whose createWritable fails');
      });
    },
  },
];
