// Acceptance run against the delivered single file.
//   node tests/run.mjs [--browser edge|chrome] [--only T-05,X-01] [--headed] [--no-write]
// Writes tests/results/acceptance-<browser>.json. A browser that is not installed is reported NOT MEASURED.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { launch } from './lib/cdp.mjs';
import { ROOT, ARTEFACT, TMP, Checks, startSink } from './lib/harness.mjs';
import { functional } from './browser/functional.mjs';
import { security } from './browser/security.mjs';
import { robustness } from './browser/robustness.mjs';
import { review } from './browser/review.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const only = opt('--only') ? opt('--only').split(',') : null;
const browsers = opt('--browser') ? [opt('--browser')] : ['edge', 'chrome'];
const cases = [...functional, ...security, ...robustness, ...review].filter((t) => !only || only.includes(t.id));

const artefact = fs.readFileSync(ARTEFACT);
const meta = {
  artefact: 'dist/school-editor.html',
  bytes: artefact.length,
  sha256: crypto.createHash('sha256').update(artefact).digest('hex'),
  sizeLimit: 200000,
  node: process.version,
  os: os.type() + ' ' + os.release(),
};
console.log(`artefact ${meta.bytes} bytes sha256 ${meta.sha256}`);
fs.mkdirSync(TMP, { recursive: true });

let failed = 0;
for (const name of browsers) {
  const browser = await launch(name, { headless: !args.includes('--headed') });
  const out = { ...meta, date: new Date().toISOString(), browser: name, results: [] };
  if (!browser) {
    out.status = 'NOT MEASURED';
    out.reason = 'browser not installed on this machine';
    console.log(`\n${name}: NOT MEASURED (not installed)`);
  } else {
    out.version = browser.version;
    out.userAgent = browser.userAgent;
    out.mode = args.includes('--headed') ? 'headed' : 'headless (new)';
    console.log(`\n${name}: ${browser.version}`);
    const sink = await startSink();
    for (const test of cases) {
      const c = new Checks();
      const t0 = Date.now();
      let error = null;
      try { await test.run(c, { browser, sink }); } catch (e) { error = e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e); }
      const status = error ? 'ERROR' : c.failed.length ? 'FAIL' : 'PASS';
      if (status !== 'PASS') failed++;
      const open = c.items.filter((i) => i.notMeasured).length;
      out.results.push({ id: test.id, title: test.title, status, partsNotMeasured: open, ms: Date.now() - t0, error, checks: c.items });
      console.log(`${status.padEnd(5)} ${test.id}  ${test.title}  (${c.items.filter((i) => !i.note).length} checks${open ? ', ' + open + ' part(s) NOT MEASURED' : ''}, ${Date.now() - t0} ms)`);
      for (const item of c.items) {
        if (!item.pass) console.log(`        ✗ ${item.label}${item.detail ? '\n          ' + item.detail : ''}`);
        else if (item.note) console.log(`        · ${item.label}: ${item.detail}`);
      }
      if (error) console.log('        ! ' + error);
    }
    await sink.close();
    await browser.close();
    out.status = out.results.every((r) => r.status === 'PASS') ? 'PASS' : 'FAIL';
    out.summary = { pass: out.results.filter((r) => r.status === 'PASS').length, fail: out.results.filter((r) => r.status !== 'PASS').length,
      checks: out.results.reduce((n, r) => n + r.checks.filter((i) => !i.note).length, 0), partsNotMeasured: out.results.reduce((n, r) => n + r.partsNotMeasured, 0) };
    console.log(`${name}: ${out.summary.pass} passed, ${out.summary.fail} not passed, ${out.summary.checks} checks, ${out.summary.partsNotMeasured} part(s) NOT MEASURED`);
  }
  if (!only && !args.includes('--no-write')) fs.writeFileSync(path.join(ROOT, 'tests', 'results', `acceptance-${name}.json`), JSON.stringify(out, null, 1) + '\n');
}
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
