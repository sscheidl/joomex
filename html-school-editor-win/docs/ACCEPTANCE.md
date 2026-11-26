# Acceptance criteria, stage 1 (draft)

**State:** draft of 2026-11-24 for the owner's approval. Each criterion gets an automated test where the test harness can drive it; the rest is a written hand test. Results are recorded as `MEASURED` (date, Windows build, WebView2 runtime version, exe hash) or `NOT MEASURED`.

## Relative addresses (the reason for this program)

| # | Criterion |
| --- | --- |
| R-01 | A picture `katze.png` next to the page is shown. |
| R-02 | `bilder/katze.png` and `bilder/tiere/katze.png` are shown from the subfolders of the page's folder. |
| R-03 | A page in `seiten/` shows `../bilder/katze.png` from the project folder. |
| R-04 | The same address in the same page shows the same picture in the page view and, after saving, in Edge opened by "Im Browser ansehen". Tested for R-01 to R-03. |
| R-05 | An address that leaves the project folder (`../../x.png` above the project) is not shown; the message line names it. |
| R-06 | A missing file and a case difference (`Katze.png` for `katze.png`) are named in the message line with the address as written. |
| R-07 | A style sheet `css/stil.css` and a picture named in it (`url(../bilder/x.png)`) are applied and shown. |
| R-08 | Open, edit, save and reopen a page in folders with umlauts, `ß`, spaces, `#` and literal `%`. The source pane and page view show the same document. Relative images and CSS load. The picture dialog writes the percent-encoded address. A quick second open leaves the second page in both panes. |
| R-09 | "Bild einfügen" writes the address relative to the page and with the exact name on disk, for a page in the project root and for a page in a subfolder. |
| R-10 | A junction or symbolic link inside the project folder that leads out of it: it is not listed, and nothing behind it is shown in the page view, opened, saved, created or opened in the browser; the note names the address and says why. A junction that leads to a folder inside the project works. Nothing outside the project folder changes. |

## Page view

| # | Criterion |
| --- | --- |
| P-01 | The page view shows unsaved code at most 0.5 s after the last keystroke (target 0.3 s); the scroll position is kept. |
| P-02 | Scripts of the page do not run (inline, external, event attributes, `javascript:` links). |
| P-03 | No request leaves the computer: pictures, style sheets (`@import`, `url()`, fonts), media, frames, `srcdoc` and `data:` frames, objects, resource hints (`preconnect`, `dns-prefetch`, `prefetch`, `preload`), manifests, icons, `<base>`, meta refresh, forms and links to the internet are refused; a listener on the computer and a network trace show none. Frames in a page show nothing. |
| P-04 | A click on a link to another project page offers to open it; a link to the internet does nothing in the page view and says so. A page that navigates by itself (meta refresh, form) offers nothing. |
| P-05 | No new windows, downloads, permission prompts, developer tools or "Inspect" in the release build. |
| P-06 | Hold a missing image read for page A in a test build. Page B displays while A is still pending and never receives A's missing-image note. In A → B → A, only the current A load reports its own missing image. |

## Files

| # | Criterion |
| --- | --- |
| F-01 | Open, change, save: the file on disk holds exactly the code, byte for byte; BOM and line endings of the opened file are kept. |
| F-07 | **Byte comparison, no change.** A UTF-8 file with BOM and mixed `LF`, `CRLF` and lone `CR` line endings is opened and saved without a change: the file on disk is byte for byte identical to the original (owner's decision of 2026-11-25). |
| F-08 | **Byte comparison, one change.** The same file, one line changed (text typed, and a line break typed into a line that ends with `CR`), saved: the file differs from the original only by the typed bytes; every other line break is byte for byte as read, and the typed break has the kind of the break that ends its line. Undo back to the saved text and saving again gives the saved bytes. |
| F-09 | **Byte comparison, undo steps and a save on its way.** (a) A change, a pause (new undo step), a lone `CR` deleted, undo to the first, unsaved step, save: the `CR` is in the file. (b) A save on its way (answer held back in the test build), the lone `CR` deleted meanwhile: the file holds the bytes that were sent; Enter typed back at that place shows "gespeichert" and saving again leaves the file untouched. |
| F-10 | **Byte comparison, breaks that meet.** In `a<CR>b<LF>c` the line `b` is deleted (also with undo and redo), saved: the file holds two breaks (`a<CR><CR><LF>c`: the line `a` keeps its bytes, the break of the changed line becomes `CRLF`, since `CR` directly before `LF` would be read as one break); opened again it has the same three lines, and saving it without a change does not rewrite it. |
| F-11 | With a preview read held in a test build, close a saved document. The window closes and the process exits cleanly after the worker returns. Repeat with a save in flight and verify that work accepted for writing and the prompt for later unsaved text are preserved. |
| F-12 | With unsaved text, or a save on its way, a logoff or shutdown query (`WM_QUERYENDSESSION`) is refused with the reason "Eine Seite ist noch nicht gespeichert." and the question for unsaved text appears. With the page saved, the query is allowed. |
| F-13 | With the project folder resolving slowly (test build, `HSE_TEST_RESOLVE_DELAY_MS=5000`), the window answers within 1 s throughout and the page opens. Resolving the project folder and checking files for opening, saving, pictures, the page view and "Im Browser ansehen" run on worker threads. |
| F-14 | **A late page choice.** The answer to "Seite öffnen …" is held back (test build, `HSE_TEST_PICK_DELAY_MS`), a file outside the project is chosen, another page B is opened from the list meanwhile and text is typed into it. When the late answer comes, the project folder stays, and B with the typed text stays open. |
| F-15 | **Rescue copy.** With a save that hangs for 3 s or more, "Rettungskopie speichern" writes the text in the editor (BOM and every line break) to a new local file, also while every file worker waits for the network drive; the path is shown, and the page keeps "wird gespeichert …" and afterwards its own saved state. |
| F-02 | Changed on disk by another program after opening: "Speichern" writes nothing and offers a new file or cancel. |
| F-03 | A failed write (read-only file, full disk, lost network drive) keeps the old file intact and says so. |
| F-04 | Closing with unsaved changes asks; "Abbrechen" keeps the program open with the text. |
| F-05 | A file in another encoding is reported, not converted silently. |
| F-06 | The file list follows files added, renamed and deleted in Explorer. |

## Program

| # | Criterion |
| --- | --- |
| X-01 | Starts from a folder on the school server and from a local folder without administrator rights and without installation (owner's hand test on a school computer). |
| X-02 | Without the WebView2 runtime the program says so in German and exits cleanly. |
| X-03 | The program writes nothing next to the exe and nothing outside `%LOCALAPPDATA%`, `HKCU` and the files the pupil saves. Rescue copies (F-15) go to `%LOCALAPPDATA%\HtmlSchoolEditor\Rettungskopien`. |
| X-04 | User interface texts are German and understandable for 12-year-olds (hand check with a class). |
| X-05 | Third-party components are listed with version, licence, source and SHA-256; the release zip passes the publication check with `--zip`. |
| X-07 | **One file dialog per window.** Two quick dialog requests (a double click, or two requests sent at once) open one dialog; after it is cancelled or confirmed no second dialog appears, and the dialog actions work again. |
| X-06 | Open and cancel the four system dialogs for project folder, page, picture and Save As. The current source stays intact and the controls remain usable. Accept valid choices in a second run and check the returned path and operation. |
