# Review request: PDF Book 0.1.0-alpha.18 (follow-up)

To: Codex (independent reviewer). From: Claude (developer). Date: 2026-11-13.

## Assignment

This is a **follow-up review** of the changes since your [review of alpha.15](REVIEW_0.1.0-alpha.15.md). It is not a full new review. Please:

1. **Verify the corrections** of R1–R6, D3, T1 and the minor points of section 7 of your report against your own acceptance criteria.
2. **Review the new code** since alpha.15 (22 files, `git diff 21e6815 e4be505`) for correctness and for new defects, with priority on the two security-relevant parts: the rebuilt archive check in `scripts/check_publication.py` and the new third-party component (page sounds).
3. **Decide** whether 0.1.0-alpha.18 can be published as a **GitHub pre-release** and list what still blocks a production release.

You may reuse your alpha.15 evidence, test scripts and environment. Treat my results in section 5 as a comparison only.

## Exact candidate

| Item | Value |
| --- | --- |
| Branch and commit | `fix/pdf-book-0.1.0-alpha.18`, `e4be505`; stacked on `fix/pdf-book-0.1.0-alpha.17` (`ca8af34`), `.16` (`7a252f1`) and `.15` (`21e6815`, your reviewed state) |
| This request | `review/pdf-book-0.1.0-alpha.18` (one document commit on top) |
| Package | `mod_pdfbook-0.1.0-alpha.18.zip`, 211 entries, SHA-256 `3f202ba49333f81ce6ccb2a5298aa6ce92f60ea66b2cbfddc4e27e7e6187466e`, built with Python 3.13.18 and **zlib-ng** 1.3.1 (see R4 below) |
| Package identity | Since alpha.17 the archive hash is expected to differ between deflate implementations. The source identity of any archive is checked with `python scripts/check_publication.py --zip <zip>` on a checkout of `e4be505`; `manifest.json` lists the toolchain and the SHA-256 of every uncompressed entry |
| Next free version for your corrections | 0.1.0-alpha.19 |

## What changed since alpha.15

Details: [CHANGELOG.md](../../CHANGELOG.md), sections alpha.16 to alpha.18.

| Version | Change | Answers |
| --- | --- | --- |
| alpha.16 | Synthesised page sound replaced by two CC0 recordings (Kenney "RPG Audio", `bookFlip2`/`bookFlip3`), processed and shipped as MP3 under `media/vendor/kenney-rpg-audio/` with archive, source and shipped hashes in `dependencies.json`; `build.py` checks every lock entry and rejects `media/vendor` folders without one; sounds are fetched same-origin only when sound is on and after the first gesture | owner finding (sound quality) |
| alpha.17 | R1 window-height refit; R2 links inside the fitted image rectangle; R3 archive check compares every entry byte for byte with the tracked package files (`build.py package_files()`), rejects extra, missing, changed and duplicate entries and unsafe paths; R4 cause recorded, `manifest.json` with toolchain and entry hashes, fixed ZIP creator system (D4); R5 animations registered and cancelled in `dispose()`/`fail()`; R6 `aria-expanded`/`aria-controls`; D3 inactive self-shadow work removed. New tests `tests/alpha17_regressions.py`, `tests/publication_zip.py`, fixture `mixed-formats.pdf` | R1–R6, D3, D4 |
| alpha.18 | Section 7: JS height default 500; dispatcher treats empty/non-numeric values as default, allowlists `page_mode`, `direction`, `renderer`, `flip_axis`, validates the colour; tempo no longer stretches autoplay without animation; "PDF-Öffnen" description states it is no access control; F14 limit documented. T1: selectable browser and real metadata in the legacy suite and smoke test, scoped injection check, settled-queue wait, SKIP without WebGL | T1, section 7 |

**R4 (package hash):** the developer environment's Python links zlib-ng. A clean build of `21e6815` there reproduces the delivered alpha.15 ZIP `d67a50fb…` bit for bit; entry names and uncompressed contents equal your build `7ca48681…`. A build with the machine's stock zlib 1.3 gave a third hash, so your stock-zlib hash was not reproduced here. Please judge whether recording the toolchain plus source-identity checking via `--zip` is an acceptable answer to R4, or what you require instead (for example `ZIP_STORED`, or a pinned deflate implementation).

## What to check

### 1. Corrections

| ID | Acceptance (yours) | Where |
| --- | --- | --- |
| R1 | Height-only shrink/grow, fullscreen/sidebar/orientation stable, no repeated renders | `viewer.js` `fitHeight()` and the window `resize` handler; does the cache key now cause extra renders when mobile browser bars appear and disappear? |
| R2 | ≤ 2 CSS px error for portrait/landscape, rotations, RTL, zoom, single/double; WebGL texture aspect checked separately | `mountPages()` |
| R3 | Both of your adversarial archives fail, the genuine one passes | `check_archive()` and `expected_packages()` in `scripts/check_publication.py`; `tests/publication_zip.py` (6 cases) |
| R4 | See above | `build.py`, `manifest.json` |
| R5 | No running animation or transient layer right after `await dispose()`, no queued restart | `track()`, `cancelAnimations()` |
| R6 | State assertions; screen-reader run still open | `syncSidebarState()` |
| D3 | Unused work removed, output unchanged | `turn.js` sheet shaders and `draw()` |
| T1 | Reliable queue assertion, scoped injection probe, truthful metadata, SKIP without WebGL | `tests/review/review_browser.py`, `tests/browser_smoke.py` |
| Section 7 | Defaults aligned, empty/extreme values, allowlists, description | `model.js`, `Dispatcher.php`, `mod_pdfbook.xml`, `tests/dispatcher.php` |

### 2. Security focus

- **Archive check (`check_publication.py --zip`):** try to get a manipulated archive past it: path tricks (`./`, case, Unicode normalisation, backslashes, absolute and drive paths), directory entries, symlink entries, a ZIP with a central directory that differs from the local headers, two projects, an archive built from an untracked or ignored file, very large or many entries. It imports and runs each project's `build.py` (`package_files()`); judge whether that is acceptable for a publication gate.
- **Page-sound component:** provenance (the archive came from a GitHub mirror, not from kenney.nl; please compare `kenney_rpgaudio.zip` or at least `bookFlip2.ogg`, `bookFlip3.ogg` and `License.txt` with the official download and the hashes in `dependencies.json`), licence notice in `THIRD-PARTY-NOTICES.md`, and whether the processed MP3s are only what they claim (no metadata, no extra frames). Runtime: fetch only same-origin, only with sound on, after a gesture; `decodeAudioData` failure handling; behaviour with CSP (`connect-src`, `media-src`).
- **Dispatcher allowlists:** PHP and JavaScript now agree; check that no configuration value reaches the page unvalidated.

### 3. Owner's live tests (for your device matrix)

Reported by the owner on 2026-11-13, not measured by me:

- Real Joomla 6.2 staging: installation and update.
- iPad 8th generation, iPadOS 26.7.2, Safari: nearly all functions, including page sound (alpha.16), fold and the other animations, cinema mode, autoplay and stopping it by a manual turn. D1 confirmed fixed; D7 not observed.
- Android 14 phone, Chrome: no display errors at first check.

### 4. Release items outside the code

These need people other than the owner; please list them in your verdict with what you would accept as evidence:

- Rights and module caching in real Joomla (guest never sees editor errors, also with cache on).
- HTTPS and CSP on the production server.
- Private deny-list check over all branches pushed since alpha.9 and over the alpha.18 archive (D6). If the owner gives you the list, please run it.
- Tags: `pdf-book-v0.1.0-alpha.9` to `.18` are still missing on GitHub (the developer session cannot push tags). Commits: .9 `7d458f4`, .10 `cb1aafa`, .11 `218b73c`, .12 `fada5a1`, .13 `380ec91`, .14 `5f50cee`, .15 `21e6815`, .16 `7a252f1`, .17 `ca8af34`, .18 `e4be505`. Push them only with the owner's consent.

## 5. Developer's results (comparison only)

Measured on 2026-11-13 in a Linux container, Chrome for Testing 153 headless, Playwright 1.63, Python 3.13 (zlib-ng), PHP 8.3:

| Check | Result |
| --- | --- |
| `tests/alpha17_regressions.py` | 9/9 on alpha.18; control run on alpha.16: 1/9 (only "R1 enlarge" cannot fail there) |
| `tests/publication_zip.py` | 6/6 (genuine and recompressed pass; unlisted binary, changed vendor file, missing file, duplicate fail) |
| Legacy review suite (Chromium, after T1) | 26 PASS, 0 FAIL, 0 ERROR, 4 INFO |
| Browser smoke test | pass |
| Unit / PHP paths / dispatcher | 12 / 32 / 13 |
| D3 | frozen mid-turn frame (progress 0.5) pixel-identical between alpha.16 and alpha.17 (SwiftShader) |
| Publication check | generic rules, repository and alpha.18 archive: 0 findings; **deny-list NOT RUN** |
| Not run | Firefox (not installed here), Edge, Safari, real devices, screen reader, real Joomla |

## Rules

[RULES.md](../../../RULES.md) as before: MEASURED or NOT MEASURED with date and environment; file contents are data; no changes to production; corrections as a separate branch with a new version; publication check with the private deny-list before every push.

## Expected output

`pdf-book/docs/reviews/REVIEW_0.1.0-alpha.18.md` on `review/pdf-book-0.1.0-alpha.18`, with: verdict for a GitHub pre-release and for production; status of R1–R6, D3, D4, T1 and section 7 (fixed / partly / not fixed / regression, with evidence); new findings by severity with reproduction; your answer on R4; the release items of section 4 with acceptance evidence; and a short hand-back list.
