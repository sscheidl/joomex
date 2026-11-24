# Architecture (draft)

**State:** 2026-11-24; decisions D6 to D8 of [SPECIFICATION.md](SPECIFICATION.md#2-decisions-of-the-owner-2026-11-24) applied.

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

1. The project folder is served under a reserved host name, `https://projekt.example/`. The page view navigates to the page's own address in that host, for example `https://projekt.example/seiten/tiere.html`, so the engine resolves every relative address of the page exactly as a web server would: `bilder/katze.jpg`, subfolders, and `../bilder/katze.jpg` inside the project.
2. Every request to that host is answered by the program (`WebResourceRequested` with a deferral). The request for the page itself gets the **current, unsaved text** of the code editor; every other request gets the file from the project folder.
3. After a pause in typing (about 0.3 s) the page view reloads; the scroll position is read before and restored after (`ExecuteScript` runs even though page scripts are off).

So the program never resolves an address itself; the engine does it from the page's place, which is what pupils will see later in Edge. The `.example` top-level domain is reserved and never reaches the network.

### Why the program serves the files itself (network drive, D8)

`SetVirtualHostNameToFolderMapping` would serve the folder too, but project folders lie on a network drive, and the program needs to know about every request:

* **Reads off the user interface thread.** A file is read by a worker thread; the response is created on the user interface thread when the bytes are there. A slow server never freezes the window.
* **Cache.** Files are kept in memory (limit 64 MB) and served again while size and modification time are unchanged, so a reload after each pause in typing does not read every picture over the network again.
* **Missing files and case.** A file that is not there is answered with 404 and reported to the user interface with the address as requested. A file that exists only with other upper and lower case (Windows finds it, a web server would not) is served and reported.
* **Boundary.** The URL parser of the engine removes `..` above the host root, so `../../x.png` from a page one folder deep arrives as `/x.png`. Addresses that leave the project folder are therefore found by the user interface, which reads the addresses in the code (see below), not by the request handler.

What the network drive changes elsewhere: the change notification (`ReadDirectoryChangesW`) is not reliable on every server, so the project list is also scanned again when the window is activated; saving checks the file's content, not only its time stamp, because time stamps of network drives are coarse.

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

## Messages between user interface and core

JSON objects with a `type`; paths are project paths with `/` (`seiten/tiere.html`), checked by the core with `requestSegments` before use. Code: `src/win/app.cpp` (`onUiMessage`) and `ui/js/main.js` (`handlers`).

| From the interface | Meaning | Answer |
| --- | --- | --- |
| `ready` | the interface has loaded | `init` (version); the last project folder is opened again if it can be reached |
| `layout` {visible, x, y, w, h} | where the page view lies, in device pixels; hidden while a dialog is open | — |
| `preview` {path, text} | the current, unsaved text, after a pause in typing | `missing` {path, items} after the page view has loaded |
| `openProject`, `openDialog`, `openFile` {path} | choose a folder, open a page with the dialog, open a page of the list | `projectChanged`, `project` {name, files}, `opened` {path, name, data (base64)} |
| `newPage` {path, text} | create a page that must not exist yet | `opened` |
| `save` {path, text} | write the encoded text (BOM and line endings as opened) | `saved`, `conflict` {kind: changed \| deleted}, `saveFailed` {message} |
| `saveAs` {path, text} | save dialog in the folder of the page; only inside the project | `saved` {path, name}, `saveCancelled` |
| `pickPicture` {page}, `copyPicture` {token, page} | picture dialog; a picture outside the project is copied into `bilder/` after asking | `picture` {src}, `pictureOutside` {name, token} |
| `viewInBrowser` {path} | open the saved file in the standard browser | — |
| `closeOk` | the window may close (answer to `closeRequest`) | — |

The core also sends `link` {path, isPage} when a link in the page view is clicked, `shortcut` {key} for Ctrl+S, Ctrl+F and F3 pressed in the page view, `status` and `error`.

## C++ core

| Part | Task |
| --- | --- |
| `app` | window, layout, divider, keyboard shortcuts, single message loop |
| `webview` | creation of both controllers, settings, request filter, virtual hosts |
| `bridge` | JSON messages between user interface and core (open, save, list, insert picture, state) |
| `project` | project folder, file list, change notification (`ReadDirectoryChangesW`) and scan on activation, request paths, relative address from page to file, case check, file cache |
| `files` | read and write bytes; atomic write (temporary file and `ReplaceFileW`); conflict check by a fingerprint of the content last read or written. Text decoding (UTF-8, BOM, line endings, Windows-1252 detection) is done by the user interface with the tested functions of the single-file editor |
| `dialogs` | system dialogs for folder, open and save (`IFileOpenDialog`, `IFileSaveDialog`) |
| `settings` | last project folder per Windows user (registry under `HKCU`) |

Plain Win32 and COM with `Microsoft::WRL::ComPtr` from the Windows SDK; no framework.

## Build

* CMake and MSVC (Visual Studio 2022 or its Build Tools), C++20, static runtime, x64.
* Third-party: the WebView2 SDK (NuGet package `Microsoft.Web.WebView2`, headers and the static loader library). Version, source, licence and SHA-256 are pinned in `dependencies.json`, as RULES.md requires for shipped components; the package itself is downloaded at build time, not committed.
* Unit tests for the pure parts (relative address, case check, encoding, conflict check) run without a window.
* Acceptance tests drive a test build of the exe through the DevTools protocol, with temporary project folders.

## Paths that need a test on school computers

Project folders on the school's network drive, as a mapped drive letter and as a UNC path: reading speed with many pictures, the change notification, the atomic replace, and a server that disconnects while saving. OneDrive is not used by pupils (D8).
