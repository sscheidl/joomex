// Unit tests for the helpers behind images by file name, alignment and single-attribute edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/js/tokenizer.js';
import { parseHtml } from '../../src/js/tree.js';
import { patchAttrs, fileOfSrc, folderOfSrc, imagePath, withAlign, onlyAlign, styleDeclarations, cssRisks, localFileUrl } from '../../src/js/util.js';
import { withTitle } from '../../src/js/format.js';

test('page title: only the text of <title> changes; a missing title is added at the start of the head', () => {
  const set = (src, value) => withTitle(src, tokenize(src), value);
  assert.equal(set('<html><head>\n  <TITLE id=t>Alt</TITLE>\n</head></html>', 'Neu & <b>'), '<html><head>\n  <TITLE id=t>Neu &amp; &lt;b></TITLE>\n</head></html>');
  assert.equal(set('<title></title>', 'Leer war'), '<title>Leer war</title>');
  assert.equal(set('<title>A</title>', ''), '<title></title>');
  assert.equal(set('<title>A\nB</title>', 'Zeile\neins'), '<title>Zeile eins</title>');
  assert.equal(set('<!DOCTYPE html>\n<html>\n<head>\n    <meta charset="utf-8">\n</head>', 'T'), '<!DOCTYPE html>\n<html>\n<head>\n    <title>T</title>\n    <meta charset="utf-8">\n</head>');
  assert.equal(set('<html>\n  <head>\n  </head>', 'T'), '<html>\n  <head>\n    <title>T</title>\n  </head>');
  assert.equal(set('<!DOCTYPE html>\n<p>x</p>', 'T'), '<!DOCTYPE html>\n<title>T</title>\n<p>x</p>');
  assert.equal(set('<p>x</p>', 'T'), '<title>T</title>\n<p>x</p>');
  // the title of an SVG drawing is not the page title
  assert.equal(set('<html><body><svg><title>Kreis</title></svg>', 'T'), '<html>\n<title>T</title><body><svg><title>Kreis</title></svg>');
  // a title that is not closed is not changed
  assert.equal(set('<title>Hallo\n<p>x</p>', 'T'), null);
});

// Applies `changes` to the first tag of `tag` the way the writer does.
function patched(tag, changes) {
  const t = tokenize(tag)[0];
  return tag.slice(0, t.nameEnd) + patchAttrs(tag, t.nameEnd, t.end, t.attrs, changes);
}

test('attributes: one value changes, the rest of the tag stays as written', () => {
  assert.equal(patched('<img src="a.png" alt="x">', { alt: 'Neu & "gut" <b>' }), '<img src="a.png" alt="Neu &amp; &quot;gut&quot; &lt;b>">');
  assert.equal(patched("<IMG SRC='a.png'  ALT = 'x' >", { alt: "it's \"so\"" }), "<IMG SRC='a.png'  ALT = 'it&#39;s \"so\"' >");
  assert.equal(patched('<img src=a.png alt=x>', { src: 'bilder/b c.png' }), '<img src="bilder/b c.png" alt=x>');
  assert.equal(patched('<p\n   id="a"\n   style="color:red"\n>', { style: 'color:red; text-align: right' }), '<p\n   id="a"\n   style="color:red; text-align: right"\n>');
  assert.equal(patched('<p hidden class=a>', { hidden: 'x' }), '<p hidden="x" class=a>');
});

test('attributes: adding and removing', () => {
  assert.equal(patched('<p>', { style: 'text-align: center' }), '<p style="text-align: center">');
  assert.equal(patched('<p class="a">', { style: 'text-align: center' }), '<p class="a" style="text-align: center">');
  assert.equal(patched('<img src="a.png" />', { alt: '' }), '<img src="a.png" alt="" />');
  assert.equal(patched('<img src="a.png" width="10" height="20"/>', { width: null, height: null }), '<img src="a.png"/>');
  assert.equal(patched('<IMG  ALT = \'Alt\'  SRC="a.png"  class=x  HEIGHT=40 width=80 >', { width: '120', height: null }), '<IMG  ALT = \'Alt\'  SRC="a.png"  class=x width="120" >');
  assert.equal(patched('<p style="text-align: center">', { style: null }), '<p>');
  assert.equal(patched('<p id=a>', { style: null }), '<p id=a>', 'removing what is not there changes nothing');
  assert.equal(patched('<a href="1" href="2">', { href: 'neu' }), '<a href="neu" href="2">', 'the first of two equal names is the one the browser uses');
});

test('attributes: badly written tags (review findings A3-02)', () => {
  assert.equal(patched('<img width=80 WIDTH=160>', { width: null }), '<img>', 'removal takes every spelling of the name');
  assert.equal(patched('<img src="a.png" alt="x" width="80" WIDTH="160" height="40" HEIGHT="90">', { width: null, height: null }), '<img src="a.png" alt="x">');
  assert.equal(patched('<img alt= >', { alt: 'Changed' }), '<img alt="Changed" >', 'an equals sign without value belongs to the attribute');
  assert.equal(patched('<img alt=>', { alt: 'x' }), '<img alt="x">');
  assert.equal(patched('<img alt = >', { alt: null }), '<img >');
  assert.equal(patched('<img alt = src="a.png">', { width: '5' }), '<img alt = src="a.png" width="5">', 'an attribute the change does not name stays as it is');
  assert.equal(patched('<img a="1"b="2">', { b: null }), '<img a="1">');
});

test('attributes: the position tree carries the offsets of the tokenizer', () => {
  const src = '<body><p class="a" style="color:red">Text</p></body>';
  const p = parseHtml(src, false).root.kids[0].kids[0];
  assert.equal(p.name, 'p');
  assert.equal('<p' + patchAttrs(src, p.nameEnd, p.tagEnd, p.attrs, { style: null }), '<p class="a">');
});

test('images: file name and folder of an address', () => {
  const cases = [['katze.jpg', 'katze.jpg', ''], ['bilder/Meine%20Katze.jpg?x#y', 'Meine Katze.jpg', 'bilder'], ['../a/b.gif', 'b.gif', '../a'], [' bilder\\x.png ', 'x.png', 'bilder'],
    ['100%.png', '100%.png', ''], ['a%231.png', 'a#1.png', '']];
  for (const [src, file, folder] of cases) {
    assert.equal(fileOfSrc(src), file, src);
    assert.equal(folderOfSrc(src), folder, src);
  }
  for (const src of ['', 'https://example.org/a.png', 'HTTP://example.org/a.png', '//example.org/a.png', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'C:\\Bilder\\a.png', 'file:///c:/a.png', 'blob:null/123', 'a\nb.png']) {
    assert.equal(fileOfSrc(src), '', 'not a plain relative address: ' + JSON.stringify(src));
  }
});

test('images: address made from folder and file name', () => {
  assert.deepEqual(imagePath('', 'a.png'), { ok: true, src: 'a.png' });
  assert.deepEqual(imagePath(' bilder\\fotos/ ', 'a.png'), { ok: true, src: 'bilder/fotos/a.png' });
  assert.deepEqual(imagePath('./x//y/', 'mein bild #1 100%.png'), { ok: true, src: 'x/y/mein bild %231 100%25.png' });
  assert.equal(fileOfSrc(imagePath('x', 'mein bild #1 100%?.png').src), 'mein bild #1 100%?.png', 'the address leads back to the file name');
  for (const folder of ['a:b', 'https://x', 'a?b', 'a#b', 'a"b', 'a<b', 'C:\\Bilder']) assert.equal(imagePath(folder, 'a.png').ok, false, folder);
  assert.equal(imagePath('', '').ok, false);
});

test('images: the file a relative address names, seen from the editor; nothing on another computer or the network', () => {
  const editor = new URL('file:///X:/work/site/schuleditor-kopie.html');
  assert.equal(localFileUrl('katze.jpg', editor), 'file:///X:/work/site/katze.jpg');
  assert.equal(localFileUrl(' bilder/Meine Katze.jpg ', editor), 'file:///X:/work/site/bilder/Meine%20Katze.jpg');
  assert.equal(localFileUrl('bilder\\katze.jpg#oben', editor), 'file:///X:/work/site/bilder/katze.jpg');
  assert.equal(localFileUrl('../katze.jpg', editor), 'file:///X:/work/katze.jpg');
  assert.equal(localFileUrl('f01 mein bild %231 100%25.png', editor), 'file:///X:/work/site/f01%20mein%20bild%20%231%20100%25.png');
  for (const other of ['https://example.org/k.jpg', '//rechner/freigabe/k.jpg', '\\\\rechner\\freigabe\\k.jpg', 'file://rechner/k.jpg', 'C:/k.jpg', 'data:image/png;base64,AAAA', '', 'bilder/']) {
    assert.equal(localFileUrl(other, editor), '', 'not looked for: ' + JSON.stringify(other));
  }
  // an editor on a shared folder looks only on that computer
  const shared = new URL('file://server/share/schuleditor-kopie.html');
  assert.equal(localFileUrl('bilder/k.png', shared), 'file://server/share/bilder/k.png');
  // an editor that was not opened as a file does not look at all
  assert.equal(localFileUrl('k.png', new URL('http://127.0.0.1/schuleditor-kopie.html')), '');
  assert.equal(localFileUrl('k.png', null), '');
});

test('alignment: the declaration is added, replaced and removed without touching the rest', () => {
  assert.equal(withAlign('', 'center'), 'text-align: center');
  assert.equal(withAlign('text-align: center', 'right'), 'text-align: right');
  assert.equal(withAlign('text-align: center', ''), '');
  assert.equal(withAlign('color:red', 'center'), 'color:red; text-align: center');
  assert.equal(withAlign('color:red;', 'center'), 'color:red; text-align: center;');
  assert.equal(withAlign('a:b; TEXT-ALIGN : right ; c:d', ''), 'a:b; c:d');
  assert.equal(withAlign('text-align:center; color:red', 'justify'), 'color:red; text-align: justify');
  for (const style of ['color:red', 'color:red;', 'color: red;  background: url(data:image/png;base64,AA==)', 'font: 12px "A;B"']) {
    assert.equal(withAlign(withAlign(style, 'center'), ''), style, 'adding and removing gives back: ' + style);
  }
  // review finding A3-01: the word inside a string, a bracket or a comment is not a declaration
  const quoted = '--label:"A;text-align: left;B"; color:red';
  assert.equal(withAlign(quoted, 'center'), quoted + '; text-align: center');
  assert.equal(withAlign(withAlign(quoted, 'center'), ''), quoted);
  assert.equal(withAlign('background:url(a;text-align:b)', 'left'), 'background:url(a;text-align:b); text-align: left');
  assert.equal(withAlign('/* text-align: left */ color: red', ''), '/* text-align: left */ color: red');
  assert.equal(withAlign('te\\78t-align: left; x:y', 'right'), 'x:y; text-align: right', 'a name written with an escape is the same property');
  assert.equal(withAlign('text-align/**/: left', ''), '');
  assert.equal(withAlign('text-align: left; a:b; text-align: right;', 'center'), 'a:b; text-align: center;');
  for (const open of ['x:"a', "x:'a", 'x:(a', 'x: a /* b', 'x: a)', 'x:"a\nb"']) assert.equal(withAlign(open, 'center'), null, 'not certain, left alone: ' + JSON.stringify(open));
  assert.deepEqual(styleDeclarations('a:b; c:"d;e"').map((d) => d.name), ['a', 'c']);
  assert.equal(onlyAlign('text-align: center'), 'center');
  assert.equal(onlyAlign(' TEXT-ALIGN:Justify; '), 'justify');
  for (const style of ['', 'color:red', 'text-align: center; color: red', 'text-align: start', 'text-align: url(x)', 'text-align: center; position: fixed']) assert.equal(onlyAlign(style), '', style);
});

test('style rules: what stands in the way of moving white space (review findings RV-02, A3-03)', () => {
  const risks = (css) => Object.keys(cssRisks(css, {})).sort().join(',');
  for (const css of ['p{color:red}', 'a:hover{color:red}', '@media print{p{color:black}}', '@keyframes k{to{margin-left:9px}}', '@font-face{font-family:x;src:local(y)}', ':root{--d:inline}',
    'p::before{content:"x"}', '.a{display:flex}', '@media(x){p{white-space:nowrap}}', 'p{/* display:inline */color:red} @media x{/* p{display:inline} */}', 'color: red; display: inline', '@layer a{p{display:inline}}']) {
    assert.equal(risks(css), '', css);
  }
  for (const css of ['@media(min-width:1500px){p{display:inline}}', 'li:hover{display:inline}', 'p{display:var(--d)}', '@media(x){:root{--d:inline}}', '@keyframes k{to{display:inline}}', 'details[open] p{display:inline}',
    'p:hover::before{content:"x"}', '.b:not(:hover){display:none}', 'p{&:hover{display:inline}}', '} @media x{ a{all:unset} }', '@supports (x:y){p{all:unset}}', '@container (min-width: 1px){p{display:inline}}', '@m\\65 dia x{p{display:inline}}']) {
    assert.equal(risks(css), 'conditional', css);
  }
  for (const css of ['p{white-space:pre}', 'p{white-\\73 pace:pre}', 'white-space: /**/ pre-wrap', 'p{white-space:var(--w)}', 'p{white-space-collapse:preserve}']) assert.equal(risks(css), 'spaces', css);
  assert.equal(risks('@import "a.css";'), 'external');
  assert.equal(risks('p{content:"}'), 'unclear');
  assert.equal(risks('p{color:red} /* offen'), 'unclear');
});
