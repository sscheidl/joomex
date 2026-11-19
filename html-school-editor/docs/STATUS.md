# Status

**Version:** 0.1.0-alpha.5 · **Date:** 2026-11-19 · **Location:** `html-school-editor/` in this repository, branch `feature/html-school-editor-0.1.0-alpha.5`, stacked on `fix/html-school-editor-0.1.0-alpha.4` (pull request 18)

## Verdict: HOLD

Two independent reviews both ended with **FAIL**: of alpha.1 ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md), findings RV-01 to RV-04) and of alpha.2 with alpha.3 together ([reviews/REVIEW_0.1.0-alpha.3.md](reviews/REVIEW_0.1.0-alpha.3.md), findings A3-01 to A3-05 and one about the test helper). The second review confirmed RV-01 and RV-03 as corrected and found RV-02 and RV-04 corrected only for the reported examples. The reviewer then measured alpha.3 in Firefox ([reviews/FIREFOX_0.1.0-alpha.3.md](reviews/FIREFOX_0.1.0-alpha.3.md)) and found three differences. Version 0.1.0-alpha.4 corrects the five findings and the three Firefox differences, and makes the image dialog show the address it will write, after a report of the owner. After trying it, the owner asked for three more changes, which are in this version too: pictures are shown from the folder of the editor (this widens the content policy, see below), the version number stands in the top bar, and the box of a picture from the network says what to do. None of this has been reviewed; the implementer's tests are not a review, and twice they passed over defects that a review then found.

Open before a release:

1. **The review of alpha.4 is requested and has not reported yet** ([REVIEW_CODEX.md](REVIEW_CODEX.md) on the alpha.4 branch). **Version 0.1.0-alpha.5 adds the small functions of step A** ([below](#functions-of-alpha5-on-the-owners-request)); they are not part of that review.
2. **Chrome is NOT MEASURED.** Chrome is not installed on the test machine. Measurements are from Microsoft Edge and, since this version, from Firefox.
3. **Native file dialogs are NOT MEASURED.** The browser's open/save pickers and writing back to a real file handle cannot be driven by the test harness. The code paths behind them are covered with a labelled mock handle (T-10, T-15), with the file input and the file chooser (T-15, RV-01) and with the real download fallback (T-10, T-16). A person has to try Open and Save once in Edge and once in Chrome.
4. **No recorded visible-window session and no trial with pupils or teachers.** The owner tried alpha.2 and alpha.3 by hand on 2026-11-19; what was tried is not recorded.

There is no known failing check and no known rights problem in the delivered file.

## Review findings of alpha.1 and their corrections

| Finding | Correction in alpha.2 | Code | Regression |
| --- | --- | --- | --- |
| **RV-01** (high): a file read that finishes late replaces newer work and erases its undo history | Every operation that replaces the document takes a ticket. Only the newest ticket can complete, and only for the document state whose loss the pupil accepted; if the text changed meanwhile, the editor asks again. The ticket is taken before the file chooser opens. New cancels a pending read | `src/js/app.js:765–789`, `:791`, `:828`, `:944`, `:1125` | RV-01 (6 schedules), T-15 |
| **RV-02** (high): the formatter's check accepts visible changes | Formatting is applied only if (1) no style rule can make spaces count, judged after resolving CSS comments and escapes and for any value outside the collapsing ones, (2) both texts parse to the same document, (3) both texts are laid out identically in a hidden copy of the page pane. Documents with a style sheet file are not formatted | `src/js/app.js:655`, `:697`; `src/js/project.js:483`, `:524` | RV-02 (11 refused, 3 applied and compared in an ordinary page), T-07 |
| **RV-03** (medium): creating a list deletes paragraph attributes | List commands rename the element and keep its start tag as written, in both directions; a list or item that cannot keep its role keeps its attributes on a `div` | `src/js/commands.js:96`, `:158`, `:194`; `src/js/serialize.js:289` | RV-03, T-05 |
| **RV-04** (medium): a resource stopped by the policy is not announced | SVG animation elements are no longer shown and are named in the note. Whatever the browser's policy stops is announced even if the editor's own list did not name it | `src/js/project.js:23`, `:228`; `src/js/app.js:265`, `:1067` | RV-04 (6 samples) |

Changed along the way:

* **Formatting and stale results.** The layout comparison makes formatting asynchronous. Its result is dropped if the text changed while it ran, and a second click during the check is ignored (same class of defect as RV-01; RV-02 checks it with a timing seam).
* **A defect of the first correction, found by an exploratory script before this version was built:** taking the first item out of a list moved the remaining items into a copy of the list, which lost the `id`. Now the original list element continues (RV-03).
* **T-05 contained the defect.** Its expected text for alpha.1 had the list item without the attributes of the paragraph. The expectation was corrected.
* **Parts that could not be measured are explicit.** The result file and the console output list them as `NOT MEASURED` per case instead of a note inside a passed case (review part B).
* **Wording of the note:** an address inside CSS is now called "Adresse im CSS" instead of "externe CSS-Datei".
* **Two assurances were too strong** and were rewritten: that conflicting edits in both panes are impossible ([ARCHITECTURE.md](ARCHITECTURE.md)), and that projection, sandbox and policy are independent layers ([SECURITY.md](SECURITY.md)).

Not changed, although the review discusses it: the page pane still uses a list of what is left out, not a list of what is allowed (see SECURITY.md, residual risks).

## Functions added in alpha.3 on the owner's request

The owner tried alpha.2 on 2026-11-19 and asked for the following. Regression cases: F-01 to F-03 and the rewritten T-06.

| Request | What alpha.3 does | Code |
| --- | --- | --- |
| Images should not be embedded as data; the long line in the code is hard to read | An image is written as its file name, with an optional folder: `<img src="bilder/katze.jpg" alt="">`. The picture file has to lie next to the page; the editor says so after inserting. The page pane shows the picture from the file the pupil chose. Scaling of large pictures is gone | `src/js/images.js:18`, `src/js/project.js:167`, `src/js/app.js:527` |
| Subfolders for pictures | A folder field in the image dialog; the last folder is suggested again | `src/js/util.js:96`, `src/js/app.js:637` |
| The description of a picture should be optional | The field is optional; without text the editor writes `alt=""` | `src/js/app.js:637` |
| An inserted picture could not be changed by clicking it | A click selects the picture; "Bild" then opens the dialog with its values (description, width, folder, another file). The same for links: with the caret in a link, "Link" changes its address. Only the attribute concerned is rewritten in the source | `src/js/commands.js:110`, `:414`, `:440`; `src/js/util.js:273` |
| Size of pictures | A width in pixels in the image dialog, written as `width="…"` | `src/js/commands.js:398`, `:414` |
| Position: left, right, centre, and justified for text | Four alignment buttons for paragraphs, headings, list items, table cells and the paragraph of a selected picture, written as `style="text-align: …"` | `src/js/commands.js:464`, `src/js/util.js:139` |

Decisions of the owner that go with it: the description of a picture is optional and pictures are no longer embedded (both change the wording of P-04 in the task brief); alignment is written as a style attribute (P-05 forbids inline CSS for basic text formatting; alignment has no tag); bold and italic stay `<b>` and `<i>`.

Consequences in alpha.3: both content policies allowed `img-src blob:` for the chosen picture files, and after reopening a page its pictures were boxes until the pupil chose the files again. Both are replaced in alpha.4, see [Pictures from the folder of the editor](#pictures-from-the-folder-of-the-editor).

## Findings of the review of alpha.2 and alpha.3 and their corrections

| Finding | Correction in alpha.4 | Code | Regression |
| --- | --- | --- | --- |
| **A3-01** (high): alignment rewrites text inside a CSS string of the same style attribute | The style attribute is read as CSS: strings, comments, escapes and brackets are respected and only a real `text-align` declaration is replaced. A text that cannot be split with certainty is left alone, with a message | `src/js/util.js:139`, `:192`; `src/js/commands.js:484` | A3-01, unit "alignment" |
| **A3-03** (high): "tidy up" can insert a visible gap at another window width | Rules that hold only sometimes are found by reading the style sheets as CSS, and the page is not formatted if such a rule changes the kind of box, generated content or a custom property. Parts that are hidden at the moment are checked for the same risk | `src/js/util.js:227`; `src/js/project.js:483`, `:504`; `src/js/app.js:697` | A3-03, unit "style rules" |
| **A3-02** (medium): attribute edits change the meaning of badly written tags | Removing an attribute removes every occurrence of the name; a name followed by `=` without a value is handled as an empty value | `src/js/util.js:273` | A3-02, unit "badly written tags" |
| **A3-04** (medium): an image from a cancelled dialog replaces a later choice | Every image check belongs to one choice in one dialog; a result for an older one is dropped | `src/js/app.js:494`, `:572` | A3-04 |
| **A3-05** (medium): a stop by the policy for a short address is not announced | Every stop the browser reports is remembered for the document and announced, whatever the address looks like. The note stays until another document is opened | `src/js/app.js:265`, `:1067` | A3-05, RV-04 |
| **A3-T**: the test helper for opening a file could return before the new file was loaded | The helper waits for the editor's own message of this load instead of the file name | `tests/lib/harness.mjs` | A3-T |

Changed along the way, following remarks of the review that were not findings: a second question no longer overwrites the text of an open dialog; a no-break space is no longer treated as removable white space between list items; picture files above 20 MB are refused, so that the size of a chosen file is bounded again.

A consequence for pupils: the note "Inhalte von außerhalb der Seite (vom Browser blockiert)" now stays until another page is opened, also after the cause was removed from the code. The first version of this note tried to follow the text and missed real stops.

## Firefox measurement of alpha.3 and what changed

The owner asked the reviewer to measure Firefox, which the task brief does not name. Result for alpha.3: basic functions work, four cases miss their expectations. The same four cases failed for the first build of alpha.4. Causes and corrections:

| Difference | Cause in Firefox | Correction in alpha.4 | Code | Regression |
| --- | --- | --- | --- | --- |
| **FF-01**: typing next to a comment removes a space in the following text; a line break behind an unknown element disappears | While the pupil types, Firefox tidies white space that cannot be seen, also in neighbouring text nodes | Such a change of a text that was not edited is written as it stands in the source. This holds only while the pending input is typing; after a deletion the space counts as deleted | `src/js/serialize.js:123`, `:138`, `:314`; `src/js/app.js:1024` | FF-01, R-01 |
| **FF-02**: a document that starts with `<br>` is written back with the line break wrapped in a paragraph | Firefox keeps a line break of its own in a page without visible content; the projection took that node over and Firefox removed it again | A `<br>` is only reused if the projection created it; a single line break standing alone directly in the page is never written | `src/js/project.js:275`, `src/js/serialize.js:68` | FF-02, R-02 |
| **FF-03**: "Code aufräumen" is refused although nothing would change | Firefox reports a box with a height and no width for white space between blocks | White space counts in the layout comparison only if it has a width | `src/js/project.js:524` | T-07 in Firefox |
| **T-03**: a double click marks the word with the following space | Firefox selects a word together with the space behind it | No product change. The test now expects the same in every browser: what is marked in the source is what is selected in the page | `tests/browser/functional.mjs` | T-03 |

The suite now runs in Firefox too (`node tests/run.mjs --browser firefox`), with the driver the reviewer wrote. Firefox has no file access API: Save is always a download there.

## Report of the owner about image folders

The owner chose a picture again, with the same file name, from another folder and expected the address in the code to change. It did not: the browser does not tell from which folder a file is chosen, in Edge as in Firefox, and the folder comes from the folder field only. That part works as specified, but the dialog did not make it visible. Now the dialog says so and shows the address that will stand in the code, updating while the pupil types (`dialogAddress`, `src/js/app.js:597`; `showAddress`, `:614`; F-02). Finding the folder automatically needs access to the page's folder, which is the postponed "open folder" function.

## Pictures from the folder of the editor

Requested by the owner after trying alpha.4: pupils who reopen a page a week later saw every picture as a dashed box and read it as a broken link. Decision of the owner: each pupil keeps the editor file in the project folder with pages and pictures, so a relative address means the same file from the editor and from the page.

| Request | What alpha.4 does | Code | Regression |
| --- | --- | --- | --- |
| Show the pictures of a reopened page | The page pane loads a picture from the file its relative address names, seen from the editor. Only plain relative addresses are resolved, and only to a `file:` address on the editor's own computer. Both content policies say `img-src data: 'self'`; object URLs are gone | `src/js/util.js:115`, `src/js/project.js:194`, `src/js/app.js:56`, `tools/build.mjs:59` | F-01, T-06, X-06, unit |
| A missing picture must not look like a broken link | It becomes a box with the text "Bild nicht gefunden: …", and a note above the page lists the missing addresses. The editor looks again when the pupil comes back from another program, opens another page or closes the image dialog | `src/js/project.js:167`, `src/js/app.js:503–524`, `:265` | F-01 |
| The dialog should tell whether the picture is there | Below the address the dialog says "Gefunden" (and shows the picture) or "Nicht gefunden" | `src/js/app.js:614` | F-01, T-06 |
| Pictures from the network: what should the pupil do? | Their box says "Bild aus dem Internet"; the tooltip asks the pupil to download it, mind the copyright, put it into the folder and link it by file name. Pictures from the network stay blocked (owner's decision) | `src/js/project.js:26` | F-01 |
| Version number in the top bar | Small and grey next to the name, it does not wrap | `src/app.html`, `src/style.css` | F-04 |

Consequences to know:

* **Condition:** pictures are found only if the opened page lies in the same folder as the editor. The editor cannot tell where a page was opened from. The help and the pupil guide say so.
* **Residual risk accepted by the owner:** the policy source `'self'` also applies to pictures named in the CSS of an opened page. Such a page can show picture files of this computer outside the project folder, and in Edge a file address of another computer is attempted. Nothing is loaded from the network. See [SECURITY.md](SECURITY.md#pictures-from-the-folder-of-the-editor) and X-08.
* The note "Im Editor ausgeschaltet" still counts addresses in the CSS of a page, also those of pictures that are now shown.
* Not built: the owner's own note before the browser's permission question on saving (item 5.3 of the plan); the owner decided against it.

## Functions of alpha.5 on the owner's request

Step A of the owner's list: small functions, one version. Regression cases F-05 to F-11 (`tests/browser/features5.mjs`), unit test "page title".

| Request | What alpha.5 does | Code | Regression |
| --- | --- | --- | --- |
| Movable dialogs | Every dialog is moved by its heading (the two question dialogs by their text), never out of the window, and opens centred again | `src/js/app.js:100` | F-08 |
| A test for a link on a picture | The function existed; the case makes, changes and removes such a link and changes the picture inside it | — | F-07 |
| "Im Browser öffnen" | Opens the saved page next to the editor in a new tab with `noopener`; saves first after a question; explains "file not found". **First function that starts a pupil's page with running scripts** ([SECURITY.md](SECURITY.md#opening-the-pupils-page-in-the-browser-010-alpha5)) | `src/js/app.js:907` | F-09 (with a recorded `window.open`, a mock) |
| Save state bold and coloured | "● nicht gespeichert" bold in orange, "gespeichert" bold in green | `src/style.css` | F-11 |
| Clearer groups of buttons | A line and more space between groups, less inside, also in the top bar | `src/style.css` | F-11 |
| Underline, superscript, subscript, highlight | `<u>`, `<sup>`, `<sub>`, `<mark>` with the mechanism of bold and italic; superscript and subscript exclude each other; Ctrl+U | `src/js/commands.js:230`, `:294` | F-05 |
| Link dialog: "In neuem Tab öffnen" | Writes `target="_blank"` without `rel`; shows the state of an existing link, read from the source; rewrites only this attribute | `src/js/commands.js:352`, `:440`; `src/js/project.js:186`; `src/js/serialize.js:243` | F-06 |
| Edit the page title | A field above the page pane changes the text of `<title>`, or adds a title to the head; checked with the browser's parser | `src/js/format.js:89`, `src/js/app.js:925` | F-10, unit |

Consequences to know: "Im Browser öffnen" after a save in a browser without file access (Firefox) opens nothing, because the saved copy is a download; the pupil is told so. If the pupil saves through the picker into another folder than the editor's, the tab shows "file not found".

## Artefact

| | |
| --- | --- |
| File | `dist/school-editor.html` |
| Size | **192,728 bytes** (limit 200,000) — complete: HTML, CSS, script, no other file |
| SHA-256 | `58d483f052f55b6f759e663b94fae8e3731cb30c62c65f3bbb9d56e4f6d8fddc` |
| Build | `node tools/build.mjs`; `node tools/build.mjs --check` reproduces the file byte for byte |

The size and hash are those of the runs recorded in `tests/results/acceptance-edge.json` and `acceptance-firefox.json`. If the sources change, rebuild and re-run; `--check` and the result files state the current values. Earlier versions: alpha.1 132,525 bytes, alpha.2 143,858 bytes, alpha.3 160,302 bytes, alpha.4 176,008 bytes before and 182,038 bytes after the owner's requests of step 0. **About 7,300 bytes are left below the limit.** The next step (text colour, tables) will need more; the owner has agreed that the build may then remove comments from the delivered script.

## Measurements

MEASURED 2026-11-19 · Windows 11 Pro (10.0.26300) · Node v24.22.1.

| Suite | Environment | Result |
| --- | --- | --- |
| Unit tests (`node --test tests/unit/*.test.mjs`) | Node | 23 of 23 pass |
| Acceptance T-01…T-17, X-01…X-08 | Edge 157.0.4341.60, headless, artefact from `file://` | 25 of 25 cases pass |
| Robustness R-01, R-02 | same | 2 of 2 pass (R-02 runs the source modules in a test page, not the single file) |
| Regressions for the review findings RV-01…RV-04 | same | 4 of 4 pass |
| Functions asked for by the owner F-01…F-11 | same | 11 of 11 pass |
| Regressions for the second review A3-01…A3-05, A3-T | same | 6 of 6 pass |
| Regressions for the Firefox measurement FF-01, FF-02 | same | 2 of 2 pass |
| All 50 cases | Firefox/160.0.1, headless, artefact from `file://`, WebDriver BiDi | 44 cases pass, 5 partial, 1 not measured, none failed; 554 checks. The partial and unmeasured cases lack test automation in Firefox (file chooser, composition, switching scripts off, clipboard), see [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md#firefox) |
| Reviewer's Firefox diagnostics `tests/firefox-diagnostics.mjs`, unchanged, against the committed alpha.4 build (176,008 bytes, `e9ad516a…`); not re-run for this build | Firefox/160.0.1 | comment sample exact, T-07 fixture formatted, three module round trips exact |
| Reviewer's probe script `docs/reviews/review-alpha3.mjs`, unchanged, against the committed alpha.4 build; not re-run for this build | Edge 157.0.4341.60 | its probes for A3-01, A3-02, A3-03 and the frame check pass; it then stops in the A3-04 probe with a timeout, because that probe waits for the defect to show; A3-05 and A3-T do not run in that script |
| All of the above | Chrome | **NOT MEASURED** (not installed) |
| Reviewer's probe script `docs/reviews/review-alpha1.mjs`, unchanged, against the committed alpha.4 build; not re-run for this build | Edge 157.0.4341.60 | stops in its first probe with a timeout: it waits for the late file to be opened, which no longer happens. Its other probes do not run in that script; their inputs are part of RV-02 to RV-04 |
| Repository publication check (`scripts/check_publication.py`) with the private deny-list | whole repository, 347 files | 0 findings |

In total 598 individual checks in Edge with 2 parts NOT MEASURED (native file pickers, in T-16 and RV-01), and 554 checks in Firefox with 7 parts NOT MEASURED. Per-check results: [`tests/results/acceptance-edge.json`](../tests/results/acceptance-edge.json), [`tests/results/acceptance-firefox.json`](../tests/results/acceptance-firefox.json). Summary with code references: [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md).

## Dependencies and licences

| Component | Version | Licence | In the delivered file |
| --- | --- | --- | --- |
| Own code | 0.1.0-alpha.5 | MIT ([LICENSE](../LICENSE)) | yes, everything |
| Runtime libraries | — | — | none |
| Build and test tools | Node.js standard library only | — | no |
| Fonts, icons, images | — | — | none (system fonts, text labels) |

The reference editor that was studied is not a dependency. No part of it is contained in this folder. See [SPECIFICATION.md](SPECIFICATION.md#3-origin) for what was read and for the limits of that statement. The independent review compared samples and found no substantial copied implementation within its sampled scope; it is not a certification for every line.

## Open points

| # | Point | Kind |
| --- | --- | --- |
| 1 | Independent review of the corrections in alpha.4 | process |
| 2 | Run the suite in Chrome | measurement |
| 3 | Try native Open, Save (write-back with the permission question) and Save-as by hand in Edge and Chrome | measurement |
| 4 | Visible-window session; input routes that were never tried: spell-check replacement in the page, dragging text inside the source field, speech and handwriting input, autofill | measurement |
| 5 | Trial with pupils and a teacher: are the German texts, the questions and the read-only notes understood? | usability, not measured |
| 6 | "Code aufräumen" is refused for documents with an external style sheet and for documents whose rules hold only sometimes (other window width, pointer over an element, animation); it cannot answer for styles that a script changes later | limitation, by design in this version |
| 7 | The page pane decides by a list of what is left out; the review recommends a list of what is allowed | design decision for a later version |
| 8 | Pictures are found only if the opened page lies in the folder of the editor; the CSS of a page can show picture files of this computer (accepted residual risk) | limitation, decision of the owner |
| 9 | The page pane renders in standards mode also for documents without doctype | limitation |
| 10 | A picture is placed by the alignment of its paragraph; text does not flow around pictures | limitation |

## Defects found and fixed

Found by the independent review of alpha.1: RV-01 to RV-04, see above.

Found by the implementer during the development of alpha.1; each has a regression check. The first acceptance run on 2026-11-18 passed 16 of 23 cases; four of the seven failures were wrong expectations in the tests, the others are items 1–3 below. Items 4–9 were found by exploratory scripts and by the corpus tests, not by the numbered cases.

| # | Defect | Check |
| --- | --- | --- |
| 1 | A `script` element inside inline SVG was created in the preview (it could not run, but must not exist) | X-01 |
| 2 | After the frame got the focus by script or keyboard, keystrokes went nowhere because the editable body was not focused | T-11 (schedule C) |
| 3 | File buttons took the focus away from the page | T-10 |
| 4 | Joining two paragraphs deleted an inactive `script` of the first paragraph from the source | T-09 |
| 5 | Editing next to a frame or video stand-in wrote the stand-in's label into the source | R-01, R-02 |
| 6 | Bold in a heading did nothing visible but rewrote character references (the browser command works on computed style) | T-04 |
| 7 | Elements with omitted end tags received end tags although nothing next to them changed | T-09 |
| 8 | The browser's editing engine dropped source line breaks and turned spaces into `&nbsp;` near the caret | R-01 |
| 9 | A document nested 30,000 levels deep overflowed the stack; form controls named like DOM properties could break the analysis | T-14, X-07 |

## Next step

The review of alpha.4 runs. Next in the owner's plan: step B (text colour, tables) as alpha.6. After the reviews: Chrome run, manual check of the native dialogs, a visible-window session with the new image and alignment functions, then a decision about a release. Nothing is merged and there is no release.
