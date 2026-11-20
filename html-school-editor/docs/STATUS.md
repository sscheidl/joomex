# Status

**Version:** 0.1.0-alpha.9 · **Date:** 2026-11-20 · **Location:** `html-school-editor/` in this repository, branch `fix/html-school-editor-0.1.0-alpha.9`, stacked on `fix/html-school-editor-0.1.0-alpha.8` (pull request 22)

## Verdict: HOLD

Two independent reviews both ended with **FAIL**: of alpha.1 ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md), findings RV-01 to RV-04) and of alpha.2 with alpha.3 together ([reviews/REVIEW_0.1.0-alpha.3.md](reviews/REVIEW_0.1.0-alpha.3.md), findings A3-01 to A3-05 and one about the test helper). The second review confirmed RV-01 and RV-03 as corrected and found RV-02 and RV-04 corrected only for the reported examples. The reviewer then measured alpha.3 in Firefox ([reviews/FIREFOX_0.1.0-alpha.3.md](reviews/FIREFOX_0.1.0-alpha.3.md)) and found three differences. Version 0.1.0-alpha.4 corrects the five findings and the three Firefox differences, and makes the image dialog show the address it will write, after a report of the owner. After trying it, the owner asked for three more changes, which are in this version too: pictures are shown from the folder of the editor (this widens the content policy, see below), the version number stands in the top bar, and the box of a picture from the network says what to do. A third independent review, of alpha.4 and alpha.5 together, ended with **FAIL** on 2026-11-19: fourteen findings, five of them high ([below](#findings-of-the-review-of-alpha4-and-alpha5-and-their-corrections)). Its report was handed over to the owner only and is not part of this repository. Version 0.1.0-alpha.6 corrects all fourteen findings and one sentence of the specification. Version 0.1.0-alpha.7 adds text colour and tables ([below](#functions-of-alpha7-on-the-owners-request)). A fourth independent review, of alpha.6 and alpha.7 together, ended with **HOLD** on 2026-11-20: eight findings, four of them medium, none about lost work or the protective design ([below](#findings-of-the-review-of-alpha6-and-alpha7-and-their-corrections)); four parts were not reviewed. Its report was handed over to the owner only. Version 0.1.0-alpha.8 corrects all eight. An interim review of alpha.8 by a second reviewer (Claude Fable, 2026-11-20, verdict **HOLD**) found the eight corrected for the reported inputs, carried out the four open parts without a finding, and found eight more defects, F1 to F8, none about the protective design ([below](#findings-of-the-interim-review-of-alpha8-and-their-corrections)). Its report was handed over to the owner only. Version 0.1.0-alpha.9 corrects F1 to F3, the owner's choice; F4 to F8 are open. The corrections of alpha.8 and alpha.9 have not been reviewed by Codex; the implementer's tests are not a review, and five times they passed over defects that a review then found.

Open before a release:

1. **The corrections of alpha.8 and alpha.9 are not reviewed by Codex**, and F4 to F8 of the interim review are open. The request is in [REVIEW_CODEX.md](REVIEW_CODEX.md).
2. **Chrome is NOT MEASURED.** Chrome is not installed on the test machine. Measurements are from Microsoft Edge and, since this version, from Firefox.
3. **Native file dialogs are NOT MEASURED.** The browser's open/save pickers and writing back to a real file handle cannot be driven by the test harness. The code paths behind them are covered with a labelled mock handle (T-10, T-15), with the file input and the file chooser (T-15, RV-01) and with the real download fallback (T-10, T-16). A person has to try Open and Save once in Edge and once in Chrome.
4. **No recorded visible-window session and no trial with pupils or teachers.** The owner tried alpha.2 and alpha.3 by hand on 2026-11-19; what was tried is not recorded.

There is no known failing check and no known rights problem in the delivered file.

## Review findings of alpha.1 and their corrections

| Finding | Correction in alpha.2 | Code | Regression |
| --- | --- | --- | --- |
| **RV-01** (high): a file read that finishes late replaces newer work and erases its undo history | Every operation that replaces the document takes a ticket. Only the newest ticket can complete, and only for the document state whose loss the pupil accepted; if the text changed meanwhile, the editor asks again. The ticket is taken before the file chooser opens. New cancels a pending read | `src/js/app.js:833–857`, `:859`, `:896`, `:1037`, `:1224` | RV-01 (6 schedules), T-15 |
| **RV-02** (high): the formatter's check accepts visible changes | Formatting is applied only if (1) no style rule can make spaces count, judged after resolving CSS comments and escapes and for any value outside the collapsing ones, (2) both texts parse to the same document, (3) both texts are laid out identically in a hidden copy of the page pane. Documents with a style sheet file are not formatted | `src/js/app.js:723`, `:765`; `src/js/project.js:483`, `:527` | RV-02 (11 refused, 3 applied and compared in an ordinary page), T-07 |
| **RV-03** (medium): creating a list deletes paragraph attributes | List commands rename the element and keep its start tag as written, in both directions; a list or item that cannot keep its role keeps its attributes on a `div` | `src/js/commands.js:96`, `:158`, `:194`; `src/js/serialize.js:304` | RV-03, T-05 |
| **RV-04** (medium): a resource stopped by the policy is not announced | SVG animation elements are no longer shown and are named in the note. Whatever the browser's policy stops is announced even if the editor's own list did not name it | `src/js/project.js:23`, `:228`; `src/js/app.js:275`, `:1161` | RV-04 (6 samples) |

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
| Images should not be embedded as data; the long line in the code is hard to read | An image is written as its file name, with an optional folder: `<img src="bilder/katze.jpg" alt="">`. The picture file has to lie next to the page; the editor says so after inserting. The page pane shows the picture from the file the pupil chose. Scaling of large pictures is gone | `src/js/images.js:18`, `src/js/project.js:167`, `src/js/app.js:539` |
| Subfolders for pictures | A folder field in the image dialog; the last folder is suggested again | `src/js/util.js:96`, `src/js/app.js:652` |
| The description of a picture should be optional | The field is optional; without text the editor writes `alt=""` | `src/js/app.js:652` |
| An inserted picture could not be changed by clicking it | A click selects the picture; "Bild" then opens the dialog with its values (description, width, folder, another file). The same for links: with the caret in a link, "Link" changes its address. Only the attribute concerned is rewritten in the source | `src/js/commands.js:110`, `:421`, `:450`; `src/js/util.js:314` |
| Size of pictures | A width in pixels in the image dialog, written as `width="…"` | `src/js/commands.js:405`, `:421` |
| Position: left, right, centre, and justified for text | Four alignment buttons for paragraphs, headings, list items, table cells and the paragraph of a selected picture, written as `style="text-align: …"` | `src/js/commands.js:485`, `src/js/util.js:172` |

Decisions of the owner that go with it: the description of a picture is optional and pictures are no longer embedded (both change the wording of P-04 in the task brief); alignment is written as a style attribute (P-05 forbids inline CSS for basic text formatting; alignment has no tag); bold and italic stay `<b>` and `<i>`.

Consequences in alpha.3: both content policies allowed `img-src blob:` for the chosen picture files, and after reopening a page its pictures were boxes until the pupil chose the files again. Both are replaced in alpha.4, see [Pictures from the folder of the editor](#pictures-from-the-folder-of-the-editor).

## Functions of alpha.7 on the owner's request

Step B of the owner's list, as decided by the owner: text colour as `<span style="color: …">` with a fixed palette of names, tables with `border="1"`. Regression cases F-12 to F-16 (`tests/browser/features7.mjs`), unit test "text colour".

| Request | What alpha.7 does | Code | Regression |
| --- | --- | --- | --- |
| Text colour | Dialog with eight colour names and "Farbe entfernen". Whole paragraphs, headings or list items get the colour on their own tag, exactly one whole inline element on its tag, otherwise a `<span style="color: …">`; colours inside the coloured part go; a span left without attributes goes. Style attributes are changed through the CSS reader, never by searching | `src/js/commands.js:543`, `src/js/util.js:172`, `:146` | F-12, F-13, unit |
| Tables | Dialog with rows, columns, header row and border lines (both ticked each time); plain indented `<table>`, `<tr>`, `<th>`, `<td>` behind the block with the caret; in a table: row below, column right, delete row, delete column; merged cells and the last row or column are left alone; Tab and Shift+Tab move between cells | `src/js/commands.js:626`, `:648`, `:668`, `:693`; `src/js/serialize.js:267` | F-14, F-15, F-16 |
| Room in the delivered file | The build leaves out lines that are only a comment (owner's agreement); every case runs on the stripped file | `tools/build.mjs:31` | X-06, all cases |

Where the new code meets kinds of defect that earlier reviews found (style text, cut elements, the order of neighbours, tidying, a page that changes while a dialog is open), the review request lists the places ([REVIEW_CODEX.md](REVIEW_CODEX.md#step-b-in-alpha7-text-colour-and-tables)). Two older cases needed a different geometry because the help dialog grew by one line: F-08 drags it 30 instead of 60 pixels up (it opens closer to the top), A5-11 narrows the window to 640 × 800 pixels as in the reviewer's probe instead of 640 × 700, where the taller dialog scrolls.

## Findings of the interim review of alpha.8 and their corrections

The interim review (2026-11-20, verdict HOLD) repeated the fourth review's inputs with variations of its own and compared with the alpha.7 build. It found no lost work without a message and nothing about the protective design. The owner asked for F1 to F3 to be corrected in alpha.9. Each correction has a browser case with a hand-written expectation in `tests/browser/review8.mjs`; each case fails against the alpha.8 build and passes against this one (Edge 157, 2026-11-20).

| Finding | Correction in alpha.9 | Code | Regression |
| --- | --- | --- | --- |
| **F1** (medium): a save that waits behind a hanging write saves whatever page is open when its turn comes; after "Änderungen verwerfen" and another page, the first page's waiting save never happened and the other page was saved unasked | The waiting save remembers the page of the last request and is dropped if another page is open when its turn comes. The question before the page is replaced already says that the changes are lost | `src/js/app.js:955` | A8-01 |
| **F2** (low, regression of alpha.8): in a table whose first row or cell stands without a line break and the others on lines, adding and deleting a row or column removed a line break of the pupil | A deleted row or cell that stands directly behind its neighbour goes without the white space behind it; that white space belongs to the next element. Only behind a cell or row whose end tag is omitted does it go too, because there it would become part of the cell. As a side effect, deleting a cell of the source keeps a line break behind it that alpha.8 removed | `src/js/commands.js:623`, `:627` | A8-02 |
| **F3** (low, regression of alpha.8): a new item behind a list item without `</li>` (also `dt`, `dd`) put its line break and indentation into the item before; with `white-space: pre` the item grew by one line | The item before gets its end tag when the new element behind it starts a line of its own and white space would be written there; items that end with their own line break keep their omitted end tags | `src/js/serialize.js:46`, `:120`, `:134` | A8-03 |

Open from the interim review: F4 (`!important` in a print rule and "Links"), F5 (another message replaces "Speichert …"), F6 (`!important` is lost when the value stays the same), F7 (a residue of two spaces after adding and deleting a row behind the last row in a formatted table without end tags; the extra `</tr>` that alpha.8 left there is gone in alpha.9), F8 (new cells one per line in a table whose rows stand on lines and whose cells do not).

Changed along the way: in `<td>a<td>b</td> <td>c</td>`, deleting the column of b now keeps the omitted end tag of a and drops the space behind b; alpha.8 kept the space and wrote `</td>` behind a. The third check of A8-03 had a wrong expectation in my first version (it expected the new item on a line of its own in front of the next item; the editor writes it directly in front of it, as in alpha.8); that was a test mistake and is corrected.

## Findings of the review of alpha.6 and alpha.7 and their corrections

The fourth review (2026-11-20, verdict HOLD) worked through a checklist of fixed inputs in Edge and partly in Firefox; the identifiers are the numbers of that checklist. It found nothing about lost work or the protective design. Each correction has a browser case with a hand-written expectation in `tests/browser/review7.mjs`; each case fails against the alpha.7 build and passes against this one (Edge 157, 2026-11-20). The reviewer's own checklist script, run unchanged from a copy against this build, gives 84 of 88 in Edge (was 77): the seven rows of the findings pass now and no other row changed; the four rows that stay are the list rows 2.6-2 to 2.6-5, where the script's flag expects an unchanged source although two separate lists are correct, as the report says. Its Firefox rows pass, 3 of 3.

| Finding | Correction in alpha.8 | Code | Regression |
| --- | --- | --- | --- |
| **1.1h** (medium): changing the colour deletes a CSS comment in the style attribute | `withDecl()` leaves the attribute alone if a declaration that would change holds a comment; colour and alignment then say so. Comments in other declarations stay where they are written | `src/js/util.js:172` | A7-01, unit |
| **2.3** (medium): "Links" removes the declaration although a rule for print centres the paragraph | `cssRisks()` notes an alignment inside a rule that holds only sometimes (a `media` attribute, `@media`, `@supports`, a state such as `:hover`); with such a rule "Links" writes `text-align: left` out | `src/js/util.js:277`, `src/js/commands.js:471`, `:485` | A7-02, unit |
| **1.4d** (medium): a column added to a table with `<colgroup>` leaves the column definitions out of step | Columns of a table with `<colgroup>` or `<col>` are not added or deleted, with a message; rows still are. A table with `<col>` and no `<colgroup>` was already not editable in the page pane | `src/js/commands.js:614`, `:668` | A7-03 |
| **2.4** (medium): while a save hangs, the status still says "Geöffnet" | While a file is written the status says "Speichert …" and does not disappear after nine seconds. A save asked for while one writes joins one single save behind it, which takes the text as it is then: pressing the key again and again gives two writes, not a queue. Owner's decision: no time limit for a hanging write | `src/js/app.js:72`, `:956`, `:965`, `:972` | A7-04 |
| **1.4c** (low): in a table written without line breaks, deleting an added row leaves a line break and indentation | The writer writes new rows and cells without line breaks where their neighbours in the table stand without them (`childIndent()` returns no indentation for such table parts) | `src/js/serialize.js:46`, `:59` | A7-05 |
| **1.4e** (low): cells and rows without end tags get end tags when a column or row is added | An omitted end tag of a cell, row, list item, `dt` or `dd` stays omitted when what follows it now ends it just as well: an element of the same kind or the end of the parent | `src/js/serialize.js:121`, `:122` | A7-06 |
| **2.2-7** (low): for the address `?nur` a changed folder has no effect | An address that names no file in a folder keeps its address; a changed folder field without a new picture is refused with a message | `src/js/app.js:661` | A7-07 |
| **2.9-2** (low): the white space at both ends of `style="  text-align:center  "` is lost | A single declaration that already has the value stays exactly as written; a changed one keeps the white space at both ends | `src/js/util.js:172` | A7-08, unit |

Changed along the way: the unit test of A3-01 expected `text-align/**/: left` to be removed together with its comment; since 1.1h it is left alone, and the expectation says so. A7-04 had a wrong pattern in my first version (it left out the full stop) and A7-03 tried to edit a table that the page pane shows as not editable; both were test mistakes and are corrected. Not reviewed in the fourth review and still open: closing the window with a title that was typed and not taken over, every dialog at 640 × 800, a second picture while the check of the first is held, and the audit of the tests.

## Findings of the review of alpha.4 and alpha.5 and their corrections

The reviewer measured both versions in Edge and Firefox with probes of its own; the identifiers are the reviewer's. Each correction has a browser case with a hand-written expectation in `tests/browser/review6.mjs`; each case fails against the alpha.5 build and passes against this one (Edge 157, 2026-11-19).

| Finding | Correction in alpha.6 | Code | Regression |
| --- | --- | --- | --- |
| **ATTR** (high): removing the width of `<img src=tile.png width="20"alt=diagram>` joined address and description into one attribute | A removed attribute keeps the white space in front of it when the next attribute follows without a space, or when a `/` follows an unquoted value; without any space one is written | `src/js/util.js:314` | A5-01, unit "review findings" |
| **IMG-QUERY** (high): accepting the image dialog unchanged turned `tile.png?view=class/2` into `2` | An unchanged folder keeps the address exactly as written; another folder replaces only the folder of the path, `?…` and `#…` stay | `src/js/app.js:611`, `src/js/util.js:106` | A5-02, unit |
| **MEDIA** (high): "tidy up" accepted rules of `<style media="(min-width:1500px)">` and changed the gap between words at another width | The rules of a style element with a `media` attribute other than empty or `all` count as rules that hold only sometimes | `src/js/project.js:483`, `src/js/util.js:267` | A5-03, unit |
| **WRITES** (high): two saves to one file could finish in the wrong order, so the older text stayed in the file | One save at a time: a save waits until the save before it is finished; the newest text is written last | `src/js/app.js:956` | A5-04 (in Firefox with a real origin-private file) |
| **BROWSE-SWITCH** (high, alpha.5): opening another page while "Im Browser öffnen" saved opened the other page in a tab | The page that was asked for is remembered; if another page is open when saving ends, nothing is opened | `src/js/app.js:998` | A5-05 |
| **STYLE-SPLIT** (medium): removing bold from one letter lost the colour of the bold rest | The copies a range makes when it cuts an element are marked as copies and written with the attributes of their original; the same for a new link around part of an element | `src/js/commands.js:276`, `:358`; `src/js/serialize.js:245` | A5-06 |
| **LIST** (medium): a list over two paragraphs with a line between them moved the line behind the list | Paragraphs with anything other than white space between them get a list each | `src/js/commands.js:194` | A5-07 |
| **IMG-PENDING** (medium): "Einfügen" inserted the earlier picture while the newest one was being checked | While a check runs, "Einfügen" and "Übernehmen" say "Das Bild wird noch geprüft" and the dialog stays open | `src/js/app.js:584`, `:652` | A5-08 |
| **TITLE-RELOAD** (medium, alpha.5): a title typed into the field and not taken over counted as saved | The text of the field counts as a change until it is taken over or taken back | `src/js/app.js:195` | A5-10 |
| **DIALOG-RESIZE** (medium, alpha.5): a moved dialog stayed outside a window that became narrower | A moved dialog is put back inside the window when its size changes | `src/js/app.js:102` | A5-11 |
| **BYTES** (low): three line feeds in a row were counted as two | Line feeds are counted one by one | `src/js/util.js:386` | A5-14, unit "file bytes" |
| **ALIGN** (low): changing the alignment dropped the white space at both ends of the style and wrote character references anew | The white space at both ends stays; a changed attribute value keeps the spelling of its unchanged beginning and end, references with a semicolon included | `src/js/util.js:172`, `:364`; `src/js/serialize.js:312` | A5-13, unit |
| **NOTICE** (low): a switched-off page icon link in the head was not named in the note | Every link in the head with an address counts as "weiterer Verweis" | `src/js/project.js:321` | A5-09 |
| **TARGET-CASE** (low, alpha.5): `TARGET="_BLANK"` was shown as not ticked | The target is compared without regard to case | `src/js/commands.js:446` | A5-12 |

The specification said that pictures are shown only after the pupil has chosen them in the session; since alpha.4 they are read from the folder of the editor. The paragraphs on inactive content and on known limitations now say so.

## Findings of the review of alpha.2 and alpha.3 and their corrections

| Finding | Correction in alpha.4 | Code | Regression |
| --- | --- | --- | --- |
| **A3-01** (high): alignment rewrites text inside a CSS string of the same style attribute | The style attribute is read as CSS: strings, comments, escapes and brackets are respected and only a real `text-align` declaration is replaced. A text that cannot be split with certainty is left alone, with a message | `src/js/util.js:172`, `:232`; `src/js/commands.js:506` | A3-01, unit "alignment" |
| **A3-03** (high): "tidy up" can insert a visible gap at another window width | Rules that hold only sometimes are found by reading the style sheets as CSS, and the page is not formatted if such a rule changes the kind of box, generated content or a custom property. Parts that are hidden at the moment are checked for the same risk | `src/js/util.js:267`; `src/js/project.js:483`, `:507`; `src/js/app.js:765` | A3-03, unit "style rules" |
| **A3-02** (medium): attribute edits change the meaning of badly written tags | Removing an attribute removes every occurrence of the name; a name followed by `=` without a value is handled as an empty value | `src/js/util.js:314` | A3-02, unit "badly written tags" |
| **A3-04** (medium): an image from a cancelled dialog replaces a later choice | Every image check belongs to one choice in one dialog; a result for an older one is dropped | `src/js/app.js:505`, `:584` | A3-04 |
| **A3-05** (medium): a stop by the policy for a short address is not announced | Every stop the browser reports is remembered for the document and announced, whatever the address looks like. The note stays until another document is opened | `src/js/app.js:275`, `:1161` | A3-05, RV-04 |
| **A3-T**: the test helper for opening a file could return before the new file was loaded | The helper waits for the editor's own message of this load instead of the file name | `tests/lib/harness.mjs` | A3-T |

Changed along the way, following remarks of the review that were not findings: a second question no longer overwrites the text of an open dialog; a no-break space is no longer treated as removable white space between list items; picture files above 20 MB are refused, so that the size of a chosen file is bounded again.

A consequence for pupils: the note "Inhalte von außerhalb der Seite (vom Browser blockiert)" now stays until another page is opened, also after the cause was removed from the code. The first version of this note tried to follow the text and missed real stops.

## Firefox measurement of alpha.3 and what changed

The owner asked the reviewer to measure Firefox, which the task brief does not name. Result for alpha.3: basic functions work, four cases miss their expectations. The same four cases failed for the first build of alpha.4. Causes and corrections:

| Difference | Cause in Firefox | Correction in alpha.4 | Code | Regression |
| --- | --- | --- | --- | --- |
| **FF-01**: typing next to a comment removes a space in the following text; a line break behind an unknown element disappears | While the pupil types, Firefox tidies white space that cannot be seen, also in neighbouring text nodes | Such a change of a text that was not edited is written as it stands in the source. This holds only while the pending input is typing; after a deletion the space counts as deleted | `src/js/serialize.js:136`, `:151`, `:329`; `src/js/app.js:1117` | FF-01, R-01 |
| **FF-02**: a document that starts with `<br>` is written back with the line break wrapped in a paragraph | Firefox keeps a line break of its own in a page without visible content; the projection took that node over and Firefox removed it again | A `<br>` is only reused if the projection created it; a single line break standing alone directly in the page is never written | `src/js/project.js:275`, `src/js/serialize.js:76` | FF-02, R-02 |
| **FF-03**: "Code aufräumen" is refused although nothing would change | Firefox reports a box with a height and no width for white space between blocks | White space counts in the layout comparison only if it has a width | `src/js/project.js:527` | T-07 in Firefox |
| **T-03**: a double click marks the word with the following space | Firefox selects a word together with the space behind it | No product change. The test now expects the same in every browser: what is marked in the source is what is selected in the page | `tests/browser/functional.mjs` | T-03 |

The suite now runs in Firefox too (`node tests/run.mjs --browser firefox`), with the driver the reviewer wrote. Firefox has no file access API: Save is always a download there.

## Report of the owner about image folders

The owner chose a picture again, with the same file name, from another folder and expected the address in the code to change. It did not: the browser does not tell from which folder a file is chosen, in Edge as in Firefox, and the folder comes from the folder field only. That part works as specified, but the dialog did not make it visible. Now the dialog says so and shows the address that will stand in the code, updating while the pupil types (`dialogAddress`, `src/js/app.js:611`; `showAddress`, `:629`; F-02). Finding the folder automatically needs access to the page's folder, which is the postponed "open folder" function.

## Pictures from the folder of the editor

Requested by the owner after trying alpha.4: pupils who reopen a page a week later saw every picture as a dashed box and read it as a broken link. Decision of the owner: each pupil keeps the editor file in the project folder with pages and pictures, so a relative address means the same file from the editor and from the page.

| Request | What alpha.4 does | Code | Regression |
| --- | --- | --- | --- |
| Show the pictures of a reopened page | The page pane loads a picture from the file its relative address names, seen from the editor. Only plain relative addresses are resolved, and only to a `file:` address on the editor's own computer. Both content policies say `img-src data: 'self'`; object URLs are gone | `src/js/util.js:122`, `src/js/project.js:194`, `src/js/app.js:57`, `tools/build.mjs:64` | F-01, T-06, X-06, unit |
| A missing picture must not look like a broken link | It becomes a box with the text "Bild nicht gefunden: …", and a note above the page lists the missing addresses. The editor looks again when the pupil comes back from another program, opens another page or closes the image dialog | `src/js/project.js:167`, `src/js/app.js:515–536`, `:275` | F-01 |
| The dialog should tell whether the picture is there | Below the address the dialog says "Gefunden" (and shows the picture) or "Nicht gefunden" | `src/js/app.js:629` | F-01, T-06 |
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
| Movable dialogs | Every dialog is moved by its heading (the two question dialogs by their text), never out of the window, and opens centred again | `src/js/app.js:102` | F-08 |
| A test for a link on a picture | The function existed; the case makes, changes and removes such a link and changes the picture inside it | — | F-07 |
| "Im Browser öffnen" | Opens the saved page next to the editor in a new tab with `noopener`; saves first after a question; explains "file not found". **First function that starts a pupil's page with running scripts** ([SECURITY.md](SECURITY.md#opening-the-pupils-page-in-the-browser-010-alpha5)) | `src/js/app.js:998` | F-09 (with a recorded `window.open`, a mock) |
| Save state bold and coloured | "● nicht gespeichert" bold in orange, "gespeichert" bold in green | `src/style.css` | F-11 |
| Clearer groups of buttons | A line and more space between groups, less inside, also in the top bar | `src/style.css` | F-11 |
| Underline, superscript, subscript, highlight | `<u>`, `<sup>`, `<sub>`, `<mark>` with the mechanism of bold and italic; superscript and subscript exclude each other; Ctrl+U | `src/js/commands.js:233`, `:300` | F-05 |
| Link dialog: "In neuem Tab öffnen" | Writes `target="_blank"` without `rel`; shows the state of an existing link, read from the source; rewrites only this attribute | `src/js/commands.js:358`, `:450`; `src/js/project.js:186`; `src/js/serialize.js:256` | F-06 |
| Edit the page title | A field above the page pane changes the text of `<title>`, or adds a title to the head; checked with the browser's parser | `src/js/format.js:89`, `src/js/app.js:1017` | F-10, unit |

Consequences to know: "Im Browser öffnen" after a save in a browser without file access (Firefox) opens nothing, because the saved copy is a download; the pupil is told so. If the pupil saves through the picker into another folder than the editor's, the tab shows "file not found".

## Artefact

| | |
| --- | --- |
| File | `dist/school-editor.html` |
| Size | **182,454 bytes** (limit 200,000) — complete: HTML, CSS, script, no other file |
| SHA-256 | `40992860f990437a97f24f59902dff0ee5686470ff916e257c70837084a5e9b5` |
| Build | `node tools/build.mjs`; `node tools/build.mjs --check` reproduces the file byte for byte |

The size and hash are those of the runs recorded in `tests/results/acceptance-edge.json` and `acceptance-firefox.json`. If the sources change, rebuild and re-run; `--check` and the result files state the current values. Earlier versions: alpha.1 132,525 bytes, alpha.2 143,858 bytes, alpha.3 160,302 bytes, alpha.4 176,008 bytes before and 182,038 bytes after the owner's requests of step 0, alpha.5 192,728 bytes, alpha.6 197,663 bytes. Since alpha.7 the build leaves out comment lines: the alpha.6 code alone gives 164,692 bytes that way; alpha.7 178,871 bytes, alpha.8 181,332 bytes. **About 17,546 bytes are left below the limit.**

## Measurements

MEASURED 2026-11-20 · Windows 11 Pro (10.0.26300) · Node v24.22.1.

| Suite | Environment | Result |
| --- | --- | --- |
| Unit tests (`node --test tests/unit/*.test.mjs`) | Node | 26 of 26 pass |
| Acceptance T-01…T-17, X-01…X-08 | Edge 157.0.4341.60, headless, artefact from `file://` | 25 of 25 cases pass |
| Robustness R-01, R-02 | same | 2 of 2 pass (R-02 runs the source modules in a test page, not the single file) |
| Regressions for the review findings RV-01…RV-04 | same | 4 of 4 pass |
| Functions asked for by the owner F-01…F-16 | same | 16 of 16 pass |
| Regressions for the second review A3-01…A3-05, A3-T | same | 6 of 6 pass |
| Regressions for the Firefox measurement FF-01, FF-02 | same | 2 of 2 pass |
| Regressions for the third review A5-01…A5-14 | same | 14 of 14 pass; the same cases against the alpha.5 build: 0 of 14 |
| Regressions for the fourth review A7-01…A7-08 | same | 8 of 8 pass; the same cases against the alpha.7 build: 0 of 8 |
| Regressions for the interim review A8-01…A8-03 | same | 3 of 3 pass; the same cases against the alpha.8 build: 0 of 3 |
| All 80 cases | Firefox/160.0.1, headless, artefact from `file://`, WebDriver BiDi | 74 cases pass, 5 partial, 1 not measured, none failed; 714 checks. The partial and unmeasured cases lack test automation in Firefox (file chooser, composition, switching scripts off, clipboard), see [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md#firefox) |
| Reviewer's Firefox diagnostics `tests/firefox-diagnostics.mjs`, unchanged, against the committed alpha.4 build (176,008 bytes, `e9ad516a…`); not re-run for this build | Firefox/160.0.1 | comment sample exact, T-07 fixture formatted, three module round trips exact |
| Reviewer's probe script `docs/reviews/review-alpha3.mjs`, unchanged, against the committed alpha.4 build; not re-run for this build | Edge 157.0.4341.60 | its probes for A3-01, A3-02, A3-03 and the frame check pass; it then stops in the A3-04 probe with a timeout, because that probe waits for the defect to show; A3-05 and A3-T do not run in that script |
| All of the above | Chrome | **NOT MEASURED** (not installed) |
| Reviewer's probe script `docs/reviews/review-alpha1.mjs`, unchanged, against the committed alpha.4 build; not re-run for this build | Edge 157.0.4341.60 | stops in its first probe with a timeout: it waits for the late file to be opened, which no longer happens. Its other probes do not run in that script; their inputs are part of RV-02 to RV-04 |
| The third reviewer's probes, unchanged, run from a copy outside the repository against the alpha.6, the alpha.7 and the alpha.8 build, with the same result; not re-run for alpha.9 | Edge 157.0.4341.60 | 18 of 19 pass; WRITES NOT MEASURED (Edge refuses an origin-private file from a `file:` address, as in the review) |
| same | Firefox/160.0.1 | 18 of 19 pass; WRITES stops with a timeout: the probe holds the first save and waits for the second to finish, which now waits for the first. The order it checks is measured by A5-04 with a real origin-private file |
| The fourth reviewer's checklist script, unchanged, run from a copy outside the repository against the alpha.8 build and against this build | Edge 157.0.4341.60 | 84 of 88 rows for both (alpha.7: 77); the seven rows of the findings pass; the four list rows 2.6-2 to 2.6-5 expect an unchanged source, which the report itself calls too strict |
| same, its Firefox rows | Firefox/160.0.1 | 3 of 3 |
| Repository publication check (`scripts/check_publication.py`) with the private deny-list | whole repository | 0 findings |

In total 757 individual checks in Edge with 3 parts NOT MEASURED (native file pickers, in T-16 and RV-01; the real file in A5-04), and 714 checks in Firefox with 7 parts NOT MEASURED. Per-check results: [`tests/results/acceptance-edge.json`](../tests/results/acceptance-edge.json), [`tests/results/acceptance-firefox.json`](../tests/results/acceptance-firefox.json). Summary with code references: [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md).

## Dependencies and licences

| Component | Version | Licence | In the delivered file |
| --- | --- | --- | --- |
| Own code | 0.1.0-alpha.9 | MIT ([LICENSE](../LICENSE)) | yes, everything |
| Runtime libraries | — | — | none |
| Build and test tools | Node.js standard library only | — | no |
| Fonts, icons, images | — | — | none (system fonts, text labels) |

The reference editor that was studied is not a dependency. No part of it is contained in this folder. See [SPECIFICATION.md](SPECIFICATION.md#3-origin) for what was read and for the limits of that statement. The independent review compared samples and found no substantial copied implementation within its sampled scope; it is not a certification for every line.

## Open points

| # | Point | Kind |
| --- | --- | --- |
| 1 | Independent review of the corrections in alpha.8 and alpha.9 | process |
| 1a | F4 to F8 of the interim review of alpha.8 (white space, `!important`, the footer while a save hangs) | defects, low |
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

Found by the independent reviews: RV-01 to RV-04, A3-01 to A3-05, FF-01 to FF-03, the fourteen findings of the third review, the eight of the fourth and F1 to F3 of the interim review of alpha.8, see above.

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

A review of the corrections in alpha.8 and alpha.9. All steps of the owner's list are built. After the review: Chrome run, manual check of the native dialogs, a visible-window session with the new image and alignment functions, then a decision about a release. Nothing is merged and there is no release.
