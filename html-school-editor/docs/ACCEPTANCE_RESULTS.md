# Acceptance results

Artefact: `dist/school-editor.html`, version 0.1.0-alpha.11, 184,546 bytes, SHA-256 `9173953de12bfc9ca98c777477e3d89665092e015414c2ff7b41daecd8612eee`.

Contract: [brief/ACCEPTANCE.md](brief/ACCEPTANCE.md). The cases X-07, R-01 and R-02 were added by the implementer and are not part of that contract. The cases RV-01 to RV-04 and A3-01 to A3-05 are the regressions for the findings of the two independent reviews ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md), [reviews/REVIEW_0.1.0-alpha.3.md](reviews/REVIEW_0.1.0-alpha.3.md)). The cases F-01 to F-03 cover the functions the owner asked for after trying alpha.2; where they change what the contract says, the row names the owner's decision.

MEASURED 2026-11-20 on Windows 11 Pro (10.0.26300) with Microsoft Edge **158.0.4370.33**, new headless mode, and with **Firefox/160.0.1**, headless; fresh browser profile per run, artefact opened from `file://`. Chrome: **NOT MEASURED** (not installed). The tables below give the Edge results; the Firefox results follow in their own section. Evidence with every single check: [`tests/results/acceptance-edge.json`](../tests/results/acceptance-edge.json), [`tests/results/acceptance-firefox.json`](../tests/results/acceptance-firefox.json); the Chrome file records the missing measurement.

Command for everything below: `node tests/run.mjs` (one case: `node tests/run.mjs --browser edge --only T-10`). Input is real: key and mouse events are sent through the DevTools protocol, files are opened through the file input of the page, downloads are real browser downloads whose bytes are read from disk. Where a mock is used it is named.

`PASS` means every check of the case held. It does not mean the case was reviewed by someone else. A part of a case that could not be carried out is recorded as `NOT MEASURED` in the result file and in the console output, with the reason; it never counts as a passed check. This run in Edge: 89 cases pass, 809 checks, 3 parts NOT MEASURED (native file pickers, in T-16 and RV-01; the real file in A5-04). The clipboard paste with a trusted key event (X-04) and the file drop (T-15) were carried out in this run.

Both independent reviews found defects that this suite had passed over. A `PASS` below therefore says that the listed checks hold for the listed inputs, in one browser, and nothing more. For S-04, S-05, S-06 and S-08 the rows state the limits that are known.

The independent review of alpha.1 rated the suite as not sufficient for full acceptance of S-04, S-05 and S-06, because it passed while the product had the defects RV-01 to RV-04. The rows below state what is measured now. They are the implementer's results and await the re-review.

## Product requirements

| ID | Requirement (short) | Implementation | Evidence | Result |
| --- | --- | --- | --- | --- |
| P-01 | German learning editor, short toolbar, standalone | `src/app.html` | screenshots during development; texts in the template | implemented; understanding by pupils NOT MEASURED |
| P-02 | Single file from the file system, no server, no cache | `tools/build.mjs` | T-01 | PASS in Edge; Chrome NOT MEASURED; additionally PASS in Firefox, which the brief does not name |
| P-03 | Full source left, editable page right, both visible | `src/app.html`, `src/js/app.js:138`, `:239` | T-02, T-03 | PASS |
| P-04 | New, open, save/download, format, blocks, bold/italic, lists, links, images with alt, undo/redo, keyboard, umlauts | `src/js/app.js`, `src/js/commands.js` | T-01, T-04…T-08, T-10, T-13, F-01…F-11 | PASS. **Owner's decisions of 2026-11-19 that change the wording of the contract:** the description of an image (alt) is offered but optional; an image is written as a file name, not embedded. Added on the owner's request: alignment, width of images, changing existing images and links |
| P-05 | Plain tags, valid nesting, no spans/fonts/inline CSS for basic text formatting; documented choice `<b>`/`<i>` | `src/js/serialize.js:245`, `src/js/commands.js:300`, `:485` | T-04, T-05, F-03 | PASS. Alignment is written as `style="text-align: …"`, the one style attribute the editor writes: HTML has no tag for it. Paragraph, headings, bold and italic stay plain tags (T-04) |
| P-06 | At most 200,000 bytes, complete | `tools/build.mjs` | X-06 note, STATUS | 184,546 bytes |
| P-07 | No mail tools, minify, templates with remote content, tracking, persistence | — | X-06, T-17 | PASS |

## Safety and data model

| ID | Requirement (short) | Implementation | Evidence | Result |
| --- | --- | --- | --- | --- |
| S-01 | Opened and pasted content is inert | `src/js/project.js:165`, `:215`; `src/app.html` (sandbox); `src/js/app.js:1100–1169` | X-01, X-02, X-04 | PASS |
| S-02 | No automatic external access | `src/js/project.js:165–250`; policy in `tools/build.mjs` and `src/js/app.js:30` | X-03 (0 delivered requests, control fetches) | PASS |
| S-03 | Parent-controlled sandboxed frame, composition proven on the delivered file | `src/app.html`, `src/js/app.js:1259` | X-01…X-03, X-06 | PASS |
| S-04 | Source separate from projection, inactive content kept and announced | `src/js/project.js:349`, `src/js/serialize.js:284`, `:329`; note: `src/js/project.js:148`, `src/js/app.js:275`, `:1161` | T-09, X-01, X-03, R-01, RV-04, A3-05 | PASS for the listed inputs. Two reviews each found a stop by the policy without a note (RV-04, A3-05). Since alpha.4 every stop the browser reports is announced, without conditions; the limit is that the browser must report it (Edge 157 only) |
| S-05 | Visual commits keep unrelated content | `src/js/serialize.js:184`, `:284`, `:370`; lists: `src/js/commands.js:96`, `:158`, `:194`; attributes: `src/js/util.js:314`; alignment: `:172`, `:232`; formatting: `src/js/app.js:723`, `:765`, `src/js/util.js:267`, `src/js/project.js:483`, `:507`, `:527` | T-09, T-02, T-05, R-01 (92 edits, 91 exact, 1 with trailing spaces dropped), R-02 (984 generated edits exact), RV-02, RV-03, F-02, F-03, A3-01, A3-02, A3-03 | PASS for the listed inputs. Found by review and corrected: formatting under author CSS (RV-02), again for rules that hold only sometimes (A3-03); attributes in list commands (RV-03); alignment rewriting text inside a CSS string (A3-01); attribute edits in badly written tags (A3-02). Known limit: formatting cannot answer for styles that a script of the page changes later |
| S-06 | One revision model, no stale overwrite, flush before use | `src/js/app.js:226`, `:292`, `:1046`, `:1100–1125`, `:1237`; replacing the document: `:833–857`, `:859`, `:896`; image dialog: `:505`, `:584` | T-10, T-11 (42 schedules + 24 alternating keystrokes), T-15, RV-01 (6 schedules with a held file read), RV-02 (text typed while the layout check runs), A3-04 (2 schedules with a held image check) | PASS for the listed schedules. Found by review and corrected: a file read that finishes late (RV-01); an image check that finishes for a cancelled dialog or an earlier choice (A3-04). Native file pickers NOT MEASURED |
| S-07 | Selection, caret, scroll kept; one history; no focus theft | `src/js/app.js:157`, `:230`, `:326`, `:387`; `src/js/history.js:3` | T-03, T-12, T-13 | PASS |
| S-08 | Link and alt input as data, scheme check, images by relative address, limits | `src/js/util.js:51`, `:86`, `:96`, `:122`; `src/js/images.js:18`; `src/js/commands.js:358`, `:405`, `:421`, `:450` | T-06, X-04, F-01, F-02, X-08, unit "link addresses", "images" | PASS for the listed inputs. A chosen picture file is only looked at (signature, size; files above 20 MB are refused, F-01) and never kept; the address in the source is a file name made by the editor from that choice and an optional folder name, which is checked. **Owner's decision of 2026-11-19 (alpha.4):** the page pane shows the picture files that relative addresses name, seen from the editor; only addresses on the editor's own computer are resolved (F-01, unit test). Accepted residual risk: the CSS of an opened page can show picture files of this computer, and Edge attempts file addresses of other computers named there (X-08, SECURITY.md) |
| S-09 | No eval, no runtime loading, no library | whole file | X-06 | Static scan: dynamic code, storage, network APIs, URLs (the SVG namespace of the generated picture boxes is one of the inert ones), script count, sandbox, both policies with `img-src data: 'self'` and the matching script hash, an object address only for the download of the page | PASS (12) |

## Functional cases

| ID | What is checked | Main code | Fixture | Result (Edge) |
| --- | --- | --- | --- | --- |
| T-01 | Offline start from `file://`, typing with umlauts in both panes, no request | `src/js/app.js:1259` | built-in template | PASS (6 checks) |
| T-02 | Edits in both directions; afterwards only the two edited places differ from the file | `src/js/app.js:1046`, `:292` | `tests/fixtures/basic.html` | PASS (4) |
| T-03 | Caret in the 2nd of three identical paragraphs marks source line 16; double-click in nested emphasis marks that text; source caret marks the 3rd paragraph; focus and next keystroke stay in the pane | `src/js/app.js:326`, `src/js/project.js:368–434` | `basic.html` | PASS (9) |
| T-04 | p→h1 keeps attributes verbatim, h2 keeps children, bold/italic on selection, in a heading, on the word at the caret; saved file has no span/font/style and differs only at the edited places | `src/js/commands.js:120`, `:300` | `basic.html` | PASS (13) |
| T-05 | Three paragraphs → list, the first item keeps the attributes of its paragraph as written; Enter adds an item; switch to numbered; reopen gives the same structure; remove gives paragraphs, the first with its attributes; no list in a paragraph, no empty paragraph | `src/js/commands.js:194`, `:158` | `basic.html` | PASS (9). The alpha.1 expectation of this case contained the attribute loss of RV-03 and was corrected |
| T-06 | Link with escaped address, inert in the page, removal restores the source exactly; five disguised script/data addresses refused; markup-shaped address stays one attribute; with the editor in a folder: the dialog finds a picture next to it, the image is written as file name with escaped description, no image data in the source, the page pane shows the file from the folder; no image chosen is explained; text and SVG files refused; a 5.8 MB picture from another folder is reported as not found, adds only its file name, and the pupil is told where the file belongs | `src/js/app.js:454`, `:539`, `:629`; `src/js/util.js:51`, `:122`; `src/js/images.js:18` | generated PNG files | PASS (27). Changed with alpha.3: images are no longer embedded or scaled, a missing description is no longer asked for. Changed with alpha.4: pictures are shown from the folder of the editor |
| T-07 | Formatted text equals a hand-written expectation; only white space changed; parsed text, `pre`, `textarea`, `script`, `style`, attribute with `>` unchanged; inline spacing kept; undo; document with `white-space: pre` refused | `src/js/format.js:16`, `src/js/app.js:765`, `src/js/project.js:436` | `format-in.html`, `format-expected.html`, `malformed.html` | PASS (16). Rendering under author CSS: see RV-02 |
| T-08 | Open → download without edit is byte-identical for LF, CRLF, BOM+CRLF, BOM+LF; mixed line ends unified and announced; Windows-1252 file only after a question and then correct; UTF-16 refused | `src/js/util.js:386`, `:409`; `src/js/app.js:859` | generated from `basic.html` | PASS (19) |
| T-09 | Old-style document (public doctype, upper-case tags, omitted end tags, table without tbody, inactive script/handler/external image): downloaded file equals original plus the typed character; edited paragraph keeps handler and character references; no end tags added; joining paragraphs keeps the inactive script; replacing all content keeps frame and script | `src/js/serialize.js:122`, `:184`, `:329` | `legacy.html` | PASS (10) |
| T-10 | Type in the page and save at once: download button, Ctrl+S in page and source (download fallback) contain the last keystroke while the edit was still pending; **mock** file handle: written text has the keystroke, second save reuses the handle, failed write and cancelled picker leave the document unsaved | `src/js/app.js:927–1035` | template | PASS (13) |
| T-11 | Source→page, page→source and typing into an outdated page, each with delays 0–800 ms, twice (42 runs); 24 keystrokes alternating between panes without pause | `src/js/app.js:226`, `:292`, `:1100–1125`, `:1237` | generated | PASS (3) |
| T-12 | 146,008-character document: 162 fast keystrokes complete and in order; source caret not moved; page scroll kept on source edit; selection survives toolbar; IME composition committed once | `src/js/project.js:269`, `src/js/app.js:157` | generated | PASS (11); 162 keystrokes sent in about 1.8 s, panes in sync after about 2.0 s (including automation overhead) |
| T-13 | Source edit, page edit, toolbar command: undo ×3, redo ×2, new edit disables redo, Ctrl+Z/Y from both panes continue the same history, a burst is one step | `src/js/history.js:3`, `src/js/app.js:387–409` | template | PASS (13) |
| T-14 | Malformed file shown unchanged, unmappable parts read-only, typing changes one character only; fragment without end; empty file; file above 5 MB refused; 30,000 nested elements | `src/js/project.js:110`, `src/js/tree.js:26`, `src/js/app.js:239` | `malformed.html`, generated | PASS (15) |
| T-15 | New/Open ask before discarding; cancel and Escape keep the work; binary file refused, work kept; Open button with file chooser; file dropped on the window opens, asks first when unsaved; **mock**: opening a file while a slow save is pending asks first, and the save that finishes afterwards does not mark the new document saved | `src/js/app.js:833–910`, `:1037` | fixtures | PASS (12). File reads that finish late: see RV-01 |
| T-16 | Without file access API the Save button downloads; bytes as expected | `src/js/app.js:956` | `basic.html` | PASS (3). Native pickers and write-back: **NOT MEASURED** |
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
| X-08 | **Residual risk accepted by the owner, measured, not a protection:** the CSS of an opened page names a picture next to the editor, one in the folder above, one on another computer and one on the local counting server, both as generated content and as background | PASS (5): the pictures next to and above the editor are shown; the network picture is not shown and nothing reaches the counter; the note announces it. Notes: Edge reports an attempt for the `file://rechner/…` address and for the network address (stopped by the policy, as in X-03); Firefox reports neither to the test driver |

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

## Functions asked for by the owner after trying alpha.2 and alpha.4

Code: `tests/browser/features.mjs`. Expected source texts are written by hand.

| ID | What is checked | Main code | Result (Edge) |
| --- | --- | --- | --- |
| F-01 | **A copy of the editor in a folder with pictures.** A picture file above 20 MB is refused; the dialog says at once that a file is not found without its folder and found with it, and shows it; a folder name with a colon and three wrong widths are refused with an explanation; folder, file name, empty description and width are written as plain attributes; the page pane shows the file from the folder in that width, no note, no hint; the folder is suggested for the next picture; `#` and `%` of a file name are written as percent codes and the file is still found; the saved file holds relative addresses only. A page that names a missing file: a box with "Bild nicht gefunden: …", a tooltip, a note above the page naming it, nothing in the note about switched-off content, code unchanged; after the file is copied and the pupil comes back (**test seam:** `document.hasFocus` replaced for a moment, blur and focus sent to the window) the picture is shown and the note is gone; a file that appears while the editor stays in front is shown after the image dialog. **A page with every kind of address:** pictures in a subfolder and in the folder above are shown; network, protocol-relative and `file://rechner/…` pictures are boxes, the browser reports no request for them and nothing reaches the local counter; every image element has a `data:` address or one inside the test folder; the box of a network picture says so and explains what to do; the note counts the three pictures from outside; code unchanged | `src/js/util.js:122`, `src/js/project.js:167`, `:178`, `src/js/app.js:515–536`, `:539`, `:629` | PASS (38). Rewritten for alpha.4: until alpha.3 this case checked that pictures next to the editor are never read |
| F-02 | An image tag with upper-case names, single quotes, an unquoted value and an event handler: accepting the dialog unchanged changes nothing and adds no undo step; new width rewrites `width` and removes `height`; new description is written inside the pupil's single quotes; new folder changes only that part of the address; empty width removes the attribute; four undo steps restore the text. An embedded picture and a network picture keep their address when width or description change; choosing a file replaces the address. Link: the dialog opens with the address of the link around the caret or the selection; a disallowed address is refused; the new address replaces only the value inside its quotes; an anchor without address gets one; links in the page pane stay inert; a selection reaching beyond a link is explained | `src/js/commands.js:110`, `:421`, `:440`, `:450`; `src/js/util.js:314`; `src/js/serialize.js:312` | PASS (23) |
| F-03 | Centre, justified, right write one `style` attribute; left removes it and the original text is back; the buttons show the alignment; three blocks at once; an existing `STYLE='color:red'` keeps its declaration, spelling and quotes and gets them back; list item and table cell; each alignment is one undo step; a clicked picture aligns its paragraph; a picture directly in the page gets its own paragraph and stands at the right edge; the saved file has no other style attribute; "Code aufräumen" accepts the aligned page; with a page rule that centres paragraphs, left is written out; Enter after an aligned paragraph gives at most this alignment | `src/js/commands.js:485`, `src/js/util.js:136`, `:172`, `src/js/serialize.js:259` | PASS (21) |
| F-04 | The version follows the name in the top bar, smaller and in another colour; name and version stay on one line in a top bar 1800, 1000 and 640 pixels wide | `src/app.html`, `src/style.css` | PASS (5) |

Unit tests of the helpers behind these functions: `tests/unit/attrs.test.mjs` (10 tests, all pass).

## Functions asked for by the owner for alpha.5

Code: `tests/browser/features5.mjs`. Expected source texts are written by hand. Each case passes in Edge and in Firefox.

| ID | What is checked | Main code | Result (Edge) |
| --- | --- | --- | --- |
| F-05 | Subscript on a digit, superscript on the same digit replaces it, superscript again removes it; underline by button and by Ctrl+U, highlight, superscript as plain tags; no style, span or font in the page; button states; highlight removed again; one undo step per command; the saved file | `src/js/commands.js:233`, `:300` | PASS (11) |
| F-06 | A new link with "new tab" gets `href` and `target="_blank"`, no `rel`; the page pane has no address or target; `TARGET=_blank` of an existing link shows the box ticked and unticking removes only that attribute; `target="_top"` is not ticked and stays when accepted, ticking replaces it by `_blank`; typing next to a link keeps its target; undo back to the original | `src/js/commands.js:450`, `src/js/project.js:186`, `src/js/serialize.js:256` | PASS (10) |
| F-07 | A clicked picture becomes a link without asking for text; its address is changed; the picture inside it is changed through its own dialog; "Link entfernen" with the picture clicked restores the picture; it is still shown from the folder | `src/js/commands.js:358`, `:450` | PASS (7) |
| F-08 | Real mouse drag of the heading moves the help dialog by the same distance and keeps its size; dragged to the edges it stays inside the window; opened again it is centred; dragging its text does nothing; the question without heading is moved by its text and cancelling keeps the page | `src/js/app.js:102` | PASS (11) |
| F-09 | **Mock:** `window.open` recorded. A page never saved: question, cancelled, nothing opened; an opened unchanged file: its name next to the editor, percent-encoded, `_blank`, `noopener`, status explains "file not found"; with unsaved changes: question, saving is a download, nothing opened, status names "Downloads" | `src/js/app.js:998` | PASS (8) |
| F-10 | Title with `&` and `<` escaped, nothing else changes, parsed title correct; undo also resets the field; added to a head without title, indented like the next line; after `<html>` when only an SVG title exists; in front of a page without head, html and doctype; an unclosed title is left alone with a message; Ctrl+S while typing in the field saves the new title; a page whose body is read-only still gets its title | `src/js/format.js:89`, `src/js/app.js:1017` | PASS (12) |
| F-11 | "gespeichert" and "● nicht gespeichert" bold, in different colours; nine groups of buttons, every one but the first above the page with a line in front, buttons inside close together | `src/style.css` | PASS (3) |

## Functions asked for by the owner for alpha.7

Code: `tests/browser/features7.mjs`. Expected source texts are written by hand. Each case passes in Edge and in Firefox.

| ID | What is checked | Main code | Result (Edge) |
| --- | --- | --- | --- |
| F-12 | A word gets `<span style="color: red">`; one whole `<b>` gets the colour on its tag; a whole centred paragraph gets `text-align: center; color: green`; the caret in a coloured word changes that span; "Farbe entfernen" removes the span; removing from part of a coloured paragraph changes nothing and says so; letters in a word get a span; the whole first paragraph gets the colour and the colours inside it go, no span left; one undo step per colour; the download | `src/js/commands.js:543` | PASS (12) |
| F-13 | A colour added to `style="font-family: &#34;A B&#34;"` keeps the references, removed again gives the original; two whole list items each get the colour; parts of two paragraphs get one span each in their order; a selection from inside a red span into the text behind it cuts the span; a span with a class keeps it; an unreadable style is left alone with a message; the code changed while the dialog is open: nothing is applied | `src/js/commands.js:528`, `:276`; `src/js/util.js:172` | PASS (11) |
| F-14 | A 2 × 3 table with header row and `border="1"` behind the paragraph, written by hand-written expectation without `tbody`; the caret in the first cell; Tab, Tab at the end of a row and Shift+Tab; typed text in its cells; without header and border only `td`; 0 rows keeps the dialog open; behind the list for a list item; the code changed while the dialog is open: no table; the download | `src/js/commands.js:626`, `:693`; `src/js/serialize.js:267` | PASS (12) |
| F-15 | In a table between a comment and paragraphs: row below, column right (th in the header row), delete both again: the text as written; first column and second row deleted; the last row and column stay with a message; two undo steps back; merged cells refused with a message; no table inside a table | `src/js/commands.js:648`, `:668` | PASS (12) |
| F-16 | A compact page with a table is tidied and has the same cells; a column is added to the tidied table and nothing else changes | `src/js/commands.js:668` | PASS (4) |

Unit test "text colour" (`tests/unit/attrs.test.mjs`): `withDecl()` for `color` with strings, `background-color` and unreadable text; `plainStyle()` accepts only alignment keywords and the eight palette names.

## Regressions for the findings of the reading review of alpha.10

Code: `tests/browser/review10.mjs`. The inputs follow the reproductions that confirmed the two points in Edge and Firefox; the expected texts are written by hand. Both cases fail against the alpha.10 build and pass against this one, in Edge and in Firefox. The checks marked "guard" pass against both builds.

| ID | Finding | What is checked | Result (Edge) |
| --- | --- | --- | --- |
| A10-01 | T1-6 | The write of A is held; a file of the same name is dropped on the window (no handle). With another text, untouched: it stays "gespeichert" and the footer says "Die vorige Seite „seite-a.html“ ist gespeichert.". With another text, typed until it reads like the text written to A: it stays "● nicht gespeichert". Guard: with the text A had before the write (A itself): "● nicht gespeichert" with the message, as since alpha.10 (mock handle for A whose content changes on `close()`; the dropped file is a File object in a drop event made by the test) | PASS (6) |
| A10-02 | T2-3 | `<p style="color:red !important">` and `<p style="color:red /* x */">` around a blue span, the whole paragraph selected, "Grün" and "Farbe entfernen": the source stays as written, with a message. Three paragraphs, the middle one with `!important` and a blue span: the outer two turn green, the middle one stays whole; one undo gives the text before. Guard: without `!important` the paragraph is coloured and the colour inside goes | PASS (12) |

## Regressions for the findings of the reading review of alpha.9

Code: `tests/browser/review9.mjs`. The inputs follow the measurements that confirmed the reviewer's points; the expected source texts are written by hand. A9-01 to A9-06 fail against the alpha.9 build (Edge 157, 2026-11-20) and pass against this one in Edge and in Firefox; A9-07 closes gaps in the tests and passes against both.

| ID | Finding | What is checked | Result (Edge) |
| --- | --- | --- | --- |
| A9-01 | F9, footer | A file with a held first write is opened again: the question names the running save; after the write the open page counts as not saved, with a message; only the first write happens. With another page open: "Die vorige Seite „seite-a.html“ ist gespeichert.", and that page stays saved (mock handles whose content changes on close, labelled) | PASS (8) |
| A9-02 | F5 | A held write: the top bar says "Speichert …", also after the title message took the footer; afterwards "● nicht gespeichert", because the title changed meanwhile (mock handles) | PASS (4) |
| A9-03 | F6 | `color: red !important` with red, blue and "Farbe entfernen", `text-align:center !important` with centre and left: the source stays as written, with a message | PASS (8) |
| A9-04 | F4 | "Links" next to `@media print { p { text-align: center !important } }` writes `text-align: left` and says that the rule can override it; without `!important`, no such message | PASS (3) |
| A9-05 | S3-01 | Enter behind the only item `<li>a` and behind the last of two: that item gets `</li>`, keeps its height under `white-space: pre`; definition list: the exact source | PASS (4) |
| A9-06 | first cell | Deleting the first cell keeps the indentation of the next one; deleting the first row of a table on lines keeps the next row's line | PASS (2) |
| A9-07 | S1 3 and 5 | Another page saved while the first one writes: both written, each through its own handle, no picker; a failed first write and a waiting one: the newest text is written (mock handles) | PASS (5) |

## Regressions for the findings of the interim review of alpha.8

Code: `tests/browser/review8.mjs`. The inputs follow the interim reviewer's probes; the expected source texts are written by hand. Every case fails against the alpha.8 build (0 of 3 pass, Edge 157, 2026-11-20) and passes against this one in Edge and in Firefox.

| ID | Finding | What is checked | Result (Edge) |
| --- | --- | --- | --- |
| A8-01 | F1 | A held first save, a second save asked for, another page opened: after "Änderungen verwerfen" only the first write happens, the picker is not called for the new page, the new page is open and saved; after "Abbrechen" both writes happen, the newest text last (mock handle, labelled) | PASS (5) |
| A8-02 | F2 | Row and column added and deleted in tables whose first row or cell stands without a line break and the others on lines: the original text, byte for byte; a cell of the source deleted keeps the line break behind it; behind a row without end tag the deleted row's white space goes too | PASS (6) |
| A8-03 | F3 | Enter behind `<li>a` without end tag under `white-space: pre`: `a` gets `</li>`, keeps its text and its height; `dt`/`dd`; an item that ends with its own line break keeps its omitted end tag | PASS (5) |

## Regressions for the findings of the review of alpha.6 and alpha.7

Code: `tests/browser/review7.mjs`. The inputs follow the reviewer's checklist; the expected source texts are written by hand. Every case fails against the alpha.7 build (0 of 8 pass, Edge 157, 2026-11-20) and passes against this one in Edge and in Firefox.

| ID | Finding | What is checked | Result (Edge) |
| --- | --- | --- | --- |
| A7-01 | 1.1h | Red on `style="/* x */ color: blue"` and centre on `style="text-align: right /* r */"`: nothing changes, with a message; red and removing on `style="font-family: A /* f */; color: blue"`: the comment in the other declaration stays | PASS (6) |
| A7-02 | 2.3 | "Links" on `style="text-align: right"` writes `text-align: left` with `<style media="print">`, `@media print` and `p:hover` rules that centre; removes the declaration with print rules without an alignment and without style element | PASS (5) |
| A7-03 | 1.4d | A table with `<colgroup>`: adding and deleting a column change nothing, with a message; a row is added; a table with `<col>` and no `<colgroup>` is not editable in the page pane | PASS (6) |
| A7-04 | 2.4 | A held first save: "Speichert …" while it hangs, also after nine seconds; the top bar shows "Speichert …" too (since alpha.10, before "● nicht gespeichert"); two more saves asked for meanwhile: two writes in all, the older text first and the newest last; then "Gespeichert" (mock handle, labelled) | PASS (8) |
| A7-05 | 1.4c | A table without line breaks with caption, `thead`, `tbody`, `tfoot`: in each part a row below and a column right are written without line breaks; deleting them gives the original text back, byte for byte | PASS (12) |
| A7-06 | 1.4e | `<tr><td>a<td>b` with comments around: a new column keeps the omitted end tags; deleting it gives the original back; deleting the second row keeps the omitted end tags of the first | PASS (3) |
| A7-07 | 2.2-7 | `<img src="?nur">`: accepting unchanged changes nothing; another folder keeps the dialog open with a message; the code stays | PASS (4) |
| A7-08 | 2.9-2 | `style="  text-align:center  "`: centre leaves it as written; right and centre keep the white space at both ends | PASS (3) |

## Regressions for the findings of the review of alpha.4 and alpha.5

Code: `tests/browser/review6.mjs`. The inputs follow the reviewer's reproductions; the expected source texts and bytes are written by hand. Every case fails against the alpha.5 build (0 of 14 pass, Edge 157, 2026-11-19) and passes against this one in Edge and in Firefox.

| ID | Finding | What is checked | Result (Edge) |
| --- | --- | --- | --- |
| A5-01 | ATTR | `<img src=tile.png width="20"alt=diagram>`: the browser reads three attributes; the width is cleared in the image dialog; source and download are `<img src=tile.png alt=diagram>`, which the browser reads as address and description | PASS (4) |
| A5-02 | IMG-QUERY | `tile.png?view=class/2`: the dialog proposes no folder and this address; accepted unchanged nothing changes; another folder gives `bilder/tile.png?view=class/2` in source and download | PASS (4) |
| A5-03 | MEDIA | A compact page whose paragraphs are inline under `<style media="(min-width:1500px)">` is refused with the explanation for conditional rules and stays unchanged; control: `media="all"` with a colour rule is tidied | PASS (4) |
| A5-04 | WRITES | **Mock** handle whose first close is held: a second Ctrl+S does not start writing while the first is held; after release the file gets the older and then the newer text; the page shows "gespeichert". In Firefox the writes go into a real origin-private file, which then holds the newest text; Edge refuses such a file from a `file:` address (NOT MEASURED there) | PASS (3, 1 part NOT MEASURED) |
| A5-05 | BROWSE-SWITCH | **Mock** handle with a held close and recorded `window.open`: "Im Browser öffnen" on a changed page A, save confirmed; page B opened while the save waits; after release the file holds A and no tab is opened | PASS (3) |
| A5-06 | STYLE-SPLIT | Bold removed from B of `<b style="color:red">ABCD</b>` gives `<b style="color:red">A</b>B<b style="color:red">CD</b>`; italic removed from the middle of `<i class="k">efgh</i>` keeps the class on both parts; the download is exactly that | PASS (3) |
| A5-07 | LIST | Two paragraphs with `<hr>` between them made a bulleted list: the parsed order is list, line, list; undo gives back the text | PASS (2) |
| A5-08 | IMG-PENDING | **Timing seam** as in A3-04: a first picture checked, a second one held in its check; "Einfügen" keeps the dialog open with a message and inserts nothing; after release the second picture is inserted | PASS (4) |
| A5-09 | NOTICE | A head with `<link rel="icon" href="symbol.png">`: the note says "1 weiterer Verweis", the page pane has no link, the download keeps it | PASS (3) |
| A5-10 | TITLE-RELOAD | A title typed into the field: "● nicht gespeichert" and a cancelable `beforeunload` event is prevented; Escape: "gespeichert" and not prevented | PASS (5) |
| A5-11 | DIALOG-RESIZE | The help dialog dragged to the right edge of a 1400-pixel viewport; the viewport narrowed to 640 × 800 (the size of the reviewer's probe; until alpha.6 640 × 700, where the dialog grown in alpha.7 scrolls): the dialog and its button lie inside and the button closes it | PASS (4) |
| A5-12 | TARGET-CASE | `TARGET="_BLANK"`: the box is ticked; unticking removes the attribute | PASS (2) |
| A5-13 | ALIGN | `style=" color: red; font-family: &#34;A B&#34;; text-align: center "`: left keeps spaces and references; centred again gives back the original text, also in the download | PASS (3) |
| A5-14 | BYTES | BOM, German text, an emoji, two CRLF and three LF in a row: downloaded with LF and BOM, byte for byte as expected | PASS (1) |

The reviewer's probes were run unchanged from a copy outside the repository against this build: in Edge 18 of 19 pass and WRITES is NOT MEASURED; in Firefox 18 of 19 pass and WRITES stops with a timeout, because the probe waits for the second save to finish while it holds the first, and the second save now waits for the first. The order is measured by A5-04 instead.

## Regressions for the findings of the review of alpha.2 and alpha.3

The reviewer's inputs are used unchanged; further inputs of the same kind were added. Code: `tests/browser/review3.mjs`.

| ID | Finding | What is checked | Result (Edge) |
| --- | --- | --- | --- |
| A3-01 | Alignment rewrote text inside a CSS string of the same style attribute (S-05, F-03) | Reviewer sample (`--label:"A;text-align: left;B"; color:red`): centre appends the declaration, the string stays, the generated text in front of the paragraph is unchanged, left gives back the original. An address with a semicolon inside brackets, a comment that mentions `text-align`, the property name written with a CSS escape and two alignment declarations each give the hand-written result. Three style texts with an open string, bracket or comment are left alone and the pupil is told why | PASS (13) |
| A3-02 | Attribute edits in badly written tags changed the meaning (S-05, F-02) | Reviewer sample with `width`/`WIDTH` and `height`/`HEIGHT`: clearing the width leaves neither attribute, in source and in the parsed image; a new width goes to the first one. Reviewer sample `alt= >`: the new description is written as `alt="Changed" >` and no extra attribute appears. Another odd spelling keeps the meaning of the attributes that were not changed | PASS (8) |
| A3-03 | "Tidy up" inserted a visible gap at another window width (S-05, T-07) | 11 documents are refused with a reason and stay unchanged: the reviewer sample (`@media(min-width:1500px){p{display:inline}}`), inline under `:hover`, box type through `var()`, a custom property set under a condition, `@keyframes` that change the box type, `details[open]`, generated content under `@supports`, a condition written with a CSS escape, a string that is not closed, and inline paragraphs in a part that is hidden by the `hidden` attribute or in closed `details`. 3 documents with harmless conditional rules or a plain hidden part are formatted; original and result are rendered as ordinary pages at 500 and at 1800 pixels and every box and the gap between two words are compared. The reviewer's measurement at 1800 pixels: the gap is what it was | PASS (43) |
| A3-04 | An image from a cancelled dialog replaced a later choice (S-06, F-01) | **Timing seam:** completion of `createImageBitmap()` is held after the real decoding. Reviewer schedule: choose, cancel, open again, choose another file, release: the open dialog keeps its file and that file is inserted. Second schedule: two choices in one dialog, the slower first one finishes last: the later choice stays and is inserted | PASS (7) |
| A3-05 | A stop by the policy for a very short address was not announced (S-04) | Reviewer sample (escaped `url()` to a one-letter path) and two more (bare host, percent codes): nothing reaches the local counter, the note says that the browser stopped something, the source is unchanged; control: the browser reports the stops. After the address is deleted the note stays; a new page starts without it | PASS (12) |
| A3-T | The test helper for opening a file returned too early when the new file had the name of the open one | Reviewer schedule with a held read: the helper has not returned while the read is held, and when it returns the new bytes are in the editor | PASS (3) |

The reviewer's probe script (`docs/reviews/review-alpha3.mjs`) is unchanged. Against this version its probes for A3-01, A3-02 (four), A3-03 and the frame check pass; then it stops in the A3-04 probe with a timeout, because that probe waits for the file of the cancelled dialog to appear in the open one, which no longer happens. Its probes for A3-05 and A3-T come after that point and do not run in that script. Its recorded alpha.3 results are kept as failed-before evidence.

## Firefox

The task brief names Edge and Chrome. The owner had Firefox measured by the reviewer for alpha.3 ([reviews/FIREFOX_0.1.0-alpha.3.md](reviews/FIREFOX_0.1.0-alpha.3.md)): four cases failed there (T-03, T-07, R-01, R-02). The same suite now runs in Firefox through `node tests/run.mjs --browser firefox`, with the reviewer's driver `tests/lib/firefox.mjs`.

Result for this version in Firefox/160.0.1: 83 cases pass, 5 partial, 1 not measured, none failed; 766 checks, 7 parts NOT MEASURED.

| Case | Status in Firefox | Why not complete |
| --- | --- | --- |
| T-12 | PARTIAL (9 checks pass) | input-method composition cannot be driven by the Firefox driver |
| T-15 | PARTIAL (7 checks pass) | the file chooser cannot be intercepted; the chooser, drop and mock-save parts behind it do not run |
| RV-01 | PARTIAL (6 checks pass) | same: only the first of six schedules runs |
| RV-02 | PARTIAL (35 checks pass) | scripts cannot be switched off for the ordinary comparison pages; the comparison of accepted results and the held-check schedule do not run |
| A3-03 | PARTIAL (34 checks pass) | same: all refusals are measured, the comparison of the three accepted results is not |
| X-04 | NOT MEASURED | a constructed paste event carries no data in Firefox; the system clipboard is not automated |
| all other 83 cases | PASS | |

Findings of the Firefox measurement of alpha.3 and their regressions (code: `tests/browser/review3.mjs`; the cases run in every browser):

| ID | Finding | What is checked | Result |
| --- | --- | --- | --- |
| FF-01 | While typing, Firefox removed a space in a neighbouring text behind a comment, and a line break behind an unknown element (S-05) | Reviewer samples: a letter typed in front of a comment leaves the space behind it; a line break behind an unknown element stays. The gap between the words can still be deleted on purpose with the Delete key. Spaces on both sides of a comment between inline elements stay | PASS in Edge and Firefox (5) |
| FF-02 | Firefox keeps a line break of its own in a page without visible content; the projection took it over and the writer wrapped it in a paragraph (S-05) | After an empty page, a document that starts with `<br>` shows exactly one line break and an edit elsewhere leaves it as written; a command in an empty page gives one empty paragraph; text typed into an empty page becomes one paragraph. The module-level round trip R-02 passes in Firefox for all 3,044 documents | PASS in Edge and Firefox (4) |
| FF-03 | "Tidy up" was refused in Firefox for the T-07 fixture although nothing would change | T-07 in Firefox: the fixture is formatted to the hand-written expectation. Cause: Firefox reports a box with a height and no width for white space between blocks; the comparison now counts white space only if it has a width | PASS (T-07, 16 checks, in both browsers) |
| T-03 | Firefox selects a word together with the space behind it | The expectation is now the same for every browser: the marked source without its tags is the text selected in the page | PASS in Edge and Firefox (9) |

The reviewer's Firefox diagnostics script (`tests/firefox-diagnostics.mjs`, unchanged) reports for this version: comment sample exact, T-07 fixture formatted, all three module round trips exact. Its recorded alpha.3 results are kept; the file it rewrites was restored after the run.




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
