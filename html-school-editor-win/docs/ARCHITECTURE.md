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

The program percent-encodes each UTF-8 path segment of its own navigation and of addresses inserted by the picture dialog. The engine resolves relative addresses from the page's place. The request policy below blocks use of the network.

### Why the program serves the files itself (network drive, D8)

`SetVirtualHostNameToFolderMapping` would serve the folder too, but project folders lie on a network drive, and the program needs to know about every request:

* **Reads and responses.** Separate bounded pools handle project file work and preview reads. Only the window thread touches WebView2 and completes request deferrals. A superseded request is completed with an explicit empty response. Large or slow projects can delay reads, and initial resolution of the selected project or a native dialog can still involve a network wait.
* **Cache.** Each accepted preview load owns a cache of up to 64 MB. Repeated reads in that load reuse bytes when the checked file identity, size and time match. Reloads read afresh, including from a share. Older workers may finish with their former cache, which the new load does not use.
* **Missing files and case.** A file that is not there is answered with 404 and reported to the user interface with the address as requested. A file that exists only with other upper and lower case (Windows finds it, a web server would not) is served and reported.
* **Boundary.** The URL parser of the engine removes `..` above the host root, so `../../x.png` from a page one folder deep arrives as `/x.png`. Addresses that leave the project folder are therefore found by the user interface, which reads the addresses in the code (see below), not by the request handler.
* **Links in the project folder.** A path built from checked segments can still lead elsewhere through a junction or symbolic link. Every read opens the file and asks the file system where the handle really leads (`GetFinalPathNameByHandleW`, all links followed); only a file inside the project folder as the file system resolves it is read, through that same handle, so nothing can be swapped in between (`CheckedFile` in `src/win/winutil.cpp`). That holds for the page view (also for cached files: the cache spares only the reading), opening, the check before saving and "Im Browser ansehen". Before a write, the folder that receives the file is checked the same way, and new folders are created only below a folder that resolves inside the project (`checkParentWithin`, `createFoldersWithin`); replacing that folder by a link in the moment between check and write is not caught. A file chosen in a system dialog counts as inside the project only if it also resolves inside it (`projectSegments`). The project list leaves out junctions, symbolic links and mount points (name-surrogate reparse points), files and folders alike. If the project folder cannot be resolved (network drive not reachable), nothing in it is read or written.

The folder watcher follows the current project on its own thread and retries if it loses its watch. The project list is also scanned on window activation. Project and scan generations keep old results from replacing the current list. Saving still checks file content because network-drive timestamps can be coarse.

## Request filter (security)

Layers, from the outside in (`src/win/app.cpp`: `createEnvironment`, `lockDown`, `filterAllRequests`, `onPreviewRequest`):

* **No name resolution.** The WebView2 environment starts with `--host-resolver-rules="MAP * ~NOTFOUND"` and `--disable-background-networking`, and SmartScreen lookups are off (`IsReputationCheckingRequired = false`). Both views only talk to virtual hosts that the program answers, so they need no name resolution; anything the filter might not see (resource hints, background services of the runtime) finds no host. Addresses written as IP numbers are not covered by this layer; the filter and the policy below refuse them.
* **Every request to the handler.** Both views register their filter with `AddWebResourceRequestedFilterWithRequestSourceKinds` for all resource contexts and all request sources (documents, frames, workers). A runtime without that interface (`ICoreWebView2_22`) is not used.
* **Fail closed.** Every protecting setting and handler is checked: scripts off in the page view (read back after setting), web messages, developer tools (release build), the context menu, new windows, permissions, downloads, the request filter and the navigation handlers. If one fails, the page view stays off (and the interface, for its own set, closes the program). If a request of the page view cannot be answered (no response could be created or set), the page view is switched off at once instead of letting the engine fetch the request itself.
* **Page view, what is answered.** Only `GET`. Documents only for the page being edited, with its unsaved text and a `Content-Security-Policy` header (`default-src 'none'`; pictures, styles, fonts and media from the project folder and `data:`; no scripts, objects, frames, workers, connections or forms; `base-uri 'self'`). Pictures, style sheets, fonts, media and text tracks from the project folder (through the project boundary, see above). Everything else, including other documents (frames), scripts, fetches and manifests, gets an empty 403 or 405; other hosts and schemes an empty 403.
* **Page view, navigation.** Frames never navigate (`FrameNavigationStarting` is cancelled), so a frame in a pupil's page shows nothing. The page view itself navigates only to the page the program loads; every other navigation is cancelled. Only a navigation the pupil started by a click (`IsUserInitiated`) offers to open another project page or says that internet links open only in the browser; a page that tries to go somewhere by itself (meta refresh, a form) is just stopped.
* **User interface.** Only the program's own resources (from the exe, under a second virtual host); no other navigation, frames never navigate.
* New windows, downloads, permission requests, status bar, the default context menu (page view) and developer tools (release build) are off. The host itself runs one script in the page view after a reload (`scrollTo` with two numbers), which works with page scripts off; it is built from numbers only.

## Editing on the page side (stage 2, 0.1.0-alpha.15)

The plan, with the owner's decisions, is in [STAGE2.md](STAGE2.md). When a page opens, the right side shows an editable projection, if the source allows one. Otherwise it falls back to the page view of stage 1 (`ui/js/visual.js`).

* **The frame.** `https://app.example/edit-frame.html` is served with `sandbox allow-same-origin` and a content policy with `script-src 'none'` in the response header, and again in its `<meta>`. The `<iframe>` has `sandbox="allow-same-origin"`. Frame navigation is allowed only to that address.
* **The projection.** `renderView` of the shared `project.js` builds it from admitted elements and attributes only. It drops event attributes, `srcdoc`, `target`, form targets and named elements, and the interface never inserts raw markup.
* **Assets.** The frame's requests to `https://projekt.example/` reach `onUiRequest` and go on to `onPreviewRequest` in edit mode. Only images (image context, image type) and style sheets (style sheet context, `text/css`) are admitted, through `CheckedFile`, on their own workers (`editWorkers_`), with their own cache and pending list. Answers are tied to the project generation.
* **Messages.** The core accepts web messages only from the interface's own top-level document (`get_Source`).
* **One document.** Changes from the page side go through `editor.editFromPage`, into the history of raw texts and through `breaks.follow`. A page-side edit that is still open (a title typed but not confirmed, an unfinished composition) is applied by `visual.flush()` before every decision about saving, a rescue copy, opening another page or folder, "Im Browser ansehen" and closing (this includes a logoff).

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
| `openProject` | choose a folder | `projectChanged`, `project` {name, files} |
| `openDialog` {op}, `openFile` {op, path} | open a page with the dialog (a page outside the project opens its folder as the project) or from the list | `opened` {op, seq, path, name, base, data (base64)} (`seq` counts the pages handed over), `openFailed` {op, title?, message?} (no title: cancelled or out of date) |
| `newPage` {op, path, text} | create a page that must not exist yet | `opened` {op, …}, `openFailed` {op, title, message} |
| `save` {id, path, text, base} | write the encoded text (BOM and every line break as read) over the file the page was read from | `saved` {id, base}, `conflict` {id, kind: changed \| deleted}, `saveFailed` {id, message} |
| `saveAs` {id, path, text, base, createOnly?} | save dialog in the folder of the page; only inside the project. `createOnly` (the way out of a conflict): no overwrite question, an existing file is refused | `saved` {id, base, path, name}, `saveFailed` {id, message}, `saveCancelled` {id} |
| `pickPicture` {op, page}, `copyPicture` {op, token, page} | picture dialog; a picture outside the project is copied into `bilder/` after asking | `picture` {op, src}, `pictureOutside` {op, name, token} |
| `viewInBrowser` {path} | open the saved file in the standard browser | — |
| `closeOk` | the window may close (answer to `closeRequest`) | — |
| — | — | `editViewFailed`: the core could not answer a request of the editable projection; the interface switches to the read-only page view for the rest of the session |
| `rescue` {id, path, text} | while a save hangs: write the encoded text to a new local file (`%LOCALAPPDATA%\HtmlSchoolEditor\Rettungskopien`, `<name>_<date>_<time>.html`, the name cut to 60 characters), on its own worker, without the project folder. No other place: if that folder cannot be used, the copy fails | `rescued` {id, page, path (full local path)}, `rescueFailed` {id, page, message} |
| `unsaved` {value, open, seen} | whether text could be lost (unsaved, or a save on its way), whether a page is open, and `seen`: every `opened` up to that `seq` has been handled, taken or refused (a page still being handled, for example while the question about its encoding is open, holds `seen` below its `seq`); sent when any of them changes and taken by the core at once, not through the window queue. A page counts as open for the core from the moment it sends `opened`; a report of "no page" counts only if its `seen` is that page's `seq`. While a page is open the core refuses a logoff or shutdown query with a reason and sends `closeRequest` | — |

Rules that keep a pupil's work (`ui/js/main.js`, `src/win/app.cpp`):

* **Answers belong to their request.** Every answer to `save` and `saveAs` carries the `id`, every answer to opening, a new page and pictures the `op` of its request. The interface takes only the answer to the save it waits for, for the page that was saved, and only the answer to its latest open request; a picture is inserted only into the page it was chosen for. The core counts project folders and answers work started for an older folder with `openFailed` (opening) or not at all (pictures).
* **One file dialog per window.** `openProject`, `openDialog`, `saveAs` and `pickPicture` open a system dialog. The core claims the dialog when the message arrives, before it waits in the window queue, and refuses a second dialog request until the first dialog has closed (`openFailed` without a title, `saveCancelled`, or nothing). After every dialog request it sends `dialogDone`; until then the interface locks its dialog actions.
* **A late page choice switches nothing.** The core remembers the latest open request (`openDialog`, `openFile`, `newPage`). A chosen file is checked on a worker; if another open request or another project folder came meanwhile, the answer is dropped (`openFailed`), so a file outside the project never switches the project folder and closes the page open now.
* **Questions take turns.** The interface shows one question at a time; others wait in line, and each reads its own answer when its dialog closes. A `closeRequest` that comes while a question is open is kept and answered after it.
* **Nothing typed is replaced.** While a page is on its way the code field is locked. While a save is on its way, opening another page, another folder or closing the window waits for its answer and is then checked again: text typed during the save leads to the question about unsaved changes once more (`whenSettled`).
* **The base belongs to the open page.** `base` is the fingerprint (size and FNV-1a 64) of the file as the open page was read or last saved; the interface keeps it with the page and sends it with every save. The core writes only if the file on disk still has this fingerprint (or already holds the new content); without a base it writes nothing. A deleted file is reported, never created again by a save.
* **Line breaks.** The code field knows only LF. `ui/js/breaks.js` keeps the kind of every break as read (LF, CRLF, lone CR) and follows each change: breaks outside the changed part stay, a break typed into a line gets the kind of the break that ends that line, and a text that is again exactly the text as read or last saved gets its breaks back. Each state keeps its own breaks: the undo history stores raw texts (every break as in the file, `ui/js/editor.js`), so an undo step brings back exactly its breaks, and every save takes the raw text it sends; its confirmation records that text as saved without touching what the pupil typed meanwhile (`ui/js/main.js`). So open and save without a change, undo to any step and a late confirmation give the bytes that belong to them. A lone `CR` is never written directly before an `LF` break (a reader takes the two bytes as one `CRLF`, so a line would be lost); that `LF` is written as `CRLF`.
* **Writing.** A temporary file in the same folder, flushed, then `ReplaceFileW` with a backup name for an existing file, or a rename that does not replace for a new one (new page, Save As to a new name). After a failed `ReplaceFileW` the core looks at which file is where, puts the new content (or else the old) back under the name and keeps the old content under its backup name if neither works; it never deletes that backup after a failure. After any failure it reads the file again: if the new content is there the save counts as done, otherwise the message says what is known. Pages larger than 5 MB are not saved, since they could not be opened again.
* **Limits.** The check and the replacement are two steps; a change by another program in the moment between them is not noticed. Metadata policy: content first; attributes and ACL of the old file are carried over where the file system allows it, otherwise the file keeps what the folder gives it. An ambiguous result on a network drive that disconnects during the replacement is reported as uncertain; it is not measured (no access to the school server).

The core also sends `link` {path, isPage} when a link in the page view is clicked, `shortcut` {key} for Ctrl+S, Ctrl+F and F3 pressed in the page view, `status` and `error`.

The bridge queues its work on the window thread. File dialogs open after the WebView2 message callback returns. While a dialog runs its own message loop, queued actions wait in order. At shutdown the window stops receiving queued results and completes outstanding preview deferrals before closing the controllers. Queued reads are discarded and running reads are asked to cancel. Accepted writes finish. Workers are joined after the window message loop ends.

## C++ core

| Part | Task |
| --- | --- |
| `app` | window, layout, divider, keyboard shortcuts, single message loop |
| `webview` | creation of both controllers, settings, request filter, virtual hosts |
| `bridge` | JSON messages between user interface and core (open, save, list, insert picture, state) |
| `project` | project folder, file list, change notification (`ReadDirectoryChangesW`) and scan on activation, request paths, relative address from page to file, case check, file cache |
| `files` | read and write bytes; atomic write (temporary file, `ReplaceFileW` with a backup name, or a rename without replacing for new files); conflict check against the fingerprint the open page was read with. Text decoding (UTF-8, BOM, Windows-1252 detection) is done by the user interface with the tested functions of the single-file editor; the line breaks are kept one by one by `ui/js/breaks.js` |
| `dialogs` | system dialogs for folder, open and save (`IFileOpenDialog`, `IFileSaveDialog`) |
| `settings` | last project folder per Windows user (registry under `HKCU`) |

Plain Win32 and COM with `Microsoft::WRL::ComPtr` from the Windows SDK; no framework.

## Build

* CMake and MSVC (Visual Studio 2022 or its Build Tools), C++20, static runtime, x64.
* Third-party: the WebView2 SDK (NuGet package `Microsoft.Web.WebView2`, headers and the static loader library). Version, source, licence and SHA-256 are pinned in `dependencies.json`, as RULES.md requires for shipped components; the package itself is downloaded at build time, not committed.
* Unit tests for the pure parts (relative address, case check, encoding, conflict check) run without a window.
* Acceptance tests drive a test build of the exe through the DevTools protocol, with temporary project folders.

## Paths that need a test on school computers

Project folders on the school's network drive, as a mapped drive letter and as a UNC path: reading speed with many pictures, the change notification, the atomic replace, and a server that disconnects while saving. Pupils do not use cloud storage for their projects (D8).
