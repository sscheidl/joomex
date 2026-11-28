// Makes the native icon src/win/markup-ninja.ico from tools/markup-ninja-icon.svg: every size rendered by
// Chromium (Playwright, as for the interface tests) with a transparent outside, packed as an ICO with PNG images.
// Owner's choice of 2026-11-28: the logo on a white tile with a deep teal rim, so the dark face is seen on a dark
// taskbar too. After running it, put the new SHA-256 and size into branding-assets.json.
// Usage, in html-school-editor-win/: node tools/make-icon.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'tools', 'markup-ninja-icon.svg');
const TARGET = path.join(ROOT, 'src', 'win', 'markup-ninja.ico');
const SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];

const src = 'data:image/svg+xml;base64,' + fs.readFileSync(SOURCE).toString('base64');
const browser = await chromium.launch();
const images = [];
for (const n of SIZES) {
  const page = await browser.newPage({ viewport: { width: n, height: n }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent"><img id="i" src="${src}" width="${n}" height="${n}" style="display:block"></body></html>`);
  await page.$eval('#i', (i) => i.decode());
  images.push(await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: n, height: n } }));
  await page.close();
}
await browser.close();

// ICONDIR, one ICONDIRENTRY per size, then the PNG images
const head = Buffer.alloc(6 + 16 * SIZES.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(SIZES.length, 4);
let offset = head.length;
SIZES.forEach((n, k) => {
  const e = 6 + 16 * k, png = images[k];
  if (png.readUInt32BE(16) !== n || png.readUInt32BE(20) !== n) throw new Error('size ' + n);
  head.writeUInt8(n % 256, e);
  head.writeUInt8(n % 256, e + 1);
  head.writeUInt16LE(1, e + 4);       // planes
  head.writeUInt16LE(32, e + 6);      // bits per pixel
  head.writeUInt32LE(png.length, e + 8);
  head.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
const ico = Buffer.concat([head, ...images]);
fs.writeFileSync(TARGET, ico);
const { createHash } = await import('node:crypto');
console.log(`${path.relative(ROOT, TARGET)}: ${ico.length} bytes, SHA-256 ${createHash('sha256').update(ico).digest('hex')}`);
