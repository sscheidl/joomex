// Unit tests for the helpers behind images by file name, alignment and single-attribute edits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/js/tokenizer.js';
import { parseHtml } from '../../src/js/tree.js';
import { patchAttrs, fileOfSrc, folderOfSrc, imagePath, withAlign, onlyAlign } from '../../src/js/util.js';

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
  assert.equal(onlyAlign('text-align: center'), 'center');
  assert.equal(onlyAlign(' TEXT-ALIGN:Justify; '), 'justify');
  for (const style of ['', 'color:red', 'text-align: center; color: red', 'text-align: start', 'text-align: url(x)', 'text-align: center; position: fixed']) assert.equal(onlyAlign(style), '', style);
});
