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

// Folder part of a relative image address ('' if there is none).
export function folderOfSrc(value) {
  const path = String(value).trim().split(/[?#]/)[0].replace(/\\/g, '/');
  const cut = path.lastIndexOf('/');
  return cut < 0 ? '' : path.slice(0, cut);
}

// ---------------------------------------------------------------- alignment in a style attribute

const ALIGN_VALUES = words('left right center justify');

// The alignment if the style consists of nothing but one text-align declaration, otherwise ''.
export function onlyAlign(style) {
  const m = /^\s*text-align\s*:\s*([a-z]+)\s*;?\s*$/i.exec(style);
  return m && ALIGN_VALUES.has(m[1].toLowerCase()) ? m[1].toLowerCase() : '';
}

// Returns the style text with its text-align declaration replaced by `value` ('' removes it). Every other
// declaration stays exactly as written, and adding and removing again gives back the text that was there.
export function withAlign(style, value) {
  let rest = String(style);
  for (let guard = 0; guard < 20; guard++) {
    const m = /(^|;)\s*text-align\s*:[^;]*(;|$)/i.exec(rest);
    if (!m) break;
    // a declaration at the end goes together with the semicolon in front of it
    rest = m[2] ? rest.slice(0, m.index + m[1].length) + rest.slice(m.index + m[0].length) : rest.slice(0, m.index);
  }
  rest = rest.trim();
  if (!value) return rest;
  if (!rest) return 'text-align: ' + value;
  return /;$/.test(rest) ? rest + ' text-align: ' + value + ';' : rest + '; text-align: ' + value;
}

// ---------------------------------------------------------------- single attributes of a start tag

// Rewrites single attributes of a start tag and leaves every other character of it as written. `from`..`to`
// is the tag text behind the tag name up to and including '>', `attrs` the tokenizer's offsets
// [nameAt, nameTo, valueAt, valueTo, ...], `changes` maps lower-case names to the new value or null (remove).
export function patchAttrs(src, from, to, attrs, changes) {
  const ws = (ch) => ch === ' ' || ch === '\t' || ch === '\n' || ch === '\f' || ch === '\r';
  const has = (name) => Object.prototype.hasOwnProperty.call(changes, name);
  const edits = [];
  const seen = new Set();
  let last = from;
  for (let i = 0; i < attrs.length; i += 4) {
    const nameAt = attrs[i], nameTo = attrs[i + 1], valueAt = attrs[i + 2], valueTo = attrs[i + 3];
    const end = valueTo >= 0 ? valueTo : nameTo;
    if (end > last) last = end;
    const name = src.slice(nameAt, nameTo).toLowerCase();
    if (seen.has(name)) continue;                 // the browser uses the first of several equal names
    seen.add(name);
    if (!has(name)) continue;
    const value = changes[name];
    if (value === null) {
      let a = nameAt;
      while (a > from && ws(src[a - 1])) a--;
      edits.push([a, end, '']);
    } else if (valueAt < 0) edits.push([nameTo, nameTo, '="' + escapeAttr(value) + '"']);
    else if (src[valueAt] === "'") edits.push([valueAt, valueTo, "'" + escapeAttr(value).replace(/&quot;/g, '"').replace(/'/g, '&#39;') + "'"]);
    else edits.push([valueAt, valueTo, '"' + escapeAttr(value) + '"']);
  }
  let added = '';
  for (const name of Object.keys(changes)) if (!seen.has(name) && changes[name] !== null) added += ' ' + name + '="' + escapeAttr(changes[name]) + '"';
  if (added) edits.push([last, last, added]);
  edits.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let out = '', at = from;
  for (const e of edits) { out += src.slice(at, e[0]) + e[2]; at = e[1]; }
  return out + src.slice(at, to);
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
  const loneLf = (text.match(/(^|[^\r])\n/g) || []).length;
  const eol = crlf > 0 && crlf >= loneLf ? '\r\n' : '\n';
  const mixedEol = loneCr > 0 || (crlf > 0 && loneLf > 0);
  return { text: text.replace(/\r\n?/g, '\n'), bom, eol, mixedEol, legacy };
}

// Text that is written to disk for the given document settings.
export function encodeFileText(text, bom, eol) {
  return (bom ? '\ufeff' : '') + (eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
}
