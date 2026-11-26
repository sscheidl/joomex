// Checks of the addresses written in a page that the page view cannot show as a problem by itself.
// The engine resolves addresses; these checks only find addresses that would behave differently on a
// web server or in the browser than the pupil expects. No DOM: unit-tested in Node.
import { tokenize } from './shared/tokenizer.js';

// Attributes that load a file (src, href of link, poster) or point to one (href of a).
const LOADS = { img: ['src'], source: ['src', 'srcset'], script: ['src'], link: ['href'], audio: ['src'], video: ['src', 'poster'], iframe: ['src'], embed: ['src'], object: ['data'], track: ['src'], input: ['src'] };
const POINTS = { a: ['href'], area: ['href'] };

const ENT = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
function decode(v) {
  return v.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);?/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
}

function lineOf(starts, offset) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= offset) lo = mid; else hi = mid - 1; }
  return lo + 1;
}

// Kind of problem of one address, or '' if there is none.
//   internet: a file is loaded from the internet (the page view loads nothing from the network)
//   disk:     an absolute path or file: address of this computer (works on no other computer)
//   root:     begins with "/" (on a web server the site root, in a browser opened from the disk the drive root)
//   backslash: "\" instead of "/" (Windows accepts it, web servers do not)
//   outside:  more "../" than folders: the address leaves the project folder
export function addressProblem(address, pageSegments, loads) {
  const v = address.trim();
  if (!v || v[0] === '#' || /^(?:data|mailto|tel|javascript|about|blob):/i.test(v)) return '';
  if (/^[a-z]:[\\/]/i.test(v) || /^file:/i.test(v) || /^\\\\/.test(v)) return 'disk';
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) || v.startsWith('//')) return loads ? 'internet' : '';
  if (v.includes('\\')) return 'backslash';
  if (v[0] === '/') return 'root';
  const path = v.split(/[?#]/)[0];
  let depth = pageSegments.length - 1;                 // folders of the page below the project folder
  for (const seg of path.split('/')) {
    if (seg === '..') { if (--depth < 0) return 'outside'; }
    else if (seg !== '.' && seg !== '') depth++;
  }
  return '';
}

// All problems of the addresses in `text` for a page at `pageSegments` (["seiten", "tiere.html"]).
// Returns [{ address, kind, line }] in the order of the text, each address once per kind.
export function addressProblems(text, pageSegments) {
  const starts = [0];
  for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) starts.push(i + 1);
  const out = [], seen = new Set();
  const add = (address, loads, offset) => {
    const kind = addressProblem(address, pageSegments, loads);
    if (!kind || seen.has(kind + '\u0000' + address)) return;
    seen.add(kind + '\u0000' + address);
    out.push({ address, kind, line: lineOf(starts, offset) });
  };
  const cssUrls = (css, base) => {
    const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)|@import\s+(?:"([^"]*)"|'([^']*)')/gi;
    let m;
    while ((m = re.exec(css))) add(m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? '', true, base + m.index);
  };
  let inStyle = false;
  for (const tok of tokenize(text)) {
    if (tok.type === 'text' && inStyle) { cssUrls(text.slice(tok.start, tok.end), tok.start); continue; }
    if (tok.type === 'end' && tok.name === 'style') { inStyle = false; continue; }
    if (tok.type !== 'start') continue;
    if (tok.name === 'style') inStyle = true;
    const loads = LOADS[tok.name] || [], points = POINTS[tok.name] || [];
    const a = tok.attrs;
    for (let i = 0; i < a.length; i += 4) {
      const name = text.slice(a[i], a[i + 1]).toLowerCase();
      if (a[i + 2] < 0) continue;
      let raw = text.slice(a[i + 2], a[i + 3]);
      if (raw[0] === '"' || raw[0] === "'") raw = raw.slice(1, -1);
      const value = decode(raw);
      if (name === 'style') { cssUrls(value, a[i + 2]); continue; }
      const isLoad = loads.includes(name), isPoint = points.includes(name);
      if (!isLoad && !isPoint) continue;
      if (name === 'srcset') { for (const part of value.split(',')) add(part.trim().split(/\s+/)[0] || '', true, a[i + 2]); continue; }
      add(value, isLoad, a[i + 2]);
    }
  }
  return out;
}

// German text of a problem, for 12-year-olds.
export const PROBLEM_TEXT = {
  internet: 'kommt aus dem Internet. Der Editor lädt nichts aus dem Internet. Lade die Datei herunter (denk an das Urheberrecht), lege sie in deinen Projektordner und schreibe ihren Namen.',
  disk: 'ist ein Pfad auf diesem Computer. Auf einem anderen Computer oder im Internet gibt es ihn nicht. Schreibe die Adresse relativ zu deiner Seite, zum Beispiel bilder/katze.jpg.',
  root: 'beginnt mit „/“. Im Browser zeigt das auf die ganze Festplatte, nicht auf deinen Projektordner. Lass das „/“ am Anfang weg.',
  backslash: 'enthält „\\“. Im Internet trennt man Ordner mit „/“, zum Beispiel bilder/katze.jpg.',
  outside: 'führt mit „../“ aus deinem Projektordner hinaus. Lege die Datei in deinen Projektordner.',
  notFound: 'gibt es nicht. Prüfe den Namen und den Ordner – auch die Endung (.jpg, .jpeg, .png).',
  case: 'heißt auf der Festplatte anders geschrieben: ',
};
