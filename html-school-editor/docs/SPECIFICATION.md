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
* Toolbar for the page: paragraph, heading 1–3, bold, italic, bulleted list, numbered list, alignment (left, centre, right, justified), link, remove link, image. Commands act on the selection of the page; the selection survives the click on the button. A click on an image selects it.
* Markup written by the editor: `<p>`, `<h1>`–`<h3>`, `<b>`, `<i>`, `<ul>`, `<ol>`, `<li>`, `<a href>`, `<img src alt width>`, `<br>`. Bold and italic use the basic tags `<b>` and `<i>` because they match the labels of the buttons (confirmed by the owner on 2026-11-19); existing `<strong>` and `<em>` are recognised and removed by the same buttons. The editor never writes `<span>` or `<font>`. The one style attribute it writes is `style="text-align: …"` for the alignment buttons, because HTML has no tag for alignment.
* New block elements are written on their own line, indented like their neighbours.
* Pasting inserts plain text only. Dropping content into the page is not possible; dropping a file on the window opens it (HTML) or offers to insert it (image).
* Links: the address is checked. Allowed are `http:`, `https:`, `mailto:`, `tel:` and addresses without a scheme (other pages of the pupil, anchors). Everything else is refused with an explanation. With the caret or the selection inside one link, the link button opens the dialog with the address of that link and changes it.
* Images: only after choosing a file. PNG, JPEG, GIF and WebP are accepted by their file signature. The source gets the file name as address, with an optional folder in front (`<img src="bilder/katze.jpg" alt="">`); the picture is not copied into the document, and the pupil is told to put the file next to the page. The characters `#`, `?` and `%` of a file name are written as percent codes so that the address still means this file. A description (alternative text) and a width in pixels are optional; without a description the editor writes `alt=""`. With an image selected, the image button opens the dialog with the values of that image: description, width, folder, and another file can be chosen. A new width removes a `height` attribute so that the picture keeps its proportions. Decisions of the owner of 2026-11-19: file names instead of embedded data, and the description optional.
* Showing images: the editor never reads the folder of a page. A picture is shown in the page pane if its address is a plain file name (with or without folder) and the pupil has chosen a file of that name in the current session; the folder part is not compared. Until then it appears as a dashed box with its description. Pictures embedded in the code (`data:` address) are shown as before, pictures from the network never.
* Alignment: the four buttons set `text-align` on the paragraphs, headings, list items or table cells of the selection, or on the block around a selected image (an image that stands directly in the page gets a paragraph of its own). "Left" removes the declaration; if a rule of the page would then align the block differently, `text-align: left` is written out. Other declarations of an existing `style` attribute stay as written.
* Undo and redo: one history for both panes and the toolbar. Continuous typing in one pane is one step until a pause of one second or after four seconds. Opening or creating a document starts a new history.
* "Code aufräumen" (format): one block element per line, two spaces per level, inline content on one line, a line break after `<br>`. Only white space changes. The content of `pre`, `textarea`, `script`, `style`, `svg`, `select` and similar elements is not touched. The result is applied only if three checks agree: (1) no style rule of the document can make spaces count (any `white-space` or `white-space-collapse` value other than the collapsing ones, also behind CSS comments, escapes, custom properties or conditions); (2) the browser parses both texts to the same document; (3) both texts are laid out identically, box by box and text by text, in a hidden copy of the page pane with the document's own style rules. Otherwise the source stays as it is and a message says why. A document that links or imports a style sheet file is not formatted, because the editor does not read that file and cannot compare the layouts. If the text changes while the check runs, the result is dropped.

### What stays untouched

* A visual edit rewrites only the edited part of the body content. Doctype (including public and system identifiers), `html`/`head`/`body` tags, head content, comments, attributes, character references, quoting style, upper-case tags, scripts and event handlers stay exactly as written.
* Normalizations after a visual edit, all limited to the edited place:
  * edited text is written with `&amp;`, `&lt;`, `&gt;`, `&nbsp;`; unchanged text before and after the edit in the same text run keeps its original spelling;
  * an element whose end tag was omitted gets an end tag only if the element directly after it changed;
  * a paragraph renamed to a heading (or back) keeps its attributes verbatim;
  * changing an image or a link through its dialog, and aligning a block, rewrite exactly the attribute concerned inside the start tag: its value is replaced within the quotes the pupil used, a missing attribute is added behind the last one, a removed one goes with the white space in front of it; the tag name, the other attributes, their order, spelling and spacing stay;
  * list commands keep attributes as written: a paragraph or heading that becomes a list item passes its start tag to the item, and an item that becomes a paragraph passes it back; an item that holds blocks and has attributes becomes a `<div>` with them; a list with attributes whose items all become paragraphs stays as a `<div>` around them; if items remain, the original list element keeps them, and items behind a paragraph taken out of the middle continue in a second list with the same attributes except `id` and attributes the editor does not show (event handlers);
  * a block created or moved by a list command stands on its own line; a line break between two paragraphs that become neighbouring items is removed;
  * text typed directly into the body is wrapped in `<p>`;
  * trailing spaces inside an edited paragraph may be dropped by the browser.
* Parts of a document that the editor cannot map safely to the source (wrongly nested or unclosed elements, very deep nesting) are shown read-only with a dashed outline. If the body as a whole cannot be mapped, the page is shown read-only and a note asks the pupil to fix the code on the left. The source can always be edited.

### Inactive content

* In the page pane, scripts and event handlers do not run, links do not navigate, forms do not submit, frames, objects, audio and video are replaced by a labelled box, and nothing is loaded from the network or from neighbouring files. Images are shown if they are embedded in the code (`data:` address of a raster format) or if the pupil has chosen the file in this session; other images appear as a dashed box with their description.
* A note above the page says what is switched off ("Im Editor ausgeschaltet: 2 Skripte, 1 Bild von außerhalb, 1 Animation …"). SVG animation elements are not shown, because an animation can assign an address after the attributes were filtered. If the browser's content policy stops something that the editor's own list did not name, the note says "Inhalte von außerhalb der Seite" for as long as the stopped address occurs in the code. The source and the saved file keep all of it. The editor does not claim that a saved document is safe to open elsewhere.

### Files

* Open: file picker of the browser, or a plain file input where the picker API is missing. UTF-8 with or without byte order mark. A file that is not valid UTF-8 is opened only after a question, converted from Windows-1252, and then counts as unsaved without a target file. UTF-16 and binary files are refused. Limit: 5 MB.
* Line ends: the editor works with LF internally. A file with CRLF line ends is written back with CRLF, a byte order mark is written back. A file opened and saved without edits is byte-identical. Mixed line ends are unified to the dominant convention and this is announced.
* Save writes to the opened file (after the browser's permission question) or asks for a location. Where the browser has no file access API, or it fails, Save downloads the file instead. "Herunterladen" always downloads a copy.
* A document is marked as saved only after a completed write or a started download. A cancelled or failed save leaves it unsaved and says so. A started download counts as saved; the editor cannot see whether the browser's download was kept.
* New, Open and dropping a file ask before unsaved work is discarded. The answer covers the document as it was at that moment: if the text changes while a file is being chosen or read, the editor asks again before it replaces anything, and declining keeps the work and its undo history. Of several such operations only the one started last can complete; an older file read that finishes later is dropped with a message. Closing the tab with unsaved work triggers the browser's warning. Nothing is stored between sessions.

### Limits

| Limit | Value |
| --- | --- |
| Opened file | 5 MB |
| Image file | no size limit of the editor; a file above 2 MB is pointed out in the dialog |
| Image width | 1 to 9999 pixels |
| Pasted text | 200,000 characters |
| Syntax colours | switched off above 1.5 million characters; lines above 4,000 characters are shown without colours |
| History | 300 steps or 40 million characters |
| Nesting depth that stays editable | 400 levels |

## 2. Known limitations of version 0.1.0-alpha.3

* The page pane always renders in standards mode, also for documents without a doctype.
* Images referenced by file name are shown only after the pupil has chosen the file in the current session, so after reopening a page they are boxes until chosen again. The editor cannot check that the file really lies where the address says, and it does not copy the file there. A function that opens a whole folder would lift this; it is not part of this version.
* A picture is placed by the alignment of its paragraph. Text does not flow around pictures unless the pupil writes CSS for it.
* External style sheets are not applied in the editor; `<style>` in the document is. Documents with an external style sheet cannot be formatted with "Code aufräumen".
* The layout comparison of "Code aufräumen" sees the page at the current width of the page pane, at rest (animations and transitions stopped) and without pointer interaction. A rule that changes `display` or generated content only under another condition (other width, print, hover) is not evaluated; `white-space` rules are refused under any condition.
* SVG animations are not shown in the editor.
* `<form>` is displayed as a plain block; form controls are not operable in the editor.
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
| Text field with a coloured copy behind it, line numbers, scroll coupling | `[REFERENCE-APP]:573–575`, `685–744`, `779–796` | keep the concept | colours come from the tokenizer; only changed lines are re-rendered; long lines stay plain | `src/js/highlight.js:11`, `src/js/app.js:104` | unit "highlighter", T-12 |
| Editable document in a frame | `[REFERENCE-APP]:595`, `830–842`, RF-03 | correct | frame without script permission and with its own policy; the main window edits its DOM; the opened document is never loaded into the frame as markup | `src/app.html` (iframe), `src/js/app.js:30`, `src/js/project.js:319` | X-01…X-03, X-06 |
| Source → page: whole document reloaded after a delay | `[REFERENCE-APP]:814–827`, RF-04, RF-10 | correct | safe projection, minimal DOM update, scroll and caret kept, always up to date before the page can be edited | `src/js/project.js:247`, `src/js/app.js:191`, `:204`, `:860–878` | T-02, T-11, T-12 |
| Page → source: whole DOM serialized after a delay | `[REFERENCE-APP]:853–879`, RF-04, RF-05, RF-09 | correct | only edited body content is rewritten, untouched nodes are copied from the source, committed before every use of the text | `src/js/serialize.js:292`, `src/js/app.js:251` | T-09, T-10, T-11, R-01, R-02 |
| Selection shown in the other pane (character counting, text search fallback, focus moved) | `[REFERENCE-APP]:883–995`, RF-10 | correct | structural mapping between page nodes and source ranges; marking without moving the focus | `src/js/project.js:338–404`, `src/js/app.js:285` | T-03 |
| Toolbar keeps the page selection (`mousedown` cancelled) | `[REFERENCE-APP]:1013–1016` | keep | same technique for all toolbar and file buttons | `src/js/app.js:919–920` | T-04, T-12 |
| Formatting through browser editing commands | `[REFERENCE-APP]:1000–1041`, RF-06, RF-07 | correct | own DOM operations for blocks, lists, bold/italic, links, images; valid nesting by construction | `src/js/commands.js` | T-04, T-05, T-06 |
| Link and image address by prompt, no checks | `[REFERENCE-APP]:1032–1041`, RF-11 | correct | dialogs for new and existing links and images; scheme check; an image is a chosen file addressed by its name, with optional description and width | `src/js/util.js:51`, `:86`, `:96`; `src/js/images.js:17`; `src/js/app.js:408`, `:464`; `src/js/commands.js:390`, `:406`, `:430` | T-06, X-04, F-01, F-02 |
| Open through picker or file input | `[REFERENCE-APP]:1046–1087` | keep both paths, correct | byte-level decoding, size and encoding checks, question before discarding and again if the text changed meanwhile, outdated reads dropped | `src/js/app.js:660–737`, `src/js/util.js:181` | T-08, T-14, T-15, RV-01 |
| Save, save as, download | `[REFERENCE-APP]:1089–1138`, RF-05 | keep the paths, correct | pending page edits are committed first; saved state only after success; download fallback | `src/js/app.js:754–795` | T-10, T-15, T-16 |
| Pretty printer: blocks on own lines, inline flows, raw elements verbatim | `[REFERENCE-APP]:1150–1213`, RF-14 | keep the idea, correct | works on the position tree; white space only; verified against the browser's parser and by comparing the layout before and after | `src/js/format.js:16`, `src/js/project.js:406`, `src/js/app.js:596` | T-07, unit "formatter", R-01, RV-02 |
| Persistent autosave and recovery | RF-12 | leave out | history in memory only | `src/js/history.js` | T-17, X-06 |
| Minify, validation report, CSS inlining, mail tools, merge fields, templates with remote images, find/replace, themes | RF-08, RF-11, RF-14 | leave out | not present | — | X-06 |
