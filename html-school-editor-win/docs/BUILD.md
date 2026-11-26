# Building on Windows

Decision D7: the program is built locally with Visual Studio 2022. Nothing here is needed on the school computers; they get only the `.exe`.

## Once

1. Visual Studio 2022 (Community is enough) or the "Build Tools for Visual Studio 2022", with the workload **Desktop development with C++** (it brings MSVC, the Windows SDK and CMake).
2. Node.js 20 or newer, only for the tests of the user interface (`npm` is not needed; the tests use Node's own test runner and Playwright, see below).

## WebView2 SDK

In PowerShell, in the folder `html-school-editor-win`:

```powershell
powershell -ExecutionPolicy Bypass -File tools\fetch-webview2.ps1
```

The script downloads the package named in `dependencies.json` from nuget.org (or uses it if it already lies in `third_party/`), checks it against the pinned SHA-256 (pinned by the owner on 2026-11-25 after checking the first download) and refuses any package with another hash. The package is unpacked to `third_party/webview2/`, which is not committed. A new SDK version needs a new check of the package (source nuget.org, publisher Microsoft, `LICENSE.txt` in it) and a new pinned hash.

## Build

In the "Developer PowerShell for VS 2022", in the folder `html-school-editor-win`:

```powershell
cmake -S . -B build -G "Visual Studio 17 2022" -A x64
cmake --build build --config Release
ctest --test-dir build -C Release
```

The program is `build\Release\HtmlSchulEditor.exe`. It needs no other file: the user interface is inside the exe, the C++ runtime is linked statically, and the WebView2 runtime is part of Windows.

A test build for the automated acceptance tests (DevTools and a debugging port, never for pupils):

```powershell
cmake -S . -B build-test -G "Visual Studio 17 2022" -A x64 -DHSE_TEST_HOOKS=ON
cmake --build build-test --config Release
$env:HSE_DEBUG_PORT = 9222; .\build-test\Release\HtmlSchulEditor.exe
```

In the test build, `HSE_TEST_SAVE_DELAY_MS` holds the answer to every ordinary save back by that many milliseconds, so a test can type while a save is on its way (criterion F-09):

```powershell
$env:HSE_TEST_SAVE_DELAY_MS = 2000
```

Use `HSE_TEST_PREVIEW_DELAY_MS=2400` in a test build to hold preview asset replies after disk access for navigation and close tests (P-06 and F-11). Allow a delayed reply to finish after changing pages or closing the window.

Use `HSE_TEST_RESOLVE_DELAY_MS=5000` in a test build to make resolving the project folder slow, as on a network drive, and check that the window keeps answering (F-13).

## Tests without Windows

The portable core and the user interface can be tested on any computer:

```bash
cmake -S . -B build && cmake --build build && ctest --test-dir build   # core: paths, addresses, JSON
node --test --test-concurrency=1 "tests/ui/*.test.mjs"                  # interface in Chromium, with a mock of the core
```

The interface tests need Playwright with Chromium (`npm install -g playwright` and `npx playwright install chromium`). They replace the C++ core by a labelled mock; the real core, the page view and files are not part of them.

## What to try by hand after a build

1. Start the exe from a folder on the school server and from a local folder (X-01).
2. Open a project folder on the network drive with pages in subfolders and pictures in `bilder/`; check R-01 to R-03 and that a page with `../bilder/…` shows its pictures.
3. Type in the code: the page follows after a short pause and keeps its scroll position.
4. Save; change the file in Notepad; save again in the editor: it must not overwrite (F-02).
5. "Bild einfügen" from the project folder and from outside it (copy into `bilder/`).
6. "Im Browser ansehen": Edge shows the same pictures.
