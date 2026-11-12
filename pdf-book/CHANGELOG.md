# Changelog: PDF Book (`mod_pdfbook`)

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
