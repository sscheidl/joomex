# Hand-over for the independent review

Implementer: Claude Code. Reviewer: Codex. This file says what exists, what the implementer claims, how to re-run it, and where the implementer is least sure. Nothing here is a review result.

## Scope of this change

New repository, branch `feature/alpha-1`, two commits on top of an initial licence commit. Everything is new:

| Area | Files |
| --- | --- |
| Product sources | `src/app.html`, `src/style.css`, `src/js/*.js` (11 modules, about 2,500 lines) |
| Build and hygiene | `tools/build.mjs`, `tools/check_publication.mjs`, `package.json` |
| Delivered file | `dist/school-editor.html` (132,438 bytes, SHA-256 `5453d49e…a0ca55`, full value in [STATUS.md](STATUS.md)) |
| Tests | `tests/unit/core.test.mjs`, `tests/browser/{functional,security,robustness}.mjs`, `tests/lib/{cdp,harness}.mjs`, `tests/fixtures/*`, `tests/results/*.json` |
| Documents | `README.md`, `AGENTS.md`, `docs/*` |

Not done and not to be assumed: no push, no remote repository, no pull request, no release, no CI workflow.

## Commands and what they printed

```bash
node tools/build.mjs --check            # up to date: dist/school-editor.html  132438 bytes  sha256 5453d49e…
node --test tests/unit/*.test.mjs       # tests 13, pass 13, fail 0
node tests/run.mjs                      # edge: 26 passed, 0 not passed · chrome: NOT MEASURED (not installed)
node tools/check_publication.mjs --denylist <private list>   # 0 finding(s)
```

Environment of these runs: Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 157.0.4341.60 headless, 2026-11-18. The browser suite needs about three minutes; T-11 and R-01 take most of it.

## Invariants worth attacking

1. **No stale overwrite, no lost keystroke.** `state.visualDirty` and `state.pvRev !== state.rev` must never both be true when an edit is applied. Entry points: `src/js/app.js:702–720` (frame focus, pointer-down, `beforeinput`), `:788` (source focus), `:707` and `:794` (blur), `:239` `commitVisual`, `:648` `onSourceInput`. Is there a way to change the frame DOM or the text field without passing one of these? Candidates the implementer did not test: browser spell-check replacement, drag of text inside the source field while the frame holds pending input, speech or handwriting input, browser extensions, autofill.
2. **Identity.** Writing back an unedited preview reproduces `state.text` exactly. R-02 checks 2,128 generated documents; the generator is small (`tests/browser/robustness.mjs`). A different generator or real pupil pages may find a counterexample.
3. **Locality.** A visual edit changes only the edited place. Rules that deliberately touch more are listed in [SPECIFICATION.md](SPECIFICATION.md) ("What stays untouched"). `rescueHidden()` (`src/js/serialize.js:243`) and the white-space handling in `emitText()` (`:124`) are the newest and least exercised code.
4. **The position tree is only trusted where it matches the browser.** `matchKids()` (`src/js/project.js:98`) compares names, order and text, not attributes and not comment text. Could two different parses agree on those and still give a wrong source range? The tolerance for white space behind `</body>` (`isTail`) is a hand-made rule.
5. **Nothing of an opened document executes or loads.** Layers in [SECURITY.md](SECURITY.md). The projection is a deny-list for elements and attributes (`DROP`, `BOX`, `DROP_ATTRS` in `src/js/project.js:14–19`) backed by sandbox and policy. A reviewer may prefer an allow-list; the implementer kept the deny-list so that unknown harmless elements still render.
6. **Formatter changes white space only and never changes the parsed document.** Verified per run in `formatDoc()` (`src/js/app.js:470`) by comparing canonical forms (`canonDom`, `src/js/project.js:390`). The canonical form ignores white space next to block boundaries and `<br>`; that is a rendering assumption about default display types.

## Where the implementer is least sure

* **Measured in one browser only.** Sandbox and policy inheritance for `srcdoc` frames under `file://`, `contenteditable` behaviour, the CSS Custom Highlight API and clipboard handling were observed in Edge 157 only.
* **Native file dialogs.** `showOpenFilePicker`, `showSaveFilePicker` and `createWritable` were never executed for real. If the save picker throws anything other than `AbortError`, the code downloads instead (`src/js/app.js:618–627`); whether that is the right reaction to every real error is untested.
* **A download counts as saved** (`downloadDoc`, `src/js/app.js:602`). The browser may still ask, block or fail later. The alternative (never mark a download as saved) would warn pupils on every close.
* **Browser editing produces the DOM.** Typing, Enter, Backspace, deletion and joins are native. The writer normalizes what was seen in exploratory runs (new paragraphs, `<br>` placeholders, wrappers, no-break spaces). Other constructs may appear with other content, for example inside tables or nested lists.
* **`same()` in `emitText`** treats "old ordinary space, new no-break space" as unchanged. If a pupil really replaces a space by a no-break space in the page (not possible by keyboard in normal use), the source keeps the ordinary space.
* **History groups typing by time**, so selecting everything and typing right after other typing is one undo step.
* **Read-only notes and all German texts** were written without testing them with pupils.
* **Headless only.** No run with a visible window, a touch screen or a small display.

## Tests that use a mock or work below the single file

| Test | What is not real |
| --- | --- |
| T-10 (third and fourth part), T-15 (last part) | file handle and save picker are replaced by a recording object |
| T-10 (second part), T-15, T-16 | the file access API is hidden before the page starts, to reach the fallback paths |
| X-04 (parts 2–4) | paste and drop events are constructed by the test; part 1 uses the real clipboard and a trusted key event |
| R-02 | runs `src/js/project.js` and `src/js/serialize.js` in a test page served from localhost |
| T-03, T-04 and others | caret and selection are often set through the DOM selection API before real keys are sent; real mouse clicks are used in T-01, T-03, T-11, T-14, X-01, X-02 |

## Not measured

Chrome; native open/save dialogs and write-back; visible-window runs; long sessions and memory growth; documents above about 150,000 characters in interactive use; screen readers and keyboard-only operation of the page pane; printing; other operating systems.

## Rights

The implementer read parts of the reference editor's source (ranges listed in [SPECIFICATION.md](SPECIFICATION.md#3-origin)) and wrote all code here new. The implementer cannot prove the absence of similarity; a reviewer with access to the private case can compare. The publication check found none of the private deny-list terms.
