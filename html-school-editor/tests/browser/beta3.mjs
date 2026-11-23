// Cases B3-01 … B3-07 for 1.0.0-beta.3, from the complete review of 1.0.0-beta.2 (2026-11-23) and the owner's
// decisions on it: a file changed elsewhere is never overwritten, a copy can be rescued while a write hangs, a page
// without a file handle is never taken as saved by a write to another file, the editor refuses itself, the top bar
// tells a real file from a copy, and "Gespeicherte Seite ansehen" says which file it opens. Expected texts are
// written by hand.
import fs from 'node:fs';
import { sleep, ARTEFACT, tmpFile } from '../lib/harness.mjs';
import { FILES, withEditor, page, openMock, typeAt } from './review9.mjs';

const OPEN_MOCK = 'window.b3o = []; window.open = function (...args) { window.b3o.push(args); return null; };';
const disk = (ed) => ed.eval('JSON.stringify(a9.disk)').then(JSON.parse);
const confirmText = (ed) => ed.eval('document.getElementById("confirmText").textContent');
// a file without a handle, dropped on the window (labelled stand-in for the drag of the operating system)
const drop = async (ed, name, text) => {
  await ed.eval('document.getElementById("msg").textContent = ""');
  await ed.eval(`(() => { const dt = new DataTransfer(); dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, { type: 'text/html' }));
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); })()`);
  await ed.until('document.getElementById("dlgConfirm").open', 'the drop asks first');
  await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
  await ed.until('document.getElementById("msg").textContent.startsWith("Geöffnet")', 'dropped file opened');
  await ed.synced();
};

export const beta3 = [
  {
    id: 'B3-01', title: 'beta.3, review E5a: a file that was changed elsewhere since it was opened is not overwritten; the pupil can save a new file',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        await ed.eval('a9.hold = false');
        await openMock(ed, 'konflikt.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', ' eins');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.writes.length === 1', 'first save written');
        c.eq((await disk(ed))['konflikt.html'], '<p>alt eins</p>', 'guard: an ordinary save writes the file');
        await typeAt(ed, 'p', ' zwei');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.writes.length === 2', 'second save written');
        c.eq(await ed.dialogOpen('dlgConfirm'), false, 'guard: saving again without a change elsewhere asks nothing');
        await ed.eval('a9.disk["konflikt.html"] = "<p>vom anderen Tab</p>"');
        await typeAt(ed, 'p', ' drei');
        await ed.key('s', ['ctrl']);
        await ed.until('document.getElementById("dlgConfirm").open', 'the conflict is reported');
        c.eq(await confirmText(ed), 'Die Datei „konflikt.html“ wurde inzwischen woanders geändert, zum Beispiel in einem zweiten Tab oder in einem anderen Programm. Wenn der Editor jetzt speichert, geht diese andere Fassung verloren. Speichere deine Seite deshalb als neue Datei.', 'the question before anything is written');
        await ed.dialogButton('dlgConfirm', 'Abbrechen');
        await sleep(300);
        c.eq((await disk(ed))['konflikt.html'], '<p>vom anderen Tab</p>', 'cancelled: the other version stays on disk');
        c.eq(await ed.source(), '<p>alt eins zwei drei</p>', 'and the pupil keeps the text in the editor');
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'and the page counts as not saved');
        c.eq(await ed.status(), 'Nicht gespeichert. Die Datei „konflikt.html“ bleibt, wie sie ist. Deine Seite bleibt im Editor.', 'with a message');
        await ed.eval(`Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => { a9.saved++; return a9.file('konflikt-neu.html', ''); } }); void 0`);
        await ed.key('s', ['ctrl']);
        await ed.until('document.getElementById("dlgConfirm").open', 'asked again');
        await ed.dialogButton('dlgConfirm', 'Als neue Datei speichern …');
        await ed.until('a9.writes.length === 3', 'new file written');
        const after = await disk(ed);
        c.eq(JSON.stringify([after['konflikt.html'], after['konflikt-neu.html']]), JSON.stringify(['<p>vom anderen Tab</p>', '<p>alt eins zwei drei</p>']), 'the new file holds the page, the changed file is untouched');
        c.eq(JSON.stringify([await ed.eval('document.getElementById("docName").textContent'), await ed.dirtyText()]), JSON.stringify(['konflikt-neu.html', 'gespeichert']), 'the page now belongs to the new file');
        await typeAt(ed, 'p', ' vier');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.writes.length === 4', 'saved to the new file');
        c.eq(await ed.dialogOpen('dlgConfirm'), false, 'later saves to the new file ask nothing');
        c.note('mock', 'labelled mock handles whose content "on disk" the test changes, as a second tab or another program would; two real tabs are measured by hand only');
      });
    },
  },
  {
    id: 'B3-02', title: 'beta.3, review B2-Hang: while a write hangs, "Speichern unter …" saves an independent copy of the newest text',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'haengt.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', ' eins');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.gates.length === 1', 'write held');
        await typeAt(ed, 'p', ' zwei');
        await ed.eval('a9.hold = false');
        await ed.eval(`Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async (o) => { a9.saved++; a9.suggested = o && o.suggestedName; return a9.file('rettung.html', ''); } }); void 0`);
        await ed.click('bSaveAs');
        await ed.until('a9.writes.length === 1', 'copy written');
        c.eq(await ed.eval('a9.suggested'), 'haengt-kopie.html', 'the picker suggests a name for the copy');
        c.eq((await disk(ed))['rettung.html'], '<p>alt eins zwei</p>', 'the copy holds the newest text');
        c.eq(await ed.status(), 'Kopie gespeichert: rettung.html. Die Datei „haengt.html“ wird noch gespeichert.', 'the message names the copy and the file that is still being written');
        c.eq(JSON.stringify([await ed.eval('document.getElementById("docName").textContent'), await ed.dirtyText()]), JSON.stringify(['haengt.html', 'Speichert …']), 'the page still belongs to its file, whose write still runs');
        await ed.eval('a9.release(0)');
        await sleep(400);
        c.eq((await disk(ed))['haengt.html'], '<p>alt eins</p>', 'the held write ends with the text it took');
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'the newer text is not in that file: not saved');
        c.note('mock', 'labelled mock handles; the first close is held by the test');
      });
    },
  },
  {
    id: 'B3-03', title: 'beta.3, review T1-copy: a page opened without a handle is never counted as saved by the write of another page',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'seite-a.html', '<p>alt</p>');
        await ed.synced();
        await typeAt(ed, 'p', '1');
        await ed.key('s', ['ctrl']);
        await ed.until('a9.gates.length === 1', 'write of A held');
        await drop(ed, 'seite-a.html', '<p>alt</p>');
        await typeAt(ed, 'p', '1');
        c.eq(await ed.source(), '<p>alt1</p>', 'B, a copy of A with the same name and text, now reads like the text being written to A');
        await ed.eval('a9.release(0)');
        await sleep(400);
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'B was changed and its own file was not written: not saved');
        c.eq(await ed.status(), 'Die Seite „seite-a.html“ wurde eben gespeichert. Ob es dieselbe Datei ist wie diese Seite, kann der Editor nicht erkennen. Diese Seite gilt deshalb als nicht gespeichert. Speichere sie, wenn du sicher sein willst.', 'with a message');
        c.note('mock', 'A: labelled mock handle with a held close; B: a File object in a drop event made by the test');
      });
    },
  },
  {
    id: 'B3-04', title: 'beta.3, review E6: the editor does not open itself and does not save over itself',
    async run(c, { browser }) {
      await withEditor(browser, { init: FILES }, async (ed) => {
        const before = await ed.source();
        const file = tmpFile('umbenannt.html', fs.readFileSync(ARTEFACT, 'utf8'));
        await ed.openFile(file, { wait: false });
        await ed.until('document.getElementById("dlgInfo").open', 'the editor file is refused');
        c.eq(await ed.eval('document.getElementById("infoText").textContent'), 'Die Datei „umbenannt.html“ ist der Editor selbst, nicht deine Seite. Öffne deine eigene HTML-Datei.', 'a renamed copy of the editor is recognised by its content');
        await ed.dialogButton('dlgInfo', 'OK');
        c.eq(await ed.source(), before, 'the page stays as it was');
        await ed.eval(`Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => { a9.saved++; return a9.file('school-editor.html', '<!DOCTYPE html>\\n<html lang="de">\\n<head>\\n<meta charset="utf-8">\\n<meta name="html-school-editor" content="1.0.0">\\n'); } }); void 0`);
        await ed.eval('a9.hold = false');
        await ed.caret('mein Text.', 3);
        await ed.type('x');
        await ed.key('s', ['ctrl']);
        await sleep(500);
        c.eq(await ed.eval('a9.writes.length'), 0, 'chosen as the target of a save: nothing is written');
        c.eq(await ed.status(), 'Die Datei „school-editor.html“ ist der Editor selbst. Wähle für deine Seite einen anderen Namen. Deine Seite ist noch nicht gespeichert.', 'with a message');
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'and the page stays not saved');
        c.note('mock', 'the save target is a labelled mock handle whose content starts like the editor');
      });
    },
  },
  {
    id: 'B3-05', title: 'beta.3, review E1c/E8: the top bar tells a new page, a real file and a copy in "Downloads" apart; the tab title names the file',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        c.eq(await ed.dirtyText(), 'noch keine Datei', 'a new page has no file yet');
        c.eq(await ed.eval('document.title'), 'meine-seite.html – HTML-Schuleditor', 'the tab title names the page');
        await ed.caret('mein Text.', 3);
        await ed.type('x');
        await ed.settle();
        c.eq(await ed.dirtyText(), '● nicht gespeichert', 'changed: not saved');
        await ed.download('bSave');
        c.eq(await ed.dirtyText(), 'Kopie in Downloads', 'after a download: a copy, not the file');
        await ed.openText('b3-05.html', page('<p>Text</p>'));
        c.eq(await ed.dirtyText(), 'gespeichert', 'an opened file as it is on disk');
        c.eq(await ed.eval('document.title'), 'b3-05.html – HTML-Schuleditor', 'the tab title follows the page');
      });
      await withEditor(browser, { init: FILES }, async (ed) => {
        await openMock(ed, 'b3-05b.html', '<p>Text</p>');
        await ed.synced();
        await ed.eval(`Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: async () => { throw new DOMException('cancel', 'AbortError'); } }); void 0`);
        await ed.click('bSaveAs');
        await sleep(300);
        c.eq(JSON.stringify([await ed.dirtyText(), await ed.status()]), JSON.stringify(['gespeichert', 'Speichern unter … abgebrochen. Deine Datei „b3-05b.html“ bleibt, wie sie ist.']), 'review E1d: "Speichern unter …" cancelled on an unchanged page: no contradicting message');
        c.note('mock', 'labelled mock handle; the save picker of the second part is cancelled by the test');
      });
    },
  },
  {
    id: 'B3-06', title: 'beta.3, review E2/E4: "Gespeicherte Seite ansehen" says first which file it opens',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true, init: OPEN_MOCK }, async (ed) => {
        c.eq(await ed.eval('document.getElementById("bBrowse").textContent'), 'Gespeicherte Seite ansehen', 'the button says what it shows');
        await ed.openText('b3-06.html', page('<p>Text</p>'));
        await ed.click('bBrowse');
        await ed.until('document.getElementById("dlgConfirm").open', 'the note comes first');
        c.eq(await confirmText(ed), 'Der Browser öffnet die Datei „b3-06.html“ aus dem Ordner des Editors. Liegt deine Seite in einem anderen Ordner, siehst du dort eine andere oder gar keine Seite. Öffne deine Seite dann in ihrem Ordner mit einem Doppelklick.', 'the note');
        await ed.dialogButton('dlgConfirm', 'Abbrechen');
        await sleep(200);
        c.eq(await ed.eval('window.b3o.length'), 0, 'cancelled: nothing opens');
        await ed.click('bBrowse');
        await ed.until('document.getElementById("dlgConfirm").open', 'the note again');
        await ed.dialogButton('dlgConfirm', 'Ansehen');
        await sleep(200);
        c.ok(await ed.eval('window.b3o.length === 1 && window.b3o[0][0].endsWith("/b3-06.html")'), 'confirmed: the file of that name next to the editor opens', await ed.eval('JSON.stringify(window.b3o)'));
      });
    },
  },
  {
    id: 'B3-07', title: 'beta.3: the alignment, link and picture buttons have names that say what they do',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const names = await ed.eval('JSON.stringify(["bAlignLeft", "bAlignCenter", "bAlignRight", "bAlignJustify", "bLink", "bUnlink", "bImage"].map((id) => document.getElementById(id).textContent))');
        c.eq(names, JSON.stringify(['Linksbündig', 'Zentriert', 'Rechtsbündig', 'Blocksatz', 'Link einfügen', 'Link entfernen', 'Bild einfügen']), 'the names of the buttons');
      });
    },
  },
];
