// Unit tests of ui/js/breaks.js: every line break is written back as it was read. Run: node --test tests/ui/
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { stageUi, ROOT } from '../../tools/stage-ui.mjs';

const stage = stageUi(path.join(ROOT, 'tests', '.stage', 'unit-breaks'));
const { breaksOfBytes, breaksOfRaw, lfOf, createBreaks } = await import(pathToFileURL(path.join(stage, 'js', 'breaks.js')).href);

const RAW = 'eins\r\nzwei\ndrei\rvier\r\n\r\nsechs\n';         // CRLF, LF, CR, CRLF, CRLF, LF
const LF = RAW.replace(/\r\n?/g, '\n');
const open = (raw) => createBreaks(raw.replace(/\r\n?/g, '\n'), breaksOfBytes(Buffer.from(raw, 'utf8')), '\r\n');

test('the breaks of the bytes, in order', () => {
  assert.deepEqual(breaksOfBytes(Buffer.from(RAW)), ['\r\n', '\n', '\r', '\r\n', '\r\n', '\n']);
  assert.deepEqual(breaksOfBytes(Buffer.from('\r\r\n\n\r')), ['\r', '\r\n', '\n', '\r']);
  assert.deepEqual(breaksOfBytes(Buffer.from('ohne')), []);
  assert.deepEqual(breaksOfBytes(Buffer.from([0xef, 0xbb, 0xbf, 0x61, 0x0d])), ['\r'], 'a BOM is no break');
  assert.deepEqual(breaksOfBytes(Buffer.from([0x6b, 0xe4, 0x0d, 0x0a, 0x73])), ['\r\n'], 'Windows-1252 bytes');
});

test('open and save without a change gives the same text, mixed breaks included', () => {
  assert.equal(open(RAW).encode(LF), RAW);
  for (const raw of ['', 'a', '\r', '\n', '\r\n', '\r\r\n\n', 'a\rb\rc', 'x\r\n'.repeat(1000) + 'y\n'.repeat(1000) + 'z\r'.repeat(1000)])
    assert.equal(open(raw).encode(raw.replace(/\r\n?/g, '\n')), raw, JSON.stringify(raw.slice(0, 20)));
  assert.throws(() => createBreaks('a\nb', [], '\n'), /do not match/);
});

test('a change keeps the breaks of the lines it does not touch', () => {
  const b = open(RAW);
  // typing inside line "drei" (which ends with a lone CR)
  assert.equal(b.encode(LF.replace('drei', 'drei!')), RAW.replace('drei', 'drei!'));
  // a whole line deleted (line "zwei" with its LF)
  const without = LF.replace('zwei\n', '');
  assert.equal(b.encode(without), RAW.replace('zwei\n', '').replace('drei!', 'drei'));
  // changes at the start and at the end, one after the other
  const b2 = open(RAW);
  let t = LF;
  t = 'X' + t; b2.follow(t);
  t = t + 'Y'; b2.follow(t);
  t = t.replace('vier', 'VIER'); b2.follow(t);
  assert.equal(b2.encode(t), 'X' + RAW.replace('vier', 'VIER') + 'Y');
});

test('a new break gets the kind of the break that ends its line', () => {
  const b = open(RAW);
  // Enter inside "drei" (ends with CR), inside "eins" (CRLF) and inside "zwei" (LF)
  let t = LF.replace('drei', 'dr\nei'); b.follow(t);
  t = t.replace('eins', 'ei\nns'); b.follow(t);
  t = t.replace('zwei', 'zw\nei');
  assert.equal(b.encode(t), RAW.replace('drei', 'dr\rei').replace('eins', 'ei\r\nns').replace('zwei', 'zw\nei'));
  // a break at the very end of a text without breaks gets the fallback
  const e = createBreaks('a', [], '\r\n');
  assert.equal(e.encode('a\nb'), 'a\r\nb');
});

test('replacing a part that holds breaks reuses them in order', () => {
  const b = open('a\r\nb\rc\nd');
  assert.equal(b.encode('A\nB\nC\nd'), 'A\r\nB\rC\nd');
});

test('typing back the text as read or as last saved gives its bytes again', () => {
  const b = open(RAW);
  b.follow(LF.replace('drei\n', 'drei'));          // the CR break is gone
  assert.equal(b.encode(LF), RAW, 'typed back by hand: the text as read');
  const saved = LF.replace('sechs', 'sieben');
  const savedRaw = b.encode(saved);
  b.remember(savedRaw);
  b.follow(saved.replace('drei\n', 'drei'));
  assert.equal(b.encode(saved), savedRaw, 'the text last saved');
  assert.equal(b.encode(LF), RAW, 'the text as read is still known');
});

test('raw texts: breaks and LF text of a raw text, restore of an undo step', () => {
  assert.deepEqual(breaksOfRaw('a\r\nb\rc\nd\r'), ['\r\n', '\r', '\n', '\r']);
  assert.equal(lfOf('a\r\nb\rc\nd\r'), 'a\nb\nc\nd\n');
  const b = open(RAW);
  b.restore('X\ry\r\nz');
  assert.equal(b.text, 'X\ny\nz');
  assert.equal(b.raw, 'X\ry\r\nz');
  assert.equal(b.encode('X\ny\nz!'), 'X\ry\r\nz!', 'follows on from the restored state');
});

// Review of alpha.4 (2026-11-25): an unsaved intermediate state got LF for a lone CR after undo, and a
// late save confirmation rebuilt the saved state from the text typed meanwhile.
test('an undo step keeps its own breaks: deleting a lone CR and undoing to an unsaved state', () => {
  const b = createBreaks('a\nb\nc\nd', ['\r\n', '\r', '\n'], '\n');
  const step = 'A\nb\nc\nd';                       // unsaved intermediate state, as stored by the history
  const stepRaw = b.encode(step);
  assert.equal(stepRaw, 'A\r\nb\rc\nd');
  b.follow('A\nbc\nd');                            // the lone CR deleted
  b.restore(stepRaw);                              // undo: the history gives back the raw text of the step
  assert.equal(b.raw, 'A\r\nb\rc\nd');
  assert.equal(b.encode('A\nb\nc\nd!'), 'A\r\nb\rc\nd!');
});

test('a save keeps the breaks it sent, also when its confirmation comes after more typing', () => {
  const b = createBreaks('a\nb\nc\nd', ['\r\n', '\r', '\n'], '\n');
  const sentRaw = b.encode('A\nb\nc\nd');          // what the save sends
  b.follow('A\nbc\nd');                            // typed on: the lone CR deleted
  b.remember(sentRaw);                             // the late confirmation
  assert.equal(b.raw, 'A\r\nbc\nd', 'the current state stays as typed');
  assert.equal(b.encode('A\nb\nc\nd'), sentRaw, 'back to the saved text: the bytes on disk');
});
