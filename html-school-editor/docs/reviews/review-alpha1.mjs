// Independent review probes. Run from html-school-editor: node docs/reviews/review-alpha1.mjs
// Product expectations are reported separately from whether a defect was reproduced.
// Exit 1 means an unmet product expectation. Run separately from the acceptance suite (shared temp folder).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { launch } from '../../tests/lib/cdp.mjs';
import { Editor, PV, ROOT, ARTEFACT, tmpFile as sharedTmpFile, sleep, startSink } from '../../tests/lib/harness.mjs';

const probeFiles = new Set();
const tmpFile = (name, content) => { const file = sharedTmpFile(name, content); probeFiles.add(file); return file; };

const browser = await launch('edge');
if (!browser) throw new Error('Edge unavailable');
const artefact = fs.readFileSync(ARTEFACT);
const out = { date: new Date().toISOString(), browser: browser.version, mode: 'headless',
  node: process.version, os: os.type() + ' ' + os.release(),
  bytes: artefact.length, sha256: crypto.createHash('sha256').update(artefact).digest('hex'), probes: [] };
const record = (id, data) => { out.probes.push({ id, ...data }); console.log(JSON.stringify({ id, ...data })); };
async function use(options, fn) { const ed = await Editor.open(browser, options); try { await fn(ed); } finally { await ed.close(); } }
const delayedRead = `const originalRead = File.prototype.arrayBuffer;
  File.prototype.arrayBuffer = async function () {
    const bytes = await originalRead.call(this);
    if (this.name.startsWith('review-delayed')) {
      window.reviewReadWaiting = true;
      await new Promise(resolve => { window.reviewReleaseRead = resolve; });
    }
    return bytes;
  };`;
try {
  // Timing seam only: real file bytes and file-input path, real New button and key events.
  for (const newDocument of [true, false]) await use({ noFsa: true, init: delayedRead }, async ed => {
    await ed.openFile(tmpFile('review-delayed.html', '<p>DELAYED FILE</p>'), { wait: false });
    await ed.until('window.reviewReadWaiting', 'read paused');
    if (newDocument) await ed.click('bNew');
    await ed.sourceCaret('mein Text.', 'mein Text.'.length);
    await ed.type(' KEEP-MY-WORK');
    await ed.settle();
    const before = await ed.source();
    await ed.eval('window.reviewReleaseRead()');
    await ed.until('document.getElementById("docName").textContent === "review-delayed.html"', 'read completed');
    const after = await ed.source();
    const undoDisabled = await ed.eval('document.getElementById("bUndo").disabled');
    record(newDocument ? 'RV-01-new-during-read' : 'RV-01-edit-during-read', {
      expectation: 'Pending file read must not silently discard newer work',
      timing: 'File.arrayBuffer completion held by test; native picker not exercised',
      productPass: after.includes('KEEP-MY-WORK'), before, after, undoDisabled,
      dirty: await ed.dirtyText(), confirmationOpen: await ed.dialogOpen('dlgConfirm') });
  });
  const formats = [
    ['RV-02-inline-block', '<!doctype html><style>p {display:inline}</style><p>Alpha</p><p>Beta</p>'],
    ['RV-02-css-pre', '<!doctype html><p style="white-space:/**/pre">Alpha   Beta</p>'],
  ];
  for (const [id, source] of formats) await use({}, async ed => {
    await ed.openText(id + '.html', source);
    const renderedText = async (name, html) => {
      const page = await browser.newPage();
      try {
        await page.goto(pathToFileURL(tmpFile(name, html)).href);
        return await page.eval(`(() => {
          const paragraphs = document.querySelectorAll('p');
          let gap = null;
          if (paragraphs.length === 2) {
            const a = document.createRange(), b = document.createRange();
            a.setStart(paragraphs[0].firstChild, 4); a.setEnd(paragraphs[0].firstChild, 5);
            b.setStart(paragraphs[1].firstChild, 0); b.setEnd(paragraphs[1].firstChild, 1);
            gap = b.getBoundingClientRect().left - a.getBoundingClientRect().right;
          }
          return { text: document.body.innerText, gap };
        })()`);
      }
      finally { await page.close(); }
    };
    const before = await renderedText(id + '-before.html', source);
    await ed.click('bFormat');
    await sleep(150);
    const refused = await ed.dialogOpen('dlgInfo');
    if (refused) await ed.dialogButton('dlgInfo', 'OK');
    await ed.settle();
    const saved = await ed.download();
    const after = await renderedText(id + '-after.html', saved.text);
    record(id, { expectation: 'Formatting preserves visible text with document CSS applied',
      productPass: id === 'RV-02-inline-block' ? Math.abs(before.gap - after.gap) < 0.1 : before.text === after.text,
      before, after, refused, source, saved: saved.text });
  });
  await use({}, async ed => {
    const source = '<!doctype html><p id="anchor" class="special" title="Keep me">Alpha</p><p>Beta</p>';
    await ed.openText('review-list.html', source);
    await ed.caret('Alpha', 2);
    await ed.click('bUl');
    await ed.settle();
    const saved = await ed.download();
    record('RV-03-list-attributes', { expectation: 'List conversion preserves existing attributes',
      productPass: saved.text.includes('id="anchor"') && saved.text.includes('class="special"') && saved.text.includes('title="Keep me"'), source, saved: saved.text });
  });
  // Additional passive-document probe: SVG animation may mutate filtered resource attributes;
  // the delivered CSP must still stop a request. Only the controlled local counter is used.
  const sink = await startSink();
  try { await use({}, async ed => {
    const source = '<!doctype html><p>Passive sample</p><svg width="20" height="20"><image id="pic" width="20" height="20"><set attributeName="href" to="' + sink.origin + '/review-svg-image.png" begin="0s" dur="indefinite"/></image></svg>';
    await ed.openText('review-svg.html', source);
    await sleep(700);
    const attempts = ed.page.eventsOf('Network.requestWillBeSent').map(e => e.request.url).filter(u => u.startsWith(sink.origin));
    const blocks = ed.page.eventsOf('Audits.issueAdded').filter(e => String(e.issue.details.contentSecurityPolicyIssueDetails?.blockedURL || '').startsWith(sink.origin));
    record('RV-C-svg-animation', { expectation: 'No animated resource reaches the local counter', productPass: sink.hits.length === 0,
      hits: sink.hits, attemptedPaths: attempts.map(u => u.slice(sink.origin.length)), cspBlocks: blocks.length,
      sourceUnchanged: await ed.source() === source,
      inactiveHidden: await ed.eval('document.getElementById("inactive").hidden') });
    record('RV-04-inactive-notice', { expectation: 'A blocked document resource is announced to the pupil',
      productPass: !(await ed.eval('document.getElementById("inactive").hidden')),
      inactiveText: await ed.eval('document.getElementById("inactiveText").textContent'),
      sourceUnchanged: await ed.source() === source });
  }); } finally { await sink.close(); }
} finally {
  await browser.close();
  const result = path.join(ROOT, 'tests/results/review-alpha1-edge.json');
  fs.mkdirSync(path.dirname(result), { recursive: true });
  fs.writeFileSync(result, JSON.stringify(out, null, 2) + '\n');
  for (const file of probeFiles) fs.rmSync(file, { force: true });
}
process.exitCode = out.probes.some(probe => !probe.productPass) ? 1 : 0;
