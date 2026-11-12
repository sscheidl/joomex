export const LIMITS = Object.freeze({bytes: 32 * 1024 * 1024, pixels: 2400000, dimension: 4096, pages: 1000, cache: 6});

export function safePdfUrl(source, base, mediaRoot = 'images/') {
  if (typeof source !== 'string' || source.length > 2048 || /[\\\x00-\x20\x7f]/.test(source) || source.startsWith('//')) throw new Error('Ungültiger PDF-Pfad.');
  let decoded;
  try { decoded = decodeURIComponent(source); } catch { throw new Error('Ungültige Pfadkodierung.'); }
  if (/[\\\x00-\x20\x7f%?#]/.test(decoded) || decoded.split('/').some(p => p === '.' || p === '..')) throw new Error('Ungültiger PDF-Pfad.');
  const root = new URL(mediaRoot, base);
  const url = new URL(source, base);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== root.origin || url.username || url.password || url.search || url.hash || !url.pathname.startsWith(root.pathname) || !/\.pdf$/i.test(url.pathname)) throw new Error('Nur PDFs im eigenen Medienverzeichnis sind erlaubt.');
  // Compare decoded paths too: encoded separators must not bypass the root policy.
  if (!decodeURIComponent(url.pathname).startsWith(decodeURIComponent(root.pathname))) throw new Error('PDF außerhalb des Medienverzeichnisses.');
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

export function renderDimensions(width, height, desiredWidth) {
  if (![width, height, desiredWidth].every(v => Number.isFinite(v) && v > 0)) throw new Error('Ungültige Seitengröße.');
  const scale = Math.min(desiredWidth / width, Math.sqrt(LIMITS.pixels / (width * height)), LIMITS.dimension / width, LIMITS.dimension / height);
  return {scale, width: Math.max(1, Math.floor(width * scale)), height: Math.max(1, Math.floor(height * scale))};
}

export function normalizeConfig(data = {}) {
  return {
    src: String(data.src || ''), title: String(data.title || 'PDF-Flipbook').slice(0, 200),
    base: String(data.base || new URL('.', location.href)), mediaRoot: 'images/',
    mode: ['single', 'double', 'auto'].includes(data.mode) ? data.mode : 'auto',
    direction: data.direction === 'rtl' ? 'rtl' : 'ltr',
    duration: Math.max(150, Math.min(1800, Number(data.duration) || 800)),
    download: data.download !== false, renderer: data.renderer === 'flat' ? 'flat' : 'webgl',
    height: Math.max(320, Math.min(1000, Number(data.height) || 560)),
    background: /^#[a-f0-9]{6}$/i.test(data.background) ? data.background : '#f2f2f2',
  };
}
