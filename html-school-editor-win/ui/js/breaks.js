// The line breaks of an opened file, kept one by one, so that saving writes every break as it was read.
// The code field works with LF only (a text area turns CR and CRLF into LF), so the kind of each break
// (LF, CRLF or a lone CR) is kept here, in order, and follows every change of the text:
// * breaks in parts of the text that were not changed stay as they were;
// * a break typed into a line gets the kind of the break that ends that line (the local convention);
// * when the text is again exactly the text as read or as last saved, its breaks come back.
// A state with its breaks is a "raw" text: the text with every break written as it stands in the file.
// The undo history stores raw texts and every save takes the raw text it sends (editor.js, main.js), so
// an undo step and a save each keep their own breaks.
// No DOM: unit-tested in Node.

// Kinds of the line breaks in the bytes of a file (after a BOM), in order. CR and LF are single bytes in
// UTF-8 and Windows-1252 alike, so the bytes give the same breaks as the decoded text.
export function breaksOfBytes(bytes) {
  const out = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d) {
      if (bytes[i + 1] === 0x0a) { out.push('\r\n'); i++; } else out.push('\r');
    } else if (bytes[i] === 0x0a) out.push('\n');
  }
  return out;
}

// The breaks of a raw text, and its text with LF only.
export const breaksOfRaw = (raw) => raw.match(/\r\n|\r|\n/g) || [];
export const lfOf = (raw) => raw.replace(/\r\n?/g, '\n');

const countLf = (s, from = 0, to = s.length) => {
  let n = 0;
  for (let i = s.indexOf('\n', from); i >= 0 && i < to; i = s.indexOf('\n', i + 1)) n++;
  return n;
};

function join(text, list) {
  let out = '', at = 0, k = 0;
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) {
    out += text.slice(at, i) + list[k++];
    at = i + 1;
  }
  return out + text.slice(at);
}

// `text`: the text with LF only; `breaks`: the kinds of its breaks, one per LF; `fallback`: the kind for a
// break where nothing is known (an empty file).
export function createBreaks(text, breaks, fallback) {
  if (countLf(text) !== breaks.length) throw new Error('breaks do not match the text');
  let current = text, list = breaks.slice(), raw = null, lastSaved = null;
  const known = new Map([[text, breaks.slice()]]);  // the text as read, and the text last saved

  // Follows the text from `current` to `next`: the common start and end keep their breaks.
  function follow(next) {
    if (next === current) return;
    raw = null;
    const remembered = known.get(next);
    if (remembered) { current = next; list = remembered.slice(); return; }
    const max = Math.min(current.length, next.length);
    let p = 0;
    while (p < max && current.charCodeAt(p) === next.charCodeAt(p)) p++;
    let s = 0;
    while (s < max - p && current.charCodeAt(current.length - 1 - s) === next.charCodeAt(next.length - 1 - s)) s++;
    const before = countLf(current, 0, p);                       // breaks in the common start
    const after = countLf(current, current.length - s);           // breaks in the common end
    const removed = list.slice(before, list.length - after);      // breaks of the changed part, in order
    const added = countLf(next, p, next.length - s);
    // the break that ends the line in which the change lies
    const local = list[before] ?? list[before - 1] ?? fallback;
    const middle = [];
    for (let i = 0; i < added; i++) middle.push(i < removed.length ? removed[i] : local);
    list = list.slice(0, before).concat(middle, list.slice(list.length - after));
    current = next;
  }

  return {
    follow,
    get text() { return current; },
    get list() { return list.slice(); },
    // The current text with every LF written as the break it stands for.
    get raw() { return raw ??= join(current, list); },
    // The text with every LF written as the break it stands for (follows the text first).
    encode(next) { follow(next); return this.raw; },
    // Takes the state of an undo step exactly as it was: its text and its breaks.
    restore(stepRaw) { current = lfOf(stepRaw); list = breaksOfRaw(stepRaw); raw = stepRaw; },
    // `savedRaw` was saved: a text that is again exactly its text gets these breaks. The current state
    // stays as it is (the pupil may have typed on while the save was on its way).
    remember(savedRaw) {
      const t = lfOf(savedRaw);
      if (lastSaved !== null && lastSaved !== text && lastSaved !== t) known.delete(lastSaved);
      known.set(t, breaksOfRaw(savedRaw));
      lastSaved = t;
    },
  };
}
