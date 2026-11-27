// The code field: a text area with line numbers and syntax colours behind it, one undo/redo history,
// automatic indentation on Enter and search. The colouring and the history are the tested modules of the
// single-file editor (shared/).
import { tokenize } from './shared/tokenizer.js';
import { highlightLines, patchLines } from './shared/highlight.js';
import { createHistory } from './shared/history.js';
import { mapOffset } from './shared/util.js';

const HIGHLIGHT_LIMIT = 1500000;
const LINE_HEIGHT = 20, FONT_SIZE = 14, GUTTER = 46;  // at 100 %; the code zoom scales them (setZoom)
const HISTORY_CHARS = 40 * 1024 * 1024;

export function createCodeEditor(els, onChange) {
  const ta = els.src;
  const history = createHistory(HISTORY_CHARS);
  const hlState = {};
  let text = '', lineStarts = [0], lineCount = 0, plain = false, charWidth = 0;
  let lineHeight = LINE_HEIGHT;  // pixels per line at the current zoom
  // The line breaks of the open file (breaks.js). The history stores raw texts (every break as it stands
  // in the file), so each undo step brings back its own breaks.
  let breaks = null;
  const rawNow = () => (breaks ? breaks.raw : text);

  function syncScroll() {
    els.hlIn.style.transform = 'translate(' + -ta.scrollLeft + 'px,' + -ta.scrollTop + 'px)';
    if (els.marksIn) els.marksIn.style.transform = els.hlIn.style.transform;
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
    if (hits.query || source) drawHits();
  }

  // ---- marks behind the text. Search hits (wish W13): while the search field has the focus, the selection of the
  // text area is not seen, so every hit is marked, the current one strongly. The place of the page (wish W8): what
  // is marked or clicked in the page is marked in the code, without taking the focus from the page.
  const MAX_HITS = 10000, MAX_MARKS = 2000, MAX_SOURCE_LINES = 400;
  const hits = { query: '', list: [], now: -1 };
  let source = null;  // [from, to] of the place in the page, or null
  function findAll(query) {
    const out = [];
    if (!query) return out;
    const hay = text.toLowerCase(), q = query.toLowerCase();
    for (let i = hay.indexOf(q); i >= 0 && out.length < MAX_HITS; i = hay.indexOf(q, i + 1)) out.push(i);
    return out;
  }
  // The x position of an offset in its line, as the text area draws it (tabs two columns wide).
  let measure = null;
  function xOf(line, offset) {
    if (!measure) { measure = document.createElement('canvas').getContext('2d'); measure.font = getComputedStyle(ta).font; }
    let col = '';
    for (const ch of text.slice(lineStarts[line], offset)) col += ch === '\t' ? ' '.repeat(2 - (col.length % 2)) : ch;
    return measure.measureText(col).width;
  }
  function mark(line, from, to, cls) {
    const i = document.createElement('i'), x = xOf(line, from);
    i.style.left = x + 'px';
    i.style.top = line * lineHeight + 'px';
    i.style.width = Math.max(3, xOf(line, to) - x) + 'px';
    if (cls) i.className = cls;
    return i;
  }
  function drawHits() {
    const marks = [];
    if (source && source[1] <= text.length) {
      const [a, b] = source, first = lineIndexOf(a), last = Math.min(lineIndexOf(b), first + MAX_SOURCE_LINES);
      for (let line = first; line <= last; line++) {
        const end = (lineStarts[line + 1] ?? text.length + 1) - 1;
        marks.push(mark(line, line === first ? a : lineStarts[line], line === lineIndexOf(b) ? b : end + 1, 'src'));
      }
    }
    if (hits.query) hits.list = findAll(hits.query);
    const n = hits.query.toLowerCase().length;
    for (let k = 0; k < hits.list.length && marks.length < MAX_MARKS; k++) {
      const a = hits.list[k], line = lineIndexOf(a);
      if (a + n > (lineStarts[line + 1] ?? text.length + 1)) continue;  // a hit across a line break is not drawn
      marks.push(mark(line, a, a + n, a === hits.now ? 'now' : ''));
    }
    els.marksIn?.replaceChildren(...marks);
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
    const line = lineIndexOf(a), y = line * lineHeight, view = ta.clientHeight;
    if (y < ta.scrollTop || y > ta.scrollTop + view - 2 * lineHeight) ta.scrollTop = Math.max(0, y - view / 3);
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
      const q = (query || '').toLowerCase();
      const found = findAll(query);
      if (!found.length) { api.markHits(query, -1); return { index: 0, count: 0 }; }
      let k;
      if (dir > 0) {
        const from = ta.selectionStart === ta.selectionEnd ? ta.selectionStart : ta.selectionStart + 1;
        k = found.findIndex((h) => h >= from);
        if (k < 0) k = 0;
      }
      else { k = -1; for (let j = found.length - 1; j >= 0; j--) if (found[j] < ta.selectionStart) { k = j; break; } if (k < 0) k = found.length - 1; }
      ta.setSelectionRange(found[k], found[k] + q.length);
      reveal(found[k], found[k] + q.length);
      showPosition();
      api.markHits(query, found[k]);
      return { index: k + 1, count: found.length };
    },
    // Marks every hit of `query` in the code ('' clears), `now`: the offset of the current hit (-1: none).
    markHits(query, now) {
      hits.query = query || '';
      hits.now = now;
      if (!hits.query) { hits.list = []; els.marksIn?.replaceChildren(); return; }
      drawHits();
    },
    caretOffset: () => ta.selectionStart,
    // The selection of the code, and setting it back (a modal dialog puts the caret of the text area to its
    // start when it gives the focus back).
    get selection() { return [ta.selectionStart, ta.selectionEnd]; },
    select(range) {
      const a = Math.min(range[0], text.length), b = Math.min(range[1], text.length);
      ta.setSelectionRange(a, b);
    },
    // Marks [from, to) of the code as the place of the page (null clears) and scrolls it into view. The focus
    // and the caret of the code stay as they are.
    markSource(range) {
      source = range && range[1] >= range[0] ? [range[0], range[1]] : null;
      drawHits();
      if (source) reveal(source[0], source[0] === source[1] ? source[0] : Math.min(source[1], lineStarts[lineIndexOf(source[0]) + 1] ?? source[1]));
    },
    get sourceMark() { return source; },
    // Display zoom of the code in percent: font, line height and the line numbers grow together. Only the look
    // changes; the text, its breaks and the caret stay.
    setZoom(percent) {
      const z = percent / 100;
      lineHeight = Math.round(LINE_HEIGHT * z);
      els.srcBox.style.setProperty('--code-size', Math.round(FONT_SIZE * z * 10) / 10 + 'px');
      els.srcBox.style.setProperty('--code-line', lineHeight + 'px');
      els.srcBox.style.setProperty('--gutter', Math.round(GUTTER * Math.max(1, z)) + 'px');
      charWidth = 0;
      measure = null;
      render();
      reveal(ta.selectionStart, ta.selectionEnd);
    },
  };
  return api;
}
