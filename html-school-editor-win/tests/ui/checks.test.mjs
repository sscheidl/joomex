// Unit tests of ui/js/checks.js. Run: node --test tests/ui/
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stageUi, ROOT } from '../../tools/stage-ui.mjs';

const stage = stageUi(path.join(ROOT, 'tests', '.stage', 'unit'));
const { addressProblem, addressProblems } = await import(pathToFileURL(path.join(stage, 'js', 'checks.js')).href);

test('relative addresses inside the project are fine', () => {
  for (const a of ['katze.png', './katze.png', 'bilder/katze.png', 'bilder/tiere/katze.png', 'Meine%20Katze.png', 'K\u00e4tzchen.png', '#oben', 'seite2.html#teil', 'mailto:a@example.org', 'data:image/png;base64,AAAA'])
    assert.equal(addressProblem(a, ['index.html'], true), '', a);
  assert.equal(addressProblem('../bilder/katze.png', ['seiten', 'tiere.html'], true), '');
  assert.equal(addressProblem('../../x.png', ['a', 'b', 'c.html'], true), '');
});

test('problem kinds', () => {
  const page = ['seiten', 'tiere.html'];
  assert.equal(addressProblem('../../x.png', page, true), 'outside');
  assert.equal(addressProblem('../x/../../y.png', page, true), 'outside');
  assert.equal(addressProblem('../x.png', ['index.html'], true), 'outside');
  assert.equal(addressProblem('C:\\Bilder\\katze.png', page, true), 'disk');
  assert.equal(addressProblem('file:///C:/katze.png', page, true), 'disk');
  assert.equal(addressProblem('\\\\server\\share\\a.png', page, true), 'disk');
  assert.equal(addressProblem('https://example.org/a.png', page, true), 'internet');
  assert.equal(addressProblem('//example.org/a.png', page, true), 'internet');
  assert.equal(addressProblem('https://example.org/', page, false), '');      // a link to the internet is fine
  assert.equal(addressProblem('/bilder/a.png', page, true), 'root');
  assert.equal(addressProblem('bilder\\a.png', page, true), 'backslash');
});

test('addresses are read from the code with line numbers', () => {
  const text = [
    '<!DOCTYPE html>',
    '<html><head><link rel="stylesheet" href="/stil.css"><style>body { background: url("../../hg.png"); }</style></head>',
    '<body>',
    '<img src="https://example.org/a.png" alt="">',
    '<img src=\'bilder\\b.png\'>',
    '<a href="../x.html">x</a> <a href="https://example.org">ok</a>',
    '<p style="background-image: url(C:/x.png)">t</p>',
    '<img src="ok.png"> <img src="https://example.org/a.png">',
    '<picture><source srcset="a.png 1x, https://example.org/b.png 2x"></picture>',
    '</body></html>',
  ].join('\n');
  const got = addressProblems(text, ['index.html']).map((p) => [p.kind, p.address, p.line]);
  assert.deepEqual(got, [
    ['root', '/stil.css', 2],
    ['outside', '../../hg.png', 2],
    ['internet', 'https://example.org/a.png', 4],
    ['backslash', 'bilder\\b.png', 5],
    ['outside', '../x.html', 6],
    ['disk', 'C:/x.png', 7],
    ['internet', 'https://example.org/b.png', 9],
  ]);
});

test('character references in attribute values are decoded', () => {
  assert.deepEqual(addressProblems('<img src="https://example.org/a.png?x=1&amp;y=2">', ['i.html']).map((p) => p.address), ['https://example.org/a.png?x=1&y=2']);
});
