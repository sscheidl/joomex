# Specification

Product: an offline HTML learning editor in one file. Audience: pupils of about 12–13 years in a computer-science class, and their teachers. This document states what the product does. The numbered requirements it answers (P-, S-, T-, X- and RF- identifiers) are defined in the task brief: [brief/ACCEPTANCE.md](brief/ACCEPTANCE.md) and [brief/REFERENCE_FINDINGS.md](brief/REFERENCE_FINDINGS.md). How it is built is in [ARCHITECTURE.md](ARCHITECTURE.md); what was measured is in [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md).

## 1. Behaviour

### Start and layout

* The file `school-editor.html` is opened directly from the file system in current Edge or Chrome. It needs no installation, server, network or stored browser data.
* Left pane: the complete HTML source of the document in an editable text field with line numbers and syntax colours. Right pane: the page, directly editable. Both panes are always visible; the divider can be dragged.
* A new page starts from a small German template with doctype, `lang`, charset, title, one heading and one paragraph.

### Editing

* Typing in the source updates the page after a short pause, at the latest before the page can be edited.
* Typing in the page updates the source after a short pause, at the latest before the source is used for anything (saving, formatting, undo, typing in the source, opening another file).
* Toolbar for the page: paragraph, heading 1–3, bold, italic, bulleted list, numbered list, link, remove link, image. Commands act on the selection of the page; the selection survives the click on the button.
* Markup written by the editor: `<p>`, `<h1>`–`<h3>`, `<b>`, `<i>`, `<ul>`, `<ol>`, `<li>`, `<a href>`, `<img src alt>`, `<br>`. Bold and italic use the basic tags `<b>` and `<i>` because they match the labels of the buttons; existing `<strong>` and `<em>` are recognised and removed by the same buttons. The editor never writes `<span>`, `<font>` or `style` attributes.
* New block elements are written on their own line, indented like their neighbours.
* Pasting inserts plain text only. Dropping content into the page is not possible; dropping a file on the window opens it (HTML) or offers to insert it (image).
* Links: the address is checked. Allowed are `http:`, `https:`, `mailto:`, `tel:` and addresses without a scheme (other pages of the pupil, anchors). Everything else is refused with an explanation.
* Images: only after choosing a file. PNG, JPEG, GIF and WebP are accepted by their file signature. Files up to 200 KB are embedded unchanged; larger PNG, JPEG and WebP files are scaled down to at most 1280 pixels and stored as JPEG of at most 450 KB; larger GIF files and files above 20 MB are refused. An alternative text is required.
* Undo and redo: one history for both panes and the toolbar. Continuous typing in one pane is one step until a pause of one second or after four seconds. Opening or creating a document starts a new history.
* "Code aufräumen" (format): one block element per line, two spaces per level, inline content on one line, a line break after `<br>`. Only white space changes. The content of `pre`, `textarea`, `script`, `style`, `svg`, `select` and similar elements is not touched. The result is applied only if the browser parses it to the same document; otherwise the source stays as it is and a message explains why. Documents that use `white-space: pre` in CSS are not formatted.

### What stays untouched

* A visual edit rewrites only the edited part of the body content. Doctype (including public and system identifiers), `html`/`head`/`body` tags, head content, comments, attributes, character references, quoting style, upper-case tags, scripts and event handlers stay exactly as written.
* Normalizations after a visual edit, all limited to the edited place:
  * edited text is written with `&amp;`, `&lt;`, `&gt;`, `&nbsp;`; unchanged text before and after the edit in the same text run keeps its original spelling;
  * an element whose end tag was omitted gets an end tag only if the element directly after it changed;
  * a paragraph renamed to a heading (or back) keeps its attributes verbatim;
  * text typed directly into the body is wrapped in `<p>`;
  * trailing spaces inside an edited paragraph may be dropped by the browser.
* Parts of a document that the editor cannot map safely to the source (wrongly nested or unclosed elements, very deep nesting) are shown read-only with a dashed outline. If the body as a whole cannot be mapped, the page is shown read-only and a note asks the pupil to fix the code on the left. The source can always be edited.

### Inactive content

* In the page pane, scripts and event handlers do not run, links do not navigate, forms do not submit, frames, objects, audio and video are replaced by a labelled box, and nothing is loaded from the network or from neighbouring files. Images are shown only if they are embedded (`data:` URL of a raster format); other images appear as a dashed box with their alternative text.
* A line below the page says what is switched off ("Im Editor ausgeschaltet: 2 Skripte, 1 Bild von außerhalb …"). The source and the saved file keep all of it. The editor does not claim that a saved document is safe to open elsewhere.

### Files

* Open: file picker of the browser, or a plain file input where the picker API is missing. UTF-8 with or without byte order mark. A file that is not valid UTF-8 is opened only after a question, converted from Windows-1252, and then counts as unsaved without a target file. UTF-16 and binary files are refused. Limit: 5 MB.
* Line ends: the editor works with LF internally. A file with CRLF line ends is written back with CRLF, a byte order mark is written back. A file opened and saved without edits is byte-identical. Mixed line ends are unified to the dominant convention and this is announced.
* Save writes to the opened file (after the browser's permission question) or asks for a location. Where the browser has no file access API, or it fails, Save downloads the file instead. "Herunterladen" always downloads a copy.
* A document is marked as saved only after a completed write or a started download. A cancelled or failed save leaves it unsaved and says so. A started download counts as saved; the editor cannot see whether the browser's download was kept.
* New, Open and dropping a file ask before unsaved work is discarded. Closing the tab with unsaved work triggers the browser's warning. Nothing is stored between sessions.

### Limits

| Limit | Value |
| --- | --- |
| Opened file | 5 MB |
| Image file accepted | 20 MB; embedded at most 450 KB after scaling |
| Pasted text | 200,000 characters |
| Syntax colours | switched off above 1.5 million characters; lines above 4,000 characters are shown without colours |
| History | 300 steps or 40 million characters |
| Nesting depth that stays editable | 400 levels |

## 2. Known limitations of version 0.1.0-alpha.1

* The page pane always renders in standards mode, also for documents without a doctype.
* Images referenced by file name (`<img src="katze.jpg">`) are not displayed in the editor, because it does not read neighbouring files. They work in the saved page.
* External style sheets are not applied in the editor; `<style>` in the document is.
* `<form>` is displayed as a plain block; form controls are not operable in the editor.
* Existing links and images cannot be changed through a dialog; their attributes are edited in the source.
* Nested lists are created in the source, not with the toolbar.
* Typing at the end of a link continues the link (browser behaviour).

## 3. Origin

A third-party single-file HTML editor served as a reference for interaction concepts. It is referred to as `[REFERENCE-APP]` (its accompanying notes as `[REFERENCE-NOTES]`); identity, revision and hashes are kept in a private analysis case and are not published. No general licence for reuse was found for it. Its source was read to understand how it works. This folder contains no code, assets, templates or texts of it; all files here were written for this project. No formal clean-room process is claimed: the author of this code has seen the reference source.

Source ranges of `[REFERENCE-APP]` that were read for this work: lines 555–604 (layout) and 622–1219 (state, highlighter, preview rendering, write-back, selection mapping, toolbar, file handling, formatter). The parts on templates, minification, validation and autosave (after line 1219) were not re-read; statements about them rely on the earlier audit findings RF-08, RF-11, RF-12 and RF-14.

### Building blocks

| Building block | Reference evidence | Decision | Behaviour here | Code | Test |
| --- | --- | --- | --- | --- | --- |
| Single local HTML file, no build needed by the user | `[REFERENCE-NOTES]:9–16`, RF-02 | keep | one file; sources and a dependency-free build are for developers only | `tools/build.mjs` | T-01 |
| Source and editable page side by side | `[REFERENCE-APP]:566–598`, RF-01 | keep | fixed split view, both panes always visible | `src/app.html` | T-02, T-03 |
| Text field with a coloured copy behind it, line numbers, scroll coupling | `[REFERENCE-APP]:573–575`, `685–744`, `779–796` | keep the concept | colours come from the tokenizer; only changed lines are re-rendered; long lines stay plain | `src/js/highlight.js:11`, `src/js/app.js:101` | unit "highlighter", T-12 |
| Editable document in a frame | `[REFERENCE-APP]:595`, `830–842`, RF-03 | correct | frame without script permission and with its own policy; the main window edits its DOM; the opened document is never loaded into the frame as markup | `src/app.html` (iframe), `src/js/app.js:30`, `src/js/project.js:303` | X-01…X-03, X-06 |
| Source → page: whole document reloaded after a delay | `[REFERENCE-APP]:814–827`, RF-04, RF-10 | correct | safe projection, minimal DOM update, scroll and caret kept, always up to date before the page can be edited | `src/js/project.js:231`, `src/js/app.js:188`, `:201`, `:702–720` | T-02, T-11, T-12 |
| Page → source: whole DOM serialized after a delay | `[REFERENCE-APP]:853–879`, RF-04, RF-05, RF-09 | correct | only edited body content is rewritten, untouched nodes are copied from the source, committed before every use of the text | `src/js/serialize.js:271`, `src/js/app.js:239` | T-09, T-10, T-11, R-01, R-02 |
| Selection shown in the other pane (character counting, text search fallback, focus moved) | `[REFERENCE-APP]:883–995`, RF-10 | correct | structural mapping between page nodes and source ranges; marking without moving the focus | `src/js/project.js:322–388`, `src/js/app.js:273` | T-03 |
| Toolbar keeps the page selection (`mousedown` cancelled) | `[REFERENCE-APP]:1013–1016` | keep | same technique for all toolbar and file buttons | `src/js/app.js:742–743` | T-04, T-12 |
| Formatting through browser editing commands | `[REFERENCE-APP]:1000–1041`, RF-06, RF-07 | correct | own DOM operations for blocks, lists, bold/italic, links, images; valid nesting by construction | `src/js/commands.js` | T-04, T-05, T-06 |
| Link and image address by prompt, no checks | `[REFERENCE-APP]:1032–1041`, RF-11 | correct | dialogs; scheme check; images only from a chosen file, with alternative text | `src/js/util.js:51`, `src/js/images.js:25`, `src/js/app.js:391`, `:425` | T-06, X-04 |
| Open through picker or file input | `[REFERENCE-APP]:1046–1087` | keep both paths, correct | byte-level decoding, size and encoding checks, question before discarding, stale loads ignored | `src/js/app.js:536`, `:567`, `src/js/util.js:89` | T-08, T-14, T-15 |
| Save, save as, download | `[REFERENCE-APP]:1089–1138`, RF-05 | keep the paths, correct | pending page edits are committed first; saved state only after success; download fallback | `src/js/app.js:597–638` | T-10, T-15, T-16 |
| Pretty printer: blocks on own lines, inline flows, raw elements verbatim | `[REFERENCE-APP]:1150–1213`, RF-14 | keep the idea, correct | works on the position tree; white space only; verified against the browser's parser | `src/js/format.js:16`, `src/js/project.js:390`, `src/js/app.js:470` | T-07, unit "formatter", R-01 |
| Persistent autosave and recovery | RF-12 | leave out | history in memory only | `src/js/history.js` | T-17, X-06 |
| Minify, validation report, CSS inlining, mail tools, merge fields, templates with remote images, find/replace, themes | RF-08, RF-11, RF-14 | leave out | not present | — | X-06 |
