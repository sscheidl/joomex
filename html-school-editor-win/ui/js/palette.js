// The text colour palette of the second header row (wish W5 of the owner's collection, 2026-11-27): the eight
// named colours of the single-file editor (written as their CSS name, for example `color: red`), below them a
// grid of fixed shades (written as hex values), "Weitere Farben …" with the colour chooser of the engine
// (<input type="color">; in WebView2 158 a popup of the engine, not the Windows dialog) and "Farbe entfernen".
// Every field has a German name; a colour is never told by its colour alone. The "A" button applies the colour
// chosen last; its bar shows it.

// The palette names of the shared modules (util.js COLORS), with their German names.
export const NAMED = [
  ['red', 'Rot'], ['orange', 'Orange'], ['green', 'Grün'], ['blue', 'Blau'],
  ['navy', 'Dunkelblau'], ['purple', 'Violett'], ['brown', 'Braun'], ['gray', 'Grau'],
];

// Ten columns (grey and nine hues) in five steps from light to dark. Fixed values, so the code a pupil gets is
// always the same for the same field.
const HUES = [
  ['Grau', null], ['Rot', 0], ['Orange', 28], ['Gelb', 50], ['Hellgrün', 90], ['Grün', 135],
  ['Türkis', 175], ['Blau', 215], ['Violett', 270], ['Pink', 325],
];
const STEPS = [['sehr hell', 88], ['hell', 72], ['mittel', 52], ['dunkel', 36], ['sehr dunkel', 22]];

function hex(h, s, l) {
  // HSL (degrees, percent, percent) to #rrggbb
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return '#' + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

// [[name, value]] of the grid, row by row (light to dark).
export const GRID = STEPS.map(([step, l]) => HUES.map(([hue, h]) => [hue + ', ' + step, h === null ? hex(0, 0, l - 6) : hex(h, 78, l)]));

// `choose(value)`: apply a colour ('' removes the colour). `els`: bColor, colorBar, bColorMenu, palette.
export function createPalette(els, choose) {
  const box = els.palette;
  let last = 'red';

  function field(value, name, cls) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (cls ? ' ' + cls : '');
    b.style.background = value;
    b.title = name + (value.startsWith('#') ? ' (' + value + ')' : '');
    b.setAttribute('aria-label', b.title);
    b.dataset.color = value;
    return b;
  }

  const head = (text) => Object.assign(document.createElement('p'), { className: 'palHead', textContent: text });
  const named = document.createElement('div');
  named.className = 'palNamed';
  for (const [value, name] of NAMED) {
    const b = field(value, name, 'named');
    b.append(Object.assign(document.createElement('span'), { textContent: name }));
    named.append(b);
  }
  const grid = document.createElement('div');
  grid.className = 'palGrid';
  for (const row of GRID) for (const [name, value] of row) grid.append(field(value, name));
  const more = Object.assign(document.createElement('button'), { type: 'button', className: 'palWide', textContent: 'Weitere Farben …', title: 'Eine eigene Farbe im Farbdialog von Windows wählen' });
  const input = Object.assign(document.createElement('input'), { type: 'color', id: 'colorInput', tabIndex: -1, value: '#c92a2a' });
  input.setAttribute('aria-hidden', 'true');
  const none = Object.assign(document.createElement('button'), { type: 'button', className: 'palWide', textContent: 'Farbe entfernen', title: 'Die Textfarbe der markierten Stelle entfernen' });
  box.replaceChildren(head('Grundfarben'), named, head('Abstufungen'), grid, more, none);
  input.className = 'offscreen';  // rendered (a hidden input cannot open its dialog), but not seen
  document.body.append(input);

  function showLast() {
    els.colorBar.style.background = last;
    const name = (NAMED.find(([v]) => v === last) || [])[1] || last;
    els.bColor.title = 'Textfarbe: ' + name + ' (die Farbe des Balkens)';
  }

  function open() {
    const r = els.bColorMenu.getBoundingClientRect();
    box.hidden = false;
    const w = box.offsetWidth;
    box.style.left = Math.max(4, Math.min(r.left, innerWidth - w - 4)) + 'px';
    box.style.top = r.bottom + 4 + 'px';
    els.bColorMenu.setAttribute('aria-expanded', 'true');
  }
  function close(refocus) {
    if (box.hidden) return;
    box.hidden = true;
    els.bColorMenu.setAttribute('aria-expanded', 'false');
    if (refocus) els.bColorMenu.focus();
  }
  function pick(value) {
    if (value) { last = value; showLast(); }
    close(false);
    choose(value);
  }

  // The buttons do not take the focus from the page, so the marked text stays marked (as in the toolbar).
  for (const b of [els.bColorMenu, ...box.querySelectorAll('button')]) b.addEventListener('pointerdown', (e) => e.preventDefault());
  els.bColorMenu.addEventListener('click', () => {
    if (!box.hidden) { close(false); return; }
    open();
    if (document.activeElement === els.bColorMenu) box.querySelector('button').focus();  // reached by keyboard
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.color) pick(b.dataset.color);
  });
  none.addEventListener('click', () => pick(''));
  more.addEventListener('click', () => {
    if (last.startsWith('#')) input.value = last;
    // The engine opens its colour chooser next to the field: the field (not seen) sits under the button.
    const r = els.bColorMenu.getBoundingClientRect();
    input.style.left = r.left + 'px';
    input.style.top = r.bottom + 'px';
    close(false);
    input.click();  // its answer comes as "change"
  });

  input.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/.test(input.value)) pick(input.value); });
  box.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } });
  box.addEventListener('focusout', (e) => { if (e.relatedTarget && !box.contains(e.relatedTarget) && e.relatedTarget !== els.bColorMenu) close(false); });
  addEventListener('pointerdown', (e) => { if (!box.hidden && !box.contains(e.target) && e.target !== els.bColorMenu && !els.bColorMenu.contains(e.target)) close(false); }, true);
  addEventListener('resize', () => close(false));
  showLast();

  return {
    get color() { return last; },
    close,
    get open() { return !box.hidden; },
  };
}
