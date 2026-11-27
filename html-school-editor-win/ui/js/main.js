// User interface of the HTML School Editor for Windows. It runs in WebView2 #1 and talks to the C++ core
// with web messages (see docs/ARCHITECTURE.md, "Messages"). The page view is a second WebView2 that the
// core places over #pvSlot.
import { createCodeEditor } from './editor.js';
import { createVisualEditor } from './visual.js';
import { addressProblems, PROBLEM_TEXT } from './checks.js';
import { breaksOfBytes, createBreaks } from './breaks.js';
import { decodeFileBytes, encodeFileText, escapeAttr, MAX_FILE_BYTES } from './shared/util.js';

const $ = (id) => document.getElementById(id);
const els = {};
for (const id of ['version', 'versionBottom', 'bProject', 'bProject2', 'bNew', 'bOpen', 'bSave', 'bSaveAs', 'bUndo', 'bRedo', 'bFind', 'bPicture', 'bBrowser',
  'docName', 'docState', 'bRescue', 'work', 'projectName', 'bFold', 'files', 'pos', 'findBar', 'findText', 'bFindPrev', 'bFindNext', 'findCount', 'bFindClose',
  'srcBox', 'gutterIn', 'hlIn', 'src', 'split', 'notes', 'bNotes', 'noteList', 'pvSlot', 'welcome', 'status', 'dlg', 'dlgTitle', 'dlgBody', 'dlgButtons',
  'visualFrame', 'visualHint', 'visualTools', 'visualCommands', 'pageTitle', 'visualAlign', 'visualColor']) els[id] = $(id);

const PREVIEW_DELAY = 300;
const RESCUE_AFTER = 3000;  // a save on its way this long offers a rescue copy
const NEW_EOL = '\r\n';

const host = window.chrome && window.chrome.webview;
function send(msg) { if (host) host.postMessage(msg); }

const state = {
  project: null,        // { name, files: [{ path, kind }] }
  doc: null,            // { path, name, savedRaw, bom, eol, converted, base, breaks }; savedRaw: the text as read or last
                        // saved with every line break as in the file; base: its fingerprint; breaks: breaks.js
  sending: null,        // save in progress: { id, raw, doc, long }; raw: the text as sent, with its own breaks;
                        // long: on its way for RESCUE_AFTER or more
  afterSave: null,      // { what, action } to run once the save in progress has succeeded
  saveId: 0,
  opening: 0,           // op of the open or new page on its way (0: none); only its answer is taken
  picture: null,        // { op, doc } of the picture being chosen
  opId: 0,
  picking: false,       // a system file dialog was asked for and has not closed yet (one at a time)
  rescueId: 0,
  rescuing: false,      // a rescue copy is on its way
  problems: [],
  missing: [],
  notesOpen: false,
  modal: 0,             // 1 while a question is open or waiting
  closePending: false,  // a close request came while a question was open
  seen: 0,              // highest `seq` of a page the core handed over that this interface has handled
  previewTimer: 0,
};

const editor = createCodeEditor(els, onTextChanged);
const visual = createVisualEditor(els, editor, {
  document: () => state.doc, message: setStatus, layout: () => queueMicrotask(() => scheduleLayout()),
  fields: askVisualFields, picture: askPicture, shortcut: handleShortcut,
});

// ---------------------------------------------------------------- small helpers

const segmentsOf = (path) => path.split('/');
const baseName = (path) => path.slice(path.lastIndexOf('/') + 1);
// Unsaved: the text or one of its line breaks differs from the file as read or last saved.
const dirty = () => !!state.doc && editor.raw !== state.doc.savedRaw;

function setStatus(text, warn) {
  els.status.textContent = text || '';
  els.status.classList.toggle('warn', !!warn);
}

function bytesOf(base64) {
  const bin = atob(base64), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- dialogs

// Shows a modal question. `body`: text or a node; `buttons`: [{ label, value, primary }]. The value of the
// pressed button is returned; Esc gives 'cancel'. While a dialog is open the page view is hidden, because
// the native page view would otherwise cover it. Questions take turns: one that comes while another is open
// (or has closed but not yet handed over its answer) waits in line. Each question reads its own answer when
// its dialog closes, before the next one may touch the dialog.
const questions = [];
let questionOpen = false;

function ask(title, body, buttons, onOpen) {
  return new Promise((resolve) => {
    questions.push({ title, body, buttons, onOpen, resolve });
    if (!questionOpen) showNextQuestion();
  });
}

function showNextQuestion() {
  const q = questions.shift();
  if (!q) {
    questionOpen = false;
    state.modal = 0;
    reportLayout();
    // a close request that came while a question was open is answered now
    if (state.closePending) { state.closePending = false; requestClose(); }
    return;
  }
  questionOpen = true;
  state.modal = 1;
  reportLayout();
  const d = els.dlg;
  els.dlgTitle.textContent = q.title;
  els.dlgBody.replaceChildren(...(typeof q.body === 'string' ? [paragraph(q.body)] : [].concat(q.body)));
  els.dlgButtons.replaceChildren(...q.buttons.map((b) => {
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.value = b.value;
    btn.textContent = b.label;
    if (b.primary) btn.className = 'primary';
    return btn;
  }));
  d.returnValue = 'cancel';
  d.addEventListener('close', () => {
    q.resolve(d.returnValue || 'cancel');
    // the next question after the answer's own follow-up has been queued
    setTimeout(showNextQuestion, 0);
  }, { once: true });
  d.showModal();
  if (q.onOpen) q.onOpen(d);
  else { const p = d.querySelector('button.primary') || d.querySelector('button'); if (p) p.focus(); }
}

function paragraph(text, cls) {
  const p = document.createElement('p');
  p.textContent = text;
  if (cls) p.className = cls;
  return p;
}

const tell = (title, text) => ask(title, text, [{ label: 'OK', value: 'ok', primary: true }]);

async function askVisualFields(title, fields) {
  const wrapper = document.createElement('div');
  const inputs = fields.map(({ label, value }) => {
    const field = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 2048;
    input.value = value;
    field.append(label, input);
    wrapper.append(field);
    return input;
  });
  const result = await ask(title, wrapper, [{ label: 'Einfügen', value: 'insert', primary: true }, { label: 'Abbrechen', value: 'cancel' }], () => inputs[0].select());
  return result === 'insert' ? inputs.map((input) => input.value) : null;
}

// Asks what to do with unsaved changes. Returns 'save', 'discard' or 'cancel'.
function askUnsaved(what) {
  return ask('Deine Seite ist nicht gespeichert', 'Möchtest du „' + state.doc.name + '“ speichern, bevor ' + what + '?', [
    { label: 'Speichern', value: 'save', primary: true },
    { label: 'Nicht speichern', value: 'discard' },
    { label: 'Abbrechen', value: 'cancel' },
  ]);
}

// Runs `action` once the current page is saved or its changes are given up. While a save is still on its
// way, the action waits for its answer and is then checked again: text typed during the save is not saved
// yet, so the question comes again instead of the action dropping it.
// A page-side edit still open counts before anything is decided. If it cannot be applied, nothing is decided:
// the edit stays where it is and the pupil is told what to do.
function settlePage() {
  if (visual.flush()) return true;
  tell('Der neue Titel ist noch nicht übernommen',
    'Bei dieser Seite kann der Editor den Titel aus dem Titelfeld nicht übernehmen. Ändere ihn links im HTML-Code im Tag <title>, oder drücke im Titelfeld Esc, um ihn zurückzusetzen. Versuche es dann noch einmal.');
  return false;
}

async function whenSettled(what, action) {
  if (!settlePage()) return;
  if (state.sending !== null) {
    state.afterSave = { what, action };
    setStatus('Einen Moment, die Seite wird noch gespeichert …');
    return;
  }
  if (!dirty()) { action(); return; }
  const choice = await askUnsaved(what);
  if (choice === 'save') { state.afterSave = { what, action }; save(); }
  else if (choice === 'discard') action();
}

// Asks the core to open a page (`openFile`, `openDialog`, `newPage`). Only the answer to the latest
// request is taken, and the code field is locked until it comes, so nothing typed meanwhile is replaced.
function requestOpen(msg) {
  if (msg.type === 'openDialog' && !startPicking()) return;
  const op = ++state.opId;
  state.opening = op;
  editor.setLocked(true);
  visual.refresh();
  send({ ...msg, op });
}

// Only one system file dialog at a time: while one is asked for or open, the other dialog actions are
// locked; the core's `dialogDone` (after confirming or cancelling) frees them again.
function startPicking() {
  if (state.picking) return false;
  state.picking = true;
  updateChrome();
  return true;
}

function openingDone() {
  state.opening = 0;
  editor.setLocked(!state.doc);
  visual.refresh();
}

// ---------------------------------------------------------------- chrome

// The core is told whether text could be lost (unsaved, or a save still on its way), so that logging off
// or shutting Windows down asks first instead of ending the program (WM_QUERYENDSESSION).
// `seen` tells the core up to which page it handed over this report takes everything into account. A page
// still being handled (for example while the question about its encoding is open) holds `seen` below its
// `seq`, so the core keeps counting a page as open until it has been taken or refused.
const handling = new Set();
const seenNow = () => (handling.size ? Math.min(...handling) - 1 : state.seen);
let lastUnsaved = '';
function reportUnsaved(unsaved, open) {
  const seen = seenNow();
  const key = unsaved + '/' + open + '/' + seen;
  if (key === lastUnsaved) return;
  lastUnsaved = key;
  send({ type: 'unsaved', value: unsaved, open, seen });
}

function updateChrome() {
  const doc = state.doc;
  els.docName.textContent = doc ? doc.path : '';
  const d = dirty();
  reportUnsaved(!!doc && (d || state.sending !== null), !!doc);
  els.docState.textContent = !doc ? '' : state.sending !== null ? 'wird gespeichert …' : d ? 'nicht gespeichert' : 'gespeichert';
  els.docState.classList.toggle('dirty', !!doc && (d || state.sending !== null));
  document.title = (doc ? (d ? '● ' : '') + doc.name + ' – ' : '') + 'HTML-Schuleditor';
  els.bNew.disabled = !state.project;
  els.bSave.disabled = !doc || state.sending !== null;
  els.bSaveAs.disabled = !doc || state.sending !== null || state.picking;
  els.bProject.disabled = els.bProject2.disabled = els.bOpen.disabled = state.picking;
  els.bRescue.hidden = !(doc && state.sending && state.sending.long && state.sending.doc === doc);
  els.bRescue.disabled = state.rescuing;
  els.bUndo.disabled = !doc || !editor.canUndo();
  els.bRedo.disabled = !doc || !editor.canRedo();
  els.bFind.disabled = !doc;
  els.bPicture.disabled = !doc || state.picking;
  els.bBrowser.disabled = !doc;
  els.welcome.hidden = !!doc;
  els.welcome.querySelector('strong').textContent = state.project ? 'Wähle links eine Seite oder lege eine neue an.' : 'Öffne zuerst deinen Projektordner.';
  els.welcome.querySelector('p + p').textContent = state.project ? 'Projektordner: ' + state.project.name : 'Das ist der Ordner, in dem deine Seiten und Bilder liegen.';
  els.bProject2.hidden = !!state.project;
  for (const li of els.files.querySelectorAll('li.page')) li.classList.toggle('current', !!doc && li.dataset.path === doc.path);
}

// ---------------------------------------------------------------- layout of the page view

let lastLayout = '';
function reportLayout() {
  const visible = !!state.doc && !visual.editing && state.modal === 0;
  const r = els.pvSlot.getBoundingClientRect(), k = window.devicePixelRatio || 1;
  const msg = { type: 'layout', visible, x: Math.round(r.left * k), y: Math.round(r.top * k), w: Math.max(0, Math.round(r.width * k)), h: Math.max(0, Math.round(r.height * k)) };
  const key = JSON.stringify(msg);
  if (key === lastLayout) return;
  lastLayout = key;
  send(msg);
}
let layoutFrame = 0;
const scheduleLayout = () => { if (!layoutFrame) layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; reportLayout(); }); };
new ResizeObserver(scheduleLayout).observe(els.pvSlot);
addEventListener('resize', scheduleLayout);

// divider between code and page
els.split.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  els.split.setPointerCapture(e.pointerId);
  els.work.classList.add('dragging');
  const left = els.srcBox.closest('section').getBoundingClientRect().left;
  const total = els.work.getBoundingClientRect().right - left - 8;
  const move = (ev) => {
    const pct = Math.min(85, Math.max(15, ((ev.clientX - left) / total) * 100));
    els.work.style.setProperty('--left', pct + '%');
    scheduleLayout();
  };
  const stop = () => {
    els.split.removeEventListener('pointermove', move);
    els.split.removeEventListener('pointerup', stop);
    els.split.removeEventListener('pointercancel', stop);
    els.work.classList.remove('dragging');
  };
  els.split.addEventListener('pointermove', move);
  els.split.addEventListener('pointerup', stop);
  els.split.addEventListener('pointercancel', stop);
});

els.bFold.addEventListener('click', () => {
  const folded = els.work.classList.toggle('folded');
  els.bFold.textContent = folded ? '»' : '«';
  els.bFold.title = folded ? 'Liste ausklappen' : 'Liste einklappen';
  els.bFold.setAttribute('aria-expanded', String(!folded));
  scheduleLayout();
});

// ---------------------------------------------------------------- project list

function renderFiles() {
  els.files.replaceChildren();
  const p = state.project;
  els.projectName.textContent = p ? p.name : 'Kein Projektordner';
  els.projectName.title = p ? 'Projektordner: ' + p.name : '';
  if (!p) return;
  const files = p.files.slice().sort((a, b) => {
    const sa = segmentsOf(a.path), sb = segmentsOf(b.path);
    for (let i = 0; i < Math.min(sa.length, sb.length); i++) {
      const lastA = i === sa.length - 1, lastB = i === sb.length - 1;
      if (lastA !== lastB) return lastA ? -1 : 1;          // files before subfolders
      const c = sa[i].localeCompare(sb[i], 'de', { sensitivity: 'base' });
      if (c) return c;
    }
    return sa.length - sb.length;
  });
  const shownFolders = new Set();
  const ICON = { page: '📄', style: '🎨', picture: '🖼' };
  for (const f of files) {
    const segs = segmentsOf(f.path);
    for (let i = 0; i < segs.length - 1; i++) {
      const folder = segs.slice(0, i + 1).join('/');
      if (shownFolders.has(folder)) continue;
      shownFolders.add(folder);
      const li = document.createElement('li');
      li.className = 'folder';
      li.style.setProperty('--depth', i);
      li.textContent = '📁 ' + segs[i];
      els.files.appendChild(li);
    }
    const li = document.createElement('li');
    li.className = 'file ' + f.kind;
    li.style.setProperty('--depth', segs.length - 1);
    li.dataset.path = f.path;
    li.title = f.path;
    const icon = document.createElement('span');
    icon.className = 'kind';
    icon.textContent = ICON[f.kind] || '';
    li.append(icon, segs[segs.length - 1]);
    if (f.kind === 'page') {
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      const open = () => { if (!state.doc || state.doc.path !== f.path) whenSettled('du eine andere Seite öffnest', () => requestOpen({ type: 'openFile', path: f.path })); };
      li.addEventListener('click', open);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
    els.files.appendChild(li);
  }
  if (!files.length) els.files.appendChild(Object.assign(document.createElement('li'), { className: 'folder', textContent: 'Der Ordner ist leer.' }));
  updateChrome();
}

function projectFolders() {
  const set = new Set(['']);
  if (state.project) for (const f of state.project.files) { const s = segmentsOf(f.path); for (let i = 1; i < s.length; i++) set.add(s.slice(0, i).join('/')); }
  return [...set].sort((a, b) => a.localeCompare(b, 'de'));
}

// ---------------------------------------------------------------- text, page view, notes

function onTextChanged() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(sendPreview, PREVIEW_DELAY);
  visual.schedule();
  updateChrome();
}

function sendPreview() {
  clearTimeout(state.previewTimer);
  if (!state.doc) return;
  state.problems = addressProblems(editor.text, segmentsOf(state.doc.path));
  renderNotes();
  send({ type: 'preview', path: state.doc.path, text: editor.text });
}

function renderNotes() {
  const items = [];
  for (const p of state.problems) items.push({ address: p.address, text: PROBLEM_TEXT[p.kind], line: p.line });
  for (const m of state.missing) {
    if (state.problems.some((p) => p.address === m.address)) continue;
    const text = m.reason === 'case' ? PROBLEM_TEXT.case + '„' + m.actual + '“. Schreibe es genauso – im Internet zählt Groß- und Kleinschreibung.'
      : m.reason === 'error' ? 'konnte nicht gelesen werden: ' + (m.message || '')
      : PROBLEM_TEXT.notFound;
    items.push({ address: m.address, text });
  }
  els.notes.hidden = !items.length;
  if (!items.length) { els.noteList.replaceChildren(); return; }
  els.bNotes.textContent = (state.notesOpen ? '▾ ' : '▸ ') + (items.length === 1 ? '1 Hinweis zu einer Adresse' : items.length + ' Hinweise zu Adressen');
  els.bNotes.setAttribute('aria-expanded', String(state.notesOpen));
  els.noteList.hidden = !state.notesOpen;
  els.noteList.replaceChildren(...items.map((it) => {
    const li = document.createElement('li');
    const code = document.createElement('code');
    code.textContent = it.address;
    li.append(code, ' ' + it.text);
    if (it.line) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'line';
      b.textContent = 'Zeile ' + it.line;
      b.addEventListener('click', () => editor.gotoLine(it.line));
      li.append(' (', b, ')');
    }
    return li;
  }));
}
els.bNotes.addEventListener('click', () => { state.notesOpen = !state.notesOpen; renderNotes(); });

// ---------------------------------------------------------------- opening

async function openedFile(msg) {
  // op 0: the page given when the program was started, before anything else is open
  if (msg.op ? msg.op !== state.opening : state.opening !== 0 || state.doc) return;
  openingDone();
  const bytes = bytesOf(msg.data);
  if (bytes.length > MAX_FILE_BYTES) { tell('Datei zu groß', '„' + msg.name + '“ ist größer als 5 MB. So große Seiten kann der Editor nicht öffnen.'); return; }
  let decoded = decodeFileBytes(bytes, false);
  let converted = false;
  if (decoded.error === 'encoding') {
    const choice = await ask('Andere Zeichenkodierung', [
      paragraph('„' + msg.name + '“ ist nicht in UTF-8 gespeichert. Umlaute könnten falsch angezeigt werden.'),
      paragraph('Der Editor kann die Seite in UTF-8 umwandeln. Gespeichert wird sie dann in UTF-8.'),
    ], [{ label: 'Umwandeln', value: 'convert', primary: true }, { label: 'Abbrechen', value: 'cancel' }]);
    if (choice !== 'convert') return;
    decoded = decodeFileBytes(bytes, true);
    converted = true;
  }
  if (decoded.error) {
    tell('Datei kann nicht geöffnet werden', decoded.error === 'utf16' ? '„' + msg.name + '“ ist in UTF-16 gespeichert. Speichere sie in einem anderen Programm als UTF-8.' : '„' + msg.name + '“ ist keine Textdatei.');
    return;
  }
  // a converted page counts as unsaved until it is written in UTF-8
  // every line break is written back as it was read (LF, CRLF or CR), also in files that mix them
  let breaks;
  try { breaks = createBreaks(decoded.text, breaksOfBytes(bytes), decoded.eol); }
  catch { breaks = createBreaks(decoded.text, decoded.text.split('\n').slice(1).map(() => decoded.eol), decoded.eol); }
  state.doc = { path: msg.path, name: msg.name, savedRaw: converted ? '\u0000' : breaks.raw, bom: decoded.bom, eol: decoded.eol, converted, base: msg.base || '', breaks };
  state.picture = null;
  state.missing = [];
  state.problems = [];
  editor.load(decoded.text, breaks);
  setStatus(converted ? 'Geöffnet und in UTF-8 umgewandelt: ' + msg.path + '. Speichere die Seite, damit sie in UTF-8 bleibt.' : 'Geöffnet: ' + msg.path, converted);
  sendPreview();
  visual.refresh();
  updateChrome();
  reportLayout();
  editor.focus();
}

// ---------------------------------------------------------------- saving

// `base` lets the core write only over the file this page was read from; `createOnly` (Save As out of a
// conflict) writes a new file and never replaces one.
function startSave(type, createOnly) {
  if (!state.doc || state.sending !== null || (type === 'saveAs' && state.picking)) return;
  if (!settlePage()) return;
  const raw = editor.raw, bytes = (state.doc.bom ? '\ufeff' : '') + raw;
  if (new TextEncoder().encode(bytes).length > MAX_FILE_BYTES) {
    tell('Seite zu groß', 'Die Seite ist größer als 5 MB. So große Seiten kann der Editor nicht wieder öffnen. Nimm etwas heraus und speichere dann.');
    return;
  }
  if (type === 'saveAs') startPicking();
  const id = ++state.saveId;
  state.sending = { id, raw, doc: state.doc, long: false };
  // A save that takes long (a network drive that does not answer) offers a rescue copy on this computer.
  setTimeout(() => { if (state.sending && state.sending.id === id) { state.sending.long = true; updateChrome(); } }, RESCUE_AFTER);
  send({ type, id, path: state.doc.path, text: bytes, base: state.doc.base, ...(createOnly ? { createOnly: true } : {}) });
  updateChrome();
}
const save = () => startSave('save');
const saveAs = (createOnly) => startSave('saveAs', createOnly === true);

// The save in progress that `msg` answers, or null for an answer to an older save (for example of the page
// of a project folder that was closed meanwhile). Such an answer must not touch the page open now.
function answeredSave(msg) {
  const s = state.sending;
  if (!s || msg.id !== s.id) return null;
  state.sending = null;
  return s;
}

function saved(msg) {
  const s = answeredSave(msg);
  if (!s) return;
  if (s.doc !== state.doc) { state.afterSave = null; updateChrome(); return; }
  if (msg.path && msg.path !== state.doc.path) {
    state.doc.path = msg.path;
    state.doc.name = msg.name || baseName(msg.path);
    sendPreview();
    visual.refresh();
  }
  state.doc.savedRaw = s.raw;
  state.doc.breaks.remember(s.raw);
  state.doc.converted = false;
  if (msg.base) state.doc.base = msg.base;
  setStatus(dirty() ? 'Gespeichert: ' + state.doc.path + '. Was du danach geschrieben hast, ist noch nicht gespeichert.' : 'Gespeichert: ' + state.doc.path);
  updateChrome();
  const after = state.afterSave;
  state.afterSave = null;
  if (!after) return;
  if (after.what) whenSettled(after.what, after.action);
  else after.action();
}

async function saveProblem(msg) {
  const s = answeredSave(msg);
  if (!s) return;
  state.afterSave = null;
  updateChrome();
  if (s.doc !== state.doc) return;
  if (msg.type === 'saveCancelled') { setStatus('Nicht gespeichert.'); return; }
  if (msg.type === 'conflict') {
    const choice = await ask('Die Datei wurde woanders geändert', [
      paragraph(msg.kind === 'deleted'
        ? '„' + state.doc.path + '“ gibt es im Projektordner nicht mehr. Vielleicht wurde sie gelöscht oder umbenannt.'
        : '„' + state.doc.path + '“ wurde inzwischen von einem anderen Programm oder Fenster geändert.'),
      paragraph('Damit nichts verloren geht, hat der Editor nichts überschrieben. Du kannst deine Seite als neue Datei speichern.'),
    ], [{ label: 'Als neue Datei speichern …', value: 'saveAs', primary: true }, { label: 'Abbrechen', value: 'cancel' }]);
    if (choice === 'saveAs') saveAs(true);
    return;
  }
  setStatus('Nicht gespeichert: ' + (msg.message || 'unbekannter Fehler'), true);
  tell('Speichern hat nicht geklappt', (msg.message || 'Die Datei konnte nicht geschrieben werden.') + ' Deine Seite ist noch hier im Editor. Versuche es noch einmal oder speichere unter einem neuen Namen.');
}

// A rescue copy while a save hangs: the text in the editor now, with its BOM and every line break, goes to a
// new file on this computer. The save on its way and the saved state of the page stay as they are.
function rescue() {
  if (!state.doc || state.rescuing) return;
  visual.flush();  // a title that cannot be applied stays in its field; the copy holds the code
  const bytes = (state.doc.bom ? '\ufeff' : '') + editor.raw;
  state.rescuing = true;
  send({ type: 'rescue', id: ++state.rescueId, path: state.doc.path, text: bytes });
  setStatus('Rettungskopie wird gespeichert …');
  updateChrome();
}

function rescued(msg) {
  if (msg.id !== state.rescueId) return;
  state.rescuing = false;
  updateChrome();
  if (msg.type === 'rescued') {
    setStatus('Rettungskopie: ' + msg.path);
    const where = paragraph(msg.path, 'path');
    tell('Rettungskopie gespeichert', [
      paragraph('Dein Text' + (msg.page ? ' von „' + msg.page + '“' : '') + ' liegt jetzt zusätzlich auf diesem Computer:'), where,
      paragraph(state.sending ? 'Die Seite selbst ist noch nicht gespeichert. Der Editor versucht es weiter.' : 'Die Seite selbst ist davon nicht betroffen.'),
    ]);
  } else {
    setStatus('Rettungskopie nicht gespeichert: ' + (msg.message || ''), true);
    tell('Rettungskopie hat nicht geklappt', (msg.message || 'Die Datei konnte nicht geschrieben werden.') + ' Deine Seite ist noch hier im Editor.');
  }
}

// ---------------------------------------------------------------- new page, pictures, browser

const NAME_RE = /^[A-Za-z0-9äöüÄÖÜß_-][A-Za-z0-9äöüÄÖÜß_.-]*$/;

async function newPage() {
  if (!state.project) return;
  const nameIn = Object.assign(document.createElement('input'), { type: 'text', id: 'npName', value: 'neue-seite', autocomplete: 'off', spellcheck: false });
  const folderIn = Object.assign(document.createElement('select'), { id: 'npFolder' });
  for (const f of projectFolders()) folderIn.append(new Option(f ? f + '/' : '(Projektordner selbst)', f));
  const err = paragraph('', 'err');
  const labelName = Object.assign(document.createElement('label'), { htmlFor: 'npName', textContent: 'Name der Datei' });
  const labelFolder = Object.assign(document.createElement('label'), { htmlFor: 'npFolder', textContent: 'Ordner' });
  for (;;) {
    const choice = await ask('Neue Seite', [labelName, nameIn, labelFolder, folderIn, paragraph('Ohne Leerzeichen, zum Beispiel tiere.html oder meine-katze.html.', 'hint'), err],
      [{ label: 'Anlegen', value: 'ok', primary: true }, { label: 'Abbrechen', value: 'cancel' }], () => { nameIn.focus(); nameIn.select(); });
    if (choice !== 'ok') return;
    let name = nameIn.value.trim();
    if (!/\.html?$/i.test(name)) name += '.html';
    if (!NAME_RE.test(name) || name.length > 80) { err.textContent = /\s/.test(name) ? 'Bitte keine Leerzeichen. Nimm „-“ oder „_“.' : 'Erlaubt sind Buchstaben, Ziffern, „-“, „_“ und „.“.'; continue; }
    const path = (folderIn.value ? folderIn.value + '/' : '') + name;
    if (state.project.files.some((f) => f.path.toLowerCase() === path.toLowerCase())) { err.textContent = 'Diese Datei gibt es schon.'; continue; }
    const title = name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');
    const skeleton = '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="utf-8">\n  <title>' + title + '</title>\n</head>\n<body>\n  <h1>' + title + '</h1>\n  <p>Hier steht dein Text.</p>\n</body>\n</html>\n';
    whenSettled('du eine neue Seite anlegst', () => requestOpen({ type: 'newPage', path, text: encodeFileText(skeleton, false, NEW_EOL) }));
    return;
  }
}

function insertPicture(src) {
  const tag = '<img src="' + escapeAttr(src) + '" alt="">';
  editor.insert(tag, [tag.length - 2, tag.length - 2]);
  setStatus('Bild eingefügt. Schreibe bei alt="" in ein paar Wörtern, was auf dem Bild zu sehen ist.');
}

// The answer to the picture dialog belongs to the page it was opened for.
const pictureFor = (msg) => !!state.picture && msg.op === state.picture.op && state.picture.doc === state.doc;

async function pictureOutside(msg) {
  if (!pictureFor(msg)) return;
  const choice = await ask('Bild außerhalb des Projektordners', [
    paragraph('„' + msg.name + '“ liegt nicht in deinem Projektordner. Dann fehlt es später, wenn du die Seite weitergibst oder hochlädst.'),
    paragraph('Der Editor kann das Bild in den Ordner „bilder“ deines Projekts kopieren.'),
  ], [{ label: 'In „bilder“ kopieren', value: 'copy', primary: true }, { label: 'Abbrechen', value: 'cancel' }]);
  if (choice === 'copy' && pictureFor(msg)) send({ type: 'copyPicture', op: msg.op, token: msg.token, page: state.doc.path });
}

function viewInBrowser() {
  if (!state.doc) return;
  if (!settlePage()) return;
  const go = () => send({ type: 'viewInBrowser', path: state.doc.path });
  if (!dirty()) { go(); return; }
  ask('Erst speichern?', 'Der Browser zeigt die gespeicherte Datei. Deine letzten Änderungen sind noch nicht gespeichert.', [
    { label: 'Speichern und ansehen', value: 'save', primary: true }, { label: 'Abbrechen', value: 'cancel' },
  ]).then((c) => { if (c === 'save') { state.afterSave = { action: go }; save(); } });
}

// ---------------------------------------------------------------- find

function openFind() {
  if (!state.doc) return;
  els.findBar.hidden = false;
  els.findText.focus();
  els.findText.select();
  scheduleLayout();
}
function closeFind() { els.findBar.hidden = true; editor.focus(); scheduleLayout(); }
function findStep(dir) {
  const r = editor.find(els.findText.value, dir);
  els.findCount.textContent = !els.findText.value ? '' : r.count ? r.index + ' von ' + r.count : 'nicht gefunden';
}
els.findText.addEventListener('input', () => findStep(1));
els.findText.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
  else if (e.key === 'Escape') { e.preventDefault(); closeFind(); }
});
els.bFindNext.addEventListener('click', () => findStep(1));
els.bFindPrev.addEventListener('click', () => findStep(-1));
els.bFindClose.addEventListener('click', closeFind);

// ---------------------------------------------------------------- buttons and keys

const openProject = () => whenSettled('du einen anderen Projektordner öffnest', () => { if (startPicking()) send({ type: 'openProject' }); });
els.bProject.addEventListener('click', openProject);
els.bProject2.addEventListener('click', openProject);
els.bOpen.addEventListener('click', () => whenSettled('du eine andere Seite öffnest', () => requestOpen({ type: 'openDialog' })));
els.bNew.addEventListener('click', newPage);
els.bSave.addEventListener('click', save);
els.bSaveAs.addEventListener('click', saveAs);
els.bUndo.addEventListener('click', () => { editor.undo(); editor.focus(); });
els.bRedo.addEventListener('click', () => { editor.redo(); editor.focus(); });
els.bFind.addEventListener('click', openFind);
function askPicture(insert = insertPicture) {
  if (!state.doc || editor.locked || !startPicking()) return;
  const op = ++state.opId;
  state.picture = { op, doc: state.doc, insert };
  send({ type: 'pickPicture', op, page: state.doc.path });
}
els.bPicture.addEventListener('click', () => askPicture());
els.bBrowser.addEventListener('click', viewInBrowser);
els.bRescue.addEventListener('click', rescue);

function handleShortcut(e) {
  if (state.modal || e.isComposing) return false;
  const ctrl = e.ctrlKey || e.metaKey, key = e.key.toLowerCase();
  if (ctrl && !e.altKey && key === 's') { e.preventDefault(); if (e.shiftKey) saveAs(); else save(); }
  else if (ctrl && !e.altKey && key === 'f') { e.preventDefault(); openFind(); }
  else if (e.key === 'F3') { e.preventDefault(); if (els.findBar.hidden) openFind(); else findStep(e.shiftKey ? -1 : 1); }
  return e.defaultPrevented;
}
addEventListener('keydown', handleShortcut);

// The window is to close (close button, logoff, shutdown). While a question is open the request is kept and
// answered once the question is done, so the question about unsaved text is never skipped.
function requestClose() {
  if (questionOpen) { state.closePending = true; return; }
  whenSettled('du den Editor schließt', () => send({ type: 'closeOk' }));
}

// ---------------------------------------------------------------- messages from the core

const handlers = {
  init(m) {
    els.version.textContent = m.version || '';
    els.versionBottom.textContent = m.version ? 'html-school-editor-win ' + m.version : '';
    updateChrome();
  },
  project(m) {
    state.project = { name: m.name, files: m.files || [] };
    renderFiles();
    if (m.message) setStatus(m.message);
  },
  // A new project folder: the page of the previous one is closed before anything of the new one arrives.
  projectChanged(m) {
    state.project = { name: m.name, files: [] };
    state.doc = null;
    state.missing = [];
    state.problems = [];
    state.sending = null;
    state.afterSave = null;
    state.picture = null;
    editor.clear();
    visual.refresh();
    renderFiles();
    renderNotes();
    reportLayout();
  },
  shortcut(m) {
    if (state.modal) return;
    editor.focus();
    if (m.key === 'save') save();
    else if (m.key === 'find') openFind();
    else if (m.key === 'findNext') { if (els.findBar.hidden) openFind(); else findStep(1); }
  },
  projectClosed(m) {
    state.project = null;
    state.doc = null;
    editor.clear();
    visual.refresh();
    renderFiles();
    renderNotes();
    reportLayout();
    if (m.message) setStatus(m.message, true);
  },
  // Every page handed over is acknowledged once it is handled, also if it is not taken (an older request,
  // a refused file), so the core knows whether a page is open.
  async opened(m) {
    const seq = m.seq || 0;
    handling.add(seq);
    try { await openedFile(m); } finally {
      handling.delete(seq);
      state.seen = Math.max(state.seen, seq);
      updateChrome();
    }
  },
  openFailed(m) {
    if (!m.op || m.op !== state.opening) return;
    openingDone();
    updateChrome();
    if (m.title) { setStatus(''); tell(m.title, m.message || ''); }
  },
  missing(m) {
    if (!state.doc || m.path !== state.doc.path) return;
    state.missing = m.items || [];
    renderNotes();
  },
  dialogDone() { state.picking = false; updateChrome(); },
  editViewFailed() {
    visual.disable();
    setStatus('Die Bearbeitungsansicht ist ausgefallen. Dein Text bleibt im HTML-Code erhalten.', true);
  },
  rescued,
  rescueFailed: rescued,
  saved,
  conflict: saveProblem,
  saveFailed: saveProblem,
  saveCancelled: saveProblem,
  picture(m) { if (pictureFor(m)) state.picture.insert(m.src); },
  pictureOutside,
  link(m) {
    if (!state.doc) return;
    if (m.path === state.doc.path) return;
    if (!m.isPage) { setStatus('Der Link zeigt auf „' + m.path + '“. Im Editor öffnen sich nur Seiten.'); return; }
    ask('Andere Seite öffnen?', 'Der Link zeigt auf die Seite „' + m.path + '“. Möchtest du sie im Editor öffnen?', [
      { label: 'Öffnen', value: 'open', primary: true }, { label: 'Abbrechen', value: 'cancel' },
    ]).then((c) => { if (c === 'open') whenSettled('du eine andere Seite öffnest', () => requestOpen({ type: 'openFile', path: m.path })); });
  },
  closeRequest: requestClose,
  status(m) { setStatus(m.text, m.warn); },
  error(m) { tell(m.title || 'Das hat nicht geklappt', m.message || ''); },
};

if (host) host.addEventListener('message', (e) => {
  const m = e.data;
  if (!m || typeof m !== 'object' || !handlers[m.type]) return;
  handlers[m.type](m);
});

editor.clear();
updateChrome();
renderFiles();
send({ type: 'ready' });
reportLayout();
