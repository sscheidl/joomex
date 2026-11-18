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
