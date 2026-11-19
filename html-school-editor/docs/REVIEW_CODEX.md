# Review request: HTML School Editor 0.1.0-alpha.4

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository.

Two reviews ended with FAIL: of alpha.1 ([reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md)) and of alpha.2 with alpha.3 ([reviews/REVIEW_0.1.0-alpha.3.md](reviews/REVIEW_0.1.0-alpha.3.md), findings A3-01 to A3-05 and the test-helper finding A3-T). You then measured alpha.3 in Firefox ([reviews/FIREFOX_0.1.0-alpha.3.md](reviews/FIREFOX_0.1.0-alpha.3.md), FF-01 to FF-03 and the selection difference in T-03). Version 0.1.0-alpha.4 contains the corrections of the second review and of the Firefox measurement, one change to the image dialog after a report of the owner, and three changes the owner asked for after trying it: pictures are shown from the folder of the editor (this changes the content policy, see the part "Pictures from the folder of the editor"), the version number stands in the top bar, and the box of a picture from the network explains what to do. The request is to check whether each finding is really corrected, in general and not only for the reported example, whether the corrections broke something else, and whether the new tests show what they claim. Nothing here is a review result; the implementer's own tests are not a review.

## What kind of review this is

* **Own code, own machine, offline.** This is a quality review of the owner's own software: an offline learning editor that pupils open as a single local file. Everything under review is in this folder. The product talks to no server and has no accounts and no network features. No third-party system is involved or tested.
* **Checking safeguards that already exist.** The editor displays HTML documents that pupils open. Its design goal is that such a document is only displayed: its scripts do not run, its links are not followed, nothing is loaded from the network. The test documents are inert samples for this editor; addresses in them point to a counting server on `127.0.0.1` that the test run starts itself. A passing run means that nothing ran and the local counter stayed at zero.
* **Parts are independent.** The request has one part per finding, one about Firefox, one about the image dialog, one about pictures from the folder of the editor and one about the tests. If a part cannot be carried out for any reason, record it as `NOT REVIEWED` with the reason and complete the others.

## State of the repository

* **Branch** `fix/html-school-editor-0.1.0-alpha.4`, created from the tip of `review/html-school-editor-0.1.0-alpha.3` (the second review with the Firefox measurement, pull request 17), which is stacked on `feature/html-school-editor-0.1.0-alpha.3` (pull request 16). The review documents, the probe scripts, the Firefox runner and their result files are on this branch unchanged. The corrections are the difference between pull request 17 and this branch.
* **Changed in alpha.4:** `src/js/util.js` (CSS reading, alignment, attribute patching), `project.js` (`cssFacts`, `hiddenLayoutRisk`, `layoutPrint`, reuse of `<br>` nodes), `serialize.js` (white space tidied by the browser, the browser's own line break), `app.js` (formatting, image dialog, pictures from the folder, note, dialogs, kind of pending input), `commands.js` (`setAlign`, `dropSpace`, image source), `images.js` (size bound, no object URL), `src/app.html` and `src/style.css` (image dialog, note about missing pictures, version in the top bar), `tools/build.mjs` (image source of the policy); tests: `tests/browser/review3.mjs` (new), `review.mjs` (one expectation of RV-04), `features.mjs` (F-01 rewritten, F-02, F-04 new), `functional.mjs` (T-03, T-06), `security.mjs` (X-06, X-08 new), `tests/unit/attrs.test.mjs`, `tests/lib/harness.mjs`, `tests/run.mjs` (Firefox). Not changed: `tree.js`, `tokenizer.js`, `format.js`, `highlight.js`, `history.js`, the fixtures, `docs/brief/*`, `docs/reviews/*`, `tests/lib/firefox.mjs`, `tests/run-firefox.mjs`, `tests/firefox-diagnostics.mjs`.
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
node tools/build.mjs --check            # up to date: dist/school-editor.html  182038 bytes  sha256 72715e61…
node --test tests/unit/*.test.mjs       # tests 22, pass 22, fail 0
node tests/run.mjs --browser edge --no-write      # edge: 43 passed, 0 not passed, 0 partial, 0 not measured, 536 checks, 2 part(s) NOT MEASURED
node tests/run.mjs --browser firefox --no-write   # firefox: 37 passed, 0 not passed, 5 partial, 1 not measured, 492 checks, 7 part(s) NOT MEASURED
node tests/run.mjs --browser edge --no-write --only A3-01,A3-02,A3-03,A3-04,A3-05,A3-T,FF-01,FF-02
node tests/run.mjs --browser edge --no-write --only F-01,T-06,X-06,X-08
python scripts/check_publication.py --denylist <private list>   # findings: 0
```

Environment: Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 157.0.4341.60 headless, Firefox 160.0.1 headless, 2026-11-19. Chrome is not installed: NOT MEASURED. A full run without `--no-write` rewrites `tests/results/acceptance-*.json`.

**Your probe script** `docs/reviews/review-alpha3.mjs` is unchanged. Against the committed alpha.4 build before the owner's requests (176,008 bytes; not re-run since) its probes for A3-01, A3-02 (four of them), A3-03 and the layout-frame check report `productPass: true`. The A3-04 probe waits until the open dialog shows the file of the cancelled one, which no longer happens, so the script stops there with a timeout and never reaches its probes for A3-05 and A3-T. The A3-T probe has the same shape: it awaits `openFile()` and only afterwards releases the held read, so with a helper that really waits it cannot finish. Your inputs are the first samples of the cases with the same numbers in `tests/browser/review3.mjs`. Running your script overwrites `tests/results/review-alpha3-edge.json`; the implementer restored that file after the run.

## A3-01: alignment and other declarations

**Correction.** `withAlign()` (`src/js/util.js:139`) no longer searches the style text. `styleDeclarations()` (`:192`) splits it the way CSS is read: `cssSkip()` (`:159`) steps over strings, comments and escaped characters, brackets are counted, and a semicolon is a border only outside all of them. The property name of each piece is compared after comments are removed and escapes resolved. Only pieces named `text-align` are removed. If a string, comment or bracket is left open, or a line break stands inside a string, the function returns null and `setAlign()` (`src/js/commands.js:464`) leaves that element alone and reports it.

**Please check.**

1. Is there a style text that `styleDeclarations()` splits differently from the browser, so that a piece is taken for a `text-align` declaration although it is not one, or the other way round? A wrong "no" leaves a second declaration in the attribute (the appended one wins); a wrong "yes" would remove text.
2. The appended declaration comes last. With `!important` on an earlier `text-align`, or in a page rule, the button has no visible effect. The source is then changed without effect; nothing is lost.
3. `onlyAlign()` (`:116`), used for new elements, is still a strict pattern over the whole attribute value. It accepts only a single declaration with one of four keywords.

## A3-02: attributes of badly written tags

**Correction.** `patchAttrs()` (`src/js/util.js:273`): a removal now takes every occurrence of the name; a new value still goes to the first one. For an attribute without value the function looks whether an equals sign follows the name (`name=` before `>` or before white space and `>`): then the sign belongs to the attribute and is replaced or removed with it.

**Please check.**

1. Other ways in which the tokenizer's four offsets per attribute (`src/js/tokenizer.js`) do not describe what the browser reads. The tokenizer was not changed.
2. When a new value is set and later occurrences of the name exist, they stay. That is what the browser ignores; the tag is as badly written as before.

## A3-03: formatting and rules that hold only sometimes

**Correction.** Two additions to the checks in front of `formatDoc()` (`src/js/app.js:697`).

1. `cssRisks()` (`src/js/util.js:227`) reads every style element and style attribute as CSS, with blocks, strings, comments and escapes, and reports `conditional` if a rule that holds only sometimes declares `display`, `content`, `all` or a custom property, or if one of the first three is declared anywhere with a `var()` or `if()` value. "Only sometimes" is: inside any at-rule except a fixed list of unconditional ones (`@font-face`, `@counter-style`, `@property`, `@namespace`, `@charset`, `@layer`, `@page`, `@font-feature-values`, `@font-palette-values`, `@color-profile`), which makes `@media`, `@supports`, `@container`, `@scope`, `@starting-style`, `@keyframes` and unknown at-rules conditional; or behind a selector that contains one of a list of state pseudo-classes or `[open` (`STATE`, `:216`). The same reader now also answers `spaces` and `external`, in place of the regular expressions of alpha.2, and reports `unclear` for a string or comment that is not closed. Each of the four stops the formatting with its own message.
2. `hiddenLayoutRisk()` (`src/js/project.js:504`), called on the first rendering inside `sameLayout()` (`src/js/app.js:676`): a block element without a box, whose own computed `display` is not `none`, must not be displayed inline or as `contents` and must not have `::before` or `::after` content. This covers parts under a `hidden` attribute, in closed `details` or under an ancestor with `display: none`, which the box comparison cannot see.

**Please check.**

1. The principle. The layout comparison answers for the one state it renders; everything that can differ in another state is supposed to be caught by the reader. Which kinds of "another state" are missing? Known and stated in [SPECIFICATION.md](SPECIFICATION.md): a script of the page that changes styles or classes; an element that is hidden by its own `display: none` and shown by something other than CSS.
2. The list `STATE` and the list of unconditional at-rules. Selectors that depend on the document only (`:nth-child`, `:has`, `:lang`, `:empty`, attribute selectors other than `[open]`) are treated as unconditional, because the formatter does not change elements or attributes. `:empty` and `:has` look at white-space-only text nodes in some cases; is there a selector whose match the formatter's own white-space changes can flip?
3. Properties. Only `display`, `content`, `all` and custom properties count inside conditional rules. Is there another property through which white space between blocks or at the edge of a block becomes visible?
4. Nested rules and unknown syntax: a `{` at bracket depth 0 opens a block whose text in front is the prelude. A stray `}` ends a block early; reading then goes on behind it.
5. The refusal is coarse: one harmless-looking `@media` rule with `display` blocks formatting for the whole page. That is deliberate.

## A3-04: image checks that finish late

**Correction.** `pickSeq` (`src/js/app.js:494`) is raised by every file choice and every opening and closing of the image dialog. `pickImage()` (`:572`) remembers the value before it waits for `readImage()` and drops the result, releasing its object URL, if the value has changed or the dialog is closed.

**Please check.** Other asynchronous results that can arrive in a dialog they do not belong to. The link dialog has none. A dropped image file opens the dialog and then starts its check, so its number is the newest.

## A3-05: stops by the policy

**Correction.** The listener (`src/js/app.js:1067`) sets one flag for the document on every policy-violation event, without looking at the address. `showInactive()` (`:265`) shows the editor's own list if it has entries, otherwise the note about a stop by the browser. The flag is cleared only in `replaceDocument()`. The attempt of alpha.2 to follow the text is gone.

**Please check.**

1. The note is now sticky by design, as you proposed. A pupil who removes the cause keeps the note until another page is opened; the text of the note says "vom Browser blockiert".
2. An event that is delivered after the document was replaced would set the flag for the new document. The implementer has not seen this happen and has no way to attribute an event to a document.
3. When the editor's own list has entries, a stop it does not know is not mentioned separately: the note lists the known kinds only. S-04 asks for an indication, which exists in that case.

## Firefox: FF-01 to FF-03 and T-03

Your Firefox runner and driver are on this branch unchanged. The driver is now also used by `tests/run.mjs --browser firefox`, which runs all 43 cases and writes `tests/results/acceptance-firefox.json`; your result files are not touched by it. A case that needs automation the driver does not have is recorded as PARTIAL with the part that is missing, as in your runner. The two helpers your runner overrides are reconciled in `tests/lib/harness.mjs`: `openFile()` waits for the "Geöffnet" message, `pickImage()` for the label with the dimensions.

**FF-01, white space in a neighbouring text.** While typing, Firefox empties or removes text nodes that hold only white space next to the caret's text, and drops a space at the edge of a neighbouring text when another space is next to it (it keeps the one in the edited text as a no-break space). Correction in `src/js/serialize.js`: `engineTidied()` (`:138`) writes such a text as it stands in the source. Line breaks and indentation between elements (`t.hidden`) always; a space at an edge or a single space between elements only if `unseenEdge()` (`:123`) says it could not be seen, the white space of the parent collapses, and `ctx.typing` is set. `rescueHidden()` (`:313`) gives a text node the engine took out its text back, and under the same conditions puts back a single space between elements. `typing` comes from `state.onlyInserts` (`src/js/app.js:1024`): true until an input event of another kind than an insertion arrives, reset by every render.

Please check: can the rule keep a space the pupil wanted to delete? The intended answer is no, because any deletion switches it off until the next render. Can it keep white space in a text the pupil did edit? It applies only if the whole difference of the node is the missing white space. Is "could not be seen" judged correctly (comments are looked through; an inline element next to the text counts as visible content)?

**FF-02, the browser's own line break.** Firefox keeps a `<br>` in an editable page without visible content. `syncKids()` reuses a `<br>` only if the projection created it (`src/js/project.js:275`), and the removal of a foreign one from the page does not count as a change of the projection (`:308`). The writer never writes a loose run directly in the page that consists of one `<br>` (`paddingBreak()`, `src/js/serialize.js:68`). Consequence in every browser: when a pupil deletes everything, the page is written empty instead of with `<p><br></p>`.

**FF-03, formatting refused.** Firefox gives white space between blocks a box with a height and no width. `layoutPrint()` (`src/js/project.js:524`) now counts a white-space-only text only if its box has a width. Is there rendered white space with no width that matters? In `pre`-like contexts the formatter does not run at all.

**T-03.** No product change. The expectation is now: the marked source without its tags equals the text selected in the page, and the selection is the word with or without the space behind it.

## The image dialog: a report of the owner

The owner chose a picture again under the same file name from another folder and expected the address to change. The browser does not disclose the folder, so the address follows the folder field only; that was and is the specified behaviour. The dialog now says so and shows the address it will write, updating while the pupil types (`dialogAddress()`, `src/js/app.js:597`; `showAddress()`, `:614`; `src/app.html`). `validateImageDialog()` (`:637`) uses the same function, so what is shown is what is written. The folder suggested for the next picture now follows every accepted address, not only a newly chosen file. Case F-02 has the scenario.

## Pictures from the folder of the editor: a decision of the owner

**Please look at this part closely: it widens what the page pane may load.** Until alpha.3 the page pane showed a picture only from a file the pupil had chosen in the running session (object URL). A page reopened a week later showed every picture as a box, and pupils read the box as a broken link. The owner decided: the editor lies in the pupil's project folder, together with pages and pictures, so a relative address means the same file from both, and the page pane loads it from there.

What changed:

* Both content policies say `img-src data: 'self'` instead of `img-src data: blob:` (`tools/build.mjs:59`, `src/js/app.js:29`). Object URLs for pictures are gone (`src/js/images.js`).
* `localFileUrl()` (`src/js/util.js:115`) resolves only addresses that `fileOfSrc()` accepts, against the editor's own address, and returns a result only for `file:` with the editor's own host. The projection puts only that result on an image element (`src/js/project.js:194`); every other image gets a generated SVG `data:` picture that names the reason (`boxPicture()`, `:167`).
* Missing files: `error` in the capture phase (`onImageError`, `src/js/app.js:503`), a set `missing`, a render after pending edits are committed (`showLost`, `:510`). Looking again only on return from another program, on a document change and after the image dialog (`retryLost`, `:518`; `cameBack`, `:1074`). A note above the page lists the missing addresses separately (`showInactive`, `:265`).
* The image dialog probes the address it will write and says "Gefunden" or "Nicht gefunden" (`showAddress`, `:585`, with its own counter `foundSeq`).

Residual risk accepted by the owner, to be checked and described, not to be removed: `'self'` also applies to pictures named in the **CSS** of an opened page, which the editor does not resolve. Such a page can load picture files of this computer outside the project folder, and in Edge a `file://computer/share/…` address is attempted (Firefox resolves it locally). Nothing from the network is loaded. Case X-08 records this; [SECURITY.md](SECURITY.md#pictures-from-the-folder-of-the-editor) describes it.

Questions: Can any element or attribute of an opened document make the page pane load a file other than through `localFileUrl()` and CSS? Does the `error` handling end in a loop for some input (a file that loads and then fails, an address that changes while it loads, many missing pictures)? Can a late error or a late dialog probe change the state of a newer document? Is the condition "the page must lie in the folder of the editor" stated where a pupil reads it? Cases: F-01 (rewritten), T-06, A3-04, X-06, X-08, unit test "images: the file a relative address names".

## A3-T and the tests

1. `Editor.openFile()` (`tests/lib/harness.mjs`) empties the status line and waits for the editor's message "Geöffnet …" together with the file name. Case A3-T holds a read of a file with the name of the open one and checks that the helper has not returned.
2. `tests/browser/review3.mjs` has one case per finding with your input first. A3-03 compares accepted results as ordinary pages at 500 and 1800 pixels; the measuring code is in the test file.
3. RV-04 expected the note to disappear after the address was deleted; it now expects the note to stay (`tests/browser/review.mjs`).
4. Unit tests for the CSS reader and the patcher: `tests/unit/attrs.test.mjs`.
5. [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md) now says for S-04, S-05, S-06 and S-08 what was found by review and which limits are known, instead of a bare PASS.

## Remarks of the second review that were taken up without being findings

* A second question no longer writes its text into a dialog that is already open (`confirmBox`, `src/js/app.js:91`).
* `dropSpace()` (`src/js/commands.js:139`) uses HTML white space, so a no-break space is not removed.
* Picture files above 20 MB are refused (`src/js/images.js:18`), which gives S-08 a size bound again. Since pictures are no longer kept in memory, nothing grows with the number of chosen pictures.

## Where the implementer is least sure

* **The rule about white space tidied by the browser** is the newest code and decides by the kind of input. If a browser reports an input type that the list of insertions does not know, the rule is off and the old behaviour applies; if a browser tidies after a deletion, a space may be lost as before.
* **The CSS reader is new and hand-written.** It is about a hundred lines and has to agree with the browser on where strings, comments and blocks end. It errs on the side of refusing: anything not closed is `unclear`.
* **The list of state selectors** is a list. A state that is missing from it lets a conditional rule through to the layout comparison, which then sees one state only.
* **Hidden parts** were tried with the `hidden` attribute and closed `details` only.
* **Everything listed before and not touched:** one browser only; native file dialogs never executed; a download counts as saved; the browser produces the structure while typing; German texts never tried with pupils; headless only.

## What comes after this review

The owner has collected further functions for later versions: movable dialogs, a button that opens the saved page in a new tab, underline, superscript, subscript and highlight tags, a check box "open in a new tab" for links, an editable page title, text colour with a fixed palette, tables. They come as separate versions stacked on this one and are not part of this review.

## Not measured

Chrome; native open/save dialogs and write-back; in Firefox the parts listed as PARTIAL or NOT MEASURED in [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md#firefox) (file chooser, composition, comparison pages with scripts off, paste); visible-window runs by the implementer; spell-check replacement, text drag in the source field, speech, handwriting, autofill; long sessions and memory growth; screen readers and keyboard-only operation of the page pane; printing; other operating systems.

## Delivery

1. `docs/reviews/REVIEW_0.1.0-alpha.4.md` in this folder, in English, on the branch `review/html-school-editor-0.1.0-alpha.4`, as a pull request stacked on the fix branch.
2. Per finding: corrected or not, with `file:line`, and what was not reviewed. New findings with the requirement concerned.
3. Overall verdict `PASS`, `HOLD` or `FAIL`. Findings about lost work and about the protective design come first.
4. Do not change the product on the fix branch. Corrections belong in the review document, or in a separate branch with a new version number.
5. Before pushing: the repository publication check with no findings, and the ancestry check from above.
