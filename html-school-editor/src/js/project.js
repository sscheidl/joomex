// Source text -> safe visual projection.
//
// analyze()    parses the text twice: with the browser's own parser (inert document, nothing runs or loads) and
//              with the position tree from tree.js. Only where both agree is a part of the page editable.
// renderView() brings the preview document in line with that analysis by changing as little as possible, so
//              caret, selection and scroll position survive. Dangerous or network-bound content is never
//              created in the preview; it stays untouched in the source text.
import { words, isRasterDataUrl, fileOfSrc, cssRisks } from './util.js';
import { parseHtml, locateBody } from './tree.js';

export const HTML_NS = 'http://www.w3.org/1999/xhtml';
export const HREF_HOLDER = 'data-se-href';
export const FILE_HOLDER = 'data-se-file';      // address of an image as written in the source

const DROP = words('script link meta base title template noframes noembed frameset frame param source track head html body');
const BOX = Object.assign(Object.create(null), { iframe: 'Eingebettete Seite', object: 'Eingebettetes Objekt', embed: 'Eingebettetes Objekt', applet: 'Eingebettetes Objekt', audio: 'Audio', video: 'Video', portal: 'Eingebettete Seite', fencedframe: 'Eingebettete Seite' });
const LOCKED = words('svg math select textarea input button canvas style');
const DROP_ATTRS = words('contenteditable autofocus srcdoc formaction action ping background poster data manifest http-equiv target sandbox integrity nonce srcset imagesrcset imagesizes sizes lowsrc dynsrc codebase archive classid code is');
const LEADING_LF = words('pre textarea listing');
const NAMED = words('img form embed object iframe');
// SVG animation can assign an address to an attribute after the attributes were filtered, so it is not shown.
const ANIM = words('set animate animatemotion animatetransform animatecolor discard');
const CSS_FETCH = /url\s*\(\s*['"]?\s*(?!data:|#|['"]?\s*\))|@import|image-set\s*\(/i;
// What an image that is not shown says on its box (IMG_BOX) and when the mouse rests on it (IMG_HELP).
const IMG_BOX = { lost: 'Bild nicht gefunden: ', file: 'Bild: ', net: 'Bild aus dem Internet', other: 'Bild wird im Editor nicht angezeigt' };
const IMG_HELP = {
  lost: 'Unter dieser Adresse liegt keine Bilddatei. Lege das Bild an diese Stelle im Ordner deiner Seite oder ändere die Adresse. Deine Seite muss im selben Ordner liegen wie der Editor.',
  file: 'Der Editor zeigt Bilder nur an, wenn er selbst als Datei aus dem Ordner deiner Seite geöffnet ist.',
  net: 'Bilder aus dem Internet zeigt der Editor nicht an. Lade das Bild herunter (denk an das Urheberrecht), lege es in den Ordner deiner Seite und verlinke es mit dem Dateinamen.',
  other: 'Dieses Bild zeigt der Editor nicht an. Im Code bleibt es erhalten.',
};

const isWsOnly = (s) => !/[^ \t\n\f\r]/.test(s);

// Inside a form, controls named like DOM properties (name="childNodes") shadow those properties on the form
// element. Nodes of an opened document are therefore read through the original accessors only.
const accessor = (proto, name) => { const get = Object.getOwnPropertyDescriptor(proto, name).get; return (node) => get.call(node); };
const typeOf = accessor(Node.prototype, 'nodeType');
const rawChildren = accessor(Node.prototype, 'childNodes');
const childrenOf = (node) => Array.from(rawChildren(node));
const textOf = accessor(Node.prototype, 'textContent');
const nameOf = accessor(Element.prototype, 'localName');
const nsOf = accessor(Element.prototype, 'namespaceURI');
const rawAttrs = accessor(Element.prototype, 'attributes');
const attrsOf = (el) => Array.from(rawAttrs(el));
const attrOf = (el, name) => Element.prototype.getAttribute.call(el, name);
const docBody = accessor(Document.prototype, 'body');
const docHead = accessor(Document.prototype, 'head');
const docRoot = accessor(Document.prototype, 'documentElement');
const docTitle = accessor(Document.prototype, 'title');
const docMode = accessor(Document.prototype, 'compatMode');
const docType = accessor(Document.prototype, 'doctype');
const bodyOf = (dom) => { const b = docBody(dom); return b && nameOf(b) === 'body' ? b : null; };

// ---------------------------------------------------------------- character references

let decoderEl = null;
export function decodeText(raw) {
  if (raw.indexOf('&') < 0 && raw.indexOf('\r') < 0 && raw.indexOf('\0') < 0) return raw;
  if (!decoderEl) decoderEl = document.implementation.createHTMLDocument('').createElement('textarea');
  decoderEl.innerHTML = raw;
  return decoderEl.textContent;
}

const refCache = new Map();
function refValue(ref) {
  let v = refCache.get(ref);
  if (v === undefined) { v = decodeText(ref); refCache.set(ref, v); }
  return v;
}

// Converts an offset in the decoded text of a text node into [source offset, decoded offset]. An offset inside
// a character reference snaps to its start (or to its end with `up`).
export function rawPos(src, t, dec, up) {
  const base = t.start + (t.skip || 0);
  if (t.raw === 'literal') return [base + dec, dec];
  const raw = src.slice(base, t.end);
  if (raw.indexOf('&') < 0) return [base + dec, dec];
  const re = /&(?:#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);?/g;
  let di = 0, ri = 0, m;
  while ((m = re.exec(raw))) {
    const val = refValue(m[0]);
    if (val === m[0]) continue;
    const lit = m.index - ri;
    if (dec <= di + lit) return [base + ri + (dec - di), dec];
    di += lit; ri = m.index;
    if (dec < di + val.length) return up ? [base + ri + m[0].length, di + val.length] : [base + ri, di];
    di += val.length; ri += m[0].length;
  }
  return [base + ri + (dec - di), dec];
}

// ---------------------------------------------------------------- analysis

export function analyze(src, tokens) {
  const dom = new DOMParser().parseFromString(src, 'text/html');
  const tree = parseHtml(src, docMode(dom) === 'BackCompat', tokens);
  const body = locateBody(tree.root, src);
  const view = { src, dom, tree, body, ok: false };
  const domBody = bodyOf(dom);
  if (domBody) view.ok = matchKids(src, body, domBody, true);
  return view;
}

// Compares the children of position-tree node `t` with DOM element `d`. On success `t.mk` / `t.dk` hold the
// aligned child lists. A difference inside a child element only marks that child as not editable (`ok`).
// `isTail`: the element is still open where the body ends, so the browser appends the white space that follows
// the body's end tag to its last text.
function matchKids(src, t, d, isTail) {
  const dk = childrenOf(d);
  const mk = [];
  for (const k of t.kids) {
    if (k.type === 'text') {
      k.skip = k === t.kids[0] && LEADING_LF.has(t.name) && src.charCodeAt(k.start) === 10 ? 1 : 0;
      const raw = src.slice(k.start + k.skip, k.end);
      k.text = k.raw === 'literal' ? raw : decodeText(raw);
      if (!k.text) continue;
    }
    mk.push(k);
  }
  // Whitespace written behind </body> ends up at the end of the body element.
  if (isTail && dk.length === mk.length + 1 && typeOf(dk[dk.length - 1]) === 3 && isWsOnly(dk[dk.length - 1].data)) dk.pop();
  if (mk.length !== dk.length) return false;
  for (let i = 0; i < mk.length; i++) {
    const a = mk[i], b = dk[i];
    if (a.type === 'text') {
      if (typeOf(b) !== 3) return false;
      if (b.data !== a.text && !(isTail && i === mk.length - 1 && b.data.startsWith(a.text) && isWsOnly(b.data.slice(a.text.length)))) return false;
    } else if (a.type === 'comment') {
      if (typeOf(b) !== 8) return false;
    } else if (a.type === 'el') {
      if (typeOf(b) !== 1 || nameOf(b).toLowerCase() !== a.name) return false;
      a.ok = nameOf(b) !== 'template' && matchKids(src, a, b, isTail && i === mk.length - 1 && !a.explicitEnd && !a.synthetic);
    } else return false;
  }
  t.mk = mk;
  t.dk = dk;
  return true;
}

// ---------------------------------------------------------------- inactive content report

function newReport() {
  return { scripts: 0, handlers: 0, images: 0, frames: 0, sheets: 0, css: 0, forms: 0, refresh: 0, other: 0, anims: 0, files: 0, lost: [] };
}

export function reportText(r) {
  const parts = [];
  const add = (n, one, many) => { if (n) parts.push(n === 1 ? one : n + ' ' + many); };
  add(r.scripts + r.handlers, '1 Skript', 'Skripte');
  add(r.images, '1 Bild von außerhalb', 'Bilder von außerhalb');
  add(r.files, '1 Bild aus einer Datei', 'Bilder aus Dateien');
  add(r.sheets, '1 externe CSS-Datei', 'externe CSS-Dateien');
  add(r.css, '1 Adresse im CSS', 'Adressen im CSS');
  add(r.frames, '1 eingebetteter Inhalt', 'eingebettete Inhalte');
  add(r.forms, '1 Formular', 'Formulare');
  add(r.anims, '1 Animation', 'Animationen');
  add(r.refresh + r.other, '1 weiterer Verweis', 'weitere Verweise');
  return parts.join(', ');
}

// ---------------------------------------------------------------- projection

// A picture that says in words why the image is not shown. It is an SVG image in a data address: the page
// pane's policy allows data images, and an SVG shown as an image never runs anything.
function boxPicture(text) {
  const t = text.length > 70 ? text.slice(0, 67) + '…' : text;
  const w = Math.min(560, 24 + Math.ceil(t.length * 7.2));
  const xml = t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="40"><rect x="1" y="1" width="' + (w - 2) + '" height="38" rx="6" fill="#f1f3f5" stroke="#adb5bd" stroke-width="2" stroke-dasharray="6 4"/><text x="12" y="25" font-family="sans-serif" font-size="13" fill="#495057">' + xml + '</text></svg>');
}

// `local`: how the page pane finds picture files, or null. `local.url(address)` gives the file address of a
// plain relative address (see localFileUrl in util.js) or ''; `local.missing` holds the file addresses that
// could not be loaded. An image whose file is there is shown from it. Any other image becomes a picture that
// names the reason; a missing file is also listed in `rep.lost`.
function safeAttrs(d, name, html, rep, local) {
  const out = [];
  let blockedImage = null, hasTitle = false, why = '';
  for (const a of attrsOf(d)) {
    const n = a.name, ln = n.toLowerCase(), v = a.value;
    if (ln.startsWith('on')) { rep.handlers++; continue; }
    if (ln === 'name' && NAMED.has(name)) continue;          // would become a property of the preview document
    if (ln.startsWith('data-se-')) continue;
    if (DROP_ATTRS.has(ln)) { if (ln === 'srcset' || ln === 'background' || ln === 'poster') rep.images++; continue; }
    if (ln === 'href' || ln === 'xlink:href') {
      if (html && (name === 'a' || name === 'area')) { out.push([HREF_HOLDER, v]); continue; }
      if (!v.startsWith('#')) { rep.other++; continue; }
    } else if (ln === 'src') {
      if (name === 'img' && html && isRasterDataUrl(v)) { out.push([n, v]); continue; }
      if (name === 'img') {
        const file = html ? fileOfSrc(v) : '', url = file && local ? local.url(v) : '';
        if (url && !local.missing.has(url)) { out.push([n, url], [FILE_HOLDER, v]); continue; }
        blockedImage = v;
        why = url ? 'lost' : file ? 'file' : /^\s*(?:https?:|[\/\\]{2})/i.test(v) ? 'net' : 'other';
        if (url) { if (rep.lost.indexOf(v) < 0) rep.lost.push(v); } else if (file) rep.files++; else rep.images++;
      } else rep.other++;
      continue;
    } else if (ln === 'style') {
      if (CSS_FETCH.test(v)) rep.css++;
    } else if (ln === 'title') hasTitle = true;
    else if (!html && CSS_FETCH.test(v)) rep.css++;            // SVG presentation attributes take CSS values
    out.push([n, v]);
  }
  if (blockedImage !== null) {
    const shortSrc = blockedImage.length > 60 ? blockedImage.slice(0, 57) + '…' : blockedImage;
    out.push(['src', boxPicture(IMG_BOX[why] + (why === 'lost' || why === 'file' ? shortSrc : ''))], ['data-se-src', shortSrc], [FILE_HOLDER, blockedImage]);
    if (!hasTitle) out.push(['title', IMG_HELP[why]]);
  }
  return out;
}

function describe(d, t, st) {
  const kind = typeOf(d);
  if (kind === 3) return { k: 3, data: t ? t.text : d.data };
  if (kind !== 1) return { k: 8, data: kind === 8 ? d.data : '' };
  const name = nameOf(d), html = nsOf(d) === HTML_NS, rep = st.report;
  if (name === 'script' || (html && DROP.has(name))) {
    if (name === 'script') rep.scripts++;
    else if (name === 'link') { if (/stylesheet/i.test(attrOf(d, 'rel') || '')) rep.sheets++; else rep.other++; }
    else if (name === 'meta') { if (/refresh/i.test(attrOf(d, 'http-equiv') || '')) rep.refresh++; }
    else if (name === 'base') rep.other++;
    else if (name === 'frame' || name === 'frameset') rep.frames++;
    return { k: 8, data: 'se:' + name };
  }
  if (!html && ANIM.has(name.toLowerCase())) { rep.anims++; return { k: 8, data: 'se:' + name }; }
  if (html && BOX[name]) {
    rep.frames++;
    return { k: 1, name: 'span', ns: HTML_NS, attrs: [['contenteditable', 'false'], ['data-se-box', '']], fixed: BOX[name] + ' (im Editor ausgeschaltet)' };
  }
  const attrs = safeAttrs(d, name, html, rep, st.local);
  if (t && !t.ok) {
    attrs.push(['contenteditable', 'false'], ['data-se-opaque', '']);
    if (attrOf(d, 'title') === null) attrs.push(['title', 'Diese Stelle kannst du nur links im Code ändern.']);
  } else if (LOCKED.has(name)) attrs.push(['contenteditable', 'false']);
  if (name === 'style' && CSS_FETCH.test(textOf(d))) rep.css++;
  if (html && name === 'form') {
    // A real form element would let its controls shadow DOM properties and could be submitted; a plain block
    // stands in for it. The source keeps the form unchanged.
    rep.forms++;
    attrs.push(['data-se-form', '']);
    return { k: 1, name: 'div', ns: HTML_NS, attrs, kids: true };
  }
  return { k: 1, name, ns: nsOf(d), attrs, kids: true };
}

const fits = (node, desc) => node.nodeType === desc.k && (desc.k !== 1 || (node.localName === desc.name && node.namespaceURI === desc.ns));

function syncAttrs(el, attrs, st) {
  const want = new Set();
  for (const pair of attrs) want.add(pair[0]);
  for (const a of Array.from(el.attributes)) if (!want.has(a.name)) { el.removeAttribute(a.name); st.attrChanged = true; }
  for (const pair of attrs) {
    if (el.getAttribute(pair[0]) === pair[1]) continue;
    try { el.setAttribute(pair[0], pair[1]); st.attrChanged = true; } catch (e) { /* name not allowed by the DOM: leave it out */ }
  }
}

function make(desc, st) {
  if (desc.k === 3) return st.doc.createTextNode('');
  if (desc.k === 8) return st.doc.createComment('');
  try { return st.doc.createElementNS(desc.ns, desc.name); } catch (e) { return st.doc.createElement('span'); }
}

// Makes the children of preview node `pv` equal to the projection of `dNodes`. `tKids` is the aligned list of
// position-tree nodes, or null inside a part that is not editable.
function syncKids(pv, tKids, dNodes, st) {
  const old = Array.from(pv.childNodes), n = dNodes.length;
  const descs = new Array(n);
  for (let i = 0; i < n; i++) descs[i] = describe(dNodes[i], tKids ? tKids[i] : null, st);
  // An existing node is kept if it has the right kind. A <br> must also be one of our own: in an empty page
  // some browsers (Firefox) keep a line break of their own there, which they remove again when they like.
  const keep = (node, desc) => fits(node, desc) && (desc.k !== 1 || desc.name !== 'br' || st.info.has(node));
  let a = 0;
  while (a < old.length && a < n && keep(old[a], descs[a])) a++;
  let bo = old.length, bn = n;
  while (bo > a && bn > a && keep(old[bo - 1], descs[bn - 1])) { bo--; bn--; }
  const update = (node, j) => {
    const desc = descs[j], t = tKids ? tKids[j] : null;
    if (desc.k !== 1) {
      if (node.data !== desc.data) { node.data = desc.data; st.changed = true; }
      st.info.set(node, { t, data: desc.data });
    } else {
      syncAttrs(node, desc.attrs, st);
      if (desc.fixed !== undefined) {
        if (node.textContent !== desc.fixed) node.textContent = desc.fixed;
        st.info.set(node.firstChild, { t: null, data: desc.fixed });
      }
      else {
        const d = dNodes[j];
        if (t && t.ok) syncKids(node, t.mk, t.dk, st);
        else syncKids(node, null, nameOf(d) === 'template' ? [] : childrenOf(d), st);
      }
      st.info.set(node, { t, kids: Array.from(node.childNodes) });
    }
    if (t) {
      t.pv = node;
      // no visible counterpart: comments, stand-ins, style elements, line breaks between elements
      t.hidden = desc.k === 8 || (desc.k === 1 && desc.name === 'style') || (desc.k === 3 && pv.localName !== 'pre' && pv.localName !== 'textarea' && /^[ \t\f\r]*\n[ \t\n\f\r]*$/.test(desc.data));
    }
  };
  for (let i = 0; i < a; i++) update(old[i], i);
  for (let j = bn; j < n; j++) update(old[bo + j - bn], j);
  for (let i = a; i < bo; i++) {
    pv.removeChild(old[i]);
    // A line break that the browser put into the page for itself is not part of the projection: taking it out
    // (the browser may put it back) does not count as a change of the page.
    if (!(pv === st.doc.body && old[i].nodeType === 1 && old[i].localName === 'br' && !st.info.has(old[i]))) st.changed = true;
  }
  const ref = bo < old.length ? old[bo] : null;
  for (let j = a; j < bn; j++) {
    const node = make(descs[j], st);
    update(node, j);
    pv.insertBefore(node, ref);
    st.changed = true;
  }
}

function syncHead(view, st) {
  const head = st.doc.head, rep = st.report;
  const styles = [];
  const srcHead = docHead(view.dom);
  if (srcHead) {
    for (const el of childrenOf(srcHead)) {
      if (typeOf(el) !== 1) continue;
      const name = nameOf(el);
      if (name === 'style') { styles.push(el); if (CSS_FETCH.test(textOf(el))) rep.css++; }
      else if (name === 'script') rep.scripts++;
      else if (name === 'link') { if (/stylesheet/i.test(attrOf(el, 'rel') || '')) rep.sheets++; }
      else if (name === 'meta') { if (/refresh/i.test(attrOf(el, 'http-equiv') || '')) rep.refresh++; }
      else if (name === 'base') rep.other++;
    }
  }
  const have = Array.from(head.querySelectorAll('style[data-se-user]'));
  while (have.length > styles.length) have.pop().remove();
  styles.forEach((el, i) => {
    let target = have[i];
    if (!target) { target = st.doc.createElement('style'); target.setAttribute('data-se-user', ''); head.appendChild(target); }
    if (target.textContent !== textOf(el)) target.textContent = textOf(el);
    const media = attrOf(el, 'media');
    if (media === null) target.removeAttribute('media'); else if (target.getAttribute('media') !== media) target.setAttribute('media', media);
  });
}

// Updates the preview document `doc`. `info` (WeakMap) receives, for every preview node, its source node and a
// snapshot of its rendered state; the serializer uses the snapshot to tell edited parts from untouched ones.
export function renderView(view, doc, info, local) {
  const st = { doc, info, local: local || null, report: newReport(), changed: false, attrChanged: false };
  const dom = view.dom;
  syncHead(view, st);
  syncAttrs(doc.documentElement, safeAttrs(docRoot(dom), 'html', true, st.report, null), st);
  const srcBody = bodyOf(dom);
  const bodyAttrs = srcBody ? safeAttrs(srcBody, 'body', true, st.report, null) : [];
  bodyAttrs.push(['contenteditable', view.ok ? 'true' : 'false']);
  syncAttrs(doc.body, bodyAttrs, st);
  if (docBody(dom) && !srcBody) st.report.frames++;
  if (view.ok) syncKids(doc.body, view.body.mk, view.body.dk, st);
  else syncKids(doc.body, null, srcBody ? childrenOf(srcBody) : [], st);
  info.set(doc.body, { t: view.ok ? view.body : null, kids: Array.from(doc.body.childNodes) });
  view.body.pv = doc.body;
  return { changed: st.changed, report: st.report, title: docTitle(dom) };
}

// ---------------------------------------------------------------- position mapping (preview in sync with the text)

export function srcOffsetOf(view, info, node, offset) {
  const inf = info.get(node);
  if (!inf || !inf.t) {
    for (let p = node.parentNode; p; p = p.parentNode) { const pi = info.get(p); if (pi && pi.t) return pi.t.start; }
    return view.body.tagEnd;
  }
  const t = inf.t;
  if (node.nodeType === 3) return rawPos(view.src, t, Math.min(offset, node.data.length), false)[0];
  if (node.nodeType !== 1) return t.start;
  const c = node.childNodes[offset];
  if (c) { const ci = info.get(c); if (ci && ci.t) return ci.t.lead; }
  return offset >= node.childNodes.length ? t.tail : t.tagEnd;
}

// Source range of the element around a preview node (not the body itself), or null.
export function srcElementRange(info, body, node) {
  for (let p = node; p && p !== body; p = p.parentNode) {
    const inf = info.get(p);
    if (p.nodeType === 1 && inf && inf.t && inf.t.end > inf.t.start) return [inf.t.start, inf.t.end];
  }
  return null;
}

const isLeafPv = (pv) => !pv || pv.nodeType !== 1 || pv.hasAttribute('data-se-box');

// Preview position { node, offset } for a source offset inside the body.
export function previewPosOf(view, off) {
  if (!view.ok) return null;
  const src = view.src;
  let t = view.body;
  off = Math.max(t.tagEnd, Math.min(off, t.closeStart));
  for (;;) {
    const kids = t.mk || [];
    let idx = 0;
    while (idx < kids.length && off >= kids[idx].end) idx++;
    const hit = kids[idx];
    const prev = kids[idx - 1];
    const between = () => (prev && prev.type === 'text' ? { node: prev.pv, offset: prev.pv.data.length } : { node: t.pv, offset: idx });
    if (!hit) return between();
    if (hit.type === 'text') {
      const from = hit.start + (hit.skip || 0);
      if (off <= from) return { node: hit.pv, offset: 0 };
      return { node: hit.pv, offset: Math.min(hit.pv.data.length, hit.raw === 'literal' ? off - from : decodeText(src.slice(from, off)).length) };
    }
    if (hit.type !== 'el' || off < hit.tagEnd || !hit.ok || isLeafPv(hit.pv) || hit.tagEnd === hit.end) return between();
    if (off > hit.closeStart) return { node: t.pv, offset: idx + 1 };
    t = hit;
  }
}

// Deepest editable element of the position tree whose source range contains `off`, or null.
export function srcElementAt(view, off) {
  if (!view.ok) return null;
  let t = view.body, found = null;
  for (;;) {
    const els = (t.mk || []).filter((k) => k.type === 'el' && k.end > k.start && k.pv && k.pv.nodeType === 1);
    const hit = els.find((k) => off >= k.start && off < k.end) || els.find((k) => off === k.end);
    if (!hit) return found;
    found = hit;
    if (!hit.ok) return found;
    t = hit;
  }
}

// ---------------------------------------------------------------- formatter verification

// Canonical description of a parsed document that ignores exactly the white-space differences the formatter
// is allowed to introduce (see format.js). Two documents with the same canonical form render the same.
export function canonDom(doc, blockNames, keepNames) {
  const toks = [];
  const walk = (node, keep) => {
    for (const c of childrenOf(node)) {
      const kind = typeOf(c);
      if (kind === 3) toks.push({ text: keep ? c.data : c.data.replace(/[ \t\n\f\r]+/g, ' '), keep });
      else if (kind === 8) toks.push({ comment: true, s: '<!--' + c.data + '-->' });
      else if (kind === 1) {
        const name = nameOf(c), block = blockNames.has(name) || name === 'br';
        let s = '<' + name;
        for (const a of attrsOf(c)) s += ' ' + a.name + '=' + JSON.stringify(a.value);
        toks.push({ block, s: s + '>' });
        walk(name === 'template' && c.content ? c.content : c, keep || keepNames.has(name));
        toks.push({ block, s: '</' + name + '>' });
      }
    }
  };
  walk(doc, false);
  const boundary = (i, dir) => {
    for (let j = i + dir; ; j += dir) {
      const k = toks[j];
      if (!k) return true;
      if (k.comment || k.text === '') continue;
      return !!k.block;
    }
  };
  for (let again = true; again;) {
    again = false;
    for (let i = 0; i < toks.length; i++) {
      const k = toks[i];
      if (k.text == null || k.keep || k.text === '') continue;
      let v = k.text;
      if (v[0] === ' ' && boundary(i, -1)) v = v.replace(/^ +/, '');
      if (v[v.length - 1] === ' ' && boundary(i, 1)) v = v.replace(/ +$/, '');
      if (v !== k.text) { k.text = v; again = true; }
    }
  }
  const dt = docType(doc);
  let out = dt ? '<!' + dt.name + '|' + dt.publicId + '|' + dt.systemId + '>' : '';
  out += docMode(doc);
  for (const k of toks) out += k.text != null ? (k.text === '' ? '' : JSON.stringify(k.text)) : k.s;
  return out;
}

// What the style rules of a parsed document say that matters for moving white space (see cssRisks in util.js):
// `spaces`, `conditional`, `unclear`, and `external` if rules come from a file the editor does not read. Every
// style element and every style attribute is read as CSS, with comments, strings and escapes respected.
export function cssFacts(dom) {
  const facts = { spaces: false, external: false, conditional: false, unclear: false };
  const walk = (node) => {
    for (const c of childrenOf(node)) {
      if (typeOf(c) !== 1) continue;
      const name = nameOf(c);
      if (name === 'style') cssRisks(textOf(c), facts);
      else if (name === 'link' && /stylesheet/i.test(attrOf(c, 'rel') || '')) facts.external = true;
      const own = attrOf(c, 'style');
      if (own) cssRisks(own, facts);
      walk(c);
    }
  };
  walk(dom);
  return facts;
}

// True if a part of the laid-out page that is not shown at the moment (hidden attribute, closed details,
// display: none of an ancestor) would not follow the default display of its elements once it is shown: a
// block element displayed inline, or generated content at its edge. Such a part has no boxes, so the layout
// comparison cannot answer for it.
export function hiddenLayoutRisk(doc, blockNames) {
  const view = doc.defaultView;
  const walker = doc.createTreeWalker(doc.body, 1);
  for (let el = walker.nextNode(); el; el = walker.nextNode()) {
    if (!blockNames.has(el.localName) || el.namespaceURI !== HTML_NS || el.getClientRects().length) continue;
    const display = view.getComputedStyle(el).display;
    if (display === 'none') continue;                           // hidden by its own rule: nothing to compare with
    if (/^inline|^contents$|^ruby/.test(display)) return true;
    for (const pseudo of ['::before', '::after']) {
      const content = view.getComputedStyle(el, pseudo).content;
      if (content && content !== 'none' && content !== 'normal') return true;
    }
  }
  return false;
}

// Where every element box and every rendered piece of text of a laid-out document lies, in quarter pixels.
// Two versions of a page that differ only in white space look the same exactly if these lists are equal: white
// space that is not rendered has no width, white space that is rendered moves something or has a width itself.
// (For white space between blocks Firefox reports a box with a height and no width; that is not a rendering.)
export function layoutPrint(doc) {
  const out = [];
  const add = (r) => { out.push(Math.round(r.left * 4), Math.round(r.top * 4), Math.round(r.width * 4), Math.round(r.height * 4)); };
  const range = doc.createRange();
  const walker = doc.createTreeWalker(doc.documentElement, 5);
  for (let n = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === 1) { add(n.getBoundingClientRect()); continue; }
    range.selectNodeContents(n);
    const r = range.getBoundingClientRect();
    if (/[^ \t\n\f\r]/.test(n.data)) add(r);
    else if (r.width) add(r);
  }
  return out.join(',');
}
