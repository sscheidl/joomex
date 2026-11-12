# Review: PDF Book 0.1.0-alpha.3

Date: 2026-11-12.

**Authorship and independence.** This review was requested from Codex as an independent reviewer ([request](REVIEW_REQUEST_0.1.0-alpha.3.md)).

- Codex ran part of it: local test runs, its own fault-injection and cross-browser checks, and a read-only preflight with a snapshot of the staging installation. Then it ran out of credits.
- Claude completed the remaining local checks and wrote this document. **Claude also developed the alpha.3 fixes, so the parts marked "Claude" are not independent.**
- The Joomla installation gate is run by the owner manually on the staging installation (section 4). Its results will be added here.

## 1. Verdict

**Suitable for a limited staging test, carried out by the owner on the staging installation. Not for production.**

The staging test is itself the still-open Joomla installation gate (J1–J12). Reasons:

- **All review findings F1–F15 of alpha.1 are fixed** in the measured local scope, and F16 is documented (section 3). F1 (stylesheet URL) is fixed according to the Joomla 6.2.0 code trace and the stubbed tests. Whether real Joomla renders the expected `<link>` is the first check of the staging test.
- **No exploitable vulnerability was found.** The security checks of alpha.1 were repeated (output encoding, PDF actions, outline payloads, path vectors, network, CSP), and the new code paths (path normalisation, error handling, timeouts, queueing) were checked. This is not a statement that the extension is "secure".
- **Two new findings, neither of them a security problem** (section 3.2):
  - N1 (P2): in the dialog, the toolbar cannot be reached at small viewport heights (phones in landscape).
  - N2 (P3): after a render error, the document stays in memory until the viewer is closed.

  Neither blocks a staging test. N1 must be fixed before production.

## 2. Reviewed state

| Item | Value |
| --- | --- |
| Package | `mod_pdfbook-0.1.0-alpha.3.zip`, SHA-256 `96b2da72413c4cc0a01f91881ab853d17fb87cdb8ca19c756ce70f5df01759ba`, 208 files |
| Commit | `86d884d` (branch `fix/pdf-book-0.1.0-alpha.3`); two builds from a clean clone byte-identical to the release asset (Claude, MEASURED 2026-11-12) |
| OS | Windows 11 Pro 10.0.26300 |
| Browsers | Microsoft Edge 157.0.4341.46 (headless) and Firefox 159.0 (Playwright build), both via Playwright 1.65.0 |
| PHP / Node | 8.4.27 / 24.22.1 (local tests) |
| Staging installation (Codex preflight, read-only plus snapshot) | Joomla 6.2.0, PHP 8.4.27, MariaDB 10.6, database separate from production, SEF on without URL rewriting, **backward-compatibility plugin enabled**, default template a third-party template (Cassiopeia also available), extension not installed; full file and database snapshot with verified checksums. A restore has not been tested |

## 3. Findings

### 3.1 Status of the alpha.1 findings

Evidence: [evidence-0.1.0-alpha.3](evidence-0.1.0-alpha.3/) (Edge, Claude) and [evidence-0.1.0-alpha.3-review](evidence-0.1.0-alpha.3-review/) (Codex runs and Claude's Firefox run).

| # | Status | Evidence |
| --- | --- | --- |
| F1 | **Fixed (code trace + stubs); real Joomla pending** | `Dispatcher.php:39` registers `mod_pdfbook/viewer.css`; `tests/dispatcher.php` checks the URI; the stub rendering emulates the traced Joomla resolution; the stylesheet loads and applies (`border-radius 8px`) in Edge and Firefox. Pending: owner test B4/B5 |
| F2 | Fixed | Two rapid "next" clicks → page 4; two quick ArrowRight → page 8; resize to 520 px during a turn → single page that fits the stage (Edge: Claude and Codex; Firefox: Claude). Dispose with a queued navigation leaves no pending work (Codex, Edge and Firefox) |
| F3 | Fixed | 1001-page PDF: message, `data-state="error"` and disabled controls survive a resize |
| F4 | Fixed | Slow but steady response (≈45 s) loads; hanging response ends after 20 s with the German timeout message |
| F5 | Fixed | No English text in the status for redirect, truncated file, fake header, password, 500, oversized file. Note N3 |
| F6 | Fixed (build check); cache test NOT MEASURED | All relative imports and the worker URL carry `?v=0.1.0-alpha.3`; `build.py` rejects a missing or stale suffix |
| F7 | Fixed | `isEvalSupported` removed; 10 unused PDF.js files not shipped. JPEG 2000 renders through the JavaScript fallback without `.wasm` requests (Edge and Firefox). A CMYK/ICC-based image renders without the ICC module, with no failing request (Codex, Edge and Firefox). **JBIG2 NOT MEASURED** (no fixture tool) |
| F8 | Fixed | Root-relative base (`/sub/`, `/`) from the dispatcher; viewer resolves it against the page origin |
| F9 | Fixed | 41 path vectors re-run with a junction (Codex). Accepted only `images/…` forms including `/images/…`, spaces and the media-field suffix; traversal, encodings, UNC, ADS, junction and Windows name tricks stay rejected. Media picker in Joomla: owner test B2 |
| F10 | **Partly fixed** | Fits at 320×640, 390×844, 768×1024, 1280×900 and 640×450@2. **Not at heights below about 390 px: see N1** |
| F11 | Fixed | Cycle single → double → automatic; automatic switches to a single page at 500 px |
| F12 | Fixed | "Seite 1" / "Seiten 2–3"; unit tests |
| F13 | Fixed for mouse; **touch NOT MEASURED** | `touch-action: pan-x pan-y` when zoomed; a swipe does not turn the page until the scroll edge is reached |
| F14 | Kept by design, documented | 25-megapixel image skipped, page shown without it |
| F15 | Fixed (stubs); real Joomla pending | Guest: no output; user with edit rights: message. Owner test B10 |
| F16 | Documented | `style-src 'self'` without `unsafe-inline` and nonce + `strict-dynamic` work without violations in Edge 157 and Firefox 159 |

### 3.2 New findings

#### N1 (P2): dialog toolbar unreachable at small viewport heights

Status: **MEASURED** (Codex; re-checked by Claude in Edge 157 and Firefox 159).

- **Location:** `media/css/viewer.css`. `.pdfbook` has `overflow: hidden`, and the fill rule `.pdfbook.is-fill .pdfbook-body` sets `min-height: 160px`. Wired up in `media/js/viewer.mjs` (`fill: true` for the dialog).
- **Reproduction:** open the cover dialog with these viewports:

  | Viewport | Toolbar spans | Dialog ends at | Reachable by scrolling |
  | --- | --- | --- | --- |
  | 320×225 | 269–392 px | 233 px | no |
  | 640×300 | 255–348 px | 306 px | no |
  | 568×320 (phone in landscape) | 271–357 px | 326 px | no |
  | 844×390 | inside the dialog | | yes (OK) |

- **Impact:** in the dialog on phones in landscape, or at high browser zoom on small screens, page input, zoom, thumbnails, table of contents and the download link cannot be reached. Swipe, arrow keys and Escape still work. Inline books are not affected.
- **Fix:**
  - In fill mode, allow the body to shrink (`min-height: 0`; stage `min-height` around 100 px).
  - Let `.pdfbook.is-fill` scroll vertically when space is insufficient, or hide the heading at `max-height: 420px`.
- **Acceptance:** at 568×320, 640×300 and 320×225 the toolbar is inside the dialog (or reachable by scrolling), in Edge and Firefox.

#### N2 (P3): resources kept after a render error

Status: **MEASURED** (Codex fault injection; re-checked by Claude in both browsers).

- **Location:** `media/js/viewer.mjs` `fail()` (render path in `go()`).
- **Reproduction:** with `pdf.render` forced to throw, `go(4)` gives `data-state="error"` with the German message, which is correct. But the PDF document and its worker stay alive (`pdf.disposed === false`, one cache entry) until `dispose()`, which inline books only reach on page unload.
- **Impact:** memory and a worker are held for a viewer that can no longer be used. Not a security issue.
- **Fix:** in `fail()`, release the PDF (`this.pdf.dispose()`) once the state is final, as `load()` already does.

#### N3 (P3): stale entries in the error-name mapping

Status: **MEASURED** by source search in PDF.js 6.5.438.

- **Location:** `media/js/model.mjs` (`PDFJS_ERRORS`).
- **Problem:** `MissingPDFException` and `UnexpectedResponseException` do not exist in 6.5.438; `ResponseException` covers them. `AbortException` exists but is unmapped and falls back to the generic message, which is acceptable.
- **Impact:** none.
- **Fix:** remove the dead names and add a unit test that matches the mapping against the shipped PDF.js class names.

## 4. Test matrix

### 4.1 Joomla installation gate (J1–J12)

**Owner live test of alpha.4, 2026-11-12** (staging installation: Joomla 6.2.0, PHP 8.4, nginx, HTTP only, a third-party default template):

| Check | Result |
| --- | --- |
| J1 installation via the Joomla installer | **PASS** (owner) |
| Back-end operation: create the module, PDF field, settings | **PASS** (owner) |
| J2/F1 stylesheet | **PASS**, MEASURED by Claude with read-only requests: `<link href="/media/mod_pdfbook/css/viewer.css?0.1.0-alpha.4">`, HTTP 200 `text/css`, no request to a host `media` |
| J11 MIME types | **FAIL → L1 (P1)**: every `.mjs` file is delivered as `text/plain`, and the browser refuses the module script ("Failed to load module script … MIME type of text/plain"). The viewer never starts, and the server-rendered placeholder "… wird geladen" stays. `.bcmap` arrives as `video/unknown`, which is harmless because it is fetched as binary data. The PDF arrives as `application/pdf` |
| Display and operation in the front end | **NOT MEASURED** (blocked by L1) |

**Fixed in 0.1.0-alpha.5** (all JavaScript files renamed to `.js`; see `CHANGELOG.md`). The live test is repeated with alpha.5.

Original plan: the owner tests installation, operation, GUI and display manually on the staging installation. The detailed checklist stays private because it contains site details. It covers J1–J5, J7, J9 and J10 plus operation on a real phone. The results will be added here in neutral form.

| Item | Status |
| --- | --- |
| Not covered by the owner test | J6 (subdirectory installation: the staging installation lives at the root of its host), J8 (full access matrix), J11 (server MIME types beyond the browser network tab) and J12 (CSP of the staging installation) stay NOT RUN unless added |
| Preparation | The backward-compatibility plugin is enabled on the staging installation and must be disabled for the test (J1). A full snapshot exists |

### 4.2 Local checks

| Check | Edge 157 | Firefox 159 | By |
| --- | --- | --- | --- |
| Unit (9), PHP paths (32), dispatcher stubs (9), lint | PASS (not browser-specific) | | Claude, Codex |
| Project smoke test | PASS | NOT RUN (script fixed to Edge) | Claude |
| Review suite (`tests/review/review_browser.py`, 21 pass/fail checks + 4 info) | 21/21 PASS (Claude and Codex) | 21/21 PASS | Edge: Claude, Codex; Firefox: Claude |
| Path vectors incl. junction (`tests/review/source_ext.php`) | PASS | | Codex |
| JPEG 2000 under strict style CSP | PASS | PASS | Codex |
| CMYK/ICC image without ICC module | PASS | PASS | Codex |
| Dispose with queued navigation | PASS | PASS | Codex |
| Render-failure fault injection | N2 | N2 | Codex, Claude |
| Dialog at low heights | N1 | N1 | Codex, Claude |
| Reproducible build, publication check | PASS | | Claude |
| JBIG2, real touch devices, Safari/iOS/Android, screen reader, module caching, update cache behaviour | NOT RUN | NOT RUN | |

## 5. Open limits

**Before a production release:**

1. Owner test on the staging installation passed, and its result added to this document.
2. N1 fixed.
3. Subdirectory installation and access matrix tested.
4. Real phones (iOS/Android) tested.
5. Tests with the real documents of all legacy instances.
6. A tested restore path for the staging snapshot and a documented way back to the legacy modules.

**Independence:** an independent re-check of the Claude-written parts (F-status table, N1–N3) by Codex is still recommended once credits are available.

## 6. Hand-back

| # | Task | Acceptance |
| --- | --- | --- |
| D1 (P2) | N1: dialog layout at low heights | Acceptance as in N1; regression test in `tests/review/` for 568×320 and 320×225 in Edge and Firefox |
| D2 (P3) | N2: release the PDF in `fail()` | Fault-injection test: after a render error, `pdf.disposed === true`, cache empty, no worker left in `page.workers` |
| D3 (P3) | N3: clean up the error mapping | Unit test that checks the mapping against the class names in `vendor/pdfjs/build/pdf.mjs` |
| D4 | Firefox option for `tests/review/review_browser.py` (environment variable), so the suite runs in both browsers | Suite selects the browser via `REVIEW_BROWSER=firefox`; both runs documented |
| D5 | Owner test results | Neutral summary added to section 4.1 |

D1–D4 go into a new version (0.1.0-alpha.4). This review applies unchanged to the alpha.3 package.
