// Additional robustness cases (not part of the numbered contract, but they guard its data-integrity rules).
//   R-01  drives the delivered file with a corpus of hand-written HTML snippets: open, type one character in
//         several places, undo, format. Every change must stay local.
//   R-02  loads the source modules into a plain test page and checks round-trip properties on thousands of
//         generated documents: rendering and writing back without an edit reproduces the text exactly, and a
//         single appended character changes exactly that place.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Editor, PV, ROOT, sleep } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const page = (body) => '<!DOCTYPE html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<title>Korpus</title>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';

export const SNIPPETS = [
  page('<h1>Titel</h1>\n<p>Ein Absatz.</p>'),
  page('<p>Eins<p>Zwei<p>Drei'),
  page('<ul>\n  <li>Apfel\n  <li>Birne\n  <li>Kirsche\n</ul>'),
  page('<ol><li>Eins</li><li>Zwei<ul><li>Zwei a</li><li>Zwei b</li></ul></li><li>Drei</li></ol>'),
  page('<table>\n<tr><th>Name<th>Alter\n<tr><td>Ada<td>12\n<tr><td>Ben<td>13\n</table>'),
  page('<table border="1"><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody><tfoot><tr><td>Summe</td></tr></tfoot></table>'),
  page('<dl><dt>HTML<dd>Auszeichnungssprache<dt>CSS<dd>Gestaltung</dl>'),
  page('<p>Gr&ouml;&szlig;e &amp; Ma&szlig;e: 3 &lt; 5 &gt; 2, 20&nbsp;&euro;, &#8364; &#x20AC; &copy; &unbekannt; A&B</p>'),
  page('<p>Text mit <b>fett</b>, <i>kursiv</i>, <u>unterstrichen</u>, <b><i>beides</i></b> und <code>Code</code>.</p>'),
  page('<p>Zeile eins<br>Zeile zwei<br/>Zeile drei<br />Ende</p>'),
  page('<!-- Kommentar vor allem -->\n<h2>Abschnitt</h2>\n<!-- Kommentar dazwischen -->\n<p>Text <!-- mitten im Satz --> weiter.</p>\n<!-- am Ende -->'),
  page('<pre>\n  Zeile 1\n    Zeile 2\n</pre>\n<p>Nach dem Block.</p>'),
  page('<p>Vor dem Bild <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Punkt"> nach dem Bild.</p>'),
  page('<p>Ein <a href="seite2.html">Link</a> und <a href="https://example.org/" target="_blank">noch einer</a>.</p>'),
  page('<div class="kasten"><h2>Im Kasten</h2><p>Absatz im Kasten.</p></div>\n<p>Außerhalb.</p>'),
  page('<blockquote><p>Ein Zitat.</p></blockquote><hr><p>Danach.</p>'),
  page('<H1>GROSS</H1>\n<P ALIGN="center">Absatz in Großbuchstaben-Tags.</P>\n<UL><LI>Eins<LI>Zwei</UL>'),
  page('<p class=ohne id=anf title=\'einfach\' data-x="doppelt" hidden>Unsichtbar</p><p lang=de>Sichtbar</p>'),
  page('<p>Vorher</p>\n<script>var a = "<p>kein Absatz</p>"; if (a < 1) {}</script>\n<p>Nachher</p>'),
  page('<style>p { color: green; }</style>\n<p>Grüner Text.</p>'),
  page('<p onclick="tuwas()" onmouseover="mehr()">Absatz mit Ereignissen.</p>'),
  page('<p>Erster</p></p><p>Zweiter</p>'),
  page('<p><ul><li>Liste im Absatz</li></ul></p><p>Danach</p>'),
  page('<h1>Überschrift ohne Ende\n<p>Absatz danach'),
  page('<p>Offenes <b>fett bis zum Ende\n<p>Zweiter Absatz'),
  page('<div>Div <span>Span</div> Rest</span>'),
  page('<form action="senden.php"><label>Name <input name="n" value="x"></label><select><option>A<option>B</select><textarea>frei</textarea><button>Los</button></form><p>Nach dem Formular.</p>'),
  page('<p>Vor</p><iframe src="andere.html"></iframe><video src="film.mp4" controls></video><p>Nach</p>'),
  page('<svg width="40" height="20" viewBox="0 0 40 20"><rect width="40" height="20" fill="red"/><text x="2" y="15">SVG</text></svg><p>Unter der Grafik.</p>'),
  page('<mein-element>Eigenes Element</mein-element><p>Normal</p><unbekannt>Unbekannt</unbekannt>'),
  page('Loser Text direkt im Body\n<p>Ein Absatz</p>\nNoch loser Text'),
  page('<p>   Viele    Leerzeichen     hier   </p>\n\n\n<p>\tTabulator\tund\nUmbruch</p>'),
  page('<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h5>E</h5><h6>F</h6>'),
  page('<p>Emoji 😀 und Zeichen außerhalb: 𝔘𝔫𝔦𝔠𝔬𝔡𝔢, &#128512; &#x1F600;</p>'),
  page('<header><nav><a href="#a">A</a> | <a href="#b">B</a></nav></header><main><article><section><h2 id="a">A</h2><p>Text A</p></section></article></main><footer><small>Fuß</small></footer>'),
  page('<p>Text<p>Zweiter</p>\n<table><tr><td>Zelle mit <p>Absatz in Zelle<td>und <ul><li>Liste</ul></table>'),
  '<h1>Nur ein Bruchstück</h1>\n<p>Ohne html, head und body.</p>\n',
  '<html><head><title>Ohne Doctype</title></head><body><p>Quirks<table><tr><td>Tabelle im Absatz</td></tr></table></body></html>',
  '<!DOCTYPE html>\n<title>Kurzform</title>\n<h1>Ohne html/head/body-Tags</h1>\n<p>Erlaubtes HTML.\n',
  '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Eine Zeile</title></head><body><h1>Alles</h1><p>in einer Zeile.</p></body></html>',
  '<!DOCTYPE html>\n<html>\n<body>\n<p>Body ohne Head</p>\n</body>\n</html>\n\n\n',
  '<!DOCTYPE html>\n<html>\n<head>\n<title>Text nach dem Ende</title>\n</head>\n<body>\n<p>Innen</p>\n</body>\n</html>\n<p>Nach dem Ende</p>\n',
  'Nur Text ohne jedes Tag',
  '   \n\n',
];

function diff(a, b) {
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { at: p, removed: a.slice(p, a.length - s), added: b.slice(p, b.length - s) };
}
const blankish = (s) => /^(?:[ \t\n\r ]|&nbsp;)*$/.test(s);

function serveModules() {
  const host = '<!DOCTYPE html><meta charset="utf-8"><title>Modultest</title><iframe id="pv" sandbox="allow-same-origin" srcdoc="<!DOCTYPE html><html><head></head><body></body></html>"></iframe>' +
    '<script type="module">import * as project from "/src/js/project.js"; import * as serialize from "/src/js/serialize.js"; window.M = { ...project, ...serialize }; document.documentElement.dataset.ready = "yes";</script>';
  const hits = [];
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url === '/host.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(host); return; }
    const file = path.join(ROOT, req.url.split('?')[0]);
    if (req.url.startsWith('/src/js/') && fs.existsSync(file)) { res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' }); res.end(fs.readFileSync(file)); return; }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ hits, origin: 'http://127.0.0.1:' + server.address().port, close: () => new Promise((r) => server.close(r)) })));
}

// Same generator as in tests/unit/core.test.mjs (kept in sync by hand; the corpus is data, not product code).
const PIECES = ['<p>', '</p>', '<b>', '</b>', '<i>', '</i>', '<ul>', '<li>', '</li>', '</ul>', '<table>', '<tr>', '<td>', '</td>', '</table>', '<br>', '<br/>', '<img src="a.png" alt="x>y">',
  '<!-- c -->', '<!--', '-->', '<!DOCTYPE html>', '<a href=\'x\'>', '</a>', '<div class=a b>', '</div>', '<pre>', '</pre>', '<script>', '</script>', '<style>', '</style>', '<textarea>', '</textarea>',
  'Text ', 'ä&ouml; ', '&amp;', '&', '<', '>', ' ', '\n', '\n  ', '</', '<x', '="', '"', '\'', '<h1>', '</h1>', '</h2>', '<svg><path d="M0"/></svg>', '<html>', '<head>', '</head>', '<body>', '</body>', '</html>', '</br>', '<title>', '</title>'];
function generated(count) {
  const docs = [];
  let seed = 20261118;
  const next = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let i = 0; i < count; i++) {
    let s = '';
    for (let k = next(30); k >= 0; k--) s += PIECES[next(PIECES.length)];
    docs.push(s);
  }
  return docs;
}

export const robustness = [
  {
    id: 'R-01', title: 'corpus of hand-written snippets: every visual edit stays local, undo and formatting are safe',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const stats = { documents: 0, locked: 0, withReadOnlyParts: 0, edits: 0, exact: 0, whitespaceOnly: 0, formatted: 0, formatRefused: 0 };
        const problems = [], examples = [];
        for (let i = 0; i < SNIPPETS.length; i++) {
          const original = SNIPPETS[i];
          const name = 'korpus-' + String(i + 1).padStart(2, '0') + '.html';
          await ed.openText(name, original);
          stats.documents++;
          if ((await ed.source()) !== original) { problems.push(name + ': source differs after opening'); continue; }
          const locked = !(await ed.eval('document.getElementById("lockNote").hidden'));
          if (locked) stats.locked++;
          if (await ed.eval(PV + '.querySelectorAll("[data-se-opaque]").length')) stats.withReadOnlyParts++;
          const count = locked ? 0 : await ed.eval(`((d) => { const out = []; const w = d.createTreeWalker(d.body, 4); let n; while ((n = w.nextNode())) { const p = n.parentElement;
            if (/\\S/.test(n.data) && p.isContentEditable && !p.closest("style, script, textarea, select, title, [data-se-box]")) out.push(n); } window.__targets = out; return out.length; })(${PV})`);
          const picks = Array.from(new Set([0, Math.floor(count / 2), count - 1])).filter((k) => k >= 0 && k < count);
          for (const k of picks) {
            await ed.openText(name, original);
            await ed.eval(`((d, w) => { const out = []; const tw = d.createTreeWalker(d.body, 4); let n; while ((n = tw.nextNode())) { const p = n.parentElement;
              if (/\\S/.test(n.data) && p.isContentEditable && !p.closest("style, script, textarea, select, title, [data-se-box]")) out.push(n); }
              const t = out[${k}]; w.focus(); d.body.focus(); d.getSelection().collapse(t, t.data.replace(/\\s+$/, "").length); })(${PV}, document.getElementById("pv").contentWindow)`);
            await ed.type('Q');
            await ed.settle();
            stats.edits++;
            const now = await ed.source();
            const d = diff(original, now);
            if (d.removed === '' && d.added === 'Q') stats.exact++;
            else if (d.added.includes('Q') && blankish(d.removed) && blankish(d.added.replace('Q', ''))) { stats.whitespaceOnly++; if (examples.length < 6) examples.push(name + ': ' + JSON.stringify(d.removed) + ' -> ' + JSON.stringify(d.added)); }
            else problems.push(`${name} text ${k}: removed ${JSON.stringify(d.removed.slice(0, 80))} added ${JSON.stringify(d.added.slice(0, 80))}`);
            const same = await ed.eval(`((d) => { const strip = (root) => { const c = root.cloneNode(true); for (const x of c.querySelectorAll("script, style, template, [data-se-box], iframe, object, embed, video, audio, noembed, noframes, title, base, meta, link")) x.remove(); return c.textContent.replace(/\\s+/g, ""); };
              const parsed = new DOMParser().parseFromString(document.getElementById("src").value, "text/html"); return strip(parsed.body) === strip(d.body); })(${PV})`);
            if (!same) problems.push(name + ' text ' + k + ': page text differs from the parsed source after the edit');
            await ed.key('z', ['ctrl']);
            await ed.settle();
            if ((await ed.source()) !== original) problems.push(name + ' text ' + k + ': undo does not restore the original');
          }
          await ed.openText(name, original);
          await ed.click('bFormat');
          await sleep(60);
          if (await ed.dialogOpen('dlgInfo')) { stats.formatRefused++; await ed.dialogButton('dlgInfo', 'OK'); if ((await ed.source()) !== original) problems.push(name + ': refused formatting changed the text'); }
          else {
            await ed.settle();
            const out = await ed.source();
            if (out.replace(/\s+/g, '') !== original.replace(/\s+/g, '')) problems.push(name + ': formatting changed more than white space');
            const same = await ed.eval(`((a, b) => { const text = (s) => { const doc = new DOMParser().parseFromString(s, "text/html");
              return Array.from(doc.querySelectorAll("p, li, td, th, h1, h2, h3, dd, dt, pre, textarea, a, b, i, span, code")).map((e) => e.localName + ":" + (e.matches("pre, textarea") ? e.textContent
                : e.querySelector("p, li, ul, ol, div, table, tr, td, th, br, h1, h2, h3, dl, dd, dt, pre, blockquote, section, article, header, footer, main, nav, form, hr") ? e.textContent.replace(/\\s+/g, "")
                : e.textContent.replace(/\\s+/g, " ").trim())).join("|"); }; return text(a) === text(b); })(${JSON.stringify(original)}, ${JSON.stringify(out)})`);
            if (!same) problems.push(name + ': formatting changed the text of an element');
            if (out !== original) stats.formatted++;
          }
        }
        c.eq(problems.join(' ; '), '', SNIPPETS.length + ' snippets: edits are local, the page matches the source, undo restores, formatting is white-space only');
        c.note('corpus statistics', JSON.stringify(stats));
        c.note('examples of white-space-only side effects in the edited text', examples.join(' ; '));
        c.ok(stats.locked <= 6, 'most snippets (including omitted end tags, tables, fragments) are editable', stats.locked + ' locked');
        c.eq(ed.errors().join(' | '), '', 'no script errors');
      });
    },
  },
  {
    id: 'R-02', title: 'source modules: round-trip properties on generated documents (module-level test page, not the single file)',
    async run(c, { browser }) {
      const server = await serveModules();
      const pg = await browser.newPage();
      try {
        await pg.goto(server.origin + '/host.html');
        for (let i = 0; i < 100 && (await pg.eval('document.documentElement.dataset.ready')) !== 'yes'; i++) await sleep(50);
        const docs = generated(3000).concat(SNIPPETS);
        const result = await pg.eval(`((docs) => { const M = window.M, pv = document.getElementById("pv").contentDocument;
          const out = { documents: docs.length, editable: 0, identityFailures: [], rerenderChanges: [], edits: 0, editFailures: [], errors: [] };
          for (const src of docs) { try {
            const info = new WeakMap(); pv.body.textContent = "";
            const view = M.analyze(src); M.renderView(view, pv, info);
            if (!view.ok) continue;
            out.editable++;
            const back = M.serializeBody(view, info, pv.body, []).text;
            if (back !== src && out.identityFailures.length < 5) out.identityFailures.push(src);
            if (M.renderView(M.analyze(src), pv, info).changed && out.rerenderChanges.length < 5) out.rerenderChanges.push(src);
            const view2 = M.analyze(src); M.renderView(view2, pv, info);
            const texts = []; const w = pv.createTreeWalker(pv.body, 4); let n; while ((n = w.nextNode())) { const inf = info.get(n); if (inf && inf.t && !inf.t.raw && n.parentElement.isContentEditable && !/&/.test(src.slice(inf.t.start, inf.t.end))) texts.push(n); }
            for (const node of texts.slice(0, 3)) {
              const t = info.get(node).t, old = node.data;
              node.data = old + "Q";
              const edited = M.serializeBody(view2, info, pv.body, []).text;
              node.data = old;
              out.edits++;
              const expected = src.slice(0, t.end) + "Q" + src.slice(t.end);
              if (edited !== expected && out.editFailures.length < 5) out.editFailures.push({ src, edited });
            }
          } catch (e) { if (out.errors.length < 5) out.errors.push(String(e) + " for " + JSON.stringify(src)); } }
          return JSON.stringify(out); })(${JSON.stringify(docs)})`);
        const r = JSON.parse(result);
        c.note('generated corpus', `${r.documents} documents, ${r.editable} editable after comparison with the browser parser, ${r.edits} single-character edits`);
        c.eq(JSON.stringify(r.errors), '[]', 'no exception for any document');
        c.eq(JSON.stringify(r.identityFailures), '[]', 'writing back an unedited page reproduces the source text exactly');
        c.eq(JSON.stringify(r.rerenderChanges), '[]', 'rendering the same text again changes nothing in the page');
        c.eq(JSON.stringify(r.editFailures), '[]', 'appending one character to a text changes exactly that place');
        c.ok(r.editable > 300, 'a meaningful share of the generated documents is editable', r.editable);
        c.eq(server.hits.filter((h) => !h.startsWith('/src/js/') && h !== '/host.html' && h !== '/favicon.ico').join(','), '', 'the projection alone (this page has no content security policy) requested no resource');
      } finally { await pg.close(); await server.close(); }
    },
  },
];
