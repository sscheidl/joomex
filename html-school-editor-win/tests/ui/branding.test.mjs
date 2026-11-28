// Browser tests of the Markup Ninja branding (owner's brief of 2026-11-27, alpha.23): name, wordmark, palette and
// contrast, the hero in "Hilfe", offline assets. They fail against alpha.22. MOCK of the C++ core as in ui.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, openUi, b64, PROJECT } from './harness.mjs';
import { ROOT } from '../../tools/stage-ui.mjs';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(width = 1280) {
  const ui = await openUi(browser);
  await ui.page.setViewportSize({ width, height: 760 });
  ui.requests = [];
  ui.page.on('request', (r) => ui.requests.push(r.url()));
  await ui.deliver(PROJECT);
  await ui.opened({ type: 'opened', seq: 1, path: 'index.html', name: 'index.html', data: b64(Buffer.from('<!DOCTYPE html>\r\n<title>T</title>\r\n<p>Hallo</p>\r\n')) });
  await ui.page.waitForSelector('#visualFrame', { state: 'visible' });
  return ui;
}
// WCAG contrast ratio of two CSS colours "rgb(r, g, b)"
function contrast(a, b) {
  const lum = (c) => {
    const [r, g, bl] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((v) => {
      const x = Number(v) / 255;
      return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test('branding: the name Markup Ninja, the wordmark with its logo, the title and the footer', async () => {
  const ui = await open();
  assert.equal(await ui.page.title(), 'index.html – Markup Ninja');
  assert.equal(await ui.page.textContent('.brand strong'), 'Markup Ninja');
  const logo = ui.page.locator('.brand img');
  await logo.evaluate((i) => i.decode());
  const info = await logo.evaluate((i) => ({ alt: i.getAttribute('alt'), w: i.naturalWidth, box: [i.getBoundingClientRect().width, i.getBoundingClientRect().height], src: i.src }));
  assert.equal(info.alt, '', 'decorative next to the name');
  assert.ok(info.w > 0, 'the logo loads');
  assert.deepEqual(info.box, [30, 30]);
  assert.equal(info.src, 'https://app.example/assets/ninja-logo.svg');
  assert.equal(await ui.page.$eval('.brand .w1', (e) => getComputedStyle(e).color), 'rgb(20, 32, 51)', 'Markup in navy');
  assert.equal(await ui.page.$eval('.brand .w2', (e) => getComputedStyle(e).color), 'rgb(14, 116, 144)', 'Ninja in deep teal');
  assert.equal(await ui.page.textContent('#versionBottom'), 'Markup Ninja 0.1.0-test');
  assert.equal((await ui.page.textContent('body')).includes('HTML-Schuleditor'), false, 'the old name is nowhere in the interface');
  assert.deepEqual(ui.errors, []);
});

test('branding: the palette of the brief, and its contrasts', async () => {
  const ui = await open();
  const style = (sel, prop) => ui.page.$eval(sel, (e, p) => getComputedStyle(e)[p], prop);
  assert.equal(await style('#bSave', 'backgroundColor'), 'rgb(14, 116, 144)', 'primary action in deep teal');
  assert.equal(await style('#bPicture', 'color'), 'rgb(21, 94, 117)');
  assert.equal(await style('#topEdit', 'backgroundColor'), 'rgb(237, 243, 246)', 'Mist toolbar');
  assert.equal(await style('#srcBox', 'backgroundColor'), 'rgb(255, 255, 255)', 'the code stays white');
  assert.equal(await style('#pvSlot', 'backgroundColor'), 'rgb(255, 255, 255)', 'the page stays white');
  assert.equal(await style('#top', 'backgroundColor'), 'rgb(255, 255, 255)', 'no dark header');
  // the pupil's page itself is not branded
  assert.equal(await ui.page.frameLocator('#visualFrame').locator('p').evaluate((p) => getComputedStyle(p).color), 'rgb(0, 0, 0)');
  // syntax colours
  await ui.page.waitForSelector('#hlIn .tg');
  assert.equal(await style('#hlIn .tg', 'color'), 'rgb(14, 116, 144)');
  // contrasts (at least 4.5:1 for text, 3:1 for the focus ring)
  const pairs = [
    [await style('#bSave', 'color'), await style('#bSave', 'backgroundColor'), 4.5, 'Speichern'],
    [await style('#files li.current', 'color'), await style('#files li.current', 'backgroundColor'), 4.5, 'current file'],
    [await style('#gutter', 'color'), await style('#gutter', 'backgroundColor'), 4.5, 'line numbers'],
    [await style('#docState', 'color'), 'rgb(255, 255, 255)', 4.5, 'saved state'],
    [await style('#hlIn .tg', 'color'), 'rgb(255, 255, 255)', 4.5, 'tags in the code'],
    [await style('#bPicture', 'color'), await style('#bPicture', 'backgroundColor'), 4.5, 'Bild einfügen'],
  ];
  for (const [fg, bg, min, label] of pairs) assert.ok(contrast(fg, bg) >= min, `${label}: ${contrast(fg, bg).toFixed(2)} (${fg} on ${bg})`);
  await ui.page.focus('#bProject');
  await ui.page.keyboard.press('Tab');
  const ring = await ui.page.evaluate(() => getComputedStyle(document.activeElement).outlineColor);
  assert.ok(contrast(ring, 'rgb(255, 255, 255)') >= 3, 'focus ring on white: ' + ring);
  assert.ok(contrast(ring, 'rgb(237, 243, 246)') >= 3, 'focus ring on Mist: ' + ring);
  // a pressed format button
  await ui.page.frameLocator('#visualFrame').locator('p').click();
  await ui.page.waitForFunction(() => document.querySelector('[data-edit="p"]').getAttribute('aria-pressed') === 'true');
  assert.equal(await style('[data-edit="p"]', 'backgroundColor'), 'rgb(213, 240, 240)');
  assert.deepEqual(ui.errors, []);
});

test('branding: the hero at the top of "Hilfe", whole and offline; the next question is plain again', async () => {
  for (const width of [1280, 1138]) {
    const ui = await open(width);
    await ui.page.click('#bHelp');
    await ui.page.waitForSelector('dialog[open]');
    const hero = ui.page.locator('#dlg img.helpHero');
    await hero.evaluate((i) => i.decode());
    const h = await hero.evaluate((i) => {
      const r = i.getBoundingClientRect(), d = document.getElementById('dlg').getBoundingClientRect();
      return { n: [i.naturalWidth, i.naturalHeight], w: r.width, ratio: r.width / r.height, inside: r.left >= d.left && r.right <= d.right, dialog: d.width, alt: i.alt, src: i.src };
    });
    assert.deepEqual(h.n, [1536, 1024], width + ': the full picture loads');
    assert.ok(h.w > 0 && h.w <= 600, width + ': at most 600 pixels wide: ' + h.w);
    assert.ok(Math.abs(h.ratio - 1.5) < 0.02, width + ': not cropped or stretched: ' + h.ratio);
    assert.ok(h.inside && h.dialog <= 662, width + ': inside the dialog');
    assert.match(h.alt, /Ninja/);
    assert.equal(h.src, 'https://app.example/assets/ninja-hero.webp');
    assert.match(await ui.page.textContent('#dlgBody'), /Markup Ninja – der HTML-Editor für die Schule \(Windows\), Version 0\.1\.0-test/);
    await ui.page.keyboard.press('Escape');
    // the next question has its usual width again
    await ui.page.click('#bNew');
    await ui.page.waitForSelector('dialog[open]');
    assert.equal(await ui.page.$eval('#dlg', (d) => d.className), '');
    assert.ok(await ui.page.$eval('#dlg', (d) => d.getBoundingClientRect().width) <= 562);
    await ui.page.keyboard.press('Escape');
    assert.ok(ui.requests.every((u) => u.startsWith('https://app.example/') || u.startsWith('https://projekt.example/') || u.startsWith('data:')), 'no other host: ' + ui.requests.filter((u) => !u.startsWith('https://app.example/')).join(', '));
    assert.deepEqual(ui.errors, []);
  }
});

test('branding: the SVG logo holds no active content; the picture files are the approved ones', async () => {
  const svg = fs.readFileSync(path.join(ROOT, 'ui', 'assets', 'ninja-logo.svg'), 'utf8');
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.doesNotMatch(svg, /<script|<foreignObject|\son[a-z]+\s*=|href\s*=|url\(|<image|<!ENTITY|<!DOCTYPE/i);
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'branding-assets.json'), 'utf8')).files;
  const crypto = await import('node:crypto');
  for (const [name, entry] of Object.entries(manifest)) {
    const data = fs.readFileSync(path.join(ROOT, '..', name));
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'), entry.sha256, name);
  }
  const served = JSON.parse(fs.readFileSync(path.join(ROOT, 'ui', 'resources.json'), 'utf8')).files;
  assert.equal(served['/assets/ninja-hero.webp'], 'ui/assets/ninja-hero.webp');
  assert.ok(Object.keys(manifest).includes('html-school-editor-win/ui/assets/ninja-hero.webp'), 'the served picture is an approved one');
});
