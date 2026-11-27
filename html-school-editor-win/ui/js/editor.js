// The code field: a text area with line numbers and syntax colours behind it, one undo/redo history,
// automatic indentation on Enter and search. The colouring and the history are the tested modules of the
// single-file editor (shared/).
import { tokenize } from './shared/tokenizer.js';
import { highlightLines, patchLines } from './shared/highlight.js';
import { createHistory } from './shared/history.js';
import { mapOffset } from './shared/util.js';

const HIGHLIGHT_LIMIT = 1500000;
const LINE_HEIGHT = 20;
const HISTORY_CHARS = 40 * 1024 * 1024;

export function createCodeEditor(els, onChange) {
  const ta = els.src;
  const history = createHistory(HISTORY_CHARS);
  const hlState = {};
  let text = '', lineStarts = [0], lineCount = 0, plain = false, charWidth = 0;
  // The line breaks of the open file (breaks.js). The history stores raw texts (every break as it stands
  // in the file), so each undo step brings back its own breaks.
  let breaks = null;
  const rawNow = () => (breaks ? breaks.raw : text);

  function syncScroll() {
    els.hlIn.style.transform = 'translate(' + -ta.scrollLeft + 'px,' + -ta.scrollTop + 'px)';
    els.gutterIn.style.transform = 'translateY(' + -ta.scrollTop + 'px)';
  }

  function render() {
    const starts = [0];
    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
    lineStarts = starts;
    const p = text.length > HIGHLIGHT_LIMIT;
    if (p !== plain) { plain = p; els.srcBox.classList.toggle('plain', p); }
    if (!plain) patchLines(els.hlIn, hlState, highlightLines(text, tokenize(text)));
    if (starts.length !== lineCount) {
      lineCount = starts.length;
      let s = '';
      for (let i = 1; i <= lineCount; i++) s += i + '\n';
      els.gutterIn.textContent = s;
    }
    syncScroll();
    showPosition();
  }

  function lineIndexOf(offset) {
    let lo = 0, hi = lineStarts.length - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
    return lo;
  }

  function showPosition() {
    if (!els.pos) return;
    const pos = ta.selectionStart, line = lineIndexOf(pos);
    els.pos.textContent = text ? 'Zeile ' + (line + 1) + ', Spalte ' + (pos - lineStarts[line] + 1) : '';
  }

  // The text area's own value changed (typing, paste, cut, drop).
  function took(kind) {
    if (ta.value === text) { showPosition(); return; }
    text = ta.value;
    if (breaks) breaks.follow(text);
    history.record(rawNow(), kind, Date.now());
    render();
    onChange(text);
  }

  // Replaces the range [a, b) as one step of the history and puts the caret at `caret` (absolute offset).
  function replaceRange(a, b, insert, selStart, selEnd) {
    history.seal();
    ta.focus();
    ta.setRangeText(insert, a, b, 'end');
    if (selStart !== undefined) ta.setSelectionRange(selStart, selEnd ?? selStart);
    took('src-edit');
    history.seal();
    reveal(ta.selectionStart, ta.selectionEnd);
  }

  function setValue(newText, keepCaret) {
    const a = ta.selectionStart, b = ta.selectionEnd, top = ta.scrollTop, left = ta.scrollLeft;
    const old = text;
    text = newText;
    ta.value = newText;
    if (keepCaret) {
      ta.setSelectionRange(mapOffset(old, newText, a), mapOffset(old, newText, b));
      ta.scrollTop = top;
      ta.scrollLeft = left;
    } else {
      ta.setSelectionRange(0, 0);
      ta.scrollTop = 0;
      ta.scrollLeft = 0;
    }
    render();
  }

  function measureChar() {
    if (charWidth) return charWidth;
    const c = document.createElement('canvas').getContext('2d');
    c.font = getComputedStyle(ta).font;
    charWidth = c.measureText('0000000000').width / 10 || 8;
    return charWidth;
  }

  // Scrolls so that the range is visible.
  function reveal(a, b) {
    const line = lineIndexOf(a), y = line * LINE_HEIGHT, view = ta.clientHeight;
    if (y < ta.scrollTop || y > ta.scrollTop + view - 2 * LINE_HEIGHT) ta.scrollTop = Math.max(0, y - view / 3);
    const xa = (a - lineStarts[line]) * measureChar(), xb = (b - lineStarts[lineIndexOf(b)]) * measureChar(), w = ta.clientWidth - 40;
    if (xa < ta.scrollLeft || xb > ta.scrollLeft + w) ta.scrollLeft = Math.max(0, xa - w / 3);
    syncScroll();
  }

  function applyHistory(entry) {
    if (!entry) return;
    if (breaks) breaks.restore(entry.text);
    setValue(breaks ? breaks.text : entry.text, true);
    onChange(text);
  }

  ta.addEventListener('input', () => took('src-type'));
  ta.addEventListener('scroll', syncScroll);
  ta.addEventListener('select', showPosition);
  ta.addEventListener('keyup', showPosition);
  ta.addEventListener('click', showPosition);
  ta.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo') { e.preventDefault(); api.undo(); }
    else if (e.inputType === 'historyRedo') { e.preventDefault(); api.redo(); }
  });
  ta.addEventListener('keydown', (e) => {
    if (ta.readOnly) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();
    if (ctrl && !e.altKey && key === 'z') { e.preventDefault(); if (e.shiftKey) api.redo(); else api.undo(); return; }
    if (ctrl && !e.altKey && key === 'y') { e.preventDefault(); api.redo(); return; }
    if (e.key === 'Tab' && !ctrl && !e.altKey) {
      e.preventDefault();
      if (e.shiftKey) {
        const line = lineIndexOf(ta.selectionStart), start = lineStarts[line];
        const lead = /^ {1,2}/.exec(text.slice(start, start + 2));
        if (lead) replaceRange(start, start + lead[0].length, '', Math.max(start, ta.selectionStart - lead[0].length));
      } else {
        replaceRange(ta.selectionStart, ta.selectionEnd, '  ');
      }
      return;
    }
    if (e.key === 'Enter' && !ctrl && !e.altKey && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      const pos = ta.selectionStart, start = lineStarts[lineIndexOf(pos)];
      const indent = /^[ \t]*/.exec(text.slice(start, pos))[0];
      replaceRange(pos, ta.selectionEnd, '\n' + indent);
    }
  });

  const api = {
    get text() { return text; },
    // The text with every line break as it stands in the file (breaks.js), for saving.
    get raw() { return rawNow(); },
    // A new document: new history, caret at the start. `lineBreaks`: from createBreaks for `newText`.
    load(newText, lineBreaks) {
      if (lineBreaks && lineBreaks.text !== newText) throw new Error('line breaks of another text');
      breaks = lineBreaks || null;
      ta.readOnly = false;
      setValue(newText, false);
      history.reset(rawNow());
      onChange(text);
    },
    clear() { breaks = null; ta.readOnly = true; setValue('', false); history.reset(''); },
    // Locked while another page is on its way: nothing typed now could be kept.
    setLocked(locked) { ta.readOnly = locked; },
    get locked() { return ta.readOnly; },
    focus() { ta.focus(); },
    undo() { if (!ta.readOnly) applyHistory(history.undo()); },
    redo() { if (!ta.readOnly) applyHistory(history.redo()); },
    canUndo: () => history.canUndo(),
    canRedo: () => history.canRedo(),
    editFromPage(newText, kind) {
      if (ta.readOnly || newText === text) return;
      if (kind === 'cmd') history.seal();
      setValue(newText, true);
      if (breaks) breaks.follow(text);
      history.record(rawNow(), kind, Date.now());
      if (kind === 'cmd') history.seal();
      onChange(text);
    },
    // Inserts at the caret; `select` = [from, to] inside the inserted text is selected afterwards.
    insert(str, select) {
      if (ta.readOnly) return;
      const a = ta.selectionStart;
      replaceRange(a, ta.selectionEnd, str, select ? a + select[0] : undefined, select ? a + select[1] : undefined);
    },
    gotoLine(n) {
      const i = Math.max(0, Math.min(lineStarts.length - 1, n - 1));
      ta.focus();
      ta.setSelectionRange(lineStarts[i], lineStarts[i]);
      reveal(lineStarts[i], lineStarts[i]);
      showPosition();
    },
    // Finds `query` (without case) from the selection on; dir 1 forward, -1 backward. Returns
    // { index, count } with index 0 if nothing is found.
    find(query, dir) {
      if (!query) return { index: 0, count: 0 };
      const hay = text.toLowerCase(), q = query.toLowerCase(), hits = [];
      for (let i = hay.indexOf(q); i >= 0 && hits.length < 10000; i = hay.indexOf(q, i + 1)) hits.push(i);
      if (!hits.length) return { index: 0, count: 0 };
      let k;
      if (dir > 0) {
        const from = ta.selectionStart === ta.selectionEnd ? ta.selectionStart : ta.selectionStart + 1;
        k = hits.findIndex((h) => h >= from);
        if (k < 0) k = 0;
      }
      else { k = -1; for (let j = hits.length - 1; j >= 0; j--) if (hits[j] < ta.selectionStart) { k = j; break; } if (k < 0) k = hits.length - 1; }
      ta.setSelectionRange(hits[k], hits[k] + q.length);
      reveal(hits[k], hits[k] + q.length);
      showPosition();
      return { index: k + 1, count: hits.length };
    },
    caretOffset: () => ta.selectionStart,
  };
  return api;
}
