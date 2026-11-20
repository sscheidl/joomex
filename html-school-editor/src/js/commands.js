// Editing commands on the preview document. Block structure (paragraph, headings, lists), links and images
// are built with plain DOM operations so that the resulting markup is predictable and valid. Only bold and
// italic use the browser's own editing command. Every command works on the current selection of the preview.
import { words, withAlign, withDecl, styleDeclarations, cssRisks } from './util.js';
import { HREF_HOLDER, FILE_HOLDER, TARGET_HOLDER } from './project.js';
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
// the source text, the mapping keeps pointing at it so its attributes are written back unchanged, also when
// the renamed element is moved to another place afterwards.
function rename(env, el, tag, keep) {
  const fresh = env.doc.createElement(tag);
  for (const a of Array.from(el.attributes)) { try { fresh.setAttribute(a.name, a.value); } catch (e) { /* skip */ } }
  while (el.firstChild) fresh.appendChild(el.firstChild);
  el.parentNode.replaceChild(fresh, el);
  const inf = env.info.get(el);
  if (inf && inf.t && !inf.t.synthetic && !inf.t.implied) { env.info.set(fresh, { t: inf.t, rename: tag, attrs: inf.attrs }); inf.t.pv = fresh; }
  if (keep) { if (keep.an === el) keep.an = fresh; if (keep.fn === el) keep.fn = fresh; }
  return fresh;
}

// Notes changed attributes of an element that came from the source (null removes one). The writer then
// rewrites exactly these attributes of its start tag and leaves the rest of the tag as written. An element
// created in this session needs no note: it is written from the page itself.
function record(env, el, changes) {
  const inf = env.info.get(el);
  if (inf && inf.t && inf.t.type === 'el' && !inf.t.implied) inf.attrs = Object.assign(inf.attrs || {}, changes);
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

// Removes a white-space text between blocks for good (rescueHidden() in serialize.js would put it back).
function dropSpace(env, n) {
  if (!n || n.nodeType !== 3 || /[^ \t\n\f\r]/.test(n.data)) return false;       // HTML white space only, not a no-break space
  const inf = env.info.get(n);
  if (inf && inf.t) inf.t.dropped = true;
  n.remove();
  return true;
}

// True if the element carries attributes: in the page, or only in the source text (some are not shown).
function hasAttrs(env, el) {
  if (el.attributes.length) return true;
  const inf = env.info.get(el), t = inf && inf.t;
  return !!t && !t.synthetic && !t.implied && /[^ \t\n\f\r\/]/.test(env.src.slice(t.nameEnd, t.tagEnd - 1));
}

// List items back to paragraphs. Attributes are never dropped: an item is renamed (rename() keeps its start
// tag as written), an item that holds blocks and has attributes becomes a div, and a list with attributes
// that loses all its items stays as a div around the paragraphs. If items remain, the original list element
// keeps them where possible: in front of the paragraphs, or behind them when the first item was taken out.
function unlist(env, items, keep) {
  const doc = env.doc, list = items[0].parentNode, parent = list.parentNode;
  const holdsBlocks = (li) => Array.from(li.children).some((k) => BLOCKS.has(k.localName));
  const stay = Array.from(list.children).every((c) => items.includes(c)) && hasAttrs(env, list);
  const head = !items[0].previousElementSibling;
  const ref = head ? list : list.nextSibling;
  let second = null;
  if (!stay && !head) {
    const rest = [];
    for (let n = items[items.length - 1].nextSibling; n; n = n.nextSibling) rest.push(n);
    if (rest.some((n) => n.nodeType === 1)) {
      // The items behind the selection continue in a list of their own with the same attributes (an id exists once).
      second = doc.createElement(list.localName);
      for (const a of Array.from(list.attributes)) if (a.name !== 'id') { try { second.setAttribute(a.name, a.value); } catch (e) { /* skip */ } }
      env.info.set(second, { t: null, copy: true });
      for (const n of rest) second.appendChild(n);
    } else for (const n of rest) n.remove();
  }
  for (const li of items) {
    const blocks = holdsBlocks(li);
    if (head && !stay) dropSpace(env, li.previousSibling);      // its line break would double the next item's
    if (blocks && !hasAttrs(env, li)) {
      while (li.firstChild) (stay ? list : parent).insertBefore(li.firstChild, stay ? li : ref);
      li.remove();
      continue;
    }
    const el = rename(env, li, blocks ? 'div' : 'p', keep);
    if (!el.firstChild) el.appendChild(doc.createElement('br'));
    if (!stay) parent.insertBefore(el, ref);
  }
  if (stay) { rename(env, list, 'div', keep); return; }
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
  // Paragraphs with something else between them (a line, a picture, a comment) get a list each, so that
  // everything stays in its order.
  const between = (a, b) => { for (let n = a.nextSibling; n && n !== b; n = n.nextSibling) if (n.nodeType !== 3 || /[^ \t\n\f\r]/.test(n.data)) return true; return false; };
  let list = null, lastLi = null;
  for (const el of targets) {
    if (list && between(list, el)) list = null;
    if (!list) { list = doc.createElement(type); parent.insertBefore(list, el); lastLi = null; }
    while (lastLi && el.previousSibling !== list && dropSpace(env, el.previousSibling)) { /* line breaks between neighbouring items */ }
    lastLi = rename(env, el, 'li', keep);       // the item keeps the paragraph's attributes as written
    list.appendChild(lastLi);
  }
  if (placed && keep && !keep.an.isConnected) placeCaretIn(doc, lastLi); else restoreSel(doc, keep);
  return 'ok';
}

const INLINE_ON = { bold: words('b strong'), italic: words('i em'), underline: words('u'), sup: words('sup'), sub: words('sub'), mark: words('mark') };
const INLINE_TAG = { bold: 'b', italic: 'i', underline: 'u', sup: 'sup', sub: 'sub', mark: 'mark' };
const INLINE_NOT = { sup: 'sub', sub: 'sup' };      // superscript and subscript exclude each other
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
function liftOut(env, node, fmt, names, only) {
  const doc = env.doc;
  const parent = fmt.parentNode, ref = fmt.nextSibling;
  let r = doc.createRange();
  r.setStartAfter(node);
  r.setEndAfter(fmt);
  const tail = r.extractContents();
  r = doc.createRange();
  r.setStartBefore(node);
  r.setEndAfter(fmt);
  const mid = r.extractContents();
  // Elements cut in two are copied by the range; a copy writes the attributes of its original
  for (const part of [tail, mid]) for (const el of part.querySelectorAll('*')) if (!env.info.has(el)) env.info.set(el, { t: null, copy: true });
  for (const el of Array.from(mid.querySelectorAll(Array.from(names).join(',')))) if (!only || only(el)) unwrap(el);
  for (const el of Array.from(tail.children)) if (isEmptyInline(el)) el.remove();
  parent.insertBefore(mid, ref);
  parent.insertBefore(tail, ref);
  if (isEmptyInline(fmt)) fmt.remove();
}

// Bold, italic, underline, superscript, subscript, highlight: wraps the selected text in <b>, <i>, <u>, <sup>,
// <sub> or <mark>, or removes that formatting if all of it has it already. Superscript takes subscript away
// from the text it is given to, and the other way round. Works on the document structure only, so the result
// does not depend on the page's style sheet.
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
    for (const n of nodes) for (let f = fmtOf(n); f; f = fmtOf(n)) liftOut(env, n, f, names);
  } else {
    if (INLINE_NOT[command]) {
      const other = INLINE_ON[INLINE_NOT[command]], otherOf = (n) => closestTag(n, body, other);
      for (const n of nodes) for (let f = otherOf(n); f; f = otherOf(n)) liftOut(env, n, f, other);
    }
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

export function insertLink(env, range, url, text, newTab) {
  const doc = env.doc;
  const a = doc.createElement('a');
  a.setAttribute(HREF_HOLDER, url);
  if (newTab) a.setAttribute(TARGET_HOLDER, '_blank');
  if (range.collapsed) {
    a.textContent = text || url;
    range.insertNode(a);
  } else {
    const frag = range.extractContents();
    for (const el of frag.querySelectorAll('*')) if (!env.info.has(el)) env.info.set(el, { t: null, copy: true });       // copies of cut elements
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

// The image if the selection is exactly one image (set by a click on it), otherwise null.
export function selectedImage(doc) {
  const range = getRange(doc);
  if (!range || range.collapsed || range.startContainer !== range.endContainer || range.startContainer.nodeType !== 1 || range.endOffset - range.startOffset !== 1) return null;
  const node = range.startContainer.childNodes[range.startOffset];
  return node && node.nodeType === 1 && node.localName === 'img' && isEditableAt(node.parentNode) ? node : null;
}

// Inserts an image. `image`: { src, url, alt, width }: `src` is the address written into the source, `url`
// the file address under which the page pane finds the file ('' if it cannot look for it).
export function insertImage(env, range, image) {
  const doc = env.doc;
  const img = doc.createElement('img');
  img.setAttribute(FILE_HOLDER, image.src);
  if (image.url) img.setAttribute('src', image.url);
  img.setAttribute('alt', image.alt);
  if (image.width) img.setAttribute('width', image.width);
  range.collapse(false);
  range.insertNode(img);
  try { doc.getSelection().collapse(img.parentNode, Array.prototype.indexOf.call(img.parentNode.childNodes, img) + 1); } catch (e) { /* ignore */ }
  return 'ok';
}

// Changes an existing image. `changes` may hold src (with url for the page pane), alt and width ('' removes
// the width); a key that is missing leaves that attribute alone. A new width removes a height attribute, so
// that the picture keeps its proportions.
export function changeImage(env, img, changes) {
  const set = {};
  if (changes.src !== undefined && changes.src !== img.getAttribute(FILE_HOLDER)) {
    set.src = changes.src;
    img.setAttribute(FILE_HOLDER, changes.src);
    if (changes.url) img.setAttribute('src', changes.url); else img.removeAttribute('src');
  }
  if (changes.alt !== undefined && changes.alt !== (img.getAttribute('alt') || '')) { set.alt = changes.alt; img.setAttribute('alt', changes.alt); }
  if (changes.width !== undefined && changes.width !== (img.getAttribute('width') || '')) {
    set.width = changes.width || null;
    if (changes.width) img.setAttribute('width', changes.width); else img.removeAttribute('width');
    if (img.hasAttribute('height')) { set.height = null; img.removeAttribute('height'); }
  }
  if (!Object.keys(set).length) return 'same';
  record(env, img, set);
  return 'ok';
}

// The link that holds the whole selection, or null.
export function linkAround(doc, range) {
  const a = closestTag(range.startContainer, doc.body, LINK);
  return a && a.isContentEditable && a === closestTag(range.endContainer, doc.body, LINK) ? a : null;
}

// True if a link of the page pane opens in a new tab (the browser reads "_BLANK" like "_blank").
export const opensNewTab = (a) => (a.getAttribute(TARGET_HOLDER) || '').toLowerCase() === '_blank';

// Changes the address of a link and whether it opens in a new tab. Only these two attributes are rewritten
// in the source. Unticking "new tab" removes a target only if it is _blank; any other target stays.
export function changeLink(env, a, url, newTab) {
  const set = {};
  if (a.getAttribute(HREF_HOLDER) !== url) { set.href = url; a.setAttribute(HREF_HOLDER, url); }
  const blank = opensNewTab(a);
  if (newTab && !blank) { set.target = '_blank'; a.setAttribute(TARGET_HOLDER, '_blank'); }
  else if (!newTab && blank) { set.target = null; a.removeAttribute(TARGET_HOLDER); }
  if (!Object.keys(set).length) return 'same';
  record(env, a, set);
  return 'ok';
}

const ALIGNABLE = words('p h1 h2 h3 h4 h5 h6 li td th blockquote div');

// How the text of an element is aligned in the page, whatever rule says so: 'left', 'center', 'right', 'justify'.
function alignOf(el) {
  const v = el.ownerDocument.defaultView.getComputedStyle(el).textAlign;
  return /center/.test(v) ? 'center' : /justify/.test(v) ? 'justify' : /right|end/.test(v) ? 'right' : 'left';
}

// True if a style rule of the page sets an alignment that holds only sometimes (in print, for a hovered element,
// for another window width): the page pane cannot show whether a block without its own alignment stays left.
function alignSometimes(doc) {
  const facts = {};
  for (const st of Array.from(doc.querySelectorAll('style:not(#se-base)'))) {
    const media = (st.getAttribute('media') || '').trim().toLowerCase();
    cssRisks(st.textContent, facts, media !== '' && media !== 'all');
  }
  return !!facts.align;
}

// Alignment of the blocks in the selection (or of the block around a selected image). It is the one thing
// the editor writes as a style attribute, because HTML has no tag for it; other declarations of an existing
// style attribute stay as written. 'left' removes the declaration, unless a rule of the page would then
// align the block differently, now or only sometimes (in print, for example). Returns 'odd' if nothing could be done because a style attribute is written in
// a way that cannot be read with certainty (an open string, comment or bracket).
export function setAlign(env, value) {
  const doc = env.doc, range = getRange(doc);
  if (!range) return 'none';
  const keep = saveSel(doc);
  const img = selectedImage(doc);
  let targets;
  if (img) { const block = closestTag(img, doc.body, ALIGNABLE); targets = block ? [block] : []; }
  else {
    targets = elementsInRange(doc, range, ALIGNABLE);
    targets = targets.filter((el) => !targets.some((other) => other !== el && el.contains(other)));
  }
  if (!targets.length) {
    const run = looseRun(doc, img || range.startContainer);
    if (!run) return 'none';
    targets = [wrapRun(doc, run, 'p')];
  }
  let changed = false, odd = false;
  const sometimes = value === 'left' && alignSometimes(doc);
  for (const el of targets) {
    const old = el.getAttribute('style') || '';
    let next = withAlign(old, value === 'left' ? '' : value);
    if (next === null) { odd = true; continue; }       // the style text cannot be read with certainty: leave it alone
    const put = (style) => { if (style) el.setAttribute('style', style); else el.removeAttribute('style'); return style; };
    put(next);
    if (value === 'left' && (sometimes || alignOf(el) !== 'left')) next = put(withAlign(old, 'left'));
    if (next === old) continue;
    record(env, el, { style: next || null });
    changed = true;
  }
  restoreSel(doc, keep);
  return changed ? 'ok' : odd ? 'odd' : 'same';
}

// ---------------------------------------------------------------- text colour

const COLOR_BLOCKS = words('p h1 h2 h3 h4 h5 h6 li');
const COLOR_INLINE = words('span b i u s sub sup mark a em strong small code');
const hasColor = (el) => { const s = el.getAttribute('style'), d = s ? styleDeclarations(s) : null; return !!d && d.some((x) => x.name === 'color'); };
// a span that carries nothing but a colour: it goes when its colour goes
const colorSpan = (el) => el.localName === 'span' && el.attributes.length === 1 && hasColor(el) && withDecl(el.getAttribute('style'), 'color', '') === '';

// Sets the colour declaration of an element ('' removes it) through the CSS reader; a span left without any
// attribute is taken out. false if the style text cannot be read with certainty (then it stays as it is).
function putColor(env, el, color) {
  const old = el.getAttribute('style') || '', next = withDecl(old, 'color', color);
  if (next === null) return false;
  if (next === old) return true;
  if (next) el.setAttribute('style', next); else el.removeAttribute('style');
  if (!next && el.localName === 'span' && !el.attributes.length) { unwrap(el); return true; }
  record(env, el, { style: next || null });
  return true;
}

// Text colour from the palette ('' removes it). A whole paragraph, heading or list item gets the colour on its
// own tag, exactly one whole inline element on its tag; only otherwise the text is wrapped in
// <span style="color: …">. Colours inside the part that is coloured go, so that the new one is seen.
// Returns 'ok', 'none', 'odd' (a style text that cannot be read) or 'part' (when removing: the colour comes
// from a larger part than the selection and stays).
export function setColor(env, color) {
  const doc = env.doc, body = doc.body, live = getRange(doc);
  if (!live) return 'none';
  const range = live.cloneRange();
  const caretOnly = range.collapsed, caretAt = range.startOffset;
  if (caretOnly && !expandToWord(range)) return 'none';
  const caretInWord = caretAt - range.startOffset;
  const nodes = textNodesIn(doc, range);
  if (!nodes.length) return 'none';
  const inside = new Set(nodes);
  const whole = (el) => { const w = doc.createTreeWalker(el, 4); for (let n = w.nextNode(); n; n = w.nextNode()) if (/\S/.test(n.data) && !inside.has(n)) return false; return true; };
  let odd = false;
  const put = (el, c) => { if (!putColor(env, el, c)) odd = true; };
  const clearInside = (el) => { for (const k of Array.from(el.querySelectorAll('[style]'))) if (hasColor(k)) put(k, ''); };
  let targets = null;
  const blocks = Array.from(new Set(nodes.map((n) => closestTag(n, body, COLOR_BLOCKS))));
  if (blocks.every((b) => b && whole(b))) targets = blocks;
  else {
    // the outermost inline element that holds exactly the selected text
    let one = null;
    for (let el = nodes[0].parentElement; el && el !== body && !BLOCKS.has(el.localName); el = el.parentElement) {
      if (COLOR_INLINE.has(el.localName) && nodes.every((n) => el.contains(n)) && whole(el)) one = el;
    }
    if (one) targets = [one];
  }
  if (targets) for (const el of targets) { clearInside(el); put(el, color); }
  else {
    // the text comes out of the colour spans around it; a colour span that is selected entirely goes
    for (const n of nodes) {
      for (let f = n.parentElement; f && f !== body && !BLOCKS.has(f.localName); f = f.parentElement) {
        if (!colorSpan(f)) continue;
        if (whole(f)) unwrap(f); else liftOut(env, n, f, words('span'), colorSpan);
        f = n;
      }
      if (!color) for (let f = n.parentElement; f && f !== body && !BLOCKS.has(f.localName); f = f.parentElement) if (hasColor(f) && whole(f)) put(f, '');
    }
    if (color) {
      let made = null;
      for (const n of nodes) {
        if (made && made.nextSibling === n) { made.appendChild(n); continue; }
        made = doc.createElement('span');
        made.setAttribute('style', 'color: ' + color);
        n.parentNode.insertBefore(made, n);
        made.appendChild(n);
      }
    }
  }
  const first = nodes[0], last = nodes[nodes.length - 1];
  try {
    if (caretOnly) doc.getSelection().collapse(first, Math.min(caretInWord, first.data.length));
    else doc.getSelection().setBaseAndExtent(first, 0, last, last.data.length);
  } catch (e) { /* keep the browser's selection */ }
  const coloured = (n) => { for (let f = n.parentElement; f && f !== body; f = f.parentElement) if (hasColor(f)) return true; return false; };
  return odd ? 'odd' : !color && nodes.some(coloured) ? 'part' : 'ok';
}

// ---------------------------------------------------------------- tables

const CELL = words('td th');
const TABLE = words('table');

// The cell with the caret, its row and its table, or null.
export function tableAt(doc) {
  const range = getRange(doc);
  const cell = range && closestTag(range.startContainer, doc.body, CELL);
  const table = cell && closestTag(cell, doc.body, TABLE);
  return table && cell.parentNode.localName === 'tr' ? { cell, row: cell.parentNode, table } : null;
}

const merged = (table) => !!table.querySelector('[rowspan], [colspan]');
// <colgroup> and <col> define the columns apart from the cells: the editor would have to change both
const ownCols = (table) => Array.from(table.children).some((k) => k.localName === 'colgroup' || k.localName === 'col');
const cellsOf = (table) => Array.from(table.rows).flatMap((tr) => Array.from(tr.cells));

// Takes an element out together with the line break in front of it (behind it, if it is the first child).
function takeOut(env, el) {
  const before = el.previousSibling;
  if (before && before.previousSibling) dropSpace(env, before); else dropSpace(env, el.nextSibling);
  el.remove();
}

// A new table with `rows` × `cols` empty cells behind the block with the caret; the first row with <th> if
// `head`, border="1" if `border`. Returns 'ok' or 'intable' (no table inside a table).
export function insertTable(env, range, { rows, cols, head, border }) {
  const doc = env.doc, body = doc.body;
  if (closestTag(range.startContainer, body, TABLE)) return 'intable';
  const table = doc.createElement('table');
  if (border) table.setAttribute('border', '1');
  const tbody = table.appendChild(doc.createElement('tbody'));
  for (let r = 0; r < rows; r++) {
    const tr = tbody.appendChild(doc.createElement('tr'));
    for (let c = 0; c < cols; c++) tr.appendChild(doc.createElement(head && r === 0 ? 'th' : 'td'));
  }
  let at = blockOf(range.startContainer, body);
  if (at.localName === 'li' || at.localName === 'dt' || at.localName === 'dd') at = at.parentElement;
  if (at === body) {
    let top = range.startContainer;
    while (top !== body && top.parentNode !== body) top = top.parentNode;
    body.insertBefore(table, top === body ? body.childNodes[range.startOffset] || null : top.nextSibling);
  } else at.parentNode.insertBefore(table, at.nextSibling);
  placeCaretIn(doc, table.rows[0].cells[0]);
  return 'ok';
}

// "Zeile darunter einfügen" (add) or "Zeile löschen". Returns 'ok', 'none', 'merged' or 'last'.
export function tableRow(env, add) {
  const doc = env.doc, at = tableAt(doc);
  if (!at) return 'none';
  if (merged(at.table)) return 'merged';
  const rows = Array.from(at.table.rows), i = Array.prototype.indexOf.call(at.row.cells, at.cell);
  if (add) {
    const tr = doc.createElement('tr');
    for (let k = 0; k < at.row.cells.length; k++) tr.appendChild(doc.createElement('td'));
    at.row.parentNode.insertBefore(tr, at.row.nextSibling);
    placeCaretIn(doc, tr.cells[i]);
    return 'ok';
  }
  if (rows.length < 2) return 'last';
  const r = rows.indexOf(at.row), next = rows[r + 1] || rows[r - 1];
  takeOut(env, at.row);
  placeCaretIn(doc, next.cells[Math.min(i, next.cells.length - 1)] || next);
  return 'ok';
}

// "Spalte rechts einfügen" (add) or "Spalte löschen". Returns 'ok', 'none', 'merged', 'cols' or 'last'.
export function tableColumn(env, add) {
  const doc = env.doc, at = tableAt(doc);
  if (!at) return 'none';
  if (merged(at.table)) return 'merged';
  if (ownCols(at.table)) return 'cols';
  const rows = Array.from(at.table.rows), i = Array.prototype.indexOf.call(at.row.cells, at.cell);
  if (add) {
    let mine = null;
    for (const tr of rows) {
      const ref = tr.cells[Math.min(i, tr.cells.length - 1)] || null;
      const cell = doc.createElement(ref ? ref.localName : 'td');
      tr.insertBefore(cell, ref ? ref.nextSibling : null);
      if (tr === at.row) mine = cell;
    }
    placeCaretIn(doc, mine);
    return 'ok';
  }
  if (at.row.cells.length < 2) return 'last';
  for (const tr of rows) if (tr.cells[i] && tr.cells.length > 1) takeOut(env, tr.cells[i]);
  placeCaretIn(doc, at.row.cells[Math.max(0, i - 1)]);
  return 'ok';
}

// Tab and Shift+Tab in a table: the next or previous cell, its content selected. false at the end of the table
// (the key then does what it always does).
export function stepCell(doc, back) {
  const at = tableAt(doc);
  if (!at) return false;
  const cells = cellsOf(at.table), next = cells[cells.indexOf(at.cell) + (back ? -1 : 1)];
  if (!next) return false;
  const r = doc.createRange();
  r.selectNodeContents(next);
  const sel = doc.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  return true;
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
  const state = { block: '', list: '', link: false, editable: false, align: '', image: false };
  for (const k of Object.keys(INLINE_ON)) state[k] = false;
  if (!range) return state;
  const body = doc.body;
  state.editable = isEditableAt(range.startContainer);
  const para = closestTag(range.startContainer, body, PARA);
  state.block = para ? para.localName : '';
  const li = closestTag(range.startContainer, body, words('li'));
  if (li && li.parentNode) state.list = li.parentNode.localName;
  state.link = !!closestTag(range.startContainer, body, LINK);
  for (const k of Object.keys(INLINE_ON)) state[k] = !!closestTag(range.startContainer, body, INLINE_ON[k]);
  const image = selectedImage(doc);
  state.image = !!image;
  state.align = alignOf(closestTag(image || range.startContainer, body, ALIGNABLE) || body);
  return state;
}
