# Review request: HTML School Editor 0.1.0-alpha.4

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository.

Two reviews ended with FAIL: of alpha.1 ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md)) and of alpha.2 with alpha.3 ([reviews/REVIEW_0.1.0-alpha.3.md](reviews/REVIEW_0.1.0-alpha.3.md), findings A3-01 to A3-05 and the test-helper finding A3-T). You then measured alpha.3 in Firefox ([reviews/FIREFOX_0.1.0-alpha.3.md](reviews/FIREFOX_0.1.0-alpha.3.md), FF-01 to FF-03 and the selection difference in T-03). Version 0.1.0-alpha.4 contains the corrections of the second review and of the Firefox measurement, and one change to the image dialog after a report of the owner. It adds no other function. The request is to check whether each finding is really corrected, in general and not only for the reported example, whether the corrections broke something else, and whether the new tests show what they claim. Nothing here is a review result; the implementer's own tests are not a review.

## What kind of review this is

* **Own code, own machine, offline.** This is a quality review of the owner's own software: an offline learning editor that pupils open as a single local file. Everything under review is in this folder. The product talks to no server and has no accounts and no network features. No third-party system is involved or tested.
* **Checking safeguards that already exist.** The editor displays HTML documents that pupils open. Its design goal is that such a document is only displayed: its scripts do not run, its links are not followed, nothing is loaded from the network. The test documents are inert samples for this editor; addresses in them point to a counting server on `127.0.0.1` that the test run starts itself. A passing run means that nothing ran and the local counter stayed at zero.
* **Parts are independent.** The request has one part per finding, one about Firefox, one about the image dialog and one about the tests. If a part cannot be carried out for any reason, record it as `NOT REVIEWED` with the reason and complete the others.

## State of the repository

* **Branch** `fix/html-school-editor-0.1.0-alpha.4`, created from the tip of `review/html-school-editor-0.1.0-alpha.3` (the second review with the Firefox measurement, pull request 17), which is stacked on `feature/html-school-editor-0.1.0-alpha.3` (pull request 16). The review documents, the probe scripts, the Firefox runner and their result files are on this branch unchanged. The corrections are the difference between pull request 17 and this branch.
* **Changed in alpha.4:** `src/js/util.js` (CSS reading, alignment, attribute patching), `project.js` (`cssFacts`, `hiddenLayoutRisk`, `layoutPrint`, reuse of `<br>` nodes), `serialize.js` (white space tidied by the browser, the browser's own line break), `app.js` (formatting, image dialog, note, dialogs, kind of pending input), `commands.js` (`setAlign`, `dropSpace`), `images.js` (size bound), `src/app.html` and `src/style.css` (two lines in the image dialog); tests: `tests/browser/review3.mjs` (new), `review.mjs` (one expectation of RV-04), `features.mjs` (F-01, F-02), `functional.mjs` (T-03), `tests/unit/attrs.test.mjs`, `tests/lib/harness.mjs`, `tests/run.mjs` (Firefox). Not changed: `tree.js`, `tokenizer.js`, `format.js`, `highlight.js`, `history.js`, `tools/build.mjs`, the fixtures, `docs/brief/*`, `docs/reviews/*`, `tests/lib/firefox.mjs`, `tests/run-firefox.mjs`, `tests/firefox-diagnostics.mjs`.
* **Start from a fresh fetch:**

  ```bash
  git fetch --prune origin
  git worktree add <new folder> -b review/html-school-editor-0.1.0-alpha.4 origin/fix/html-school-editor-0.1.0-alpha.4
  git config user.email                                   # must be the GitHub noreply address
  git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
  ```

* **Not done and not to be assumed:** no merge, no release, no CI workflow.

## Commands and what they printed for the implementer

Run in `html-school-editor/`; the last one from the repository root:

```bash
node tools/build.mjs --check            # up to date: dist/school-editor.html  176008 bytes  sha256 e9ad516a…
node --test tests/unit/*.test.mjs       # tests 21, pass 21, fail 0
node tests/run.mjs --browser edge --no-write      # edge: 41 passed, 0 not passed, 0 partial, 0 not measured, 511 checks, 2 part(s) NOT MEASURED
node tests/run.mjs --browser firefox --no-write   # firefox: 35 passed, 0 not passed, 5 partial, 1 not measured, 467 checks, 7 part(s) NOT MEASURED
node tests/run.mjs --browser edge --no-write --only A3-01,A3-02,A3-03,A3-04,A3-05,A3-T,FF-01,FF-02
python scripts/check_publication.py --denylist <private list>   # findings: 0
```

Environment: Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 157.0.4341.60 headless, Firefox 160.0.1 headless, 2026-11-19. Chrome is not installed: NOT MEASURED. A full run without `--no-write` rewrites `tests/results/acceptance-*.json`.

**Your probe script** `docs/reviews/review-alpha3.mjs` is unchanged. Against this version its probes for A3-01, A3-02 (four of them), A3-03 and the layout-frame check report `productPass: true`. The A3-04 probe waits until the open dialog shows the file of the cancelled one, which no longer happens, so the script stops there with a timeout and never reaches its probes for A3-05 and A3-T. The A3-T probe has the same shape: it awaits `openFile()` and only afterwards releases the held read, so with a helper that really waits it cannot finish. Your inputs are the first samples of the cases with the same numbers in `tests/browser/review3.mjs`. Running your script overwrites `tests/results/review-alpha3-edge.json`; the implementer restored that file after the run.

## A3-01: alignment and other declarations

**Correction.** `withAlign()` (`src/js/util.js:126`) no longer searches the style text. `styleDeclarations()` (`:179`) splits it the way CSS is read: `cssSkip()` (`:146`) steps over strings, comments and escaped characters, brackets are counted, and a semicolon is a border only outside all of them. The property name of each piece is compared after comments are removed and escapes resolved. Only pieces named `text-align` are removed. If a string, comment or bracket is left open, or a line break stands inside a string, the function returns null and `setAlign()` (`src/js/commands.js:450`) leaves that element alone and reports it.

**Please check.**

1. Is there a style text that `styleDeclarations()` splits differently from the browser, so that a piece is taken for a `text-align` declaration although it is not one, or the other way round? A wrong "no" leaves a second declaration in the attribute (the appended one wins); a wrong "yes" would remove text.
2. The appended declaration comes last. With `!important` on an earlier `text-align`, or in a page rule, the button has no visible effect. The source is then changed without effect; nothing is lost.
3. `onlyAlign()` (`:116`), used for new elements, is still a strict pattern over the whole attribute value. It accepts only a single declaration with one of four keywords.

## A3-02: attributes of badly written tags

**Correction.** `patchAttrs()` (`src/js/util.js:260`): a removal now takes every occurrence of the name; a new value still goes to the first one. For an attribute without value the function looks whether an equals sign follows the name (`name=` before `>` or before white space and `>`): then the sign belongs to the attribute and is replaced or removed with it.

**Please check.**

1. Other ways in which the tokenizer's four offsets per attribute (`src/js/tokenizer.js`) do not describe what the browser reads. The tokenizer was not changed.
2. When a new value is set and later occurrences of the name exist, they stay. That is what the browser ignores; the tag is as badly written as before.

## A3-03: formatting and rules that hold only sometimes

**Correction.** Two additions to the checks in front of `formatDoc()` (`src/js/app.js:625`).

1. `cssRisks()` (`src/js/util.js:214`) reads every style element and style attribute as CSS, with blocks, strings, comments and escapes, and reports `conditional` if a rule that holds only sometimes declares `display`, `content`, `all` or a custom property, or if one of the first three is declared anywhere with a `var()` or `if()` value. "Only sometimes" is: inside any at-rule except a fixed list of unconditional ones (`@font-face`, `@counter-style`, `@property`, `@namespace`, `@charset`, `@layer`, `@page`, `@font-feature-values`, `@font-palette-values`, `@color-profile`), which makes `@media`, `@supports`, `@container`, `@scope`, `@starting-style`, `@keyframes` and unknown at-rules conditional; or behind a selector that contains one of a list of state pseudo-classes or `[open` (`STATE`, `:203`). The same reader now also answers `spaces` and `external`, in place of the regular expressions of alpha.2, and reports `unclear` for a string or comment that is not closed. Each of the four stops the formatting with its own message.
2. `hiddenLayoutRisk()` (`src/js/project.js:482`), called on the first rendering inside `sameLayout()` (`src/js/app.js:604`): a block element without a box, whose own computed `display` is not `none`, must not be displayed inline or as `contents` and must not have `::before` or `::after` content. This covers parts under a `hidden` attribute, in closed `details` or under an ancestor with `display: none`, which the box comparison cannot see.

**Please check.**

1. The principle. The layout comparison answers for the one state it renders; everything that can differ in another state is supposed to be caught by the reader. Which kinds of "another state" are missing? Known and stated in [SPECIFICATION.md](SPECIFICATION.md): a script of the page that changes styles or classes; an element that is hidden by its own `display: none` and shown by something other than CSS.
2. The list `STATE` and the list of unconditional at-rules. Selectors that depend on the document only (`:nth-child`, `:has`, `:lang`, `:empty`, attribute selectors other than `[open]`) are treated as unconditional, because the formatter does not change elements or attributes. `:empty` and `:has` look at white-space-only text nodes in some cases; is there a selector whose match the formatter's own white-space changes can flip?
3. Properties. Only `display`, `content`, `all` and custom properties count inside conditional rules. Is there another property through which white space between blocks or at the edge of a block becomes visible?
4. Nested rules and unknown syntax: a `{` at bracket depth 0 opens a block whose text in front is the prelude. A stray `}` ends a block early; reading then goes on behind it.
5. The refusal is coarse: one harmless-looking `@media` rule with `display` blocks formatting for the whole page. That is deliberate.

## A3-04: image checks that finish late

**Correction.** `pickSeq` (`src/js/app.js:459`) is raised by every file choice and every opening and closing of the image dialog. `pickImage()` (`:515`) remembers the value before it waits for `readImage()` and drops the result, releasing its object URL, if the value has changed or the dialog is closed.

**Please check.** Other asynchronous results that can arrive in a dialog they do not belong to. The link dialog has none. A dropped image file opens the dialog and then starts its check, so its number is the newest.

## A3-05: stops by the policy

**Correction.** The listener (`src/js/app.js:946`) sets one flag for the document on every policy-violation event, without looking at the address. `showInactive()` (`:238`) shows the editor's own list if it has entries, otherwise the note about a stop by the browser. The flag is cleared only in `replaceDocument()`. The attempt of alpha.2 to follow the text is gone.

**Please check.**

1. The note is now sticky by design, as you proposed. A pupil who removes the cause keeps the note until another page is opened; the text of the note says "vom Browser blockiert".
2. An event that is delivered after the document was replaced would set the flag for the new document. The implementer has not seen this happen and has no way to attribute an event to a document.
3. When the editor's own list has entries, a stop it does not know is not mentioned separately: the note lists the known kinds only. S-04 asks for an indication, which exists in that case.

## Firefox: FF-01 to FF-03 and T-03

Your Firefox runner and driver are on this branch unchanged. The driver is now also used by `tests/run.mjs --browser firefox`, which runs all 41 cases and writes `tests/results/acceptance-firefox.json`; your result files are not touched by it. A case that needs automation the driver does not have is recorded as PARTIAL with the part that is missing, as in your runner. The two helpers your runner overrides are reconciled in `tests/lib/harness.mjs`: `openFile()` waits for the "Geöffnet" message, `pickImage()` for the label with the dimensions.

**FF-01, white space in a neighbouring text.** While typing, Firefox empties or removes text nodes that hold only white space next to the caret's text, and drops a space at the edge of a neighbouring text when another space is next to it (it keeps the one in the edited text as a no-break space). Correction in `src/js/serialize.js`: `engineTidied()` (`:138`) writes such a text as it stands in the source. Line breaks and indentation between elements (`t.hidden`) always; a space at an edge or a single space between elements only if `unseenEdge()` (`:123`) says it could not be seen, the white space of the parent collapses, and `ctx.typing` is set. `rescueHidden()` (`:313`) gives a text node the engine took out its text back, and under the same conditions puts back a single space between elements. `typing` comes from `state.onlyInserts` (`src/js/app.js:907`): true until an input event of another kind than an insertion arrives, reset by every render.

Please check: can the rule keep a space the pupil wanted to delete? The intended answer is no, because any deletion switches it off until the next render. Can it keep white space in a text the pupil did edit? It applies only if the whole difference of the node is the missing white space. Is "could not be seen" judged correctly (comments are looked through; an inline element next to the text counts as visible content)?

**FF-02, the browser's own line break.** Firefox keeps a `<br>` in an editable page without visible content. `syncKids()` reuses a `<br>` only if the projection created it (`src/js/project.js:253`), and the removal of a foreign one from the page does not count as a change of the projection (`:286`). The writer never writes a loose run directly in the page that consists of one `<br>` (`paddingBreak()`, `src/js/serialize.js:68`). Consequence in every browser: when a pupil deletes everything, the page is written empty instead of with `<p><br></p>`.

**FF-03, formatting refused.** Firefox gives white space between blocks a box with a height and no width. `layoutPrint()` (`src/js/project.js:502`) now counts a white-space-only text only if its box has a width. Is there rendered white space with no width that matters? In `pre`-like contexts the formatter does not run at all.

**T-03.** No product change. The expectation is now: the marked source without its tags equals the text selected in the page, and the selection is the word with or without the space behind it.

## The image dialog: a report of the owner

The owner chose a picture again under the same file name from another folder and expected the address to change. The browser does not disclose the folder, so the address follows the folder field only; that was and is the specified behaviour. The dialog now says so and shows the address it will write, updating while the pupil types (`dialogAddress()`, `src/js/app.js:542`; `showAddress()`, `:558`; `src/app.html`). `validateImageDialog()` (`:564`) uses the same function, so what is shown is what is written. The folder suggested for the next picture now follows every accepted address, not only a newly chosen file. Case F-02 has the scenario.

## A3-T and the tests

1. `Editor.openFile()` (`tests/lib/harness.mjs`) empties the status line and waits for the editor's message "Geöffnet …" together with the file name. Case A3-T holds a read of a file with the name of the open one and checks that the helper has not returned.
2. `tests/browser/review3.mjs` has one case per finding with your input first. A3-03 compares accepted results as ordinary pages at 500 and 1800 pixels; the measuring code is in the test file.
3. RV-04 expected the note to disappear after the address was deleted; it now expects the note to stay (`tests/browser/review.mjs`).
4. Unit tests for the CSS reader and the patcher: `tests/unit/attrs.test.mjs`.
5. [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md) now says for S-04, S-05, S-06 and S-08 what was found by review and which limits are known, instead of a bare PASS.

## Remarks of the second review that were taken up without being findings

* A second question no longer writes its text into a dialog that is already open (`confirmBox`, `src/js/app.js:89`).
* `dropSpace()` (`src/js/commands.js:139`) uses HTML white space, so a no-break space is not removed.
* Picture files above 20 MB are refused (`src/js/images.js:18`), which gives S-08 a size bound again. The number of pictures kept during a session is not bounded.

## Where the implementer is least sure

* **The rule about white space tidied by the browser** is the newest code and decides by the kind of input. If a browser reports an input type that the list of insertions does not know, the rule is off and the old behaviour applies; if a browser tidies after a deletion, a space may be lost as before.
* **The CSS reader is new and hand-written.** It is about a hundred lines and has to agree with the browser on where strings, comments and blocks end. It errs on the side of refusing: anything not closed is `unclear`.
* **The list of state selectors** is a list. A state that is missing from it lets a conditional rule through to the layout comparison, which then sees one state only.
* **Hidden parts** were tried with the `hidden` attribute and closed `details` only.
* **Everything listed before and not touched:** one browser only; native file dialogs never executed; a download counts as saved; the browser produces the structure while typing; German texts never tried with pupils; headless only.

## What comes after this review

The owner has collected further functions for a later version (not in this branch): movable dialogs, a button that opens the saved page in a new tab, underline, superscript, subscript and highlight tags, text colour with a fixed palette, tables. They will come as separate versions after this one.

## Not measured

Chrome; native open/save dialogs and write-back; in Firefox the parts listed as PARTIAL or NOT MEASURED in [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md#firefox) (file chooser, composition, comparison pages with scripts off, paste); visible-window runs by the implementer; spell-check replacement, text drag in the source field, speech, handwriting, autofill; long sessions and memory growth; screen readers and keyboard-only operation of the page pane; printing; other operating systems.

## Delivery

1. `docs/reviews/REVIEW_0.1.0-alpha.4.md` in this folder, in English, on the branch `review/html-school-editor-0.1.0-alpha.4`, as a pull request stacked on the fix branch.
2. Per finding: corrected or not, with `file:line`, and what was not reviewed. New findings with the requirement concerned.
3. Overall verdict `PASS`, `HOLD` or `FAIL`. Findings about lost work and about the protective design come first.
4. Do not change the product on the fix branch. Corrections belong in the review document, or in a separate branch with a new version number.
5. Before pushing: the repository publication check with no findings, and the ancestry check from above.
