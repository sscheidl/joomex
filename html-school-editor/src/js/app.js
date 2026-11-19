// Application shell: document state, synchronisation between the two panes, files, dialogs.
//
// Data model. `state.text` is the one authoritative document (always complete HTML source, LF line ends) and
// `state.rev` counts its changes. The source pane shows exactly that text. The preview is a projection of
// revision `state.pvRev`. Edits flow in one of two directions:
//   source -> preview: the text changes first; the preview is brought up to date later (render), at the
//                      latest before anything in the preview can be edited;
//   preview -> source: the preview DOM changes first (`state.visualDirty`); commitVisual() turns it into a
//                      new text revision, at the latest before the text is used for anything else.
// Timers only decide how early these steps happen while the user pauses, never what is kept.
import { mapOffset, changeEnd, checkLinkUrl, decodeFileBytes, encodeFileText, MAX_FILE_BYTES, fileOfSrc, folderOfSrc, imagePath } from './util.js';
import { tokenize } from './tokenizer.js';
import { parseHtml } from './tree.js';
import { analyze, renderView, reportText, srcOffsetOf, srcElementRange, previewPosOf, srcElementAt, canonDom, cssFacts, layoutPrint, HREF_HOLDER, FILE_HOLDER } from './project.js';
import { serializeBody, rescueHidden } from './serialize.js';
import { formatSource, FMT_BLOCK, FMT_KEEP } from './format.js';
import { highlightLines, patchLines, linePoint } from './highlight.js';
import { createHistory } from './history.js';
import { readImage } from './images.js';
import { getRange, isEditableAt, setBlock, toggleList, toggleInline, linkProblem, insertLink, removeLinks, insertImage, insertPlainText, caretState, setAlign, selectedImage, changeImage, linkAround, changeLink } from './commands.js';

const PREVIEW_CSS = 'html{background:#fff}' +
  ':where(body){min-height:85vh}body{outline:none}' +
  ':where(a[data-se-href]){color:#0000ee;text-decoration:underline}' +
  ':where(img[data-se-src]){display:inline-block;min-width:96px;min-height:64px;box-sizing:border-box;padding:6px;border:2px dashed #adb5bd;border-radius:6px;background:#f1f3f5;color:#495057;font:13px sans-serif}' +
  '[data-se-box]{display:inline-block;padding:8px 12px;border:2px dashed #adb5bd;border-radius:6px;background:#f1f3f5;color:#495057;font:13px sans-serif;user-select:none}' +
  '[data-se-opaque]{outline:2px dashed #f59f00;outline-offset:2px}' +
  ':where(input,select,textarea,button){pointer-events:none}' +
  '::highlight(se-src){background-color:rgba(255,224,102,.6)}';
const PREVIEW_SHELL = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; img-src data: blob:">' +
  '<style id="se-base">' + PREVIEW_CSS + '</style></head><body></body></html>';

const TEMPLATE = '<!DOCTYPE html>\n<html lang="de">\n<head>\n  <meta charset="UTF-8">\n  <title>Meine Seite</title>\n</head>\n<body>\n  <h1>Meine erste Webseite</h1>\n  <p>Hier steht mein Text.</p>\n</body>\n</html>\n';
const DEFAULT_NAME = 'meine-seite.html';
const LOCK_NORMAL = 'Die Seite wird rechts nur angezeigt: Im HTML-Code ist etwas nicht richtig geschlossen oder verschachtelt. Korrigiere es links – danach kannst du hier wieder schreiben.';
const LOCK_FAILED = 'Diese Seite kann rechts nicht angezeigt werden. Im HTML-Code links kannst du weiterarbeiten.';
const HIGHLIGHT_LIMIT = 1500000;
const LINE_HEIGHT = 20;
const FILE_TYPES = [{ description: 'HTML-Datei', accept: { 'text/html': ['.html', '.htm'] } }];

const $ = (id) => document.getElementById(id);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const now = () => performance.now();

const state = {
  text: '', rev: 0, pvRev: -1, view: null, visualDirty: false, composing: false, inCommand: false,
  name: DEFAULT_NAME, handle: null, bom: false, eol: '\n', savedText: '', docId: 0, opSeq: 0, report: '',
  srcMark: null, lineStarts: [0], lineCount: 0, plain: false,
};
const history = createHistory(40000000);
const info = new WeakMap();
const hlState = {};
const files = new Map();          // images chosen in this session, by file name: { name, url, width, height }
const blocked = new Set();        // file names of addresses the browser's policy stopped in the page pane
const els = {};
let pvDoc = null, pvWin = null;
let renderTimer = 0, commitTimer = 0, statusTimer = 0, markFrame = 0;
let renderCost = 20, commitCost = 20;
let tokenCache = { text: null, tokens: null };

function tokensFor(text) {
  if (tokenCache.text !== text) tokenCache = { text, tokens: tokenize(text) };
  return tokenCache.tokens;
}

// ---------------------------------------------------------------- status line and dialogs

function setStatus(message, kind) {
  els.msg.textContent = message;
  els.msg.className = kind || '';
  clearTimeout(statusTimer);
  if (message) statusTimer = setTimeout(() => { els.msg.textContent = ''; }, 9000);
}

function openDialog(dialog) {
  return new Promise((resolve) => {
    if (dialog.open) { resolve(''); return; }       // a second question while one is open counts as "cancel"
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue), { once: true });
    dialog.showModal();
  });
}

function infoBox(message) {
  els.infoText.textContent = message;
  return openDialog(els.dlgInfo);
}

async function confirmBox(message, okLabel) {
  els.confirmText.textContent = message;
  els.confirmOk.textContent = okLabel;
  return (await openDialog(els.dlgConfirm)) === 'ok';
}

// ---------------------------------------------------------------- source pane

function syncSourceScroll() {
  const x = els.src.scrollLeft, y = els.src.scrollTop;
  els.hlIn.style.transform = 'translate(' + -x + 'px,' + -y + 'px)';
  els.gutterIn.style.transform = 'translateY(' + -y + 'px)';
}

function updateSourceView() {
  const text = state.text;
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  state.lineStarts = starts;
  const plain = text.length > HIGHLIGHT_LIMIT;
  if (plain !== state.plain) { state.plain = plain; els.srcBox.classList.toggle('plain', plain); }
  if (!plain) patchLines(els.hlIn, hlState, highlightLines(text, tokensFor(text)));
  if (starts.length !== state.lineCount) {
    state.lineCount = starts.length;
    let s = '';
    for (let i = 1; i <= starts.length; i++) s += i + '\n';
    els.gutterIn.textContent = s;
  }
  syncSourceScroll();
  applySourceMark(false);
}

// Writes a new text into the source field while keeping its caret and scroll position.
function writeSource(oldText, newText) {
  const ta = els.src;
  const a = ta.selectionStart, b = ta.selectionEnd, top = ta.scrollTop, left = ta.scrollLeft;
  ta.value = newText;
  ta.setSelectionRange(mapOffset(oldText, newText, a), mapOffset(oldText, newText, b));
  ta.scrollTop = top;
  ta.scrollLeft = left;
}

function showCaretPosition() {
  const pos = els.src.selectionStart, starts = state.lineStarts;
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= pos) lo = mid; else hi = mid - 1; }
  els.pos.textContent = 'Zeile ' + (lo + 1) + ', Spalte ' + (pos - starts[lo] + 1);
}

// Marks a source range without moving the keyboard focus (used to show where the preview caret is).
function applySourceMark(reveal) {
  if (!window.CSS || !CSS.highlights) return;
  const mark = state.srcMark;
  if (!mark || state.plain) { CSS.highlights.delete('se-link'); return; }
  const a = linePoint(els.hlIn, state.lineStarts, mark[0]), b = linePoint(els.hlIn, state.lineStarts, mark[1]);
  if (!a || !b) { CSS.highlights.delete('se-link'); return; }
  try {
    const range = new Range();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    CSS.highlights.set('se-link', new Highlight(range));
  } catch (e) { CSS.highlights.delete('se-link'); }
  if (reveal) {
    const y = a.line * LINE_HEIGHT, view = els.src.clientHeight;
    if (y < els.src.scrollTop || y > els.src.scrollTop + view - 2 * LINE_HEIGHT) els.src.scrollTop = Math.max(0, y - view / 3);
  }
}

// ---------------------------------------------------------------- shared state updates

const isDirty = () => state.text !== state.savedText;
const previewFocused = () => document.activeElement === els.pv;

function updateChrome() {
  els.docName.textContent = state.name;
  els.docState.textContent = isDirty() ? '● nicht gespeichert' : 'gespeichert';
  els.docState.className = isDirty() ? 'dirty' : '';
  els.bUndo.disabled = !history.canUndo();
  els.bRedo.disabled = !history.canRedo();
  document.documentElement.dataset.sync = state.pvRev === state.rev && !state.visualDirty ? 'yes' : 'no';
}

// Installs a new text revision that did not come from typing in the source field.
function applyText(newText, kind) {
  const old = state.text;
  if (newText === old) return false;
  state.text = newText;
  state.rev++;
  writeSource(old, newText);
  if (kind) history.record(newText, kind, now());
  updateSourceView();
  return true;
}

// ---------------------------------------------------------------- source -> preview

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderIfStale, clamp(renderCost * 3, 150, 700));
}

function renderIfStale() {
  if (state.pvRev !== state.rev && !state.visualDirty) render(null);
}

function setPreviewSelection(offsets) {
  if (!offsets || offsets[0] == null || offsets[1] == null) return;
  const a = previewPosOf(state.view, offsets[0]), f = previewPosOf(state.view, offsets[1]);
  if (!a || !f) return;
  try { pvDoc.getSelection().setBaseAndExtent(a.node, a.offset, f.node, f.offset); } catch (e) { /* position no longer exists */ }
}

// Brings the preview in line with state.text. `restore` (source offsets) repositions the preview selection
// when the update had to replace nodes.
function render(restore) {
  clearTimeout(renderTimer);
  const t0 = now();
  let view, res;
  try {
    view = analyze(state.text, tokensFor(state.text));
    res = renderView(view, pvDoc, info, files);
  } catch (e) {
    // Last line of defence: show nothing editable rather than a page that does not match the text.
    view = { ok: false, failed: true };
    res = { changed: true, report: {}, title: '' };
    pvDoc.body.textContent = '';
    pvDoc.body.setAttribute('contenteditable', 'false');
    info.set(pvDoc.body, { t: null, kids: [] });
  }
  state.view = view;
  state.pvRev = state.rev;
  state.visualDirty = false;
  state.report = view.failed ? '' : reportText(res.report);
  showInactive();
  els.lockNote.hidden = view.ok;
  els.lockNote.textContent = view.failed ? LOCK_FAILED : LOCK_NORMAL;
  els.pvTitle.textContent = res.title ? 'Titel: ' + res.title : '';
  if (res.changed && restore && previewFocused()) setPreviewSelection(restore);
  renderCost = now() - t0;
  updateChrome();
  scheduleMarks();
}

// The note above the page lists what the editor found and left out. Whatever the browser's content policy
// had to stop in the page pane is announced as well, so that nothing is switched off without a note. Such an
// entry counts as long as the stopped address still occurs in the text.
function showInactive() {
  let text = state.report;
  if (!text) for (const name of blocked) if (state.text.includes(name)) { text = 'Inhalte von außerhalb der Seite'; break; }
  els.inactive.hidden = !text;
  els.inactiveText.textContent = text ? 'Im Editor ausgeschaltet: ' + text + '.' : '';
}

// ---------------------------------------------------------------- preview -> source

function scheduleCommit() {
  clearTimeout(commitTimer);
  commitTimer = setTimeout(() => { if (!state.composing) commitVisual('vis-type'); }, clamp(commitCost * 3, 90, 500));
}

// Turns pending edits of the preview into a new text revision. Safe to call at any time.
function commitVisual(kind) {
  clearTimeout(commitTimer);
  if (!state.visualDirty) return false;
  if (state.pvRev !== state.rev || !state.view || !state.view.ok) {
    // Cannot happen through the guarded input paths; never let an outdated preview overwrite newer text.
    render(null);
    setStatus('Die Vorschau war nicht aktuell und wurde neu aufgebaut.', 'warn');
    return false;
  }
  const t0 = now();
  const sel = pvDoc.getSelection();
  const points = sel && sel.rangeCount && pvDoc.body.contains(sel.anchorNode) && pvDoc.body.contains(sel.focusNode)
    ? [{ node: sel.anchorNode, offset: sel.anchorOffset }, { node: sel.focusNode, offset: sel.focusOffset }] : [];
  rescueHidden(state.view);
  const out = serializeBody(state.view, info, pvDoc.body, points);
  state.visualDirty = false;
  applyText(out.text, kind || 'vis-type');
  render(out.sel);
  commitCost = now() - t0;
  return true;
}

function markVisualDirty() {
  state.visualDirty = true;
  updateChrome();
}

// ---------------------------------------------------------------- selection links between the panes

function scheduleMarks() {
  if (markFrame) return;
  markFrame = requestAnimationFrame(() => { markFrame = 0; updateMarks(); });
}

function updateMarks() {
  const inSync = state.view && state.view.ok && state.pvRev === state.rev && !state.visualDirty;
  const pvHighlights = pvWin.CSS && pvWin.CSS.highlights;
  if (previewFocused()) {
    if (pvHighlights) pvHighlights.delete('se-src');
    updateToolbar();
    if (!inSync) return;
    const sel = pvDoc.getSelection();
    let mark = null;
    if (sel && sel.rangeCount && pvDoc.body.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0);
      if (range.collapsed) mark = srcElementRange(info, pvDoc.body, range.startContainer);
      else {
        const a = srcOffsetOf(state.view, info, range.startContainer, range.startOffset);
        const b = srcOffsetOf(state.view, info, range.endContainer, range.endOffset);
        if (b > a) mark = [a, b];
      }
    }
    state.srcMark = mark;
    applySourceMark(true);
  } else if (document.activeElement === els.src) {
    for (const b of els.fmt.querySelectorAll('[aria-pressed]')) b.setAttribute('aria-pressed', 'false');
    showCaretPosition();
    if (state.srcMark) { state.srcMark = null; applySourceMark(false); }
    if (!pvHighlights) return;
    const t = inSync ? srcElementAt(state.view, els.src.selectionStart) : null;
    if (!t) { pvHighlights.delete('se-src'); return; }
    try {
      const range = pvDoc.createRange();
      range.selectNode(t.pv);
      pvHighlights.set('se-src', new pvWin.Highlight(range));
      const box = t.pv.getBoundingClientRect();
      if (box.bottom < 0 || box.top > pvWin.innerHeight) t.pv.scrollIntoView({ block: 'center' });
    } catch (e) { pvHighlights.delete('se-src'); }
  }
}

function updateToolbar() {
  const s = caretState(pvDoc);
  const press = (el, on) => el.setAttribute('aria-pressed', on ? 'true' : 'false');
  press(els.bP, s.block === 'p');
  press(els.bH1, s.block === 'h1');
  press(els.bH2, s.block === 'h2');
  press(els.bH3, s.block === 'h3');
  press(els.bBold, s.bold);
  press(els.bItalic, s.italic);
  press(els.bUl, s.list === 'ul');
  press(els.bOl, s.list === 'ol');
  press(els.bAlignLeft, s.editable && s.align === 'left');
  press(els.bAlignCenter, s.editable && s.align === 'center');
  press(els.bAlignRight, s.editable && s.align === 'right');
  press(els.bAlignJustify, s.editable && s.align === 'justify');
  els.bUnlink.disabled = !s.link && !(pvDoc.getSelection() && !pvDoc.getSelection().isCollapsed);
}

// ---------------------------------------------------------------- history

function stepHistory(entry) {
  if (!entry) return;
  const old = state.text;
  applyText(entry.text, null);
  render(null);
  const end = changeEnd(old, entry.text);
  if (previewFocused()) setPreviewSelection([end, end]);
  else { els.src.setSelectionRange(end, end); state.srcMark = null; }
  updateChrome();
  scheduleMarks();
}

function undo() {
  commitVisual('vis-type');
  if (!history.canUndo()) { setStatus('Es gibt nichts mehr rückgängig zu machen.'); return; }
  stepHistory(history.undo());
}

function redo() {
  commitVisual('vis-type');
  if (!history.canRedo()) { setStatus('Es gibt nichts zu wiederholen.'); return; }
  stepHistory(history.redo());
}

// ---------------------------------------------------------------- toolbar commands

// Keyboard input needs the editable body itself to be focused, not just the frame window.
function focusPreview() {
  pvWin.focus();
  if (pvDoc.body.isContentEditable) pvDoc.body.focus({ preventScroll: true });
}

const env = { get doc() { return pvDoc; }, get src() { return state.view ? state.view.src : ''; }, info };

// Makes sure the preview is current and has an editable selection.
function readyToEdit() {
  commitVisual('vis-type');
  renderIfStale();
  if (!state.view.ok) { setStatus('Die Seite kann rechts gerade nicht bearbeitet werden. Korrigiere zuerst den Code links.', 'warn'); return null; }
  const range = getRange(pvDoc);
  if (!range || !isEditableAt(range.startContainer) || !isEditableAt(range.endContainer)) {
    setStatus('Klicke zuerst rechts in deine Seite – an die Stelle, die du ändern möchtest.', 'warn');
    return null;
  }
  return range;
}

function runCommand(fn, emptyMessage) {
  if (!readyToEdit()) return;
  focusPreview();
  let result;
  state.inCommand = true;
  try { result = fn(); } finally { state.inCommand = false; }
  if (result === 'none' && emptyMessage) setStatus(emptyMessage, 'warn');
  history.seal();
  markVisualDirty();
  commitVisual('cmd');
  history.seal();
}

function restoreRange(range) {
  focusPreview();
  try { const sel = pvDoc.getSelection(); sel.removeAllRanges(); sel.addRange(range); } catch (e) { /* ignore */ }
}

// "Link": with the caret or the selection inside one link, its address is changed; otherwise a link is made.
async function linkFlow() {
  const live = readyToEdit();
  if (!live) return;
  const range = live.cloneRange();
  const link = linkAround(pvDoc, range);
  if (!link) {
    const problem = linkProblem(pvDoc, range);
    if (problem === 'inlink') { setStatus('Die Markierung reicht über einen Link hinaus. Setze den Cursor in den Link, um ihn zu ändern.', 'warn'); return; }
    if (problem === 'multi') { setStatus('Markiere für einen Link nur Text innerhalb eines Absatzes.', 'warn'); return; }
  }
  const rev = state.rev, docId = state.docId;
  els.linkTitle.textContent = link ? 'Link ändern' : 'Link einfügen';
  els.linkOk.textContent = link ? 'Übernehmen' : 'Einfügen';
  els.linkUrl.value = link ? link.getAttribute(HREF_HOLDER) || '' : '';
  els.linkText.value = '';
  els.linkTextRow.hidden = !!link || !range.collapsed;
  els.linkErr.textContent = '';
  const asked = openDialog(els.dlgLink);
  els.linkUrl.select();
  const answer = await asked;
  if (state.rev !== rev || state.docId !== docId) return;
  restoreRange(range);
  if (answer !== 'ok') return;
  const url = els.linkOk.dataset.url, text = els.linkText.value.trim();
  if (link) { if (link.isConnected) runCommand(() => changeLink(env, link, url)); return; }
  runCommand(() => insertLink(env, getRange(pvDoc) || range, url, text));
}

function validateLinkDialog() {
  const check = checkLinkUrl(els.linkUrl.value);
  if (!check.ok) {
    els.linkErr.textContent = check.reason === 'empty' ? 'Bitte gib eine Adresse ein, zum Beispiel https://www.beispiel.de oder seite2.html.'
      : check.reason === 'long' ? 'Diese Adresse ist zu lang.'
      : 'Diese Art von Adresse ist nicht erlaubt. Erlaubt sind Web-Adressen (https://…), E-Mail-Links (mailto:…) und Dateinamen deiner eigenen Seiten.';
    return false;
  }
  els.linkOk.dataset.url = check.url;
  return true;
}

// ---------------------------------------------------------------- images
//
// The source names an image by its file name (with an optional folder). The file itself is never copied into
// the document. `files` remembers what the pupil has chosen, so that the page pane can show it.

let picked = null;          // file chosen in the open dialog, not yet accepted
let imageEdit = null;       // image that the open dialog changes, or null when it inserts
let imageResult = null;     // what the dialog decided: { src, url, alt, width }
let lastFolder = '';

function dropPicked() {
  if (picked && files.get(picked.name) !== picked) URL.revokeObjectURL(picked.url);
  picked = null;
}

// "Bild": with an image selected (a click selects it) the image is changed, otherwise one is inserted.
async function imageFlow(dropped) {
  const live = readyToEdit();
  if (!live) return;
  const range = live.cloneRange();
  const img = dropped ? null : selectedImage(pvDoc);
  const rev = state.rev, docId = state.docId;
  const address = img ? img.getAttribute(FILE_HOLDER) : null;
  dropPicked();
  imageEdit = img;
  imageResult = null;
  els.imgTitle.textContent = img ? 'Bild ändern' : 'Bild einfügen';
  els.imgOk.textContent = img ? 'Übernehmen' : 'Einfügen';
  els.imgErr.textContent = '';
  els.imgAlt.value = img ? img.getAttribute('alt') || '' : '';
  els.imgWidth.value = img ? img.getAttribute('width') || '' : '';
  els.imgDir.value = address && fileOfSrc(address) ? folderOfSrc(address) : lastFolder;
  els.imgName.textContent = !img ? 'Noch kein Bild ausgewählt.'
    : address ? 'Jetzt: ' + (address.length > 60 ? address.slice(0, 57) + '…' : address)
    : 'Jetzt: Das Bild steckt im Code der Seite.';
  const shown = img && !img.hasAttribute('data-se-src') ? img.getAttribute('src') : null;
  els.imgPrev.hidden = !shown;
  if (shown) els.imgPrev.src = shown; else els.imgPrev.removeAttribute('src');
  if (dropped) pickImage(dropped);
  const answer = await openDialog(els.dlgImage);
  const result = imageResult, chosen = picked;
  imageEdit = imageResult = null;
  els.imgPrev.removeAttribute('src');
  if (state.rev !== rev || state.docId !== docId) { dropPicked(); return; }
  restoreRange(range);
  if (answer !== 'ok' || !result) { dropPicked(); return; }
  picked = null;
  if (chosen) {
    const old = files.get(chosen.name);
    if (old && old !== chosen) URL.revokeObjectURL(old.url);
    files.set(chosen.name, chosen);
    lastFolder = folderOfSrc(result.src || '');
  }
  if (img) { if (img.isConnected) runCommand(() => changeImage(env, img, result)); }
  else runCommand(() => insertImage(env, getRange(pvDoc) || range, result));
  if (chosen) {
    const folder = folderOfSrc(result.src);
    setStatus('Lege die Datei „' + chosen.name + '“ ' + (folder ? 'in den Ordner „' + folder + '“ neben deiner Seite.' : 'in denselben Ordner wie deine Seite.') + ' Sonst fehlt das Bild später im Browser.', 'ok');
  }
}

async function pickImage(file) {
  els.imgErr.textContent = '';
  els.imgName.textContent = 'Bild wird geprüft …';
  const result = await readImage(file);
  if (!els.dlgImage.open) { if (result.url) URL.revokeObjectURL(result.url); return; }
  if (result.error) {
    els.imgName.textContent = picked ? picked.name : imageEdit ? 'Das bisherige Bild bleibt.' : 'Noch kein Bild ausgewählt.';
    els.imgErr.textContent = result.error === 'type' ? 'Diese Datei ist kein unterstütztes Bild. Erlaubt sind PNG, JPG, GIF und WebP.'
      : 'Das Bild konnte nicht gelesen werden. Vielleicht ist die Datei beschädigt.';
    return;
  }
  dropPicked();
  picked = result;
  els.imgName.textContent = result.name + ' (' + result.width + ' × ' + result.height + ' Pixel' + (result.large ? ', eine sehr große Datei' : '') + ')';
  els.imgPrev.src = result.url;
  els.imgPrev.hidden = false;
}

// Checks the fields of the image dialog and fills `imageResult`. Returns false with a message if something is wrong.
function validateImageDialog() {
  const fail = (message) => { els.imgErr.textContent = message; return false; };
  if (!imageEdit && !picked) return fail('Wähle zuerst ein Bild aus.');
  const width = els.imgWidth.value.trim();
  if (width && !/^[1-9][0-9]{0,3}$/.test(width)) return fail('Die Breite ist eine Zahl in Pixeln, zum Beispiel 300.');
  const result = { alt: els.imgAlt.value.trim(), width };
  const address = imageEdit ? imageEdit.getAttribute(FILE_HOLDER) : null;
  const folder = els.imgDir.value;
  if (picked) {
    const made = imagePath(folder, picked.name);
    if (!made.ok) return fail('Der Name des Unterordners darf keine Zeichen wie : ? # " < > enthalten.');
    // the same file in the same folder keeps the address exactly as it is written in the code
    result.src = address && fileOfSrc(address) === picked.name && folder.trim() === folderOfSrc(address) ? address : made.src;
    result.url = picked.url;
  } else if (address && fileOfSrc(address)) {
    // same file, perhaps another folder: the file name stays exactly as it is written in the code
    const made = imagePath(folder, 'x');
    if (!made.ok) return fail('Der Name des Unterordners darf keine Zeichen wie : ? # " < > enthalten.');
    result.src = made.src.slice(0, -1) + address.trim().replace(/\\/g, '/').split('/').pop();
  }
  imageResult = result;
  return true;
}

// ---------------------------------------------------------------- formatting the source

// Lays out both texts in a hidden frame that is built exactly like the page pane (same width, same filter,
// same policy) and compares where every element and every piece of text ends up. Animations are stopped so
// that both measurements see the page at rest.
async function sameLayout(a, b) {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.className = 'probe';
  frame.style.width = els.pv.clientWidth + 'px';
  frame.style.height = els.pv.clientHeight + 'px';
  const loaded = new Promise((resolve) => {
    frame.addEventListener('load', () => { const d = frame.contentDocument; if (d && d.URL === 'about:srcdoc' && d.body) resolve(d); });
    setTimeout(resolve, 4000, null);
  });
  frame.srcdoc = PREVIEW_SHELL.replace('</style>', '*,*::before,*::after{animation:none!important;transition:none!important}</style>');
  document.body.appendChild(frame);
  try {
    const doc = await loaded;
    if (!doc) return false;
    const prints = [];
    for (const text of [a, b]) {
      renderView(analyze(text, tokenize(text)), doc, new WeakMap(), files);
      await Promise.all(Array.from(doc.querySelectorAll('img'), (img) => img.decode().catch(() => {})));
      prints.push(layoutPrint(doc));
    }
    return prints[0] === prints[1];
  } finally { frame.remove(); }
}

const FORMAT_NO = {
  spaces: 'Diese Seite verwendet die CSS-Eigenschaft „white-space“. Dabei kann jedes Leerzeichen zählen, deshalb wird der Code nicht automatisch aufgeräumt.',
  external: 'Diese Seite verwendet eine externe CSS-Datei. Der Editor kann sie nicht lesen und deshalb nicht prüfen, ob die Seite nach dem Aufräumen noch gleich aussieht.',
  parse: 'Der Code konnte nicht sicher aufgeräumt werden. Wahrscheinlich ist ein Tag nicht richtig geschlossen oder verschachtelt.',
  look: 'Durch das Aufräumen würde sich das Aussehen der Seite ändern, zum Beispiel Abstände zwischen Wörtern oder Elementen. Das liegt am CSS dieser Seite.',
};

// "Tidy up" is applied only if three independent checks agree that nothing but insignificant white space
// changes: the style rules do not make spaces count, both texts parse to the same tree, and both texts are
// laid out identically in the page pane's own rendering.
let formatting = false;

async function formatDoc() {
  if (formatting) return;
  commitVisual('vis-type');
  const src = state.text, rev = state.rev, docId = state.docId;
  let out = null, problem = '';
  formatting = true;
  try {
    const before = new DOMParser().parseFromString(src, 'text/html');
    const css = cssFacts(before);
    if (css.spaces) problem = 'spaces';
    else if (css.external) problem = 'external';
    else {
      out = formatSource(src, parseHtml(src, before.compatMode === 'BackCompat', tokensFor(src)).root);
      if (out === src) { setStatus('Der Code ist schon aufgeräumt.'); return; }
      const after = new DOMParser().parseFromString(out, 'text/html');
      const sameInk = src.replace(/[ \t\n\f\r]+/g, '') === out.replace(/[ \t\n\f\r]+/g, '');
      if (!sameInk || canonDom(before, FMT_BLOCK, FMT_KEEP) !== canonDom(after, FMT_BLOCK, FMT_KEEP)) problem = 'parse';
      else if (!(await sameLayout(src, out))) problem = 'look';
    }
  } catch (e) { problem = 'parse'; } finally { formatting = false; }
  commitVisual('vis-type');
  if (state.rev !== rev || state.docId !== docId) {         // the check took a moment and the pupil went on writing
    setStatus('Aufräumen abgebrochen, weil sich der Code inzwischen geändert hat.', 'warn');
    return;
  }
  if (problem) { await infoBox(FORMAT_NO[problem] + ' Dein Code bleibt unverändert.'); return; }
  history.seal();
  applyText(out, 'cmd');
  history.seal();
  render(null);
  setStatus('Der Code wurde aufgeräumt.');
}

// ---------------------------------------------------------------- files

function replaceDocument(text, meta) {
  state.docId++;
  clearTimeout(renderTimer);
  clearTimeout(commitTimer);
  state.visualDirty = false;
  state.text = text;
  state.rev++;
  state.savedText = meta.unsaved ? null : text;
  state.name = meta.name || DEFAULT_NAME;
  state.handle = meta.handle || null;
  state.bom = !!meta.bom;
  state.eol = meta.eol || '\n';
  state.srcMark = null;
  blocked.clear();
  history.reset(text);
  els.src.value = text;
  els.src.setSelectionRange(0, 0);
  els.src.scrollTop = 0;
  els.src.scrollLeft = 0;
  updateSourceView();
  render(null);
  pvDoc.documentElement.scrollTop = 0;
  pvDoc.body.scrollTop = 0;
  try { pvDoc.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
}

// New, Open and a dropped file replace the whole document and its history. Each such operation takes a
// ticket. Only the newest ticket may complete, and only for the document state whose loss the pupil has
// accepted: if the text changed while a file was being chosen or read, the question is asked again.
function beginReplace() {
  return { seq: ++state.opSeq, docId: -1, rev: -1 };
}

async function mayReplace(op, lateName) {
  for (;;) {
    commitVisual('vis-type');
    if (op.seq !== state.opSeq) return false;
    const docId = state.docId, rev = state.rev;
    if (op.docId === docId && op.rev === rev) return true;
    if (isDirty()) {
      const question = op.docId < 0 ? 'Deine Änderungen sind noch nicht gespeichert. Wenn du fortfährst, gehen sie verloren.'
        : 'Du hast deine Seite noch geändert, während „' + lateName + '“ geöffnet wurde. Wenn du fortfährst, gehen diese Änderungen verloren.';
      if (!(await confirmBox(question, 'Änderungen verwerfen'))) return false;
    }
    op.docId = docId;
    op.rev = rev;
  }
}

async function newDoc() {
  if (!(await mayReplace(beginReplace()))) return;
  replaceDocument(TEMPLATE, { name: DEFAULT_NAME });
  setStatus('Neue Seite angelegt.');
}

async function loadFile(file, handle, op) {
  if (file.size > MAX_FILE_BYTES) {
    await infoBox('Die Datei „' + file.name + '“ ist zu groß. Der Editor öffnet Dateien bis 5 MB. Deine aktuelle Seite bleibt unverändert.');
    return false;
  }
  let bytes;
  try { bytes = new Uint8Array(await file.arrayBuffer()); } catch (e) {
    await infoBox('Die Datei „' + file.name + '“ konnte nicht gelesen werden. Deine aktuelle Seite bleibt unverändert.');
    return false;
  }
  let decoded = decodeFileBytes(bytes, false);
  if (decoded.error === 'encoding') {
    const go = await confirmBox('Die Datei „' + file.name + '“ ist nicht als UTF-8 gespeichert. Der Editor kann sie umwandeln; prüfe danach die Umlaute und die Zeile mit „charset“. Die Datei auf dem Datenträger wird dabei nicht verändert.', 'Umwandeln und öffnen');
    if (!go) return false;
    decoded = decodeFileBytes(bytes, true);
  }
  if (decoded.error) {
    await infoBox(decoded.error === 'utf16'
      ? 'Die Datei „' + file.name + '“ ist als UTF-16 gespeichert. Das kann der Editor nicht öffnen. Deine aktuelle Seite bleibt unverändert.'
      : 'Die Datei „' + file.name + '“ ist keine Textdatei. Deine aktuelle Seite bleibt unverändert.');
    return false;
  }
  // Last step before the document is replaced; nothing is awaited between this check and the replacement.
  if (!(await mayReplace(op, file.name))) {
    setStatus(op.seq !== state.opSeq ? '„' + file.name + '“ wurde nicht geöffnet, weil du inzwischen etwas anderes begonnen hast.'
      : '„' + file.name + '“ wurde nicht geöffnet. Deine Seite bleibt, wie sie ist.', 'warn');
    return false;
  }
  replaceDocument(decoded.text, { name: file.name, handle: decoded.legacy ? null : handle, bom: decoded.bom, eol: decoded.eol, unsaved: decoded.legacy });
  setStatus(decoded.legacy ? 'Geöffnet und in UTF-8 umgewandelt: ' + file.name + '. Bitte unter neuem Namen speichern.'
    : decoded.mixedEol ? 'Geöffnet: ' + file.name + '. Die Zeilenenden waren uneinheitlich und werden beim Speichern vereinheitlicht.'
    : 'Geöffnet: ' + file.name, decoded.legacy ? 'warn' : '');
  return true;
}

let pickOp = null;     // ticket of the Open click that is waiting for the browser's file chooser

async function openDoc() {
  const op = beginReplace();
  if (!(await mayReplace(op))) return;
  if (!window.showOpenFilePicker) { pickOp = op; els.fileIn.click(); return; }
  let handle;
  try { [handle] = await window.showOpenFilePicker({ types: FILE_TYPES }); } catch (e) {
    if (!e || e.name !== 'AbortError') { pickOp = op; els.fileIn.click(); }
    return;
  }
  let file;
  try { file = await handle.getFile(); } catch (e) { await infoBox('Die Datei konnte nicht gelesen werden. Deine aktuelle Seite bleibt unverändert.'); return; }
  await loadFile(file, handle, op);
}

function markSaved(snapshot) {
  if (snapshot.docId !== state.docId) return;
  state.savedText = snapshot.text;
  updateChrome();
}

async function writeToHandle(handle, blob) {
  try {
    const writer = await handle.createWritable();
    await writer.write(blob);
    await writer.close();
    return 'ok';
  } catch (e) {
    return e && e.name === 'AbortError' ? 'abort' : e && e.name === 'NotAllowedError' ? 'denied' : 'fail';
  }
}

function snapshotForSave() {
  commitVisual('vis-type');                 // the file must contain the very last keystroke of the preview
  return { text: state.text, docId: state.docId, name: state.name, blob: new Blob([encodeFileText(state.text, state.bom, state.eol)], { type: 'text/html' }) };
}

function downloadDoc(given) {
  const snap = given || snapshotForSave();
  const url = URL.createObjectURL(snap.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = snap.name || DEFAULT_NAME;
  a.hidden = true;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  markSaved(snap);
  setStatus('Heruntergeladen: ' + a.download + ' (im Ordner „Downloads“).', 'ok');
  return true;
}

async function saveDoc() {
  const snap = snapshotForSave();
  let handle = state.handle;
  if (!handle) {
    if (!window.showSaveFilePicker) return downloadDoc(snap);
    try { handle = await window.showSaveFilePicker({ suggestedName: snap.name, types: FILE_TYPES }); } catch (e) {
      if (e && e.name === 'AbortError') { setStatus('Speichern abgebrochen. Deine Seite ist noch nicht gespeichert.', 'warn'); return false; }
      return downloadDoc(snap);
    }
  }
  const result = await writeToHandle(handle, snap.blob);
  if (result !== 'ok') {
    setStatus(result === 'abort' ? 'Speichern abgebrochen. Deine Seite ist noch nicht gespeichert.'
      : 'Die Datei konnte nicht gespeichert werden. Deine Seite ist noch nicht gespeichert – nutze „Herunterladen“.', 'warn');
    return false;
  }
  if (snap.docId === state.docId) { state.handle = handle; state.name = handle.name || state.name; }
  markSaved(snap);
  setStatus('Gespeichert: ' + (handle.name || snap.name), 'ok');
  return true;
}

async function handleDroppedFile(file) {
  if (/^image\//.test(file.type)) { imageFlow(file); return; }
  const op = beginReplace();
  if (!(await mayReplace(op))) return;
  loadFile(file, null, op);
}

// ---------------------------------------------------------------- event wiring

function onSourceInput(e) {
  const ta = els.src;
  if (state.visualDirty) {
    // Both panes changed at once (not reachable through the guarded focus paths). Keep both: the preview edit
    // becomes its own history step, the source edit stays the current text.
    const mine = ta.value;
    commitVisual('vis-type');
    history.seal();
    ta.value = mine;
    setStatus('Beide Seiten wurden gleichzeitig geändert. Mit „Rückgängig“ erreichst du die andere Fassung.', 'warn');
  }
  const value = ta.value;
  if (value === state.text) return;
  state.text = value;
  state.rev++;
  const type = e && e.inputType ? e.inputType : '';
  history.record(value, /^(insertText|insertCompositionText|deleteContentBackward|deleteContentForward)$/.test(type) ? 'src-type' : 'src-edit', now());
  updateSourceView();
  updateChrome();
  showCaretPosition();
  scheduleRender();
}

function onSourceKeydown(e) {
  if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
    e.preventDefault();
    els.src.setRangeText('  ', els.src.selectionStart, els.src.selectionEnd, 'end');
    onSourceInput({ inputType: 'insertText' });
  }
}

function onShortcut(e) {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  if (e.target && e.target.closest && e.target.closest('dialog')) return false;
  const key = e.key.toLowerCase();
  if (key === 's') { e.preventDefault(); saveDoc(); return true; }
  if (key === 'o') { e.preventDefault(); openDoc(); return true; }
  if (key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return true; }
  if (key === 'y') { e.preventDefault(); redo(); return true; }
  return false;
}

function hasFiles(e) {
  return !!e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0;
}

function wireDrop(target, always) {
  target.addEventListener('dragover', (e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } else if (always) e.preventDefault(); });
  target.addEventListener('drop', (e) => {
    if (hasFiles(e)) { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) handleDroppedFile(file); }
    else if (always) e.preventDefault();
  });
}

function wirePreview() {
  try { pvDoc.execCommand('defaultParagraphSeparator', false, 'p'); pvDoc.execCommand('styleWithCSS', false, false); } catch (e) { /* defaults stay */ }
  const fresh = () => { if (!state.visualDirty) renderIfStale(); };
  pvWin.addEventListener('focus', () => { fresh(); if (pvDoc.body.isContentEditable) pvDoc.body.focus({ preventScroll: true }); });
  pvDoc.addEventListener('pointerdown', fresh, true);
  pvWin.addEventListener('blur', () => commitVisual('vis-type'));
  pvDoc.addEventListener('beforeinput', (e) => {
    if (state.inCommand) return;
    if (state.pvRev !== state.rev) { e.preventDefault(); render(null); return; }
    const type = e.inputType || '';
    if (type === 'historyUndo') { e.preventDefault(); undo(); }
    else if (type === 'historyRedo') { e.preventDefault(); redo(); }
    else if (type === 'formatBold') { e.preventDefault(); runCommand(() => toggleInline(env, 'bold')); }
    else if (type === 'formatItalic') { e.preventDefault(); runCommand(() => toggleInline(env, 'italic')); }
    else if (type.startsWith('format') || type === 'insertFromDrop' || type === 'insertFromPaste' || type === 'insertFromPasteAsQuotation' || type === 'insertLink') e.preventDefault();
  });
  pvDoc.addEventListener('input', () => { markVisualDirty(); if (!state.composing) scheduleCommit(); });
  pvDoc.addEventListener('compositionstart', () => { state.composing = true; });
  pvDoc.addEventListener('compositionend', () => { state.composing = false; if (state.visualDirty) scheduleCommit(); });
  pvDoc.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData ? e.clipboardData.getData('text/plain') : '';
    if (!text) { setStatus('Hier kannst du nur Text einfügen. Bilder fügst du mit dem Knopf „Bild“ ein.', 'warn'); return; }
    runCommand(() => insertPlainText(env, text.length > 200000 ? text.slice(0, 200000) : text));
  });
  pvDoc.addEventListener('dragstart', (e) => e.preventDefault());
  wireDrop(pvDoc, true);
  pvDoc.addEventListener('click', (e) => {
    const target = e.target;
    if (!target || !target.closest) return;
    if (target.closest('a')) e.preventDefault();
    // A click on an image selects it, so that "Bild" and the alignment buttons know which one is meant.
    if (target.localName === 'img' && target.parentNode && target.parentNode.isContentEditable) {
      const range = pvDoc.createRange();
      range.selectNode(target);
      const sel = pvDoc.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
  pvDoc.addEventListener('keydown', (e) => {
    if (onShortcut(e)) return;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') { e.preventDefault(); runCommand(() => toggleInline(env, 'bold')); }
      else if (key === 'i') { e.preventDefault(); runCommand(() => toggleInline(env, 'italic')); }
    }
  });
  pvDoc.addEventListener('selectionchange', scheduleMarks);
  pvDoc.addEventListener('securitypolicyviolation', (e) => {
    const name = String(e.blockedURI || '').split(/[?#]/)[0].split('/').filter(Boolean).pop() || '';
    if (name.length < 3 || blocked.size > 200 || blocked.has(name)) return;       // keywords like "inline" carry no address
    blocked.add(name);
    try { blocked.add(decodeURIComponent(name)); } catch (err) { /* keep the raw form */ }
    showInactive();
  });
}

function wireChrome() {
  const keepFocus = (el) => el.addEventListener('mousedown', (e) => e.preventDefault());
  const tool = (el, fn) => { keepFocus(el); el.addEventListener('click', fn); };
  els.bNew.addEventListener('click', newDoc);
  els.bOpen.addEventListener('click', openDoc);
  tool(els.bSave, saveDoc);
  tool(els.bDownload, () => downloadDoc(null));
  tool(els.bUndo, undo);
  tool(els.bRedo, redo);
  tool(els.bFormat, formatDoc);
  els.bHelp.addEventListener('click', () => openDialog(els.dlgHelp));
  const noBlock = 'Setze den Cursor in einen Absatz oder eine Überschrift.';
  tool(els.bP, () => runCommand(() => setBlock(env, 'p'), noBlock));
  tool(els.bH1, () => runCommand(() => setBlock(env, 'h1'), noBlock));
  tool(els.bH2, () => runCommand(() => setBlock(env, 'h2'), noBlock));
  tool(els.bH3, () => runCommand(() => setBlock(env, 'h3'), noBlock));
  const noText = 'Markiere zuerst den Text, den du ändern möchtest.';
  tool(els.bBold, () => runCommand(() => toggleInline(env, 'bold'), noText));
  tool(els.bItalic, () => runCommand(() => toggleInline(env, 'italic'), noText));
  tool(els.bUl, () => runCommand(() => toggleList(env, 'ul'), noBlock));
  tool(els.bOl, () => runCommand(() => toggleList(env, 'ol'), noBlock));
  tool(els.bAlignLeft, () => runCommand(() => setAlign(env, 'left'), noBlock));
  tool(els.bAlignCenter, () => runCommand(() => setAlign(env, 'center'), noBlock));
  tool(els.bAlignRight, () => runCommand(() => setAlign(env, 'right'), noBlock));
  tool(els.bAlignJustify, () => runCommand(() => setAlign(env, 'justify'), noBlock));
  tool(els.bLink, linkFlow);
  tool(els.bUnlink, () => runCommand(() => removeLinks(env), 'Hier ist kein Link. Setze den Cursor in einen Link.'));
  tool(els.bImage, () => imageFlow(null));

  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('click', (e) => { const v = e.target && e.target.dataset ? e.target.dataset.close : undefined; if (v !== undefined) dialog.close(v); });
  }
  els.linkOk.addEventListener('click', () => { if (validateLinkDialog()) els.dlgLink.close('ok'); });
  els.linkUrl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.linkOk.click(); } });
  els.linkText.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.linkOk.click(); } });
  els.imgPick.addEventListener('click', () => els.imgIn.click());
  els.imgIn.addEventListener('change', () => { const file = els.imgIn.files[0]; els.imgIn.value = ''; if (file) pickImage(file); });
  els.imgOk.addEventListener('click', () => { if (validateImageDialog()) els.dlgImage.close('ok'); });
  for (const field of [els.imgAlt, els.imgDir, els.imgWidth]) field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); els.imgOk.click(); } });
  els.fileIn.addEventListener('change', () => {
    const file = els.fileIn.files[0], op = pickOp && pickOp.seq === state.opSeq ? pickOp : beginReplace();
    els.fileIn.value = '';
    pickOp = null;
    if (file) loadFile(file, null, op);
  });

  els.src.addEventListener('input', onSourceInput);
  els.src.addEventListener('keydown', onSourceKeydown);
  els.src.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); undo(); }
    else if (e.inputType === 'historyRedo') { e.preventDefault(); redo(); }
  });
  els.src.addEventListener('focus', () => { commitVisual('vis-type'); scheduleMarks(); });
  els.src.addEventListener('blur', renderIfStale);
  els.src.addEventListener('scroll', syncSourceScroll);
  for (const type of ['select', 'keyup', 'click']) els.src.addEventListener(type, scheduleMarks);
  document.addEventListener('selectionchange', () => { if (document.activeElement === els.src) scheduleMarks(); });
  document.addEventListener('keydown', onShortcut);
  window.addEventListener('blur', () => commitVisual('vis-type'));
  window.addEventListener('beforeunload', (e) => { commitVisual('vis-type'); if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });
  wireDrop(document, false);

  els.split.addEventListener('pointerdown', (e) => {
    els.split.setPointerCapture(e.pointerId);
    els.work.classList.add('dragging');
    const move = (ev) => { const box = els.work.getBoundingClientRect(); els.work.style.setProperty('--left', clamp((ev.clientX - box.left) / box.width * 100, 20, 80) + '%'); };
    const stop = () => { els.work.classList.remove('dragging'); els.split.removeEventListener('pointermove', move); els.split.removeEventListener('pointerup', stop); els.split.removeEventListener('pointercancel', stop); };
    els.split.addEventListener('pointermove', move);
    els.split.addEventListener('pointerup', stop);
    els.split.addEventListener('pointercancel', stop);
  });
}

function start() {
  for (const el of document.querySelectorAll('[id]')) els[el.id] = el;
  let started = false;
  els.pv.addEventListener('load', () => {
    const doc = els.pv.contentDocument;
    if (started || !doc || doc.URL !== 'about:srcdoc' || !doc.body) return;   // ignore the initial blank document
    started = true;
    pvDoc = doc;
    pvWin = els.pv.contentWindow;
    wirePreview();
    wireChrome();
    replaceDocument(TEMPLATE, { name: DEFAULT_NAME });
    document.documentElement.dataset.ready = 'yes';
  });
  els.pv.srcdoc = PREVIEW_SHELL;
  setTimeout(() => { if (!started) els.fatal.hidden = false; }, 4000);
}

start();
