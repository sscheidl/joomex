# Review request: HTML School Editor 0.1.0-alpha.6 and 0.1.0-alpha.7

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository.

Three reviews ended with FAIL: of alpha.1 ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md)), of alpha.2 with alpha.3 ([reviews/REVIEW_0.1.0-alpha.3.md](reviews/REVIEW_0.1.0-alpha.3.md)) and, on 2026-11-19, of alpha.4 with alpha.5. The report of the third review was handed over to the owner only; it is not in this repository, and this request names its findings by the reviewer's identifiers (ATTR, IMG-QUERY, MEDIA, WRITES, BROWSE-SWITCH, STYLE-SPLIT, LIST, IMG-PENDING, BYTES, ALIGN, NOTICE, TITLE-RELOAD, DIALOG-RESIZE, TARGET-CASE). Version 0.1.0-alpha.6 corrects these fourteen findings and the sentence of the specification about pictures; it adds no function. Version 0.1.0-alpha.7, stacked on it, adds step B of the owner's list: text colour and tables. The owner asked for one review of both. The request is to check whether each finding is really corrected, in general and not only for the reported example, whether the corrections or the new functions broke something else or reopen an earlier kind of defect, and whether the new tests show what they claim. Nothing here is a review result; the implementer's own tests are not a review.

## What kind of review this is

* **Own code, own machine, offline.** This is a quality review of the owner's own software: an offline learning editor that pupils open as a single local file. Everything under review is in this folder. The product talks to no server and has no accounts and no network features. No third-party system is involved or tested.
* **Checking safeguards that already exist.** The editor displays HTML documents that pupils open. Its design goal is that such a document is only displayed: its scripts do not run, its links are not followed, nothing is loaded from the network. The test documents are inert samples for this editor; addresses in them point to a counting server on `127.0.0.1` that the test run starts itself.
* **Parts are independent.** One part per finding. If a part cannot be carried out for any reason, record it as `NOT REVIEWED` with the reason and complete the others.

## State of the repository

* **Branches** `fix/html-school-editor-0.1.0-alpha.6` (pull request 20, created from `feature/html-school-editor-0.1.0-alpha.5`, pull request 19) and `feature/html-school-editor-0.1.0-alpha.7`, stacked on it. The corrections are the difference between pull request 19 and pull request 20; step B is the difference between pull request 20 and the alpha.7 branch.
* **Changed in alpha.6:** `src/js/util.js` (`patchAttrs`, `keepRaw`, `withAlign`, `moveSrc`, `cssRisks`, `decodeFileBytes`), `src/js/project.js` (`cssFacts`, `syncHead`), `src/js/serialize.js` (decoder for `patchAttrs`), `src/js/commands.js` (`toggleList`, `liftOut`, `insertLink`, `opensNewTab`, `changeLink`), `src/js/app.js` (image dialog, saving, "Im Browser öffnen", title field, dialogs); tests: `tests/browser/review6.mjs` (new), `tests/run.mjs`, `tests/lib/cdp.mjs` and `tests/lib/firefox.mjs` (`setViewport`), `tests/unit/attrs.test.mjs`, `tests/unit/core.test.mjs`.
* **Changed in alpha.7:** `src/js/util.js` (`withDecl`, `plainStyle`, `COLORS`), `src/js/commands.js` (`setColor`, `liftOut` filter, tables), `src/js/serialize.js` (style of new elements, new `tbody`), `src/js/app.js` (colour and table dialogs, Tab in tables, empty cells in the page pane), `src/app.html`, `src/style.css`, `tools/build.mjs` (comment lines left out); tests: `tests/browser/features7.mjs` (new), `tests/run.mjs`, `tests/unit/attrs.test.mjs`, and the geometry of F-08 (`tests/browser/features5.mjs`) and A5-11 (`tests/browser/review6.mjs`) because the help dialog grew by one line. In alpha.6 not changed: `tokenizer.js`, `tree.js`, `format.js`, `highlight.js`, `history.js`, `images.js`, `src/app.html`, `src/style.css`, `tools/build.mjs`, the fixtures, `docs/brief/*`, `docs/reviews/*`.
* **Start from a fresh fetch:**

  ```bash
  git fetch --prune origin
  git worktree add <new folder> -b review/html-school-editor-0.1.0-alpha.7 origin/feature/html-school-editor-0.1.0-alpha.7
  git config user.email                                   # must be the GitHub noreply address
  git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
  ```

* **Not done and not to be assumed:** no merge, no release, no CI workflow.

## Commands and what they printed for the implementer

Run in `html-school-editor/`; the last one from the repository root:

```bash
# on the alpha.7 branch:
node tools/build.mjs --check            # up to date: dist/school-editor.html  178871 bytes  sha256 330082cd…
node --test tests/unit/*.test.mjs       # tests 25, pass 25, fail 0
node tests/run.mjs --browser edge --no-write      # edge: 69 passed, 0 not passed, 0 partial, 0 not measured, 694 checks, 3 part(s) NOT MEASURED
node tests/run.mjs --browser firefox --no-write   # firefox: 63 passed, 0 not passed, 5 partial, 1 not measured, 651 checks, 7 part(s) NOT MEASURED
# on the alpha.6 branch the same commands printed: 197663 bytes, d24c6a54…; 24 of 24; Edge 64 passed, 643 checks; Firefox 58 passed, 600 checks
node tests/run.mjs --browser edge --no-write --only A5-01,A5-02,A5-03,A5-04,A5-05,A5-06,A5-07,A5-08,A5-09,A5-10,A5-11,A5-12,A5-13,A5-14
python scripts/check_publication.py --denylist <private list>   # findings: 0
```

Environment: Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 157.0.4341.60 headless, Firefox 160.0.1 headless, 2026-11-19. Chrome is not installed: NOT MEASURED. A full run without `--no-write` rewrites `tests/results/acceptance-*.json`.

The fourteen A5 cases were also run against the alpha.5 build (`git show 84fcd46:html-school-editor/dist/school-editor.html` in place of the built file): 0 of 14 pass in Edge.

**Your probes** of the third review were run unchanged from a copy outside the repository, with the alpha.6 build in place of the alpha.5 snapshot, and again with the alpha.7 build (Edge 18 of 19, WRITES NOT MEASURED; Firefox 18 of 19, WRITES timeout). Edge: 18 of 19 pass, WRITES NOT MEASURED (`SecurityError` for an origin-private file, as in your run). Firefox: 18 of 19 pass, WRITES stops with a timeout. Your WRITES probe holds the close of the first save and then waits until the second save has finished or was refused, before it releases the first. In alpha.6 the second save waits for the first (see WRITES below), so neither finishes until the probe gives up. The order your probe checks is measured by A5-04, in Firefox with a real origin-private file. Please judge whether waiting is an acceptable answer to WRITES, or whether a second save must finish or be refused on its own.

## Step B in alpha.7: text colour and tables

Requested by the owner; the decisions are in [SPECIFICATION.md](SPECIFICATION.md) (text colour as `<span style="color: …">` with a fixed palette of names, tables with `border="1"`). Please check the new functions themselves and, in particular, whether they reopen a kind of defect that an earlier review found. The implementer looked for these places:

| New code | Earlier finding of the same kind | How the new code avoids it | Where to look |
| --- | --- | --- | --- |
| Colour declaration added to or removed from a style attribute | A3-01, ALIGN | Through `withDecl()`, the CSS reader that `withAlign()` now also uses; the other declarations keep their spelling through `keepRaw()`; an unreadable style is left alone | `src/js/util.js:171`, `src/js/commands.js:516`; F-13 |
| Colour on part of a coloured span or of a bold word | STYLE-SPLIT | `liftOut()` with its copy marking; a filter so that only colour spans are unwrapped | `src/js/commands.js:276`; F-13 |
| Writing the style of a new element | the filter of `emitNew()` | `plainStyle()`: alignment keywords and the eight palette names only | `src/js/util.js:146`, `src/js/serialize.js:246`; unit test |
| Changing one attribute of an existing element | A3-02, ATTR | Only through `record()` and `patchAttrs()` | F-12, F-13 |
| Inserting and deleting rows and columns | LIST (order of neighbours) | New elements are placed relative to their neighbours; deleted ones take one line break with them | `src/js/commands.js:604`; F-15 (a comment and paragraphs around the table) |
| "Code aufräumen" with tables | RV-02, A3-03, MEDIA | No change to the formatter; tables go through the same checks | F-16 |
| Dialogs for colour and table | A3-04, IMG-PENDING, BROWSE-SWITCH | Both dialogs check revision and document after they close and do nothing if the page changed | `src/js/app.js:665`, `:680`; F-13, F-14 |
| Comment lines left out of the build | — | Only whole `//` lines; the build refuses a template literal that spans lines; the policy hash is computed over the delivered script | `tools/build.mjs:31`; every case runs on the stripped file |

Cases: F-12 to F-16 in `tests/browser/features7.mjs`, unit test "text colour". Questions: Is there a selection for which `setColor()` picks a target that the pupil would not expect (nested blocks, a selection that ends at the start of the next block, a link)? Can a colour or table command leave the page pane and the source with a different structure (the writer leaves out the new `tbody`)? Does Firefox add something of its own when typing into an empty cell? Do the comment lines left out of the build change anything else?

## High findings of the third review (alpha.6)

**ATTR.** `patchAttrs()` (`src/js/util.js:308`). A removal still takes the white space in front of the attribute along, but only if the character behind the removed attribute is white space, `>`, the end of the tag, or a `/` after a quote or directly after the tag name. Otherwise the white space in front stays, and where there is none a single space is written. Please check: other spellings in which removing or adding an attribute changes how the browser reads a neighbour, also unquoted values next to `/`.

**IMG-QUERY.** `dialogAddress()` (`src/js/app.js:609`): with an unchanged folder field the address is returned exactly as written; another folder goes through `moveSrc()` (`src/js/util.js:106`), which replaces only the folder of the path in front of `?` or `#`. `folderOfSrc()` already cut at `?` and `#`. Please check: addresses in which `fileOfSrc()`, `folderOfSrc()` and `moveSrc()` disagree about where the path ends.

**MEDIA.** `cssFacts()` (`src/js/project.js:483`) passes a third argument to `cssRisks()` (`src/js/util.js:262`): the rules of a style element whose `media` attribute is neither empty nor `all` are read as rules that hold only sometimes. `media="screen"` is conditional too, deliberately. Please check: other ways in which a style element or a link applies only sometimes (`<link>` is already refused as external).

**WRITES.** `saveDoc()` (`src/js/app.js:948`) chains every save to the one before it; `saveNow()` takes its snapshot when its turn comes, so the newest text is written last and `markSaved()` sees the snapshots in order. A save that hangs (a writer whose `close()` never settles) would hold every later save; there is no time limit. "Herunterladen" is not chained.

**BROWSE-SWITCH.** `browseDoc()` (`src/js/app.js:979`) remembers `state.docId` before the question and checks it after the question and after saving; if another document is open, nothing is opened and nothing is said.

## Medium and low findings of the third review (alpha.6)

**STYLE-SPLIT.** `liftOut()` (`src/js/commands.js:276`) marks every element of the two fragments that has no entry in the source map as a copy (`{ t: null, copy: true }`); `emitNew()` (`src/js/serialize.js:232`) writes a copy with all its attributes except `id`, holders and event handlers, the style included. `insertLink()` (`:360`) does the same for the fragment it wraps. Please check: can an element be marked as a copy that is not a copy of a source element, so that attributes the editor would otherwise drop are written?

**LIST.** `toggleList()` (`src/js/commands.js:194`) starts a new list when anything other than white-space text stands between two paragraphs. A comment between two paragraphs therefore also gives two lists.

**IMG-PENDING.** `pickBusy` (`src/js/app.js:582`) holds the choice whose check runs; `validateImageDialog()` (`:650`) refuses while it is the latest one.

**TITLE-RELOAD.** `isDirty()` (`src/js/app.js:194`) also compares the text of the title field with the title of the page; the field updates the save state on every input, and Escape and a refused title update it too.

**DIALOG-RESIZE.** `wireDrag()` (`src/js/app.js:101`) clamps a moved dialog again on every `resize` of the window. A dialog that was not moved is centred by the browser.

**BYTES.** `decodeFileBytes()` (`src/js/util.js:380`) counts line feeds as all `\n` minus the CRLF pairs.

**ALIGN.** `withAlign()` (`src/js/util.js:171`) keeps the white space at both ends of the whole text. `patchAttrs()` gets a decoder from the writer and writes a changed value through `keepRaw()` (`:358`): the beginning and end that are the same in the old and new value keep their spelling, character references included; only the part between is written anew. A reference without a semicolon makes it write the whole value anew, because its reading depends on what follows.

**NOTICE.** `syncHead()` (`src/js/project.js:321`) counts every link in the head that has an `href` as "weiterer Verweis" (before only style sheets were counted; the body already counted other links).

**TARGET-CASE.** `opensNewTab()` (`src/js/commands.js:446`) compares the target without regard to case, for the check box and for `changeLink()`.

**Specification.** The paragraphs on inactive content and on known limitations in [SPECIFICATION.md](SPECIFICATION.md) now describe pictures from the folder of the editor.

## The tests

`tests/browser/review6.mjs` has one case per finding; the inputs follow your reproductions and the expected source texts and bytes are written by hand. Mocks are labelled: A5-04 and A5-05 use a mock save handle with a held close (A5-04 writes through it into a real origin-private file where the browser allows it), A5-05 records `window.open`, A5-08 holds `createImageBitmap()` as in A3-04. A5-11 changes the viewport with the new `setViewport()` of both drivers. Unit tests: `tests/unit/attrs.test.mjs` ("review findings of alpha.4 and alpha.5") and `tests/unit/core.test.mjs` ("file bytes").

## Where the implementer is least sure

* **WRITES by waiting.** See the question above. A hanging writer blocks later saves without a message.
* **`keepRaw()`** decides by single characters and by references with a semicolon; it trusts the writer's decoder for those.
* **Copies marked by absence.** An element without a source-map entry in a cut fragment is taken for a copy. Elements the editor created before (for example a new `<b>`) have no entry either; they carry only attributes the editor wrote.
* **Everything listed before and not touched:** native file dialogs never executed; a download counts as saved; the browser produces the structure while typing; German texts never tried with pupils; headless only.

## What comes after this review

After this review: Chrome, the native file dialogs by hand, a visible-window session and a trial with pupils. With the comment lines left out, about 21129 bytes are left below the size limit.

## Not measured

Chrome; native open/save dialogs and write-back; in Firefox the parts listed as PARTIAL or NOT MEASURED in [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md#firefox); in Edge the real file of A5-04; visible-window runs by the implementer; physical input methods, system clipboard, touch, screen readers; printing; other operating systems.

## Delivery

1. A report in English with, per finding, corrected or not, with `file:line`, and what was not reviewed; new findings with the requirement concerned. The owner decides where it goes; the report of the third review was handed over locally.
2. Overall verdict `PASS`, `HOLD` or `FAIL`. Findings about lost work and about the protective design come first.
3. Do not change the product on the fix branch. If anything is pushed: the repository publication check with no findings, and the ancestry check from above.
