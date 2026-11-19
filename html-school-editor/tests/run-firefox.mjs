// Compatibility measurements on installed stock Firefox (WebDriver BiDi, no driver/dependencies).
// Run separately from tests/run.mjs: node tests/run-firefox.mjs [--only T-02,F-01] [--no-write]
// Uses the existing assertions unchanged; unsupported automation is PARTIAL/NOT MEASURED.
// Selected-case and --no-write runs leave the recorded full-run evidence untouched.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { launchFirefox, UnsupportedAutomation } from './lib/firefox.mjs';
import { ROOT, ARTEFACT, TMP, Checks, Editor, PV, startSink } from './lib/harness.mjs';
import { functional } from './browser/functional.mjs';
import { security } from './browser/security.mjs';
import { robustness } from './browser/robustness.mjs';
import { review } from './browser/review.mjs';
import { features } from './browser/features.mjs';

const args = process.argv.slice(2), pos = args.indexOf('--only');
const only = pos < 0 ? null : args[pos + 1].split(',');
const writeResults = !only && !args.includes('--no-write');
const fresh = { id: 'FF-START', title: 'stock Firefox starts from file:// and edits both panes with real keys', async run(c, { browser }) {
  const ed = await Editor.open(browser);
  try {
    c.eq(await ed.eval('location.protocol'), 'file:', 'delivered local file, no hosting server');
    c.eq(await ed.eval('typeof showSaveFilePicker'), 'undefined', 'native filesystem-write API absent: download fallback applies');
    await ed.caret('mein Text.', 'mein Text.'.length); await ed.type(' äöü ß'); await ed.settle();
    c.ok((await ed.source()).includes('mein Text. äöü ß</p>'), 'visual typing reaches source');
    await ed.sourceCaret('Webseite', 'Webseite'.length); await ed.type(' FIREFOX'); await ed.settle();
    c.eq(await ed.eval(PV + '.querySelector("h1").textContent'), 'Meine erste Webseite FIREFOX', 'source typing reaches page');
    c.eq(ed.errors().join(' | '), '', 'no application script error');
  } finally { await ed.close(); }
} };
const cases = [fresh, ...functional, ...security, ...robustness, ...review, ...features].filter(t => !only || only.includes(t.id));
// Fixture setup waits for actual completion. The shared helpers otherwise accept an already-matching
// basename, or the 'Jetzt: filename' label of an existing image before its new decode has finished.
// This changes test synchronization only; no pupil-facing code is modified.
const sharedOpenFile = Editor.prototype.openFile;
Editor.prototype.openFile = async function (file, { wait = true } = {}) {
  if (!wait) return sharedOpenFile.call(this, file, { wait: false });
  await this.eval('document.getElementById("msg").textContent = ""');
  await this.page.setFiles('#fileIn', [file]);
  const done = 'document.getElementById("docName").textContent === ' + JSON.stringify(path.basename(file)) +
    ' && document.getElementById("msg").textContent.startsWith("Geöffnet")';
  await this.until('(' + done + ') || document.getElementById("dlgConfirm").open', 'completed open or discard question');
  if (await this.dialogOpen('dlgConfirm')) await this.dialogButton('dlgConfirm', 'Änderungen verwerfen');
  await this.until(done, 'file read and replacement completed'); await this.synced();
};
Editor.prototype.pickImage = async function (file) {
  await this.page.setFiles('#imgIn', [file]);
  await this.until('document.getElementById("imgName").textContent.startsWith(' + JSON.stringify(path.basename(file) + ' (') + ')', 'chosen image decoded', 30000);
};
const bytes = fs.readFileSync(ARTEFACT);
const output = { date: new Date().toISOString(), artefact: 'dist/school-editor.html', bytes: bytes.length,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex'), node: process.version, os: os.type() + ' ' + os.release(),
  driver: 'installed Firefox, standard WebDriver BiDi, Node standard library', mode: 'headless', results: [] };
fs.mkdirSync(TMP, { recursive: true });
const browser = await launchFirefox();
if (!browser) throw new Error('Firefox not installed');
output.browser = browser.version;
console.log(output.browser + ' ' + output.bytes + ' bytes sha256 ' + output.sha256);
const sink = await startSink();
try {
  for (const test of cases) {
    const c = new Checks(), started = Date.now(); let error = null, unsupported = false;
    const initial = new Set((await browser.raw.send('browsingContext.getTree', { maxDepth: 0 })).contexts.map(x => x.context));
    try {
      if (test.id === 'X-04') {
        const page = await browser.newPage();
        const data = await page.eval(`(() => { const d = new DataTransfer(); d.setData('text/plain','synthetic-control');
          const e = new ClipboardEvent('paste',{clipboardData:d}); return { transfer:d.getData('text/plain'), event:e.clipboardData.getData('text/plain') }; })()`);
        await page.close();
        c.note('Firefox synthetic clipboard control', JSON.stringify(data));
        if (data.event !== data.transfer) throw new UnsupportedAutomation('Firefox constructed ClipboardEvent discards supplied clipboardData; trusted system clipboard automation is not implemented');
      }
      await test.run(c, { browser, sink });
    }
    catch (e) { unsupported = e instanceof UnsupportedAutomation; error = String(e.message).replaceAll(ROOT, '[PRODUCT-ROOT]'); }
    finally {
      const now = await browser.raw.send('browsingContext.getTree', { maxDepth: 0 });
      for (const tab of now.contexts) if (!initial.has(tab.context)) await browser.raw.send('browsingContext.close', { context: tab.context });
    }
    const checks = c.items.filter(x => !x.note).length;
    const status = unsupported ? (c.failed.length ? 'FAIL (PARTIAL)' : checks ? 'PARTIAL' : 'NOT MEASURED') : error ? 'ERROR' : c.failed.length ? 'FAIL' : 'PASS';
    const result = { id: test.id, title: test.title, status, ms: Date.now() - started, error,
      checks: c.items, partsNotMeasured: c.items.filter(x => x.notMeasured).length + Number(unsupported) };
    output.results.push(result);
    console.log(status + ' ' + test.id + ' (' + checks + ' checks, ' + result.ms + ' ms)');
    for (const item of c.items) if (!item.pass || item.note) console.log('  ' + (item.pass ? 'NOTE' : 'FAIL') + ' ' + item.label + (item.detail ? ': ' + item.detail : ''));
    if (error) console.log('  ' + (unsupported ? 'NOT MEASURED: ' : 'ERROR: ') + error);
    if (writeResults) fs.writeFileSync(path.join(ROOT, 'tests/results/review-alpha3-firefox.json'), JSON.stringify(output, null, 2) + '\n');
  }
} finally { await sink.close(); await browser.close(); }
output.summary = { pass: output.results.filter(r => r.status === 'PASS').length,
  fail: output.results.filter(r => r.status.startsWith('FAIL')).length, error: output.results.filter(r => r.status === 'ERROR').length,
  partial: output.results.filter(r => r.status === 'PARTIAL').length, notMeasured: output.results.filter(r => r.status === 'NOT MEASURED').length,
  measuredAssertions: output.results.reduce((n, r) => n + r.checks.filter(x => !x.note).length, 0),
  failedAssertions: output.results.reduce((n, r) => n + r.checks.filter(x => !x.pass).length, 0) };
if (writeResults) fs.writeFileSync(path.join(ROOT, 'tests/results/review-alpha3-firefox.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output.summary));
// The fixture directory belongs to this runner; resolve and verify it before recursive removal.
const expectedTemp = path.resolve(ROOT, 'tests/results/tmp');
if (path.resolve(TMP) !== expectedTemp) throw new Error('Unexpected fixture directory');
fs.rmSync(expectedTemp, { recursive: true, force: true });
process.exitCode = output.summary.fail || output.summary.error ? 1 : 0;
