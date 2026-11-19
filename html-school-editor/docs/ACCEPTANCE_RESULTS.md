# Acceptance results

Artefact: `dist/school-editor.html`, version 0.1.0-alpha.3, 160,302 bytes, SHA-256 `2c85f25d11fe0d1207f3e7655334dcbdd6f7b058dad66e0c6a9c9aeb09629244`.

Contract: [brief/ACCEPTANCE.md](brief/ACCEPTANCE.md). The cases X-07, R-01 and R-02 were added by the implementer and are not part of that contract. The cases RV-01 to RV-04 are the regressions for the findings of the independent review of alpha.1 ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md)). The cases F-01 to F-03 cover the functions the owner asked for after trying alpha.2; where they change what the contract says, the row names the owner's decision.

MEASURED 2026-11-19 on Windows 11 Pro (10.0.26300) with Microsoft Edge **157.0.4341.60**, new headless mode, fresh browser profile per run, artefact opened from `file://`. Chrome: **NOT MEASURED** (not installed). Evidence with every single check: [`tests/results/acceptance-edge.json`](../tests/results/acceptance-edge.json); the Chrome file records the missing measurement.

Command for everything below: `node tests/run.mjs` (one case: `node tests/run.mjs --browser edge --only T-10`). Input is real: key and mouse events are sent through the DevTools protocol, files are opened through the file input of the page, downloads are real browser downloads whose bytes are read from disk. Where a mock is used it is named.

`PASS` means every check of the case held. It does not mean the case was reviewed by someone else. A part of a case that could not be carried out is recorded as `NOT MEASURED` in the result file and in the console output, with the reason; it never counts as a passed check. This run: 33 cases pass, 410 checks, 2 parts NOT MEASURED (native file pickers, in T-16 and RV-01). The clipboard paste with a trusted key event (X-04) and the file drop (T-15) were carried out in this run.

The independent review of alpha.1 rated the suite as not sufficient for full acceptance of S-04, S-05 and S-06, because it passed while the product had the defects RV-01 to RV-04. The rows below state what is measured now. They are the implementer's results and await the re-review.

## Product requirements

| ID | Requirement (short) | Implementation | Evidence | Result |
| --- | --- | --- | --- | --- |
| P-01 | German learning editor, short toolbar, standalone | `src/app.html` | screenshots during development; texts in the template | implemented; understanding by pupils NOT MEASURED |
| P-02 | Single file from the file system, no server, no cache | `tools/build.mjs` | T-01 | PASS in Edge; Chrome NOT MEASURED |
| P-03 | Full source left, editable page right, both visible | `src/app.html`, `src/js/app.js:104`, `:204` | T-02, T-03 | PASS |
| P-04 | New, open, save/download, format, blocks, bold/italic, lists, links, images with alt, undo/redo, keyboard, umlauts | `src/js/app.js`, `src/js/commands.js` | T-01, T-04…T-08, T-10, T-13, F-01…F-03 | PASS. **Owner's decisions of 2026-11-19 that change the wording of the contract:** the description of an image (alt) is offered but optional; an image is written as a file name, not embedded. Added on the owner's request: alignment, width of images, changing existing images and links |
| P-05 | Plain tags, valid nesting, no spans/fonts/inline CSS for basic text formatting; documented choice `<b>`/`<i>` | `src/js/serialize.js:184`, `src/js/commands.js:291`, `:449` | T-04, T-05, F-03 | PASS. Alignment is written as `style="text-align: …"`, the one style attribute the editor writes: HTML has no tag for it. Paragraph, headings, bold and italic stay plain tags (T-04) |
| P-06 | At most 200,000 bytes, complete | `tools/build.mjs` | X-06 note, STATUS | 160,302 bytes |
| P-07 | No mail tools, minify, templates with remote content, tracking, persistence | — | X-06, T-17 | PASS |

## Safety and data model

| ID | Requirement (short) | Implementation | Evidence | Result |
| --- | --- | --- | --- | --- |
| S-01 | Opened and pasted content is inert | `src/js/project.js:156`, `:193`; `src/app.html` (sandbox); `src/js/app.js:860–917` | X-01, X-02, X-04 | PASS |
| S-02 | No automatic external access | `src/js/project.js:156–228`; policy in `tools/build.mjs` and `src/js/app.js:30` | X-03 (0 delivered requests, control fetches) | PASS |
| S-03 | Parent-controlled sandboxed frame, composition proven on the delivered file | `src/app.html`, `src/js/app.js:991` | X-01…X-03, X-06 | PASS |
| S-04 | Source separate from projection, inactive content kept and announced | `src/js/project.js:319`, `src/js/serialize.js:220`, `:262`; note: `src/js/project.js:139`, `src/js/app.js:236`, `:909` | T-09, X-01, X-03, R-01, RV-04 | PASS; alpha.1 failed the announcement for an SVG animation (RV-04), corrected |
| S-05 | Visual commits keep unrelated content | `src/js/serialize.js:129`, `:220`, `:292`; lists: `src/js/commands.js:96`, `:158`, `:194`; formatting: `src/js/app.js:557`, `:596`, `src/js/project.js:453`, `:481` | T-09, T-02, T-05, R-01 (92 edits, 91 exact, 1 with trailing spaces dropped), R-02 (984 generated edits exact), RV-02, RV-03 | PASS; alpha.1 failed for formatting under author CSS (RV-02) and for attributes in list commands (RV-03), corrected |
| S-06 | One revision model, no stale overwrite, flush before use | `src/js/app.js:191`, `:251`, `:806`, `:860–878`, `:970`; replacing the document: `:660–684`, `:686`, `:723` | T-10, T-11 (42 schedules + 24 alternating keystrokes), T-15, RV-01 (6 schedules with a held file read), RV-02 (text typed while the layout check runs) | PASS; alpha.1 failed for a file read that finishes late (RV-01), corrected |
| S-07 | Selection, caret, scroll kept; one history; no focus theft | `src/js/app.js:123`, `:195`, `:285`, `:342`; `src/js/history.js:3` | T-03, T-12, T-13 | PASS |
| S-08 | Link and alt input as data, scheme check, images only by choice, limits | `src/js/util.js:51`, `:86`, `:96`; `src/js/images.js:17`; `src/js/commands.js:345`, `:390`, `:406`, `:430` | T-06, X-04, F-01, F-02, unit "link addresses", "images" | PASS. An image is read only after the pupil chose the file; the address in the source is a file name made by the editor from that choice and an optional folder name, which is checked |
| S-09 | No eval, no runtime loading, no library | whole file | X-06 | PASS |

## Functional cases

| ID | What is checked | Main code | Fixture | Result (Edge) |
| --- | --- | --- | --- | --- |
| T-01 | Offline start from `file://`, typing with umlauts in both panes, no request | `src/js/app.js:991` | built-in template | PASS (6 checks) |
| T-02 | Edits in both directions; afterwards only the two edited places differ from the file | `src/js/app.js:806`, `:251` | `tests/fixtures/basic.html` | PASS (4) |
| T-03 | Caret in the 2nd of three identical paragraphs marks source line 16; double-click in nested emphasis marks that text; source caret marks the 3rd paragraph; focus and next keystroke stay in the pane | `src/js/app.js:285`, `src/js/project.js:338–404` | `basic.html` | PASS (8) |
| T-04 | p→h1 keeps attributes verbatim, h2 keeps children, bold/italic on selection, in a heading, on the word at the caret; saved file has no span/font/style and differs only at the edited places | `src/js/commands.js:120`, `:291` | `basic.html` | PASS (13) |
| T-05 | Three paragraphs → list, the first item keeps the attributes of its paragraph as written; Enter adds an item; switch to numbered; reopen gives the same structure; remove gives paragraphs, the first with its attributes; no list in a paragraph, no empty paragraph | `src/js/commands.js:194`, `:158` | `basic.html` | PASS (9). The alpha.1 expectation of this case contained the attribute loss of RV-03 and was corrected |
| T-06 | Link with escaped address, inert in the page, removal restores the source exactly; five disguised script/data addresses refused; markup-shaped address stays one attribute; image written as file name with escaped description, no image data in the source, the page pane shows the chosen picture, the pupil is told where the file belongs; no image chosen is explained; text and SVG files refused; a 5.8 MB picture adds only its file name | `src/js/app.js:408`, `:464`; `src/js/util.js:51`; `src/js/images.js:17` | generated PNG files | PASS (25). Changed with alpha.3: images are no longer embedded or scaled, a missing description is no longer asked for |
| T-07 | Formatted text equals a hand-written expectation; only white space changed; parsed text, `pre`, `textarea`, `script`, `style`, attribute with `>` unchanged; inline spacing kept; undo; document with `white-space: pre` refused | `src/js/format.js:16`, `src/js/app.js:596`, `src/js/project.js:406` | `format-in.html`, `format-expected.html`, `malformed.html` | PASS (16). Rendering under author CSS: see RV-02 |
| T-08 | Open → download without edit is byte-identical for LF, CRLF, BOM+CRLF, BOM+LF; mixed line ends unified and announced; Windows-1252 file only after a question and then correct; UTF-16 refused | `src/js/util.js:181`, `:204`; `src/js/app.js:686` | generated from `basic.html` | PASS (19) |
| T-09 | Old-style document (public doctype, upper-case tags, omitted end tags, table without tbody, inactive script/handler/external image): downloaded file equals original plus the typed character; edited paragraph keeps handler and character references; no end tags added; joining paragraphs keeps the inactive script; replacing all content keeps frame and script | `src/js/serialize.js:98`, `:129`, `:262` | `legacy.html` | PASS (10) |
| T-10 | Type in the page and save at once: download button, Ctrl+S in page and source (download fallback) contain the last keystroke while the edit was still pending; **mock** file handle: written text has the keystroke, second save reuses the handle, failed write and cancelled picker leave the document unsaved | `src/js/app.js:754–795` | template | PASS (13) |
| T-11 | Source→page, page→source and typing into an outdated page, each with delays 0–800 ms, twice (42 runs); 24 keystrokes alternating between panes without pause | `src/js/app.js:191`, `:251`, `:860–878`, `:970` | generated | PASS (3) |
| T-12 | 146,008-character document: 162 fast keystrokes complete and in order; source caret not moved; page scroll kept on source edit; selection survives toolbar; IME composition committed once | `src/js/project.js:247`, `src/js/app.js:123` | generated | PASS (11); 162 keystrokes sent in about 1.8 s, panes in sync after about 2.0 s (including automation overhead) |
| T-13 | Source edit, page edit, toolbar command: undo ×3, redo ×2, new edit disables redo, Ctrl+Z/Y from both panes continue the same history, a burst is one step | `src/js/history.js:3`, `src/js/app.js:342–364` | template | PASS (13) |
| T-14 | Malformed file shown unchanged, unmappable parts read-only, typing changes one character only; fragment without end; empty file; file above 5 MB refused; 30,000 nested elements | `src/js/project.js:101`, `src/js/tree.js:26`, `src/js/app.js:204` | `malformed.html`, generated | PASS (15) |
| T-15 | New/Open ask before discarding; cancel and Escape keep the work; binary file refused, work kept; Open button with file chooser; file dropped on the window opens, asks first when unsaved; **mock**: opening a file while a slow save is pending asks first, and the save that finishes afterwards does not mark the new document saved | `src/js/app.js:660–737`, `:797` | fixtures | PASS (12). File reads that finish late: see RV-01 |
| T-16 | Without file access API the Save button downloads; bytes as expected | `src/js/app.js:775` | `basic.html` | PASS (3). Native pickers and write-back: **NOT MEASURED** |
| T-17 | No localStorage, sessionStorage, cookie, IndexedDB or cache entry; a second start in the same profile shows the template | — | template | PASS (2) |

## Security cases

| ID | What is checked | Result (Edge) |
| --- | --- | --- |
| X-01 | more than 20 script and handler vectors plus a storage sentinel; click, hover, typing in the test page | PASS (9): nothing ran, sentinel not read, 0 requests, source intact |
| X-02 | Navigation, refresh, base, forms, frames, objects, popups; editable and read-only variant | PASS (16): 0 requests, no navigation, no new window |
| X-03 | more than 30 kinds of external resource references; control page proves the server and browser would fetch | PASS (5): **0 delivered requests**; 11 attempts from inline CSS, all blocked by the policy (25 block reports) |
| X-04 | Rich clipboard paste with a trusted key event; paste events; HTML-only clipboard; drop | PASS (7) |
| X-05 | No message bridge in the file | PASS (1) |
| X-06 | Static scan: dynamic code, storage, network APIs, URLs, script count, sandbox, policy with matching script hash | PASS (11) |
| X-07 | Names that shadow DOM properties (`<img name="body">`, `<input name="childNodes">` in a form, …) | PASS (8) |

## Robustness

| ID | What is checked | Result (Edge) |
| --- | --- | --- |
| R-01 | 44 hand-written snippets (omitted end tags, tables, entities, comments, forms, frames, SVG, fragments, quirks, broken nesting): open unchanged; 92 single-character page edits each compared with the original, page text compared with the parsed source, undone; formatted and compared | PASS: 91 edits change exactly one character, 1 additionally drops trailing spaces of the edited paragraph; 2 snippets read-only as a whole, 1 with a read-only part; 42 formatted (each after the layout comparison), 0 refused |
| R-02 | Source modules in a test page, 3,044 generated documents: write-back without edit reproduces the text; re-rendering changes nothing; one appended character changes exactly that place; an image `src` causes no request without any policy | PASS: 2,128 documents editable, 984 edits exact |

## Regressions for the review findings of alpha.1

The reviewer's inputs are used unchanged; further inputs of the same kind were added. Expected values are written by hand. Code: `tests/browser/review.mjs`.

| ID | Finding | What is checked | Result (Edge) |
| --- | --- | --- | --- |
| RV-01 | A file read that finishes late replaced newer work and its history (S-06, T-15) | Completion of `File.arrayBuffer()` is held by the test (timing seam; bytes, file input, buttons and keys are real). Reviewer schedule 1: New and typing during the read: the late read is dropped, text, name, undo history and unsaved state stay. Reviewer schedule 2, through the Open button and the file chooser: typing during the read: the editor asks again and names the file; declining keeps text, name and history. Typing in the page pane during the read is committed before the question; accepting opens the file. An edit that was taken back needs no question. Of two reads only the one started last opens, in both orders of completion | PASS (19). The same schedules with the native file picker: **NOT MEASURED** |
| RV-02 | "Tidy up" accepted changes of the rendering (S-05, T-07) | 11 documents are refused with a reason and stay unchanged: both reviewer samples (`white-space` behind a CSS comment; paragraphs displayed inline), `white-space` through a CSS escape, a custom property, `white-space-collapse`, a media condition, `all: unset`, inline-block list items on one line, generated content in front of a leading space, a linked and an imported style sheet. 3 documents with style rules that do not matter are formatted; for each, the original and the downloaded result are rendered as ordinary local pages with scripts off and every element and text box is compared by the test's own measuring code. **Timing seam**: text typed while the layout check is held stays exactly as typed and the outdated result is dropped | PASS (43) |
| RV-03 | Creating a list dropped the attributes of the paragraph (S-05, T-05) | Reviewer sample: the downloaded file has the list item with `id`, `class` and `title`; toggling back returns the paragraph with them. Attributes keep their spelling (upper case, single quotes, spaces around `=`), including an event handler the editor does not show and a `style`. A whole list with attributes becomes a `div` with them, its items paragraphs with theirs; undo. One item out of the middle: both lists keep class and style, the `id` exists once. First item out: the original list element with its `id` continues. An item holding a paragraph and attributes becomes a `div` | PASS (10) |
| RV-04 | A resource stopped by the policy was not announced (S-04, X-03) | Reviewer sample (SVG `set` assigning an image address) and five further samples, each: nothing reaches the local counter, the note above the page appears, the source is unchanged. Control: the address behind a CSS escape really is attempted and stopped by the policy. The animated addresses are not attempted any more; no animation element is in the page pane. Deleting the address in the source with a real key removes the note; a new page shows none | PASS (25) |

The reviewer's own probe script (`docs/reviews/review-alpha1.mjs`) is unchanged. Run against this version it stops in its first probe with a timeout: it waits until the late file has been opened, which is exactly what no longer happens. Its remaining probes therefore do not run in that script; their inputs are the reviewer samples of RV-02 to RV-04 above. Its recorded alpha.1 results (`tests/results/review-alpha1-edge.json`) are kept as failed-before evidence.

## Functions asked for by the owner after trying alpha.2

Code: `tests/browser/features.mjs`. Expected source texts are written by hand.

| ID | What is checked | Main code | Result (Edge) |
| --- | --- | --- | --- |
| F-01 | Folder name with a colon and three wrong widths are refused with an explanation; folder, file name, empty description and width are written as plain attributes; the page pane shows the chosen file in that width; the folder is suggested for the next picture; `#` and `%` of a file name are written as percent codes and the picture is still shown; the saved file holds no image data; a picture chosen earlier is shown in another page that names the same file. **A copy of the editor with the picture files next to it and in a subfolder:** both are boxes, no image element has a loadable address, the browser reports no request, nothing reaches the local counter; a network picture is a box, an embedded one is shown; the note tells files and network apart; choosing the file once makes both places show it without changing the code | `src/js/project.js:158`, `src/js/app.js:464`, `src/js/util.js:86`, `:96` | PASS (25) |
| F-02 | An image tag with upper-case names, single quotes, an unquoted value and an event handler: accepting the dialog unchanged changes nothing and adds no undo step; new width rewrites `width` and removes `height`; new description is written inside the pupil's single quotes; new folder changes only that part of the address; empty width removes the attribute; four undo steps restore the text. An embedded picture and a network picture keep their address when width or description change; choosing a file replaces the address. Link: the dialog opens with the address of the link around the caret or the selection; a disallowed address is refused; the new address replaces only the value inside its quotes; an anchor without address gets one; links in the page pane stay inert; a selection reaching beyond a link is explained | `src/js/commands.js:110`, `:406`, `:425`, `:430`; `src/js/util.js:142`; `src/js/serialize.js:248` | PASS (19) |
| F-03 | Centre, justified, right write one `style` attribute; left removes it and the original text is back; the buttons show the alignment; three blocks at once; an existing `STYLE='color:red'` keeps its declaration, spelling and quotes and gets them back; list item and table cell; each alignment is one undo step; a clicked picture aligns its paragraph; a picture directly in the page gets its own paragraph and stands at the right edge; the saved file has no other style attribute; "Code aufräumen" accepts the aligned page; with a page rule that centres paragraphs, left is written out; Enter after an aligned paragraph gives at most this alignment | `src/js/commands.js:449`, `src/js/util.js:116`, `:123`, `src/js/serialize.js:197` | PASS (21) |

Unit tests of the helpers behind these functions: `tests/unit/attrs.test.mjs` (6 tests, all pass).


## Reference findings → fixes

| Finding in the reference | Fix here | Regression |
| --- | --- | --- |
| RF-03 opened content controls the editor | no execution: inert parse, projection, sandbox, policy | X-01, X-02, X-06 |
| RF-04 two timers overwrite each other | revision flags, commit/render before the other pane is edited | T-11 |
| RF-05 download without pending page edit | `commitVisual()` in `snapshotForSave()` | T-10 |
| RF-07 list inside a paragraph | lists built by replacing paragraphs | T-05 |
| RF-08 minify joins words | no minify; formatter verified by parse and by layout, inline spacing checked | T-07, RV-02 |
| RF-09 doctype identifiers lost | envelope never rewritten | T-09 |
| RF-10 focus theft, caret to end, scroll reset | highlight without focus, offset mapping, in-place DOM update | T-03, T-12 |
| RF-11 remote resources | none built in; projection and policy | X-03 |
| RF-12 persistent autosave | none | T-17, X-06 |
| RF-13 no reuse licence | nothing reused; own licence | STATUS |
| RF-14 simplified parser trusted | every parse compared with the browser's; formatter output verified | T-07, T-14, R-01, R-02 |

Failed-before evidence for RF-03 to RF-12 is the earlier audit of the reference, kept privately with the analysis case. For defects of this product found during development see [STATUS.md](STATUS.md).
