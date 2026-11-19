# Re-review request: HTML School Editor 0.1.0-alpha.2

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository.

Version 0.1.0-alpha.1 was reviewed and failed: [reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md), findings RV-01 to RV-04. This version contains the corrections. The request is to check whether each finding is really corrected, whether the corrections broke something else, and whether the new tests show what they claim. Nothing here is a review result; the implementer's own tests are not a review.

## What kind of review this is

* **Own code, own machine, offline.** This is a quality review of the owner's own software: an offline learning editor that pupils open as a single local file. Everything under review is in this folder. The product talks to no server and has no accounts and no network features. No third-party system is involved or tested.
* **Checking safeguards that already exist.** The editor displays HTML documents that pupils open. Its design goal is that such a document is only displayed: its scripts do not run, its links are not followed, nothing is loaded from the network. The test documents are inert samples for this editor; addresses in them point to a counting server on `127.0.0.1` that the test run starts itself. A passing run means that nothing ran and the local counter stayed at zero.
* **Parts are independent.** The request has one part per finding (RV-01 to RV-04) and a part about the tests. If a part cannot be carried out for any reason, record it as `NOT REVIEWED` with the reason and complete the others.

## State of the repository

* **Branch** `fix/html-school-editor-0.1.0-alpha.2`, created from the tip of `review/html-school-editor-0.1.0-alpha.1` (the review of alpha.1, pull request 14), which is stacked on `import/html-school-editor-0.1.0-alpha.1` (pull request 13). The review document, the reviewer's probe script and its result files are on this branch unchanged.
* **Changed since alpha.1:** `src/js/app.js`, `commands.js`, `project.js`, `serialize.js`, `src/style.css`, `package.json`, `dist/school-editor.html`; tests: `tests/browser/review.mjs` (new), `functional.mjs`, `security.mjs`, `robustness.mjs`, `tests/lib/harness.mjs`, `tests/run.mjs`, `tests/results/acceptance-*.json`; documents in `docs/` and `README.md`. Not changed: `tokenizer.js`, `tree.js`, `format.js`, `highlight.js`, `history.js`, `images.js`, `util.js`, `src/app.html`, `tools/build.mjs`, the unit tests, the fixtures, `docs/brief/*`, `docs/reviews/*`.
* **Start from a fresh fetch**, as for the first review (the history of four branches was rewritten on 2026-11-18; anything created before that must not be pushed):

  ```bash
  git fetch --prune origin
  git worktree add <new folder> -b review/html-school-editor-0.1.0-alpha.2 origin/fix/html-school-editor-0.1.0-alpha.2
  git config user.email                                   # must be the GitHub noreply address
  git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
  ```

* **Not done and not to be assumed:** no merge, no release, no CI workflow.

## Commands and what they printed for the implementer

Run in `html-school-editor/`; the last one from the repository root:

```bash
node tools/build.mjs --check            # up to date: dist/school-editor.html  143858 bytes  sha256 091f5167…
node --test tests/unit/*.test.mjs       # tests 13, pass 13, fail 0
node tests/run.mjs --browser edge --no-write   # edge: 30 passed, 0 not passed, 341 checks, 2 part(s) NOT MEASURED
node tests/run.mjs --browser edge --no-write --only RV-01,RV-02,RV-03,RV-04
python scripts/check_publication.py --denylist <private list>   # findings: 0
```

Environment: Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 157.0.4341.60 headless, 2026-11-19. Chrome is not installed: NOT MEASURED. A full run without `--no-write` rewrites `tests/results/acceptance-*.json`.

**Your probe script** `docs/reviews/review-alpha1.mjs` is unchanged. Against this version it stops in its first probe with `timeout: read completed`: the probe waits until the document name is that of the late file, and the late file is no longer opened (schedule with New) or only after a question (schedule with typing). The script therefore never reaches its other probes. Your inputs for RV-02, RV-03 and RV-04 are the first samples of the cases with the same numbers in `tests/browser/review.mjs`. Running your script also overwrites `tests/results/review-alpha1-edge.json`, your evidence for alpha.1; the implementer restored that file after the run.

## RV-01: a file read that finishes late

**Correction.** `src/js/app.js:587–611`: `beginReplace()` hands out a ticket with a sequence number; `mayReplace(op)` is the only gate in front of `replaceDocument()`. It commits pending page edits, returns false if a newer ticket exists, returns true if document id and revision are the ones for which consent was recorded, and otherwise asks (if there is unsaved work) and records the consent for the state at that moment, then loops. `newDoc` (`:607`), `openDoc` (`:650`), `handleDroppedFile` (`:724`) and the change event of the file input (`:872`) all go through it; `loadFile` (`:613`) calls it as its last step, with nothing awaited before `replaceDocument` (`:558`). The ticket of an Open click is taken before the file chooser or the native picker opens.

**Please check.**

1. Is there a path to `replaceDocument()` that does not pass `mayReplace()`? The only other caller is the start-up (`start()`).
2. Between the last `mayReplace()` and `replaceDocument()` in `loadFile` there is no `await`. Is that also true for every caller, and can the state change during the dialog inside `mayReplace` in a way the loop does not see?
3. Decisions you may disagree with: a click on New cancels a pending read even if the pupil then declines the question of New. A read whose text was edited and restored by Undo meanwhile opens without a question (nothing is unsaved). A second question that arrives while a dialog is open counts as declined (`openDialog`, `:75`).
4. `tests/browser/review.mjs`, case RV-01: six schedules. The seam holds `File.arrayBuffer()`; the second schedule goes through the Open button and the intercepted file chooser. The native picker (`showOpenFilePicker`, `getFile`) is NOT MEASURED.

## RV-02: formatting under author CSS

**Correction.** `formatDoc()` (`src/js/app.js:523`) applies the formatter's output only if all of these hold:

1. `cssFacts()` (`src/js/project.js:443`): no declaration of `white-space`, `white-space-collapse` or `text-space-collapse` with a value outside a fixed list of collapsing and neutral keywords, anywhere in a style element or style attribute, after CSS comments and escapes were resolved; and no style sheet file (`link rel=stylesheet`, `@import`).
2. Same characters apart from white space, and the same canonical form of both parsed documents (`canonDom()`, as before).
3. `sameLayout()` (`src/js/app.js:484`): a hidden frame like the page pane (same shell, sandbox attribute, policy and width; animations and transitions switched off by an added rule) is filled with the old text and then with the new one through the ordinary projection, and `layoutPrint()` (`src/js/project.js:471`) must be equal: the box of every element and of every rendered text node in quarter pixels.

The result is dropped if document id or revision changed while the check ran.

**Please check.**

1. Can a document pass all three checks and still look different afterwards in the page pane or in an ordinary browser window of another width? Known and documented: check 3 sees one width, the page at rest and no pointer state. A rule that changes `display`, `content` or `all` only under a media or hover condition is not evaluated. Is that limit acceptable for S-05, or should such conditions be refused like `white-space` is?
2. Is the keyword list in `cssFacts()` right, and is the scan complete? It reads `style` elements in any namespace and `style` attributes, not SVG presentation attributes (SVG content is not touched by the formatter).
3. `layoutPrint()` skips text nodes that consist of white space and have no box. Is there white space that is rendered, moves nothing and has an empty range box?
4. The hidden frame: it is a second frame for document content. Attribute and shell are those of the page pane, it is removed in a `finally`, never focused, and `visibility: hidden`. The static scan X-06 only inspects the frame in the template; the dynamic one is in `src/js/app.js:485–497`.
5. Refusing every document with a style sheet file is strict. The alternative would be to format without being able to compare.
6. Case RV-02 renders original and result as ordinary local pages with scripts off and compares boxes with measuring code of the test file. Is that an expectation independent of the product?

## RV-03: attributes in list commands

**Correction.** `toggleList()` (`src/js/commands.js:186`) renames the paragraph or heading to `li` with `rename()` (`:96`), which keeps the mapping to the source element, and moves it into the new list. `unlist()` (`:150`) renames items back. The writer emits a renamed element with its original start tag text (`src/js/serialize.js:218–248`) and gives it a line of its own when it left its source parent (`inPlace`, `:38`; `moved`, `:238`). Policy for the cases where the element cannot keep its role, stated in [SPECIFICATION.md](SPECIFICATION.md) under "What stays untouched":

* an item that holds blocks and has attributes becomes a `div` with them;
* a list with attributes whose items all become paragraphs stays as a `div` around them;
* if items remain, the original list element keeps them; items behind a paragraph taken out of the middle continue in a second list that copies the attributes the page pane shows, except `id` (`copy` flag, `src/js/commands.js:162–165`, `src/js/serialize.js:188`). Attributes the page pane does not show (event handlers) are not copied to the second list. This is the one place where the policy is not "keep everything"; they stay on the first list.

**Please check.**

1. The policy itself, in particular the `div` results and the second list.
2. `rescueHidden()` (`src/js/serialize.js:253`) got two rules: white space that only indented a removed element is not moved to the parent (`lost`), and a line break that a command removed on purpose is not put back (`dropped`, set in `dropSpace`, `src/js/commands.js:131`). Can either rule drop something other than white space? Both apply to text nodes only.
3. One more rule in `emitKids()` (`src/js/serialize.js:87–89`): a block that was itself changed and follows a new block starts on its own line. An untouched neighbour keeps the text around it.
4. Other commands still remove elements with their attributes when the element itself is what the command removes: bold/italic off, remove link. That is stated in the specification and not changed.

## RV-04: announcing what is switched off

**Correction.** (a) SVG animation elements are replaced by an invisible stand-in like scripts and are counted in the note (`src/js/project.js:21`, `:196`). (b) `style` elements in any namespace and SVG attributes that take CSS values are counted when they contain an address; `image-set()` counts as an address (`:22`, `:173`, `:206`). (c) A listener for the browser's policy-violation event in the frame (`src/js/app.js:824`) records the file name of each stopped address; if the editor's own list named nothing, the note says "Inhalte von außerhalb der Seite" while a recorded name occurs in the source text (`showInactive`, `:235`).

**Please check.**

1. (a) removes the reported case at its root: the address is no longer attempted. Are there other ways to assign an address after `safeAttrs()` has run? None is known to the implementer.
2. (c) is the general answer to "not announced": it does not depend on the list being complete. It depends on the browser raising the event in a frame without script permission (measured in Edge 157 only), and on the address being attempted at all.
3. The tie to the source text is a heuristic: the note stays as long as the last path segment of the stopped address, raw or percent-decoded, occurs in the text; segments shorter than three characters are ignored. An address spelled differently in the source would lose its note after the next render. Is that acceptable, or should the note simply stay until another document is opened?
4. The review recommended an allow-list for the page pane. This version keeps the deny-list. The trade-off is stated in [SECURITY.md](SECURITY.md) under residual risks.

## The tests

1. **T-05** expected the list item without the attributes of the paragraph, so it passed with the defect. The expectation now contains the attributes (`tests/browser/functional.mjs`, T-05).
2. **Explicit status of parts.** `Checks.skip()` (`tests/lib/harness.mjs`) records a part as `NOT MEASURED`; the runner prints and counts such parts per case. Used for the trusted paste in X-04, the file drop in T-15 (both were carried out in the recorded run) and the native pickers in T-16 and RV-01.
3. **A harness decision to look at.** `Editor.openFile()` sets the file input directly. In alpha.1 that replaced unsaved work without a question, because the question belonged to the Open button. Now every replacement asks, so `openFile()` answers the question with "Änderungen verwerfen" when it appears, like a pupil who agrees. Cases about the question itself pass `wait: false` and handle the dialog (T-15, RV-01).
4. `Editor.format()` waits for the outcome of "Code aufräumen" instead of a fixed pause, because formatting is asynchronous now.

## Where the implementer is least sure

* **The layout comparison is new and was tried on few documents:** the 44 snippets of R-01, the fixture of T-07, the samples of RV-02 and three exploratory documents (140,000 characters in about 0.6 s; a CSS animation; a grid). False refusals are possible where a page moves by itself in a way the added rule does not stop (`marquee`, an author rule with `!important` and higher specificity). A false refusal is the safe direction.
* **Images in the hidden frame** are awaited with `decode()`. An image that never settles would hold the check; the browser settles `data:` images quickly, other sources are not loaded at all.
* **The second list** after taking an item out of the middle is written by `emitNew()` from the attributes of the page pane, not from the source text, so the spelling of its attributes is normalized.
* **Everything already listed for alpha.1 and not touched:** one browser only; native file dialogs never executed; a download counts as saved; the browser produces the structure while typing; history grouping by time; German texts never tried with pupils; headless only.

## Not measured

Chrome; native open/save dialogs and write-back, also for the RV-01 schedules; visible-window runs; spell-check replacement, text drag in the source field, speech, handwriting, autofill; long sessions and memory growth; screen readers and keyboard-only operation of the page pane; printing; other operating systems.

## Delivery

1. `docs/reviews/REVIEW_0.1.0-alpha.2.md` in this folder, in English, on the branch `review/html-school-editor-0.1.0-alpha.2`, as a pull request stacked on the fix branch.
2. Per finding: corrected or not, with `file:line`, and what was not reviewed. New findings with the requirement concerned.
3. Overall verdict `PASS`, `HOLD` or `FAIL`. Findings about lost work and about the protective design come first.
4. Do not change the product on the fix branch. Corrections belong in the review document, or in a separate branch with a new version number.
5. Before pushing: the repository publication check with no findings, and the ancestry check from above.
