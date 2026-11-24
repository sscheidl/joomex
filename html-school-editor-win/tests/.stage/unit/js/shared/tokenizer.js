// HTML tokenizer with source offsets. It follows the tokenization rules of the HTML standard closely enough
// to find the exact extent of tags, comments and raw-text content. It never changes the text and it is never
// trusted on its own: every structure derived from these tokens is compared with the browser's own parser
// before it is used for editing (see project.js).
import { words } from './util.js';

export const VOID_TAGS = words('area base basefont bgsound br col embed frame hr img input keygen link meta param source track wbr');
export const LITERAL_TEXT = words('script style xmp iframe noembed noframes');   // content is plain text, no character references
export const RCDATA_TEXT = words('textarea title');                              // content is text with character references

const isWs = (c) => c === 32 || c === 10 || c === 9 || c === 12 || c === 13;
const isAlpha = (c) => (c | 32) >= 97 && (c | 32) <= 122;

const rawEndCache = {};
function findRawEnd(src, from, name) {
  const re = rawEndCache[name] || (rawEndCache[name] = new RegExp('</' + name + '(?=[\\t\\n\\f\\r />])', 'gi'));
  re.lastIndex = from;
  const m = re.exec(src);
  return m ? m.index : src.length;
}

// Reads a start or end tag beginning at `start`. A tag that is cut off by the end of the text yields a
// 'bogus' token, because the browser emits nothing for it.
function readTag(src, start, nameStart, isEnd) {
  const n = src.length;
  let j = nameStart;
  while (j < n) { const c = src.charCodeAt(j); if (isWs(c) || c === 47 || c === 62) break; j++; }
  const tok = { type: isEnd ? 'end' : 'start', start, end: n, name: src.slice(nameStart, j).toLowerCase(), nameEnd: j, attrs: [], selfClosing: false };
  for (;;) {
    while (j < n && isWs(src.charCodeAt(j))) j++;
    if (j >= n) { tok.type = 'bogus'; return tok; }
    const c = src.charCodeAt(j);
    if (c === 62) { tok.end = j + 1; return tok; }
    if (c === 47) {
      if (src.charCodeAt(j + 1) === 62) { tok.selfClosing = true; tok.end = j + 2; return tok; }
      j++;
      continue;
    }
    const nameAt = j++;                       // the first character always belongs to the attribute name
    while (j < n) { const d = src.charCodeAt(j); if (isWs(d) || d === 47 || d === 62 || d === 61) break; j++; }
    const nameTo = j;
    while (j < n && isWs(src.charCodeAt(j))) j++;
    let valueAt = -1, valueTo = -1;
    if (src.charCodeAt(j) === 61) {
      j++;
      while (j < n && isWs(src.charCodeAt(j))) j++;
      const q = src.charCodeAt(j);
      if (q === 34 || q === 39) {
        const e = src.indexOf(q === 34 ? '"' : "'", j + 1);
        if (e < 0) { tok.type = 'bogus'; return tok; }
        valueAt = j; valueTo = e + 1; j = valueTo;
      } else if (j < n && q !== 62) {
        valueAt = j;
        while (j < n && !isWs(src.charCodeAt(j)) && src.charCodeAt(j) !== 62) j++;
        valueTo = j;
      }
    }
    tok.attrs.push(nameAt, nameTo, valueAt, valueTo);
  }
}

// Token types: text, start, end, comment, doctype, bogus. Tokens cover the whole text without gaps.
export function tokenize(src) {
  const toks = [];
  const n = src.length;
  let i = 0, textStart = 0;
  const flush = (to) => { if (to > textStart) toks.push({ type: 'text', start: textStart, end: to }); };
  const until = (from, what) => { const e = src.indexOf(what, from); return e < 0 ? n : e + what.length; };
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    const c = src.charCodeAt(lt + 1);
    let tok = null;
    if (isAlpha(c)) {
      tok = readTag(src, lt, lt + 1, false);
    } else if (c === 47) {
      const c2 = src.charCodeAt(lt + 2);
      if (isAlpha(c2)) tok = readTag(src, lt, lt + 2, true);
      else if (c2 === 62) tok = { type: 'bogus', start: lt, end: lt + 3 };
      else if (lt + 2 < n) tok = { type: 'comment', bogus: true, start: lt, end: until(lt + 2, '>') };
    } else if (c === 33) {
      if (src.startsWith('<!--', lt)) {
        let end;
        if (src.startsWith('<!-->', lt)) end = lt + 5;
        else if (src.startsWith('<!--->', lt)) end = lt + 6;
        else {
          const a = src.indexOf('-->', lt + 4), b = src.indexOf('--!>', lt + 4);
          end = a < 0 && b < 0 ? n : b < 0 || (a >= 0 && a < b) ? a + 3 : b + 4;
        }
        tok = { type: 'comment', start: lt, end };
      } else if (/^<!doctype/i.test(src.substr(lt, 9))) {
        tok = { type: 'doctype', start: lt, end: until(lt + 9, '>') };
      } else {
        tok = { type: 'comment', bogus: true, start: lt, end: until(lt + 2, '>') };
      }
    } else if (c === 63) {
      tok = { type: 'comment', bogus: true, start: lt, end: until(lt + 2, '>') };
    }
    if (!tok) { i = lt + 1; continue; }       // a lone '<' is ordinary text
    flush(lt);
    toks.push(tok);
    i = textStart = tok.end;
    if (tok.type === 'start') {
      const literal = LITERAL_TEXT.has(tok.name);
      if (literal || RCDATA_TEXT.has(tok.name) || tok.name === 'plaintext') {
        const close = tok.name === 'plaintext' ? n : findRawEnd(src, tok.end, tok.name);
        if (close > tok.end) toks.push({ type: 'text', start: tok.end, end: close, raw: literal || tok.name === 'plaintext' ? 'literal' : 'rcdata' });
        i = textStart = close;
      }
    }
  }
  flush(n);
  return toks;
}
