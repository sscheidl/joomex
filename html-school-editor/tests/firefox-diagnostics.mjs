// Small independent controls for the Firefox acceptance differences. Product code is unchanged.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { launchFirefox } from './lib/firefox.mjs';
import { ROOT, ARTEFACT, Editor, PV, fixture, readFixture, tmpFile, sleep } from './lib/harness.mjs';

const source = '<!doctype html><html><head><meta charset="utf-8"><title>Control</title></head><body><p>Text <!-- comment --> weiter.</p></body></html>';
const host = '<!doctype html><iframe id="pv" sandbox="allow-same-origin" srcdoc="<!doctype html><body></body>"></iframe>' +
  '<script type="module">import * as P from "/src/js/project.js";import * as S from "/src/js/serialize.js";window.M={...P,...S};window.ready=true;</script>';
const server = http.createServer((req, res) => {
  if (req.url === '/host') { res.setHeader('Content-Type', 'text/html'); res.end(host); }
  else if (req.url === '/before' || req.url === '/after') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    res.end(readFixture(req.url === '/before' ? 'format-in.html' : 'format-expected.html'));
  } else if (req.url.startsWith('/src/js/') && /^[a-zA-Z0-9./-]+$/.test(req.url)) {
    const file = path.join(ROOT, req.url);
    if (fs.existsSync(file)) { res.setHeader('Content-Type', 'text/javascript'); res.end(fs.readFileSync(file)); }
    else { res.writeHead(404); res.end(); }
  } else { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = 'http://127.0.0.1:' + server.address().port;
const browser = await launchFirefox();
const bytes = fs.readFileSync(ARTEFACT);
const out = { date: new Date().toISOString(), browser: browser.version, mode: 'headless', bytes: bytes.length,
  sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
const made = [];
try {
  const ed = await Editor.open(browser);
  try {
    await ed.openFile(fixture('basic.html'));
    await ed.eval(`((d) => {window.firefoxClicks=[];for(const t of ['click','dblclick'])d.addEventListener(t,e=>window.firefoxClicks.push([e.type,e.detail]));})(${PV})`);
    await ed.clickPv('d.querySelector("i")', 2); await sleep(150);
    out.selection = await ed.eval(`((d) => { const s=d.getSelection(),h=CSS.highlights.get('se-link');
      return {text:s.toString(),source:h?Array.from(h)[0].toString():null,events:window.firefoxClicks,
        startNode:s.anchorNode.nodeName,startOffset:s.anchorOffset,endNode:s.focusNode.nodeName,endOffset:s.focusOffset};})(${PV})`);
    const file = tmpFile('ff-comment-control.html', source); made.push(file); await ed.openFile(file);
    await ed.caret('Text ', 4); await ed.type('Q'); await ed.settle();
    const downloaded = await ed.download();
    out.commentEdit = { source, expected: source.replace('Text ', 'TextQ '), saved: downloaded.text,
      exact: downloaded.text === source.replace('Text ', 'TextQ ') };
    await ed.openFile(fixture('format-in.html'));
    const viewport = await ed.eval('({width:document.getElementById("pv").clientWidth,height:document.getElementById("pv").clientHeight})');
    out.format = await ed.format(); out.format.sourceUnchanged = await ed.source() === readFixture('format-in.html');
    out.format.viewport = viewport;
  } finally { await ed.close(); }
  const page = await browser.newPage();
  try {
    await page.goto(origin + '/host');
    for (let n = 0; n < 100 && !(await page.eval('window.ready===true')); n++) await sleep(20);
    const samples = ['<p>Alpha</p>', '<p>Alpha<!-- c --> Beta</p>', '<br/><!-- unfinished'];
    out.roundTrips = await page.eval(`(sources => sources.map(src => { const info=new WeakMap(),doc=document.getElementById('pv').contentDocument;
      doc.body.textContent='';const view=M.analyze(src);M.renderView(view,doc,info);const back=M.serializeBody(view,info,doc.body,[]).text;
      return {source:src,mapped:view.ok,serialized:back,exact:src===back,rendered:doc.body.innerHTML,
        children:Array.from(doc.body.childNodes,n=>({node:n.nodeName,mapped:!!info.get(n)?.t}))};}))(${JSON.stringify(samples)})`);
  } finally { await page.close(); }
  const prints = [];
  for (const route of ['/before', '/after']) {
    const page = await browser.newPage();
    try {
      await browser.raw.send('browsingContext.setViewport', { context: page.context, viewport: out.format.viewport, devicePixelRatio: 1 });
      await page.goto(origin + route);
      prints.push(await page.eval(`(() => { const out=[],r=document.createRange(),w=document.createTreeWalker(document.body,5);
        const box=b=>[b.left,b.top,b.width,b.height].map(v=>Math.round(v*4));
        for(let n=w.nextNode();n;n=w.nextNode()){
          if(n.nodeType===1){out.push([n.localName,...box(n.getBoundingClientRect())]);continue;}
          r.selectNodeContents(n);const b=r.getBoundingClientRect();
          if(/\\S/.test(n.data)||b.width>0)out.push([/\\S/.test(n.data)?n.data.replace(/\\s+/g,' ').trim():'space',...box(b)]);
        }return out;})()`));
    } finally { await page.close(); }
  }
  out.ordinaryFormatControl = { origin: 'controlled localhost, CSP disables scripts; viewport equals editor page pane', viewport: out.format.viewport,
    equal: JSON.stringify(prints[0]) === JSON.stringify(prints[1]),
    firstDifferences: prints[0].map((x, i) => JSON.stringify(x) === JSON.stringify(prints[1][i]) ? null : {before:x,after:prints[1][i]}).filter(Boolean).slice(0, 5) };
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
  for (const file of made) fs.rmSync(file, { force: true });
  fs.writeFileSync(path.join(ROOT, 'tests/results/review-alpha3-firefox-diagnostics.json'), JSON.stringify(out, null, 2) + '\n');
}
console.log(JSON.stringify(out));
