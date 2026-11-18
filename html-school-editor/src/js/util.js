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
