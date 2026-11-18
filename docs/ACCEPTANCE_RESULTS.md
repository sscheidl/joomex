# Acceptance results

Artefact: `dist/school-editor.html`, 132,438 bytes, SHA-256 `5453d49ec893fb5ebb1e1d55391c3d51353df0b92126076d8945821e55a0ca55`.

MEASURED 2026-11-18 on Windows 11 Pro (10.0.26300) with Microsoft Edge **157.0.4341.60**, new headless mode, fresh browser profile per run, artefact opened from `file://`. Chrome: **NOT MEASURED** (not installed). Evidence with every single check: [`tests/results/acceptance-edge.json`](../tests/results/acceptance-edge.json); the Chrome file records the missing measurement.

Command for everything below: `node tests/run.mjs` (one case: `node tests/run.mjs --browser edge --only T-10`). Input is real: key and mouse events are sent through the DevTools protocol, files are opened through the file input of the page, downloads are real browser downloads whose bytes are read from disk. Where a mock is used it is named.

`PASS` means every check of the case held. It does not mean the case was reviewed by someone else.

## Product requirements

| ID | Requirement (short) | Implementation | Evidence | Result |
| --- | --- | --- | --- | --- |
| P-01 | German learning editor, short toolbar, standalone | `src/app.html` | screenshots during development; texts in the template | implemented; understanding by pupils NOT MEASURED |
| P-02 | Single file from the file system, no server, no cache | `tools/build.mjs` | T-01 | PASS in Edge; Chrome NOT MEASURED |
| P-03 | Full source left, editable page right, both visible | `src/app.html`, `src/js/app.js:101`, `:201` | T-02, T-03 | PASS |
| P-04 | New, open, save/download, format, blocks, bold/italic, lists, links, images with alt, undo/redo, keyboard, umlauts | `src/js/app.js`, `src/js/commands.js` | T-01, T-04…T-08, T-10, T-13 | PASS |
| P-05 | Plain tags, valid nesting, no spans/fonts/inline CSS; documented choice `<b>`/`<i>` | `src/js/serialize.js:179`, `src/js/commands.js:255` | T-04, T-05 | PASS |
| P-06 | At most 200,000 bytes, complete | `tools/build.mjs` | X-06 note, STATUS | 132,438 bytes |
| P-07 | No mail tools, minify, templates with remote content, tracking, persistence | — | X-06, T-17 | PASS |

## Safety and data model

| ID | Requirement (short) | Implementation | Evidence | Result |
| --- | --- | --- | --- | --- |
| S-01 | Opened and pasted content is inert | `src/js/project.js:150`, `:178`; `src/app.html` (sandbox); `src/js/app.js:702–740` | X-01, X-02, X-04 | PASS |
| S-02 | No automatic external access | `src/js/project.js:150–212`; policy in `tools/build.mjs` and `src/js/app.js:30` | X-03 (0 delivered requests, control fetches) | PASS |
| S-03 | Parent-controlled sandboxed frame, composition proven on the delivered file | `src/app.html`, `src/js/app.js:809` | X-01…X-03, X-06 | PASS |
| S-04 | Source separate from projection, inactive content kept and announced | `src/js/project.js:303`, `src/js/serialize.js:212`, `:243`, `src/js/project.js:136` | T-09, X-01, X-03, R-01 | PASS |
| S-05 | Visual commits keep unrelated content | `src/js/serialize.js:124`, `:212`, `:271` | T-09, T-02, R-01 (92 edits, 91 exact, 1 with trailing spaces dropped), R-02 (984 generated edits exact) | PASS |
| S-06 | One revision model, no stale overwrite, flush before use | `src/js/app.js:188`, `:239`, `:648`, `:702–720`, `:788` | T-10, T-11 (42 schedules + 24 alternating keystrokes) | PASS |
| S-07 | Selection, caret, scroll kept; one history; no focus theft | `src/js/app.js:120`, `:192`, `:273`, `:326`; `src/js/history.js:3` | T-03, T-12, T-13 | PASS |
| S-08 | Link and alt input as data, scheme check, images only by choice, limits | `src/js/util.js:51`, `src/js/images.js:25`, `src/js/commands.js:309`, `:344` | T-06, X-04, unit "link addresses" | PASS |
| S-09 | No eval, no runtime loading, no library | whole file | X-06 | PASS |

## Functional cases

| ID | What is checked | Main code | Fixture | Result (Edge) |
| --- | --- | --- | --- | --- |
| T-01 | Offline start from `file://`, typing with umlauts in both panes, no request | `src/js/app.js:809` | built-in template | PASS (6 checks) |
| T-02 | Edits in both directions; afterwards only the two edited places differ from the file | `src/js/app.js:648`, `:239` | `tests/fixtures/basic.html` | PASS (4) |
| T-03 | Caret in the 2nd of three identical paragraphs marks source line 16; double-click in nested emphasis marks that text; source caret marks the 3rd paragraph; focus and next keystroke stay in the pane | `src/js/app.js:273`, `src/js/project.js:322–388` | `basic.html` | PASS (8) |
| T-04 | p→h1 keeps attributes verbatim, h2 keeps children, bold/italic on selection, in a heading, on the word at the caret; saved file has no span/font/style and differs only at the edited places | `src/js/commands.js:111`, `:255` | `basic.html` | PASS (13) |
| T-05 | Three paragraphs → list; Enter adds an item; switch to numbered; reopen gives the same structure; remove gives paragraphs; no list in a paragraph, no empty paragraph | `src/js/commands.js:154`, `:129` | `basic.html` | PASS (9) |
| T-06 | Link with escaped address, inert in the page, removal restores the source exactly; five disguised script/data addresses refused; markup-shaped address stays one attribute; image with exact bytes and escaped alt; missing image/alt asked for; text and SVG files refused; a 5.8 MB noise image scaled down to an embedded JPEG below 450 KB | `src/js/app.js:391`, `:425`; `src/js/util.js:51`; `src/js/images.js:25` | generated PNG files | PASS (21) |
| T-07 | Formatted text equals a hand-written expectation; only white space changed; parsed text, `pre`, `textarea`, `script`, `style`, attribute with `>` unchanged; inline spacing kept; undo; document with `white-space: pre` refused | `src/js/format.js:16`, `src/js/app.js:470`, `src/js/project.js:390` | `format-in.html`, `format-expected.html`, `malformed.html` | PASS (15) |
| T-08 | Open → download without edit is byte-identical for LF, CRLF, BOM+CRLF, BOM+LF; mixed line ends unified and announced; Windows-1252 file only after a question and then correct; UTF-16 refused | `src/js/util.js:89`, `:112`; `src/js/app.js:536` | generated from `basic.html` | PASS (19) |
| T-09 | Old-style document (public doctype, upper-case tags, omitted end tags, table without tbody, inactive script/handler/external image): downloaded file equals original plus the typed character; edited paragraph keeps handler and character references; no end tags added; joining paragraphs keeps the inactive script; replacing all content keeps frame and script | `src/js/serialize.js:93`, `:124`, `:243` | `legacy.html` | PASS (10) |
| T-10 | Type in the page and save at once: download button, Ctrl+S in page and source (download fallback) contain the last keystroke while the edit was still pending; **mock** file handle: written text has the keystroke, second save reuses the handle, failed write and cancelled picker leave the document unsaved | `src/js/app.js:597–638` | template | PASS (13) |
| T-11 | Source→page, page→source and typing into an outdated page, each with delays 0–800 ms, twice (42 runs); 24 keystrokes alternating between panes without pause | `src/js/app.js:188`, `:239`, `:702–720`, `:788` | generated | PASS (3) |
| T-12 | 146,008-character document: 162 fast keystrokes complete and in order; source caret not moved; page scroll kept on source edit; selection survives toolbar; IME composition committed once | `src/js/project.js:231`, `src/js/app.js:120` | generated | PASS (11); 162 keystrokes sent in about 2.0 s, panes in sync after about 2.3 s (including automation overhead) |
| T-13 | Source edit, page edit, toolbar command: undo ×3, redo ×2, new edit disables redo, Ctrl+Z/Y from both panes continue the same history, a burst is one step | `src/js/history.js:3`, `src/js/app.js:326–348` | template | PASS (13) |
| T-14 | Malformed file shown unchanged, unmappable parts read-only, typing changes one character only; fragment without end; empty file; file above 5 MB refused; 30,000 nested elements | `src/js/project.js:98`, `src/js/tree.js:26`, `src/js/app.js:201` | `malformed.html`, generated | PASS (15) |
| T-15 | New/Open ask before discarding; cancel and Escape keep the work; binary file refused, work kept; Open button with file chooser; file dropped on the window opens, asks first when unsaved; **mock**: a slow save that finishes after another file was opened does not mark the new document saved | `src/js/app.js:524–580`, `:640`, `:694` | fixtures | PASS (11) |
| T-16 | Without file access API the Save button downloads; bytes as expected | `src/js/app.js:618` | `basic.html` | PASS (3). Native pickers and write-back: **NOT MEASURED** |
| T-17 | No localStorage, sessionStorage, cookie, IndexedDB or cache entry; a second start in the same profile shows the template | — | template | PASS (2) |

## Security cases

| ID | What is checked | Result (Edge) |
| --- | --- | --- |
| X-01 | more than 20 script and handler vectors plus a storage sentinel; click, hover, typing in the hostile page | PASS (9): nothing ran, sentinel not read, 0 requests, source intact |
| X-02 | Navigation, refresh, base, forms, frames, objects, popups; editable and read-only variant | PASS (16): 0 requests, no navigation, no new window |
| X-03 | more than 30 kinds of external resource references; control page proves the server and browser would fetch | PASS (5): **0 delivered requests**; 11 attempts from inline CSS, all blocked by the policy (27 block reports) |
| X-04 | Rich clipboard paste with a trusted key event; paste events; HTML-only clipboard; drop | PASS (7) |
| X-05 | No message bridge in the file | PASS (1) |
| X-06 | Static scan: dynamic code, storage, network APIs, URLs, script count, sandbox, policy with matching script hash | PASS (11) |
| X-07 | Names that shadow DOM properties (`<img name="body">`, `<input name="childNodes">` in a form, …) | PASS (8) |

## Robustness

| ID | What is checked | Result (Edge) |
| --- | --- | --- |
| R-01 | 44 hand-written snippets (omitted end tags, tables, entities, comments, forms, frames, SVG, fragments, quirks, broken nesting): open unchanged; 92 single-character page edits each compared with the original, page text compared with the parsed source, undone; formatted and compared | PASS: 91 edits change exactly one character, 1 additionally drops trailing spaces of the edited paragraph; 2 snippets read-only as a whole, 1 with a read-only part; 42 formatted, 0 refused |
| R-02 | Source modules in a test page, 3,044 generated documents: write-back without edit reproduces the text; re-rendering changes nothing; one appended character changes exactly that place; an image `src` causes no request without any policy | PASS: 2,128 documents editable, 984 edits exact |

## Reference findings → fixes

| Finding in the reference | Fix here | Regression |
| --- | --- | --- |
| RF-03 opened content controls the editor | no execution: inert parse, projection, sandbox, policy | X-01, X-02, X-06 |
| RF-04 two timers overwrite each other | revision flags, commit/render before the other pane is edited | T-11 |
| RF-05 download without pending page edit | `commitVisual()` in `snapshotForSave()` | T-10 |
| RF-07 list inside a paragraph | lists built by replacing paragraphs | T-05 |
| RF-08 minify joins words | no minify; formatter verified, inline spacing checked | T-07 |
| RF-09 doctype identifiers lost | envelope never rewritten | T-09 |
| RF-10 focus theft, caret to end, scroll reset | highlight without focus, offset mapping, in-place DOM update | T-03, T-12 |
| RF-11 remote resources | none built in; projection and policy | X-03 |
| RF-12 persistent autosave | none | T-17, X-06 |
| RF-13 no reuse licence | nothing reused; own licence | STATUS |
| RF-14 simplified parser trusted | every parse compared with the browser's; formatter output verified | T-07, T-14, R-01, R-02 |

Failed-before evidence for RF-03 to RF-12 is the earlier audit of the reference, kept privately with the analysis case. For defects of this product found during development see [STATUS.md](STATUS.md).
