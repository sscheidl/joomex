// Explicit "tidy up" of the whole source text: one block element per line, two spaces per level.
//
// The formatter only moves white space that the HTML rules treat as insignificant for the default display of
// the elements involved. Tags, attributes, comments, character references and the content of pre, textarea,
// script, style and similar elements are copied verbatim. The result is never applied unchecked: the caller
// parses both versions with the browser and compares them with canonDom() (project.js).
import { words } from './util.js';
import { VOID_TAGS } from './tokenizer.js';

export const FMT_BLOCK = words('html head body address article aside blockquote center details dialog dir div dl dd dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr li main menu nav ol p section summary table thead tbody tfoot tr td th caption colgroup col ul title meta link base script style noscript template pre listing xmp plaintext');
export const FMT_KEEP = words('pre listing xmp plaintext script style textarea svg math select template noscript iframe noembed noframes object');

const WS = /[ \t\n\f\r]+/g;
const blank = (s) => !/[^ \t\n\f\r]/.test(s);

export function formatSource(src, root) {
  const out = [];
  const text = (n) => src.slice(n.start, n.end);
  const pad = (depth) => '  '.repeat(depth);
  const isBlock = (n) => n.type === 'doctype' || (n.type === 'el' && FMT_BLOCK.has(n.name));
  const hasBlockInside = (n) => n.type === 'el' && n.children.some((c) => isBlock(c) || hasBlockInside(c));

  // Inline content as one string. White space inside ordinary text collapses to single spaces.
  function inline(n) {
    if (n.type === 'text') return n.raw ? text(n) : text(n).replace(WS, ' ');
    if (n.type !== 'el' || FMT_KEEP.has(n.name) || n.implied || hasBlockInside(n)) return text(n);
    let s = src.slice(n.start, n.tagEnd);
    for (const c of n.children) s += inline(c);
    return s + src.slice(n.closeStart, n.end);
  }

  // A run of inline nodes on one line; a line break in the source follows every <br>.
  function runText(nodes, depth) {
    let s = '';
    let afterBreak = false;
    for (const n of nodes) {
      let piece = inline(n);
      if (afterBreak) { piece = piece.replace(/^ +/, ''); if (piece) { s += '\n' + pad(depth + 1); afterBreak = false; } }
      s += piece;
      if (n.type === 'el' && n.name === 'br' && !n.synthetic) afterBreak = true;
    }
    return s.replace(/^[ \t\n\f\r]+|[ \t\n\f\r]+$/g, '');
  }

  function kidsOf(node, depth) {
    let run = [];
    let gap = false, any = false;
    const line = (s) => { if (gap && any) out.push(''); gap = false; any = true; out.push(s); };
    const flush = () => {
      if (!run.length) return;
      const s = runText(run, depth);
      run = [];
      if (s) line(pad(depth) + s);
    };
    for (const c of node.children) {
      if (isBlock(c) || (c.type === 'comment' && !run.length)) {
        flush();
        if (gap && any) { out.push(''); }
        gap = false; any = true;
        blockItem(c, depth);
      } else if (c.type === 'text' && !c.raw && !run.length && blank(text(c))) {
        if ((text(c).match(/\n/g) || []).length > 1) gap = true;       // keep one empty line where the author left one
      } else run.push(c);
    }
    flush();
  }

  function blockItem(c, depth) {
    if (c.type !== 'el' || FMT_KEEP.has(c.name) || VOID_TAGS.has(c.name) || c.synthetic) { out.push(pad(depth) + text(c).replace(/[ \t\n\f\r]+$/, '')); return; }
    if (c.implied) { kidsOf(c, depth); return; }
    const open = src.slice(c.start, c.tagEnd), close = src.slice(c.closeStart, c.end);
    if (!c.children.some((k) => isBlock(k) || (k.type === 'comment' && text(k).indexOf('\n') >= 0))) {
      out.push(pad(depth) + open + runText(c.children, depth) + close);
      return;
    }
    out.push(pad(depth) + open);
    kidsOf(c, c.name === 'html' ? depth : depth + 1);
    if (close) out.push(pad(depth) + close);
  }

  kidsOf(root, 0);
  return out.length ? out.join('\n') + '\n' : '';
}

// The source text with the page title set to `value`: the text inside the first <title> outside SVG and
// MathML is replaced; a page without a title gets one new line with a title element right after <head>
// (else after <html>, else after the doctype, else at the start). Everything else stays byte for byte.
// Returns null if the title element is not closed. The caller checks the result with the browser's parser.
export function withTitle(src, tokens, value) {
  const text = String(value).replace(/[\t\n\f\r]+/g, ' ').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  let foreign = 0, head = null, html = null, doctype = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'doctype' && !doctype) doctype = t;
    if (t.type !== 'start' && t.type !== 'end') continue;
    if (t.name === 'svg' || t.name === 'math') {
      if (t.type === 'start' && !t.selfClosing) foreign++; else if (t.type === 'end' && foreign) foreign--;
      continue;
    }
    if (foreign || t.type !== 'start') continue;
    if (t.name === 'title') {
      const inner = tokens[i + 1] && tokens[i + 1].type === 'text' ? tokens[i + 1] : null, end = tokens[inner ? i + 2 : i + 1];
      if (!end || end.type !== 'end' || end.name !== 'title') return null;
      return src.slice(0, t.end) + text + src.slice(inner ? inner.end : t.end);
    }
    if (t.name === 'head' && !head) head = t;
    else if (t.name === 'html' && !html) html = t;
  }
  const after = head || html || doctype;
  const tag = '<title>' + text + '</title>';
  if (!after) return tag + '\n' + src;
  const indentOf = (at) => { const s = src.lastIndexOf('\n', at - 1) + 1; return /^[ \t]*/.exec(src.slice(s, at))[0]; };
  const nextLine = src.indexOf('\n', after.end);
  let indent = indentOf(after.start) + (after === head ? '  ' : '');
  if (nextLine >= 0 && src.slice(after.end, nextLine).trim() === '') {
    const following = /^[ \t]*/.exec(src.slice(nextLine + 1))[0];
    if (!src.startsWith('</', nextLine + 1 + following.length)) indent = following;
  }
  return src.slice(0, after.end) + '\n' + indent + tag + src.slice(after.end);
}
