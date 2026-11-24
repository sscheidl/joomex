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
| R-08 | File and folder names with spaces, umlauts and `#` work when written correctly encoded; the picture dialog writes them encoded. |
| R-09 | "Bild einfügen" writes the address relative to the page and with the exact name on disk, for a page in the project root and for a page in a subfolder. |

## Page view

| # | Criterion |
| --- | --- |
| P-01 | The page view shows unsaved code at most 0.5 s after the last keystroke (target 0.3 s); the scroll position is kept. |
| P-02 | Scripts of the page do not run (inline, external, event attributes, `javascript:` links). |
| P-03 | No request leaves the computer: pictures, style sheets, fonts, frames and links to the internet are refused; a network trace shows none. |
| P-04 | A click on a link to another project page offers to open it; a link to the internet does nothing in the page view. |
| P-05 | No new windows, downloads, permission prompts, developer tools or "Inspect" in the release build. |

## Files

| # | Criterion |
| --- | --- |
| F-01 | Open, change, save: the file on disk holds exactly the code, byte for byte; BOM and line endings of the opened file are kept. |
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
| X-03 | The program writes nothing next to the exe and nothing outside `%LOCALAPPDATA%`, `HKCU` and the files the pupil saves. |
| X-04 | User interface texts are German and understandable for 12-year-olds (hand check with a class). |
| X-05 | Third-party components are listed with version, licence, source and SHA-256; the release zip passes the publication check with `--zip`. |
