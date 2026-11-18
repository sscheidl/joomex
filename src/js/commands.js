// Editing commands on the preview document. Block structure (paragraph, headings, lists), links and images
// are built with plain DOM operations so that the resulting markup is predictable and valid. Only bold and
// italic use the browser's own editing command. Every command works on the current selection of the preview.
import { words } from './util.js';
import { HREF_HOLDER } from './project.js';
import { BLOCKS } from './serialize.js';

const PARA = words('p h1 h2 h3 h4 h5 h6');

export function getRange(doc) {
  const sel = doc.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  return doc.body.contains(range.commonAncestorContainer) ? range : null;
}

const elementOf = (node) => (node.nodeType === 1 ? node : node.parentElement);
export const isEditableAt = (node) => { const el = elementOf(node); return !!el && el.isContentEditable; };

export function closestTag(node, body, names) {
  for (let el = elementOf(node); el && el !== body.parentNode; el = el.parentElement) {
    if (names.has(el.localName)) return el;
    if (el === body) break;
  }
  return null;
}

export function blockOf(node, body) {
  for (let el = elementOf(node); el && el !== body; el = el.parentElement) if (BLOCKS.has(el.localName)) return el;
  return body;
}

function saveSel(doc) {
  const sel = doc.getSelection();
  return sel && sel.rangeCount ? { an: sel.anchorNode, ao: sel.anchorOffset, fn: sel.focusNode, fo: sel.focusOffset } : null;
}

function restoreSel(doc, keep) {
  if (!keep || !keep.an || !keep.fn || !keep.an.isConnected || !keep.fn.isConnected) return;
  const clamp = (node, off) => Math.min(off, node.nodeType === 3 ? node.data.length : node.childNodes.length);
  try { doc.getSelection().setBaseAndExtent(keep.an, clamp(keep.an, keep.ao), keep.fn, clamp(keep.fn, keep.fo)); } catch (e) { /* keep the browser's selection */ }
}

// True if the selection really covers part of `el` (a selection that merely ends at the very start of the
// next block, as after a triple click, does not count).
function covers(doc, range, el) {
  if (!range.intersectsNode(el)) return false;
  if (range.collapsed || !el.textContent) return true;
  const part = doc.createRange();
  part.selectNodeContents(el);
  if (range.compareBoundaryPoints(0, part) > 0) part.setStart(range.startContainer, range.startOffset);
  if (range.compareBoundaryPoints(2, part) < 0) part.setEnd(range.endContainer, range.endOffset);
  return part.toString() !== '';
}

function elementsInRange(doc, range, names) {
  const found = [];
  const walker = doc.createTreeWalker(doc.body, 1);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (names.has(n.localName) && n.isContentEditable && covers(doc, range, n)) found.push(n);
  return found;
}

// The inline content around `node` that is not inside a paragraph or heading yet (for example text directly
// in the body or in a list item).
function looseRun(doc, node) {
  const body = doc.body;
  let top = node;
  if (top === body) top = body.childNodes[Math.min(getRange(doc).startOffset, body.childNodes.length - 1)] || null;
  if (!top) return { parent: body, before: null, nodes: [] };
  while (top.parentNode && top.parentNode !== body && !BLOCKS.has(top.parentNode.localName)) top = top.parentNode;
  const parent = top.parentNode;
  if (!parent || parent.localName === 'pre' || (top.nodeType === 1 && BLOCKS.has(top.localName))) return null;
  const inlineNode = (n) => n && !(n.nodeType === 1 && BLOCKS.has(n.localName));
  let first = top, last = top;
  while (inlineNode(first.previousSibling)) first = first.previousSibling;
  while (inlineNode(last.nextSibling)) last = last.nextSibling;
  const blank = (n) => n.nodeType === 3 && !/\S/.test(n.data);
  while (first !== last && blank(first)) first = first.nextSibling;
  while (first !== last && blank(last)) last = last.previousSibling;
  const nodes = [];
  for (let n = first; n; n = n.nextSibling) { nodes.push(n); if (n === last) break; }
  return { parent, before: first, nodes };
}

function wrapRun(doc, run, tag) {
  const el = doc.createElement(tag);
  run.parent.insertBefore(el, run.before);
  for (const n of run.nodes) el.appendChild(n);
  if (!el.firstChild) el.appendChild(doc.createElement('br'));
  return el;
}

// Replaces an element by one with another tag name. Children are moved, not copied. If the element came from
// the source text, the mapping keeps pointing at it so its attributes are written back unchanged.
function rename(env, el, tag, keep) {
  const fresh = env.doc.createElement(tag);
  for (const a of Array.from(el.attributes)) { try { fresh.setAttribute(a.name, a.value); } catch (e) { /* skip */ } }
  while (el.firstChild) fresh.appendChild(el.firstChild);
  el.parentNode.replaceChild(fresh, el);
  const inf = env.info.get(el);
  if (inf && inf.t && !inf.t.synthetic && !inf.t.implied) { env.info.set(fresh, { t: inf.t, rename: tag }); inf.t.pv = fresh; }
  if (keep) { if (keep.an === el) keep.an = fresh; if (keep.fn === el) keep.fn = fresh; }
  return fresh;
}

function placeCaretIn(doc, el) {
  try { doc.getSelection().collapse(el, 0); } catch (e) { /* ignore */ }
}

// Paragraph / heading. Returns 'ok', 'same' or 'none'.
export function setBlock(env, tag) {
  const doc = env.doc, range = getRange(doc);
  if (!range) return 'none';
  const keep = saveSel(doc);
  const targets = elementsInRange(doc, range, PARA);
  if (!targets.length) {
    const run = looseRun(doc, range.startContainer);
    if (!run) return 'none';
    const el = wrapRun(doc, run, tag);
    if (run.nodes.length) restoreSel(doc, keep); else placeCaretIn(doc, el);
    return 'ok';
  }
  let changed = false;
  for (const el of targets) if (el.localName !== tag) { rename(env, el, tag, keep); changed = true; }
  restoreSel(doc, keep);
  return changed ? 'ok' : 'same';
}

function unlist(env, items, keep) {
  const doc = env.doc, list = items[0].parentNode, parent = list.parentNode;
  const ref = list.nextSibling;
  const rest = [];
  for (let n = items[items.length - 1].nextSibling; n; n = n.nextSibling) rest.push(n);
  let second = null;
  if (rest.some((n) => n.nodeType === 1)) { second = doc.createElement(list.localName); for (const n of rest) second.appendChild(n); }
  else for (const n of rest) n.remove();
  for (const li of items) {
    if (Array.from(li.children).some((k) => BLOCKS.has(k.localName))) {
      while (li.firstChild) parent.insertBefore(li.firstChild, ref);
    } else {
      const p = doc.createElement('p');
      while (li.firstChild) p.appendChild(li.firstChild);
      if (!p.firstChild) p.appendChild(doc.createElement('br'));
      parent.insertBefore(p, ref);
      if (keep) { if (keep.an === li) keep.an = p; if (keep.fn === li) keep.fn = p; }
    }
    li.remove();
  }
  if (second) parent.insertBefore(second, ref);
  if (!list.children.length) list.remove();
}

// Bulleted ('ul') or numbered ('ol') list: create, switch kind, or turn list items back into paragraphs.
export function toggleList(env, type) {
  const doc = env.doc, range = getRange(doc);
  if (!range) return 'none';
  const keep = saveSel(doc);
  let items = elementsInRange(doc, range, words('li'));
  items = items.filter((li) => !items.some((other) => other !== li && li.contains(other)));
  if (items.length) {
    const list = items[0].parentNode;
    if (list.localName !== 'ul' && list.localName !== 'ol') return 'none';
    if (list.localName !== type) rename(env, list, type, keep);
    else unlist(env, items.filter((li) => li.parentNode === list), keep);
    restoreSel(doc, keep);
    return 'ok';
  }
  let targets = elementsInRange(doc, range, PARA);
  let placed = null;
  if (!targets.length) {
    const run = looseRun(doc, range.startContainer);
    if (!run) return 'none';
    placed = wrapRun(doc, run, 'p');
    targets = [placed];
  }
  const parent = targets[0].parentNode;
  targets = targets.filter((el) => el.parentNode === parent);
  const list = doc.createElement(type);
  parent.insertBefore(list, targets[0]);
  let lastLi = null;
  for (const el of targets) {
    for (let n = el.previousSibling; n && n !== list && n.nodeType === 3 && !/\S/.test(n.data) && lastLi; n = el.previousSibling) n.remove();
    const li = doc.createElement('li');
    while (el.firstChild) li.appendChild(el.firstChild);
    list.appendChild(li);
    el.remove();
    if (keep) { if (keep.an === el) keep.an = li; if (keep.fn === el) keep.fn = li; }
    lastLi = li;
  }
  if (placed && keep && !keep.an.isConnected) placeCaretIn(doc, lastLi); else restoreSel(doc, keep);
  return 'ok';
}

const INLINE_ON = { bold: words('b strong'), italic: words('i em') };
const INLINE_TAG = { bold: 'b', italic: 'i' };
const STRUCTURE = words('body ul ol dl table thead tbody tfoot tr div section article header footer main nav aside blockquote figure');
const isEmptyInline = (el) => !el.textContent && !el.querySelector('img, br, input');

// Extends a collapsed range to the word around the caret. Returns false if there is no word.
function expandToWord(range) {
  const node = range.startContainer;
  if (node.nodeType !== 3) return false;
  const isWord = (ch) => /[\p{L}\p{N}]/u.test(ch);
  let a = range.startOffset, b = a;
  while (a > 0 && isWord(node.data[a - 1])) a--;
  while (b < node.data.length && isWord(node.data[b])) b++;
  if (a === b) return false;
  range.setStart(node, a);
  range.setEnd(node, b);
  return true;
}

// Splits the text nodes at the range boundaries and returns the text nodes the range covers.
function textNodesIn(doc, range) {
  let sc = range.startContainer, so = range.startOffset, ec = range.endContainer, eo = range.endOffset;
  if (ec.nodeType === 3) { if (eo < ec.data.length) ec.splitText(eo); }
  if (sc.nodeType === 3 && so > 0) {
    const rest = sc.splitText(so);
    if (ec === sc) { ec = rest; eo -= so; }
    sc = rest; so = 0;
  }
  range.setStart(sc, so);
  range.setEnd(ec, ec.nodeType === 3 ? ec.data.length : eo);
  const root = range.commonAncestorContainer.nodeType === 3 ? range.commonAncestorContainer.parentNode : range.commonAncestorContainer;
  const found = [];
  const walker = doc.createTreeWalker(root, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data || !range.intersectsNode(n) || !isEditableAt(n)) continue;
    if (!/\S/.test(n.data) && STRUCTURE.has(n.parentNode.localName)) continue;       // white space between blocks
    found.push(n);
  }
  return found;
}

// Moves a text node out of a formatting element by splitting that element around it.
function liftOut(doc, node, fmt, names) {
  const parent = fmt.parentNode, ref = fmt.nextSibling;
  let r = doc.createRange();
  r.setStartAfter(node);
  r.setEndAfter(fmt);
  const tail = r.extractContents();
  r = doc.createRange();
  r.setStartBefore(node);
  r.setEndAfter(fmt);
  const mid = r.extractContents();
  for (const el of Array.from(mid.querySelectorAll(Array.from(names).join(',')))) unwrap(el);
  for (const el of Array.from(tail.children)) if (isEmptyInline(el)) el.remove();
  parent.insertBefore(mid, ref);
  parent.insertBefore(tail, ref);
  if (isEmptyInline(fmt)) fmt.remove();
}

// Bold / italic: wraps the selected text in <b> / <i>, or removes that formatting if all of it has it already.
// Works on the document structure only, so the result does not depend on the page's style sheet.
export function toggleInline(env, command) {
  const doc = env.doc, body = doc.body, names = INLINE_ON[command], tag = INLINE_TAG[command];
  const live = getRange(doc);
  if (!live) return 'none';
  const range = live.cloneRange();
  const caretOnly = range.collapsed, caretAt = range.startOffset;
  if (caretOnly && !expandToWord(range)) return 'none';
  const caretInWord = caretAt - range.startOffset;
  const nodes = textNodesIn(doc, range);
  if (!nodes.length) return 'none';
  const fmtOf = (n) => closestTag(n, body, names);
  if (nodes.every(fmtOf)) {
    for (const n of nodes) for (let f = fmtOf(n); f; f = fmtOf(n)) liftOut(doc, n, f, names);
  } else {
    let made = null;
    const created = [];
    for (const n of nodes) {
      if (fmtOf(n)) { made = null; continue; }
      if (made && made.nextSibling === n) { made.appendChild(n); continue; }
      made = doc.createElement(tag);
      n.parentNode.insertBefore(made, n);
      made.appendChild(n);
      created.push(made);
    }
    for (const el of created) {
      const next = el.nextSibling;
      if (next && next.nodeType === 1 && next.localName === tag && !next.attributes.length) { while (next.firstChild) el.appendChild(next.firstChild); next.remove(); }
      const prev = el.previousSibling;
      if (prev && prev.nodeType === 1 && prev.localName === tag && !prev.attributes.length) { while (el.firstChild) prev.appendChild(el.firstChild); el.remove(); }
    }
  }
  const first = nodes[0], last = nodes[nodes.length - 1];
  try {
    if (caretOnly) doc.getSelection().collapse(first, Math.min(caretInWord, first.data.length));
    else doc.getSelection().setBaseAndExtent(first, 0, last, last.data.length);
  } catch (e) { /* keep the browser's selection */ }
  return 'ok';
}

function unwrap(el) {
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

const LINK = words('a');

// Why a link cannot be created for this range, or '' if it can.
export function linkProblem(doc, range) {
  if (closestTag(range.startContainer, doc.body, LINK) || closestTag(range.endContainer, doc.body, LINK)) return 'inlink';
  if (!range.collapsed && blockOf(range.startContainer, doc.body) !== blockOf(range.endContainer, doc.body)) return 'multi';
  return '';
}

export function insertLink(env, range, url, text) {
  const doc = env.doc;
  const a = doc.createElement('a');
  a.setAttribute(HREF_HOLDER, url);
  if (range.collapsed) {
    a.textContent = text || url;
    range.insertNode(a);
  } else {
    const frag = range.extractContents();
    for (const inner of Array.from(frag.querySelectorAll('a'))) unwrap(inner);
    a.appendChild(frag);
    range.insertNode(a);
    for (const sib of [a.previousSibling, a.nextSibling]) {
      if (sib && sib.nodeType === 1 && !sib.firstChild && !BLOCKS.has(sib.localName) && sib.localName !== 'br' && sib.localName !== 'img') sib.remove();
    }
  }
  try { const sel = doc.getSelection(); sel.collapse(a.parentNode, Array.prototype.indexOf.call(a.parentNode.childNodes, a) + 1); } catch (e) { /* ignore */ }
  return 'ok';
}

export function removeLinks(env) {
  const doc = env.doc, range = getRange(doc);
  if (!range) return 'none';
  const keep = saveSel(doc);
  const found = new Set(elementsInRange(doc, range, LINK));
  for (const node of [range.startContainer, range.endContainer]) { const a = closestTag(node, doc.body, LINK); if (a && a.isContentEditable) found.add(a); }
  if (!found.size) return 'none';
  for (const a of found) {
    if (keep) for (const key of ['an', 'fn']) if (keep[key] === a) { keep[key] = a.parentNode; keep[key === 'an' ? 'ao' : 'fo'] = Array.prototype.indexOf.call(a.parentNode.childNodes, a); }
    unwrap(a);
  }
  restoreSel(doc, keep);
  return 'ok';
}

export function insertImage(env, range, dataUrl, alt) {
  const doc = env.doc;
  const img = doc.createElement('img');
  img.setAttribute('src', dataUrl);
  img.setAttribute('alt', alt);
  range.collapse(false);
  range.insertNode(img);
  try { doc.getSelection().collapse(img.parentNode, Array.prototype.indexOf.call(img.parentNode.childNodes, img) + 1); } catch (e) { /* ignore */ }
  return 'ok';
}

// Inserts clipboard text as plain text. Line breaks become new paragraphs or lines, never markup.
export function insertPlainText(env, text) {
  const doc = env.doc;
  let done = false;
  try { done = doc.execCommand('insertText', false, text); } catch (e) { done = false; }
  if (done) return 'ok';
  const range = getRange(doc);
  if (!range) return 'none';
  range.deleteContents();
  const frag = doc.createDocumentFragment();
  text.split(/\r\n?|\n/).forEach((part, i) => { if (i) frag.appendChild(doc.createElement('br')); if (part) frag.appendChild(doc.createTextNode(part)); });
  const last = frag.lastChild;
  range.insertNode(frag);
  if (last) { try { const sel = doc.getSelection(); sel.collapse(last.parentNode, Array.prototype.indexOf.call(last.parentNode.childNodes, last) + 1); } catch (e) { /* ignore */ } }
  return 'ok';
}

// What the toolbar should show as active for the current caret position.
export function caretState(doc) {
  const range = getRange(doc);
  const state = { block: '', list: '', link: false, bold: false, italic: false, editable: false };
  if (!range) return state;
  const body = doc.body;
  state.editable = isEditableAt(range.startContainer);
  const para = closestTag(range.startContainer, body, PARA);
  state.block = para ? para.localName : '';
  const li = closestTag(range.startContainer, body, words('li'));
  if (li && li.parentNode) state.list = li.parentNode.localName;
  state.link = !!closestTag(range.startContainer, body, LINK);
  state.bold = !!closestTag(range.startContainer, body, INLINE_ON.bold);
  state.italic = !!closestTag(range.startContainer, body, INLINE_ON.italic);
  return state;
}
