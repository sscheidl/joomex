import { analyze, previewPosOf, renderView } from './shared/project.js';
import { rescueHidden, serializeBody } from './shared/serialize.js';
import { tokenize } from './shared/tokenizer.js';
import { withTitle } from './shared/format.js';
import {
  caretState, dropEmptyLists, getRange, insertImage, insertLink, insertPlainText, insertTable,
  isEditableAt, linkProblem, removeLinks, setAlign, setBlock, setColor, stepCell, toggleInline, toggleList,
} from './shared/commands.js';

const PROJECT_ORIGIN = 'https://projekt.example';
const FRAME_URL = 'https://app.example/edit-frame.html';
const INLINE = ['bold', 'italic', 'underline', 'sup', 'sub', 'mark'];
const TYPING = /^insert(?:Text|CompositionText|Paragraph|LineBreak|ReplacementText)$/;

export function createVisualEditor(els, editor, actions) {
  const frame = els.visualFrame;
  const info = new WeakMap();
  const env = { get doc() { return doc; }, get src() { return view.src; }, info };
  const buttons = Array.from(els.visualCommands.querySelectorAll('[data-edit]'));
  let doc, view, owner, base, title = '', composing = false, editing = false, failed = false, timer = 0;
  let selection;
  let keptTitle = null;  // a typed title that could not be applied; it stays until applied or reset with Esc

  function projectUrl(address) {
    if (!base || !address || /[\\\u0000-\u001f]/.test(address)) return '';
    try {
      const url = new URL(address, base.href);
      return url.origin === PROJECT_ORIGIN && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function updateTools() {
    els.visualTools.hidden = !editing;
    frame.hidden = !editing;
    els.visualHint.textContent = editing ? 'Hier kannst du schreiben.' : actions.document() ? 'Bearbeite den HTML-Code links.' : '';
    if (document.activeElement !== els.pageTitle) els.pageTitle.value = keptTitle ?? title;
    const s = editing ? caretState(doc) : {};
    for (const b of buttons) {
      const key = b.dataset.edit;
      if (!['link', 'unlink', 'image', 'table'].includes(key)) {
        b.setAttribute('aria-pressed', String(Boolean(s[key] || s.block === key || s.list === key)));
      }
    }
  }

  function sheets(view) {
    const stylesheetUrls = [];
    for (const link of view.dom.head.querySelectorAll('link[rel~="stylesheet" i][href]')) {
      const url = projectUrl(link.getAttribute('href'));
      if (url) stylesheetUrls.push({ url, media: link.getAttribute('media') || '' });
    }
    const existing = Array.from(doc.head.querySelectorAll('link[data-project-sheet]'));
    if (existing.length === stylesheetUrls.length && existing.every((link, i) => link.href === stylesheetUrls[i].url && link.media === stylesheetUrls[i].media)) return;
    for (const link of existing) link.remove();
    for (const { url, media } of stylesheetUrls) {
      const link = doc.createElement('link');
      link.dataset.projectSheet = '';
      link.rel = 'stylesheet';
      link.href = url;
      link.media = media;
      doc.head.append(link);
    }
  }

  function render(offsets) {
    clearTimeout(timer);
    const next = actions.document();
    if (next !== owner) {
      owner = next;
      keptTitle = null;
      view = undefined;
      selection = undefined;
      composing = false;
      if (doc) { doc.body.replaceChildren(); doc.defaultView.scrollTo(0, 0); }
    }
    editing = false;
    if (doc && owner && !failed && !editor.locked) {
      try {
        if (!view || view.src !== editor.text) view = analyze(editor.text, tokenize(editor.text));
        if (view.ok) {
          base.href = PROJECT_ORIGIN + '/' + owner.path.split('/').map(encodeURIComponent).join('/');
          const result = renderView(view, doc, info, { url: projectUrl, missing: new Set() });
          sheets(view);
          title = result.title;
          editing = true;
          if (offsets && offsets.length === 2) {
            const a = previewPosOf(view, offsets[0]), b = previewPosOf(view, offsets[1]);
            if (a && b) doc.getSelection().setBaseAndExtent(a.node, a.offset, b.node, b.offset);
          }
        }
      } catch { view = undefined; editing = false; }
    }
    if (!editing && doc) {
      view = undefined;
      doc.body.contentEditable = 'false';
      doc.body.replaceChildren();
      for (const link of doc.head.querySelectorAll('link[data-project-sheet], style[data-se-user]')) link.remove();
    }
    updateTools();
    actions.layout();
  }

  const current = () => editing && owner === actions.document() && !editor.locked && view?.src === editor.text;

  function commit(kind, onlyInserts = false) {
    if (!current()) { render(); return; }
    try {
      const sel = doc.getSelection();
      const points = sel && sel.rangeCount && doc.body.contains(sel.anchorNode) && doc.body.contains(sel.focusNode)
        ? [{ node: sel.anchorNode, offset: sel.anchorOffset }, { node: sel.focusNode, offset: sel.focusOffset }] : [];
      rescueHidden(view, onlyInserts);
      const out = serializeBody(view, info, doc.body, points, onlyInserts);
      editor.editFromPage(out.text, kind);
      view = undefined;
      render(out.sel);
      return true;
    } catch {
      view = undefined;
      render();
      actions.message('Diese Änderung lässt sich hier nicht sicher übernehmen. Versuche es links im HTML-Code.', true);
      return false;
    }
  }

  function capture() {
    const range = current() && getRange(doc);
    if (range && isEditableAt(range.startContainer) && isEditableAt(range.endContainer)) {
      return { range: range.cloneRange(), owner, view, path: owner.path };
    }
    return null;
  }

  function run(fn, saved = capture()) {
    if (!saved || !current() || saved.owner !== owner || saved.view !== view || saved.path !== owner.path || !doc.body.contains(saved.range.startContainer) || !doc.body.contains(saved.range.endContainer)) {
      actions.message('Klicke zuerst rechts an die Stelle, die du bearbeiten möchtest.', true);
      return;
    }
    doc.defaultView.focus();
    doc.body.focus({ preventScroll: true });
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(saved.range);
    const result = fn(saved.range);
    if (result === 'ok') commit('cmd');
    else if (result) actions.message('Dieser Befehl passt hier nicht. Wähle eine andere Stelle.', true);
  }

  // The title as it would be written, or null if this page's title cannot be written safely from here (for
  // example a <title> inside a <template> comes first).
  function titledSource(value) {
    const src = editor.text;
    const next = withTitle(src, tokenize(src), value);
    const after = next === null ? null : analyze(next, tokenize(next)).dom;
    return after && after.title === value && after.body.innerHTML === view.dom.body.innerHTML && after.compatMode === view.dom.compatMode ? next : null;
  }

  // Takes the title field into the code. Returns false if it could not be taken: on `keep` (a save or close
  // is waiting) the typed title stays in the field, otherwise the field shows the page's title again.
  function editTitle(keep = false) {
    if (!current()) { if (keep) return false; render(); return true; }
    const value = els.pageTitle.value.replace(/\s+/g, ' ').trim();
    if (value === title) { keptTitle = null; return true; }
    const next = titledSource(value);
    if (next === null) {
      if (keep) keptTitle = els.pageTitle.value;
      else { keptTitle = null; els.pageTitle.value = title; }
      actions.message('Ändere den Titel hier bitte im HTML-Code im Tag <title>.', true);
      return false;
    }
    keptTitle = null;
    editor.editFromPage(next, 'cmd');
    render();
    return true;
  }

  async function doCommand(command, saved) {
    if (!saved) { run(() => 'none', saved); return; }
    if (INLINE.includes(command)) run(() => toggleInline(env, command), saved);
    else if (['p', 'h1', 'h2', 'h3'].includes(command)) run(() => setBlock(env, command), saved);
    else if (command === 'ul' || command === 'ol') run(() => toggleList(env, command), saved);
    else if (command === 'unlink') run(() => removeLinks(env), saved);
    else if (command === 'image') {
      actions.picture((src) => run((range) => insertImage(env, range, { src, url: projectUrl(src), alt: '' }), saved));
    } else if (command === 'link') {
      const value = await actions.fields('Link einfügen', [{ label: 'Adresse', value: '' }]);
      const href = value?.[0].trim();
      if (href && /^(?:(?:https?|mailto):|[^:/\\\s]+(?:[/?#]|$)|[#./?])/i.test(href) && !/[\u0000-\u0020\u007f]/.test(href)) {
        run((range) => linkProblem(doc, range) || insertLink(env, range, href, '', false), saved);
      } else if (value) actions.message('Die Link-Adresse ist ungültig.', true);
    } else if (command === 'table') {
      const value = await actions.fields('Tabelle einfügen', [{ label: 'Zeilen', value: '3' }, { label: 'Spalten', value: '2' }]);
      if (!value) return;
      const [rows, cols] = value.map(Number);
      if (Number.isInteger(rows) && Number.isInteger(cols) && rows > 0 && rows <= 25 && cols > 0 && cols <= 12) {
        run((range) => insertTable(env, range, { rows, cols, head: true, border: true }), saved);
      } else actions.message('Wähle 1 bis 25 Zeilen und 1 bis 12 Spalten.', true);
    }
  }

  function historyKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return false;
    const key = e.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return false;
    e.preventDefault();
    if (key === 'y' || e.shiftKey) editor.redo();
    else editor.undo();
    render();
    return true;
  }

  function wire() {
    if (frame.contentWindow?.location.href !== FRAME_URL || doc === frame.contentDocument) return;
    doc = frame.contentDocument;
    base = doc.createElement('base');
    doc.head.append(base);
    try { doc.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* browser default */ }
    doc.addEventListener('pointerdown', () => { if (!current()) render(); }, true);
    doc.addEventListener('beforeinput', (e) => {
      const type = e.inputType;
      if (!current()) { e.preventDefault(); render(); return; }
      if (type === 'historyUndo' || type === 'historyRedo') {
        e.preventDefault();
        if (type === 'historyUndo') editor.undo(); else editor.redo();
        render();
      } else if (type.startsWith('format') || ['insertFromDrop', 'insertFromPaste', 'insertFromPasteAsQuotation', 'insertLink'].includes(type)) {
        e.preventDefault();
      }
    });
    doc.addEventListener('input', (e) => {
      if (composing) return;
      if (e.inputType === 'insertParagraph') dropEmptyLists(env);
      commit('vis-type', TYPING.test(e.inputType));
    });
    doc.addEventListener('compositionstart', () => { composing = true; });
    doc.addEventListener('compositionend', () => { composing = false; commit('vis-type', true); });
    doc.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain');
      if (text) run(() => insertPlainText(env, text.slice(0, 200000)));
    });
    for (const event of ['dragover', 'drop', 'dragstart']) doc.addEventListener(event, (e) => e.preventDefault());
    doc.addEventListener('click', (e) => { if (e.target.closest('a, area, button, input, select')) e.preventDefault(); });
    doc.addEventListener('keydown', (e) => {
      if (historyKey(e) || actions.shortcut(e)) return;
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && stepCell(doc, e.shiftKey)) e.preventDefault();
      const inline = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()];
      if (inline && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        run(() => toggleInline(env, inline));
      }
    });
    doc.addEventListener('selectionchange', () => {
      if (document.activeElement === frame) selection = capture();
      updateTools();
    });
    render();
  }

  frame.addEventListener('load', wire);
  wire();
  els.pageTitle.addEventListener('change', () => editTitle(keptTitle !== null));  // a kept title stays kept
  // Where the title cannot be written from here, the field is read-only from the start and says why.
  els.pageTitle.addEventListener('focus', () => {
    const writable = current() && titledSource((title ? title + ' ' : '') + 'x') !== null;
    els.pageTitle.readOnly = !writable;
    if (!writable && current()) actions.message('Den Titel dieser Seite kannst du nur links im HTML-Code im Tag <title> ändern.', true);
  });
  els.pageTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); keptTitle = null; els.pageTitle.value = title; e.target.blur(); }  // back to the page's title
  });
  for (const button of buttons) {
    button.addEventListener('pointerdown', (e) => e.preventDefault());
    button.addEventListener('click', () => doCommand(button.dataset.edit, capture() || selection));
  }
  for (const [select, command] of [[els.visualAlign, setAlign], [els.visualColor, setColor]]) {
    select.addEventListener('pointerdown', () => { selection = capture() || selection; });
    select.addEventListener('change', () => {
      if (select.value) run(() => command(env, select.value), capture() || selection);
      select.selectedIndex = 0;
    });
  }

  // Applies a page-side edit that is still open: a title typed but not yet confirmed, or a composition
  // (IME or dead key) not yet finished. Called before every decision about saving or closing.
  // Returns false if an open edit could not be applied; the caller then stops and the edit is kept.
  function flush() {
    let ok = true;
    if (els.pageTitle.value.replace(/\s+/g, ' ').trim() !== title) ok = editTitle(true) && ok;
    if (composing) { composing = false; ok = commit('vis-type', true) && ok; }
    return ok;
  }

  return {
    get editing() { return editing; },
    flush,
    disable() { failed = true; render(); },
    refresh() { render(); },
    schedule() { clearTimeout(timer); timer = setTimeout(render, 200); },
  };
}
