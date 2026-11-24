# Review request: HTML School Editor for Windows — stage 1 code (0.1.0-alpha.1) and the plan for stage 2

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository on 2026-11-24.

## What this is

A design and code review **before the first build**. The program replaces the single-file editor (`../html-school-editor/`) on Windows: a native C++20/Win32 program with the WebView2 engine, so that pictures and links resolve from the page's real place in the pupil's project folder. The reasons and the owner's decisions D1 to D8 are in [SPECIFICATION.md](SPECIFICATION.md).

**Nothing of the Windows part has ever been built with MSVC or run.** The owner will build it locally (D7). This review is meant to find design and code defects while they are still cheap, and to judge the plan for stage 2, one of whose decisions (E1) would change stage 1 before its first build.

Three parts, independent of each other. If a part cannot be carried out, record it as `NOT REVIEWED` with the reason and complete the others.

## State of the repository

* Branch `feature/html-school-editor-win-spec`, five commits on top of `main` (`0ca2fe6`); this request is the sixth. Not merged, no pull request, no release, no CI workflow.
* Folder `html-school-editor-win/`. Outside it: one row in the root `README.md`, one sentence in `../html-school-editor/AGENTS.md` (the shared modules).

```bash
git fetch --prune origin
git worktree add <new folder> -b review/html-school-editor-win-0.1.0-alpha.1 origin/feature/html-school-editor-win-spec
git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
```

| Part | Files | Lines |
| --- | --- | --- |
| Portable core | `src/core/json.*`, `src/core/paths.*` | 580 |
| Win32 host | `src/win/app.*`, `winutil.*`, `project.*`, `main.cpp`, `app.manifest`, `app.rc.in` | 1,400 |
| User interface | `ui/index.html`, `ui/style.css`, `ui/js/main.js`, `editor.js`, `checks.js`; shared modules of the single-file editor listed in `ui/resources.json` | 850 own |
| Build | `CMakeLists.txt`, `tools/fetch-webview2.ps1`, `tools/stage-ui.mjs`, `dependencies.json` | |
| Tests | `tests/core/core_tests.cpp`, `tests/ui/checks.test.mjs`, `tests/ui/ui.test.mjs` | |
| Documents | `docs/SPECIFICATION.md`, `ARCHITECTURE.md`, `ACCEPTANCE.md`, `STATUS.md`, `BUILD.md`, `STAGE2.md` | |

## Part 1: code of stage 1

### 1a. If you can build on Windows

If Visual Studio 2022 with C++ is available: follow [BUILD.md](BUILD.md). The SHA-256 of the WebView2 SDK is not pinned (`dependencies.json`); the fetch script prints it and stops. **Do not pin it yourself** — record the hash you saw in the report; the owner pins it. To build anyway, unpack the package by hand into `third_party/webview2/` (not committed). Then report every compiler error and warning, and try the steps at the end of BUILD.md, with a project folder on a network share if you have one. Build errors are expected: the code was only type-checked (1c).

### 1b. Reading review, in this order of weight

**Lost work (highest).**

* Conflict check before saving: `App::save` (`src/win/app.cpp:632`) compares a fingerprint (size and FNV-1a 64, `src/core/paths.cpp`) of the file now on disk with the one last read or written; on a difference it answers `conflict` and writes nothing. Check-then-write is two steps. Is the fingerprint kept right in every order (open → save, save as, new page, a save while another is busy, a page reopened)?
* Atomic write: `writeFileAtomic` (`src/win/winutil.cpp:80`): temporary file in the same folder, flush, `ReplaceFileW` (existing file) or `MoveFileExW` (new). On an SMB share: attributes, ACLs, a server that drops while replacing, a read-only file, the temporary name colliding, the folder watcher seeing the temporary file.
* The interface side: `ui/js/main.js` (`save`, `saved`, `saveProblem`, `whenSettled`, `closeRequest`): unsaved text must never be dropped without the pupil's answer; a save answer that arrives for a page that is no longer open.

**Protective design.** The page view must never run the page's scripts and never reach the network.

* Settings and handlers: `lockDown` (`app.cpp:301`), page view `createPreview` (`:386`): scripts off, web messages off, no new windows, downloads cancelled, permissions denied, DevTools off unless `HSE_TEST_HOOKS`.
* Requests of the page view: `onPreviewRequest` (`:820`) answers only `https://projekt.example/…`; everything else gets 403. Navigation: `NavigationStarting` (`:404`) allows only the navigation the program starts itself (`pvExpectNavigation_`). Can a page navigate the view, open something, or load from the network by any route (meta refresh, `<base>`, forms, `srcdoc`, `<object>`, CSS `@import` of another host, a service worker, prefetch hints, a `data:` or `blob:` document)?
* Paths: `requestSegments` (`src/core/paths.cpp:77`) refuses `..`, encoded slashes and backslashes, `:`, device names, trailing dots and spaces; `segmentsBelow` (`winutil.cpp:216`) for dialog results. **Known and not handled:** a junction or symbolic link inside the project folder is followed when a file is served (the project list skips such folders, `src/win/project.cpp:21`, the request handler does not). Short 8.3 names and alternate spellings of the same file.
* The user interface view: only its own resources from the exe (`onUiRequest`, `:914`), navigation pinned to its start page (`:364`). Its messages are parsed by the own JSON parser (`src/core/json.cpp`) and every path from them goes through `requestSegments` (`pathSegments`, `onUiMessage` `:497`). Is any value of a message used unchecked?

**Threads and lifetime.** File work runs on detached `std::thread`s that capture `this` and return by `PostMessageW` (`runLater`). Pending page-view requests keep their deferral in `pending_` and are completed on the window thread. Check: a request answered after a new page was loaded or the project changed; a worker finishing after the window was destroyed; `FolderWatcher::stop` (`project.cpp`); the file cache under its mutex (`app.cpp:81`); `busy_` for saves.

**WebView2 use.** Two controllers in one window; the page view is a child window laid over the interface view at a rectangle the interface reports in device pixels (`type == "layout"`, `app.cpp:519`). Is that z-order and DPI handling sound (monitor change, zoom, a dialog of the interface over the page view — the interface hides the page view while a dialog is open)? `ExecuteScript` on a view with scripts off (scroll position before and after a reload, `reloadPreview` `:795`). A custom host answered only by `WebResourceRequested` without a folder mapping. `AcceleratorKeyPressed` forwarding (`:444`).

**Code quality.** Errors that are swallowed; German messages that would confuse a 12-year-old; anything that writes outside `%LOCALAPPDATA%`, `HKCU` and the pupil's files.

### 1c. What the implementer measured

On 2026-11-24, Linux, not Windows:

```bash
cmake -S . -B build && cmake --build build && ctest --test-dir build   # core_tests: 84 checks, 0 failed (also with gcc and address/UB sanitizers)
node --test --test-concurrency=1 tests/ui/                             # 15 of 15 pass (headless Chromium, MOCK of the core)
# Windows sources: x86_64-w64-mingw32-g++ -std=c++20 -fsyntax-only -Wall -Wextra, against public WebView2 headers
# (a copy in another public repository), with compile-check shims for wrl/implements.h and WebView2EnvironmentOptions.h,
# which MinGW lacks: no errors, no warnings in the own files. A syntax and type check only.
```

The interface tests replace the C++ core by a labelled mock; they say nothing about the core, the page view or files. The acceptance criteria of [ACCEPTANCE.md](ACCEPTANCE.md) are all NOT MEASURED.

## Part 2: the plan for stage 2 ([STAGE2.md](STAGE2.md))

Stage 2 adds editing on the page side and "Code aufräumen" by reusing the single-file editor's modules. Please judge:

1. **E1: one WebView2 instead of two.** The interface would be served at `https://projekt.example/__hse__/`, the page side a frame with `sandbox="allow-same-origin"` at the page's own address — same origin as the interface, so the editing core can reach it. The only barrier between a pupil's page and the interface is then that page scripts never run (frame sandbox without `allow-scripts`, and a `script-src 'none'` header on every page response). Is that barrier enough? What else would a page have to be prevented from (navigation of the parent, `<base target>`, forms, plugins, `window.name`, storage shared with the interface)? Would you change stage 1 to one view before its first build?
2. **E2: two modes** — "Ansehen" (the real page) and "Bearbeiten" (the single-file editor's safe projection in a shell document served at the page's address). Is the projection with addresses resolved by the browser from the shell's address safe, given that the single-file editor's projection was reviewed for local files only?
3. **E5: sharing modules by reference** between the two folders (one copy, tests of both). The single-file editor is in class and gets defect corrections only (D5). Is the coupling acceptable, and how should a change be tested?
4. The order of work packages P0 to P5 and whether the single-file editor's 106 cases can really be ported to headless Chromium with a mock core.

## Part 3: documents

Do SPECIFICATION, ARCHITECTURE, ACCEPTANCE and STATUS describe what the code does, and does STATUS claim nothing that was not measured?

## Where the implementer is least sure

* The page view over the interface view (two controllers, z-order, DPI): never seen on a screen.
* `ReplaceFileW` and `ReadDirectoryChangesW` on the school's file server: unknown server; the watcher falls back to a scan on window activation.
* Junctions inside the project folder (see above).
* The reload of the page view after every pause in typing (flicker, scroll position with late pictures).
* `HSE_TEST_HOOKS` must never reach pupils; it is a CMake option, default off.

## What kind of review this is

Own code, offline. The program shows pupils' own HTML files; its design goal is that they are only displayed (no scripts, no network). No third-party system is involved. The WebView2 SDK is a build dependency named in `dependencies.json`.

## Delivery

1. A report in English with findings per part, each with severity, `file:line` and the requirement concerned (SPECIFICATION section or acceptance criterion); what was not reviewed.
2. A verdict for stage 1: `READY TO BUILD`, `CHANGE BEFORE BUILD` or `REDESIGN`; and a recommendation on E1.
3. Do not change the product on this branch. If anything is pushed: the repository publication check with no findings, and the ancestry check above.
