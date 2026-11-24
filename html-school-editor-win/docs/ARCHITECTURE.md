# Architecture (draft)

**State:** proposal of 2026-11-24, Q4 decided (D6). Nothing is built; names and boundaries may change with the owner's decision on Q5 of [SPECIFICATION.md](SPECIFICATION.md#7-open-questions).

## Overview

```
+---------------------------------------------------------------+
| Win32 main window (C++20)                                     |
|  +-----------------------------+  +-------------------------+ |
|  | WebView2 #1: user interface |  | WebView2 #2: page view  | |
|  | project list, code editor,  |  | the pupil's page from   | |
|  | top bar, messages           |  | its place in the folder | |
|  | (own HTML/JS from the exe)  |  | scripts off, no network | |
|  +--------------+--------------+  +------------+------------+ |
|                 | web messages (JSON)          | requests     |
|  +--------------v------------------------------v------------+ |
|  | C++ core: files, project folder, saving, request filter  | |
|  +----------------------------------------------------------+ |
+---------------------------------------------------------------+
```

Two WebView2 controllers in one window, both from one shared environment with a user data folder under `%LOCALAPPDATA%`.

## The page view: how relative addresses work

This is the point of the program.

1. The project folder is mapped to a virtual host name with `SetVirtualHostNameToFolderMapping`, for example `https://projekt.example/` → the chosen folder, access kind *deny CORS*. The engine then resolves every relative address of a page exactly as a web server would: `bilder/katze.jpg`, `../bilder/katze.jpg` inside the project, subfolders.
2. The page view navigates to the page's own address in that host, for example `https://projekt.example/seiten/tiere.html`.
3. The request for that one address is intercepted (`AddWebResourceRequestedFilter` and `WebResourceRequested`) and answered with the **current, unsaved text** of the code editor. All other requests (pictures, style sheets) are served by the folder mapping from disk.
4. After a pause in typing (about 0.3 s) the page view reloads; the scroll position is read before and restored after.

So the editor never resolves an address itself. The engine does it from the page's place, which is what pupils will see later in Edge.

The `.example` top-level domain is reserved and never reaches the network. A page opened with "Im Browser ansehen" runs as `file:` in the standard browser; for relative addresses inside the project folder both resolve to the same files.

## Request filter (security)

A filter on all requests of both controllers:

* page view: only `https://projekt.example/…` (the project folder) is allowed; everything else (other hosts, `file:`, `data:` documents for frames) gets an empty 403 response. `data:` pictures stay allowed.
* user interface: only the program's own resources (served from the exe's resources under a second virtual host) are allowed.
* Scripts off in the page view (`IsScriptEnabled = false`); new windows, downloads, permission requests, status bar, developer tools and the default context menu are switched off. Navigation of the page view away from the current page is cancelled; a link to another project page is reported to the user interface.

## User interface (WebView2 #1)

Owner's decision D6 (answer to Q4): own HTML, CSS and JavaScript, compiled into the exe as resources, reusing the source pane of the single-file editor (own code, MIT): line numbers, syntax colouring, undo and redo. Reasons:

* stage 2 (editing on the right) needs the tested JavaScript editing core of the single-file editor; it works against that source pane;
* no third-party component; the look and the German texts can be carried over;
* the same automated browser tests (Playwright over the Chrome DevTools Protocol, which WebView2 offers with `--remote-debugging-port` in test builds) can drive it.

Considered and not chosen: the native code editor component Scintilla with its lexer library (third-party, permissive licence, proven; ready search, indentation and folding). It would need a native user interface and a second editing model for stage 2, and its accessibility on Windows is weaker than a text field's.

## C++ core

| Part | Task |
| --- | --- |
| `app` | window, layout, divider, keyboard shortcuts, single message loop |
| `webview` | creation of both controllers, settings, request filter, virtual hosts |
| `bridge` | JSON messages between user interface and core (open, save, list, insert picture, state) |
| `project` | project folder, file list, change notification (`ReadDirectoryChangesW`), relative address from page to file, case check |
| `files` | read with encoding detection (UTF-8 with and without BOM, line endings), atomic write (temporary file and `ReplaceFileW`), conflict check by size, time and hash of the last read or written content |
| `dialogs` | system dialogs for folder, open and save (`IFileOpenDialog`, `IFileSaveDialog`) |
| `settings` | last project folder per Windows user (registry under `HKCU`) |

Plain Win32 and COM with `Microsoft::WRL::ComPtr` from the Windows SDK; no framework.

## Build

* CMake and MSVC (Visual Studio 2022 or its Build Tools), C++20, static runtime, x64.
* Third-party: the WebView2 SDK (NuGet package `Microsoft.Web.WebView2`, headers and the static loader library). Version, source, licence and SHA-256 are pinned in `dependencies.json`, as RULES.md requires for shipped components; the package itself is downloaded at build time, not committed.
* Unit tests for the pure parts (relative address, case check, encoding, conflict check) run without a window.
* Acceptance tests drive a test build of the exe through the DevTools protocol, with temporary project folders.

## Paths that need a test on school computers

Project folders on a network drive (UNC paths and mapped drive letters) and in OneDrive (cloud placeholders): the folder mapping, the change notification and the atomic replace may behave differently there.
