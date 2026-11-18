// Preview DOM -> source text.
//
// Only the body content is rewritten; everything else in the document stays byte for byte as it is. Inside the
// body, every node that still looks exactly as it was rendered is copied verbatim from the source text
// (including inactive scripts, attributes, comments and character references). Only edited text and new
// elements are written fresh, with a small fixed vocabulary of plain tags.
import { words, escapeText, escapeAttr, commonPrefix, commonSuffix, isSafeHref, isRasterDataUrl } from './util.js';
import { VOID_TAGS } from './tokenizer.js';
import { HTML_NS, HREF_HOLDER, rawPos, srcOffsetOf } from './project.js';

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
  let ok = !!inf;
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
    if (ct && ct.type === 'el' && !ct.implied && !ct.synthetic) {
      const ind = lineIndentAt(ctx.src, ct.start);
      if (ind != null) return ind;
      break;
    }
  }
  return t && t.virtual ? '' : parentIndent + '  ';
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
  let attrs = '';
  if (known) {
    for (const a of Array.from(c.attributes)) {
      const n = a.name.toLowerCase();
      let outName = n;
      if (n === HREF_HOLDER) { if (name !== 'a' || !isSafeHref(a.value)) continue; outName = 'href'; }
      else if (n === 'src') { if (name !== 'img' || !isRasterDataUrl(a.value)) continue; }
      else if (n.startsWith('on') || n.startsWith('data-se-') || n === 'style' || n === 'id' || n === 'href' || n === 'contenteditable') continue;
      else if (!/^[a-z][a-z0-9_:.\-]*$/.test(n)) continue;
      attrs += ' ' + outName + '="' + escapeAttr(a.value) + '"';
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
  if (t && !inf.rename && (standIn || isClean(ctx, c))) {
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
  ctx.s += t.synthetic ? '<' + name + '>' : inf.rename ? '<' + name + src.slice(t.nameEnd, t.tagEnd) : src.slice(t.start, t.tagEnd);
  if (VOID_TAGS.has(name)) return false;
  const own = lineIndentAt(src, t.start);
  emitKids(ctx, c, t, own == null ? indent : own);
  if (inf.rename) ctx.s += '</' + name + '>';
  else if (t.explicitEnd) ctx.s += src.slice(t.closeStart, t.end);
  else if (t.synthetic || needsEndTag(ctx, c, t)) ctx.s += '</' + (t.synthetic ? name : src.slice(t.start + 1, t.nameEnd)) + '>';
  return false;
}

// Content without a visible counterpart (comments, scripts, style and similar elements) must not disappear from
// the source just because the browser's editing engine dropped its invisible stand-in while joining or deleting
// text. Such stand-ins are put back next to their surviving neighbours before the text is written.
export function rescueHidden(view) {
  let moved = false;
  const walk = (t, pvParent, cursor) => {
    for (const k of t.mk || []) {
      const pv = k.pv;
      if (!pv) continue;
      if (k.hidden) {
        if (!pv.isConnected) {
          const next = cursor ? cursor.nextSibling : pvParent.firstChild;
          const blank = (n) => !!n && n.nodeType === 3 && !/[^ \t\n\f\r]/.test(n.data);
          if (pv.nodeType === 3 && (blank(cursor) || blank(next))) continue;      // no runs of empty lines
          pvParent.insertBefore(pv, next);
          moved = true;
        }
        if (pv.parentNode === pvParent) cursor = pv;
      } else if (pv.isConnected) {
        if (pv.parentNode === pvParent) cursor = pv;
        if (k.type === 'el' && k.ok) walk(k, pv, null);
      } else if (k.type === 'el' && k.ok) cursor = walk(k, pvParent, cursor);
    }
    return cursor;
  };
  if (view.ok) walk(view.body, view.body.pv, null);
  return moved;
}

// Returns the new document text for the current state of the preview body. `points` is an optional list of
// { node, offset } preview positions; `sel` holds their offsets in the new text (or null).
export function serializeBody(view, info, pvBody, points) {
  const src = view.src, body = view.body;
  const ctx = { view, src, info, s: '', before: src.slice(Math.max(0, body.tagEnd - 200), body.tagEnd), points: points || [], memo: new Map(), top: pvBody };
  const own = body.virtual ? '' : lineIndentAt(src, body.start);
  emitKids(ctx, pvBody, body, own == null ? '' : own);
  return {
    text: src.slice(0, body.tagEnd) + ctx.s + src.slice(body.closeStart),
    sel: ctx.points.map((p) => (p.out == null ? null : body.tagEnd + p.out)),
  };
}
