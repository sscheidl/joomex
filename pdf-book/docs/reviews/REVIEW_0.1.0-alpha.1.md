# Independent review: PDF Book 0.1.0-alpha.1 (re-measured on 0.1.0-alpha.2)

Reviewer: Claude (Opus 5.5) in Claude Code. Review: 2026-11-11. Re-measurement on the public package: 2026-11-12. The reviewed package was not changed during the review.

**Naming note.** 0.1.0-alpha.1 was built under an earlier working name and was not published. 0.1.0-alpha.2 is the same code with neutral identifiers, a neutral third-party notice and neutral demo/test texts ([STATUS.md](../STATUS.md)). This document uses the current identifiers (`mod_pdfbook`, `Joomex\Module\Pdfbook`, CSS prefix `pdfbook`, `data-pdfbook`). Line numbers are identical in both versions; the renaming script checked that every rewritten file kept its line count.

## 1. Verdict

**BLOCKED for now: no limited staging test with this package yet.**

Reasons:

1. **The first acceptance gate, installation in Joomla 6, was not run.** The review machine had no Joomla-capable infrastructure: no database, no Docker CLI, no WSL distribution, and Joomla 6 does not support SQLite. Joomla and a database were not downloaded without asking. Installation, update and uninstallation are therefore **NOT RUN**.
2. **One finding affects exactly this gate (F1, P1).** Traced against the Joomla 6.2.0 source, the Web Asset Manager renders the module's stylesheet wrongly. In a subdirectory installation it is dropped. In a root installation it becomes `href="//media/mod_pdfbook/css/viewer.css…"`, a protocol-relative URL to a foreign host called `media`. The first display would be unstyled. This is not measured in a running Joomla, but the code paths are unambiguous (section 3, F1).

Within the tested scope, **no exploitable vulnerability was found**. Path validation, HTML/DOM output, PDF actions, network behaviour and CSP held up (test matrix). This is not a statement that the extension is "secure": tests used synthetic PDFs, one browser engine and no real Joomla.

**Way to a staging test:** fix F1 in a new version, then pass the installation gate on a local Joomla 6 (section 6, task C1). F2 and F3 should be fixed first as well; they are not security blockers. After that, a limited staging test looks reasonable.

## 2. Reviewed state

| Item | Value |
| --- | --- |
| Reviewed package | 0.1.0-alpha.1, 218 entries, SHA-256 `82d1c25e6aab82afc6475a315cdfaba63b3f6053544189155f7d477319fc94cd` (not published) |
| Public package | `mod_pdfbook-0.1.0-alpha.2.zip`, 218 entries, SHA-256 `31fe7a25711beca38294ac16bc1601e7c2698a7949e9eeb8a7d316903d8ed88c`. **MEASURED** 2026-11-12: two builds gave identical bytes |
| Package ↔ sources | **MEASURED**: all 12 own files byte-identical with the source tree; all 206 PDF.js files match `dependencies.json` |
| ZIP structure | **MEASURED** before extraction: no absolute paths, no `..`, no backslashes or drive letters, mode 0644, no symlinks; no legacy-product files, no PDFs, tools or credentials |
| PDF.js provenance | **MEASURED** 2026-11-11: GitHub release v6.5.438 is marked "Latest", commit `0a41533` = `pdfjsBuild 0a4153349` in the shipped files. GitHub's published digest for `pdfjs-6.5.438-dist.zip` equals `dependencies.json`. Per-file comparison against the original archive: **NOT RUN** (archive not available locally) |
| Operating system | Windows 11 Pro 10.0.26300 |
| Joomla / database | **NOT RUN**: no test installation available |
| Backward-compatibility plugin | Not applicable, because no Joomla ran |
| PHP | 8.4.27 NTS x64 (portable). Standalone tests plus runs of the real `Dispatcher.php` and `tmpl/default.php` against minimal Joomla stubs |
| Browser | Microsoft Edge 157.0.4341.46 headless via Playwright 1.65.0. Firefox is installed but cannot be driven by Playwright: **NOT RUN** |
| Node / Python | Node v24.22.1, Python 3.12, pypdf 6.9.2 (synthetic fixtures) |

## 3. Findings by severity

Status terms: **MEASURED** = reproduced by the reviewer (alpha.1 on 2026-11-11, alpha.2 on 2026-11-12). **CODE TRACE** = derived from source, not measured in a running environment. **PLAUSIBLE** = reasoned assumption.

### P0

None.

### P1

#### F1: stylesheet URL resolved wrongly by the Web Asset Manager

Status: **CODE TRACE** against Joomla 6.2.0 source. **NOT MEASURED** in a running Joomla.

- **Location:** `module/src/Dispatcher/Dispatcher.php:33-34`. The code calls `registerAndUseStyle('mod_pdfbook.viewer', Uri::root(true) . '/media/mod_pdfbook/css/viewer.css', …)`.
- **Data flow (Joomla 6.2.0):**
  1. `WebAssetItem::getUri()` passes `.css` to `resolvePath()`.
  2. There, `relative = !isPathAbsolute($path)`, with `isPathAbsolute = str_contains($path,'/') && is_file(JPATH_ROOT . '/' . $path)`.
  3. Then `HTMLHelper::mediaPath()` → `includeRelativeFiles()`.
- **Root installation** (`Uri::root(true) === ''`):
  1. `is_file(JPATH_ROOT.'//media/…')` is true, so the non-relative branch runs.
  2. It builds `$path = JPATH_PUBLIC . '/' . '/media/…'`.
  3. `convertToRelativePath()` strips `JPATH_PUBLIC` and returns `//media/mod_pdfbook/css/viewer.css`.
  4. `StylesRenderer` appends the version.
  5. The browser resolves this as `https://media/mod_pdfbook/css/viewer.css`.
  6. Result: no stylesheet, plus a DNS/HTTP request to a foreign host `media`.
- **Subdirectory installation** (`/sub`):
  1. `is_file(JPATH_ROOT.'//sub/media/…')` is false, so the relative branch runs.
  2. `strpos($file,'/')` is `0` for the leading slash, so it counts as false. The lookup falls back to `media/system/css//sub/…` and finds nothing.
  3. `mediaPath()` returns `''`.
  4. `StylesRenderer::renderElement()` skips entries without `src`. Result: the stylesheet is silently missing.
- **Script:** not affected. `.mjs` takes the `default` branch in `getUri()` and is output unchanged.
- **Impact:** the viewer loads without CSS: full-size canvas, unstyled toolbar, misplaced overlay. Root installations also make an unwanted request to a foreign host; an active CSP with `style-src 'self'` blocks it.
- **Preconditions:** every installation, regardless of rights.
- **Why the browser tests do not show this:** the Joomla stubs (`tests/review/render_pages.php`) output the URL unchanged and do not emulate Web Asset Manager resolution.
- **Fix:** register the stylesheet relative to the media folder. Joomla then takes the `media/$extension/$folder/$file` branch, which also allows template overrides:

```diff
-            $prefix = Uri::root(true) . '/media/mod_pdfbook/';
-            $wa->registerAndUseStyle('mod_pdfbook.viewer', $prefix . 'css/viewer.css', ['version' => '0.1.0-alpha.2']);
-            $wa->registerAndUseScript('mod_pdfbook.viewer', $prefix . 'js/viewer.mjs', ['version' => '0.1.0-alpha.2'], ['type' => 'module']);
+            $wa->registerAndUseStyle('mod_pdfbook.viewer', 'mod_pdfbook/viewer.css', ['version' => 'auto']);
+            // Joomla does not resolve .mjs: a root-relative path stays correct, also in a subdirectory
+            $wa->registerAndUseScript('mod_pdfbook.viewer', Uri::root(true) . '/media/mod_pdfbook/js/viewer.mjs', ['version' => '0.1.0-alpha.3'], ['type' => 'module']);
```

  A `media/mod_pdfbook/joomla.asset.json` with `useStyle()`/`useScript()` is cleaner in the long run. Acceptance: see C1.

### P2

#### F2: input and resizes during `busy` are lost

Status: **MEASURED** (alpha.1 and alpha.2).

- **Location:** `media/js/viewer.mjs:56` (`if(this.disposed||!this.pdf.doc||this.busy)return;`), together with `:44` (ResizeObserver), `:117` (move) and `:118` (setZoom).
- **Reproduction:**
  - 8-page inline book, two quick clicks on "Nächste Seite": result page 2, expected page 4.
  - ArrowRight twice within 50 ms from page 2: result page 4, expected page 6.
  - Shrinking the window from 1280 to 520 px during the page-turn animation leaves a **724 px double spread in a 486 px stage** for good. The same resize while idle correctly switches to a 362 px single page.
- **Impact:** wrong layout after rotating a device, entering fullscreen or resizing during an animation. Also swallowed clicks in thumbnails, bookmarks and internal links, whose buttons are not disabled during `busy`. The state persists until the next interaction.
- **Fix:** remember the most recent request instead of dropping it:

```diff
   async go(number, animate=true){
-    if(this.disposed||!this.pdf.doc||this.busy)return;
+    if(this.disposed||!this.pdf.doc||this.el.dataset.state==='error')return;
+    if(this.busy){this.pending={number,animate:false};return;}
 …
-    finally{this.busy=false;this.el.removeAttribute('aria-busy');if(!this.disposed)this.updateControls();}
+    finally{this.busy=false;this.el.removeAttribute('aria-busy');if(!this.disposed)this.updateControls();
+      const next=this.pending;this.pending=null;if(next&&!this.disposed)this.go(next.number,next.animate);}
   }
-  move(delta){return this.go(nextPage(this.page,this.pdf.count,this.single,delta));}
+  move(delta){return this.go(nextPage(this.pending?.number??this.page,this.pdf.count,this.single,delta));}
```

  The same applies to `setZoom()`, so that zoom during `busy` is not dropped either.

#### F3: the "more than 1000 pages" error is overwritten after a resize

Status: **MEASURED** (alpha.1 and alpha.2).

- **Location:** `media/js/pdf.mjs:35-37`. `this.doc` is set before the page-limit check, `this.count` afterwards is not. `media/js/viewer.mjs:44` and `:56` only test `this.pdf.doc`.
- **Reproduction:**
  1. Open a synthetic 1001-page PDF. The message "Das PDF enthält mehr als 1000 Seiten." appears (correct).
  2. Resize the window.
  3. Afterwards: status "Seiten ", `data-state="ready"`, two blank pages, **all toolbar buttons enabled**, empty page input.
- **Impact:** the error message disappears and an apparently working, empty viewer is shown. This is not a security problem: the document is already released and nothing is rendered.
- **Fix:** in `pdf.mjs`, check `const doc = await this.loading.promise` first; if the limit is exceeded, call `await this.loading.destroy()` and throw. Only then set `this.doc`/`this.count`. Also block the error state in `go()` (see the diff for F2).

#### F4: a fixed 30-second total timeout rules out slow but legitimate downloads

Status: **MEASURED** (alpha.1 and alpha.2).

- **Location:** `media/js/pdf.mjs:11`. The timer covers download and parsing.
- **Reproduction:** a server that delivers a valid PDF over about 45 s ends after exactly 30.0 s with the status **"signal is aborted without reason"**. A hanging response behaves the same way.
- **Impact:** the allowed 32 MB need at least about 8.9 Mbit/s. On mobile networks or busy Wi-Fi, large brochures fail reproducibly, with an English technical message.
- **Fix:**
  - Separate timeouts: response headers (for example 20 s), stream inactivity (for example 20 s without new bytes) and parsing (for example 30 s).
  - Progress display in `this.status`.
  - Own message in the interface language with a link to open the PDF directly.

### P3

#### F5: raw English library and browser messages shown to end users

Status: **MEASURED**.

- **Location:** `viewer.mjs:53` (`error.message`).
- **Measured messages:** "Failed to fetch" (redirect), "Invalid PDF structure." (truncated PDF or wrong header), "signal is aborted without reason" (timeout).
- **Fix:** map errors to fixed interface texts (`InvalidPDFException`, `AbortError`, `TypeError` from `fetch`) and log details only via `console.error`.

#### F6: cache busting only for `viewer.mjs`

Status: **CODE TRACE**.

- **Location:** `Dispatcher.php:35`; `viewer.mjs:1-3` and `pdf.mjs:1`.
- **Problem:** only the entry point gets a version parameter. `model.mjs`, `pdf.mjs`, `turn.mjs` and PDF.js are imported without one. After an update the browser can mix new and cached old code.
- **Fix:** versioned folders, an import map with versions, or a single bundled file.

#### F7: a dead security switch and unnecessary files in the package

Status: **MEASURED** by source search in the shipped PDF.js.

- **Dead switch:** `pdf.mjs:33` sets `isEvalSupported: false`. The option no longer exists in PDF.js 6.5.438: zero hits in `pdf.mjs` and `pdf.worker.mjs`.
  - There is also no `eval` or `new Function` path left. So this is harmless.
  - Documentation must not list the option as an effective measure.
- **Unused files:**
  - `vendor/pdfjs/build/pdf.renderer.mjs` (246 KB) is not imported anywhere.
  - `web/wasm/quickjs-eval.{js,wasm}` is the scripting sandbox. It is never loaded when the API is used without the scripting manager.
  - Both are public under `/media/…` after installation. No risk with the current code, but unnecessary attack surface.
- **Fix:** switch `scripts/build.py` to an allowlist and justify the exclusions in `dependencies.json`.

#### F8: absolute base URL `Uri::root()` in the data attribute

Status: **PLAUSIBLE**.

- **Location:** `Dispatcher.php:22`.
- **Problem:** behind a TLS-terminating proxy without `$live_site` or `behind_loadbalancer`, `Uri::root()` returns `http://…`.
  - `fetch` with `redirect:'error'` on an HTTPS page then fails as mixed content or "Failed to fetch".
  - The value also depends on the `Host` header. This does not cause XSS, because the value is escaped, but page caching could store a wrong origin.
- **Fix:** pass `Uri::root(true) . '/'` and resolve it against `location.origin` in JavaScript.

#### F9: source is a free-text field; typical legacy paths do not fit directly

Status: **MEASURED** for the path rule.

- **Location:** `mod_pdfbook.xml:13`; `Source.php:11` and `:17`.
- **Problem:** the observed legacy configuration uses root-relative paths with a leading slash (`/images/…`). `Source::resolve` rejects `/images/…` and any space (also as `%20`).
  - For a migration this is impractical, but not unsafe.
  - There is no media picker.
- **Fix:**
  - Strip a leading `/` before `images/` on the server.
  - Allow spaces once they are encoded with `rawurlencode` as before.
  - Offer a media field and strip Joomla media suffixes (`…#joomlaImage://…`) explicitly.

#### F10: the dialog height ignores a wrapping toolbar

Status: **MEASURED**.

- **Location:** `viewer.mjs:169` (`innerHeight-180`).
- **Measurement:**
  - At 320×640: dialog content 713 px for a 638 px dialog.
  - At 640×450 with DPR 2 (about 200 % zoom): 527 px for 456 px.
  - The toolbar lies partly outside and has to be scrolled inside the dialog.
- **Fix:** build the dialog as a flex column and size the book via CSS (`flex:1`, `min-height:0`) instead of a fixed subtraction.

#### F11: the mode switch leaves "automatic" for good

Status: **MEASURED**.

- **Location:** `viewer.mjs:33`.
- **Problem:** after one toggle the book stays fixed on single or double pages, even after later resizes. A double spread forced at 500 px stays.
- **Fix:** cycle through three states (auto/single/double), or reset the override on resize.

#### F12: status text "Seiten 1" for a single page in double mode

Status: **MEASURED**.

- **Location:** `viewer.mjs:77`.
- **Problem:** measured "Seiten 1" and "Seiten 6" (plural for a single page). Cosmetic, but confusing for screen readers.

#### F13: a zoomed page cannot be panned horizontally on touch devices

Status: **PLAUSIBLE**.

- **Location:** `viewer.css:4` (`touch-action:pan-y`); `viewer.mjs:40-41`.
- **Problem:** from 125 % zoom the stage scrolls horizontally (measured with a mouse). On touch, a horizontal gesture is taken as a page turn instead. Not tested on a real touch device.
- **Fix:** with `zoom>1`, set `touch-action:pan-x pan-y` and only trigger the swipe when `scrollLeft` is at the edge.

#### F14: oversized images are removed without notice

Status: **MEASURED**.

- **Location:** `pdf.mjs:32`.
- **Problem:** a 25-megapixel image is dropped with the PDF.js warning "Image exceeded maximum allowed size and was removed.". The page shows without the image and without any notice to visitors.
- **Fix:** detect the PDF.js warning and show a short notice with an "open PDF" link, or document the limit deliberately.

#### F15: configuration errors are visible to every visitor

Status: **CODE TRACE**.

- **Location:** `tmpl/default.php:5-6`.
- **Problem:** a missing or wrong PDF shows guests the message "PDF ist nicht verfügbar oder liegt außerhalb des Medienverzeichnisses.". No path is disclosed, but editorial mistakes become public.
- **Fix:** show nothing (or only the title) to guests; show the detail message only to users with `core.edit` on the module.

#### F16: CSP and WASM documentation

Status: **MEASURED**.

- **Stricter CSP possible:**
  - Two modules work in Edge with `style-src 'self'` **without** `unsafe-inline`, page turning included, with no CSP violation. Inline styles are set only through the CSSOM.
  - `script-src 'nonce-…' 'strict-dynamic'` also works, including module imports and the worker.
  - Not checked in Firefox or Safari.
- **WASM trade-off:** `useWasm:false` avoids `wasm-unsafe-eval` but also disables ICC colour management (qcms). JPX/JBIG2 use slower JavaScript fallbacks. This trade-off should be documented.

### Checked without findings

These areas were checked and produced no findings:

- Traversal, encoding, UNC, ADS and junctions in `Source::resolve`/`safePdfUrl`.
- Output encoding in `default.php`.
- PDF actions and XFA.
- Bookmark and link titles.
- Release of worker and canvas resources after closing the dialog.
- WebGL failure.
- Reduced motion.
- Autoplay end and behaviour in a hidden tab.

Details are in the test matrix.

## 4. Test matrix

Tests: `tests/review/` (fixtures, Joomla stubs, loopback server, Playwright suite) plus the project's own tests. Results of the 2026-11-12 run on alpha.2: [evidence-0.1.0-alpha.2/results.json](evidence-0.1.0-alpha.2/results.json). All test data are synthetic PDFs from `tests/review/make_review_fixtures.py` and `scripts/make_fixtures.py`.

**Browser test setup:**

- A loopback server (`tests/review/review_server.py`, 127.0.0.1:8766) emulates a Joomla subdirectory installation: `/sub/media/mod_pdfbook/` and `/sub/images/`.
- The HTML pages were generated with the **real** `Dispatcher.php` and `tmpl/default.php` against minimal Joomla stubs (`tests/review/render_pages.php`).
- CSP as in `scripts/serve.py`, no bypass.

### Installation (Joomla 6)

| Test | Result |
| --- | --- |
| Installation via the Joomla installer; manifest/namespace/provider/dispatcher/layout/media | **NOT RUN**: no infrastructure |
| Backward-compatibility plugin disabled | **NOT RUN** |
| Create module, inline/dialog, position/menu assignment | **NOT RUN** |
| Two modules on one page, duplicate WAM registration | **CODE TRACE** (Joomla 6.2.0): `WebAssetRegistry::add()` overwrites silently; `useAsset()` returns early for an active asset, so only one tag is rendered. The same name for style and script is fine, because types are separate. With stubs: **PASS** |
| Subdirectory + SEF: paths for PDF, worker, CMaps and fonts | With stubs under `/sub/`: **PASS**. Exception: stylesheet **FAIL by CODE TRACE (F1)**. SEF: **NOT RUN** |
| Reinstall, update, uninstall | **NOT RUN**. Code reading: `method="upgrade"`, no install scripts, no update servers, media target `media/mod_pdfbook`. An uninstall should not touch `images/`; not measured |
| Joomla error/deprecation logs | **NOT RUN** |
| Target server MIME types for `.mjs`, `.wasm`, `.bcmap`, `.pfb`, `.icc` | **NOT RUN**. Joomla's `htaccess.txt` and `web.config.txt` (6.2.0) define none of these types, and set `nosniff`. The server must deliver `.mjs` as JavaScript, otherwise nothing loads |

### Security

| Test | Result |
| --- | --- |
| Project PHP tests `tests/source.php` | **PASS** (15 checks; alpha.1 and alpha.2) |
| `php -l` for all module files | **PASS** (alpha.1 and alpha.2) |
| Own path vectors for `Source::resolve`: 41 inputs (`tests/review/source_ext.php`) | **PASS** (alpha.1). Rejected: `..`, `%2e%2e`, `%252e`, `%2f` traversal, `/images/`, `\`, `%5c`, `%00`, `%23`, `%3F`, trailing dot, `::$DATA`, UNC, 8.3 names, overlong UTF-8, `Images/`, directories, a junction pointing outside, header only after 1024 bytes, 33 MB. Accepted: umlauts, `+&'`, `.PDF`, `images//`. `Source.php` differs between alpha.1 and alpha.2 only in its namespace line |
| Symlink to a file | **NOT RUN**: missing Windows privilege. The directory junction was rejected correctly |
| Own JS vectors for `safePdfUrl`/`safeLink` (`tests/review/js_ext.mjs`) | **PASS**. Rejected: foreign origins, other schemes, credentials, query/fragment, `IMAGES/`, `imagesX/`, `;` parameters. Encodings are consistent with PHP |
| Template output with `"><img onerror>`, `</script>`, `<b>` in titles | **PASS**: escaped in HTML, no elements in the DOM, no code executed |
| PDF bookmarks with HTML/script payloads, RLO character, info title | **PASS**: text only, no execution, list capped at 300 entries |
| PDF actions: OpenAction JS, page AA, JS link, Launch, SubmitForm, GoToR, `javascript:`/`data:` URI, field AA, XFA, document JS | **PASS**: no flag set, no dialog, no popup, no request to the attacker host. Only the https link creates `<a rel="noopener noreferrer" target="_blank">` with a correctly encoded URL. Internal targets: explicit → page 3, named → page 3 |
| Network: local resources only | **PASS**: all requests under `/sub/`. Loaded: `pdf.mjs`, `pdf.worker.mjs`, CMaps on demand, the PDF. No CDN, no tracking |
| Redirect | **PASS** (rejected by `redirect:'error'`), but the message is English (F5) |
| HTTP 500 | **PASS**: own error message |
| PDF served as `Content-Type: text/html` | Loads (bytes are parsed as PDF via fetch). No execution risk; noted only |
| 33 MB with and without `Content-Length` | **PASS**: aborted with the size message |
| CSP as in the preview server | **PASS**: no violations |
| CSP `style-src 'self'` (no unsafe-inline) | **PASS** in Edge (F16) |
| CSP with nonce + `strict-dynamic` | **PASS** |
| PDF.js advisories (as of 2026-11-11) | **PASS**. Only GHSA-wgrm-67xf-hhpq (≤ 4.1.392) and GHSA-hq66-cqwq-w95j / CVE-2026-16633 (5.6.83 to < 6.2.108) are known. Neither affects 6.5.438; scripting is not active here anyway |
| Licences and notices | PDF.js `LICENSE` and the licence files for the font/ICC/WASM components are included; `THIRD-PARTY-NOTICES.md` is present. No legal review |
| Rights guest/author/editor/admin | **NOT RUN** (no Joomla). Code reading: only Joomla's standard access checks, no own endpoints. Whoever may edit the `pdf` field can only point it to PDFs under `images/` |

### Function

| Test | Result |
| --- | --- |
| Project Node tests `tests/model.test.mjs` | **PASS** (4/4; alpha.1 and alpha.2) |
| Project browser smoke test `tests/browser_smoke.py` | **PASS** (alpha.1 and alpha.2) |
| Two inline modules (LTR/WebGL/auto and RTL/double/flat without download) + cover dialog on one page | **PASS** |
| 1, 2, 4, 5, 8 and 1000 pages; bounds; keyboard LTR/RTL; page input 999 → 8; swipe | **PASS** |
| Fast input during animation | **FAIL** (F2) |
| Resize during animation | **FAIL** (F2) |
| Zoom 250 % reachable by scrolling (mouse) | **PASS** |
| Zoom by touch | **NOT RUN** (F13) |
| Thumbnails | **PASS**: only visible ones are rendered (5 or 10 canvases at 1000 pages) |
| Bookmarks opened/closed repeatedly | **PASS** |
| Fullscreen on and off (headless) | **PASS**. On real devices **NOT RUN** |
| Geometry: 20×14400 pt, 14400×20 pt, 14400², 90° rotated with link, landscape | **PASS** (alpha.1): sizes bounded, link position correct after rotation. Wide inner spreads are not split (known gap) |
| 2000 links on one page | **PASS** (2000 nodes, instantly visible). No load test |
| Images of 15 MP (rendered) and 25 MP (removed) | **PASS**, see F14 for the notice |
| CJK without embedded font (CMaps) | **PASS** (alpha.1) |
| Broken, fake or empty headers | **PASS**: error state, no uncaught errors (messages: F5) |
| Password-protected PDF | **PASS** (own message) |
| PDF with owner password and restrictions | Displayed. Expected, because this is not DRM |
| 1001 pages | **PASS**, then **FAIL** after resize (F3) |
| Slow or hanging connection | **FAIL** for large or slow legitimate PDFs (F4) |

### Lifecycle

| Test | Result |
| --- | --- |
| Dialog opened/closed 12× during loading, animation and thumbnails | **PASS**: workers 2 → 2 (the dialog workers are terminated), no dialog left behind, focus returns to the trigger, no WebGL warnings, no errors |
| Focus in the dialog | **PASS**: after 25× Tab, focus is inside the dialog or on the browser UI step (`body`) |
| WebGL context lost during animation | **PASS**: animation ends on page 2, switches to flat, page turning still works |
| WebGL disabled (`--disable-webgl`) | **PASS** (flat) |
| `prefers-reduced-motion` | **PASS**: no animation |
| Autoplay | **PASS**: stops at the end of the book (4 pages) and on `visibilitychange` (hidden). Note: it stops rather than pauses |
| Widths 320/390/768/1280 and 640×450 @2 | **PASS**: no horizontal page overflow, targets ≥ 24 px. Dialog: **FAIL** (F10) |
| Screen reader | **NOT RUN**. Code reading: canvases with `role=img` and only "PDF-Seite n"; no text layer (known gap) |
| Firefox, Safari, iOS, Android, real touch devices | **NOT RUN** |
| Long-term memory/GPU | **NOT RUN**. Only the JS heap at 1000 pages was measured: about 7 MB |

## 5. Open limits

**Not tested:**

- The whole Joomla gate: installation, update, uninstallation, SEF, access matrix, logs and the backward-compatibility plugin. Reason: no local Joomla 6.
- Real mobile devices, Firefox and Safari.
- A screen-reader acceptance.
- A visual comparison with the legacy instances. No approved reference recordings exist.
- A per-file comparison against the PDF.js archive (archive not available locally).
- Long-term memory/GPU tests and load tests.
- Real documents (forms, embedded fonts, inner spreads).

**Notes from the legacy comparison** ([findings](../../../research/legacy-flipbook/FINDINGS.md)):

- The legacy instances use a 2000 ms autoplay interval; the alpha uses a fixed 3000 ms.
- Sound is enabled in the legacy instances and not implemented in the alpha.
- The legacy instances use a single-page "booklet" mode; its counterpart in the alpha is open.
- The legacy height probably covers the whole viewer, while the alpha adds heading and toolbar (about 100 px). Clarify before migration. All of these are known or planned gaps.

**Required before a production release:**

1. Pass the install/update/uninstall gate on Joomla 6, without the backward-compatibility plugin, with SEF and in a subdirectory.
2. F1–F4 fixed and re-measured.
3. MIME types and CSP checked on the target server.
4. Tests with the real documents of all legacy instances.
5. Access matrix guest/author/editor/admin.
6. Firefox, Safari/iOS and Android on real devices.
7. A minimum screen-reader check.
8. A documented way back to the legacy modules.

## 6. Hand-back: correction tasks

All tasks target a **new version 0.1.0-alpha.3**. The verdict above applies to the original alpha.1 package and, unchanged, to alpha.2.

| # | Task | Acceptance |
| --- | --- | --- |
| C1 (P1) | Fix F1 (diff above); optional `joomla.asset.json` | On Joomla 6 (root **and** `/sub`): in the rendered `<head>`, the `<link>` points to `{root}/media/mod_pdfbook/css/viewer.css?…` and returns HTTP 200; no request to a host `media`. Screenshot of a styled first display. A template override under `templates/<tpl>/css/mod_pdfbook/viewer.css` takes effect |
| C2 (P2) | F2: queue for the latest navigation, resize and zoom | Playwright: two quick "next" clicks give page 4. A resize 1280 → 520 during the animation gives a single page with `spread.width ≤ stage.clientWidth`. New tests in `tests/browser_smoke.py` |
| C3 (P2) | F3: check the page limit before `this.doc`; block the error state in `go()` | 1001-page fixture: after a resize, message and `data-state="error"` stay, all controls disabled |
| C4 (P2) | F4: separate timeouts with progress display | A server at 1 KB/s and 40 s total loads successfully. A hanging server without bytes ends after ≤ 25 s with an interface-language message and a direct-open link |
| C5 (P3) | F5: map error texts | In the error matrix (redirect, truncated, wrong header, timeout) no English text in `.pdfbook-status` |
| C6 (P3) | F6: version every ES module | Every JS module and the worker URL carry the version; after an update no old module is loaded from cache (DevTools cache test) |
| C7 (P3) | F7: build allowlist; remove `isEvalSupported`; correct the documentation | ZIP without `pdf.renderer.mjs` and `quickjs-eval.*`; `dependencies.json` justifies the exclusions; new checksum and manifest |
| C8 (P3) | F8, F9: root-relative base; normalise `/images/…`; allow spaces; media field | PHP tests: `/images/dir/file.pdf` → `images/dir/file.pdf`, `images/a b.pdf` → `images/a%20b.pdf`; all previous rejection cases of `tests/review/source_ext.php` stay rejected |
| C9 (P3) | F10–F15 as needed | For each, one Playwright or PHP test that reproduces the measured failure and passes after the fix |
| C10 | Align `STATUS.md` and `SECURITY.md` with this review | No statement in the documentation contradicts the measurements of this review |
