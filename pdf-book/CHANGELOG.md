# Changelog: PDF Book (`mod_pdfbook`)

## 0.1.0-alpha.7 (2026-11-13)

Owner request after the live test of alpha.6 ("clearly better"): make the look of the page turn adjustable in the back end and offer an alternative animation.

| Item | Change | Files |
| --- | --- | --- |
| Adjustable look of the 3D turn | New module settings, shown only for the 3D turn: paper curvature 0–100 (0 = rigid sheet, default 50), shadow density 0–60 % (0 = no shadow, default 22), shadow softness 0–100 (default 50) and shadow width 0–100 (default 50). The defaults reproduce alpha.6. Values are clamped in the dispatcher and again in the viewer. The perspective stays automatic. | `module/mod_pdfbook.xml`, `module/src/Dispatcher/Dispatcher.php`, `media/js/model.js`, `media/js/turn.js`, `media/js/viewer.js` |
| Tempo | The existing setting (150–1800 ms, default 800) is relabelled "Tempo" and applies to both animations. | `module/mod_pdfbook.xml` |
| Alternative animation "Schieben" (slide) | The old pages slide out and the new ones slide in, inside the frame of the book. It needs no WebGL and also works in single-page view, where the 3D turn does not animate. The setting "Blätteranimation" offers 3D turn, slide or none; stored values of earlier versions stay valid. | `media/js/viewer.js`, `media/css/viewer.css`, `module/mod_pdfbook.xml` |

Measured on 2026-11-13:
- unit 12/12, PHP 32, dispatcher 11
- one short browser run in Edge 157 and Firefox 159: defaults, slide in double and single view, extreme settings, click and keys, dialog, WebGL loss all PASS
- the slide check was flaky in Edge (it sampled before the animation started) and now waits for the animation; the slide itself was confirmed in Edge by sampling it over time, the corrected check was not re-run
- further short tests were skipped at the owner's request; the owner tests live


## 0.1.0-alpha.6 (2026-11-13)

Changes after the owner's live test of alpha.5 on a Joomla 6.2 staging installation (viewer works; installation, update and uninstallation OK).

| Item | Change | Files |
| --- | --- | --- |
| L2: page looked squashed while turning, then jumped to full height | New page-turn renderer. At the start and end of a turn the sheet coincides exactly with the flat page (the projection is the identity at height 0), so there is no size jump. A unit test checks the geometry. | `media/js/turn.js`, `tests/model.test.mjs` |
| L3: centre shadow vanished while turning; animation less smooth than the legacy module; no paper curvature | The sheet is a 40-segment strip whose free edge leads the spine, so the paper bends slightly. Both faces are textured, shaded by their angle and darkened towards the spine. A soft cast shadow falls on the pages. The side the sheet lands on keeps showing the old page until the sheet arrives. Sine ease-out. Textures are uploaded once per turn instead of every frame. The overlay now covers the whole stage, and the viewing distance is chosen so that the lifted page fits. | `media/js/turn.js`, `media/js/viewer.js`, `media/css/viewer.css` |
| L4: toolbar symbols too small | Own SVG line icons (24 px) instead of Unicode glyphs; buttons 44 px (40 px on narrow screens, 34 px in the compact dialog layout). | `media/js/viewer.js`, `media/css/viewer.css` |
| L5: turn pages by mouse click and arrow keys | A click or tap on the right half of the spread turns forwards, on the left half backwards (links inside pages keep working). The arrow keys work without focusing the stage: they go to the book that last had the pointer or the focus, not while typing in a field, and not for books behind an open dialog. | `media/js/viewer.js` |

The behaviour of the legacy animation was analysed locally and is described in `research/legacy-flipbook/FINDINGS.md` (F30–F33). The implementation is our own; no legacy code was used.

Measured on 2026-11-13 (short run):
- unit 11/11, PHP 32, dispatcher 9
- two builds with identical SHA-256
- in Edge 157 and Firefox 159: two modules + cover, F15, F2, F11, F13, N1, page click and arrow keys, dialog lifecycle and focus, WebGL loss/disabled and reduced motion all PASS
- visual check of mid-turn frames by screenshot


## 0.1.0-alpha.5 (2026-11-12)

Fix for the first live finding on a real Joomla 6.2 staging installation (owner test of alpha.4).

| Finding | Change | Files |
| --- | --- | --- |
| L1 (P1) | The staging server (nginx) delivers `.mjs` as `text/plain`; browsers refuse module scripts with that MIME type ("Failed to load module script … text/plain"), so the viewer never started and the placeholder "… wird geladen" stayed. Fix: all JavaScript files are named `.js`. This covers the own modules (`viewer.js`, `pdfdoc.js`, `model.js`, `turn.js`) and the PDF.js build files (`pdf.js`, `pdf.worker.js`); their content stays byte-identical, and `dependencies.json` records `shipped_as`. The module script is registered relative to `/media` (`mod_pdfbook/viewer.js`), because Joomla would turn a root-relative `.js` path into `//media/…` (the F1 resolution path). `build.py` now rejects any `.mjs` file; the review server serves `.mjs` as `text/plain` like that host. | `media/js/`, `media/vendor/pdfjs/build/`, `module/src/Dispatcher/Dispatcher.php`, `dependencies.json`, `scripts/build.py`, `tests/` |

Measured on 2026-11-12 (short run at the owner's request):
- unit 10/10, PHP 32, dispatcher 9
- two builds with identical SHA-256
- in Edge 157 and Firefox 159: two modules + cover, F15, F2, JPEG 2000 fallback, F9 and N1 all PASS
- `.js` delivered as `text/javascript`


## 0.1.0-alpha.4 (2026-11-12)

Fixes for the new findings of the [alpha.3 review](docs/reviews/REVIEW_0.1.0-alpha.3.md). Not reviewed independently; the owner's live test on the staging installation is the deciding check.

| Finding | Change | Files |
| --- | --- | --- |
| N1 (P2) | Dialog: the book scrolls vertically when space is short, the toolbar sticks to its bottom edge, and the body may shrink to 120 px. Below 420 px viewport height, the heading is visually hidden (it stays available to screen readers) and dialog and toolbar padding shrink. | `media/css/viewer.css` |
| N2 (P3) | `fail()` releases document, worker, render tasks, page cache, thumbnail observer and WebGL overlay as soon as the error state is set. | `media/js/viewer.mjs` |
| N3 (P3) | Error-name mapping reduced to class names that exist in PDF.js 6.5.438; a unit test checks the mapping against the shipped `pdf.mjs`. | `media/js/model.mjs`, `tests/model.test.mjs` |
| D4 | Review suite: `REVIEW_BROWSER=firefox` and `REVIEW_PORT`; new regression tests for N1 (320×225, 640×300, 568×320, 844×390) and N2. | `tests/review/` |

Measured on 2026-11-12, deliberately shortened at the owner's request:
- unit 10/10, PHP 32, dispatcher 9
- two builds with identical SHA-256
- in Edge 157 and Firefox 159: two modules + cover, F15, F2, N1, N2, and the dialog lifecycle and focus checks all PASS
- the full review suite was not re-run for alpha.4


## 0.1.0-alpha.3 (2026-11-12)

Fixes for the findings of the [independent review of 0.1.0-alpha.1](docs/reviews/REVIEW_0.1.0-alpha.1.md). Not reviewed independently yet; see [the review request](docs/reviews/REVIEW_REQUEST_0.1.0-alpha.3.md).

| Finding | Change | Files |
| --- | --- | --- |
| F1 (P1) | The stylesheet is registered relative to `/media` (`mod_pdfbook/viewer.css`), so Joomla resolves it to `{root}/media/mod_pdfbook/css/viewer.css` in root and subdirectory installations and allows template overrides. The module script keeps its root-relative URL, because Joomla does not resolve `.mjs`. | `module/src/Dispatcher/Dispatcher.php` |
| F2 (P2) | Navigation, zoom, mode changes and resizes while a page renders or turns are queued (the latest request wins). `move()` counts from the queued or in-flight target. Controls stay enabled while busy. | `media/js/viewer.mjs` |
| F3 (P2) | The page limit is checked before the document becomes visible to the viewer, and the error state blocks every later `go()`, including resizes. | `media/js/pdf.mjs`, `media/js/viewer.mjs` |
| F4 (P2) | Separate timeouts: 20 s for the response, 20 s inactivity between chunks, 30 s for parsing. A slow but steady download completes. Coarse progress is shown in 10 % steps (or MB when the size is unknown). | `media/js/model.mjs`, `media/js/pdf.mjs`, `media/js/viewer.mjs` |
| F5 (P3) | Errors carry codes and are mapped to fixed German interface texts; library details only go to `console.warn`. | `media/js/model.mjs`, `media/js/viewer.mjs`, `media/js/pdf.mjs` |
| F6 (P3) | Every relative ES-module import and the worker URL carry `?v=<version>`; `scripts/build.py` fails if one is missing or stale. One version constant: `Dispatcher::VERSION` must equal the manifest and `package.json`. | `media/js/*.mjs`, `module/src/Dispatcher/Dispatcher.php`, `scripts/build.py` |
| F7 (P3) | The dead option `isEvalSupported` is removed (build check). Ten PDF.js files that are never loaded with this configuration are no longer shipped: `pdf.renderer.mjs`, the QuickJS scripting sandbox, the `.wasm` decoders and the ICC (qcms) module, plus their licence files where the component is gone. They are listed with hash and reason under `excluded` in `dependencies.json`. The build fails if `media/vendor` holds anything not in the lock file. | `media/js/pdf.mjs`, `media/vendor/pdfjs/`, `dependencies.json`, `scripts/build.py` |
| F8 (P3) | The data attribute carries a root-relative base (`/` or `/sub/`); the viewer resolves it against the page origin. | `module/src/Dispatcher/Dispatcher.php`, `media/js/model.mjs` |
| F9 (P3) | Accepted sources: `images/…` and `/images/…`, surrounding whitespace trimmed, spaces inside names (returned as `%20`), Joomla media-field values with `#joomlaImage://…`. Segments that start or end with a space or end with a dot are rejected (Windows name normalisation). The field is a Joomla media picker for documents (`type="media" types="documents"`); this is NOT MEASURED in Joomla. | `module/src/Helper/Source.php`, `module/mod_pdfbook.xml`, `media/js/model.mjs` |
| F10 (P3) | The dialog is a flex column; the book fills the remaining height (`fill` option), so a wrapping toolbar stays inside the dialog. | `media/js/viewer.mjs`, `media/css/viewer.css` |
| F11 (P3) | The page-mode button cycles automatic → single → double → automatic and names the current mode in its label. | `media/js/model.mjs`, `media/js/viewer.mjs` |
| F12 (P3) | Status text "Seite n" for one visible page, "Seiten a–b" for two. | `media/js/model.mjs`, `media/js/viewer.mjs` |
| F13 (P3) | When zoomed, the stage allows `touch-action: pan-x pan-y`, and a horizontal swipe only turns the page at the scroll edge. | `media/js/viewer.mjs` |
| F14 (P3) | Not changed by design: images above 16 megapixels are still skipped by PDF.js to bound memory. The limit is now named (`LIMITS.imagePixels`) and documented in `README.md` and `docs/SECURITY.md`. Raising it is an owner decision. | `media/js/model.mjs`, docs |
| F15 (P3) | Configuration errors produce no output for guests; users with `core.edit` on the module (or on `com_modules`) see the reason. | `module/src/Dispatcher/Dispatcher.php`, `module/tmpl/default.php` |
| F16 | Documentation aligned (CSP without `unsafe-inline` for styles measured in Edge; WASM trade-off). | `docs/SECURITY.md`, `docs/STATUS.md` |

Tests added or extended: `tests/model.test.mjs` (9 groups), `tests/source.php` (32 checks), new `tests/dispatcher.php` (9 checks against stubs), `tests/browser_smoke.py` (queued input), `tests/review/` (fixed-behaviour assertions for F2–F5, F7, F9–F11, F13, F15, JPEG 2000 fixture, exit code 1 on any FAIL).

## 0.1.0-alpha.2 (2026-11-12)

Public package. Same functionality as 0.1.0-alpha.1, with neutral identifiers, a neutral third-party notice and neutral demo and test texts.

## 0.1.0-alpha.1 (2026-11-11)

First candidate, built under an earlier working name; reviewed independently (verdict BLOCKED), not published.
