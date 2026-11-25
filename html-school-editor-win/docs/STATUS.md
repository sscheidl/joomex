# Status

**Version:** 0.1.0-alpha.4 · **Date:** 2026-11-25 · **State:** first code of stage 1 with corrections against lost work from the Codex review of stage 1 (report of 2026-11-25: CHANGE BEFORE BUILD) and line breaks kept break by break (owner's decision of 2026-11-25). Built with MSVC and started on Windows; the acceptance criteria are not measured as a whole, and the other findings of the review are open (see below).

## Decisions so far

The owner's decisions of 2026-11-24 are listed in [SPECIFICATION.md](SPECIFICATION.md#2-decisions-of-the-owner-2026-11-24): a native C++ program with the WebView2 engine; stage 1 shows the page only; a fixed project folder; this folder of the repository; the single-file editor stays in class with defect corrections only; the code editor is the own source pane of the single-file editor inside a WebView2 user interface (D6).

## Evidence from the school

| Date | Report | State |
| --- | --- | --- |
| 2026-11-24 | A portable third-party `.exe` provided on the school server was started locally by pupils without administrator rights and without installation. | owner's report. The file itself, checked here on 2026-11-24: no Authenticode signature, manifest `asInvoker`, 32-bit, built 2018. So unsigned portable programs run from the school server |
| 2026-11-24 | In the single-file editor, pictures one folder below the page work if the folder name is written; nested folders and folders above the page do not, and in one case a picture in the same folder as editor and page was not shown. | owner's report; the cause (resolution from the editor's place) is measured in [../html-school-editor/](../html-school-editor/), the single case is not explained |

## What exists

| Part | Files | State |
| --- | --- | --- |
| Portable core: request paths, relative addresses, case check, content types, unique names, fingerprint and its text form, base64, JSON | `src/core/` | MEASURED 2026-11-25 with MSVC (see the evidence below): `tests/core/core_tests.cpp`, 95 of 95 checks pass. Earlier also on Linux (clang 18 and gcc with sanitizers, 84 checks of alpha.1) |
| User interface: code field (shared modules of the single-file editor 1.0.0-beta.3: tokenizer, colouring, history, file decoding), project list, notes about addresses, search, dialogs, saving, pictures | `ui/`, list of served files `ui/resources.json` | MEASURED 2026-11-25 in headless Chromium (Playwright) with a MOCK of the core: `tests/ui/`, 27 of 27 tests pass (4 unit tests of the address checks, 6 of the line breaks, 17 browser tests) |
| Win32 host: window, two WebView2 views, request handler for the project folder with a worker thread and a cache, conflict check, atomic save, dialogs, folder watcher, settings | `src/win/` | builds and runs, see the evidence below. Only the save, open and new-page paths listed there are measured natively |
| Build | `CMakeLists.txt`, `tools/fetch-webview2.ps1`, `dependencies.json`, [BUILD.md](BUILD.md) | MEASURED on Windows, see below. The SHA-256 of the WebView2 SDK 1.0.4314.35 is pinned by the owner (2026-11-25); `tools/fetch-webview2.ps1` verified the local package against it and unpacked it for the alpha.4 builds |

Every Windows-side acceptance criterion (R-01 to R-09, P-01 to P-05, F-01 to F-06, X-01 to X-05) is NOT MEASURED as a whole; the native checks below cover single cases.

## Evidence on Windows

| Date | Exe | What was observed |
| --- | --- | --- |
| 2026-11-25 | 0.1.0-alpha.4, Release SHA-256 `15f200417862171cce753e1fd6686cb9ebb200679a5ac6f8b21844a127666147`, test build `439c0f699db38a30996717b230c06bbd9bd4b25bbf38a402ef6c6ff5e046f3a8` | Same environment as the row below; both build without warnings, 95 of 95 core checks. **F-07 MEASURED:** a UTF-8 file with BOM and `CRLF`, `LF`, lone `CR`, `CRLF`, `CRLF`, `LF` (and an umlaut) opened from the command line and saved without a change: byte for byte identical, not even written again (modification time unchanged). **F-08 MEASURED:** "!" typed after the text of the line that ends with `CR` (DevTools `Input.insertText`) and Enter before it (`Input.dispatchKeyEvent`), saved: the file equals the original with exactly the two typed bytes (`CR`, `!`) inserted, all other bytes identical; the last line deleted, Ctrl+Z, saved again: the saved bytes |
| 2026-11-25 | 0.1.0-alpha.3, Release SHA-256 `747ff5b72739796d2232fffd0f7faa82c638ddb460b803edaa69f972900f161e`, test build (`HSE_TEST_HOOKS`) `0d6a9c30dcf20dda12a2e0d676871dae5c46e3aa0a6d1fb04a94812e2648de98` | Windows 11 build 26300.10075, WebView2 runtime 158.0.4370.33, MSVC 19.44.35227 (Build Tools 2022), Windows SDK 10.0.26100, x64: both build without warnings. Test build with disposable files on a local NTFS drive, requests sent through the interface's bridge: a save with the opened base writes and answers the new base, no temporary or backup file left; a file changed by another program, a save without base and a deleted file give a conflict and write or create nothing; a read-only file and a file held open by another program without delete sharing give a German message, the old bytes stay, nothing left; a page over 5 MB is refused by the core; a new page is created with its base, an existing name is refused and the file is untouched; open answers carry the op and the base of the bytes read. Through the interface: save, save again, save then at once another page (opens after the answer, without a question, with its own name, text and state), close with unsaved text and "Speichern" (written, then closed) |
| 2026-11-25 | 0.1.0-alpha.2 working tree | Codex (review report): with a host acknowledgement held back three seconds in a measurement build, page B keeps its own name, text and state after a late answer of A, and the window stays open and asks again when the pupil typed during the save; both faults reproduced on alpha.1 with the same delay |
| 2026-11-24 | 0.1.0-alpha.1 | Codex (review report): builds without errors or warnings; images in the same, a child and a parent folder, local stylesheet, conflict after an external change, read-only file, picture from the project; `käse.html` leaves the page view on the previous page |

NOT MEASURED: school computers, mapped drive and UNC path, a network drive that disconnects or is slow while replacing, ACL and attribute behaviour on the school share, disk full, two monitors and zoom, the classroom trial. The exact moment of a late open answer was reproduced in the mock only.

## Corrections

### 0.1.0-alpha.4 (2026-11-25): line breaks break by break

Owner's decision of 2026-11-25: mixed line endings are kept. Until alpha.3 the interface turned every break into the one most common in the file (and said so in the message line), so a file with mixed `LF`, `CRLF` and `CR` changed on the first save. Now `ui/js/breaks.js` keeps the kind of every break as read and follows each change; the warning is gone. New acceptance criteria F-07 and F-08 (byte comparisons, [ACCEPTANCE.md](ACCEPTANCE.md#files)), both measured natively (table above). Tests: `tests/ui/breaks.test.mjs` (6) and `tests/ui/ui.test.mjs` "line breaks: mixed LF, CRLF and CR are saved byte for byte as they were read".

### 0.1.0-alpha.3 (2026-11-25): lost work, from the final Codex report

* **Open and new-page answers** could arrive in another order, replace text typed after the request, or bring a page of a project folder opened meanwhile. Now every request carries an `op`; the interface takes only the answer to its latest request and locks the code field until it comes; the core answers work of an older project folder with `openFailed`. Picture answers carry the `op` too and are inserted only into the page they were chosen for.
* **Baseline**: the core kept "the content last read or written" per path, so a late reopen could replace it, and a save with no known content wrote anyway. Now the fingerprint travels with the open page (`base`); the core writes only over that content and writes nothing without it.
* **Writing**: `ReplaceFileW` without a backup name loses the old file on some failures, and the temporary file was then deleted as well. Now with a backup name; after a failure the core looks at which file is where, puts the new or else the old content back, and keeps the backup if that fails. A save of a file deleted meanwhile is reported, no longer created. A new page and Save As to a new name use a rename that does not replace (no half-written file under the final name); the way out of a conflict ("Als neue Datei speichern") never replaces a file. Temporary names that are taken are retried. After any failed write the file is read again, so a write a network drive reported wrongly counts, and an uncertain state is said.
* **Size**: a page over 5 MB is no longer saved (interface and core), since the editor could not open it again.
* Details in [ARCHITECTURE.md](ARCHITECTURE.md#messages-between-user-interface-and-core).

Tests: `tests/ui/ui.test.mjs` "opening: only the answer to the latest request is taken; the code field is locked meanwhile", "saving: the base of the open page goes with every save; out of a conflict only a new file", "pictures: an answer for a page that is no longer open is not inserted"; `tests/core/core_tests.cpp` fingerprint text; native checks in the table above.

### 0.1.0-alpha.2 (2026-11-24): the two save answers

* **Close after an older save** (lost work): the answer to the save chosen on closing closed the window even if the pupil had typed on meanwhile. Now the answer is checked again: with new text the question comes again, and the window closes only when everything is saved. A failed save keeps the window open.
* **Answer to the save of another page** (lost work): the late answer of A gave B's text the name of A. Now opening, another folder or closing waits for the save on its way, and every save carries an `id` the core sends back; answers to any other save or page are ignored.

## Open findings of the Codex review (2026-11-25)

Not corrected yet, by weight: one file boundary for all reads and writes that handles junctions and other reparse points (High); request filter, frame policy and failing closed when the protection cannot be set up (High); `käse.html` leaves the page view on the previous page (High, cause not examined); worker threads and request deferrals after the window closes (High); stale preview requests and scans after a switch (High); system dialogs shown inside the web-message callback, watcher restart (High); further Medium and Low findings and the corrections of the documents listed in the report.

## Known gaps of this first code

* Reload of the page view: every pause in typing reloads the page; it may flicker, and pictures that load late can move the restored scroll position.
* The conflict check reads the file and then replaces it; another program can still write in the moment between (no stronger guarantee without locking the file).
* The notes name a missing file by its place in the project (`bilder/Hund.png`), not by the address as written in the code (`../bilder/Hund.png`).
* Third-party notices: the licence text of the WebView2 SDK is added after the first download (the loader library is linked into the exe).
* No application icon.

## Build environment

Built and run on Windows 11 with the Visual Studio 2022 Build Tools (see the evidence above); the portable core also builds on Linux. The school computers get only the `.exe` (D7), see [BUILD.md](BUILD.md).

## Next step

The Codex review recommends keeping two WebView2 views (E1 not adopted) and correcting stage 1 before stage 2: next the file boundary and the protection of the page view, then a small native acceptance baseline.
