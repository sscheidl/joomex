// Cases A11-01 … A11-04 for the findings B1 to B4 of the independent review of 0.1.0-alpha.11. All four come from
// the browsers' own editing (B2 from Chromium, B1, B3 and B4 from Firefox) and were measured before the code was
// changed. Each case uses the reviewer's input; expected texts are written by hand. A case passes in the browser
// that never had the defect before and after the correction, and fails before it in the browser that had it.
import { PV, sleep } from '../lib/harness.mjs';
import { withEditor, page } from './review9.mjs';

const WIN = 'document.getElementById("pv").contentWindow';
const firstText = (sel, i) => `d.createTreeWalker(d.querySelectorAll(${JSON.stringify(sel)})[${i}], 4).nextNode()`;
const startOf = (ed, sel, i = 0) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); d.getSelection().collapse(${firstText(sel, i)}, 0); })(${PV}, ${WIN})`).then(() => sleep(30));
const endOf = (ed, sel, i = 0) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); const r = d.createRange(); r.selectNodeContents(d.querySelectorAll(${JSON.stringify(sel)})[${i}]); r.collapse(false); const s = d.getSelection(); s.removeAllRanges(); s.addRange(r); })(${PV}, ${WIN})`).then(() => sleep(30));
// from behind the second character of one block to behind the second character of another
const across = (ed, a, b) => ed.eval(`((d, w) => { w.focus(); d.body.focus(); d.getSelection().setBaseAndExtent(${firstText(a, 0)}, 2, ${firstText(b, 0)}, 2); })(${PV}, ${WIN})`).then(() => sleep(30));
// the body of the page as written in the source, without the white space in front of </body>
const body = async (ed) => { const s = await ed.source(); return s.slice(s.indexOf('<body>\n') + 7, s.indexOf('</body>')).trimEnd(); };
const undoGives = async (c, ed, src, what) => { await ed.key('z', ['ctrl']); await ed.settle(); c.eq(await ed.source(), src, what + ': one undo gives the text before'); };

export const review11 = [
  {
    id: 'A11-01', title: 'review of alpha.11, B2: a triple click on a block and typing replaces the text of that block only (Chromium selected up to the next block and joined it)',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const list = '<p>Er frisst gern:</p>\n<ul>\n  <li>Fleisch</li>\n  <li>Knochen</li>\n</ul>';
        await ed.openText('a11-01.html', page(list));
        await ed.clickPv('d.querySelector("p")', 3);
        await sleep(150);
        await ed.type('Neu');
        await ed.settle(1300);
        c.eq(await body(ed), '<p>Neu</p>\n<ul>\n  <li>Fleisch</li>\n  <li>Knochen</li>\n</ul>', 'paragraph in front of a list: the paragraph holds the typed text, the list is untouched');
        await undoGives(c, ed, page(list), 'paragraph in front of a list');
        await ed.openText('a11-01b.html', page('<h1>Mein Titel</h1>\n<p>Zweiter Absatz</p>'));
        await ed.clickPv('d.querySelector("h1")', 3);
        await sleep(150);
        await ed.type('Neu');
        await ed.settle(1300);
        c.eq(await body(ed), '<h1>Neu</h1>\n<p>Zweiter Absatz</p>', 'heading in front of a paragraph: the paragraph stays a paragraph');
        await ed.openText('a11-01c.html', page('<ul>\n  <li>Fleisch</li>\n  <li>Knochen</li>\n</ul>'));
        await ed.clickPv('d.querySelector("li")', 3);
        await sleep(150);
        await ed.key('Backspace');
        await ed.type('Neu');
        await ed.settle(1300);
        c.eq(await body(ed), '<ul>\n  <li>Neu</li>\n  <li>Knochen</li>\n</ul>', 'list item, Backspace and typing: the next item stays');
        await ed.openText('a11-01d.html', page(list));
        await ed.clickPv('d.querySelector("p")', 3);
        await sleep(150);
        await ed.click('bBold');
        await ed.settle();
        c.eq(await body(ed), '<p><b>Er frisst gern:</b></p>\n<ul>\n  <li>Fleisch</li>\n  <li>Knochen</li>\n</ul>', 'guard: bold after a triple click acts on the clicked paragraph, as before');
      });
    },
  },
  {
    id: 'A11-02', title: 'review of alpha.11, B1: joining a paragraph, heading or list item with a block of another kind keeps all text (Firefox deleted the second block from its first inline element on)',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        const head = '<h1>Mein Haustier</h1>\n<p>Ich habe einen <b>Hund</b> und eine Katze.</p>';
        const joined = '<h1>Mein HaustierIch habe einen <b>Hund</b> und eine Katze.</h1>';
        await ed.openText('a11-02.html', page(head));
        await startOf(ed, 'p');
        await ed.key('Backspace');
        await ed.settle(1300);
        c.eq(await body(ed), joined, 'Backspace at the start of a paragraph behind a heading: the whole paragraph goes on in the heading');
        await undoGives(c, ed, page(head), 'Backspace');
        await ed.openText('a11-02b.html', page(head));
        await endOf(ed, 'h1');
        await ed.key('Delete');
        await ed.settle(1300);
        c.eq(await body(ed), joined, 'Delete at the end of the heading: the same');
        await ed.openText('a11-02c.html', page(head));
        await across(ed, 'h1', 'p');
        await ed.type('X');
        await ed.settle(1300);
        c.eq(await body(ed), '<h1>MeXh habe einen <b>Hund</b> und eine Katze.</h1>', 'typing over a selection across the border: only the selected text goes');
        await undoGives(c, ed, page(head), 'typing over a selection');
        await ed.openText('a11-02d.html', page(head));
        await across(ed, 'h1', 'p');
        await ed.key('Backspace');
        await ed.settle(1300);
        c.eq(await body(ed), '<h1>Meh habe einen <b>Hund</b> und eine Katze.</h1>', 'Backspace on such a selection: only the selected text goes');
        await ed.openText('a11-02i.html', page(head));
        await across(ed, 'h1', 'p');
        await ed.key('x', ['ctrl']);
        await ed.settle(1300);
        c.eq(await body(ed), '<h1>Meh habe einen <b>Hund</b> und eine Katze.</h1>', 'cutting such a selection: only the selected text goes');
        await ed.openText('a11-02j.html', page(head));
        await across(ed, 'h1', 'p');
        await ed.key('Enter');
        await ed.settle(1300);
        const split = (await body(ed)).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
        c.eq(split, 'Me h habe einen Hund und eine Katze.', 'Enter over such a selection: the text outside the selection is all there, on two lines', await body(ed));
        const list = '<ul>\n  <li>Punkt eins</li>\n</ul>\n<p>Danach <b>fett</b> und mehr.</p>';
        await ed.openText('a11-02e.html', page(list));
        await startOf(ed, 'p');
        await ed.key('Backspace');
        await ed.settle(1300);
        c.eq(await body(ed), '<ul>\n  <li>Punkt einsDanach <b>fett</b> und mehr.</li>\n</ul>', 'Backspace at the start of a paragraph behind a list: the paragraph goes on in the last item');
        await undoGives(c, ed, page(list), 'paragraph behind a list');
        await ed.openText('a11-02f.html', page('<p>Absatz eins</p>\n<ul>\n  <li>Punkt <b>fett</b> eins</li>\n  <li>zwei</li>\n</ul>'));
        await endOf(ed, 'p');
        await ed.key('Delete');
        await ed.settle(1300);
        c.eq(await body(ed), '<p>Absatz einsPunkt <b>fett</b> eins</p>\n<ul>\n  <li>zwei</li>\n</ul>', 'Delete at the end of a paragraph in front of a list: the first item goes on in the paragraph, the list keeps the rest');
        await ed.openText('a11-02g.html', page('<p>Absatz eins</p>\n<h2>Zwei <b>fett</b> Ende</h2>'));
        await startOf(ed, 'h2');
        await ed.key('Backspace');
        await ed.settle(1300);
        c.eq(await body(ed), '<p>Absatz einsZwei <b>fett</b> Ende</p>', 'Backspace at the start of a heading behind a paragraph');
        await ed.openText('a11-02h.html', page('<p>Absatz eins</p>\n<p>Ich habe einen <b>Hund</b>.</p>'));
        await startOf(ed, 'p', 1);
        await ed.key('Backspace');
        await ed.settle(1300);
        c.eq(await body(ed), '<p>Absatz einsIch habe einen <b>Hund</b>.</p>', 'guard: two paragraphs are joined by the browser, as before');
      });
    },
  },
  {
    id: 'A11-03', title: 'review of alpha.11, B3: Enter twice at the end of a list leaves no empty list behind the new paragraph (Firefox did); an empty list of the source stays',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.openText('a11-03.html', page('<p>Vorher</p>\n<ul>\n  <li>Fleisch</li>\n  <li>Knochen</li>\n</ul>\n<p>Nachher</p>'));
        await endOf(ed, 'li', 1);
        await ed.key('Enter');
        await ed.type('Wasser');
        await ed.key('Enter');
        await ed.key('Enter');
        await ed.type('Ende');
        await ed.settle(1300);
        const s = await body(ed);
        c.eq((s.match(/<ul/g) || []).length, 1, 'one list in the source', s);
        c.ok(s.includes('<li>Wasser</li>') && s.includes('<p>Ende</p>') && s.endsWith('<p>Nachher</p>'), 'the new item, the new paragraph and the paragraph behind are there', s);
        const empty = '<p>Vorher</p>\n<ul>\n</ul>\n<p>Nachher</p>';
        await ed.openText('a11-03b.html', page(empty));
        await endOf(ed, 'p', 0);
        await ed.key('Enter');
        await ed.type('Neu');
        await ed.settle(1300);
        c.eq(await body(ed), '<p>Vorher</p>\n<p>Neu</p>\n<ul>\n</ul>\n<p>Nachher</p>', 'guard: a list without items that the pupil wrote stays');
      });
    },
  },
  {
    id: 'A11-04', title: 'review of alpha.11, B4: the space in front of a bold word deleted and typed again is written as a space, not as &nbsp; (Firefox put it into the bold word)',
    async run(c, { browser }) {
      await withEditor(browser, { noFsa: true }, async (ed) => {
        await ed.openText('a11-04.html', page('<p>Ein <b>fettes</b> Wort</p>'));
        await ed.eval(`((d, w) => { w.focus(); d.body.focus(); const t = d.querySelector("p").firstChild; d.getSelection().collapse(t, t.data.length); })(${PV}, ${WIN})`);
        await sleep(30);
        await ed.key('Backspace');
        await ed.type(' ');
        await ed.settle(1300);
        await endOf(ed, 'p');
        await ed.type('!');
        await ed.settle(1300);
        const s = await body(ed);
        c.ok(!s.includes('&nbsp;'), 'no &nbsp; in the source', s);
        // the browsers put the space on different sides of the start tag; both read "Ein fettes Wort!"
        c.ok(s === '<p>Ein <b>fettes</b> Wort!</p>' || s === '<p>Ein<b> fettes</b> Wort!</p>', 'one ordinary space between the two words', s);
      });
    },
  },
];
