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
| F-12 | While a page is open, a logoff or shutdown query (`WM_QUERYENDSESSION`) is refused, also if the interface's latest report has not arrived yet. With unsaved text, or a save on its way, the reason is "Eine Seite ist noch nicht gespeichert." and the question for unsaved text appears; with the page saved, the editor closes at once. The same holds while another question (such as "Neue Seite") is open: the question for unsaved text follows when it is answered. This also holds when the interface's reports about the first page of a session are still on their way (an existing page, a new page, and a page in another encoding while the question about converting it is open and the project list is refreshed). The same holds for an edit on the page side that is still open (a title typed but not confirmed, an unfinished composition): it is applied first, then the question comes. If it cannot be applied (a `<title>` inside a `<template>` before the page title), the close stops with a message and keeps the typed title. Without an open page the query is allowed. On a real logoff the editor can only ask where Windows lets it: with `AutoEndTasks` = 1, the matching group policy, or a forced logoff, Windows ends it without the question (owner's decision of 2026-11-27: accepted, no emergency copy; see SPECIFICATION.md 3.5). |
| F-13 | With the project folder resolving slowly (test build, `HSE_TEST_RESOLVE_DELAY_MS=5000`), the window answers within 1 s throughout and the page opens. Resolving the project folder and checking files for opening, saving, pictures, the page view and "Im Browser ansehen" run on worker threads. |
| F-14 | **A late page choice.** The answer to "Seite öffnen …" is held back (test build, `HSE_TEST_PICK_DELAY_MS`), a file outside the project is chosen, another page B is opened from the list meanwhile and text is typed into it. When the late answer comes, the project folder stays, and B with the typed text stays open. |
| F-15 | **Rescue copy.** With a save that hangs for 3 s or more, "Rettungskopie speichern" writes the text in the editor (BOM and every line break) to a new local file, also while every file worker waits for the network drive; the path is shown, and the page keeps "wird gespeichert …" and afterwards its own saved state. |
| F-02 | Changed on disk by another program after opening: "Speichern" writes nothing and offers a new file or cancel. |
| F-03 | A failed write (read-only file, full disk, lost network drive) keeps the old file intact and says so. |
| F-04 | Closing with unsaved changes asks; "Abbrechen" keeps the program open with the text. A close request while another question is open is kept and answered after it, and questions take turns (no answer is taken by the next question). |
| F-05 | A file in another encoding is reported, not converted silently. |
| F-06 | The file list follows files added, renamed and deleted in Explorer. |

## Editing on the page side (the owner's collection of 2026-11-27)

Each criterion has a browser test in `tests/ui/wishes.test.mjs` that failed against alpha.18; the native results are in STATUS.md.

| # | Criterion |
| --- | --- |
| V-01 | **Split at a space (B3).** A sentence typed in the page, split with Enter after one space and before another, all selected, "Liste": the code holds `<li>Der</li>`, `<li>schnelle</li>`, `<li>braune Fuchs</li>`, no `&nbsp;` and no leading space. The same for Shift+Enter (`Eins<br>zwei`). A `&nbsp;` written in the code where nothing is split stays. |
| V-02 | **Links are seen (B4).** In the edit view a link is blue and underlined as in the browser; the page's own rules for `a` win; a click still goes nowhere. |
| V-03 | **Enter at the end of a link (B5).** Enter three times at the end of a link and typing: one link stays, the new paragraphs hold no link and no empty link. Enter inside a link splits it into two links. |
| V-04 | **Line break (W3).** "Zeilenumbruch" and Shift+Enter put `<br>` into the paragraph, in the middle and at the end (the new line is seen at once); the button is one undo step; the saved bytes hold the `<br>` and the file's line breaks. |
| V-05 | **Alignment (W4).** Four symbol buttons; the one in force is pressed; pressing it again takes the alignment away. |
| V-06 | **Text colour (W5).** The palette writes the eight named colours by name and the shades of the grid and of "Weitere Farben …" as `#rrggbb`, also on a new span; "Farbe entfernen" removes the colour spans; the "A" applies the colour chosen last; Esc closes the palette and gives the focus back. "Weitere Farben …" opens the engine's colour chooser; cancelling it changes nothing. |
| V-07 | **Link options (W6, W7).** "In neuem Fenster öffnen" writes `target="_blank"`; "Das ist eine E-Mail-Adresse" writes `mailto:` and refuses an address without `@`. |
| V-08 | **Tables (W11).** In the edit view an empty cell is at least about 2.5 × 1.6 characters and has a dashed guide line; the page's own cell rules win; nothing of it reaches the code. |
| V-09 | **Search hits (W13).** While the search field has the focus every hit is marked in the code, the current one strongly, on the right line and column (also behind a tab); the marks go with the search. |
| V-10 | **Symbols (B1).** "Rückgängig" and "Wiederholen" show curved arrows as in office programs. |

## Program

| # | Criterion |
| --- | --- |
| X-01 | Starts from a folder on the school server and from a local folder without administrator rights and without installation (owner's hand test on a school computer). |
| X-02 | Without the WebView2 runtime the program says so in German and exits cleanly. |
| X-03 | The program writes nothing next to the exe and nothing outside `%LOCALAPPDATA%`, `HKCU` and the files the pupil saves. Rescue copies (F-15) go to `%LOCALAPPDATA%\HtmlSchoolEditor\Rettungskopien`. |
| X-04 | User interface texts are German and understandable for 12-year-olds (hand check with a class). |
| X-05 | Third-party components are listed with version, licence, source and SHA-256; the release zip passes the publication check with `--zip`. |
| X-08 | **Layout (0.1.0-alpha.17, order from 0.1.0-alpha.19).** At 100 % scaling (the school) and at 120 % (the owner's computer): both header rows can be used, each in one line at 1138 CSS pixels and more, "Speichern" and the saved state stay visible, the project list is on the left, the code in the middle, the page on the right. Dragging the divider and folding the list keep the page view on the right pane. Text marked in the page is formatted from the second row; undo, redo and the visible focus with Tab and Shift+Tab work; Ctrl+S with the caret in the page saves. |
| X-09 | **Help (0.1.0-alpha.19).** "Hilfe" in the first row (and F1) shows a short German guide, the version, the developer and year, the MIT licence text and the licence of the WebView2 SDK, without the internet; the native page view gives way while it is open. |
| X-07 | **One file dialog per window.** Two quick dialog requests (a double click, or two requests sent at once) open one dialog; after it is cancelled or confirmed no second dialog appears, and the dialog actions work again. |
| X-06 | Open and cancel the four system dialogs for project folder, page, picture and Save As. The current source stays intact and the controls remain usable. Accept valid choices in a second run and check the returned path and operation. |
