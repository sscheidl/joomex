export const LIMITS = Object.freeze({bytes: 32 * 1024 * 1024, pixels: 2400000, dimension: 4096, pages: 1000, cache: 6,
  imagePixels: 16000000, responseTimeout: 20000, idleTimeout: 20000, parseTimeout: 30000});

/** Errors with a stable code; the interface only ever shows the fixed German texts from MESSAGES. */
export class ViewerError extends Error {
  constructor(code, cause) { super(code, cause ? {cause} : undefined); this.name = 'ViewerError'; this.code = code; }
}
export const MESSAGES = Object.freeze({
  'invalid-path': 'Ungültiger PDF-Pfad.',
  foreign: 'Nur PDFs im eigenen Medienverzeichnis sind erlaubt.',
  unreachable: 'Die PDF-Datei ist nicht erreichbar.',
  network: 'Die PDF-Datei konnte nicht geladen werden. Bitte später erneut versuchen.',
  timeout: 'Die PDF-Datei lädt zu langsam. Bitte später erneut versuchen oder das PDF direkt öffnen.',
  'too-large': 'PDF ist größer als 32 MB.',
  'not-pdf': 'Die Datei ist kein PDF.',
  'too-many-pages': 'Das PDF enthält mehr als 1000 Seiten.',
  password: 'Dieses PDF ist passwortgeschützt.',
  invalid: 'Die PDF-Datei ist beschädigt oder ungültig.',
  closed: 'Ansicht geschlossen.',
  render: 'Die Seite konnte nicht dargestellt werden.',
  config: 'Ungültige PDF-Konfiguration.',
  generic: 'Das PDF konnte nicht angezeigt werden.',
});
// Exception class names of the shipped PDF.js 6.5.438 (checked against vendor/pdfjs/build/pdf.js by tests/model.test.mjs).
export const PDFJS_ERRORS = Object.freeze({PasswordException: 'password', InvalidPDFException: 'invalid', FormatError: 'invalid',
  ResponseException: 'unreachable'});
export function messageFor(error) {
  const code = error instanceof ViewerError ? error.code : PDFJS_ERRORS[error?.name] || 'generic';
  return MESSAGES[code] || MESSAGES.generic;
}

export function safePdfUrl(source, base, mediaRoot = 'images/') {
  if (typeof source !== 'string' || source.length > 2048 || /[\\\x00-\x20\x7f]/.test(source) || source.startsWith('//')) throw new ViewerError('invalid-path');
  let decoded;
  try { decoded = decodeURIComponent(source); } catch { throw new ViewerError('invalid-path'); }
  // Encoded spaces (%20) are allowed; every other control character stays forbidden.
  if (/[\\\x00-\x1f\x7f%?#]/.test(decoded) || decoded.split('/').some(p => p === '.' || p === '..')) throw new ViewerError('invalid-path');
  const root = new URL(mediaRoot, base);
  const url = new URL(source, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== root.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(root.pathname) || !/\.pdf$/i.test(url.pathname)) throw new ViewerError('foreign');
  // Compare decoded paths too: encoded separators must not bypass the root policy.
  if (!decodeURIComponent(url.pathname).startsWith(decodeURIComponent(root.pathname))) throw new ViewerError('foreign');
  return url.href;
}

export function safeLink(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function spreadFor(page, count, single = false, rtl = false) {
  page = Math.max(1, Math.min(count, Math.trunc(Number(page)) || 1));
  if (single) return [page];
  const left = page === 1 ? 0 : page - (page % 2);
  const pair = [left, left + 1].map(n => n > 0 && n <= count ? n : 0);
  return rtl ? pair.reverse() : pair;
}

export function nextPage(page, count, single, delta) {
  if (single) return Math.max(1, Math.min(count, page + delta));
  const base = page === 1 ? 0 : page - (page % 2);
  return Math.max(1, Math.min(count, base + delta * 2));
}

/** "Seite 5" for one visible page, "Seiten 4–5" for two. */
export function statusText(numbers) {
  const visible = numbers.filter(Boolean);
  return visible.length === 1 ? `Seite ${visible[0]}` : `Seiten ${visible.join('–')}`;
}

/** Page-mode switch: auto → single → double → auto. */
export function nextMode(mode) {
  return {auto: 'single', single: 'double', double: 'auto'}[mode] || 'auto';
}

export function renderDimensions(width, height, desiredWidth) {
  if (![width, height, desiredWidth].every(v => Number.isFinite(v) && v > 0)) throw new Error('Ungültige Seitengröße.');
  const scale = Math.min(desiredWidth / width, Math.sqrt(LIMITS.pixels / (width * height)), LIMITS.dimension / width, LIMITS.dimension / height);
  return {scale, width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale))};
}

export function normalizeConfig(data = {}) {
  return {
    src: String(data.src || ''), title: String(data.title || 'PDF-Flipbook').slice(0, 200),
    // The module passes a root-relative base; resolving it against the page keeps origin and scheme equal to the page.
    base: new URL(String(data.base || '.'), location.href).href, mediaRoot: 'images/', fill: data.fill === true,
    mode: ['single', 'double', 'auto'].includes(data.mode) ? data.mode : 'auto',
    direction: data.direction === 'rtl' ? 'rtl' : 'ltr',
    duration: Math.max(150, Math.min(1800, Number(data.duration) || 800)),
    download: data.download !== false, renderer: data.renderer === 'flat' ? 'flat' : 'webgl',
    height: Math.max(320, Math.min(1000, Number(data.height) || 560)),
    background: /^#[a-f0-9]{6}$/i.test(data.background) ? data.background : '#f2f2f2',
  };
}
