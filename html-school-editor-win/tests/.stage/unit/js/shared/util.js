// Small pure helpers shared by all modules (no DOM access).

export const words = (s) => new Set(s.split(' '));

export function escapeText(s) {
  return s.replace(/[&<>\u00a0]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&nbsp;'));
}

export function escapeAttr(s) {
  return s.replace(/[&"<\u00a0]/g, (c) => (c === '&' ? '&amp;' : c === '"' ? '&quot;' : c === '<' ? '&lt;' : '&nbsp;'));
}

export function commonPrefix(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

export function commonSuffix(a, b, skip) {
  const n = Math.min(a.length, b.length) - skip;
  let i = 0;
  while (i < n && a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)) i++;
  return i;
}

// Maps a caret offset in `oldText` to the matching offset in `newText` by keeping the unchanged
// prefix and suffix fixed. An offset inside the changed region lands at the end of the new region.
export function mapOffset(oldText, newText, pos) {
  if (oldText === newText) return pos;
  const p = commonPrefix(oldText, newText);
  if (pos <= p) return pos;
  const s = commonSuffix(oldText, newText, p);
  if (pos >= oldText.length - s) return pos + newText.length - oldText.length;
  return newText.length - s;
}

// End of the region that differs between two texts, as an offset in `newText`.
export function changeEnd(oldText, newText) {
  const p = commonPrefix(oldText, newText);
  return newText.length - commonSuffix(oldText, newText, p);
}

// ---------------------------------------------------------------- link addresses

const SAFE_SCHEMES = words('http https mailto tel');

// Validates an address typed into the link dialog. Input is plain text and is only ever stored as an
// attribute value; this check additionally refuses schemes that would run code when the saved page is used.
// Returns { ok: true, url } or { ok: false, reason }.
export function checkLinkUrl(input) {
  let url = String(input).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, '').trim();
  if (!url) return { ok: false, reason: 'empty' };
  if (url.length > 2000) return { ok: false, reason: 'long' };
  // A scheme may be disguised with whitespace, control characters or character references.
  const squeezed = url.replace(/\s+/g, '');
  const decoded = squeezed.replace(/&#x([0-9a-f]+);?/gi, (m, h) => safeChar(parseInt(h, 16)))
    .replace(/&#([0-9]+);?/g, (m, d) => safeChar(parseInt(d, 10)))
    .replace(/&(colon|tab|newline);?/gi, (m, n) => (n.toLowerCase() === 'colon' ? ':' : ''));
  for (const candidate of [squeezed, decoded]) {
    const m = /^([a-z][a-z0-9+.\-]*):/i.exec(candidate);
    if (m && !SAFE_SCHEMES.has(m[1].toLowerCase())) return { ok: false, reason: 'scheme' };
  }
  url = url.replace(/\s/g, '%20').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, '%22');
  if (/^www\.[^\s/]+\.[a-z]{2,}/i.test(url)) url = 'https://' + url;
  return { ok: true, url };
}

function safeChar(code) {
  return code > 32 && code < 0x10ffff ? String.fromCodePoint(code) : '';
}

// True for addresses that stay inert as an href in a saved page (used for links cloned inside the preview).
export function isSafeHref(value) {
  return checkLinkUrl(value).ok;
}

export function isRasterDataUrl(value) {
  return /^\s*data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]*$/i.test(value);
}

// ---------------------------------------------------------------- images by file name

// File name that an image address points to, if the address is a plain relative one ('' for addresses with a
// scheme, a host or a drive letter). "bilder/Meine%20Katze.jpg?x#y" gives "Meine Katze.jpg".
export function fileOfSrc(value) {
  const v = String(value).trim();
  if (!v || v.length > 600 || /^[a-z][a-z0-9+.\-]*:|^[\/\\]{2}/i.test(v) || /[\x00-\x1f]/.test(v)) return '';
  let name = v.split(/[?#]/)[0].split(/[\/\\]/).pop();
  try { name = decodeURIComponent(name); } catch (e) { /* keep the raw form */ }
  return name;
}

// Address written into the source for a chosen image file: optional folder plus file name.
// Returns { ok: true, src } or { ok: false }.
export function imagePath(folder, fileName) {
  const dir = String(folder).trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');
  if (dir.length > 200 || /[:?#"<>|*\x00-\x1f]/.test(dir) || /^\s|\s$/.test(dir)) return { ok: false };
  const name = String(fileName).replace(/%/g, '%25').replace(/#/g, '%23').replace(/\?/g, '%3F');
  if (!name || /[\/\\\x00-\x1f]/.test(name)) return { ok: false };
  return { ok: true, src: dir ? dir + '/' + name : name };
}

// The address with its folder replaced by `folder` (an address from imagePath): the file name, the query and
// the fragment stay exactly as written. Slashes behind '?' or '#' are not folders.
export function moveSrc(value, folder) {
  const v = String(value).trim(), cut = v.search(/[?#]/), path = (cut < 0 ? v : v.slice(0, cut)).replace(/\\/g, '/');
  return folder + path.slice(path.lastIndexOf('/') + 1) + (cut < 0 ? '' : v.slice(cut));
}

// Folder part of a relative image address ('' if there is none).
export function folderOfSrc(value) {
  const path = String(value).trim().split(/[?#]/)[0].replace(/\\/g, '/');
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
}

// The file that a plain relative image address names, seen from the editor's own file `base` (a URL): the
// editor lies in the folder of the pupil's pages, so the address means the same file from both. Returns the
// file address, or '' if the address is not a plain relative one, the editor was not opened as a file, or the
// result would lie on another computer.
export function localFileUrl(value, base) {
  if (!fileOfSrc(value) || !base || base.protocol !== 'file:') return '';
  let url;
  try { url = new URL(String(value).trim(), base.href); } catch (e) { return ''; }
  if (url.protocol !== 'file:' || url.host !== base.host) return '';
  url.hash = '';
  return url.href;
}

// ---------------------------------------------------------------- alignment in a style attribute

const ALIGN_VALUES = words('left right center justify');

// The alignment if the style consists of nothing but one text-align declaration, otherwise ''.
export function onlyAlign(style) {
  const m = /^\s*text-align\s*:\s*([a-z]+)\s*;?\s*$/i.exec(style);
  return m && ALIGN_VALUES.has(m[1].toLowerCase()) ? m[1].toLowerCase() : '';
}

// The colours of the palette: CSS colour names, no colour codes (owner's decision).
export const COLORS = words('red orange green blue navy purple brown gray');

// The style text of a new element if it holds nothing but what the editor writes itself (an alignment, a
// colour of the palette), written the editor's way; otherwise ''.
export function plainStyle(style) {
  const text = String(style), decls = styleDeclarations(text);
  if (!decls) return '';
  const out = [];
  for (const d of decls) {
    const piece = text.slice(d.start, d.end);
    if (!piece.trim()) continue;
    const m = /^\s*([a-z-]+)\s*:\s*([a-z]+)\s*$/i.exec(piece);
    const name = m ? m[1].toLowerCase() : '', v = m ? m[2].toLowerCase() : '';
    if (!(name === 'text-align' ? ALIGN_VALUES : name === 'color' ? COLORS : new Set()).has(v)) return '';
    out.push(name + ': ' + v);
  }
  return out.join('; ');
}

// The style text with its text-align declaration replaced by `value` ('' removes it); see withDecl.
export function withAlign(style, value) {
  return withDecl(style, 'text-align', value);
}

// Returns the style text with its declaration of the property `prop` replaced by `value` ('' removes it). Every
// other declaration stays exactly as written, and adding and removing again gives back the text that was there.
// Declarations are found by reading the text as CSS (strings, comments, escapes and brackets are respected),
// never by searching for the word. Returns null if the text cannot be split into declarations with certainty,
// or if a declaration that would change holds a comment (the comment would go with it) or "!important"; the
// caller then leaves the attribute alone. A single declaration that already has the value stays exactly as written.
export function withDecl(style, prop, value) {
  const text = String(style), decls = styleDeclarations(text);
  if (!decls) return null;
  const mine = decls.filter((d) => d.name === prop);
  // a comment would go with the declaration; "!important" too (pupils hardly ever write it, so it is left alone)
  if (mine.some((d) => text.slice(d.start, d.end).includes('/*') || /!\s*important/.test(cssPlain(text.slice(d.start, d.end))))) return null;
  const same = mine.length === 1 && /^\s*[a-z-]+\s*:\s*([a-z]+)\s*$/i.exec(text.slice(mine[0].start, mine[0].end));
  if (value && same && same[1].toLowerCase() === value) return text;
  let rest = text;
  for (let k = decls.length - 1; k >= 0; k--) {
    const d = decls[k];
    if (d.name !== prop) continue;
    // a declaration at the end goes together with the semicolon in front of it, any other with its own
    rest = k === decls.length - 1 ? rest.slice(0, k ? d.start - 1 : d.start) + rest.slice(d.end) : rest.slice(0, d.start) + rest.slice(d.end + 1);
  }
  // white space in front of and behind the whole text stays as written
  const lead = /^[ \t\n\f\r]*/.exec(text)[0], trail = text.length > lead.length ? /[ \t\n\f\r]*$/.exec(text)[0] : '';
  rest = rest.trim();
  if (!value) return rest ? lead + rest + trail : '';
  const decl = prop + ': ' + value;
  if (!rest) return lead + decl + trail;
  return lead + (/;$/.test(rest) ? rest + ' ' + decl + ';' : rest + '; ' + decl) + trail;
}

// ---------------------------------------------------------------- reading CSS text

// Position behind the piece of CSS that starts at `i`: a string, a comment, an escaped character, or one
// other character. -1 if a string or comment is not closed (the browser then reads the rest differently).
function cssSkip(css, i) {
  const ch = css[i];
  if (ch === '\\') return Math.min(i + 2, css.length);
  if (ch === '/' && css[i + 1] === '*') { const e = css.indexOf('*/', i + 2); return e < 0 ? -1 : e + 2; }
  if (ch === '"' || ch === "'") {
    for (let j = i + 1; j < css.length; j++) {
      if (css[j] === '\\') j++;
      else if (css[j] === ch) return j + 1;
      else if (css[j] === '\n') return -1;
    }
    return -1;
  }
  return i + 1;
}

// CSS text as the browser understands its names: comments removed, escapes resolved, lower case.
function cssPlain(text) {
  let out = '';
  for (let i = 0; i < text.length;) {
    const ch = text[i];
    if (ch === '/' && text[i + 1] === '*') { const e = text.indexOf('*/', i + 2); out += ' '; i = e < 0 ? text.length : e + 2; }
    else if (ch === '\\') {
      const m = /^\\([0-9a-f]{1,6})[ \t\n\f\r]?/i.exec(text.slice(i, i + 8));
      if (m) { out += String.fromCodePoint(Math.min(parseInt(m[1], 16), 0x10ffff) || 0xfffd); i += m[0].length; }
      else { out += text[i + 1] || ''; i += 2; }
    } else { out += ch; i++; }
  }
  return out.toLowerCase();
}

// Splits the text of a style attribute into its declarations: [{ start, end, name }], `end` in front of the
// semicolon, `name` the property name as the browser reads it. null if a string, comment or bracket is left
// open, because then the borders between the declarations are not certain.
export function styleDeclarations(style) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < style.length;) {
    const ch = style[i];
    if (ch === ';' && depth === 0) { out.push({ start, end: i }); start = ++i; continue; }
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') { if (--depth < 0) return null; }
    i = cssSkip(style, i);
    if (i < 0) return null;
  }
  if (depth) return null;
  out.push({ start, end: style.length });
  for (const d of out) {
    const plain = cssPlain(style.slice(d.start, d.end)), colon = plain.indexOf(':');
    d.name = colon < 0 ? '' : plain.slice(0, colon).trim();
  }
  return out;
}

const SPACE_PROPS = words('white-space white-space-collapse text-space-collapse');
const SPACE_KEEP = words('normal nowrap collapse wrap balance pretty stable initial inherit unset revert revert-layer');
const LAYOUT_PROPS = words('display content all');
const PLAIN_AT = words('font-face counter-style property namespace charset layer page font-feature-values font-palette-values color-profile');
const STATE = /:(?:hover|active|focus|focus-within|focus-visible|target|target-within|checked|indeterminate|default|enabled|disabled|read-only|read-write|placeholder-shown|valid|invalid|in-range|out-of-range|required|optional|user-valid|user-invalid|open|popover-open|modal|fullscreen|picture-in-picture|playing|paused|seeking|buffering|stalled|muted|volume-locked|autofill|current|past|future|state)(?![a-z0-9-])|\[\s*open(?![a-z0-9-])/;

// What a piece of CSS says that matters for moving white space in the HTML source ("tidy up"):
//   spaces       a rule may make every space count (white-space with a value outside the collapsing ones)
//   external     rules come from a file (@import)
//   conditional  a rule that holds only sometimes (other window width, print, pointer over an element, a
//                moment of an animation …) changes the kind of box, generated content or a custom property;
//                or such a property takes its value from a custom property. The layout comparison sees one
//                state of the page and cannot answer for the others.
//   unclear      a string or comment is not closed
// The text may be a style sheet or the content of a style attribute. `facts` collects the answers.
export function cssRisks(css, facts, sometimes0) {
  const declaration = (piece, conditional) => {
    const plain = cssPlain(piece).trim();
    if (plain[0] === '@') { if (plain.slice(0, 7) === '@import' && !/[a-z0-9-]/.test(plain[7] || '')) facts.external = true; return; }
    const colon = plain.indexOf(':');
    if (colon < 0) return;
    const name = plain.slice(0, colon).trim(), value = plain.slice(colon + 1).replace(/!\s*important\s*$/, '').trim();
    if (SPACE_PROPS.has(name) && !value.split(/[ \t\n\f\r]+/).every((w) => SPACE_KEEP.has(w))) facts.spaces = true;
    if (LAYOUT_PROPS.has(name) && (conditional || /(?:var|if)\s*\(/.test(value))) facts.conditional = true;
    if (conditional && name.startsWith('--')) facts.conditional = true;
    if (conditional && name.toLowerCase() === 'text-align') facts.align = true;     // an alignment that holds only sometimes
    if (name === 'text-align' && /!\s*important\s*$/.test(plain.slice(colon + 1))) facts.alignImportant = true;     // stronger than a style attribute
  };
  const sometimes = (prelude) => {
    const plain = cssPlain(prelude).trim();
    if (plain[0] !== '@') return STATE.test(plain);
    const m = /^@([a-z-]+)/.exec(plain);
    return !(m && PLAIN_AT.has(m[1]));
  };
  // Reads declarations and rules up to the closing brace of the block that starts at `i`.
  const block = (i, conditional) => {
    let start = i, depth = 0;
    while (i < css.length) {
      const ch = css[i];
      if (depth === 0 && ch === '{') { i = block(i + 1, conditional || sometimes(css.slice(start, i))); start = i; continue; }
      if (depth === 0 && (ch === ';' || ch === '}')) {
        declaration(css.slice(start, i), conditional);
        if (ch === '}') return i + 1;
        start = ++i;
        continue;
      }
      if (ch === '(' || ch === '[') depth++;
      else if ((ch === ')' || ch === ']') && depth) depth--;
      i = cssSkip(css, i);
      if (i < 0) { facts.unclear = true; return css.length; }
    }
    declaration(css.slice(start), conditional);
    return css.length;
  };
  for (let i = 0; i < css.length;) i = block(i, !!sometimes0);      // a stray '}' ends a block early: go on behind it
  return facts;
}

// ---------------------------------------------------------------- single attributes of a start tag

// Rewrites single attributes of a start tag and leaves every other character of it as written. `from`..`to`
// is the tag text behind the tag name up to and including '>', `attrs` the tokenizer's offsets
// [nameAt, nameTo, valueAt, valueTo, ...], `changes` maps lower-case names to the new value or null (remove).
export function patchAttrs(src, from, to, attrs, changes, decode) {
  const ws = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\f' || ch === '\r';
  const has = (name) => Object.prototype.hasOwnProperty.call(changes, name);
  const edits = [];
  const seen = new Set();
  let last = from;
  for (let i = 0; i < attrs.length; i += 4) {
    const nameAt = attrs[i], nameTo = attrs[i + 1], valueAt = attrs[i + 2], valueTo = attrs[i + 3];
    let end = valueTo >= 0 ? valueTo : nameTo;
    if (valueTo < 0) {
      // "name=" with nothing behind the equals sign is an empty value, not a bare name: the sign belongs to it
      let j = nameTo;
      while (j < to && ws(src[j])) j++;
      if (src[j] === '=') end = j + 1;
    }
    if (end > last) last = end;
    const name = src.slice(nameAt, nameTo).toLowerCase();
    const first = !seen.has(name);                // the browser uses the first of several equal names
    seen.add(name);
    if (!has(name)) continue;
    const value = changes[name];
    if (value === null) {
      // every spelling of the name goes; otherwise a later one, ignored until now, would take effect
      // with the white space in front of it, unless the neighbours would then join: `width="20"alt=x` must not
      // make `src=a.png alt=x` one attribute, and `src=a.png width=1 />` not `src=a.png/>`
      let a = nameAt;
      while (a > from && ws(src[a - 1])) a--;
      const next = src[end];
      const apart = end >= to || ws(next) || next === '>' || (next === '/' && (a === from || src[a - 1] === '"' || src[a - 1] === "'"));
      if (!apart) a = nameAt;
      edits.push([a, end, !apart && !ws(src[a - 1]) ? ' ' : '']);
    } else if (!first) continue;
    else if (valueAt < 0) edits.push([nameTo, end, '="' + escapeAttr(value) + '"']);
    else {
      const q = src[valueAt] === '"' || src[valueAt] === "'" ? src[valueAt] : '';
      edits.push([valueAt, valueTo, keepRaw(src.slice(valueAt + q.length, valueTo - q.length), q, value, decode)]);
    }
  }
  let added = '';
  for (const name of Object.keys(changes)) if (!seen.has(name) && changes[name] !== null) added += ' ' + name + '="' + escapeAttr(changes[name]) + '"';
  if (added) edits.push([last, last, added]);
  edits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let out = '', at = from;
  for (const e of edits) { out += src.slice(at, e[0]) + e[2]; at = e[1]; }
  return out + src.slice(at, to);
}

// The new value of an attribute written as `raw` (without its quote `q`, '' if unquoted): the part in front of
// and the part behind the change keep their spelling, character references included. Raw text is only kept
// where `decode` can read it with certainty (no reference without a semicolon), otherwise all is written anew.
function keepRaw(raw, q, value, decode) {
  const esc = (v) => (q === "'" ? escapeAttr(v).replace(/&quot;/g, '"').replace(/'/g, '&#39;') : escapeAttr(v));
  const quote = q || '"';
  const pieces = raw.match(/&#?[a-z0-9]+;?|[^]/gi) || [];
  const sure = pieces.every((r) => r.length === 1 || (decode && r[r.length - 1] === ';'));
  if (!sure) return quote + esc(value) + quote;
  const dec = pieces.map((r) => (r.length === 1 ? r : decode(r)));
  const old = dec.join('');
  const pre = commonPrefix(old, value), suf = commonSuffix(old, value, pre);
  let i = 0, a = 0, j = pieces.length, b = 0;
  while (i < j && a + dec[i].length <= pre) a += dec[i++].length;
  while (j > i && b + dec[j - 1].length <= suf) b += dec[--j].length;
  return quote + pieces.slice(0, i).join('') + esc(value.slice(a, value.length - b)) + pieces.slice(j).join('') + quote;
}

// ---------------------------------------------------------------- file bytes <-> text

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Decodes the bytes of an opened file. Internally the editor always uses LF line ends; the original
// convention (and a UTF-8 byte order mark) is remembered and restored when the file is written.
// Returns { text, bom, eol, mixedEol } or { error: 'binary' | 'utf16' | 'encoding' }.
export function decodeFileBytes(bytes, allowLegacy) {
  let bom = false;
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) return { error: 'utf16' };
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) { bom = true; bytes = bytes.subarray(3); }
  for (let i = 0; i < bytes.length; i++) if (bytes[i] === 0) return { error: 'binary' };
  let text;
  let legacy = false;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch (e) {
    if (!allowLegacy) return { error: 'encoding' };
    text = new TextDecoder('windows-1252').decode(bytes);
    legacy = true;
  }
  const crlf = (text.match(/\r\n/g) || []).length;
  const loneCr = (text.match(/\r(?!\n)/g) || []).length;
  const loneLf = (text.match(/\n/g) || []).length - crlf;
  const eol = crlf > 0 && crlf >= loneLf ? '\r\n' : '\n';
  const mixedEol = loneCr > 0 || (crlf > 0 && loneLf > 0);
  return { text: text.replace(/\r\n?/g, '\n'), bom, eol, mixedEol, legacy };
}

// Text that is written to disk for the given document settings.
export function encodeFileText(text, bom, eol) {
  return (bom ? '\ufeff' : '') + (eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}
