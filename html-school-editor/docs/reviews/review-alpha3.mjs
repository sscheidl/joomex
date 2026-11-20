// Independent alpha.2/alpha.3 review probes. Run sequentially after tests/run.mjs.
// node docs/reviews/review-alpha3.mjs
// Exit 1 reports unmet product expectations; alpha.1 review evidence is never overwritten.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { launch } from '../../tests/lib/cdp.mjs';
import { Editor, PV, ROOT, ARTEFACT, tmpFile as sharedTmpFile, sleep, makePng, startSink } from '../../tests/lib/harness.mjs';
import { tokenize } from '../../src/js/tokenizer.js';
import { patchAttrs } from '../../src/js/util.js';

const madeFiles = new Set();
const tmpFile = (name, data) => { const p = sharedTmpFile(name, data); madeFiles.add(p); return p; };
const data = fs.readFileSync(ARTEFACT);
const out = { date: new Date().toISOString(), reviewedCommit: 'c3d3770', node: process.version,
  os: os.type() + ' ' + os.release(), bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex'), probes: [] };
const record = (id, expectation, pass, details) => {
  const item = { id, expectation, productPass: !!pass, ...details };
  out.probes.push(item); console.log(JSON.stringify(item));
};
const browser = await launch('edge');
if (!browser) throw new Error('Edge unavailable');
out.browser = browser.version; out.mode = 'headless';
async function use(options, fn) {
  const ed = await Editor.open(browser, options);
  // Track fixture setup too, so this standalone runner removes only the files it created.
  ed.openText = async (name, text) => { const file = tmpFile(name, text); await ed.openFile(file); return file; };
  try { await fn(ed); } finally { await ed.close(); }
}
const pageDoc = body => '<!doctype html><html><head><meta charset="utf-8"><title>Review sample</title></head><body>' + body + '</body></html>';
const imageDialog = async ed => { await ed.clickPv('d.querySelector("img")'); await ed.click('bImage'); };
try {
  // Valid author CSS must not be rewritten inside a quoted custom-property value.
  await use({}, async ed => {
    const style = '--label:"A;text-align: left;B"; color:red';
    const source = pageDoc('<style>p::before{content:var(--label)}</style><p style=\'' + style + '\'>Alpha</p>');
    await ed.openText('a3r-css-string.html', source);
    const content = () => ed.eval(`((d) => d.defaultView.getComputedStyle(d.querySelector('p'), '::before').content)(${PV})`);
    const before = await content();
    await ed.caret('Alpha', 2); await ed.click('bAlignCenter'); await ed.settle();
    const saved = await ed.download();
    const after = await content();
    record('A3-01-css-string', 'Alignment preserves other CSS declarations and their string values',
      before === after && saved.text === source.replace(style, style + '; text-align: center'),
      { source, before, after, saved: saved.text });
  });
  // A previously ignored duplicate must not become effective when an attribute is removed.
  await use({}, async ed => {
    const source = pageDoc('<p>Image <img src="a.png" alt="x" width="80" WIDTH="160" height="40" HEIGHT="90"></p>');
    await ed.openText('a3r-duplicate.html', source);
    await imageDialog(ed); await ed.field('imgWidth', ''); await ed.dialogButton('dlgImage', 'Übernehmen'); await ed.settle();
    const saved = await ed.download();
    const attrs = await ed.eval(`((html) => { const el = new DOMParser().parseFromString(html, 'text/html').querySelector('img');
      return { width: el.getAttribute('width'), height: el.getAttribute('height') }; })(${JSON.stringify(saved.text)})`);
    record('A3-02-duplicate-removal', 'Removing image width/height leaves neither effective attribute',
      attrs.width === null && attrs.height === null, { source, saved: saved.text, effectiveAttributes: attrs });
  });
  await use({}, async ed => {
    const source = pageDoc('<p>Image <img src="a.png" alt= ></p>');
    await ed.openText('a3r-empty-value.html', source);
    await imageDialog(ed); await ed.field('imgAlt', 'Changed'); await ed.dialogButton('dlgImage', 'Übernehmen'); await ed.settle();
    const saved = await ed.download();
    const attributes = await ed.eval(`Array.from(new DOMParser().parseFromString(${JSON.stringify(saved.text)}, 'text/html').querySelector('img').attributes, a => [a.name, a.value])`);
    record('A3-02-empty-value', 'Changing an explicitly empty attribute value introduces no extra attribute',
      saved.text === source.replace('alt= ', 'alt="Changed" '), { source, saved: saved.text, attributes });
  });
  // Confirm the tokenizer/patcher mechanism directly, independently of the dialog path.
  for (const [source, changes, expected] of [
    ['<img alt= >', { alt: 'Changed' }, '<img alt="Changed" >'],
    ['<img width=80 WIDTH=160>', { width: null }, '<img>'],
  ]) {
    const t = tokenize(source)[0];
    const actual = source.slice(0, t.nameEnd) + patchAttrs(source, t.nameEnd, t.end, t.attrs, changes);
    record(source.includes('alt=') ? 'A3-02-helper-empty-value' : 'A3-02-helper-duplicate',
      'Single-attribute edit has its intended effective meaning', actual === expected, { source, changes, expected, actual });
  }
  // The editor-width comparison cannot establish rendering at another ordinary desktop width.
  await use({}, async ed => {
    const source = pageDoc('<style>@media(min-width:1500px){p{display:inline}}</style><p>Alpha</p><p>Beta</p>');
    await ed.openText('a3r-media.html', source);
    const previewWidth = await ed.eval('document.getElementById("pv").clientWidth');
    const result = await ed.format();
    const saved = await ed.download();
    const ordinary = async (name, html, width) => {
      const page = await browser.newPage();
      try {
        await page.send('Emulation.setScriptExecutionDisabled', { value: true });
        await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        await page.goto(pathToFileURL(tmpFile(name, html)).href);
        return await page.eval(`(() => { const ps = document.querySelectorAll('p'), a = document.createRange(), b = document.createRange();
          a.setStart(ps[0].firstChild, 4); a.setEnd(ps[0].firstChild, 5);
          b.setStart(ps[1].firstChild, 0); b.setEnd(ps[1].firstChild, 1);
          return { gap: b.getBoundingClientRect().left - a.getBoundingClientRect().right,
            display: getComputedStyle(ps[0]).display, width: innerWidth }; })()`);
      } finally { await page.close(); }
    };
    const before = await ordinary('a3r-media-before.html', source, 1800);
    const after = await ordinary('a3r-media-after.html', saved.text, 1800);
    record('A3-03-other-width', 'Formatting preserves rendered word spacing at another desktop width',
      Math.abs(before.gap - after.gap) < 0.1, { source, saved: saved.text, outcome: result, previewWidth, before, after });
  });
  // Inspect the second document-content frame while the asynchronous format check is held.
  const heldLayout = `const originalAll = Promise.all.bind(Promise);
    Promise.all = list => originalAll(list).then(async value => {
      if (window.reviewHoldLayout) {
        window.reviewLayoutHeld = true;
        await new Promise(resolve => { window.reviewReleaseLayout = resolve; });
      }
      return value;
    });`;
  await use({ init: heldLayout }, async ed => {
    const source = pageDoc('<div><p>Alpha</p><p>Beta</p></div><script>parent.document.documentElement.dataset.reviewRan="yes";</script>');
    await ed.openText('a3r-hidden-frame.html', source); await ed.caret('Alpha', 2);
    const activeBefore = await ed.eval('document.activeElement.id');
    await ed.eval('window.reviewHoldLayout = true'); await ed.click('bFormat');
    await ed.until('window.reviewLayoutHeld', 'layout frame held');
    const facts = await ed.eval(`(() => { const frame = document.querySelector('iframe.probe');
      return { sandbox: frame.getAttribute('sandbox'), url: frame.contentDocument.URL,
        policy: frame.contentDocument.querySelector('meta[http-equiv="Content-Security-Policy"]').content,
        visibility: getComputedStyle(frame).visibility, active: document.activeElement.id,
        scripts: frame.contentDocument.querySelectorAll('script').length,
        marker: document.documentElement.dataset.reviewRan || '' }; })()`);
    await ed.eval('window.reviewHoldLayout = false; window.reviewReleaseLayout()');
    await ed.until('!document.querySelector("iframe.probe")', 'layout frame removed');
    record('A3-C-layout-frame', 'The temporary format frame remains passive, hidden and unfocused and is removed',
      facts.sandbox === 'allow-same-origin' && facts.url === 'about:srcdoc' && facts.scripts === 0 && facts.marker === '' &&
      facts.policy === "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:" &&
      facts.visibility === 'hidden' && facts.active === activeBefore,
      { activeBefore, facts, removed: await ed.eval('!document.querySelector("iframe.probe")') });
  });
  // Completion from a cancelled image dialog must not change a later dialog's chosen file.
  const delayedImage = `const originalBitmap = window.createImageBitmap;
    window.createImageBitmap = async (...args) => {
      const bitmap = await originalBitmap.apply(window, args);
      if (args[0].name === 'a3r-slow.png') {
        window.reviewImageHeld = true;
        await new Promise(resolve => { window.reviewImageRelease = resolve; });
      }
      return bitmap;
    };`;
  await use({ init: delayedImage }, async ed => {
    const slow = tmpFile('a3r-slow.png', makePng(20, 10, false));
    const fast = tmpFile('a3r-fast.png', makePng(30, 15, false));
    await ed.caret('mein Text.', 'mein Text.'.length); await ed.click('bImage');
    await ed.page.setFiles('#imgIn', [slow]);
    await ed.until('window.reviewImageHeld', 'old image decode held');
    await ed.dialogButton('dlgImage', 'Abbrechen');
    const afterCancel = await ed.source();
    await ed.click('bImage'); await ed.pickImage(fast);
    const latestName = await ed.eval('document.getElementById("imgName").textContent');
    await ed.eval('window.reviewImageRelease()');
    await ed.until('document.getElementById("imgName").textContent.includes("a3r-slow.png")', 'old image result arrives');
    const completedName = await ed.eval('document.getElementById("imgName").textContent');
    await ed.dialogButton('dlgImage', 'Einfügen'); await ed.settle();
    const saved = await ed.download();
    record('A3-04-cancelled-image', 'An earlier cancelled image selection cannot replace the later chosen file',
      saved.text.includes('src="a3r-fast.png"') && !saved.text.includes('a3r-slow.png'),
      { timing: 'createImageBitmap completion held after decoding a real selected file; file inputs and buttons are real',
        afterCancel, latestName, completedName, saved: saved.text });
  });
  const sink = await startSink();
  try { await use({}, async ed => {
    const source = pageDoc('<p style="background:u\\72 l(' + sink.origin + '/a)">Passive</p>');
    await ed.openText('a3r-short-resource.html', source); await sleep(800);
    const attempts = ed.page.eventsOf('Network.requestWillBeSent').map(e => e.request.url).filter(u => u.startsWith(sink.origin));
    const issues = ed.page.eventsOf('Audits.issueAdded').filter(e => String(e.issue.details.contentSecurityPolicyIssueDetails?.blockedURL || '').startsWith(sink.origin));
    const note = await ed.inactiveNote();
    record('A3-05-inactive-notice', 'A blocked resource with a short path is announced', !!note,
      { fixture: 'escaped CSS url() to controlled local counter, path /a', sourceUnchanged: await ed.source() === source,
        attempts: attempts.map(u => u.slice(sink.origin.length)), cspIssues: issues.length, hits: sink.hits, note });
    record('A3-C-resource-containment', 'The additional resource probe delivers no request', sink.hits.length === 0,
      { hits: sink.hits });
  }); } finally { await sink.close(); }
  // Separate test-harness expectation: a matching file name is not proof that a read finished.
  const heldRead = `const originalRead = File.prototype.arrayBuffer;
    File.prototype.arrayBuffer = async function () {
      const bytes = await originalRead.call(this);
      if (window.reviewHoldRead && this.name === 'a3r-same.html') {
        window.reviewReadHeld = true;
        await new Promise(resolve => { window.reviewReleaseRead = resolve; });
      }
      return bytes;
    };`;
  await use({ init: heldRead }, async ed => {
    await ed.openText('a3r-same.html', '<p>OLD BYTES</p>');
    await ed.eval('window.reviewHoldRead = true');
    await ed.openFile(tmpFile('a3r-same.html', '<p>NEW BYTES</p>'));
    await ed.until('window.reviewReadHeld', 'second read held');
    const sourceWhenHelperReturned = await ed.source();
    await ed.eval('window.reviewHoldRead = false; window.reviewReleaseRead()');
    await ed.until('document.getElementById("src").value === "<p>NEW BYTES</p>"', 'actual second load');
    const item = { id: 'A3-T-same-name', scope: 'test-harness',
      expectation: 'Editor.openFile waits for the chosen file even when its basename is unchanged',
      testPass: sourceWhenHelperReturned === '<p>NEW BYTES</p>', sourceWhenHelperReturned,
      sourceAfterRelease: await ed.source(), timing: 'File.arrayBuffer completion held for second read; real bytes and file input' };
    out.probes.push(item); console.log(JSON.stringify(item));
  });
} finally {
  await browser.close();
  for (const file of madeFiles) fs.rmSync(file, { force: true });
  fs.writeFileSync(path.join(ROOT, 'tests/results/review-alpha3-edge.json'), JSON.stringify(out, null, 2) + '\n');
}
process.exitCode = out.probes.some(p => p.productPass === false || p.testPass === false) ? 1 : 0;
