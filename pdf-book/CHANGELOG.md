# Changelog: PDF Book (`mod_pdfbook`)

## 0.1.0-alpha.17 (2026-11-13)

Corrections for the [independent review of alpha.15](docs/reviews/REVIEW_0.1.0-alpha.15.md) (Codex), on top of alpha.16. Selected by the owner: R1–R6 and D3. T1 (legacy review tests) and the minor points of section 7 of the review are not part of this version.

| Finding | Change | Files |
| --- | --- | --- |
| R1 automatic height ignored a height-only window change | The fit cache now also holds the window height and the height of heading and toolbar, and a window `resize` refits the automatic height (debounced). Only the window cap depends on them, so the stage changes only where the cap binds; ordinary mobile browser bars that appear and disappear do not resize the book while it is shorter than the window. | `media/js/viewer.js` |
| R2 links misplaced on pages of another format | All page wrappers share the format of the first page, and a page of another format is letterboxed by `object-fit: contain`. Link rectangles are now placed inside that fitted image rectangle of each page. | `media/js/viewer.js` |
| R3 archive check let manipulated packages pass | `check_publication.py --zip` now requires the archive to contain exactly the package files of one project (taken from that project's `build.py`), each byte-identical to the checked, tracked source file. Extra (including binary) entries, missing entries, changed entries (including vendor files), duplicate names and unsafe paths are findings. Identical entries are not scanned again. New regression test `tests/publication_zip.py`: genuine and recompressed package pass; unlisted binary, changed vendor file, missing file and duplicate entry fail. | `../scripts/check_publication.py`, `scripts/build.py`, `tests/publication_zip.py` |
| R4 package hash not reproducible | Cause found: the developer environment's Python uses zlib-ng (`1.3.1.zlib-ng`), which compresses differently from stock zlib. The delivered alpha.15 ZIP (`d67a50fb…`) is reproduced bit for bit by a clean build of `21e6815` there; entry names and uncompressed contents are identical to every clean build, only the deflate streams differ. A build with the stock zlib 1.3 of the same machine gave yet another hash (`dde25c68…`); the reviewer's `7ca48681…` (stock zlib 1.3.1/1.3.2) was not reproduced here. Consequence: the archive hash identifies one build, not the source. `manifest.json` now records the toolchain (Python, zlib, system) and the SHA-256 of every uncompressed entry; the source identity of an archive is checked with `check_publication.py --zip` against the tagged commit, which does not depend on compression. `build.py` also sets the ZIP creator system to a fixed value (D4). | `scripts/build.py` |
| R5 animations kept running after dispose | Every Web Animation of slide, fold and cross-fade is registered; `dispose()` and `fail()` cancel them at once, so transient layers and canvas copies are released immediately and `busy` is cleared. | `media/js/viewer.js` |
| R6 sidebar toggles without state | "Seitenübersicht" and "Inhaltsverzeichnis" carry `aria-controls` (the sidebar) and `aria-expanded`, updated on open, switch and close. A screen-reader run is still open. | `media/js/viewer.js` |
| D3 inactive self-shadow work | The nine depth-map reads per fragment that ran with weight 0, the depth texture binding and the related varying and uniforms are removed from the sheet pass. Output unchanged: a frozen mid-turn frame (progress 0.5) is pixel-identical between alpha.16 and alpha.17 (headless Chrome, SwiftShader). | `media/js/turn.js` |

New browser regression checks `tests/alpha17_regressions.py` (R1, R2, R5 for fold/slide/cross-fade, R6) with a new mixed-format fixture (`scripts/make_fixtures.py`: `mixed-formats.pdf`).

Measured on 2026-11-13 (Linux container, Chrome for Testing 153 headless, Python 3.13 with zlib-ng): `tests/alpha17_regressions.py` 9/9 pass on alpha.17 and 1/9 on alpha.16 (control; R1 enlarge is the only check that cannot fail there). `tests/publication_zip.py` 6/6. Unit 12, PHP 32, dispatcher 11 pass. Not run: Firefox, Safari, real devices, screen reader, real Joomla.


## 0.1.0-alpha.16 (2026-11-13)

Owner finding from the live test of alpha.15: the synthesised page sound sounded like a shot in an 8-bit game. Wanted: a quiet, discreet page turn of a book or magazine.

| Item | Change | Files |
| --- | --- | --- |
| Page sound from recordings | The synthesis is removed. Two short CC0 recordings of a turning book page (Kenney, "RPG Audio": `bookFlip2`, `bookFlip3`; the third flip ends in a slap and was left out) are trimmed, filtered (150 Hz–7 kHz), normalised, faded and shipped as mono MP3 (3.3 KB and 1.9 KB, 0.37 s and 0.18 s). Each turn plays one of them at random at about a third of full volume, with ±6 % pitch and slight volume variation. The files are fetched from the module's own media folder only when the sound is on and after the first user gesture; the first turn waits for loading instead of staying silent. Origin, licence and processing: `THIRD-PARTY-NOTICES.md`; the files are third-party material and therefore live under `media/vendor/kenney-rpg-audio/` with archive, source and shipped hashes in `dependencies.json` (RULES.md). | `media/vendor/kenney-rpg-audio/`, `dependencies.json`, `media/js/viewer.js`, `module/mod_pdfbook.xml`, `THIRD-PARTY-NOTICES.md` |
| Build check | `build.py` checked only the PDF.js lock; it now checks every lock entry in `dependencies.json` and that `media/vendor` holds no folder without one. | `scripts/build.py` |

Measured on 2026-11-13 (headless Chrome 153, touch emulation, `--autoplay-policy=user-gesture-required`): with sound on, no audio request before the first tap, then both files load from `media/vendor/kenney-rpg-audio/` (HTTP 200, `audio/mpeg`) and each of four turns starts one of the two recordings (rates 0.95–1.06); with sound off no audio request and no playback; no page errors. `build.py` and the generic publication check pass (0 findings). Not run: listening on real speakers, iOS, Android, Firefox, Safari.


## 0.1.0-alpha.15 (2026-11-13)

Fixes the developer findings D1 and D2 of the [review request for alpha.14](docs/reviews/REVIEW_REQUEST_0.1.0-alpha.14.md), confirmed by the owner.

| Item | Change | Files |
| --- | --- | --- |
| D1: page sound on touch devices | The audio context was created and resumed only on `pointerdown` and `keydown`. For touch input only the end of a tap counts as user activation, so on phones and tablets the sound never played. It is now also unlocked on `pointerup`, `touchend` and `click`; inside the gesture one silent sample is played (needed by older iOS versions); and a page turn that comes before the context has finished resuming waits for it instead of staying silent. A phone set to silent still plays no sound. | `media/js/viewer.js` |
| D2: autoplay could not be stopped in cinema mode | Turning a page by hand (click, tap, swipe, arrow keys, Home/End, page field, thumbnail, table of contents, link) now ends autoplay in every mode; reloading the page starts it again. Zoom, page mode, fullscreen and resizing do not end it. This gives visitors a way to stop the moving content also without toolbar (WCAG 2.2.2). With reduced motion set in the operating system, autoplay no longer starts on load; the toolbar button still starts it. | `media/js/viewer.js` |

Measured on 2026-11-13 (headless Chrome 153, demo PDF, cinema mode, autoplay 1 s with restart): a click, an arrow key and a touch swipe each end autoplay (no further page change in the next 3 s); zoom does not end it; with reduced motion autoplay does not start on load; no page errors. D1 could not be reproduced in headless Chrome: alpha.14 and alpha.15 both unlocked the audio context on a touch tap and played the sound, so the fix is checked only against the HTML user-activation rules and must be confirmed on a real iOS or Android device. Unit 12, PHP 32, dispatcher 11 checks pass. Not run: real touch devices, iOS, Android, Firefox, Safari; the sound was not listened to.


## 0.1.0-alpha.14 (2026-11-13)

Owner requests after the live test of alpha.13.

| Item | Change | Files |
| --- | --- | --- |
| Frame switch | New setting "Rahmen" (default on). Off removes the thin border and the rounded corners of the module; the background colour stays. | `module/mod_pdfbook.xml`, `module/src/Dispatcher/Dispatcher.php`, `media/js/model.js`, `media/js/viewer.js`, `media/css/viewer.css` |
| Automatic height on narrow screens | The automatic height used a minimum of 280 px and assumed 24 px stage padding, so landscape pages on a phone kept about 100 px of empty space. It now uses the actual padding (12 px on narrow screens) and a minimum of 160 px; the body minimum of 280 px does not apply with automatic height. Wide screens are unchanged (16:9 slides at 1215 px window width: stage 359 px, book 311 px). | `media/js/viewer.js`, `media/css/viewer.css`, `module/mod_pdfbook.xml` (description) |

Measured on 2026-11-13 (headless Chrome, 16:9 test PDF, double view, automatic height, frame off): 1215 px window: stage 360 px, book 312 px, 48 px left over; 420 px window: stage 214 px (before: 280 px), book 177 px, 37 px left over; border and radius 0 with frame off. Nothing else run.


## 0.1.0-alpha.13 (2026-11-13)

Owner findings after the live test of alpha.12.

| Item | Change | Files |
| --- | --- | --- |
| Vertical fold swapped | Forward the top half now folds down, backward the bottom half folds up (alpha.11/12: the other way round). Horizontal fold unchanged. | `media/js/viewer.js`, `module/mod_pdfbook.xml` |
| On/off switches in the back end | The selected option of the seven on/off settings was hard to see in the dark administrator theme. They now use Joomla's yes/no button group: "on" options (Ja, An, Anzeigen) green, "off" options (Nein, Aus, Verbergen) red; the selected one is filled. This also applies to "PDF-Öffnen anzeigen", which was a plain radio list. | `module/mod_pdfbook.xml` |

Measured on 2026-11-13: mid-animation screenshot of a forward and a backward vertical fold in headless Chrome, no page errors. The yes/no colouring was checked against the radio button layout of the current Joomla source (`layouts/joomla/form/field/radio/buttons.php`), not in a running back end. Nothing else run.


## 0.1.0-alpha.12 (2026-11-13)

Owner findings from the live test of alpha.11.

| Item | Change | Files |
| --- | --- | --- |
| Rapid page turning | Several clicks (or keys) during a turn used to switch to the last requested page without animation, which looked like a jump. Now the running turn finishes completely, and then one complete turn goes straight to the page shown in the counter; intermediate pages are skipped. Input that arrives while the next page is still rendering, before anything moves, is merged into that one turn. Zoom, mode and resize changes still switch without animation. | `media/js/viewer.js` |
| Zoom 100 % | New button between "Verkleinern" and "Vergrößern". It shows the current zoom (75–250 %) and restores the original size; it is disabled at 100 %, and minus/plus are disabled at their limits. | `media/js/viewer.js`, `media/css/viewer.css` |

Measured on 2026-11-13 (short headless Chrome run, demo PDF): five rapid clicks give at most the running turn plus one complete turn to the last page in 3D, fold, slide and cross-fade, no page errors; 100 % button resets 125 % to 100 %. Not run: unit, PHP and dispatcher tests, Firefox, Safari, real devices.


## 0.1.0-alpha.11 (2026-11-13)

Owner request after the live test of alpha.10. All new settings default to the behaviour of alpha.10.

| Item | Change | Files |
| --- | --- | --- |
| Fold direction | New setting "Klapprichtung" for the mode "Klappen": horizontal, vertical or automatic (default: vertical in single-page view, horizontal in double-page view). Vertical: forward the bottom half folds up, backward the top half folds down, independent of the reading direction. Empty page slots get no shade in either direction. | `media/js/viewer.js`, `media/css/viewer.css`, `module/mod_pdfbook.xml` |
| Automatic height | New setting "Höhe automatisch nach PDF" (default off): the stage height follows the module width and the format of the first page shown, for single or double view, capped at the window height. The format is kept for the whole document so the book does not jump; width changes below 20 px keep the height, so an appearing scrollbar cannot make it oscillate. Dialog and fullscreen fill their space as before. | `media/js/viewer.js`, `media/js/model.js`, `module/mod_pdfbook.xml` |
| Cinema mode | New settings "Titelzeile anzeigen" and "Navigationsleiste anzeigen" (default on). Without heading the status becomes an overlay on the stage while loading or on error and stays available to screen readers; without toolbar pages turn by click, swipe and arrow keys. | `media/js/viewer.js`, `media/css/viewer.css`, `module/mod_pdfbook.xml` |
| Page sound | New setting "Blättergeräusch" (default off). The sound is synthesised in the browser (band-passed noise with a paper-like grain, length follows the tempo); there is no audio file. The audio context starts on the first click or key press in the book, as browsers require. | `media/js/viewer.js`, `module/mod_pdfbook.xml` |
| Autoplay | New settings: start on load (default off), interval 1–60 s (default 3, as before) and restart at the end (default off). The interval never falls below the turn duration plus 300 ms. | `media/js/viewer.js`, `media/js/model.js`, `module/mod_pdfbook.xml` |

The dispatcher passes the new settings (`flipAxis`, `autoHeight`, `showHeading`, `showToolbar`, `sound`, `autoplay`, `autoplayInterval`, `autoplayLoop`); the viewer validates them again.

Measured on 2026-11-13 (one short smoke run, Chrome headless, demo PDF): fold vertical in single view, horizontal and vertical in double view, cross-fade, and cinema mode with automatic height, sound and autoplay with restart load and turn without page errors; mid-animation screenshots checked. Not run: unit, PHP and dispatcher tests, the browser suite, Firefox, Safari, real devices; the sound was not listened to.


## 0.1.0-alpha.10 (2026-11-13)

Owner request after the live test of alpha.9: two more page-change modes; the self-shadow switch is dropped.

| Item | Change | Files |
| --- | --- | --- |
| Mode "Klappen" (flip-board fold) | The spread, or the single page, is split in the middle; one half folds over around the middle like a rigid board, with perspective, darkening of the board while it stands and a shade on the half it uncovers and the half it covers. Forward folds the right half to the left, backward the left half to the right (mirrored for right-to-left books). CSS 3D only: no WebGL, works in single-page view. | `media/js/viewer.js`, `media/css/viewer.css` |
| Mode "Überblenden" (cross-fade) | The new pages fade in under the old ones, then the old ones fade out; blank page slots change without a hard cut. Works in single-page view. | `media/js/viewer.js` |
| Settings | "Blätteranimation" offers 3D-Blättern, Klappen, Schieben, Überblenden, Ohne Animation; "Tempo" applies to all four animations. Stored values of earlier versions stay valid. Like "Schieben", both new modes animate only when the view (single or double) stays the same, and not at all with reduced motion. | `module/mod_pdfbook.xml`, `media/js/model.js` |
| Self-shadow switch removed | The alpha.9 test switch is gone. Live result: the self-shadow was visible only frame by frame, so it stays off; the shader lookup remains. | `module/mod_pdfbook.xml`, `module/src/Dispatcher/Dispatcher.php`, `media/js/model.js`, `media/js/viewer.js`, `media/js/turn.js` |

Not tested: no unit, PHP, dispatcher or browser runs. Only syntax checks and the build checks of `scripts/build.py` ran.


## 0.1.0-alpha.9 (2026-11-13)

Owner request: test version with a back-end switch for the self-shadow of the turning sheet.

| Item | Change | Files |
| --- | --- | --- |
| Self-shadow switch | New module setting "Eigenschatten des Blatts (Test)", shown only for the 3D turn, default off. When on, the sheet shades itself where it curls over, using the existing depth map lookup of alpha.8 unchanged. It works only while the shadow density is above 0, because the depth map is rendered only then. The known band near the free edge after mid-turn (alpha.8) is not fixed; this version exists to judge the effect live. | `module/mod_pdfbook.xml`, `module/src/Dispatcher/Dispatcher.php`, `media/js/model.js`, `media/js/viewer.js`, `media/js/turn.js` |

Not tested at the owner's request: no unit, PHP, dispatcher or browser runs. Only the build checks of `scripts/build.py` ran.


## 0.1.0-alpha.8 (2026-11-13)

Second rewrite of the 3D page turn after a closer analysis of the legacy rendering (`research/legacy-flipbook/FINDINGS.md`, F30 corrected, F34–F40). Own implementation in WebGL 1, no library and no legacy code.

| Item | Change | Files |
| --- | --- | --- |
| Bend | The sheet follows a cubic Bézier curve. Its middle runs ahead of the free edge, so the paper gets a belly in the turning direction, and it leaves the spine with a rounded fold. The image is mapped along the measured length of the curve and the curve keeps the page width. | `media/js/turn.js` |
| Light | Ambient, diffuse and specular light from the upper left front. A flat page gets exactly its own colours, so start and end of a turn match the pages in the document; the fold darkening of the stylesheet is repeated on the sheet. | `media/js/turn.js` |
| Shadow | A depth map is rendered from the light and blurred in two passes; it is laid over the pages and the area around the book. The shadow has the true shape of the bent sheet, fades in and out with its lift and pales where the paper is high. The settings keep their meaning: density, softness (blur radius) and width (slant of the light). | `media/js/turn.js`, `media/js/viewer.js` |
| Curvature setting | 0 = rigid sheet, 50 = default, 100 = twice the bend. | `media/js/viewer.js` |

Not included:
- **Self-shadow of the sheet:** implemented but switched off, because it showed a hard band near the free edge after mid-turn.
- **Sheet thickness and page stack:** seen from straight above they change the picture by well under one percent.
- **Resting pages in 3D:** they stay in the document so that text stays sharp.

Measured on 2026-11-13 (minimal run at the owner's request): unit 12/12, PHP 32, dispatcher 11, identical SHA-256 from two builds, no shader or page errors in Edge 157, mid-turn frames checked by screenshot. Not run: Firefox, the review suite, real devices.


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
