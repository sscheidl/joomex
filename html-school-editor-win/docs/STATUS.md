# Status

**Version:** 0.1.0-alpha.1 (not built yet) · **Date:** 2026-11-24 · **State:** first code of stage 1; never built with MSVC and never run on Windows.

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
| Portable core: request paths, relative addresses, case check, content types, unique names, fingerprint, base64, JSON | `src/core/` | MEASURED 2026-11-24 (Linux, clang 18 and gcc with address and undefined-behaviour sanitizers): `tests/core/core_tests.cpp`, 84 of 84 checks pass |
| User interface: code field (shared modules of the single-file editor 1.0.0-beta.3: tokenizer, colouring, history, file decoding), project list, notes about addresses, search, dialogs, saving, pictures | `ui/`, list of served files `ui/resources.json` | MEASURED 2026-11-24 in headless Chromium (Playwright) with a MOCK of the core: `tests/ui/`, 15 of 15 tests pass (4 unit tests of the address checks, 11 browser tests) |
| Win32 host: window, two WebView2 views, request handler for the project folder with a worker thread and a cache, conflict check, atomic save, dialogs, folder watcher, settings | `src/win/` | NOT BUILT with MSVC, NOT RUN. Type-checked on Linux with the MinGW cross compiler against public WebView2 headers, with compile shims for two WRL headers MinGW lacks: no errors, no warnings in our files. That is a syntax and type check only |
| Build | `CMakeLists.txt`, `tools/fetch-webview2.ps1`, `dependencies.json`, [BUILD.md](BUILD.md) | the portable part configures and builds with CMake on Linux; the Windows part is NOT MEASURED. The SHA-256 of the WebView2 SDK is not pinned yet |

Not built yet from stage 1: nothing that the specification lists is left out on purpose, but every Windows-side criterion (R-01 to R-09, P-01 to P-05, F-01 to F-06, X-01 to X-05) is NOT MEASURED.

## Known gaps of this first code

* Reload of the page view: every pause in typing reloads the page; it may flicker, and pictures that load late can move the restored scroll position.
* The conflict check reads the file and then writes it; another program can still write in between (as in the single-file editor).
* The notes name a missing file by its place in the project (`bilder/Hund.png`), not by the address as written in the code (`../bilder/Hund.png`).
* Third-party notices: the licence text of the WebView2 SDK is added after the first download (the loader library is linked into the exe).
* No application icon.

## Build environment

The implementer's environment is Linux without MSVC; the WebView2 SDK cannot be downloaded there. Building and running happen on the owner's Windows computer (D7), see [BUILD.md](BUILD.md).

## Next step

The owner fetches the WebView2 SDK (pins its hash), builds with Visual Studio 2022 and tries the steps at the end of [BUILD.md](BUILD.md). Build errors and observations come back to the implementer; then the acceptance tests on Windows (DevTools protocol against a test build).
