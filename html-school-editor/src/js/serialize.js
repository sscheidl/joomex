// Preview DOM -> source text.
//
// Only the body content is rewritten; everything else in the document stays byte for byte as it is. Inside the
// body, every node that still looks exactly as it was rendered is copied verbatim from the source text
// (including inactive scripts, attributes, comments and character references). Only edited text and new
// elements are written fresh, with a small fixed vocabulary of plain tags.
import { words, escapeText, escapeAttr, commonPrefix, commonSuffix, isSafeHref, isRasterDataUrl, fileOfSrc, onlyAlign, patchAttrs } from './util.js';
import { VOID_TAGS } from './tokenizer.js';
import { HTML_NS, HREF_HOLDER, FILE_HOLDER, rawPos, srcOffsetOf } from './project.js';

const NEW_OK = words('p h1 h2 h3 h4 h5 h6 div blockquote pre ul ol li dl dt dd b i strong em u s sub sup code kbd mark small span a img br hr table thead tbody tfoot tr td th caption section article header footer nav main aside figure figcaption');
export const BLOCKS = words('p h1 h2 h3 h4 h5 h6 div blockquote pre ul ol li dl dt dd hr table thead tbody tfoot tr td th caption section article header footer nav main aside figure figcaption');

// White space in front of `pos` if `pos` is the first thing on its line, otherwise null.
function lineIndentAt(src, pos) {
  const nl = src.lastIndexOf('\n', pos - 1);
  const lead = src.slice(nl + 1, pos);
  return /^[ \t]*$/.test(lead) ? lead : null;
}

function isClean(ctx, node) {
  const memo = ctx.memo.get(node);
  if (memo !== undefined) return memo;
  const inf = ctx.info.get(node);
  let ok = !!inf && !inf.attrs;                    // a command changed attributes of this element
  if (ok && node.nodeType !== 1) ok = node.data === inf.data;
  else if (ok) {
    const want = inf.kids, have = node.childNodes;
    ok = !!want && want.length === have.length;
    for (let i = 0; ok && i < want.length; i++) ok = have[i] === want[i] && isClean(ctx, have[i]);
  }
  ctx.memo.set(node, ok);
  return ok;
}

const mappedT = (ctx, node) => { const inf = ctx.info.get(node); return inf ? inf.t : null; };
// True if source node `t` still sits in the element it was written in (`pt`: source node of its parent now).
const inPlace = (t, pt) => !!pt && (t.parent === pt || (!!pt.virtual && t.parent === pt.parent));

function mark(ctx, el, i, atEnd) {
  for (const p of ctx.points) if (p.out == null && p.node === el && (atEnd ? p.offset >= i : p.offset === i)) p.out = ctx.s.length;
}

// Starts a new line for a freshly created block element unless the output already is at the start of a line.
function freshLine(ctx, indent) {
  const tail = (ctx.before + ctx.s).slice(-200);
  if (!tail) return;
  const m = /\n([ \t]*)$/.exec(tail);
  if (!m) ctx.s += '\n' + indent;
  else if (!m[1]) ctx.s += indent;
}

function childIndent(ctx, el, t, parentIndent) {
  for (const c of Array.from(el.childNodes)) {
    const ct = mappedT(ctx, c);
    if (ct && ct.type === 'el' && !ct.implied && !ct.synthetic && inPlace(ct, t)) {
      const ind = lineIndentAt(ctx.src, ct.start);
      if (ind != null) return ind;
      break;
    }
  }
  return t && t.virtual ? '' : parentIndent + '  ';
}

// True if the loose run kids[i..j) directly in the page is nothing but one <br>. That is the line break a
// browser keeps for itself in a page without visible content (Firefox), or what is left when everything was
// deleted. It is not content of the document and is not written.
function paddingBreak(ctx, kids, i, j) {
  let breaks = 0;
  for (let k = i; k < j; k++) {
    if (kids[k].nodeType === 1) { if (kids[k].localName !== 'br') return false; breaks++; }
    else if (!WS_ONLY.test(kids[k].data)) return false;
  }
  return breaks === 1;
}

const isLoose = (ctx, c) => !mappedT(ctx, c) && (c.nodeType === 3 || (c.nodeType === 1 && !BLOCKS.has(c.localName) && !c.hasAttribute('data-se-box')));

function emitKids(ctx, el, t, parentIndent) {
  const kids = Array.from(el.childNodes);
  const indent = childIndent(ctx, el, t, parentIndent);
  let newBlockLast = false;
  for (let i = 0; i < kids.length; i++) {
    mark(ctx, el, i);
    // New text typed directly into the body becomes a paragraph.
    if (el === ctx.top && isLoose(ctx, kids[i])) {
      let j = i, solid = false;
      while (j < kids.length && isLoose(ctx, kids[j])) { if (kids[j].nodeType === 1 || /\S/.test(kids[j].data)) solid = true; j++; }
      if (solid && paddingBreak(ctx, kids, i, j)) { i = j - 1; continue; }
      if (solid) {
        freshLine(ctx, indent);
        ctx.s += '<p>';
        for (let k = i; k < j; k++) { if (k > i) mark(ctx, el, k); emitNode(ctx, kids[k], indent); }
        ctx.s += '</p>';
        newBlockLast = true;
        i = j - 1;
        continue;
      }
    }
    // A block that was changed itself (a list that lost its first item) and now follows a new block starts on
    // its own line. An untouched neighbour keeps the exact text around it.
    if (newBlockLast && kids[i].nodeType === 1 && BLOCKS.has(kids[i].localName) && mappedT(ctx, kids[i]) && !isClean(ctx, kids[i])) freshLine(ctx, indent);
    newBlockLast = emitNode(ctx, kids[i], indent);
  }
  mark(ctx, el, kids.length, true);
  if (t) ctx.s += ctx.src.slice(t.tail, t.closeStart);
  if (newBlockLast) ctx.s += '\n' + parentIndent;
}

// An element whose end tag is omitted in the source must get one when what follows it has changed.
function needsEndTag(ctx, c, t) {
  if (t.type !== 'el' || t.explicitEnd || t.implied || t.synthetic || VOID_TAGS.has(t.name) || t.tagEnd === t.start) return false;
  const sibs = t.parent ? t.parent.kids : [];
  const origNext = sibs[sibs.indexOf(t) + 1] || null;
  const next = c.nextSibling ? mappedT(ctx, c.nextSibling) : null;
  return next !== origNext;
}

const WS_ONLY = /^[ \t\n\f\r]*$/;

// True if white space at this edge of text node `c` cannot be seen: what stands next to it in the same line
// ends with white space, or nothing stands there (edge of the block, a line break). Comments are looked through.
function unseenEdge(c, before) {
  for (let n = before ? c.previousSibling : c.nextSibling; ; n = before ? n.previousSibling : n.nextSibling) {
    if (!n) { const p = c.parentNode; return !!p && (p.localName === 'body' || BLOCKS.has(p.localName)); }
    if (n.nodeType === 8 || (n.nodeType === 3 && !n.data)) continue;
    // While typing, the engine writes the space it keeps as a no-break space; the writer turns it back.
    if (n.nodeType === 3) { const ch = before ? n.data[n.data.length - 1] : n.data[0]; return ch === NBSP || WS_ONLY.test(ch); }
    return n.nodeType === 1 && (n.localName === 'br' || BLOCKS.has(n.localName));
  }
}

// The browser's editing engine tidies white space that cannot be seen. While the pupil types somewhere else,
// it may empty a text that only holds line breaks and indentation, and it may drop a space at the edge of a
// neighbouring text when another space stands next to it (Firefox does both). Such a change of a text that
// was not edited is not an edit. `typing`: the pending input consisted of insertions only; after a deletion a
// missing space counts as deleted.
function engineTidied(ctx, c, old, now, t) {
  if (t.hidden) return WS_ONLY.test(now);           // line breaks and indentation between elements: never an edit
  if (!ctx.typing || !/^(?:normal|nowrap)$/.test(c.ownerDocument.defaultView.getComputedStyle(c.parentNode).whiteSpace)) return false;
  if (WS_ONLY.test(old)) return WS_ONLY.test(now) && (unseenEdge(c, true) || unseenEdge(c, false));
  const lead = /^[ \t\n\f\r]*/.exec(old)[0].length, trail = /[ \t\n\f\r]*$/.exec(old)[0].length;
  const cutLead = !!lead && now === old.slice(lead), cutTrail = !!trail && now === old.slice(0, old.length - trail);
  const cutBoth = !!lead && !!trail && now === old.slice(lead, old.length - trail);
  return (cutLead && unseenEdge(c, true)) || (cutTrail && unseenEdge(c, false)) || (cutBoth && unseenEdge(c, true) && unseenEdge(c, false));
}

const NBSP = String.fromCharCode(160);
const isSolid = (ch) => !!ch && ch !== ' ' && ch !== NBSP && ch !== '\n' && ch !== '\t' && ch !== '\r' && ch !== '\f';

// Character next to a text node within the same line of text ('' at a block boundary or line break).
function neighbourChar(c, before) {
  const sib = before ? c.previousSibling : c.nextSibling;
  if (!sib) return '';
  if (sib.nodeType === 3) return sib.data ? (before ? sib.data[sib.data.length - 1] : sib.data[0]) : '';
  return sib.nodeType === 1 && !BLOCKS.has(sib.localName) && sib.localName !== 'br' ? 'x' : '';
}

// In typed text the browser stores some spaces as no-break spaces. Between two visible characters that makes
// no visible difference, so an ordinary space is written there; at the edges of a line it is kept.
function tidySpaces(text, from, to, before, after) {
  if (text.indexOf(NBSP, from) < 0) return text;
  let out = text.slice(0, from);
  for (let i = from; i < to; i++) {
    const ch = text[i];
    out += ch === NBSP && isSolid(i > 0 ? text[i - 1] : before) && isSolid(i + 1 < text.length ? text[i + 1] : after) ? ' ' : ch;
  }
  return out + text.slice(to);
}

function emitText(ctx, c, inf) {
  const src = ctx.src, t = inf && inf.t;
  const fresh = !t || !!t.raw;
  const data = fresh && !(t && t.raw) ? tidySpaces(c.data, 0, c.data.length, neighbourChar(c, true), neighbourChar(c, false)) : c.data;
  const mine = ctx.points.filter((p) => p.out == null && p.node === c);
  if (fresh) {
    if (t) ctx.s += src.slice(t.lead, t.start);
    const at = ctx.s.length, esc = t && t.raw === 'literal' ? (x) => x : escapeText;
    for (const p of mine) p.out = at + esc(data.slice(0, p.offset)).length;
    ctx.s += esc(data);
    return;
  }
  // Mapped text that was edited: keep the unchanged beginning and end exactly as written in the source.
  const old = inf.data;
  if (engineTidied(ctx, c, old, data, t)) {
    const at = ctx.s.length;
    ctx.s += src.slice(t.lead, t.end);
    for (const p of mine) p.out = at + (t.start - t.lead) + rawPos(src, t, Math.min(old.length, p.offset + (old.length - data.length)), false)[0] - t.start;
    return;
  }
  // The browser's editing engine drops line breaks at the edges of a text and swaps ordinary spaces for
  // no-break spaces around the caret. Both are side effects, not edits: the source formatting is kept.
  let lead = '';
  const same = (o, n) => o === n || (o === 32 && n === 160);
  const edges = (now) => {
    const max = Math.min(old.length, now.length);
    let p = 0;
    while (p < max && same(old.charCodeAt(p), now.charCodeAt(p))) p++;
    let q = 0;
    while (q < max - p && same(old.charCodeAt(old.length - 1 - q), now.charCodeAt(now.length - 1 - q))) q++;
    return [p, q];
  };
  let now = data;
  let [p0, s0] = edges(now);
  if (/[^ \t\n\f\r]/.test(old) && !c.parentNode.closest('pre, textarea')) {
    const oldLead = /^[ \t\n\f\r]*/.exec(old)[0], oldTrail = /[ \t\n\f\r]*$/.exec(old)[0];
    const trailLost = oldTrail.indexOf('\n') >= 0 && s0 < oldTrail.length && p0 < old.length;
    const leadLost = oldLead.indexOf('\n') >= 0 && p0 < oldLead.length && s0 < old.length;
    if (trailLost || leadLost) {
      lead = leadLost ? oldLead : '';
      now = lead + data + (trailLost ? oldTrail : '');
      [p0, s0] = edges(now);
    }
  }
  const from = t.start + (t.skip || 0);
  const [rp, dp] = rawPos(src, t, p0, false);
  const [rs, ds] = rawPos(src, t, old.length - s0, true);
  const keptEnd = old.length - ds;
  now = tidySpaces(now, dp, now.length - keptEnd, neighbourChar(c, true), neighbourChar(c, false));
  const head = src.slice(from, rp), mid = escapeText(now.slice(dp, now.length - keptEnd)), tail = src.slice(rs, t.end);
  ctx.s += src.slice(t.lead, from);
  const at = ctx.s.length;
  for (const p of mine) {
    const o = Math.min(p.offset, data.length) + lead.length;
    if (o <= dp) p.out = at + rawPos(src, t, o, false)[0] - from;
    else if (o >= now.length - keptEnd) p.out = at + head.length + mid.length + rawPos(src, t, o - (now.length - old.length), true)[0] - rs;
    else p.out = at + head.length + escapeText(now.slice(dp, o)).length;
  }
  ctx.s += head + mid + tail;
}

function emitNew(ctx, c, indent) {
  if (c.hasAttribute('data-se-box')) return false;
  let name = c.localName;
  const known = c.namespaceURI === HTML_NS && NEW_OK.has(name);
  const copy = !!(ctx.info.get(c) || {}).copy;       // second half of a divided list: attributes of the first
  let attrs = '';
  if (known) {
    for (const a of Array.from(c.attributes)) {
      const n = a.name.toLowerCase();
      let outName = n, value = a.value;
      if (n === HREF_HOLDER) { if (name !== 'a' || !isSafeHref(value)) continue; outName = 'href'; }
      else if (n === FILE_HOLDER) { if (name !== 'img' || !fileOfSrc(value)) continue; outName = 'src'; }       // image by file name
      else if (n === 'src') { if (name !== 'img' || c.hasAttribute(FILE_HOLDER) || !isRasterDataUrl(value)) continue; }
      else if (n === 'style' && !copy) { const align = onlyAlign(value); if (!align) continue; value = 'text-align: ' + align; }
      else if (n.startsWith('on') || n.startsWith('data-se-') || n === 'id' || n === 'href' || n === 'contenteditable') continue;
      else if (!/^[a-z][a-z0-9_:.\-]*$/.test(n)) continue;
      attrs += ' ' + outName + '="' + escapeAttr(value) + '"';
    }
  }
  if (!known || (name === 'span' && !attrs)) { emitInner(ctx, c, indent); return false; }
  if (name === 'div' && !attrs && !Array.from(c.children).some((k) => BLOCKS.has(k.localName))) name = 'p';
  const block = BLOCKS.has(name);
  if (block) freshLine(ctx, indent);
  ctx.s += '<' + name + attrs + '>';
  if (!VOID_TAGS.has(name)) { emitKids(ctx, c, null, indent); ctx.s += '</' + name + '>'; }
  return block;
}

// Children of an element that is itself not written (decorative wrappers the browser may create).
function emitInner(ctx, c, indent) {
  const kids = Array.from(c.childNodes);
  for (let i = 0; i < kids.length; i++) { mark(ctx, c, i); emitNode(ctx, kids[i], indent); }
  mark(ctx, c, kids.length, true);
}

// Writes one preview node. Returns true if it produced a new block element.
function emitNode(ctx, c, indent) {
  const src = ctx.src;
  const inf = ctx.info.get(c), t = inf && inf.t;
  const standIn = c.nodeType === 1 && c.hasAttribute('data-se-box');       // label text of a stand-in is never written
  if (t && !inf.rename && !inf.attrs && (standIn || isClean(ctx, c))) {
    const at = ctx.s.length;
    ctx.s += src.slice(t.lead, t.end);
    for (const p of ctx.points) if (p.out == null && (p.node === c || c.contains(p.node))) p.out = at + srcOffsetOf(ctx.view, ctx.info, p.node, p.offset) - t.lead;
    if (needsEndTag(ctx, c, t)) ctx.s += '</' + src.slice(t.start + 1, t.nameEnd) + '>';
    return false;
  }
  if (c.nodeType === 3) { emitText(ctx, c, inf); return false; }
  if (c.nodeType !== 1) { if (t) ctx.s += src.slice(t.lead, t.end); return false; }
  if (!t) return emitNew(ctx, c, indent);
  // Element from the source whose content (or tag name) was changed: keep its tags, rewrite the inside.
  ctx.s += src.slice(t.lead, t.start);
  if (t.implied) { emitKids(ctx, c, t, indent); return false; }
  const name = inf.rename || t.name;
  // A renamed element that was moved (paragraph into a new list, list item out of its list) starts on a line
  // of its own, like a new block. Renamed in place, the white space around it stays as written.
  const moved = !!inf.rename && BLOCKS.has(name) && !inPlace(t, mappedT(ctx, c.parentNode));
  if (moved) freshLine(ctx, indent);
  // The start tag stays as written; a renamed element gets the new name, changed attributes are patched in.
  if (t.synthetic) {
    ctx.s += '<' + name;
    for (const key of Object.keys(inf.attrs || {})) if (inf.attrs[key] !== null) ctx.s += ' ' + key + '="' + escapeAttr(inf.attrs[key]) + '"';
    ctx.s += '>';
  } else {
    ctx.s += '<' + (inf.rename || src.slice(t.start + 1, t.nameEnd)) + (inf.attrs ? patchAttrs(src, t.nameEnd, t.tagEnd, t.attrs, inf.attrs) : src.slice(t.nameEnd, t.tagEnd));
  }
  if (VOID_TAGS.has(name)) return false;
  const own = moved ? null : lineIndentAt(src, t.start);
  emitKids(ctx, c, t, own == null ? indent : own);
  if (inf.rename) ctx.s += '</' + name + '>';
  else if (t.explicitEnd) ctx.s += src.slice(t.closeStart, t.end);
  else if (t.synthetic || needsEndTag(ctx, c, t)) ctx.s += '</' + (t.synthetic ? name : src.slice(t.start + 1, t.nameEnd)) + '>';
  return moved;
}

// Content without a visible counterpart (comments, scripts, style and similar elements) must not disappear from
// the source just because the browser's editing engine dropped its invisible stand-in while joining or deleting
// text. Such stand-ins are put back next to their surviving neighbours before the text is written.
// `typing`: every pending input was an insertion. Then a space between two elements that the engine took out
// is put back as well, if it could not be seen (another space or the edge of the block is next to it); after a
// deletion such a space counts as deleted.
export function rescueHidden(view, typing) {
  let moved = false;
  // `lost`: the element of `t` itself is gone, its content is looked at from the surviving parent.
  const walk = (t, pvParent, cursor, lost) => {
    for (const k of t.mk || []) {
      const pv = k.pv;
      if (!pv) continue;
      if (!k.hidden && typing && !lost && k.type === 'text' && !pv.isConnected && !k.dropped && k.text && WS_ONLY.test(k.text)) {
        const data = pv.data;
        pv.data = k.text;
        pvParent.insertBefore(pv, cursor ? cursor.nextSibling : pvParent.firstChild);
        if (unseenEdge(pv, true) || unseenEdge(pv, false)) { moved = true; cursor = pv; continue; }
        pv.remove();
        pv.data = data;
        continue;
      }
      if (k.hidden) {
        if (!pv.isConnected) {
          if (k.dropped) continue;                                                 // removed on purpose by a command
          const next = cursor ? cursor.nextSibling : pvParent.firstChild;
          const blank = (n) => !!n && n.nodeType === 3 && !/[^ \t\n\f\r]/.test(n.data);
          if (pv.nodeType === 3 && (lost || blank(cursor) || blank(next))) continue;      // no runs of empty lines, no indentation of a removed element
          if (pv.nodeType === 3 && pv.data !== k.text) pv.data = k.text;                  // the engine may have emptied it before taking it out
          pvParent.insertBefore(pv, next);
          moved = true;
        }
        if (pv.parentNode === pvParent) cursor = pv;
      } else if (pv.isConnected) {
        if (pv.parentNode === pvParent) cursor = pv;
        if (k.type === 'el' && k.ok) walk(k, pv, null, false);
      } else if (k.type === 'el' && k.ok) cursor = walk(k, pvParent, cursor, true);
    }
    return cursor;
  };
  if (view.ok) walk(view.body, view.body.pv, null, false);
  return moved;
}

// Returns the new document text for the current state of the preview body. `points` is an optional list of
// { node, offset } preview positions; `sel` holds their offsets in the new text (or null).
// `typing`: every pending input was an insertion (see engineTidied).
export function serializeBody(view, info, pvBody, points, typing) {
  const src = view.src, body = view.body;
  const ctx = { view, src, info, typing: !!typing, s: '', before: src.slice(Math.max(0, body.tagEnd - 200), body.tagEnd), points: points || [], memo: new Map(), top: pvBody };
  const own = body.virtual ? '' : lineIndentAt(src, body.start);
  emitKids(ctx, pvBody, body, own == null ? '' : own);
  return {
    text: src.slice(0, body.tagEnd) + ctx.s + src.slice(body.closeStart),
    sel: ctx.points.map((p) => (p.out == null ? null : body.tagEnd + p.out)),
  };
}
