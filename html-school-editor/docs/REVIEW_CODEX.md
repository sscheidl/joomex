# Review request: HTML School Editor 0.1.0-alpha.1

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository.

This is a quality review of the owner's own software: an offline learning editor that pupils open as a single local file. The review is about correctness, about not losing a pupil's work, and about confirming that the editor's protective design works as documented. Nothing here is a review result; the implementer's own tests are not a review.

## What kind of review this is

* **Own code, own machine, offline.** Everything under review is in this folder. The product talks to no server and has no accounts, no network features and no users other than the pupil in front of it. No third-party system is involved or tested.
* **Checking safeguards that already exist.** The editor displays HTML documents that pupils open. Its design goal is that such a document is only displayed: its scripts do not run, its links are not followed, nothing is loaded from the network. The review asks whether this goal is met and whether the existing checks demonstrate it. The only material needed is ordinary HTML test documents for this editor.
* **The test documents are inert samples.** `tests/browser/security.mjs` builds HTML pages containing script elements, event attributes and addresses that point to a counting server on `127.0.0.1` started by the test run itself. Their only purpose is to show that the editor leaves all of it passive; a passing run means that nothing ran and the local counter stayed at zero.
* **Parts are independent.** The review has four parts (A–D below). If one part cannot be carried out for any reason, record it as `NOT REVIEWED` with the reason and complete the others. A partial review with clear limits is useful; a refused whole is not.

## State of the repository (read this before starting)

* **Location.** Folder `html-school-editor/` in this repository, branch `import/html-school-editor-0.1.0-alpha.1`, draft pull request 13, stacked on `release/pdf-book-1.0.0`. The product was developed in a stand-alone local repository on 2026-11-18 and imported with its commits; outside the folder only the root `README.md` changed (one row, one sentence).
* **History was rewritten on 2026-11-18.** On the owner's instruction, four branches were rewritten to replace a private commit address and were force-pushed: `review/pdf-book-0.1.0-alpha.18`, `review/pdf-book-0.1.0-alpha.19`, `release/pdf-book-1.0.0` and `import/html-school-editor-0.1.0-alpha.1`. File contents, messages and dates are unchanged; **the commit hashes of these branches are new**. Eleven annotated tags (`pdf-book-v0.1.0-alpha.9` to `alpha.19`) were recreated with the same targets.
* **Do not use anything created before that.** A clone, branch or worktree made earlier still has the old commits in its ancestry and must not be pushed. Start from a fresh fetch:

  ```bash
  git fetch --prune origin
  git fetch --tags --force origin
  git worktree add <new folder> -b review/html-school-editor-0.1.0-alpha.1 origin/import/html-school-editor-0.1.0-alpha.1
  ```

  Before the first commit, confirm the identity and the ancestry:

  ```bash
  git config user.email                                   # must be the GitHub noreply address
  git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
  ```

* **Not done and not to be assumed:** no merge, no release, no CI workflow. The pull request is a draft so that it can be reviewed.

## What is under review

| Area | Files |
| --- | --- |
| Product sources | `src/app.html`, `src/style.css`, `src/js/*.js` (11 modules, about 2,500 lines) |
| Build | `tools/build.mjs`, `package.json` |
| Delivered file | `dist/school-editor.html` (132,525 bytes, SHA-256 `ef9585a6…385079`, full value in [STATUS.md](STATUS.md)) |
| Tests | `tests/unit/core.test.mjs`, `tests/browser/{functional,security,robustness}.mjs`, `tests/lib/{cdp,harness}.mjs`, `tests/fixtures/*`, `tests/results/*.json` |
| Documents | `README.md`, `AGENTS.md`, `docs/*` |

Not a subject of this review: `docs/brief/*`, the task brief and acceptance contract that Codex wrote before the implementation. It is the yardstick: requirement and test identifiers (P-, S-, T-, X-, RF-) are defined in [brief/ACCEPTANCE.md](brief/ACCEPTANCE.md) and [brief/REFERENCE_FINDINGS.md](brief/REFERENCE_FINDINGS.md).

## Commands and what they printed for the implementer

Run in `html-school-editor/`; the last one from the repository root:

```bash
node tools/build.mjs --check            # up to date: dist/school-editor.html  132525 bytes  sha256 ef9585a6…
node --test tests/unit/*.test.mjs       # tests 13, pass 13, fail 0
node tests/run.mjs                      # edge: 26 passed, 0 not passed · chrome: NOT MEASURED (not installed)
python scripts/check_publication.py --denylist <private list>   # checked 326 files; deny-list terms: 47; findings: 0
```

Environment: Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 157.0.4341.60 headless, 2026-11-18. The browser suite needs about three minutes; it starts its own browser with a throw-away profile and a counting server on a random local port and leaves no process behind. A full run rewrites `tests/results/acceptance-*.json`; use `--no-write` for your own runs, or `--only T-09,X-03` for single cases.

## Part A: code and data integrity

Question: can a pupil lose or silently change work? Read the code against these stated properties and say for each whether it holds, with `file:line`.

1. **Edits from both panes never overwrite each other.** `state.visualDirty` and `state.pvRev !== state.rev` must not both be true when an edit is applied. Places: `src/js/app.js:702–720` (frame focus, pointer-down, `beforeinput`), `:788` (source focus), `:707` and `:794` (blur), `:239` `commitVisual`, `:648` `onSourceInput`. Is there an ordinary way to change the page or the text field without passing one of these? Not tried by the implementer: spell-check replacement, dragging text inside the source field, speech or handwriting input, autofill.
2. **Round trip.** Writing back a page that was not edited reproduces the text exactly. R-02 checks 2,128 generated documents with a small generator (`tests/browser/robustness.mjs`); other documents may behave differently.
3. **Local change.** An edit in the page changes only that place in the source. Deliberate exceptions are listed in [SPECIFICATION.md](SPECIFICATION.md) ("What stays untouched"). `rescueHidden()` (`src/js/serialize.js:243`) and the white-space handling in `emitText()` (`:124`) are the newest and least exercised code.
4. **Source positions are only used where the editor's own parse equals the browser's.** `matchKids()` (`src/js/project.js:98`) compares element names, order and text, not attributes and not comment text. Could two different parses agree on those and still yield a wrong source range? The tolerance for white space after `</body>` (`isTail`) is a hand-made rule.
5. **Formatting changes white space only.** Checked on every use in `formatDoc()` (`src/js/app.js:470`) by comparing canonical forms (`canonDom`, `src/js/project.js:390`). The canonical form treats white space next to block elements and `<br>` as insignificant, which assumes default display types.
6. **Saving.** A document counts as saved only after a completed write or a started download (`src/js/app.js:597–638`); an operation that finishes for a previous document must not mark the current one (`markSaved`, `:580`).

## Part B: function against the acceptance contract

Run the suite and judge whether each case really shows what its title says: are the expectations independent of the implementation, are the inputs real, are there cases that would pass even if the product were wrong? The mapping requirement → code → test → result is in [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md).

Tests that use a stand-in or work below the single file:

| Test | What is not real |
| --- | --- |
| T-10 (third and fourth part), T-15 (last part) | file handle and save dialog are replaced by a recording object |
| T-10 (second part), T-15, T-16 | the file access API is hidden before the page starts, to reach the download path |
| X-04 (parts 2–4) | paste and drop events are constructed by the test; part 1 uses the real clipboard and a real key event |
| R-02 | runs `src/js/project.js` and `src/js/serialize.js` in a test page served from localhost |
| T-03, T-04 and others | caret and selection are often set through the DOM selection API before real keys are sent; real mouse clicks are used in T-01, T-03, T-11, T-14, X-01, X-02 |

## Part C: protective design

Question: does the editor keep opened documents passive, as [SECURITY.md](SECURITY.md) describes, and do the checks X-01 to X-07 demonstrate that for the delivered file? This is a check of documented safeguards against the requirements S-01 to S-04 and S-09.

Please assess:

1. **Completeness of the display filter.** The editor builds the page view node by node and leaves out or neutralizes certain elements and attributes (`DROP`, `BOX`, `DROP_ATTRS` in `src/js/project.js:14–19`, `describe()` at `:178`, `safeAttrs()` at `:150`). It lists what to leave out rather than what to allow, so that unknown harmless elements still render. Is anything missing from the lists that the HTML standard would let load a resource or run code? Would an allow-list be the better design for a classroom tool?
2. **The two browser safeguards.** The frame attribute `sandbox="allow-same-origin"` (`src/app.html`) and the two content security policies (`tools/build.mjs`, `src/js/app.js:30`). Are they stated correctly and do they cover what the filter does not? Only their combination was measured, not each alone.
3. **What the editor writes into files.** New elements come from a fixed list and addresses are checked (`emitNew()`, `src/js/serialize.js:179`; `checkLinkUrl()`, `src/js/util.js:51`). Is text entered in the link and image dialogs always stored as plain text?
4. **Evidence.** X-03 distinguishes between requests the browser reports as attempted, requests stopped by the policy, and requests that reach the local counter, and includes a control page. Is that reasoning sound? Does the static scan X-06 match the measured behaviour?
5. **Robustness of reading parsed documents.** Form controls named like DOM properties are handled through original accessors (`src/js/project.js:26–42`, X-07), nesting depth is bounded (`src/js/tree.js:26`), and a failed analysis falls back to a read-only page (`src/js/app.js:201`).

Findings in this part should name the requirement that is not met and the place in the code. Example documents that show a gap are welcome as ordinary test fixtures for this editor.

## Part D: origin of the code

The implementer read parts of a third-party reference editor (ranges in [SPECIFICATION.md](SPECIFICATION.md#3-origin)) and states that all code here was written new. The implementer cannot prove the absence of similarity. A reviewer with access to the owner's private analysis case can compare samples. In this repository the reference is named only by the aliases `[REFERENCE-APP]` and `[REFERENCE-NOTES]`; keep it that way in the review document.

## Where the implementer is least sure

* **Measured in one browser only.** Frame and policy behaviour for a page opened from `file://`, `contenteditable` behaviour, the CSS Custom Highlight API and clipboard handling were observed in Edge 157 only.
* **Native file dialogs.** `showOpenFilePicker`, `showSaveFilePicker` and `createWritable` were never executed for real. If the save dialog fails with anything other than a cancellation, the code downloads instead (`src/js/app.js:618–627`); whether that suits every real error is untested.
* **A download counts as saved** (`downloadDoc`, `src/js/app.js:602`). The browser may still ask, block or fail later. The alternative, never to mark a download as saved, would warn pupils on every close.
* **The browser produces the page structure while typing.** Enter, Backspace, deletion and joining paragraphs are native. The writer normalizes what was seen in exploratory runs. Other content, for example in tables or nested lists, may produce other structures.
* **`same()` in `emitText`** treats "ordinary space became no-break space" as unchanged, because the browser does that on its own near the caret.
* **History groups typing by time**, so selecting everything and typing right after other typing is one undo step.
* **German texts and read-only notes** were written without trying them with pupils.
* **Headless only.** No run with a visible window, a touch screen or a small display.

## Not measured

Chrome; native open/save dialogs and write-back; visible-window runs; long sessions and memory growth; documents above about 150,000 characters in interactive use; screen readers and keyboard-only operation of the page pane; printing; other operating systems.

## Delivery

1. `docs/reviews/REVIEW_0.1.0-alpha.1.md` in this folder, in English, on the branch `review/html-school-editor-0.1.0-alpha.1`, as a pull request stacked on the import branch.
2. Per part: verdict, findings with `file:line` and the requirement concerned, and what was not reviewed.
3. Overall verdict `PASS`, `HOLD` or `FAIL`. Findings about lost work and about the protective design come first.
4. Do not change the product on the import branch. Corrections belong in the review document, or in a separate branch with a new version number.
5. Before pushing: the repository publication check with no findings, and the ancestry check from above.
