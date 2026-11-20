// Unit tests for the DOM-free modules. Run with: node --test tests/unit/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokenize } from '../../src/js/tokenizer.js';
import { parseHtml, locateBody } from '../../src/js/tree.js';
import { formatSource } from '../../src/js/format.js';
import { highlightLines } from '../../src/js/highlight.js';
import { createHistory } from '../../src/js/history.js';
import { sniffImage } from '../../src/js/images.js';
import { mapOffset, changeEnd, checkLinkUrl, isRasterDataUrl, decodeFileBytes, encodeFileText, escapeText, escapeAttr } from '../../src/js/util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => fs.readFileSync(path.join(here, '..', 'fixtures', name), 'utf8');

// Deterministic pseudo-random documents built from markup-like pieces (well-formed and broken ones).
const PIECES = ['<p>', '</p>', '<b>', '</b>', '<i>', '</i>', '<ul>', '<li>', '</li>', '</ul>', '<table>', '<tr>', '<td>', '</td>', '</table>', '<br>', '<br/>', '<img src="a.png" alt="x>y">',
  '<!-- c -->', '<!--', '-->', '<!DOCTYPE html>', '<a href=\'x\'>', '</a>', '<div class=a b>', '</div>', '<pre>', '</pre>', '<script>', '</script>', '<style>', '</style>', '<textarea>', '</textarea>',
  'Text ', 'ä&ouml; ', '&amp;', '&', '<', '>', ' ', '\n', '\n  ', '</', '<x', '="', '"', '\'', '<h1>', '</h1>', '</h2>', '<svg><path d="M0"/></svg>', '<html>', '<head>', '</head>', '<body>', '</body>', '</html>', '</br>', '<title>', '</title>'];
function corpus(count) {
  const docs = [];
  let seed = 20261118;
  const next = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let i = 0; i < count; i++) {
    let s = '';
    for (let k = next(30); k >= 0; k--) s += PIECES[next(PIECES.length)];
    docs.push(s);
  }
  return docs;
}
const DOCS = corpus(3000).concat(['', '<', '</', '<p', '<p a="', '&', fixture('basic.html'), fixture('legacy.html'), fixture('malformed.html'), fixture('format-in.html')]);

test('tokens cover the text without gaps or overlaps', () => {
  for (const src of DOCS) {
    let at = 0;
    for (const tok of tokenize(src)) {
      assert.equal(tok.start, at, 'gap before token in ' + JSON.stringify(src));
      assert.ok(tok.end > tok.start, 'empty token in ' + JSON.stringify(src));
      at = tok.end;
    }
    assert.equal(at, src.length, 'tokens end early in ' + JSON.stringify(src));
  }
});

test('tokenizer: tags, attributes, comments, raw text', () => {
  const kinds = (src) => tokenize(src).map((t) => t.type + (t.name ? ':' + t.name : '') + (t.raw ? ':' + t.raw : ''));
  assert.deepEqual(kinds('<P Class="a>b" x=y z>T</P>'), ['start:p', 'text', 'end:p']);
  assert.deepEqual(kinds('a < b <3 <b>c'), ['text', 'start:b', 'text']);
  assert.deepEqual(kinds('<script>if (a<b) "</p>"</script>x'), ['start:script', 'text:literal', 'end:script', 'text']);
  assert.deepEqual(kinds('<textarea><b>&amp;</textarea>'), ['start:textarea', 'text:rcdata', 'end:textarea']);
  assert.deepEqual(kinds('<!-- a > b --><!-->x<!DOCTYPE html><?php ?></>'), ['comment', 'comment', 'text', 'doctype', 'comment', 'bogus']);
  assert.deepEqual(kinds('<p title="offen'), ['bogus:p']);
  assert.deepEqual(kinds('<br/><img/ alt=x>'), ['start:br', 'start:img']);
  const img = tokenize('<img src=a.png alt="x y">')[0];
  assert.deepEqual(img.attrs, [5, 8, 9, 14, 15, 18, 19, 24]);
});

function shape(node) {
  if (node.type === 'text') return '#';
  if (node.type !== 'el') return '(' + node.type + ')';
  return node.name + (node.implied ? '*' : '') + (node.kids.length ? '[' + node.kids.map(shape).join(' ') + ']' : '');
}
const bodyShape = (src, quirks) => { const tree = parseHtml(src, quirks); return locateBody(tree.root, src).kids.map(shape).join(' '); };

test('tree: optional end tags, void elements, implied tbody, stray end tags', () => {
  assert.equal(bodyShape('<p>a<p>b<div>c</div>'), 'p[#] p[#] div[#]');
  assert.equal(bodyShape('<ul><li>a<li>b<ul><li>c</ul><li>d</ul>'), 'ul[li[#] li[# ul[li[#]]] li[#]]');
  assert.equal(bodyShape('<table><tr><td>1<td>2<tr><th>3</table>x'), 'table[tbody*[tr[td[#] td[#]] tr[th[#]]]] #');
  assert.equal(bodyShape('<p>a<br>b<img src=x><hr>c'), 'p[# br # img] hr #');
  assert.equal(bodyShape('<p><ul><li>x</li></ul></p>'), 'p ul[li[#]] p');
  assert.equal(bodyShape('<h1>a<h2>b</h1>c'), 'h1[#] h2[#] #');
  assert.equal(bodyShape('<div>a</span>b</div>'), 'div[# #]');
  assert.equal(bodyShape('<dl><dt>a<dd>b<dt>c</dl>'), 'dl[dt[#] dd[#] dt[#]]');
  assert.equal(bodyShape('<p>a<table><tr><td>x</table>', false), 'p[#] table[tbody*[tr[td[#]]]]');
  assert.equal(bodyShape('<p>a<table><tr><td>x</table>', true), 'p[# table[tbody*[tr[td[#]]]]]');
  assert.equal(bodyShape('<svg><circle r=1 /><g><path/></g></svg>z'), 'svg[circle g[path]] #');
});

test('tree: body location with and without a body tag', () => {
  const full = '<!DOCTYPE html>\n<html>\n<head><title>t</title></head>\n<body class=a>\n<p>x</p>\n</body>\n</html>\n';
  let body = locateBody(parseHtml(full).root, full);
  assert.equal(full.slice(body.tagEnd, body.closeStart), '\n<p>x</p>\n');
  const frag = '<!-- c -->\n<title>t</title>\n<h1>a</h1>\n<p>b';
  body = locateBody(parseHtml(frag).root, frag);
  assert.equal(body.virtual, true);
  assert.equal(frag.slice(body.tagEnd, body.closeStart), '<h1>a</h1>\n<p>b');
  body = locateBody(parseHtml('').root, '');
  assert.equal(body.tagEnd, 0);
  assert.equal(body.closeStart, 0);
});

test('tree: child ranges tile every element', () => {
  const check = (src, node) => {
    let at = node.tagEnd;
    for (const c of node.children) {
      assert.equal(c.start, at, 'child gap in ' + JSON.stringify(src));
      assert.ok(c.end >= c.start);
      if (c.type === 'el') { assert.ok(c.tagEnd >= c.start && c.closeStart >= c.tagEnd && c.end >= c.closeStart, 'range order in ' + JSON.stringify(src)); check(src, c); }
      at = c.end;
    }
    assert.equal(at, node.closeStart, 'children do not fill their parent in ' + JSON.stringify(src));
    let lead = node.tagEnd;
    for (const k of node.kids) { assert.equal(k.lead, lead); lead = k.end; }
    assert.ok(node.tail >= lead && node.tail <= node.closeStart);
  };
  for (const src of DOCS) check(src, parseHtml(src, false).root);
});

test('formatter: hand-written expectation, white space only, idempotent', () => {
  const src = fixture('format-in.html');
  const out = formatSource(src, parseHtml(src).root);
  assert.equal(out, fixture('format-expected.html'));
  const ink = (s) => s.replace(/[ \t\n\f\r]+/g, '');
  for (const doc of DOCS) {
    const once = formatSource(doc, parseHtml(doc).root);
    assert.equal(ink(once), ink(doc), 'formatter changed more than white space in ' + JSON.stringify(doc));
    // Broken input that ends inside an unterminated comment or tag may need a second pass to settle.
    const twice = formatSource(once, parseHtml(once).root);
    assert.equal(formatSource(twice, parseHtml(twice).root), twice, 'formatter does not settle for ' + JSON.stringify(doc));
  }
  for (const name of ['basic.html', 'legacy.html', 'format-expected.html']) {
    const once = formatSource(fixture(name), parseHtml(fixture(name)).root);
    assert.equal(formatSource(once, parseHtml(once).root), once, 'formatter is idempotent for ' + name);
  }
});

test('formatter: structure examples', () => {
  const fmt = (src) => formatSource(src, parseHtml(src).root);
  assert.equal(fmt('<ul><li>a</li><li>b <b>c</b></li></ul>'), '<ul>\n  <li>a</li>\n  <li>b <b>c</b></li>\n</ul>\n');
  assert.equal(fmt('<p>a\n\n\n   b</p>\n\n\n<p>c</p>'), '<p>a b</p>\n\n<p>c</p>\n');
  assert.equal(fmt('<div>Text<p>Absatz</p>mehr</div>'), '<div>\n  Text\n  <p>Absatz</p>\n  mehr\n</div>\n');
  assert.equal(fmt('<p>one<p>two'), '<p>one\n<p>two\n');
  assert.equal(fmt('<pre>\n a\n   b</pre><p>x</p>'), '<pre>\n a\n   b</pre>\n<p>x</p>\n');
});

test('highlighter: one entry per line, text escaped', () => {
  const src = '<p class="a">x &amp; <y\n<!-- c\n d --></p>\n';
  const lines = highlightLines(src, tokenize(src));
  assert.equal(lines.length, 4);
  const plain = lines.map((l) => l.replace(/<span class="[a-z]+">|<\/span>/g, '')).join('\n');
  assert.equal(plain, escapeText(src));
  assert.ok(!/<(?!\/?span)/.test(lines.join('')), 'only span elements are produced');
});

test('util: offsets, escaping', () => {
  assert.equal(mapOffset('abcdef', 'abXYcdef', 4), 6);
  assert.equal(mapOffset('abcdef', 'abXYcdef', 1), 1);
  assert.equal(mapOffset('abcdef', 'abef', 3), 2);
  assert.equal(changeEnd('abcdef', 'abXYcdef'), 4);
  assert.equal(escapeText('a<b>&"c\u00a0'), 'a&lt;b&gt;&amp;"c&nbsp;');
  assert.equal(escapeAttr('a<b>&"c'), 'a&lt;b>&amp;&quot;c');
});

test('util: link addresses', () => {
  for (const ok of ['https://example.org/a?b=1&c=2', 'http://example.org', 'seite2.html', '#oben', 'bilder/foto.html', 'mailto:lehrer@example.org', '//example.org/x', 'tel:+49123']) assert.equal(checkLinkUrl(ok).ok, true, ok);
  for (const bad of ['', '   ', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', 'java&#115;cript:alert(1)', 'java&#x73;cript:alert(1)', 'javascript&colon;alert(1)',
    'j&#97;vascript:x', 'data:text/html,<b>', 'vbscript:x', 'file:///c:/x', 'blob:x', 'x'.repeat(2001)]) assert.equal(checkLinkUrl(bad).ok, false, bad);
  assert.equal(checkLinkUrl('www.example.org/a b').url, 'https://www.example.org/a%20b');
  assert.equal(checkLinkUrl('a" onmouseover="x').url, 'a%22%20onmouseover=%22x');
  assert.equal(isRasterDataUrl('data:image/png;base64,AAAA'), true);
  for (const bad of ['data:image/svg+xml;base64,AAAA', 'data:text/html;base64,AAAA', 'data:image/png,xx', 'http://x/a.png', 'a.png', 'data:image/png;base64,AA"onerror="x']) assert.equal(isRasterDataUrl(bad), false, bad);
});

test('util: file bytes', () => {
  const enc = (s) => new TextEncoder().encode(s);
  let d = decodeFileBytes(enc('a\r\nb\r\n'), false);
  assert.deepEqual([d.text, d.bom, d.eol, d.mixedEol], ['a\nb\n', false, '\r\n', false]);
  assert.equal(encodeFileText(d.text, d.bom, d.eol), 'a\r\nb\r\n');
  d = decodeFileBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x0a]), false);
  assert.deepEqual([d.text, d.bom, d.eol], ['a\n', true, '\n']);
  assert.equal(encodeFileText(d.text, d.bom, d.eol), '\ufeffa\n');
  assert.equal(decodeFileBytes(enc('a\r\nb\nc\rd'), false).mixedEol, true);
  // review finding BYTES: three line feeds in a row are three, and they are more than two CRLF
  d = decodeFileBytes(enc('x\r\ny\r\n\n\n\nz'), false);
  assert.deepEqual([d.text, d.eol, d.mixedEol], ['x\ny\n\n\n\nz', '\n', true]);
  assert.equal(decodeFileBytes(enc('a\n\nb\r\nc\r\nd\r\n'), false).eol, '\r\n');
  assert.equal(decodeFileBytes(new Uint8Array([0x61, 0xf6, 0x62]), false).error, 'encoding');
  assert.equal(decodeFileBytes(new Uint8Array([0x61, 0xf6, 0x62]), true).text, 'a\u00f6b');
  assert.equal(decodeFileBytes(new Uint8Array([0xff, 0xfe, 0x61, 0x00]), false).error, 'utf16');
  assert.equal(decodeFileBytes(new Uint8Array([0x61, 0x00, 0x62]), false).error, 'binary');
});

test('history: grouping, redo invalidation, size limit', () => {
  const h = createHistory(1000);
  h.reset('a');
  h.record('ab', 'src-type', 100);
  h.record('abc', 'src-type', 300);
  h.record('abcd', 'vis-type', 400);
  assert.equal(h.count(), 3);
  assert.equal(h.undo().text, 'abc');
  assert.equal(h.undo().text, 'a');
  assert.equal(h.undo(), null);
  assert.equal(h.redo().text, 'abc');
  h.record('abcX', 'src-type', 500);
  assert.equal(h.canRedo(), false);
  h.record('abcXY', 'src-type', 5000);
  assert.equal(h.undo().text, 'abcX');
  const big = createHistory(50);
  big.reset('x'.repeat(10));
  for (let i = 0; i < 20; i++) big.record('y'.repeat(10) + i, 'cmd', i * 5000);
  assert.ok(big.count() <= 6);
  assert.ok(big.canUndo());
});

test('images: file signatures', () => {
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImage(new TextEncoder().encode('GIF89a')), 'image/gif');
  assert.equal(sniffImage(new TextEncoder().encode('RIFFxxxxWEBPVP8 ')), 'image/webp');
  assert.equal(sniffImage(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(sniffImage(new Uint8Array([])), null);
});
