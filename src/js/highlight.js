// Syntax colouring for the source pane: tokens -> one HTML string per source line. The strings only ever
// contain escaped source text inside <span class="…"> elements with fixed class names.
import { escapeText } from './util.js';

const ENTITY = /&(?:#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g;

export function highlightLines(src, tokens) {
  const lines = [];
  let line = '';
  const put = (cls, from, to) => {
    if (to <= from) return;
    let text = src.slice(from, to);
    for (;;) {
      const nl = text.indexOf('\n');
      const part = nl < 0 ? text : text.slice(0, nl);
      if (part) line += cls ? '<span class="' + cls + '">' + escapeText(part) + '</span>' : escapeText(part);
      if (nl < 0) break;
      lines.push(line);
      line = '';
      text = text.slice(nl + 1);
    }
  };
  for (const tok of tokens) {
    if (tok.type === 'text') {
      if (tok.raw === 'literal') { put('rw', tok.start, tok.end); continue; }
      let at = tok.start, m;
      const text = src.slice(tok.start, tok.end);
      if (text.indexOf('&') >= 0) {
        ENTITY.lastIndex = 0;
        while ((m = ENTITY.exec(text))) {
          put('', at, tok.start + m.index);
          at = tok.start + m.index + m[0].length;
          put('en', tok.start + m.index, at);
        }
      }
      put('', at, tok.end);
    } else if (tok.type === 'comment') put('cm', tok.start, tok.end);
    else if (tok.type === 'doctype') put('dt', tok.start, tok.end);
    else if (tok.type === 'start' || tok.type === 'end') {
      let at = tok.nameEnd;
      put('tg', tok.start, at);
      const a = tok.attrs;
      for (let i = 0; i < a.length; i += 4) {
        put('', at, a[i]);
        put('an', a[i], a[i + 1]);
        at = a[i + 1];
        if (a[i + 2] >= 0) { put('', at, a[i + 2]); put('av', a[i + 2], a[i + 3]); at = a[i + 3]; }
      }
      const close = tok.end - (tok.selfClosing ? 2 : 1);
      put('', at, close);
      put('tg', close, tok.end);
    } else put('er', tok.start, tok.end);
  }
  lines.push(line);
  return lines;
}

// Replaces only the line elements whose content changed. `state` keeps the previous strings.
export function patchLines(container, state, lines) {
  const old = state.lines || [];
  const max = Math.min(old.length, lines.length);
  let a = 0;
  while (a < max && old[a] === lines[a]) a++;
  let bo = old.length, bn = lines.length;
  while (bo > a && bn > a && old[bo - 1] === lines[bn - 1]) { bo--; bn--; }
  const doc = container.ownerDocument;
  const kids = container.children;
  const common = Math.min(bo, bn);
  for (let i = a; i < common; i++) kids[i].innerHTML = lines[i];
  if (bn > bo) {
    const frag = doc.createDocumentFragment();
    for (let i = common; i < bn; i++) { const div = doc.createElement('div'); div.innerHTML = lines[i]; frag.appendChild(div); }
    container.insertBefore(frag, kids[bo] || null);
  } else {
    for (let i = bo - 1; i >= common; i--) kids[i].remove();
  }
  state.lines = lines;
}

// DOM position inside the line elements for a source offset (for range highlights in the source pane).
export function linePoint(container, lineStarts, offset) {
  let lo = 0, hi = lineStarts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineStarts[mid] <= offset) lo = mid; else hi = mid - 1; }
  const div = container.children[lo];
  if (!div) return null;
  let rest = offset - lineStarts[lo];
  const walker = container.ownerDocument.createTreeWalker(div, 4);
  let node, last = null;
  while ((node = walker.nextNode())) {
    if (rest <= node.data.length) return { node, offset: rest, line: lo };
    rest -= node.data.length;
    last = node;
  }
  return last ? { node: last, offset: last.data.length, line: lo } : { node: div, offset: 0, line: lo };
}
