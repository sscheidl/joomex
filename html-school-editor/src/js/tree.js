// Builds a source-position tree from the tokens. The nesting rules are a deliberately small subset of the
// HTML tree-construction rules (void elements, optional end tags, implied tbody, stray end tags). The tree is
// only used where project.js has confirmed that the browser's parser produced the same structure; everything
// else stays read-only in the preview. Node ranges tile their parent completely, so re-emitting all children
// of a node reproduces its inner source text byte for byte.
import { words } from './util.js';
import { tokenize, VOID_TAGS } from './tokenizer.js';

const SPECIAL = words('address applet area article aside base basefont bgsound blockquote body br button caption center col colgroup dd details dir div dl dt embed fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hgroup hr html iframe img input keygen li link listing main marquee menu meta nav noembed noframes noscript object ol p param plaintext pre script search section select source style summary table tbody td template textarea tfoot th thead title tr track ul wbr xmp');
const SCOPE = words('applet caption html table td th marquee object template');
const BUTTON_SCOPE = words('applet caption html table td th marquee object template button');
const LIST_SCOPE = words('applet caption html table td th marquee object template ol ul');
const TABLE_SCOPE = words('html table template');
const ROW_SCOPE = words('html table template tr');
const P_CLOSERS = words('address article aside blockquote center details dialog dir div dl fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr listing main menu nav ol p pre search section summary table ul xmp li dd dt');
const HEADINGS = words('h1 h2 h3 h4 h5 h6');
const SCOPED_END = words('address article aside blockquote button center details dialog dir div dl fieldset figcaption figure footer form header hgroup listing main menu nav ol pre search section summary ul dd dt body html');
const TABLE_PARTS = words('table tbody thead tfoot tr td th caption colgroup');
const CELLS = words('td th');
const ROWS = words('tr');
const SECTIONS = words('tbody thead tfoot');
const TABLE_CHILDREN = words('tbody thead tfoot caption colgroup');
const LI = words('li');
const DD_DT = words('dd dt');
const P = words('p');
const MAX_DEPTH = 400;
export const HEAD_ONLY = words('title meta link style script base template noscript');

// `quirks`: the document is rendered in quirks mode (no doctype), where a table does not close a paragraph.
export function parseHtml(src, quirks, tokens) {
  if (!tokens) tokens = tokenize(src);
  const root = { type: 'root', name: '#root', start: 0, tagEnd: 0, closeStart: src.length, end: src.length, children: [], parent: null };
  const stack = [root];
  let foreign = 0;
  const top = () => stack[stack.length - 1];
  const add = (node) => { node.parent = top(); top().children.push(node); return node; };

  function closeTo(k, pos, endTok) {
    for (let s = stack.length - 1; s >= k; s--) {
      const node = stack[s];
      if (s === k && endTok) { node.closeStart = endTok.start; node.end = endTok.end; node.explicitEnd = true; }
      else node.closeStart = node.end = pos;
      if (node.name === 'svg' || node.name === 'math') foreign--;
    }
    stack.length = k;
  }
  function closeNearest(names, barriers, pos) {
    for (let k = stack.length - 1; k > 0; k--) {
      const nm = stack[k].name;
      if (names.has(nm)) { closeTo(k, pos); return; }
      if (barriers.has(nm)) return;
    }
  }
  function closeItem(names, pos) {
    for (let k = stack.length - 1; k > 0; k--) {
      const nm = stack[k].name;
      if (names.has(nm)) { closeTo(k, pos); return; }
      if (SPECIAL.has(nm) && nm !== 'address' && nm !== 'div' && nm !== 'p') return;
    }
  }
  function element(name, tok) {
    return { type: 'el', name, start: tok.start, nameEnd: tok.nameEnd, tagEnd: tok.end, closeStart: tok.end, end: tok.end, children: [] };
  }

  function onStart(tok) {
    const name = tok.name, pos = tok.start;
    if (!foreign) {
      if (P_CLOSERS.has(name)) {
        if (name === 'li') closeItem(LI, pos);
        else if (name === 'dd' || name === 'dt') closeItem(DD_DT, pos);
        if (!(quirks && name === 'table')) closeNearest(P, BUTTON_SCOPE, pos);
        if (HEADINGS.has(name) && HEADINGS.has(top().name)) closeTo(stack.length - 1, pos);
      } else if (name === 'option') {
        if (top().name === 'option') closeTo(stack.length - 1, pos);
      } else if (name === 'optgroup') {
        if (top().name === 'option') closeTo(stack.length - 1, pos);
        if (top().name === 'optgroup') closeTo(stack.length - 1, pos);
      } else if (name === 'tr') {
        closeNearest(CELLS, TABLE_SCOPE, pos);
        closeNearest(ROWS, TABLE_SCOPE, pos);
        if (top().name === 'table') {
          const tbody = add({ type: 'el', name: 'tbody', implied: true, start: pos, nameEnd: pos, tagEnd: pos, closeStart: pos, end: pos, children: [] });
          stack.push(tbody);
        }
      } else if (name === 'td' || name === 'th') {
        closeNearest(CELLS, ROW_SCOPE, pos);
      } else if (TABLE_CHILDREN.has(name)) {
        closeNearest(CELLS, TABLE_SCOPE, pos);
        closeNearest(ROWS, TABLE_SCOPE, pos);
        closeNearest(TABLE_CHILDREN, TABLE_SCOPE, pos);
      }
    }
    const node = add(element(name, tok));
    if (foreign ? tok.selfClosing : VOID_TAGS.has(name)) return;
    // Browsers limit the nesting depth of their parser as well. Deeper elements are kept as leaves here; the
    // comparison with the browser's tree then marks that part as not editable.
    if (stack.length >= MAX_DEPTH) return;
    stack.push(node);
    if (name === 'svg' || name === 'math') foreign++;
  }

  function onEnd(tok) {
    const name = tok.name;
    let barriers = SPECIAL;
    let isMatch = (nm) => nm === name;
    if (HEADINGS.has(name)) { isMatch = (nm) => HEADINGS.has(nm); barriers = SCOPE; }
    else if (TABLE_PARTS.has(name)) barriers = TABLE_SCOPE;
    else if (name === 'li') barriers = LIST_SCOPE;
    else if (name === 'p') barriers = BUTTON_SCOPE;
    else if (SCOPED_END.has(name)) barriers = SCOPE;
    for (let k = stack.length - 1; k > 0; k--) {
      const nm = stack[k].name;
      if (isMatch(nm)) { closeTo(k, tok.start, tok); return; }
      if (barriers.has(nm)) break;
    }
    if ((name === 'p' || name === 'br') && !foreign) {
      // The browser turns a stray </p> into an empty paragraph and a stray </br> into a line break.
      add({ type: 'el', name, synthetic: true, explicitEnd: name === 'p', start: tok.start, nameEnd: tok.start, tagEnd: tok.start, closeStart: tok.start, end: tok.end, children: [] });
    } else {
      add({ type: 'junk', start: tok.start, end: tok.end });
    }
  }

  for (const tok of tokens) {
    if (tok.type === 'start') onStart(tok);
    else if (tok.type === 'end') onEnd(tok);
    else if (tok.type === 'text') add({ type: 'text', start: tok.start, end: tok.end, raw: tok.raw });
    else if (tok.type === 'comment') add({ type: 'comment', start: tok.start, end: tok.end, bogus: !!tok.bogus });
    else if (tok.type === 'doctype') add({ type: top() === root ? 'doctype' : 'junk', start: tok.start, end: tok.end });
    else add({ type: 'junk', start: tok.start, end: tok.end });
  }
  closeTo(1, src.length);
  finish(root);
  return { src, tokens, root };
}

// Sets `kids` (children without junk), `lead` (start including junk directly in front of a node) and `tail`
// (start of junk behind the last child).
function finish(node) {
  node.kids = [];
  let junkAt = -1;
  for (const c of node.children) {
    if (c.type === 'junk') { if (junkAt < 0) junkAt = c.start; continue; }
    c.lead = junkAt < 0 ? c.start : junkAt;
    junkAt = -1;
    node.kids.push(c);
    if (c.type === 'el') finish(c);
  }
  node.tail = junkAt < 0 ? node.closeStart : junkAt;
}

const isBlank = (src, node) => node.type === 'text' && !/[^ \t\n\f\r]/.test(src.slice(node.start, node.end));

// Finds the node whose children are the body content. Without a <body> tag a virtual body is returned that
// covers the content the browser would place into the implied body element.
export function locateBody(root, src) {
  const html = root.kids.find((k) => k.type === 'el' && k.name === 'html');
  const container = html || root;
  const explicit = container.kids.find((k) => k.type === 'el' && k.name === 'body');
  if (explicit) return explicit;
  const kids = container.kids;
  let i = 0;
  while (i < kids.length) {
    const k = kids[i];
    const skip = k.type === 'doctype' || k.type === 'comment' || isBlank(src, k) ||
      (k.type === 'el' && (k.name === 'head' || k.name === 'html' || HEAD_ONLY.has(k.name)));
    if (!skip) break;
    i++;
  }
  const bodyKids = kids.slice(i);
  const end = container.tail;
  const start = bodyKids.length ? bodyKids[0].lead : end;
  return { type: 'el', name: 'body', virtual: true, start, nameEnd: start, tagEnd: start, closeStart: end, tail: end, end, children: bodyKids, kids: bodyKids, parent: container };
}
