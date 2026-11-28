import { analyze, previewPosOf, renderView, srcElementRange, srcOffsetOf } from './shared/project.js';
import { rescueHidden, serializeBody } from './shared/serialize.js';
import { tokenize } from './shared/tokenizer.js';
import { withTitle } from './shared/format.js';
import {
  blockOf, caretState, closestTag, dropEmptyLists, getRange, insertImage, insertLink, insertPlainText, insertTable,
  isEditableAt, linkProblem, removeLinks, setAlign, setBlock, setColor, stepCell, tableAt, toggleInline, toggleList, changeImage,
} from './shared/commands.js';

const PROJECT_ORIGIN = 'https://projekt.example';
const FRAME_URL = 'https://app.example/edit-frame.html';
const INLINE = ['bold', 'italic', 'underline', 'sup', 'sub', 'mark'];
const TYPING = /^insert(?:Text|CompositionText|Paragraph|LineBreak|ReplacementText)$/;
const ALIGN = ['left', 'center', 'right', 'justify'];
const SEEN = 'img, svg, video, audio, iframe, object, embed, input, select, textarea, button, hr, [data-se-box]';
const LINK = new Set(['a']);
// A colour of the palette's grid or of the colour dialog, as the editor writes it (see keepHexColors).
const HEX_COLOR = /^color: #[0-9a-f]{6}$/;
// The size of a new picture in percent of the width, as the size step writes it (see insertPicture).
const PERCENT_WIDTH = /^width: (?:100|[1-9][0-9]?)%$/;
const PICKED = 'data-se-picked';  // marks a picture or table chosen as a whole (never written: data-se-*)
// What the pupil is told when a command did not do all it was asked to (run()).
const NOTES = {
  strong: 'Erledigt. Eine Regel deiner Seite mit „!important“ kann diese Ausrichtung aber überschreiben.',
  odd: 'Das style-Attribut an dieser Stelle kann der Editor nicht sicher ändern. Ändere es links im HTML-Code.',
  part: 'Die Farbe gehört zu einem größeren Teil deiner Seite. Markiere den ganzen Teil, oder ändere sie links im HTML-Code.',
  intable: 'In eine Tabelle kann keine zweite Tabelle.',
  inlink: 'Hier ist schon ein Link. Entferne ihn zuerst mit „Link entfernen“.',
  multi: 'Ein Link geht nur innerhalb eines Absatzes.',
};

export function createVisualEditor(els, editor, actions) {
  const frame = els.visualFrame;
  const info = new WeakMap();
  const env = { get doc() { return doc; }, get src() { return view.src; }, info };
  const buttons = Array.from(els.visualCommands.querySelectorAll('[data-edit]'));
  let doc, view, owner, base, title = '', composing = false, editing = false, failed = false, timer = 0;
  let selection;
  let inputKind = null;  // the undo kind of a browser edit that a toolbar button started (see lineBreak)
  let color = 'red';  // the colour of the "A" button: the one chosen last in the palette
  let picked = null;  // a picture or a table chosen as a whole (wishes W9, W12), or null
  let zoom = 100;     // display zoom of the page in percent (wish W2); never part of the code
  let keptTitle = null;  // a typed title that could not be applied; it stays until applied or reset with Esc

  function projectUrl(address) {
    if (!base || !address || /[\\\u0000-\u001f]/.test(address)) return '';
    try {
      const url = new URL(address, base.href);
      return url.origin === PROJECT_ORIGIN && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function updateTools() {
    // The toolbar stays in the header; while the page cannot be edited here its controls are off.
    els.visualTools.classList.toggle('off', !editing);
    els.pageTitle.disabled = !editing;
    for (const b of buttons) b.disabled = !editing;
    els.bColorMenu.disabled = !editing;
    if (els.bPickTable) els.bPickTable.hidden = !(editing && tableAt(doc));
    frame.hidden = !editing;
    els.visualHint.textContent = editing ? 'Hier kannst du schreiben.' : actions.document() ? 'Bearbeite den HTML-Code links.' : '';
    if (document.activeElement !== els.pageTitle) els.pageTitle.value = keptTitle ?? title;
    const s = editing ? caretState(doc) : {};
    for (const b of buttons) {
      const key = b.dataset.edit;
      if (key.startsWith('align-')) b.setAttribute('aria-pressed', String(s.align === key.slice(6)));
      else if (!['link', 'unlink', 'image', 'table', 'br', 'color'].includes(key)) {
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
      picked = null;
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
          if (picked) { if (picked.isConnected) picked.setAttribute(PICKED, ''); else picked = null; }
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

  // A remembered place in the page is valid only for the page as it is now shown (an undo step rebuilds it).
  const placeValid = (saved) => !!saved && current() && saved.owner === owner && saved.view === view && saved.path === owner.path
    && doc.body.contains(saved.range.startContainer) && doc.body.contains(saved.range.endContainer);

  function run(fn, saved = capture()) {
    if (!placeValid(saved)) {
      actions.message('Klicke zuerst in deiner Seite an die Stelle, die du bearbeiten möchtest.', true);
      return;
    }
    doc.defaultView.focus();
    doc.body.focus({ preventScroll: true });
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(saved.range);
    const before = doc.body.innerHTML;
    const result = fn(saved.range);
    if (result === 'input') return;  // a browser edit: its input event took it into the code
    // Whatever changed in the page goes into the code, also when a command did only part of its work
    // ('strong', 'part', 'odd'): the page and the code never differ.
    if (result === 'ok' || doc.body.innerHTML !== before) commit('cmd');
    if (NOTES[result]) actions.message(NOTES[result], true);
    else if (result && result !== 'ok' && result !== 'same') actions.message('Dieser Befehl passt hier nicht. Wähle eine andere Stelle.', true);
  }

  // A colour of the grid or of the colour dialog is a hex value. The shared writer keeps only palette names in
  // the style of a new element, so a new colour span with exactly such a value is marked like a copy of a
  // written element: its style is then written as it stands. Nothing else is marked.
  function keepHexColors() {
    for (const el of doc.body.querySelectorAll('span[style]')) {
      if (!info.has(el) && HEX_COLOR.test(el.getAttribute('style'))) info.set(el, { t: null, copy: true });
    }
  }

  // The text node at the start (end: at the end) of `block` if nothing is seen in front of (behind) it in the
  // block, or null. A line break behind the last text is not seen.
  function textAtEdge(block, end) {
    const walker = doc.createTreeWalker(block, 4 /* NodeFilter.SHOW_TEXT */);
    let node = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data) { node = n; if (!end) break; }
    if (!node) return null;
    const rest = doc.createRange();
    if (end) { rest.setStartAfter(node); rest.setEnd(block, block.childNodes.length); }
    else { rest.setStart(block, 0); rest.setEndBefore(node); }
    const part = rest.cloneContents();
    return part.textContent === '' && !part.querySelector(end ? SEEN : SEEN + ', br') ? node : null;
  }

  // ---- Enter or Shift+Enter at a space (B3). The engine keeps a space at the end of the first part as a
  // no-break space (&nbsp; in the code), or at the start of the second part. A split point needs no space. What
  // may go is decided before the input, at the place of the split, and only that is taken away afterwards: a
  // no-break space written in the code stays, and so does every space where the page keeps spaces (pre,
  // pre-wrap and the like). Review of alpha.20 by Codex (2026-11-28), finding 2.

  const NBSP = '\u00a0';
  const keepsSpaces = (el) => {
    const cs = el ? getComputedStyle(el) : null;
    return !!cs && (/^(?:pre|break-spaces)/.test(cs.whiteSpace) || /preserve|break-spaces/.test(cs.whiteSpaceCollapse || ''));
  };
  const srcCaret = () => { const r = getRange(doc); return r ? srcOffsetOf(view, info, r.startContainer, r.startOffset) : -1; };
  // A no-break space the code holds as written, not one the engine made while typing or splitting.
  function writtenNbsp(node, i, typedAt) {
    const inf = info.get(node);
    if (!inf || typeof inf.data !== 'string' || inf.data.length !== node.data.length || inf.data[i] !== NBSP) return false;
    return !(typedAt && i === typedAt.index);  // the space the pupil has just typed here
  }
  // How many spaces next to the caret may go: `back` before it, else after it. 0 if one of them is a written
  // no-break space, or if they belong to the indentation of the code (a line break next to them).
  function spacesAt(node, offset, back, typedAt) {
    if (!node || node.nodeType !== 3 || keepsSpaces(node.parentElement)) return 0;
    const d = node.data;
    let i = offset;
    if (back) while (i > 0 && (d[i - 1] === ' ' || d[i - 1] === NBSP)) i--;
    else while (i < d.length && (d[i] === ' ' || d[i] === NBSP)) i++;
    const [from, to] = back ? [i, offset] : [offset, i];
    if (from === to) return 0;
    const beyond = back ? d[from - 1] : d[to];
    if (beyond !== undefined && /[\t\n\r\f]/.test(beyond)) return 0;
    for (let k = from; k < to; k++) if (d[k] === NBSP && writtenNbsp(node, k, typedAt)) return 0;
    return to - from;
  }

  let splitPlan = null;  // { type, block, tail, head, text }: decided in beforeinput, carried out in input
  let typedSpace = null; // { text, at }: the source place right after a space the pupil typed in the page
  function planSplit(type) {
    splitPlan = null;
    const range = getRange(doc);
    if (!range || !range.collapsed) return;
    const c = range.startContainer, o = range.startOffset;
    const before = c.nodeType === 3 ? [c, o] : c.childNodes[o - 1]?.nodeType === 3 ? [c.childNodes[o - 1], c.childNodes[o - 1].data.length] : null;
    const after = c.nodeType === 3 ? [c, o] : c.childNodes[o]?.nodeType === 3 ? [c.childNodes[o], 0] : null;
    const block = blockOf(c, doc.body);
    if (block === doc.body || keepsSpaces(block)) return;
    const typed = typedSpace && typedSpace.text === editor.text && typedSpace.at === srcCaret() && before ? { index: before[1] - 1 } : null;
    const tail = before ? spacesAt(before[0], before[1], true, typed) : 0;
    const head = after ? spacesAt(after[0], after[1], false, null) : 0;
    if (tail || head) splitPlan = { type, block, tail, head, text: editor.text };
  }

  // Takes `count` spaces from the end (or start) of a text node, if they are there.
  function cut(node, count, end) {
    if (!node || node.nodeType !== 3 || !count) return;
    const d = node.data, part = end ? d.slice(d.length - count) : d.slice(0, count);
    if (part.length !== count || /[^ \u00a0]/.test(part)) return;
    node.data = end ? d.slice(0, d.length - count) : d.slice(count);
  }
  const keepVisible = (block) => { if (!block.textContent && !block.querySelector(SEEN + ', br')) block.append(doc.createElement('br')); };

  // After the input: only if the split happened where it was planned (the block of the caret was split into it
  // and the block behind it, or a line break stands at the caret in that block).
  function tidySplit(type) {
    const plan = splitPlan;
    splitPlan = null;
    if (!plan || plan.type !== type || plan.text !== editor.text || !plan.block.isConnected) return;
    const range = getRange(doc);
    if (!range || !range.collapsed) return;
    if (type === 'insertParagraph') {
      const block = blockOf(range.startContainer, doc.body);
      if (block === doc.body || block === plan.block || block.previousElementSibling !== plan.block || !isEditableAt(block)) return;
      cut(textAtEdge(plan.block, true), plan.tail, true);
      cut(textAtEdge(block, false), plan.head, false);
      keepVisible(plan.block);
      keepVisible(block);
    } else {
      const { startContainer: c, startOffset: o } = range;
      const br = c.nodeType === 3 ? (o === 0 ? c.previousSibling : null) : c.childNodes[o - 1];
      if (!br || br.nodeType !== 1 || br.localName !== 'br' || blockOf(br, doc.body) !== plan.block) return;
      cut(br.previousSibling, plan.tail, true);
      cut(br.nextSibling, plan.head, false);
    }
  }

  // Enter at the end of a link: the new paragraph is not part of the link. The caret goes behind the link
  // first (the browser would carry the link on), and links without text that the browser made in the new
  // paragraph go, keeping what is in them.
  function leaveLink() {
    const range = getRange(doc);
    if (!range || !range.collapsed) return;
    let a = closestTag(range.startContainer, doc.body, LINK);
    if (!a || !a.isContentEditable) return;
    for (let up = closestTag(a.parentNode, doc.body, LINK); up; up = closestTag(up.parentNode, doc.body, LINK)) a = up;
    const rest = doc.createRange();
    rest.setStart(range.startContainer, range.startOffset);
    rest.setEnd(a, a.childNodes.length);
    const part = rest.cloneContents();
    if (part.textContent !== '' || part.querySelector(SEEN)) return;  // not at the end of the link
    const sel = doc.getSelection();
    const after = doc.createRange();
    after.setStartAfter(a);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
  }

  function dropEmptyLinks() {
    const range = getRange(doc);
    if (!range) return;
    const block = blockOf(range.startContainer, doc.body);
    if (block === doc.body) return;
    for (const a of Array.from(block.querySelectorAll('a'))) {
      if (info.has(a) || a.textContent !== '' || a.querySelector(SEEN)) continue;  // only what the browser just made
      const keep = saveCaret();
      while (a.firstChild) a.parentNode.insertBefore(a.firstChild, a);
      a.remove();
      restoreCaret(keep);
    }
  }

  const saveCaret = () => { const r = getRange(doc); return r ? [r.startContainer, r.startOffset] : null; };
  function restoreCaret(keep) {
    if (!keep || !keep[0].isConnected) return;
    try { doc.getSelection().collapse(keep[0], Math.min(keep[1], keep[0].nodeType === 3 ? keep[0].data.length : keep[0].childNodes.length)); } catch { /* keep the browser's */ }
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
    else if (command.startsWith('align-') && ALIGN.includes(command.slice(6))) run(() => setAlign(env, command.slice(6)), saved);
    else if (command === 'br') run(() => lineBreak(), saved);
    else if (command === 'color' || command === 'color-set' || command === 'color-remove') {
      run(() => { const r = setColor(env, command === 'color-remove' ? '' : color); keepHexColors(); return r; }, saved);
    }
    else if (command === 'image') {
      actions.picture((src, size) => run((range) => insertPicture(range, src, size), saved));
    } else if (command === 'link') {
      const value = await actions.fields('Link einfügen', [
        { label: 'Adresse', value: '' },
        { label: 'In neuem Fenster öffnen', check: true },
        { label: 'Das ist eine E-Mail-Adresse', check: true },
      ]);
      if (!value) return;
      const [typed, newTab, mail] = value;
      const href = linkAddress(typed, mail);
      if (href) run((range) => linkProblem(doc, range) || insertLink(env, range, href, '', newTab), saved);
      else actions.message(mail ? 'Die E-Mail-Adresse ist ungültig. Sie sieht so aus: name@example.de' : 'Die Link-Adresse ist ungültig.', true);
    } else if (command === 'table') {
      const value = await actions.fields('Tabelle einfügen', [{ label: 'Zeilen', value: '3' }, { label: 'Spalten', value: '2' }]);
      if (!value) return;
      const [rows, cols] = value.map(Number);
      if (Number.isInteger(rows) && Number.isInteger(cols) && rows > 0 && rows <= 25 && cols > 0 && cols <= 12) {
        run((range) => insertTable(env, range, { rows, cols, head: true, border: true }), saved);
      } else actions.message('Wähle 1 bis 25 Zeilen und 1 bis 12 Spalten.', true);
    }
  }

  // The address for a new link, or '' if it is not valid. An e-mail address gets "mailto:" in front.
  function linkAddress(typed, mail) {
    const href = String(typed).trim();
    if (mail) {
      const address = href.replace(/^mailto:/i, '');
      return /^[^\s@:/\\?#"<>]+@[^\s@:/\\?#"<>]+\.[^\s@:/\\?#"<>]+$/.test(address) ? 'mailto:' + address : '';
    }
    return href && /^(?:(?:https?|mailto):|[^:/\\\s]+(?:[/?#]|$)|[#./?])/i.test(href) && !/[\u0000-\u0020\u007f]/.test(href) ? href : '';
  }

  // "Zeilenumbruch": a <br> at the caret, exactly as Shift+Enter makes it, as a step of its own.
  function lineBreak() {
    inputKind = 'cmd';
    planSplit('insertLineBreak');  // execCommand may not send beforeinput
    try { doc.execCommand('insertLineBreak'); } finally { inputKind = null; }
    return 'input';
  }

  // A new picture at `range`, with the size of the size step (wish W10): { width, height } in pixels, or
  // { percent } of the width. A size in percent is a style, which the shared writer keeps only for an element
  // marked like a copy; only exactly "width: N%" is marked so.
  function insertPicture(range, src, size) {
    const result = insertImage(env, range, { src, url: projectUrl(src), alt: '', width: size?.width ? String(size.width) : '' });
    const sel = doc.getSelection();
    const img = sel.anchorNode?.childNodes?.[sel.anchorOffset - 1];
    if (img && img.localName === 'img' && size) {
      if (size.height) img.setAttribute('height', String(size.height));
      if (size.percent) {
        const style = 'width: ' + size.percent + '%';
        if (PERCENT_WIDTH.test(style)) { img.setAttribute('style', style); info.set(img, { t: null, copy: true }); }
      }
    }
    return result;
  }

  // ---- a picture or a table as a whole (wishes W9, W12)

  // True if the selection of the page is exactly `el`.
  function selectsExactly(el) {
    const r = getRange(doc);
    if (!r || !el.parentNode || r.startContainer !== el.parentNode || r.endContainer !== el.parentNode) return false;
    const i = Array.prototype.indexOf.call(el.parentNode.childNodes, el);
    return r.startOffset === i && r.endOffset === i + 1;
  }
  function unpick() {
    if (picked) picked.removeAttribute(PICKED);
    picked = null;
  }
  // Chooses a picture or a table as a whole: it is selected and outlined, and its code is marked.
  function pick(el) {
    if (!current() || !el.isConnected || !isEditableAt(el.parentNode)) return false;
    unpick();
    picked = el;
    el.setAttribute(PICKED, '');
    const r = doc.createRange();
    r.selectNode(el);
    const sel = doc.getSelection();
    sel.removeAllRanges();
    sel.addRange(r);
    selection = capture();
    showSource();
    return true;
  }

  // Takes a chosen picture or table out of the page, with the line break in front of it when it stands on a
  // line of its own (as commands.js does for rows), so no empty line stays in the code.
  function removePicked() {
    const el = picked;
    if (!el || !el.isConnected) return 'none';
    const blank = (n) => !!n && n.nodeType === 3 && !/[^ \t\n\f\r]/.test(n.data);
    const prev = el.previousSibling, next = el.nextSibling, parent = el.parentNode;
    if (blank(prev) && (blank(next) || !next)) {
      const inf = info.get(prev);
      if (inf && inf.t) inf.t.dropped = true;
      prev.remove();
    }
    unpick();
    el.remove();
    if (parent !== doc.body && !parent.textContent && !parent.querySelector(SEEN + ', br')) parent.append(doc.createElement('br'));
    return 'ok';
  }

  // Double click on a picture: "Bild einfügen" chooses another file for it; size, alt text and every other
  // attribute stay.
  function replacePicture(img) {
    if (!pick(img)) return;
    const saved = capture();
    actions.picture((src) => run(() => (img.isConnected ? changeImage(env, img, { src, url: projectUrl(src) }) : 'none'), saved), { size: false });
  }

  // ---- the place of the page in the code (wish W8)

  // Marks in the code what is marked in the page: a selection from its start to its end; a caret, a picture or
  // a table as the whole element around it. The focus stays in the page.
  function showSource() {
    if (!current() || composing) return;
    const sel = doc.getSelection();
    if (!sel || !sel.rangeCount || !doc.body.contains(sel.anchorNode) || !doc.body.contains(sel.focusNode)) return;
    let range;
    if (picked) range = srcElementRange(info, doc.body, picked);
    else if (sel.isCollapsed) range = srcElementRange(info, doc.body, sel.anchorNode);
    else {
      const a = srcOffsetOf(view, info, sel.anchorNode, sel.anchorOffset), b = srcOffsetOf(view, info, sel.focusNode, sel.focusOffset);
      range = [Math.min(a, b), Math.max(a, b)];
    }
    actions.markSource?.(range);
  }

  // ---- display zoom of the page (wish W2): a style of the edit frame, outside the body, so never in the code

  function applyZoom() {
    if (!doc) return;
    let st = doc.getElementById('se-zoom');
    if (zoom === 100) { st?.remove(); return; }
    if (!st) { st = doc.createElement('style'); st.id = 'se-zoom'; doc.head.prepend(st); }
    st.textContent = ':root:root:root { zoom: ' + zoom / 100 + '; }';
  }

  // One undo or redo step for the page: the caret goes to where the step changed the text, so the next action
  // (typing, "Bild einfügen") happens there.
  function historyStep(undo) {
    const before = editor.text;
    if (undo) editor.undo(); else editor.redo();
    const after = editor.text;
    if (after === before) { render(); return; }
    const n = Math.min(before.length, after.length);
    let i = 0;
    while (i < n && before.charCodeAt(i) === after.charCodeAt(i)) i++;
    let j = 0;
    while (j < n - i && before.charCodeAt(before.length - 1 - j) === after.charCodeAt(after.length - 1 - j)) j++;
    const pos = after.length - j;
    render([pos, pos]);
  }

  function historyKey(e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.isComposing) return false;
    const key = e.key.toLowerCase();
    if (key !== 'z' && key !== 'y') return false;
    e.preventDefault();
    historyStep(!(key === 'y' || e.shiftKey));
    return true;
  }

  function wire() {
    if (frame.contentWindow?.location.href !== FRAME_URL || doc === frame.contentDocument) return;
    doc = frame.contentDocument;
    base = doc.createElement('base');
    doc.head.append(base);
    try { doc.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* browser default */ }
    applyZoom();
    // Ctrl+wheel in the page zooms the page (the wheel of a frame does not reach the interface)
    doc.addEventListener('wheel', (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      if (e.deltaY) actions.zoom?.('page', e.deltaY < 0 ? 1 : -1);
    }, { passive: false });
    doc.addEventListener('pointerdown', () => { actions.focused?.(); if (!current()) render(); }, true);
    // A click below the page's content (the body is only as tall as its content, as in the browser) puts the
    // caret at the end of the page's text.
    doc.addEventListener('pointerdown', (e) => {
      if (e.target !== doc.documentElement || !current()) return;
      e.preventDefault();
      // the end of the last text that is shown and can be edited (not a hidden paragraph, not a locked box)
      const walker = doc.createTreeWalker(doc.body, 4 /* NodeFilter.SHOW_TEXT */);
      const probe = doc.createRange();
      let last = null;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.data.trim() || !isEditableAt(n)) continue;
        probe.selectNodeContents(n);
        if (probe.getClientRects().length) last = n;
      }
      const range = doc.createRange();
      if (last) range.setStart(last, last.data.length);
      else if (!doc.body.textContent.trim() && !doc.body.querySelector('img, [data-se-box]')) range.setStart(doc.body, doc.body.childNodes.length);
      else { actions.message('Klicke direkt in einen Text deiner Seite.', true); return; }
      range.collapse(true);
      doc.body.focus({ preventScroll: true });
      const sel = doc.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    doc.addEventListener('focusin', () => actions.focused?.());
    doc.addEventListener('beforeinput', (e) => {
      const type = e.inputType;
      if (!current()) { e.preventDefault(); render(); return; }
      if (type === 'historyUndo' || type === 'historyRedo') {
        e.preventDefault();
        historyStep(type === 'historyUndo');
      } else if (type.startsWith('format') || ['insertFromDrop', 'insertFromPaste', 'insertFromPasteAsQuotation', 'insertLink'].includes(type)) {
        e.preventDefault();
      } else if (type === 'insertParagraph' || type === 'insertLineBreak') {
        if (type === 'insertParagraph') leaveLink();
        planSplit(type);
      }
    });
    doc.addEventListener('input', (e) => {
      if (composing) return;
      if (e.inputType === 'insertParagraph') { dropEmptyLists(env); dropEmptyLinks(); }
      if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') tidySplit(e.inputType);
      commit(inputKind || 'vis-type', TYPING.test(e.inputType));
      // a space typed in the page: Enter right after it may take it away (see planSplit)
      typedSpace = e.inputType === 'insertText' && (e.data === ' ' || e.data === NBSP) && current() ? { text: editor.text, at: srcCaret() } : null;
    });
    doc.addEventListener('compositionstart', () => { composing = true; });
    doc.addEventListener('compositionend', () => { composing = false; commit('vis-type', true); });
    doc.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = e.clipboardData?.getData('text/plain');
      if (text) run(() => insertPlainText(env, text.slice(0, 200000)));
    });
    for (const event of ['dragover', 'drop', 'dragstart']) doc.addEventListener(event, (e) => e.preventDefault());
    doc.addEventListener('click', (e) => {
      if (e.target.closest('a, area, button, input, select')) e.preventDefault();
      // a click on a picture chooses it; a click on the frame of a table (not into a cell) chooses the table
      const t = e.target;
      if (t.localName === 'img') pick(t);
      else if (['table', 'tbody', 'thead', 'tfoot', 'tr'].includes(t.localName)) { const table = t.closest('table'); if (table) pick(table); }
    });
    doc.addEventListener('dblclick', (e) => { if (e.target.localName === 'img' && current()) { e.preventDefault(); replacePicture(e.target); } });
    doc.addEventListener('keydown', (e) => {
      if (historyKey(e) || actions.shortcut(e)) return;
      // Delete or Backspace with a chosen picture or table takes it out at once (undo brings it back)
      if ((e.key === 'Delete' || e.key === 'Backspace') && picked && !e.ctrlKey && !e.altKey && !e.metaKey && selectsExactly(picked)) {
        e.preventDefault();
        run(() => removePicked());
        return;
      }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey && stepCell(doc, e.shiftKey)) e.preventDefault();
      const inline = { b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()];
      if (inline && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        run(() => toggleInline(env, inline));
      }
    });
    doc.addEventListener('selectionchange', () => {
      if (picked && (!picked.isConnected || !selectsExactly(picked))) unpick();
      if (document.activeElement === frame) {
        selection = capture();
        showSource();
      }
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
  els.bColorMenu.addEventListener('pointerdown', () => { selection = capture() || selection; });

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
    history: historyStep,
    // Runs a toolbar command at the last place in the page (used by "Bild einfügen" in the header).
    // The place is checked first, so no file dialog opens for a place that is no longer valid.
    command(name) {
      const saved = capture() || selection;
      if (!placeValid(saved)) { actions.message('Klicke zuerst in deiner Seite an die Stelle, an die das Bild soll.', true); return; }
      doCommand(name, saved);
    },
    // A colour from the palette ('' removes the colour) at the last place in the page; it becomes the colour
    // of the "A" button.
    applyColor(value) {
      if (value) color = value;
      doCommand('color-' + (value ? 'set' : 'remove'), capture() || selection);
    },
    // Chooses the table with the caret as a whole ("Tabelle markieren"); Delete then takes it out.
    pickTable() {
      const at = current() && tableAt(doc);
      if (!at) { actions.message('Klicke zuerst in eine Tabelle deiner Seite.', true); return; }
      doc.defaultView.focus();
      doc.body.focus({ preventScroll: true });
      pick(at.table);
      actions.message('Die Tabelle ist markiert. Mit Entf löschst du sie; Rückgängig holt sie zurück.');
    },
    get inTable() { return editing && !!tableAt(doc); },
    setZoom(percent) { zoom = percent; applyZoom(); },
    disable() { failed = true; render(); },
    refresh() { render(); },
    schedule() { clearTimeout(timer); timer = setTimeout(render, 200); },
  };
}
