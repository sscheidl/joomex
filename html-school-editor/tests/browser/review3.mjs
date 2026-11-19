// Regression cases A3-01 … A3-05 and A3-T for the findings of the independent review of 0.1.0-alpha.2 and
// 0.1.0-alpha.3 (docs/reviews/REVIEW_0.1.0-alpha.3.md). The reviewer's inputs are used unchanged; further
// inputs of the same kind are added. Expected values are written by hand.
import { pathToFileURL } from 'node:url';
import { Editor, PV, sleep, tmpFile, makePng, startSink, editorFolder } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const pageDoc = (body) => '<!doctype html><html><head><meta charset="utf-8"><title>Review sample</title></head><body>' + body + '</body></html>';
const imgName = (ed) => ed.eval('document.getElementById("imgName").textContent');

// Gap between the last letter of the first and the first letter of the second paragraph, and the box of every
// paragraph, in an ordinary page of the given width with scripts off.
async function ordinary(browser, name, html, width) {
  const page = await browser.newPage();
  try {
    await page.send('Emulation.setScriptExecutionDisabled', { value: true });
    await page.send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await page.goto(pathToFileURL(tmpFile(name, html)).href);
    return await page.eval(`(() => { const ps = document.querySelectorAll('p'), a = document.createRange(), b = document.createRange();
      a.setStart(ps[0].firstChild, ps[0].firstChild.data.length - 1); a.setEnd(ps[0].firstChild, ps[0].firstChild.data.length);
      b.setStart(ps[1].firstChild, 0); b.setEnd(ps[1].firstChild, 1);
      const box = (r) => [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(' ');
      return JSON.stringify({ gap: Math.round((b.getBoundingClientRect().left - a.getBoundingClientRect().right) * 10) / 10, boxes: Array.from(document.querySelectorAll('body *'), (el) => el.localName + ' ' + box(el.getBoundingClientRect())) }); })()`);
  } finally { await page.close(); }
}

// Timing seam only: completion of createImageBitmap() is held for files named a3-langsam* after the real decoding.
const HELD_DECODE = `window.a3Held = 0; window.a3Release = [];
  const originalBitmap = window.createImageBitmap;
  window.createImageBitmap = async (...args) => {
    const bitmap = await originalBitmap.apply(window, args);
    if (args[0].name && args[0].name.startsWith('a3-langsam')) { window.a3Held++; await new Promise((resolve) => { window.a3Release.push(resolve); }); }
    return bitmap;
  };`;
const HELD_READ = `const originalRead = File.prototype.arrayBuffer;
  File.prototype.arrayBuffer = async function () {
    const bytes = await originalRead.call(this);
    if (window.a3HoldRead && this.name === 'a3-gleich.html') { window.a3ReadHeld = true; await new Promise((resolve) => { window.a3ReleaseRead = resolve; }); }
    return bytes;
  };`;

const FORMAT_REFUSED = [
  ['reviewer sample: paragraphs inline above a window width', '<style>@media(min-width:1500px){p{display:inline}}</style><p>Alpha</p><p>Beta</p>', 'Bedingungen'],
  ['inline only while the pointer is over the list', '<style>ul:hover li { display: inline }</style><ul><li>Alpha</li><li>Beta</li></ul>', 'Bedingungen'],
  ['box type taken from a custom property', '<style>p { display: var(--art, block) }</style><p>Alpha</p><p>Beta</p>', 'Bedingungen'],
  ['custom property set under a condition', '<style>@media print { :root { --art: inline } }</style><div><p>Alpha</p><p>Beta</p></div>', 'Bedingungen'],
  ['box type changed by an animation', '<style>@keyframes k { to { display: inline } }</style><div><p>Alpha</p><p>Beta</p></div>', 'Bedingungen'],
  ['inline only in opened details (attribute selector)', '<style>details[open] p { display: inline }</style><details><summary>Mehr</summary><p>Alpha</p><p>Beta</p></details>', 'Bedingungen'],
  ['generated content only under a condition', '<style>@supports (display: grid) { p::before { content: "-" } }</style><div><p> Alpha</p><p>Beta</p></div>', 'Bedingungen'],
  ['condition written with a CSS escape', '<style>@m\\65 dia (min-width: 1500px) { p { display: inline } }</style><p>Alpha</p><p>Beta</p>', 'Bedingungen'],
  ['a string that is not closed', '<style>p::after { content: "Ende }</style><div><p>Alpha</p><p>Beta</p></div>', 'nicht abgeschlossen'],
  ['inline paragraphs in a part that is hidden now', '<style>p { display: inline } h1 { display: block }</style><h1>Titel</h1><div hidden><p>Alpha</p><p>Beta</p></div>', 'Aussehen'],
  ['inline paragraphs in closed details', '<style>details p { display: inline }</style><details><summary>Mehr</summary><p>Alpha</p><p>Beta</p></details>', 'Aussehen'],
];
const FORMAT_APPLIED = [
  ['colour while the pointer is over a link', '<style>a:hover { color: red }</style><div><p>Alpha</p><p>Beta <a href="x.html">Link</a></p></div>'],
  ['colours for print and a harmless animation', '<style>@media print { body { color: black } } @keyframes k { to { margin-left: 9px } }</style><div><p>Alpha</p><p>Beta</p></div>'],
  ['a hidden part without special rules', '<div hidden><p>Alpha</p><p>Beta</p></div><div><p>Gamma</p><p>Delta</p></div>'],
];

export const review3 = [
  {
    id: 'A3-01', title: 'review finding: alignment reads the style attribute as CSS and never touches other declarations (S-05, F-03)',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const style = '--label:"A;text-align: left;B"; color:red';
        const source = pageDoc('<style>p::before{content:var(--label)}</style><p style=\'' + style + '\'>Alpha</p>');
        await ed.openText('a3-01.html', source);
        const content = () => ed.eval(`((d) => d.defaultView.getComputedStyle(d.querySelector('p'), '::before').content)(${PV})`);
        const before = await content();
        await ed.caret('Alpha', 2);
        await ed.click('bAlignCenter');
        await ed.settle();
        c.eq(await ed.source(), source.replace(style, style + '; text-align: center'), 'reviewer sample: the declaration is appended, the string with ";text-align:" inside stays as written');
        c.eq(await content(), before, 'the generated text in front of the paragraph is unchanged');
        await ed.click('bAlignLeft');
        await ed.settle();
        c.eq(await ed.source(), source, 'left gives back the original text');
        const cases = [
          ['an address with a semicolon inside brackets', 'background:url(data:image/gif;base64,AA==); text-align:right', 'background:url(data:image/gif;base64,AA==); text-align: center'],
          ['a comment that mentions text-align', '/* text-align: left */ color: blue', '/* text-align: left */ color: blue; text-align: center'],
          ['the property name written with a CSS escape', 'te\\78t-align: right; color: blue', 'color: blue; text-align: center'],
          ['two alignment declarations', 'text-align: left; color: blue; text-align: right;', 'color: blue; text-align: center;'],
        ];
        let n = 0;
        for (const [label, from, to] of cases) {
          const doc = pageDoc('<p style="' + from + '">Alpha</p>');
          await ed.openText('a3-01-' + ++n + '.html', doc);
          await ed.caret('Alpha', 2);
          await ed.click('bAlignCenter');
          await ed.settle();
          c.eq(await ed.source(), doc.replace(from, to), label);
        }
        // a style text that cannot be split with certainty is left alone
        for (const odd of ['color: red; font-family: "Open', 'color: red; width: calc(1px', 'color: red /* offen']) {
          const doc = pageDoc('<p style=\'' + odd + '\'>Alpha</p>');
          await ed.openText('a3-01-' + ++n + '.html', doc);
          await ed.caret('Alpha', 2);
          await ed.click('bAlignCenter');
          await ed.settle();
          c.eq(await ed.source(), doc, 'left alone: ' + odd);
          c.ok((await ed.status()).includes('nicht sicher lesen'), 'and the pupil is told why: ' + odd, await ed.status());
        }
      });
    },
  },
  {
    id: 'A3-02', title: 'review finding: changing attributes of badly written tags keeps the intended meaning (S-05, F-02)',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const edit = async (fill) => { await ed.clickPv('d.querySelector("img")'); await ed.click('bImage'); await fill(); await ed.dialogButton('dlgImage', 'Übernehmen'); await ed.settle(); };
        const attrs = () => ed.eval('JSON.stringify(Array.from(new DOMParser().parseFromString(document.getElementById("src").value, "text/html").querySelector("img").attributes, (a) => a.name + "=" + a.value))');
        let source = pageDoc('<p>Image <img src="a.png" alt="x" width="80" WIDTH="160" height="40" HEIGHT="90"></p>');
        await ed.openText('a3-02-doppelt.html', source);
        await edit(() => ed.field('imgWidth', ''));
        c.eq(await ed.source(), pageDoc('<p>Image <img src="a.png" alt="x"></p>'), 'reviewer sample: removing the width removes every width and height attribute');
        c.eq(await attrs(), '["src=a.png","alt=x"]', 'the parsed image has neither width nor height');
        await ed.click('bUndo');
        await ed.settle();
        await edit(() => ed.field('imgWidth', '120'));
        c.eq(await ed.source(), pageDoc('<p>Image <img src="a.png" alt="x" width="120" WIDTH="160"></p>'), 'a new width changes the first attribute, which is the one that counts; height goes in every spelling');
        c.eq(await attrs(), '["src=a.png","alt=x","width=120"]', 'the parsed image has the new width and no height');
        source = pageDoc('<p>Image <img src="a.png" alt= ></p>');
        await ed.openText('a3-02-leer.html', source);
        await edit(() => ed.field('imgAlt', 'Changed'));
        c.eq(await ed.source(), source.replace('alt= ', 'alt="Changed" '), 'reviewer sample: an empty value written as "alt= " takes the new text');
        c.eq(await attrs(), '["src=a.png","alt=Changed"]', 'no extra attribute appears');
        source = pageDoc('<p>Image <img alt = src="a.png" width="50"></p>');
        await ed.openText('a3-02-leer2.html', source);
        const parsedBefore = await attrs();
        await edit(() => ed.field('imgWidth', '60'));
        c.eq(await ed.source(), source.replace('width="50"', 'width="60"'), 'another odd spelling: only the width changes');
        c.eq(await attrs(), parsedBefore.replace('width=50', 'width=60'), 'and the other attributes mean what they meant before', parsedBefore);
      });
    },
  },
  {
    id: 'A3-03', title: 'review finding: "tidy up" refuses pages whose rules hold only sometimes, or in parts that are hidden (S-05, T-07)',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        let n = 0;
        for (const [label, body, word] of FORMAT_REFUSED) {
          const source = pageDoc(body);
          await ed.openText('a3-03-nein-' + ++n + '.html', source);
          const result = await ed.format();
          c.eq(result.outcome, 'refused', label + ': not formatted');
          c.ok(result.text.includes(word) && result.text.includes('bleibt unverändert'), label + ': the reason is given', result.text);
          c.eq(await ed.source(), source, label + ': source unchanged');
        }
        for (const [label, body] of FORMAT_APPLIED) {
          const source = pageDoc(body);
          await ed.openText('a3-03-ja-' + ++n + '.html', source);
          const result = await ed.format();
          c.eq(result.outcome, 'applied', label + ': formatted', result.text);
          const saved = (await ed.download()).text;
          for (const width of [500, 1800]) {
            c.eq(await ordinary(browser, 'a3-03-nachher-' + n + '.html', saved, width), await ordinary(browser, 'a3-03-vorher-' + n + '.html', source, width), label + ': same boxes and same gap between the words at ' + width + ' pixels (ordinary page)');
          }
        }
      });
      // reviewer measurement: the sample as an ordinary page at 1800 pixels, original against what the editor saves
      await withEditor(browser, {}, async (ed) => {
        const source = pageDoc(FORMAT_REFUSED[0][1]);
        await ed.openText('a3-03-breite.html', source);
        await ed.format();
        const saved = (await ed.download()).text;
        const before = JSON.parse(await ordinary(browser, 'a3-03-breit-vorher.html', source, 1800)), after = JSON.parse(await ordinary(browser, 'a3-03-breit-nachher.html', saved, 1800));
        c.eq(after.gap, before.gap, 'reviewer sample at 1800 pixels: the gap between the two words is what it was (' + before.gap + ')');
      });
    },
  },
  {
    id: 'A3-04', title: 'review finding: only the latest choice of the open image dialog counts (S-06, F-01)',
    async run(c, { browser }) {
      // both pictures lie next to the editor, so that the page pane can show the one that was inserted
      const folder = editorFolder('a3-04-ordner');
      const slow = folder.put('a3-langsam.png', makePng(20, 10, false)), fast = folder.put('a3-schnell.png', makePng(30, 15, false));
      // reviewer schedule: choose, cancel while the check is pending, open again, choose another file, release
      await withEditor(browser, { init: HELD_DECODE, artefact: folder.artefact }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.click('bImage');
        await ed.page.setFiles('#imgIn', [slow]);
        await ed.until('window.a3Held === 1', 'first check is held');
        await ed.dialogButton('dlgImage', 'Abbrechen');
        const afterCancel = await ed.source();
        await ed.click('bImage');
        await ed.pickImage(fast);
        const chosen = await imgName(ed);
        await ed.eval('window.a3Release.shift()()');
        await sleep(400);
        c.eq(await imgName(ed), chosen, 'the result of the cancelled dialog does not change the open one', chosen);
        c.ok(chosen.includes('a3-schnell.png') && chosen.includes('30 × 15'), 'the open dialog shows the file chosen in it');
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        const saved = (await ed.download()).text;
        c.ok(saved.includes('src="a3-schnell.png"') && !saved.includes('a3-langsam'), 'the inserted image is the later choice', saved.split('\n')[8]);
        c.ok(!afterCancel.includes('<img'), 'the cancelled dialog itself inserted nothing');
      });
      // two choices in one dialog: the slow first one finishes last
      await withEditor(browser, { init: HELD_DECODE, artefact: folder.artefact }, async (ed) => {
        await ed.caret('mein Text.', 'mein Text.'.length);
        await ed.click('bImage');
        await ed.page.setFiles('#imgIn', [slow]);
        await ed.until('window.a3Held === 1', 'first check is held');
        await ed.pickImage(fast);
        await ed.eval('window.a3Release.shift()()');
        await sleep(400);
        c.ok((await imgName(ed)).includes('a3-schnell.png'), 'second choice in the same dialog: the earlier, slower check does not win', await imgName(ed));
        await ed.dialogButton('dlgImage', 'Einfügen');
        await ed.settle();
        c.ok((await ed.source()).includes('src="a3-schnell.png"') && !(await ed.source()).includes('a3-langsam'), 'and the later choice is inserted');
        await ed.until(`((d) => d.querySelector('img').complete)(${PV})`, 'picture loaded');
        c.eq(await ed.eval(`((d) => d.querySelector('img').naturalWidth)(${PV})`), 30, 'the page pane shows the later picture');
      });
      c.note('timing', 'completion of createImageBitmap() is held by the test after the real decoding; files, file input and buttons are real');
    },
  },
  {
    id: 'A3-05', title: 'review finding: every stop by the content policy is announced, whatever the address looks like (S-04)',
    async run(c, { browser }) {
      const sink = await startSink();
      try {
        const o = sink.origin;
        await withEditor(browser, {}, async (ed) => {
          const samples = [
            ['reviewer sample: escaped url() with a one-letter path', '<p style="background:u\\72 l(' + o + '/a)">Passive</p>'],
            ['escaped url() to the bare host', '<p style="background:u\\72 l(' + o + ')">Passive</p>'],
            ['escaped url() with an address that is spelled with percent codes', '<p style="background:u\\72 l(' + o + '/%61%62%63.png)">Passive</p>'],
          ];
          let n = 0;
          for (const [label, body] of samples) {
            const source = pageDoc(body), before = sink.hits.length;
            await ed.openText('a3-05-' + ++n + '.html', source);
            await sleep(700);
            c.eq(sink.hits.slice(before).join(','), '', label + ': nothing reaches the local counter');
            c.ok((await ed.inactiveNote()).includes('blockiert'), label + ': the note says that something was stopped', await ed.inactiveNote() || '(no note)');
            c.eq(await ed.source(), source, label + ': source unchanged');
          }
          const stops = ed.page.eventsOf('Audits.issueAdded').filter((e) => String((e.issue.details.contentSecurityPolicyIssueDetails || {}).blockedURL || '').startsWith(o)).length;
          c.ok(stops >= 3, 'control: the browser reports the stops (' + stops + ' reports)');
          // the note stays for this document, because the editor cannot tell which text caused the stop
          await ed.eval('(() => { const t = document.getElementById("src"); t.focus(); const i = t.value.indexOf(" style="), j = t.value.indexOf(">Passive"); t.setSelectionRange(i, j); })()');
          await ed.key('Delete');
          await ed.settle();
          c.ok(!(await ed.source()).includes('style=') && (await ed.inactiveNote()).includes('blockiert'), 'after the address is deleted the note stays until another document is opened', await ed.inactiveNote());
          await ed.click('bNew');
          await ed.dialogButton('dlgConfirm', 'Änderungen verwerfen');
          await ed.settle();
          c.eq(await ed.inactiveNote(), '', 'a new page starts without a note');
        });
      } finally { await sink.close(); }
    },
  },
  {
    id: 'A3-T', title: 'review finding about the test helper: opening a file waits for that file, also when the name is the same',
    async run(c, { browser }) {
      await withEditor(browser, { init: HELD_READ }, async (ed) => {
        await ed.openText('a3-gleich.html', '<p>OLD BYTES</p>');
        c.eq(await ed.source(), '<p>OLD BYTES</p>', 'first file opened');
        await ed.eval('window.a3HoldRead = true');
        const opening = ed.openFile(tmpFile('a3-gleich.html', '<p>NEW BYTES</p>'));
        let returned = false;
        opening.then(() => { returned = true; }, () => { returned = true; });
        await ed.until('window.a3ReadHeld', 'second read is held');
        await sleep(300);
        c.eq(returned, false, 'reviewer schedule: while the read of a file with the same name is held, the helper has not returned');
        await ed.eval('window.a3HoldRead = false; window.a3ReleaseRead()');
        await opening;
        c.eq(await ed.source(), '<p>NEW BYTES</p>', 'when the helper returns, the new bytes are in the editor');
      });
    },
  },
  {
    id: 'FF-01', title: 'Firefox measurement: typing never changes white space in a neighbouring text (S-05)',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        let source = pageDoc('<p>Text <!-- comment --> weiter.</p>');
        await ed.openText('ff-01-kommentar.html', source);
        await ed.caret('Text ', 4);
        await ed.type('Q');
        await ed.settle();
        c.eq((await ed.download()).text, source.replace('Text ', 'TextQ '), 'reviewer sample: a letter typed in front of a comment leaves the space behind the comment');
        // the gap can still be closed on purpose: deleting is not mistaken for tidying
        await ed.caret('TextQ', 5);
        for (let i = 0; i < 3 && /\s/.test(await ed.eval(PV + '.querySelector("p").textContent')); i++) { await ed.key('Delete'); await ed.settle(); }
        c.eq(await ed.eval(PV + '.querySelector("p").textContent'), 'TextQweiter.', 'the space between the words can be deleted with the Delete key');
        c.ok(/<p>TextQ<!-- comment -->weiter\.<\/p>/.test(await ed.source()), 'and the source has no space left there, the comment stays', (await ed.source()).match(/<p>[^]*<\/p>/)[0]);
        source = pageDoc('<p>Anfang <unbekannt>fremd</unbekannt>\n</p>\n<p>Zwei</p>');
        await ed.openText('ff-01-umbruch.html', source);
        await ed.caret('fremd', 5);
        await ed.type('Q');
        await ed.settle();
        c.eq(await ed.source(), source.replace('fremd', 'fremdQ'), 'reviewer sample: a line break behind an unknown element stays when typing inside the element');
        source = pageDoc('<p>Eins <b>fett</b> <!-- a --> <i>kursiv</i> Ende</p>');
        await ed.openText('ff-01-mehrere.html', source);
        await ed.caret('fett', 4);
        await ed.type('X');
        await ed.caret('Ende', 0);
        await ed.type('Y');
        await ed.settle();
        c.eq(await ed.source(), source.replace('fett', 'fettX').replace('Ende', 'YEnde'), 'spaces on both sides of a comment between inline elements stay');
      });
    },
  },
  {
    id: 'FF-02', title: 'Firefox measurement: a line break the browser keeps in an empty page is never written into the document (S-05)',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        // an empty page first, so that a browser which keeps a line break of its own in it has one
        await ed.openText('ff-02-leer.html', '<!doctype html><html><head><meta charset="utf-8"><title>Leer</title></head><body></body></html>');
        await sleep(200);
        const source = pageDoc('<br><!-- Kommentar --><p>Alpha</p>');
        await ed.openText('ff-02-br.html', source);
        c.eq(await ed.eval(PV + '.querySelectorAll("br").length'), 1, 'the page pane holds exactly the one line break of the document');
        await ed.caret('Alpha', 5);
        await ed.type('!');
        await ed.settle();
        c.eq(await ed.source(), source.replace('Alpha', 'Alpha!'), 'an edit elsewhere leaves the line break at the start of the page as written');
        const empty = '<!doctype html><html><head><meta charset="utf-8"><title>Leer</title></head><body></body></html>';
        await ed.openText('ff-02-leer2.html', empty);
        await sleep(200);
        await ed.clickPv('d.body');
        await ed.click('bAlignCenter');
        await ed.settle();
        c.ok(/<body>\s*<p style="text-align: center"><br><\/p>\s*<\/body>/.test(await ed.source()), 'a command in an empty page gives one empty paragraph and no second line break', (await ed.source()).match(/<body>[^]*<\/body>/)[0]);
        await ed.openText('ff-02-leer3.html', empty);
        await ed.clickPv('d.body');
        await ed.type('Hallo');
        await ed.settle();
        c.ok(/<body>\s*<p>Hallo<\/p>\s*<\/body>/.test(await ed.source()), 'text typed into an empty page becomes one paragraph', (await ed.source()).match(/<body>[^]*<\/body>/)[0]);
      });
    },
  },
];
