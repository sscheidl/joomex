// Regression cases RV-01 … RV-04 for the findings of the independent review of 0.1.0-alpha.1
// (docs/reviews/REVIEW_0.1.0-alpha.1.md). The reviewer's inputs are used unchanged; further inputs of the same
// kind are added. Expected values are written by hand. Rendering is compared in an ordinary browser page with
// measuring code of this file, not with the product's own layout check.
import { pathToFileURL } from 'node:url';
import { Editor, PV, sleep, tmpFile, startSink } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const docName = (ed) => ed.eval('document.getElementById("docName").textContent');
const undoOff = (ed) => ed.eval('document.getElementById("bUndo").disabled');
const noteText = (ed) => ed.eval('document.getElementById("inactive").hidden ? "" : document.getElementById("inactiveText").textContent');

// Timing seam only: the bytes, the file input, the buttons and the key events are real. Completion of
// File.arrayBuffer() is held for files named rv01-langsam* until the test releases it (oldest first).
const DELAYED_READ = `window.rvWaiting = 0; window.rvRelease = [];
  const originalRead = File.prototype.arrayBuffer;
  File.prototype.arrayBuffer = async function () {
    const bytes = await originalRead.call(this);
    if (this.name.startsWith('rv01-langsam')) { window.rvWaiting++; await new Promise((resolve) => { window.rvRelease.push(resolve); }); }
    return bytes;
  };`;
// Timing seam only: holds the completion of Promise.all (used once, inside the layout comparison of "tidy up").
const HELD_CHECK = `const all = Promise.all.bind(Promise);
  Promise.all = (list) => all(list).then(async (value) => { if (window.rvHold) { window.rvHeld = true; await new Promise((resolve) => { window.rvGo = resolve; }); } return value; });`;

// Box of every element and of every rendered piece of text, measured in an ordinary page with scripts off.
async function rendering(browser, name, html) {
  const page = await browser.newPage();
  try {
    await page.send('Emulation.setScriptExecutionDisabled', { value: true });
    await page.goto(pathToFileURL(tmpFile(name, html)).href);
    return await page.eval(`(() => { const out = [], range = document.createRange();
      const box = (r) => [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(' ');
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.nodeType === 1) { out.push(n.localName + ' ' + box(n.getBoundingClientRect())); continue; }
        range.selectNodeContents(n);
        const r = range.getBoundingClientRect();
        if (n.data.trim()) out.push(JSON.stringify(n.data.replace(/\\s+/g, ' ').trim()) + ' ' + box(r));
        else if (r.width > 0) out.push('space ' + box(r));
      }
      return out.join('\\n'); })()`);
  } finally { await page.close(); }
}

const FORMAT_REFUSED = [
  ['reviewer sample: white-space behind a CSS comment', '<!doctype html><p style="white-space:/**/pre">Alpha   Beta</p>', 'white-space'],
  ['reviewer sample: paragraphs displayed inline', '<!doctype html><style>p {display:inline}</style><p>Alpha</p><p>Beta</p>', 'Aussehen'],
  ['white-space written with a CSS escape', '<!doctype html><style>p { white-\\73 pace: pre }</style><p>Alpha   Beta</p>', 'white-space'],
  ['white-space through a custom property', '<!doctype html><p style="--w: pre; white-space: var(--w)">Alpha   Beta</p>', 'white-space'],
  ['white-space-collapse: preserve', '<!doctype html><style>p { white-space-collapse: preserve }</style><p>Alpha   Beta</p>', 'white-space'],
  ['white-space only under a condition', '<!doctype html><style>@media (max-width: 200px) { p { white-space: pre-wrap } }</style><p>Alpha   Beta</p>', 'white-space'],
  ['all: unset makes paragraphs inline', '<!doctype html><style>p { all: unset }</style><p>Alpha</p><p>Beta</p>', 'Aussehen'],
  ['list items as inline blocks on one line', '<!doctype html><style>li { display: inline-block }</style><ul><li>Alpha</li><li>Beta</li></ul>', 'Aussehen'],
  ['generated content in front of a leading space', '<!doctype html><style>p::before { content: "-" }</style><div><p> Alpha</p></div>', 'Aussehen'],
  ['external style sheet', '<!doctype html><link rel="stylesheet" href="stil.css"><div><p>Alpha</p><p>Beta</p></div>', 'externe CSS-Datei'],
  ['imported style sheet', '<!doctype html><style>@import "stil.css";</style><div><p>Alpha</p><p>Beta</p></div>', 'externe CSS-Datei'],
];
const FORMAT_APPLIED = [
  ['colours, nowrap and a flex container', '<!doctype html><style>h1 { color: navy; white-space: nowrap } .reihe { display: flex; gap: 8px } p { margin: 4px 0 }</style><h1>Titel</h1><div class="reihe"><p>Alpha <b>fett</b> Beta</p><p>Gamma</p></div><ul><li>Eins</li><li>Zwei</li></ul>'],
  ['inline-block items that already stand on separate lines', '<!doctype html>\n<style>li { display: inline-block }</style>\n<ul>\n      <li>Alpha</li>\n   <li>Beta</li>\n</ul>\n<div><p>Text</p></div>'],
  ['embedded image and a table', '<!doctype html><table><tr><td>A</td><td>B <img alt="Punkt" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="20" height="20"></td></tr></table><p>Ende</p>'],
];

export const review = [
  {
    id: 'RV-01', title: 'review finding: a file read that finishes late never replaces newer work unasked (S-06, T-15)',
    async run(c, { browser }) {
      const slow = () => tmpFile('rv01-langsam.html', '<p>DELAYED FILE</p>');
      const start = async (ed) => { await ed.openFile(slow(), { wait: false }); await ed.until('window.rvWaiting === 1', 'read is held'); };
      const typeInSource = async (ed) => { await ed.sourceCaret('mein Text.', 'mein Text.'.length); await ed.type(' KEEP-MY-WORK'); await ed.settle(); };
      const release = (ed) => ed.eval('window.rvRelease.shift()()');
      // reviewer schedule 1: New, then typing, while the read is pending
      await withEditor(browser, { noFsa: true, init: DELAYED_READ }, async (ed) => {
        await start(ed);
        await ed.click('bNew');
        await typeInSource(ed);
        const before = await ed.source();
        await release(ed);
        await ed.until('document.getElementById("msg").textContent.includes("nicht geöffnet")', 'stale read reported');
        c.eq(await ed.source(), before, 'New during a read: the late read does not replace the new page');
        c.ok(before.includes('KEEP-MY-WORK'), 'the typed text is the text that stayed');
        c.eq(await docName(ed), 'meine-seite.html', 'document name unchanged');
        c.eq(await undoOff(ed), false, 'undo history kept');
        c.ok((await ed.dirtyText()).includes('nicht gespeichert'), 'still shown as unsaved');
        c.eq(await ed.dialogOpen('dlgConfirm'), false, 'no question is needed: the read was cancelled by New');
      });
      // reviewer schedule 2: typing in the same document while the read is pending; the pupil declines.
      // Here the file is chosen through the Open button and the browser's file chooser.
      await withEditor(browser, { noFsa: true, init: DELAYED_READ }, async (ed) => {
        await ed.page.send('Page.setInterceptFileChooserDialog', { enabled: true });
        const chooser = ed.page.waitFor('Page.fileChooserOpened');
        await ed.click('bOpen');
        await ed.page.send('DOM.setFileInputFiles', { files: [slow()], backendNodeId: (await chooser).backendNodeId });
        await ed.until('window.rvWaiting === 1', 'read is held');
        await ed.page.send('Page.setInterceptFileChooserDialog', { enabled: false });
        await typeInSource(ed);
        const before = await ed.source();
        await release(ed);
        await ed.until('document.getElementById("dlgConfirm").open', 'question after late read');
        c.eq(await ed.source(), before, 'typing during a read: nothing is replaced before the pupil answers');
        const question = await ed.eval('document.getElementById("confirmText").textContent');
        c.ok(question.includes('rv01-langsam.html') && question.includes('gehen diese Änderungen verloren'), 'the question names the file and the consequence', question);
        await ed.dialogButton('dlgConfirm', 'Abbrechen');
        await sleep(80);
        c.eq(await ed.source(), before, 'declined: the typed text stays');
        c.eq(await docName(ed), 'meine-seite.html', 'declined: document name unchanged');
        c.eq(await undoOff(ed), false, 'declined: undo history kept');
        c.ok((await ed.status()).includes('nicht geöffnet'), 'declined: the pupil is told that the file was not opened', await ed.status());
      });
      // typing in the page pane (still uncommitted when the read finishes); the pupil accepts
      await withEditor(browser, { noFsa: true, init: DELAYED_READ }, async (ed) => {
        await start(ed);
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.type(' SEITE');
        await release(ed);
        await ed.until('document.getElementById("dlgConfirm").open', 'question after late read (page pane)');
        c.ok((await ed.source()).includes('mein Text. SEITE</p>'), 'typing in the page during a read: it is committed to the source before the question');
        await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
        await ed.until('document.getElementById("docName").textContent === "rv01-langsam.html"', 'opened after consent');
        c.eq(await ed.source(), '<p>DELAYED FILE</p>', 'accepted: the file is opened');
        c.eq(await ed.dirtyText(), 'gespeichert', 'accepted: the opened file counts as saved');
      });
      // an edit that is taken back leaves nothing to lose: no question
      await withEditor(browser, { noFsa: true, init: DELAYED_READ }, async (ed) => {
        await start(ed);
        await ed.sourceCaret('mein Text.', 'mein Text.'.length);
        await ed.type('!');
        await ed.settle();
        await ed.click('bUndo');
        await ed.settle();
        await release(ed);
        await ed.until('document.getElementById("docName").textContent === "rv01-langsam.html"', 'opened without question');
        c.eq(await ed.source(), '<p>DELAYED FILE</p>', 'edit taken back during the read: the file opens without a question');
      });
      // two reads: only the one started last may complete, in either order of completion
      await withEditor(browser, { noFsa: true, init: DELAYED_READ }, async (ed) => {
        await start(ed);
        await ed.openFile(tmpFile('rv01-langsam-2.html', '<p>SECOND FILE</p>'), { wait: false });
        await ed.until('window.rvWaiting === 2', 'second read is held');
        await release(ed);
        await ed.until('document.getElementById("msg").textContent.includes("nicht geöffnet")', 'older read reported');
        c.eq(await docName(ed), 'meine-seite.html', 'older of two reads finishes first: it does not open');
        await release(ed);
        await ed.until('document.getElementById("docName").textContent === "rv01-langsam-2.html"', 'newer read opened');
        c.eq(await ed.source(), '<p>SECOND FILE</p>', 'the read started last opens');
      });
      await withEditor(browser, { noFsa: true, init: DELAYED_READ }, async (ed) => {
        await start(ed);
        await ed.openFile(tmpFile('rv01-langsam-2.html', '<p>SECOND FILE</p>'), { wait: false });
        await ed.until('window.rvWaiting === 2', 'second read is held');
        await ed.eval('window.rvRelease.pop()()');
        await ed.until('document.getElementById("docName").textContent === "rv01-langsam-2.html"', 'newer read opened first');
        await release(ed);
        await sleep(250);
        c.eq(await ed.source(), '<p>SECOND FILE</p>', 'older of two reads finishes last: it does not replace the newer file');
      });
      c.note('timing', 'completion of File.arrayBuffer() is held by the test; bytes, file input, buttons and keys are real');
      c.skip('the same schedules with the native file picker (showOpenFilePicker, getFile)', 'cannot be driven by this harness; the picker path shares the ticket logic exercised here');
    },
  },
  {
    id: 'RV-02', title: 'review finding: "tidy up" never changes how the page looks (S-05, T-07)',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        let n = 0;
        for (const [label, source, word] of FORMAT_REFUSED) {
          await ed.openText('rv02-nein-' + ++n + '.html', source);
          const result = await ed.format();
          c.eq(result.outcome, 'refused', label + ': not formatted');
          c.ok(result.text.includes(word) && result.text.includes('bleibt unverändert'), label + ': the reason is given', result.text);
          c.eq(await ed.source(), source, label + ': source unchanged');
        }
        for (const [label, source] of FORMAT_APPLIED) {
          await ed.openText('rv02-ja-' + ++n + '.html', source);
          const result = await ed.format();
          c.eq(result.outcome, 'applied', label + ': formatted');
          const saved = (await ed.download()).text;
          c.ok(saved !== source && saved.replace(/\s+/g, '') === source.replace(/\s+/g, ''), label + ': white space changed, nothing else', saved);
          c.eq(await rendering(browser, 'rv02-nachher-' + n + '.html', saved), await rendering(browser, 'rv02-vorher-' + n + '.html', source), label + ': every box and text is rendered at the same place as before (ordinary page)');
        }
      });
      // the layout check takes a moment; text typed meanwhile must not be overwritten by its result
      await withEditor(browser, { init: HELD_CHECK }, async (ed) => {
        const source = '<!doctype html><div><p>Alpha</p><p>Beta</p></div>';
        await ed.openText('rv02-spaet.html', source);
        await ed.eval('window.rvHold = true');
        await ed.click('bFormat');
        await ed.until('window.rvHeld', 'layout check is held');
        await ed.sourceCaret('Beta', 4);
        await ed.type(' SPÄTER');
        await ed.settle();
        await ed.eval('window.rvHold = false; window.rvGo()');
        await ed.until('document.getElementById("msg").textContent.includes("abgebrochen")', 'outdated formatting reported');
        c.eq(await ed.source(), source.replace('Beta', 'Beta SPÄTER'), 'typing while the check runs: the text stays exactly as typed, the outdated result is dropped');
      });
    },
  },
  {
    id: 'RV-03', title: 'review finding: list commands keep attributes (S-05, T-05)',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const source = '<!doctype html><p id="anchor" class="special" title="Keep me">Alpha</p><p>Beta</p>';
        await ed.openText('rv03.html', source);
        await ed.caret('Alpha', 2);
        await ed.click('bUl');
        await ed.settle();
        c.eq((await ed.download()).text, '<!doctype html>\n<ul>\n  <li id="anchor" class="special" title="Keep me">Alpha</li>\n</ul><p>Beta</p>', 'reviewer sample: the list item carries the attributes of the paragraph');
        await ed.caret('Alpha', 2);
        await ed.click('bUl');
        await ed.settle();
        c.eq(await ed.source(), '<!doctype html>\n<p id="anchor" class="special" title="Keep me">Alpha</p><p>Beta</p>', 'and back: the paragraph carries them again');

        const spelled = '<!doctype html>\n<P CLASS=\'a b\' data-x = "1" onclick="los()" style="color: red">Alpha &amp; Beta</P>\n<h2 lang=en>Gamma</h2>\n';
        await ed.openText('rv03-schreibweise.html', spelled);
        await ed.selectNodes('d.querySelector("p").firstChild', 'd.querySelector("h2").firstChild');
        await ed.click('bOl');
        await ed.settle();
        c.eq(await ed.source(), '<!doctype html>\n<ol>\n  <li CLASS=\'a b\' data-x = "1" onclick="los()" style="color: red">Alpha &amp; Beta</li>\n  <li lang=en>Gamma</li>\n</ol>\n', 'attributes keep their spelling, including one the editor does not show (onclick) and the style');

        const list = '<!doctype html>\n<ul class="menu" id="nav" style="color: green">\n  <li class="a">Eins</li>\n  <li>Zwei</li>\n  <li data-n="3">Drei</li>\n</ul>\n';
        await ed.openText('rv03-liste.html', list);
        await ed.selectNodes('d.querySelectorAll("li")[0].firstChild', 'd.querySelectorAll("li")[2].firstChild');
        await ed.click('bUl');
        await ed.settle();
        c.eq(await ed.source(), '<!doctype html>\n<div class="menu" id="nav" style="color: green">\n  <p class="a">Eins</p>\n  <p>Zwei</p>\n  <p data-n="3">Drei</p>\n</div>\n', 'a whole list with attributes becomes a block that keeps them; items become paragraphs with their attributes');
        await ed.click('bUndo');
        await ed.settle();
        c.eq(await ed.source(), list, 'undo restores the list');
        await ed.caret('Zwei', 2);
        await ed.click('bUl');
        await ed.settle();
        const split = await ed.source();
        const facts = JSON.parse(await ed.eval(`((doc) => JSON.stringify({ shape: Array.from(doc.body.children).map((el) => el.localName + '.' + el.className + (el.id ? '#' + el.id : '') + '[' + el.getAttribute('style') + ']'),
          items: Array.from(doc.querySelectorAll('li')).map((li) => li.parentNode.localName + '>' + li.textContent + ':' + (li.className || li.dataset.n || '')), ids: doc.querySelectorAll('#nav').length }))(new DOMParser().parseFromString(document.getElementById("src").value, "text/html"))`));
        c.eq(facts.shape.join(' '), 'ul.menu#nav[color: green] p.[null] ul.menu[color: green]', 'one item taken out of the middle: both remaining lists keep class and style', split);
        c.eq(facts.items.join(' '), 'ul>Eins:a ul>Drei:3', 'the other items keep their attributes');
        c.eq(facts.ids, 1, 'the id exists once');

        await ed.click('bUndo');
        await ed.settle();
        await ed.caret('Eins', 2);
        await ed.click('bUl');
        await ed.settle();
        c.eq(await ed.source(), '<!doctype html>\n<p class="a">Eins</p>\n<ul class="menu" id="nav" style="color: green">\n  <li>Zwei</li>\n  <li data-n="3">Drei</li>\n</ul>\n', 'first item taken out: the list element itself, with its id, continues behind the paragraph');

        const nested = '<!doctype html>\n<ul>\n  <li title="Hinweis"><p>Absatz</p></li>\n</ul>\n';
        await ed.openText('rv03-block.html', nested);
        await ed.caret('Absatz', 2);
        await ed.click('bUl');
        await ed.settle();
        c.ok((await ed.source()).includes('<div title="Hinweis"><p>Absatz</p></div>') && !(await ed.source()).includes('<li'), 'an item that holds a paragraph and has attributes becomes a block with these attributes', await ed.source());
      });
    },
  },
  {
    id: 'RV-04', title: 'review finding: whatever is switched off in the page pane is announced (S-04, X-03)',
    async run(c, { browser }) {
      const sink = await startSink();
      try {
        const o = sink.origin;
        const samples = [
          ['reviewer sample: SVG animation that assigns an image address', '<!doctype html><p>Passive sample</p><svg width="20" height="20"><image id="pic" width="20" height="20"><set attributeName="href" to="' + o + '/rv04/svg-set.png" begin="0s" dur="indefinite"/></image></svg>', 'Animation'],
          ['SVG animate element', '<!doctype html><p>Text</p><svg width="20" height="20"><image width="20" height="20"><animate attributeName="href" values="' + o + '/rv04/svg-animate.png" dur="1s" repeatCount="indefinite"/></image></svg>', 'Animation'],
          ['style element inside SVG', '<!doctype html><p>Text</p><svg width="20" height="20"><style>rect { fill: url(' + o + '/rv04/svg-style.svg#a) }</style><rect width="20" height="20"/></svg>', 'CSS'],
          ['SVG presentation attribute with an address', '<!doctype html><p>Text</p><svg width="20" height="20"><rect width="20" height="20" filter="url(' + o + '/rv04/svg-filter.svg#f)"/></svg>', 'CSS'],
          ['image-set() without url()', '<!doctype html><p style="background-image: image-set(&quot;' + o + '/rv04/image-set.png&quot; 1x)">Text</p>', 'CSS'],
          ['url() written with a CSS escape (found by the browser policy only)', '<!doctype html><p style="background: u\\72 l(' + o + '/rv04/escaped.png)">Text</p>', 'außerhalb'],
        ];
        await withEditor(browser, {}, async (ed) => {
          let n = 0;
          for (const [label, source, word] of samples) {
            const before = sink.hits.length;
            await ed.openText('rv04-' + ++n + '.html', source);
            await sleep(700);
            c.eq(sink.hits.slice(before).join(','), '', label + ': nothing reaches the local counter');
            c.ok((await noteText(ed)).includes(word), label + ': the note above the page says so', await noteText(ed) || '(no note)');
            c.eq(await ed.source(), source, label + ': source unchanged');
          }
          const blocked = ed.page.eventsOf('Audits.issueAdded').map((e) => e.issue.details.contentSecurityPolicyIssueDetails).filter((d) => d && String(d.blockedURL || '').startsWith(o)).map((d) => d.blockedURL.slice(o.length));
          c.ok(blocked.some((u) => u.includes('escaped.png')), 'control: the escaped address really was attempted and stopped by the policy', JSON.stringify(Array.from(new Set(blocked))));
          c.ok(!blocked.some((u) => u.includes('svg-set') || u.includes('svg-animate')), 'the animated addresses are no longer attempted at all', JSON.stringify(Array.from(new Set(blocked))));
          c.eq(await ed.eval(PV + '.querySelectorAll("set, animate, animateMotion, animateTransform").length'), 0, 'the page pane holds no animation element');
          // the last sample is still open: taking the address out of the code takes the note away
          await ed.eval('(() => { const t = document.getElementById("src"); t.focus(); const i = t.value.indexOf(" style="), j = t.value.indexOf(">Text"); t.setSelectionRange(i, j); })()');
          await ed.key('Delete');
          await ed.settle();
          c.eq(await ed.source(), '<!doctype html><p>Text</p>', 'the style attribute was deleted in the source (real key)');
          c.eq(await noteText(ed), '', 'the note disappears when the address is no longer in the code');
          await ed.openText('rv04-neu.html', samples[5][1]);
          await sleep(500);
          c.ok((await noteText(ed)).includes('außerhalb'), 'opening the sample again shows the note again', await noteText(ed) || '(no note)');
          await ed.click('bNew');
          await ed.settle();
          c.eq(await noteText(ed), '', 'a new page shows no note');
        });
      } finally { await sink.close(); }
    },
  },
];
