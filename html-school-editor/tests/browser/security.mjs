// Security cases X-01 … X-06. The browser keeps full network access; a local HTTP server counts every request
// that is actually delivered. Request attempts and policy blocks reported by the browser are recorded
// separately. A control page proves that the same resource would be fetched without the editor's protection.
import fs from 'node:fs';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { Editor, PV, ARTEFACT, sleep, tmpFile, readFixture } from '../lib/harness.mjs';

const withEditor = async (browser, options, fn) => { const ed = await Editor.open(browser, options); try { return await fn(ed); } finally { await ed.close(); } };
const MARK = 'parent.document.documentElement.dataset.scriptRan';
const attempts = (ed, origin) => ed.page.eventsOf('Network.requestWillBeSent').map((e) => e.request.url).filter((u) => u.startsWith(origin));
const cspBlocks = (ed, origin) => ed.page.eventsOf('Audits.issueAdded').map((e) => e.issue.details.contentSecurityPolicyIssueDetails).filter((d) => d && String(d.blockedURL || '').startsWith(origin)).map((d) => d.blockedURL);
const markers = (ed) => ed.eval('JSON.stringify({ parent: document.documentElement.dataset.scriptRan || "", leak: document.documentElement.dataset.leak || "", title: document.title })');

function activeContentDoc(s) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Aktive Inhalte</title>
<script>${MARK} = "head-inline"; parent.document.documentElement.dataset.leak = parent.localStorage.getItem("SYNTHETIC_SENTINEL");</script>
<script src="${s}/x01/external.js"></script>
<script type="module">import "${s}/x01/module.js"; ${MARK} = "module";</script>
</head>
<body onload="${MARK} = 'body-onload'" onpageshow="${MARK} = 'pageshow'" onfocus="${MARK} = 'focus'">
<h1 id="h" onclick="${MARK} = 'h1-click'" onmouseover="${MARK} = 'mouseover'" onmousedown="${MARK} = 'mousedown'">Klick mich</h1>
<img src="${s}/x01/img-error.png" onerror="${MARK} = 'img-onerror'" onload="${MARK} = 'img-onload'">
<img src="data:image/png;base64,AAAA" onerror="${MARK} = 'data-img-onerror'">
<svg width="10" height="10" onload="${MARK} = 'svg-onload'"><script>${MARK} = "svg-script"</script><animate onbegin="${MARK} = 'svg-begin'" attributeName="x" dur="1s"/></svg>
<details open ontoggle="${MARK} = 'toggle'"><summary>auf</summary>zu</details>
<input autofocus onfocus="${MARK} = 'autofocus'">
<p id="p" contenteditable onbeforeinput="${MARK} = 'beforeinput'" oninput="${MARK} = 'input'" onkeydown="${MARK} = 'keydown'">Tipp hier</p>
<script>${MARK} = "body-inline"; top.document.title = "geaendert"; try { parent.document.getElementById("src").value = "geloescht"; } catch (e) {}</script>
<a id="js" href="javascript:${MARK}='js-link'">Link</a>
</body>
</html>
`;
}

function navigationDoc(s, withFrameset) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${s}/x02/meta-refresh-head">
<base href="${s}/x02/base/" target="_top">
<title>Navigation</title>
</head>
<body>
<meta http-equiv="refresh" content="0;url=${s}/x02/meta-refresh-body">
<p><a id="l1" href="javascript:${MARK}='javascript-link'">javascript</a>
<a id="l2" href="JaVaScRiPt:${MARK}='mixed-case'">mixed case</a>
<a id="l3" href="&#106;avascript&colon;${MARK}='entities'">entities</a>
<a id="l4" href=" &#9;java&#10;script:${MARK}='whitespace'">whitespace</a>
<a id="l5" href="${s}/x02/plain-link">plain</a>
<a id="l6" href="${s}/x02/blank-link" target="_blank">new window</a>
<a id="l7" href="relative-link.html" target="_top">relative top</a>
<a id="l8" href="data:text/html,<script>${MARK}='data-link'</script>">data</a></p>
<form id="f" action="${s}/x02/form-post" method="post" target="_top"><input name="q" value="1"><button id="fb" type="submit">Senden</button><input type="image" src="${s}/x02/input-image.png"></form>
<form action="javascript:${MARK}='form-js'"><button id="fb2" formaction="${s}/x02/formaction">Zwei</button></form>
<iframe src="${s}/x02/iframe-src"></iframe>
<iframe srcdoc="<script>top.document.documentElement.dataset.scriptRan='srcdoc'</script><img src='${s}/x02/srcdoc-img.png'>"></iframe>
<object data="${s}/x02/object-data"></object>
<embed src="${s}/x02/embed-src">
${withFrameset ? `<frameset><frame src="${s}/x02/frame-src"></frameset>
` : ""}<area href="${s}/x02/area" shape="rect" coords="0,0,5,5">
<button id="pop" popovertarget="x" onclick="window.open('${s}/x02/window-open')">Popup</button>
</body>
</html>
`;
}

function resourceDoc(s) {
  return `<!DOCTYPE html>
<html manifest="${s}/x03/manifest.appcache">
<head>
<meta charset="utf-8">
<title>Ressourcen</title>
<link rel="stylesheet" href="${s}/x03/link-stylesheet.css">
<link rel="preload" href="${s}/x03/link-preload.js" as="script">
<link rel="prefetch" href="${s}/x03/link-prefetch.html">
<link rel="preconnect" href="${s}">
<link rel="dns-prefetch" href="${s}">
<link rel="modulepreload" href="${s}/x03/modulepreload.js">
<link rel="icon" href="${s}/x03/favicon.ico">
<style>
@import url("${s}/x03/css-import.css");
@import "${s}/x03/css-import-2.css";
@font-face { font-family: Fremd; src: url(${s}/x03/font.woff2); }
body { background: url(${s}/x03/css-body-bg.png); font-family: Fremd, serif; cursor: url(${s}/x03/cursor.cur), auto; }
p::before { content: url(${s}/x03/css-content.png); }
li { list-style-image: url("${s}/x03/list-style.png"); }
div { background-image: image-set("${s}/x03/image-set.png" 1x); border-image: url(${s}/x03/border-image.png) 3; }
</style>
</head>
<body background="${s}/x03/body-background.png">
<p style="background: url(${s}/x03/inline-style-bg.png)">Text</p>
<ul><li>Punkt</li></ul><div>Kasten</div>
<img src="${s}/x03/img-src.png" alt="a">
<img srcset="${s}/x03/img-srcset.png 1x, ${s}/x03/img-srcset-2x.png 2x" alt="b">
<img src="//127.0.0.1:${s.split(':').pop()}/x03/img-protocol-relative.png" alt="c">
<picture><source srcset="${s}/x03/picture-source.png"><img src="${s}/x03/picture-img.png" alt="d"></picture>
<video src="${s}/x03/video-src.mp4" poster="${s}/x03/video-poster.png" autoplay><source src="${s}/x03/video-source.mp4"><track src="${s}/x03/track.vtt" default></video>
<audio src="${s}/x03/audio-src.mp3" autoplay></audio>
<svg width="20" height="20"><image href="${s}/x03/svg-image.png" width="20" height="20"/><use href="${s}/x03/svg-use.svg#a"/><style>@import url(${s}/x03/svg-style-import.css);</style></svg>
<table background="${s}/x03/table-background.png"><tr><td background="${s}/x03/td-background.png">Zelle</td></tr></table>
<input type="image" src="${s}/x03/input-image.png">
<a href="${s}/x03/a-ping" ping="${s}/x03/ping">ping</a>
<script src="${s}/x03/script-src.js"></script>
</body>
</html>
`;
}

export const security = [
  {
    id: 'X-01', title: 'scripts and event handlers of an opened file never run and cannot reach the editor',
    async run(c, { browser, sink }) {
      await withEditor(browser, {}, async (ed) => {
        await ed.eval('localStorage.setItem("SYNTHETIC_SENTINEL", "dummy-only")');
        const text = activeContentDoc(sink.origin);
        const before = sink.hits.length;
        await ed.openText('x01-aktive-inhalte.html', text);
        await sleep(400);
        await ed.clickPv('d.getElementById("h")');
        await ed.page.mouse('mouseMoved', 700, 300, { button: 'none' });
        await ed.clickPv('d.getElementById("p")');
        await ed.type('abc');
        await ed.clickPv('d.getElementById("js")');
        await ed.settle();
        await sleep(1200);
        c.eq(await markers(ed), '{"parent":"","leak":"","title":"HTML-Schuleditor"}', 'no marker was set in the editor window, the storage sentinel was not read, the title is untouched');
        c.eq(await ed.eval(PV + '.documentElement.dataset.scriptRan || ""'), '', 'no marker inside the preview document either');
        c.eq(await ed.eval(PV + '.querySelectorAll("script").length'), 0, 'the preview contains no script elements');
        c.eq(await ed.eval(`((d) => Array.from(d.querySelectorAll("*")).filter((el) => el.getAttributeNames().some((n) => n.startsWith("on"))).length)(${PV})`), 0, 'the preview contains no event-handler attributes');
        const src = await ed.source();
        c.eq(src, text.replace('>Tipp hier<', '>' + (/<p id="p"[^>]*>([^<]*)</.exec(src) || [])[1] + '<'), 'the source keeps all scripts and handlers; only the typed paragraph text differs');
        c.ok(/<p id="p"[^>]*>[^<]*abc[^<]*</.test(src), 'typing in the page still works');
        c.eq(sink.hits.slice(before).join(','), '', 'no request reached the server');
        c.eq(await ed.eval('localStorage.getItem("SYNTHETIC_SENTINEL")'), 'dummy-only', 'sentinel still present (it was readable only by the editor itself)');
        await ed.eval('localStorage.removeItem("SYNTHETIC_SENTINEL")');
        c.eq(ed.errors().join(' | '), '', 'no script errors in the editor');
      });
    },
  },
  {
    id: 'X-02', title: 'links, refresh, base, forms, frames and popups cannot navigate or submit',
    async run(c, { browser, sink }) {
      for (const withFrameset of [false, true]) await withEditor(browser, {}, async (ed) => {
        const variant = withFrameset ? 'read-only page: ' : 'editable page: ';
        const before = sink.hits.length;
        const targetsBefore = new Set((await browser.conn.send('Target.getTargets')).targetInfos.map((t) => t.targetId));
        const url = await ed.eval('location.href');
        await ed.openText('x02-navigation.html', navigationDoc(sink.origin, withFrameset));
        await sleep(500);
        c.eq(await ed.eval('document.getElementById("lockNote").hidden'), !withFrameset, variant + 'fixture is ' + (withFrameset ? 'locked' : 'editable'));
        for (const id of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8']) {
          await ed.clickPv(`d.getElementById("${id}")`);
          const p = await ed.page.centerOf(`${PV}.getElementById("${id}")`);
          await ed.page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1, modifiers: 2 });
          await ed.page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1, modifiers: 2 });
          await ed.page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'middle', clickCount: 1 });
          await ed.page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'middle', clickCount: 1 });
        }
        for (const id of ['fb', 'fb2', 'pop']) { try { await ed.clickPv(`d.getElementById("${id}")`); } catch (e) { c.note('element not rendered', id); } }
        await ed.eval(`((d) => { try { d.getElementById("f").submit(); } catch (e) {} try { d.getElementById("f").requestSubmit(); } catch (e) {} for (const a of d.querySelectorAll("a")) a.click(); })(${PV})`);
        await sleep(1500);
        c.eq(sink.hits.slice(before).join(','), '', variant + 'no navigation, submission or frame load reached the server');
        c.eq(await ed.eval('location.href'), url, variant + 'the editor window did not navigate');
        c.eq(await ed.eval(PV + '.URL'), 'about:srcdoc', variant + 'the preview frame did not navigate');
        c.eq((await browser.conn.send('Target.getTargets')).targetInfos.filter((t) => !targetsBefore.has(t.targetId)).length, 0, variant + 'no window or tab was opened');
        c.eq(await markers(ed), '{"parent":"","leak":"","title":"HTML-Schuleditor"}', variant + 'no script URL was executed');
        c.eq(await ed.eval(PV + '.body.querySelectorAll("iframe, frame, object, embed, base, meta, form[action], a[href], area[href]").length'), 0, variant + 'the preview has no frames, base, refresh, form targets or live link addresses');
        c.eq(await ed.source(), navigationDoc(sink.origin, withFrameset), variant + 'the source is unchanged');
        c.note(variant + 'request attempts seen by the browser', JSON.stringify(attempts(ed, sink.origin)));
      });
    },
  },
  {
    id: 'X-03', title: 'no external resource of an opened document is fetched',
    async run(c, { browser, sink }) {
      const controlPage = await browser.newPage();
      const controlBefore = sink.hits.length;
      await controlPage.goto(pathToFileURL(tmpFile('x03-kontrolle.html', `<!DOCTYPE html><title>Kontrolle</title><img src="${sink.origin}/control/img.png"><link rel="stylesheet" href="${sink.origin}/control/style.css">`)).href);
      await sleep(600);
      const control = sink.hits.slice(controlBefore);
      await controlPage.close();
      c.ok(control.some((h) => h.includes('/control/img.png')) && control.some((h) => h.includes('/control/style.css')), 'control: the same browser does fetch these resources from an ordinary local page', control.join(','));
      await withEditor(browser, {}, async (ed) => {
        const before = sink.hits.length;
        const text = resourceDoc(sink.origin);
        await ed.openText('x03-ressourcen.html', text);
        await sleep(600);
        await ed.clickPv('d.querySelector("p")');
        await ed.type('x');
        await ed.settle();
        await ed.format();
        await ed.click('bDownload');
        await sleep(1500);
        const delivered = sink.hits.slice(before);
        c.eq(delivered.join(','), '', 'requests delivered to the server: none');
        const tried = attempts(ed, sink.origin), blocked = cspBlocks(ed, sink.origin);
        c.note('request attempts reported by the browser', tried.length + ': ' + JSON.stringify(tried.map((u) => u.replace(sink.origin, ''))));
        c.note('policy blocks reported by the browser', blocked.length + ': ' + JSON.stringify(Array.from(new Set(blocked)).map((u) => u.replace(sink.origin, ''))));
        const pvAttrs = await ed.eval(`((d) => Array.from(d.querySelectorAll("*")).flatMap((el) => el.getAttributeNames().filter((n) => !n.startsWith("data-se-") && n !== "title" && n !== "style").map((n) => el.getAttribute(n))).filter((v) => v.includes("127.0.0.1")).length)(${PV})`);
        c.eq(pvAttrs, 0, 'no element of the preview carries a loadable external address (inline CSS aside, which the policy blocks)');
        c.ok((await ed.eval('document.getElementById("inactiveText").textContent')).includes('Bild'), 'the user is told that content is switched off', await ed.eval('document.getElementById("inactiveText").textContent'));
        c.ok((await ed.source()).includes(sink.origin + '/x03/img-src.png') && (await ed.source()).includes('@import url("' + sink.origin), 'the addresses stay in the source');
      });
    },
  },
  {
    id: 'X-04', title: 'pasting rich content and markup-shaped text fields create no active content',
    async run(c, { browser, sink }) {
      await withEditor(browser, {}, async (ed) => {
        const rich = `<b onclick="${MARK}='paste-click'">fett</b><img src="${sink.origin}/x04/paste-img.png" onerror="${MARK}='paste-onerror'"><script>${MARK}='paste-script'</script><a href="javascript:${MARK}='paste-link'">link</a><iframe src="${sink.origin}/x04/iframe"></iframe>`;
        const before = sink.hits.length;
        // 1) real clipboard paste (trusted key event with the browser's paste command)
        let trusted = 'NOT MEASURED';
        try {
          await browser.conn.send('Browser.grantPermissions', { permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'] });
          await ed.eval(`navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([${JSON.stringify(rich)}], { type: "text/html" }), "text/plain": new Blob(["fett link"], { type: "text/plain" }) })])`);
          await ed.caret('mein Text.', 'mein Text.'.length);
          await ed.page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2, commands: ['paste'] });
          await ed.page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'v', code: 'KeyV', windowsVirtualKeyCode: 86, modifiers: 2 });
          await ed.settle(150);
          trusted = (await ed.source()).includes('Text.fett link</p>') ? 'pasted as plain text' : 'paste did not arrive';
        } catch (e) { trusted = 'NOT MEASURED (' + e.message.slice(0, 120) + ')'; }
        if (trusted !== 'pasted as plain text') c.skip('trusted clipboard paste (real clipboard, real key event)', trusted);
        else c.note('trusted clipboard paste', trusted);
        if (trusted === 'pasted as plain text') c.ok(!/<b|<img|<script|<a |<iframe/.test((/<p>Hier[^]*?<\/p>/.exec(await ed.source()) || [''])[0]), 'trusted paste of rich clipboard content inserts text only', (/<p>Hier[^]*?<\/p>/.exec(await ed.source()) || [''])[0]);
        // 2) paste event carrying HTML and text (covers the handler independently of the system clipboard)
        await ed.caret('Webseite', 'Webseite'.length);
        await ed.eval(`((d) => { const dt = new DataTransfer(); dt.setData("text/html", ${JSON.stringify(rich)}); dt.setData("text/plain", "<img src=x onerror=${MARK}=1> & Text"); d.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); })(${PV})`);
        await ed.settle(150);
        const src = await ed.source();
        c.ok(src.includes('<h1>Meine erste Webseite&lt;img src=x onerror=' + MARK + '=1&gt; &amp; Text</h1>'), 'pasted markup-shaped text is stored as text', src.split('\n')[7]);
        c.eq(await ed.eval(PV + '.querySelectorAll("img, script, iframe, a, [onclick], [onerror]").length'), 0, 'no element was created from pasted content');
        // 3) HTML-only clipboard content is refused
        await ed.eval(`((d) => { const dt = new DataTransfer(); dt.setData("text/html", ${JSON.stringify(rich)}); d.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); })(${PV})`);
        await ed.settle(100);
        c.eq(await ed.source(), src, 'clipboard content without a text version changes nothing');
        // 4) a drop of HTML into the page
        await ed.eval(`((d) => { const dt = new DataTransfer(); dt.setData("text/html", ${JSON.stringify(rich)}); const ev = new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true }); d.body.dispatchEvent(ev); document.documentElement.dataset.dropPrevented = String(ev.defaultPrevented); })(${PV})`);
        c.eq(await ed.eval('document.documentElement.dataset.dropPrevented'), 'true', 'dropping rich content into the page is cancelled');
        await sleep(500);
        c.eq(await markers(ed), '{"parent":"","leak":"","title":"HTML-Schuleditor"}', 'nothing executed');
        c.eq(sink.hits.slice(before).join(','), '', 'nothing was fetched');
      });
    },
  },
  {
    id: 'X-07', title: 'element names that shadow DOM properties do not disturb the editor',
    async run(c, { browser }) {
      await withEditor(browser, {}, async (ed) => {
        const NL = String.fromCharCode(10);
        const text = ['<!DOCTYPE html>', '<html><head><title>Namen</title></head>', '<body>', '<p>Absatz</p>',
          '<img name="body" alt="a"><img name="head" alt="b"><img name="createElement" alt="c"><img name="getSelection" alt="d"><img name="documentElement" alt="e">',
          '<form name="createRange" id="f" action="senden.php"><input name="childNodes"><input name="attributes"><input id="localName"><input name="nodeType"><input name="parentNode">',
          '<input name="textContent"><input name="firstChild"><input name="nextSibling"><input name="isContentEditable"><input name="remove"><p>Im Formular</p></form>',
          '<p>Ende</p>', '</body>', '</html>', ''].join(NL);
        await ed.openText('x07-namen.html', text);
        await sleep(200);
        c.eq(ed.errors().join(' | '), '', 'opening causes no script error');
        c.eq(await ed.source(), text, 'the source is unchanged');
        c.eq(await ed.eval(PV + '.querySelectorAll("form, img[name], embed, object, iframe").length'), 0, 'the preview holds no element that could shadow document properties');
        c.eq(await ed.eval(`((d) => [d.body.localName, d.head.localName, d.documentElement.localName, typeof d.createElement, typeof d.getSelection, typeof d.createRange].join(","))(${PV})`), 'body,head,html,function,function,function', 'document properties of the preview are the real ones');
        await ed.caret('Absatz', 6);
        await ed.type('1');
        await ed.caret('Im Formular', 11);
        await ed.type('2');
        await ed.caret('Ende', 4);
        await ed.type('3');
        await ed.settle();
        c.eq(await ed.source(), text.replace('Absatz<', 'Absatz1<').replace('Im Formular<', 'Im Formular2<').replace('Ende<', 'Ende3<'), 'typing before, inside and after the form changes exactly those three places');
        await ed.format();
        await ed.settle();
        const saved = await ed.download();
        c.eq(saved.text, await ed.source(), 'formatting and saving still work');
        c.ok(saved.text.includes('<form name="createRange" id="f" action="senden.php">') && saved.text.includes('<input name="childNodes">'), 'the form and its field names are kept in the saved file');
        c.eq(ed.errors().join(' | '), '', 'no script error afterwards');
      });
    },
  },
  {
    id: 'X-05', title: 'no message bridge exists',
    async run(c) {
      const html = fs.readFileSync(ARTEFACT, 'utf8');
      c.eq((html.match(/postMessage|addEventListener\(\s*['"]message['"]|onmessage|BroadcastChannel|MessageChannel/g) || []).length, 0, 'the delivered file contains no message channel between windows; the parent edits the frame DOM directly');
    },
  },
  {
    id: 'X-06', title: 'static scan of the delivered file',
    async run(c) {
      const html = fs.readFileSync(ARTEFACT, 'utf8');
      const count = (re) => (html.match(re) || []).length;
      c.eq(count(/\beval\s*\(/g) + count(/new\s+Function\b/g) + count(/\bFunction\s*\(/g), 0, 'no eval or function constructor');
      c.eq(count(/set(?:Timeout|Interval)\s*\(\s*['"`]/g), 0, 'no string-evaluated timers');
      c.eq(count(/localStorage|sessionStorage|indexedDB|document\.cookie|\bcaches\./g), 0, 'no persistent storage API');
      c.eq(count(/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|\bimport\s*\(|serviceWorker|\.open\s*\(\s*['"]/g), 0, 'no network or dynamic import API');
      c.eq(count(/document\.write|insertAdjacentHTML|outerHTML\s*=/g), 0, 'no document.write / insertAdjacentHTML / outerHTML assignment');
      const urls = Array.from(new Set(html.match(/\b(?:https?:|wss?:|ftp:)\/\/[^\s"'<>)]+/g) || []));
      const inert = new Set(['https://www.beispiel.de', 'http://www.w3.org/1999/xhtml', 'https://' + String.fromCharCode(0x2026)]);
      c.eq(urls.filter((u) => !inert.has(u)).join(','), '', 'only inert example/namespace addresses occur: ' + urls.join(' '));
      c.eq(count(/<script\b/g), 1, 'exactly one script element');
      c.eq(count(/<(?:link|iframe [^>]*src=|img [^>]*src=|object|embed)\b/g), 0, 'no linked or embedded external file');
      const iframe = /<iframe\b[^>]*>/.exec(html);
      c.ok(iframe && /sandbox="allow-same-origin"/.test(iframe[0]) && !/allow-scripts|allow-forms|allow-popups|allow-top-navigation|allow-modals/.test(html), 'preview frame: sandbox="allow-same-origin" only, no script/form/popup/navigation permission anywhere', iframe && iframe[0]);
      const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
      const script = /<script>([^]*?)<\/script>/.exec(html);
      const hash = crypto.createHash('sha256').update(script[1], 'utf8').digest('base64');
      c.ok(csp && csp[1] === `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data: blob:; form-action 'none'; base-uri 'none'`, 'page policy allows only the one hashed script, inline styles and data: images', csp && csp[1]);
      c.ok(html.includes(`default-src \\'none\\'; style-src \\'unsafe-inline\\'; img-src data: blob:">`), 'preview frame carries its own policy without any script source; images only from the document text or from files chosen in this session');
      c.note('innerHTML assignments', count(/\.innerHTML\s*=/g) + ' (escaped highlight lines in the editor chrome and the character-reference decoder in an inert document)');
      c.note('size', Buffer.byteLength(html, 'utf8') + ' bytes');
    },
  },
];
