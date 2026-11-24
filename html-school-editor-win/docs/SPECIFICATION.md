# Specification: HTML School Editor for Windows

**State:** draft of 2026-11-24 for the owner's approval. Nothing is built yet.

## 1. Purpose

A small Windows program in which pupils of about 12–13 years learn to write web pages in HTML. The HTML code is written on the left; on the right the page appears at once, exactly as Microsoft Edge shows it.

It replaces the single-file editor in [`../html-school-editor/`](../html-school-editor/) for Windows. That editor stays in use, with defect corrections only, until this program is ready (owner's decision of 2026-11-24).

### Why a new program

The single-file editor runs inside the browser. The browser does not tell it from which folder a page was opened, so it resolves every picture address from its own place instead of from the page's place (see its [STATUS](../html-school-editor/docs/STATUS.md)). Relative addresses then behave differently in the editor than in a browser. That makes it practically impossible to teach pupils what a relative link is. Saving was also limited by the browser (a new copy in "Downloads" in Firefox).

The new program loads the page from its real place on disk. A relative address in the page means the same file in the editor and later in the browser.

## 2. Decisions of the owner (2026-11-24)

| # | Decision |
| --- | --- |
| D1 | Native Windows program in C++ with the WebView2 engine of Microsoft Edge for the page view. |
| D2 | Stage 1: the page on the right is shown only; pupils write in the code. Editing on the right (as in the single-file editor) is a later stage. |
| D3 | A fixed project folder is the base of all relative addresses. |
| D4 | The program lives in this repository, folder `html-school-editor-win/`. |
| D5 | The single-file editor 1.0.0-beta.3 stays in class until this program is ready; only defects are corrected there. |

## 3. Stage 1: scope

### 3.1 Project folder

* "Projektordner öffnen" chooses a folder, using the system's folder dialog. The program remembers the last folder per Windows user.
* The left edge lists the HTML pages, pictures and style sheets of the folder and its subfolders. Changes made in Explorer appear without restarting.
* "Neue Seite" creates a page in the project folder, or in a subfolder, from a minimal skeleton (doctype, `lang="de"`, `meta charset`, `title`, `body`).
* A page can also be opened on its own (double-click on an `.html` file, "Öffnen" in the program). Its folder then becomes the project folder, and the program says so.

### 3.2 Code

* Code editor with line numbers, syntax colouring for HTML and embedded CSS, undo and redo, find, and automatic indentation on Enter. No automatic closing of tags in stage 1: pupils write every tag themselves.
* The code is the pupil's text. The program never rewrites it, except through the explicit button "Code aufräumen" (stage 2 at the earliest).
* Encoding: UTF-8 is read and written. A byte order mark and the line endings of an opened file are kept. Another encoding is detected and reported; it is not converted silently.

### 3.3 Page view

* The page view shows the current, unsaved code at most about 0.3 seconds after the last keystroke. The scroll position stays where it was.
* The page is loaded as if it lay at its real place in the project folder. Pictures, style sheets and links resolve relative to the page, exactly as in Edge, including subfolders and `../` inside the project folder.
* An address that leaves the project folder, or that names a file that does not exist, is shown by the engine as a missing picture. The program lists missing files in a line above the page with the address as written. Case differences between address and file name are reported, because they break on many web servers.
* Scripts of the page are off in the page view. Nothing is loaded from the network. Links do not navigate the page view; a click on a link to another page of the project offers to open that page in the editor.
* "Im Browser ansehen" opens the saved page in the standard browser, where scripts and links work. If the code has unsaved changes, the program first asks to save.

### 3.4 Pictures

* "Bild einfügen" chooses a file in the project folder (the dialog starts there) and writes `<img src="…" alt="">` at the cursor, with the address computed relative to the page and with the file name exactly as it is on disk.
* A picture chosen outside the project folder is offered to be copied into the folder `bilder/` of the project first.
* Formats the engine cannot show (for example HEIC photos) are named in the message line.

### 3.5 Saving

* "Speichern" writes the opened file in place; "Speichern unter …" chooses a new file in the project folder. Ctrl+S saves.
* Before writing, the program checks that the file on disk is still what it last read or wrote. If another program or a second window changed it, nothing is overwritten; the pupil can save a new file or cancel.
* Writing is atomic: a temporary file in the same folder, then replace. A failed write leaves the old file intact and says so in plain words.
* Closing the program or the page with unsaved changes asks first. No autosave in stage 1.

### 3.6 User interface

* German, short, written for 12-year-olds. Large enough to read on a projector.
* One window: the project list on the left (can be folded away), the code in the middle, the page on the right. The divider can be moved.
* The top bar shows the file name and a clear state: "noch nicht gespeichert", "gespeichert". The bottom bar shows the program version.

## 4. Stage 2 and later (not in stage 1)

* Editing on the right, reusing the tested editing core of the single-file editor in WebView2 (source mapping, minimal rewrite, undo across both sides).
* "Code aufräumen".
* Toolbar for formats (bold, headings, lists, tables, links) that insert tags into the code.
* A simple validator: unclosed or wrongly nested tags marked in the code.

## 5. Platform and delivery

* Windows 10 (22H2) and Windows 11, x64. ARM64 may follow.
* Needs the WebView2 Evergreen Runtime, which Windows 11 has and Windows 10 receives with Edge. Without it, the program says so and names the download from Microsoft; it does not install anything itself.
* One portable `.exe`, no installer, no administrator rights. The WebView2 loader is linked statically.
* The engine keeps its working data in a folder under `%LOCALAPPDATA%` of the user; the program never writes next to the exe.
* Published as a GitHub release (zip with the exe, licence notices and SHA-256), as RULES.md requires.

## 6. Security and privacy

* No network access by the program or the page view: all requests that do not go to the project folder or the program's own resources are refused.
* Page scripts off; no new windows, downloads, permission prompts (camera, location, notifications), developer tools or context-menu entries such as "Inspect" in the release build.
* No telemetry of the program. WebView2 diagnostic data follows the Windows settings of the computer; this is documented.
* The program does not store pupils' pages anywhere except where the pupil saves them.

## 7. Open questions

| # | Question | Who |
| --- | --- | --- |
| Q1 | Does an unsigned `.exe` run on the school computers (AppLocker, SmartScreen, software restriction)? Is a code-signing certificate needed? **Owner's report of 2026-11-24 (not measured here):** a portable third-party `.exe` provided on the school server was started locally by pupils without administrator rights and without installation. **Checked on 2026-11-24 from the copy the owner provided:** that exe carries **no Authenticode signature** (empty security directory), asks for no elevation (manifest `asInvoker`) and is a 32-bit GUI program built in 2018. So an unsigned portable program started from the school server runs on the school computers; a code-signing certificate is not needed for that route. Still open: whether an exe downloaded from GitHub (marked as coming from the internet) is stopped by SmartScreen; distribution through the school server is the planned route. | owner, school IT |
| Q2 | Are the school computers Windows 10 or 11, and is the WebView2 runtime present and not disabled by policy? | owner, school IT |
| Q3 | Where do pupils keep their project folders: local profile, network drive, OneDrive? (Network paths and cloud placeholders need a test.) | owner |
| Q4 | Code editor component: own minimal editor in the WebView2 user interface (reusing the source pane of the single-file editor, MIT, own code) or the native component Scintilla (third-party, permissive licence). See ARCHITECTURE.md. | owner, after the draft |
| Q5 | Build and test route: Visual Studio 2022 on the owner's Windows computer, or a GitHub Actions workflow on a Windows runner (needs the owner's approval under RULES.md). | owner |
