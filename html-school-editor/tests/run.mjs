// Acceptance run against the delivered single file.
//   node tests/run.mjs [--browser edge|chrome|firefox] [--only T-05,X-01] [--headed] [--no-write]
// Writes tests/results/acceptance-<browser>.json. A browser that is not installed is reported NOT MEASURED.
// Edge and Chrome are driven over the DevTools protocol (tests/lib/cdp.mjs), Firefox over WebDriver BiDi with
// the driver the reviewer wrote for the Firefox measurement of alpha.3 (tests/lib/firefox.mjs). Where a case
// needs automation that exists for one protocol only, the rest of the case is recorded as NOT MEASURED and the
// case counts as PARTIAL, never as passed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { launch } from './lib/cdp.mjs';
import { launchFirefox, UnsupportedAutomation } from './lib/firefox.mjs';
import { ROOT, ARTEFACT, TMP, Checks, startSink } from './lib/harness.mjs';
import { functional } from './browser/functional.mjs';
import { security } from './browser/security.mjs';
import { robustness } from './browser/robustness.mjs';
import { review } from './browser/review.mjs';
import { features } from './browser/features.mjs';
import { review3 } from './browser/review3.mjs';
import { features5 } from './browser/features5.mjs';
import { review6 } from './browser/review6.mjs';
import { review7 } from './browser/review7.mjs';
import { review8 } from './browser/review8.mjs';
import { review9 } from './browser/review9.mjs';
import { review10 } from './browser/review10.mjs';
import { review11 } from './browser/review11.mjs';
import { beta2 } from './browser/beta2.mjs';
import { beta3 } from './browser/beta3.mjs';
import { features7 } from './browser/features7.mjs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const only = opt('--only') ? opt('--only').split(',') : null;
const browsers = opt('--browser') ? [opt('--browser')] : ['edge', 'chrome', 'firefox'];
const cases = [...functional, ...security, ...robustness, ...review, ...features, ...review3, ...features5, ...review6, ...features7, ...review7, ...review8, ...review9, ...review10, ...review11, ...beta2, ...beta3].filter((t) => !only || only.includes(t.id));

const artefact = fs.readFileSync(ARTEFACT);
const meta = {
  artefact: 'dist/school-editor.html',
  bytes: artefact.length,
  sha256: crypto.createHash('sha256').update(artefact).digest('hex'),
  sizeLimit: 250000,
  node: process.version,
  os: os.type() + ' ' + os.release(),
};
console.log(`artefact ${meta.bytes} bytes sha256 ${meta.sha256}`);
fs.mkdirSync(TMP, { recursive: true });

let failed = 0;
for (const name of browsers) {
  const gecko = name === 'firefox';
  const browser = gecko ? await launchFirefox() : await launch(name, { headless: !args.includes('--headed') });
  const out = { ...meta, date: new Date().toISOString(), browser: name, results: [] };
  if (!browser) {
    out.status = 'NOT MEASURED';
    out.reason = 'browser not installed on this machine';
    console.log(`\n${name}: NOT MEASURED (not installed)`);
  } else {
    out.version = browser.version;
    out.userAgent = browser.userAgent;
    out.mode = gecko ? 'headless' : args.includes('--headed') ? 'headed' : 'headless (new)';
    if (gecko) out.driver = 'WebDriver BiDi';
    console.log(`\n${name}: ${browser.version}`);
    const sink = await startSink();
    for (const test of cases) {
      const c = new Checks();
      const t0 = Date.now();
      let error = null;
      // Tabs a case leaves open when it stops early are closed here (the Firefox driver has no per-case cleanup).
      const tabsBefore = gecko ? new Set((await browser.raw.send('browsingContext.getTree', { maxDepth: 0 })).contexts.map((x) => x.context)) : null;
      try {
        if (gecko && test.id === 'X-04') {
          // Firefox does not hand the data of a constructed paste event to the page; the case would measure the
          // test, not the product. Checked here, as in the reviewer's Firefox run.
          const probe = await browser.newPage();
          const seen = await probe.eval(`(() => { const d = new DataTransfer(); d.setData('text/plain', 'control'); return new ClipboardEvent('paste', { clipboardData: d }).clipboardData.getData('text/plain'); })()`);
          await probe.close();
          if (seen !== 'control') throw new UnsupportedAutomation('a constructed paste event carries no data in this browser; paste through the system clipboard is not automated');
        }
        await test.run(c, { browser, sink });
      } catch (e) {
        if (e instanceof UnsupportedAutomation) c.skip('the rest of this case', e.message);
        else error = e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : String(e);
      } finally {
        if (gecko) for (const tab of (await browser.raw.send('browsingContext.getTree', { maxDepth: 0 })).contexts) if (!tabsBefore.has(tab.context)) await browser.raw.send('browsingContext.close', { context: tab.context });
      }
      const stopped = c.items.some((i) => i.label === 'the rest of this case');
      const measured = c.items.filter((i) => !i.note).length;
      const status = error ? 'ERROR' : c.failed.length ? 'FAIL' : stopped ? (measured ? 'PARTIAL' : 'NOT MEASURED') : 'PASS';
      if (status === 'ERROR' || status === 'FAIL') failed++;
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
    const count = (status) => out.results.filter((r) => r.status === status).length;
    out.status = count('FAIL') + count('ERROR') ? 'FAIL' : count('PARTIAL') + count('NOT MEASURED') ? 'PARTIAL' : 'PASS';
    out.summary = { pass: count('PASS'), fail: count('FAIL') + count('ERROR'), partial: count('PARTIAL'), notMeasured: count('NOT MEASURED'),
      checks: out.results.reduce((n, r) => n + r.checks.filter((i) => !i.note).length, 0), partsNotMeasured: out.results.reduce((n, r) => n + r.partsNotMeasured, 0) };
    console.log(`${name}: ${out.summary.pass} passed, ${out.summary.fail} not passed, ${out.summary.partial} partial, ${out.summary.notMeasured} not measured, ${out.summary.checks} checks, ${out.summary.partsNotMeasured} part(s) NOT MEASURED`);
  }
  if (!only && !args.includes('--no-write')) fs.writeFileSync(path.join(ROOT, 'tests', 'results', `acceptance-${name}.json`), JSON.stringify(out, null, 1) + '\n');
}
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
