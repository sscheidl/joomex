# Review request: HTML School Editor 0.1.0-alpha.8 to 0.1.0-alpha.11

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository.

**State on 2026-11-20:** the owner had this review carried out by a second reviewer (Claude Fable, without the implementer's context) instead. Result: PASS for the accompanied trial in Edge with two conditions, HOLD for Firefox, four findings B1 to B4 from the browsers' own editing. They are corrected in 1.0.0-beta.1 (branch `fix/html-school-editor-1.0.0-beta.1`, stacked on the alpha.11 branch; changed: `src/js/commands.js` (four functions at the end), `src/js/app.js` (`wirePreview`), `src/js/serialize.js` (`neighbourChar`); tests: `tests/browser/review11.mjs`), see [STATUS.md](STATUS.md#findings-of-the-independent-review-of-alpha11-and-their-corrections). On that branch: `node tools/build.mjs --check` gives 189813 bytes, sha256 `af1d99a2…`; unit tests 27 of 27; Edge 93 passed, 832 checks; Firefox 87 passed, 5 partial, 1 not measured, 789 checks. The request below is kept as it was written for alpha.11.

**State on 2026-11-23:** after the first day with a class the owner asked for small changes for the next class; they are 1.0.0-beta.2 (branch `fix/html-school-editor-1.0.0-beta.2`, from `main`): "Speichern unter …", no download button, a note in browsers that cannot write a file, new toolbar groups, alignment as a switch, and a corrected defect of "Im Browser öffnen" after a download, see [STATUS.md](STATUS.md#100-beta2-changes-after-the-first-day-with-a-class). The owner has asked for a complete review of everything from alpha.8; the brief for it is handed over separately.

**State on 2026-11-23 (late):** that review (of beta.2, verdict HOLD) was handed over locally. 1.0.0-beta.3 (branch `fix/html-school-editor-1.0.0-beta.3`, stacked on beta.2) corrects its findings E5a, B2-Hang, T1-copy, E6, E1c/E1d, E2/E4 and E8 (names), see [STATUS.md](STATUS.md#100-beta3-corrections-after-the-complete-review-of-beta2).

## alpha.11: two corrections after the reading review of alpha.10

GPT read the difference between alpha.9 and alpha.10 in four sections without running it (2026-11-20). The owner handed two points on, to be reproduced before anything is changed; both were confirmed in Edge and Firefox ([STATUS.md](STATUS.md#findings-of-the-reading-review-of-alpha10-and-their-corrections)). Version 0.1.0-alpha.11, stacked on alpha.10, corrects them with one added condition each. The owner has set a feature freeze after it. **This request covers alpha.8 to alpha.11 together;** please review the four as one change against alpha.7.

| Finding | Correction | Code | Case | Please try |
| --- | --- | --- | --- | --- |
| T1-6 (low) a file of the same name opened without a handle while the write of another file hangs was taken for that file | without a handle: the same name and the text the written file had before the write | `src/js/app.js:954`, `:1086` | A10-01 | a real drop in Edge and Chrome by hand; the file input; a page saved for the first time while it hangs |
| T2-3 (low) a part whose own colour is blocked lost the colours inside it | such a part is not cleared inside | `src/js/commands.js:582` | A10-02 | lists; an inline element as target; "Farbe entfernen" |

## alpha.10: corrections after the reading review of alpha.9

GPT read the code of alpha.9 in seven sections without running it (2026-11-20, verdict **HOLD**). The implementer measured every finding and every unclear point in the browser; the results and the owner's decisions are in [STATUS.md](STATUS.md#findings-of-the-reading-review-of-alpha9-and-their-corrections). Version 0.1.0-alpha.10, stacked on alpha.9, corrects the confirmed ones together with F4 to F6 of the interim review. The request covers these versions together with alpha.11, see above.

| Finding | Correction | Code | Case | Please try |
| --- | --- | --- | --- | --- |
| F9 (medium) the same file opened again while its first write hangs: afterwards "gespeichert" although the file differs | question names the running save; a write that ends for a page that is no longer open marks the open page as saved only if it is the same file and shows exactly the written text | `src/js/app.js:858`, `:1025`, `:1079` | A9-01 | a real file (Edge and Chrome by hand); the same file opened through the file input; New instead of Open; another file with the same name |
| F5 (low) "Speichert …" hidden by other messages | the top bar shows "Speichert …" while the file of the open page is written | `src/js/app.js:211` | A9-02, A7-04 | messages during a hanging write; switching pages during the write |
| F6 (medium) `!important` lost | a colour or alignment declaration with `!important` is left alone with a message (owner: pupils hardly write it) | `src/js/util.js:172` | A9-03, unit | `!important` in another declaration; upper case; escapes |
| F4 (low) "Links" against a print rule with `!important` | alignment written as before, plus a message | `src/js/util.js:279`, `src/js/commands.js:472`, `:487` | A9-04, unit | other conditional rules with `!important`; a rule for another element |
| S3-01 (low) a new item behind the last item without end tag | the last child of the source followed by a new block counts as changed | `src/js/serialize.js:134` | A9-05 | `<p>a<p>b`, Enter at the end; tables (must keep omitted end tags) |
| first cell deleted (cosmetic) | the white space in front of a deleted first cell goes, the next one keeps its own | `src/js/commands.js:642` | A9-06 | rows and cells on lines and not; first rows |
| specification "Files" | "or it fails, Save downloads" corrected to what the code does | `docs/SPECIFICATION.md` | — | — |

The implementer of alpha.9 and alpha.10 is the session that carried out the interim review; neither the interim review nor the reading review is an independent check of these corrections.

## alpha.9: corrections of the interim review

An interim review of alpha.8 by a second reviewer (Claude Fable, 2026-11-20, verdict **HOLD**) repeated your checklist inputs with variations and compared against the alpha.7 build. It found the eight corrections of alpha.8 working for your inputs, carried out 2.12, 2.13, 2.14 and the test audit without a finding, and found eight more defects, F1 to F8, none about lost work without a message or the protective design. Its report was handed over to the owner only. On the owner's request, version 0.1.0-alpha.9, stacked on alpha.8, corrects F1 to F3; F4 to F8 are open (see [STATUS.md](STATUS.md#findings-of-the-interim-review-of-alpha8-and-their-corrections)). **This request covers alpha.8 and alpha.9 together.** The implementer of alpha.9 is the session that carried out the interim review, so the interim review is no independent check of alpha.9.

| Finding | Correction | Code | Case | Please try |
| --- | --- | --- | --- | --- |
| F1 (medium) a save waiting behind a hanging write saves whatever page is open when its turn comes | the waiting save remembers the page of the last request (`nextDoc`) and is dropped if another page is open | `src/js/app.js:978` | A8-01 | another page opened and then the first one again while a save waits; "Im Browser öffnen" while a save waits and the page is switched; a save asked for in the new page |
| F2 (low, alpha.8 regression) mixed table layouts lose a line break after add and delete | a row or cell standing directly behind its neighbour is deleted without the white space behind it, unless the neighbour's end tag is omitted | `src/js/commands.js:635`, `:639` | A8-02 | every layout of rows and cells on lines and not; deleting cells of the source; tables with comments between rows |
| F3 (low, alpha.8 regression) a new item behind `<li>` without end tag puts its line break into that item | the item gets its end tag if the element behind it starts a line of its own and white space would be written | `src/js/serialize.js:46`, `:120`, `:134` | A8-03 | `dt`/`dd`; list commands that move a paragraph behind such an item; tables with omitted end tags and rows on lines (1.4e must stay corrected) |

A side effect to judge: in `<td>a<td>b</td> <td>c</td>`, deleting the column of b now keeps a's omitted end tag and drops the space behind b; alpha.8 kept the space and wrote `</td>`.

Three reviews ended with FAIL: of alpha.1 ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md)), of alpha.2 with alpha.3 ([reviews/REVIEW_0.1.0-alpha.3.md](reviews/REVIEW_0.1.0-alpha.3.md)) and, on 2026-11-19, of alpha.4 with alpha.5. The report of the third review was handed over to the owner only; it is not in this repository, and this request names its findings by the reviewer's identifiers (ATTR, IMG-QUERY, MEDIA, WRITES, BROWSE-SWITCH, STYLE-SPLIT, LIST, IMG-PENDING, BYTES, ALIGN, NOTICE, TITLE-RELOAD, DIALOG-RESIZE, TARGET-CASE). Version 0.1.0-alpha.6 corrects these fourteen findings and the sentence of the specification about pictures; it adds no function. Version 0.1.0-alpha.7, stacked on it, adds step B of the owner's list: text colour and tables. The owner asked for one review of both. The request is to check whether each finding is really corrected, in general and not only for the reported example, whether the corrections or the new functions broke something else or reopen an earlier kind of defect, and whether the new tests show what they claim. Nothing here is a review result; the implementer's own tests are not a review.

## alpha.8: corrections of the fourth review

The fourth review, of alpha.6 and alpha.7 together, ended with **HOLD** on 2026-11-20. It worked through a checklist of fixed inputs and found eight defects, none about lost work or the protective design; four parts were not reviewed. Its report was handed over to the owner only; the identifiers below are the numbers of that checklist. Version 0.1.0-alpha.8, stacked on alpha.7, corrects the eight. **This request is for alpha.8.** The sections further down describe alpha.6 and alpha.7 and stay as background.

Please check, for each correction, whether it holds in general and not only for the reported input, and whether it reopens an earlier kind of defect. Then the four parts that were not reviewed.

| Finding | Correction | Code | Case | Please try |
| --- | --- | --- | --- | --- |
| 1.1h comment lost when the colour changes | `withDecl()` leaves the attribute alone if a declaration that would change holds a comment | `src/js/util.js:172` | A7-01, unit | a comment inside the value, behind it, between name and colon; the same for alignment |
| 2.3 print rule and "Links" | `cssRisks()` notes `text-align` in a rule that holds only sometimes; `setAlign()` then writes `text-align: left` out | `src/js/util.js:277`, `src/js/commands.js:471`, `:485` | A7-02, unit | `@media screen`, `@supports not (…)`, `@layer`, `@container`, nested rules, `<link media>` (refused as external) |
| 1.4d `<colgroup>` and columns | `tableColumn()` refuses a table with `<colgroup>` or `<col>` | `src/js/commands.js:626`, `:680` | A7-03 | rows in such a table; a nested table with `<colgroup>` inside a table without |
| 2.4 no message while a save hangs | "Speichert …" while writing, kept until the save ends; every save asked for meanwhile joins one save behind it. No time limit (owner's decision) | `src/js/app.js:84`, `:979`, `:988`, `:995` | A7-04 | a refused or failed first write followed by a waiting one; "Im Browser öffnen" while two saves wait; a document switched while a save waits |
| 1.4c line breaks left in a table without line breaks | `childIndent()` gives no indentation in table parts whose children stand without line breaks; `freshLine()` then writes no line | `src/js/serialize.js:46`, `:59` | A7-05 | mixed tables (some rows on lines, some not); Enter inside a cell of such a table; "Code aufräumen" afterwards |
| 1.4e omitted end tags written out | `needsEndTag()` keeps an omitted end tag of `td`, `th`, `tr`, `li`, `dt`, `dd` omitted when an element of the same kind or the end of the parent follows | `src/js/serialize.js:121`, `:122` | A7-06 | lists with omitted `</li>`, `dl` with `dt`/`dd`, a cell followed by text or a comment |
| 2.2-7 folder change ignored | a changed folder for an address that names no file is refused with a message | `src/js/app.js:677` | A7-07 | a picture from the network or embedded in the code with a changed folder; a new picture chosen afterwards |
| 2.9-2 white space at both ends lost | the same value stays as written; a changed one keeps the white space at both ends | `src/js/util.js:172` | A7-08, unit | the same for colour; upper-case values |

Not reviewed in the fourth review, please carry out: **2.12** a title typed into the title field and the window closed or reloaded without Enter; **2.13** every dialog, colour and table included, moved, the window narrowed to 640 × 800 and widened again; **2.14** a second picture chosen while the check of the first is held; **3** the test audit (F-13, F-15, A5-01, A5-04 against hand-written expectations, A5-01 and A5-04 against the alpha.5 build).

Changed tests: the unit expectation for `text-align/**/: left` (removed together with its comment until alpha.7, left alone now) is the only older expectation that changed.

## What kind of review this is

* **Own code, own machine, offline.** This is a quality review of the owner's own software: an offline learning editor that pupils open as a single local file. Everything under review is in this folder. The product talks to no server and has no accounts and no network features. No third-party system is involved or tested.
* **Checking safeguards that already exist.** The editor displays HTML documents that pupils open. Its design goal is that such a document is only displayed: its scripts do not run, its links are not followed, nothing is loaded from the network. The test documents are inert samples for this editor; addresses in them point to a counting server on `127.0.0.1` that the test run starts itself.
* **Parts are independent.** One part per finding. If a part cannot be carried out for any reason, record it as `NOT REVIEWED` with the reason and complete the others.

## State of the repository

* **Branch for this request:** `fix/html-school-editor-0.1.0-alpha.11`, stacked on `fix/html-school-editor-0.1.0-alpha.10`. The corrections of alpha.11 are the difference between the two. **Changed in alpha.11:** `src/js/app.js` (`snapshotForSave`, `otherPageWritten`), `src/js/commands.js` (`setColor`); tests: `tests/browser/review10.mjs` (new), `tests/browser/review9.mjs` (helpers exported), `tests/run.mjs`.
* **alpha.10** is `fix/html-school-editor-0.1.0-alpha.10`, stacked on `fix/html-school-editor-0.1.0-alpha.9`. The corrections of alpha.10 are the difference between the two. **Changed in alpha.10:** `src/js/app.js` (`updateChrome`, `mayReplace`, `saveNow`, new `otherPageWritten`, alignment message), `src/js/util.js` (`withDecl`, `cssRisks`), `src/js/commands.js` (`alignFacts` instead of `alignSometimes`, `setAlign`, `takeOut`), `src/js/serialize.js` (`needsEndTag`); tests: `tests/browser/review9.mjs` (new), `tests/browser/review7.mjs` (A7-04, see STATUS.md), `tests/run.mjs`, `tests/unit/attrs.test.mjs`.
* **alpha.9** is `fix/html-school-editor-0.1.0-alpha.9`, stacked on `fix/html-school-editor-0.1.0-alpha.8` (pull request 22). The corrections of alpha.9 are the difference between the two. **Changed in alpha.9:** `src/js/app.js` (`saveDoc`), `src/js/commands.js` (`takeOut`, new `openEnd`), `src/js/serialize.js` (`freshLine` split into `lineBreakFor`, new `startsLine`, `needsEndTag`); tests: `tests/browser/review8.mjs` (new), `tests/run.mjs`.
* **alpha.8** is `fix/html-school-editor-0.1.0-alpha.8`, stacked on `feature/html-school-editor-0.1.0-alpha.7` (pull request 21). The corrections of alpha.8 are the difference between the two. **Changed in alpha.8:** `src/js/util.js` (`withDecl`, `cssRisks`), `src/js/commands.js` (`alignSometimes`, `setAlign`, `ownCols`, `tableColumn`), `src/js/serialize.js` (`freshLine`, `childIndent`, `emitKids`, `needsEndTag`), `src/js/app.js` (`setStatus`, `saveDoc`, `startSave`, `saveNow`, image dialog, two messages); tests: `tests/browser/review7.mjs` (new), `tests/run.mjs`, `tests/unit/attrs.test.mjs`.
* **Earlier branches** `fix/html-school-editor-0.1.0-alpha.6` (pull request 20, created from `feature/html-school-editor-0.1.0-alpha.5`, pull request 19) and `feature/html-school-editor-0.1.0-alpha.7`, stacked on it. The corrections are the difference between pull request 19 and pull request 20; step B is the difference between pull request 20 and the alpha.7 branch.
* **Changed in alpha.6:** `src/js/util.js` (`patchAttrs`, `keepRaw`, `withAlign`, `moveSrc`, `cssRisks`, `decodeFileBytes`), `src/js/project.js` (`cssFacts`, `syncHead`), `src/js/serialize.js` (decoder for `patchAttrs`), `src/js/commands.js` (`toggleList`, `liftOut`, `insertLink`, `opensNewTab`, `changeLink`), `src/js/app.js` (image dialog, saving, "Im Browser öffnen", title field, dialogs); tests: `tests/browser/review6.mjs` (new), `tests/run.mjs`, `tests/lib/cdp.mjs` and `tests/lib/firefox.mjs` (`setViewport`), `tests/unit/attrs.test.mjs`, `tests/unit/core.test.mjs`.
* **Changed in alpha.7:** `src/js/util.js` (`withDecl`, `plainStyle`, `COLORS`), `src/js/commands.js` (`setColor`, `liftOut` filter, tables), `src/js/serialize.js` (style of new elements, new `tbody`), `src/js/app.js` (colour and table dialogs, Tab in tables, empty cells in the page pane), `src/app.html`, `src/style.css`, `tools/build.mjs` (comment lines left out); tests: `tests/browser/features7.mjs` (new), `tests/run.mjs`, `tests/unit/attrs.test.mjs`, and the geometry of F-08 (`tests/browser/features5.mjs`) and A5-11 (`tests/browser/review6.mjs`) because the help dialog grew by one line. In alpha.6 not changed: `tokenizer.js`, `tree.js`, `format.js`, `highlight.js`, `history.js`, `images.js`, `src/app.html`, `src/style.css`, `tools/build.mjs`, the fixtures, `docs/brief/*`, `docs/reviews/*`.
* **Start from a fresh fetch:**

  ```bash
  git fetch --prune origin
  git worktree add <new folder> -b review/html-school-editor-0.1.0-alpha.11 origin/fix/html-school-editor-0.1.0-alpha.11
  git config user.email                                   # must be the GitHub noreply address
  git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
  ```

* **Not done and not to be assumed:** no merge, no release, no CI workflow.

## Commands and what they printed for the implementer

Run in `html-school-editor/`; the last one from the repository root:

```bash
# on the alpha.11 branch:
node tools/build.mjs --check            # up to date: dist/school-editor.html  184546 bytes  sha256 9173953d…
node --test tests/unit/*.test.mjs       # tests 27, pass 27, fail 0
node tests/run.mjs --browser edge       # edge: 89 passed, 0 not passed, 0 partial, 0 not measured, 809 checks, 3 part(s) NOT MEASURED
node tests/run.mjs --browser firefox    # firefox: 83 passed, 0 not passed, 5 partial, 1 not measured, 766 checks, 7 part(s) NOT MEASURED
node tests/run.mjs --browser edge --no-write --only A10-01,A10-02   # 2 passed; against the alpha.10 build 0 of 2 (Firefox the same)
# your checklist script of the fourth review, unchanged, from a copy: Edge 84 of 88 (as for alpha.8 to alpha.10), Firefox 3 of 3
# on the alpha.10 branch:
node tools/build.mjs --check            # up to date: dist/school-editor.html  184478 bytes  sha256 5746dedc…
node --test tests/unit/*.test.mjs       # tests 27, pass 27, fail 0
node tests/run.mjs --browser edge       # edge: 87 passed, 0 not passed, 0 partial, 0 not measured, 791 checks, 3 part(s) NOT MEASURED
node tests/run.mjs --browser firefox    # firefox: 81 passed, 0 not passed, 5 partial, 1 not measured, 748 checks, 7 part(s) NOT MEASURED
node tests/run.mjs --browser edge --no-write --only A9-01,A9-02,A9-03,A9-04,A9-05,A9-06,A9-07   # 7 passed; against the alpha.9 build A9-01 to A9-06 fail, A9-07 passes
# your checklist script of the fourth review, unchanged, from a copy: Edge 84 of 88 (as for alpha.8 and alpha.9), Firefox 3 of 3
# on the alpha.9 branch:
node tools/build.mjs --check            # up to date: dist/school-editor.html  182454 bytes  sha256 40992860…
node --test tests/unit/*.test.mjs       # tests 26, pass 26, fail 0
node tests/run.mjs --browser edge       # edge: 80 passed, 0 not passed, 0 partial, 0 not measured, 757 checks, 3 part(s) NOT MEASURED
node tests/run.mjs --browser firefox    # firefox: 74 passed, 0 not passed, 5 partial, 1 not measured, 714 checks, 7 part(s) NOT MEASURED
node tests/run.mjs --browser edge --no-write --only A8-01,A8-02,A8-03   # 3 passed; against the alpha.8 build 0 of 3
# your checklist script of the fourth review, unchanged, from a copy: Edge 84 of 88 (as for alpha.8), Firefox 3 of 3
# on the alpha.8 branch:
node tools/build.mjs --check            # up to date: dist/school-editor.html  181332 bytes  sha256 6b7e8260…
node --test tests/unit/*.test.mjs       # tests 26, pass 26, fail 0
node tests/run.mjs --browser edge --no-write      # edge: 77 passed, 0 not passed, 0 partial, 0 not measured, 741 checks, 3 part(s) NOT MEASURED
node tests/run.mjs --browser firefox --no-write   # firefox: 71 passed, 0 not passed, 5 partial, 1 not measured, 698 checks, 7 part(s) NOT MEASURED
node tests/run.mjs --browser edge --no-write --only A7-01,A7-02,A7-03,A7-04,A7-05,A7-06,A7-07,A7-08   # 8 passed; against the alpha.7 build 0 of 8
# on the alpha.7 branch the same commands printed: 178871 bytes, 330082cd…; 25 of 25; Edge 69 passed, 694 checks; Firefox 63 passed, 651 checks
# on the alpha.6 branch the same commands printed: 197663 bytes, d24c6a54…; 24 of 24; Edge 64 passed, 643 checks; Firefox 58 passed, 600 checks
node tests/run.mjs --browser edge --no-write --only A5-01,A5-02,A5-03,A5-04,A5-05,A5-06,A5-07,A5-08,A5-09,A5-10,A5-11,A5-12,A5-13,A5-14
python scripts/check_publication.py --denylist <private list>   # findings: 0
```

Environment: Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 157.0.4341.60 headless, Firefox 160.0.1 headless, 2026-11-20 (alpha.8) and 2026-11-19 (alpha.6, alpha.7). Chrome is not installed: NOT MEASURED. A full run without `--no-write` rewrites `tests/results/acceptance-*.json`.

The fourteen A5 cases were also run against the alpha.5 build (`git show 84fcd46:html-school-editor/dist/school-editor.html` in place of the built file): 0 of 14 pass in Edge.

**Your checklist script** of the fourth review was run unchanged from a copy outside the repository against the alpha.8 build: Edge 84 of 88 rows (alpha.7: 77), the seven rows of the findings pass and no other row changed; the four rows left are 2.6-2 to 2.6-5, whose flag expects an unchanged source, as your report says. Its Firefox rows: 3 of 3. **Your probes** of the third review were run unchanged from a copy outside the repository, with the alpha.6 build in place of the alpha.5 snapshot, and again with the alpha.7 build (Edge 18 of 19, WRITES NOT MEASURED; Firefox 18 of 19, WRITES timeout). Edge: 18 of 19 pass, WRITES NOT MEASURED (`SecurityError` for an origin-private file, as in your run). Firefox: 18 of 19 pass, WRITES stops with a timeout. Your WRITES probe holds the close of the first save and then waits until the second save has finished or was refused, before it releases the first. In alpha.6 the second save waits for the first (see WRITES below), so neither finishes until the probe gives up. The order your probe checks is measured by A5-04, in Firefox with a real origin-private file. Please judge whether waiting is an acceptable answer to WRITES, or whether a second save must finish or be refused on its own.

## Step B in alpha.7: text colour and tables

Requested by the owner; the decisions are in [SPECIFICATION.md](SPECIFICATION.md) (text colour as `<span style="color: …">` with a fixed palette of names, tables with `border="1"`). Please check the new functions themselves and, in particular, whether they reopen a kind of defect that an earlier review found. The implementer looked for these places:

| New code | Earlier finding of the same kind | How the new code avoids it | Where to look |
| --- | --- | --- | --- |
| Colour declaration added to or removed from a style attribute | A3-01, ALIGN | Through `withDecl()`, the CSS reader that `withAlign()` now also uses; the other declarations keep their spelling through `keepRaw()`; an unreadable style is left alone | `src/js/util.js:172`, `src/js/commands.js:540`; F-13 |
| Colour on part of a coloured span or of a bold word | STYLE-SPLIT | `liftOut()` with its copy marking; a filter so that only colour spans are unwrapped | `src/js/commands.js:276`; F-13 |
| Writing the style of a new element | the filter of `emitNew()` | `plainStyle()`: alignment keywords and the eight palette names only | `src/js/util.js:146`, `src/js/serialize.js:259`; unit test |
| Changing one attribute of an existing element | A3-02, ATTR | Only through `record()` and `patchAttrs()` | F-12, F-13 |
| Inserting and deleting rows and columns | LIST (order of neighbours) | New elements are placed relative to their neighbours; deleted ones take one line break with them | `src/js/commands.js:630`; F-15 (a comment and paragraphs around the table) |
| "Code aufräumen" with tables | RV-02, A3-03, MEDIA | No change to the formatter; tables go through the same checks | F-16 |
| Dialogs for colour and table | A3-04, IMG-PENDING, BROWSE-SWITCH | Both dialogs check revision and document after they close and do nothing if the page changed | `src/js/app.js:685`, `:700`; F-13, F-14 |
| Comment lines left out of the build | — | Only whole `//` lines; the build refuses a template literal that spans lines; the policy hash is computed over the delivered script | `tools/build.mjs:31`; every case runs on the stripped file |

Cases: F-12 to F-16 in `tests/browser/features7.mjs`, unit test "text colour". Questions: Is there a selection for which `setColor()` picks a target that the pupil would not expect (nested blocks, a selection that ends at the start of the next block, a link)? Can a colour or table command leave the page pane and the source with a different structure (the writer leaves out the new `tbody`)? Does Firefox add something of its own when typing into an empty cell? Do the comment lines left out of the build change anything else?

## High findings of the third review (alpha.6)

**ATTR.** `patchAttrs()` (`src/js/util.js:314`). A removal still takes the white space in front of the attribute along, but only if the character behind the removed attribute is white space, `>`, the end of the tag, or a `/` after a quote or directly after the tag name. Otherwise the white space in front stays, and where there is none a single space is written. Please check: other spellings in which removing or adding an attribute changes how the browser reads a neighbour, also unquoted values next to `/`.

**IMG-QUERY.** `dialogAddress()` (`src/js/app.js:627`): with an unchanged folder field the address is returned exactly as written; another folder goes through `moveSrc()` (`src/js/util.js:106`), which replaces only the folder of the path in front of `?` or `#`. `folderOfSrc()` already cut at `?` and `#`. Please check: addresses in which `fileOfSrc()`, `folderOfSrc()` and `moveSrc()` disagree about where the path ends.

**MEDIA.** `cssFacts()` (`src/js/project.js:483`) passes a third argument to `cssRisks()` (`src/js/util.js:267`): the rules of a style element whose `media` attribute is neither empty nor `all` are read as rules that hold only sometimes. `media="screen"` is conditional too, deliberately. Please check: other ways in which a style element or a link applies only sometimes (`<link>` is already refused as external).

**WRITES.** `saveDoc()` (`src/js/app.js:979`) chains every save to the one before it; `saveNow()` takes its snapshot when its turn comes, so the newest text is written last and `markSaved()` sees the snapshots in order. A save that hangs (a writer whose `close()` never settles) would hold every later save; there is no time limit. "Herunterladen" is not chained.

**BROWSE-SWITCH.** `browseDoc()` (`src/js/app.js:1069`) remembers `state.docId` before the question and checks it after the question and after saving; if another document is open, nothing is opened and nothing is said.

## Medium and low findings of the third review (alpha.6)

**STYLE-SPLIT.** `liftOut()` (`src/js/commands.js:276`) marks every element of the two fragments that has no entry in the source map as a copy (`{ t: null, copy: true }`); `emitNew()` (`src/js/serialize.js:245`) writes a copy with all its attributes except `id`, holders and event handlers, the style included. `insertLink()` (`:373`) does the same for the fragment it wraps. Please check: can an element be marked as a copy that is not a copy of a source element, so that attributes the editor would otherwise drop are written?

**LIST.** `toggleList()` (`src/js/commands.js:194`) starts a new list when anything other than white-space text stands between two paragraphs. A comment between two paragraphs therefore also gives two lists.

**IMG-PENDING.** `pickBusy` (`src/js/app.js:600`) holds the choice whose check runs; `validateImageDialog()` (`:668`) refuses while it is the latest one.

**TITLE-RELOAD.** `isDirty()` (`src/js/app.js:207`) also compares the text of the title field with the title of the page; the field updates the save state on every input, and Escape and a refused title update it too.

**DIALOG-RESIZE.** `wireDrag()` (`src/js/app.js:114`) clamps a moved dialog again on every `resize` of the window. A dialog that was not moved is centred by the browser.

**BYTES.** `decodeFileBytes()` (`src/js/util.js:386`) counts line feeds as all `\n` minus the CRLF pairs.

**ALIGN.** `withAlign()` (`src/js/util.js:172`) keeps the white space at both ends of the whole text. `patchAttrs()` gets a decoder from the writer and writes a changed value through `keepRaw()` (`:364`): the beginning and end that are the same in the old and new value keep their spelling, character references included; only the part between is written anew. A reference without a semicolon makes it write the whole value anew, because its reading depends on what follows.

**NOTICE.** `syncHead()` (`src/js/project.js:321`) counts every link in the head that has an `href` as "weiterer Verweis" (before only style sheets were counted; the body already counted other links).

**TARGET-CASE.** `opensNewTab()` (`src/js/commands.js:446`) compares the target without regard to case, for the check box and for `changeLink()`.

**Specification.** The paragraphs on inactive content and on known limitations in [SPECIFICATION.md](SPECIFICATION.md) now describe pictures from the folder of the editor.

## The tests

`tests/browser/review6.mjs` has one case per finding; the inputs follow your reproductions and the expected source texts and bytes are written by hand. Mocks are labelled: A5-04 and A5-05 use a mock save handle with a held close (A5-04 writes through it into a real origin-private file where the browser allows it), A5-05 records `window.open`, A5-08 holds `createImageBitmap()` as in A3-04. A5-11 changes the viewport with the new `setViewport()` of both drivers. Unit tests: `tests/unit/attrs.test.mjs` ("review findings of alpha.4 and alpha.5") and `tests/unit/core.test.mjs` ("file bytes").

## Where the implementer is least sure

* **WRITES by waiting.** Your fourth review judged the waiting appropriate. Since alpha.8 the pupil sees "Speichert …" while a write hangs, and saves asked for meanwhile become one. A write that never ends still holds later saves; there is no time limit (owner's decision).
* **Tables written without line breaks** (alpha.8) are recognised by the first child from the source of each table part; a part whose first row stands on a line of its own and whose later rows do not is treated as written with line breaks.
* **`keepRaw()`** decides by single characters and by references with a semicolon; it trusts the writer's decoder for those.
* **Copies marked by absence.** An element without a source-map entry in a cut fragment is taken for a copy. Elements the editor created before (for example a new `<b>`) have no entry either; they carry only attributes the editor wrote.
* **Everything listed before and not touched:** native file dialogs never executed; a download counts as saved; the browser produces the structure while typing; German texts never tried with pupils; headless only.

## What comes after this review

After this review: Chrome, the native file dialogs by hand, a visible-window session and a trial with pupils. About 15454 bytes were left below the size limit in alpha.11, about 10187 in 1.0.0-beta.1.

## Not measured

Chrome; native open/save dialogs and write-back; in Firefox the parts listed as PARTIAL or NOT MEASURED in [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md#firefox); in Edge the real file of A5-04; visible-window runs by the implementer; physical input methods, system clipboard, touch, screen readers; printing; other operating systems.

## Delivery

1. A report in English with, per finding, corrected or not, with `file:line`, and what was not reviewed; new findings with the requirement concerned. The owner decides where it goes; the report of the third review was handed over locally.
2. Overall verdict `PASS`, `HOLD` or `FAIL`. Findings about lost work and about the protective design come first.
3. Do not change the product on the fix branch. If anything is pushed: the repository publication check with no findings, and the ancestry check from above.
