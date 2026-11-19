# Status

**Version:** 0.1.0-alpha.2 · **Date:** 2026-11-19 · **Location:** `html-school-editor/` in this repository, branch `fix/html-school-editor-0.1.0-alpha.2`

## Verdict: HOLD

Version 0.1.0-alpha.1 was reviewed independently and **failed**: [reviews/REVIEW_0.1.0-alpha.1.md](reviews/REVIEW_0.1.0-alpha.1.md), four findings RV-01 to RV-04. This version corrects them. The corrections were made and tested by the implementer and have not been reviewed; the implementer's tests are not a review.

Open before a release:

1. **The re-review has not happened.** See [REVIEW_CODEX.md](REVIEW_CODEX.md).
2. **Chrome is NOT MEASURED.** Chrome is not installed on the test machine. All measurements are from Microsoft Edge.
3. **Native file dialogs are NOT MEASURED.** The browser's open/save pickers and writing back to a real file handle cannot be driven by the test harness. The code paths behind them are covered with a labelled mock handle (T-10, T-15), with the file input and the file chooser (T-15, RV-01) and with the real download fallback (T-10, T-16). A person has to try Open and Save once in Edge and once in Chrome.
4. **No visible-window session and no trial with pupils or teachers.**

There is no known failing check and no known rights problem in the delivered file.

## Review findings of alpha.1 and their corrections

| Finding | Correction in alpha.2 | Code | Regression |
| --- | --- | --- | --- |
| **RV-01** (high): a file read that finishes late replaces newer work and erases its undo history | Every operation that replaces the document takes a ticket. Only the newest ticket can complete, and only for the document state whose loss the pupil accepted; if the text changed meanwhile, the editor asks again. The ticket is taken before the file chooser opens. New cancels a pending read | `src/js/app.js:587–611`, `:613`, `:650`, `:724`, `:872` | RV-01 (6 schedules), T-15 |
| **RV-02** (high): the formatter's check accepts visible changes | Formatting is applied only if (1) no style rule can make spaces count, judged after resolving CSS comments and escapes and for any value outside the collapsing ones, (2) both texts parse to the same document, (3) both texts are laid out identically in a hidden copy of the page pane. Documents with a style sheet file are not formatted | `src/js/app.js:484`, `:523`; `src/js/project.js:443`, `:471` | RV-02 (11 refused, 3 applied and compared in an ordinary page), T-07 |
| **RV-03** (medium): creating a list deletes paragraph attributes | List commands rename the element and keep its start tag as written, in both directions; a list or item that cannot keep its role keeps its attributes on a `div` | `src/js/commands.js:96`, `:150`, `:186`; `src/js/serialize.js:238` | RV-03, T-05 |
| **RV-04** (medium): a resource stopped by the policy is not announced | SVG animation elements are no longer shown and are named in the note. Whatever the browser's policy stops is announced even if the editor's own list did not name it | `src/js/project.js:21`, `:196`; `src/js/app.js:235`, `:824` | RV-04 (6 samples) |

Changed along the way:

* **Formatting and stale results.** The layout comparison makes formatting asynchronous. Its result is dropped if the text changed while it ran, and a second click during the check is ignored (same class of defect as RV-01; RV-02 checks it with a timing seam).
* **A defect of the first correction, found by an exploratory script before this version was built:** taking the first item out of a list moved the remaining items into a copy of the list, which lost the `id`. Now the original list element continues (RV-03).
* **T-05 contained the defect.** Its expected text for alpha.1 had the list item without the attributes of the paragraph. The expectation was corrected.
* **Parts that could not be measured are explicit.** The result file and the console output list them as `NOT MEASURED` per case instead of a note inside a passed case (review part B).
* **Wording of the note:** an address inside CSS is now called "Adresse im CSS" instead of "externe CSS-Datei".
* **Two assurances were too strong** and were rewritten: that conflicting edits in both panes are impossible ([ARCHITECTURE.md](ARCHITECTURE.md)), and that projection, sandbox and policy are independent layers ([SECURITY.md](SECURITY.md)).

Not changed, although the review discusses it: the page pane still uses a list of what is left out, not a list of what is allowed (see SECURITY.md, residual risks).

## Artefact

| | |
| --- | --- |
| File | `dist/school-editor.html` |
| Size | **143,858 bytes** (limit 200,000) — complete: HTML, CSS, script, no other file |
| SHA-256 | `091f5167cc0a24432c6246cbb62af9ff3defd6c5ac08d31673ee51f78ed5ac49` |
| Build | `node tools/build.mjs`; `node tools/build.mjs --check` reproduces the file byte for byte |

The size and hash are those of the run recorded in `tests/results/acceptance-edge.json`. If the sources change, rebuild and re-run; `--check` and the result file state the current values. Version 0.1.0-alpha.1 had 132,525 bytes.

## Measurements

MEASURED 2026-11-19 · Windows 11 Pro (10.0.26300) · Node v24.22.1.

| Suite | Environment | Result |
| --- | --- | --- |
| Unit tests (`node --test tests/unit/*.test.mjs`) | Node | 13 of 13 pass |
| Acceptance T-01…T-17, X-01…X-07 | Edge 157.0.4341.60, headless, artefact from `file://` | 24 of 24 cases pass |
| Robustness R-01, R-02 | same | 2 of 2 pass (R-02 runs the source modules in a test page, not the single file) |
| Regressions for the review findings RV-01…RV-04 | same | 4 of 4 pass |
| All of the above | Chrome | **NOT MEASURED** (not installed) |
| Reviewer's probe script `docs/reviews/review-alpha1.mjs`, unchanged, against this version | Edge 157.0.4341.60 | stops in its first probe with a timeout: it waits for the late file to be opened, which no longer happens. Its other probes do not run in that script; their inputs are part of RV-02 to RV-04 |
| Repository publication check (`scripts/check_publication.py`) with the private deny-list | whole repository, 331 files | 0 findings |

In total 341 individual checks in Edge and 2 parts NOT MEASURED (native file pickers, in T-16 and RV-01). Per-check results: [`tests/results/acceptance-edge.json`](../tests/results/acceptance-edge.json). Summary with code references: [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md).

## Dependencies and licences

| Component | Version | Licence | In the delivered file |
| --- | --- | --- | --- |
| Own code | 0.1.0-alpha.2 | MIT ([LICENSE](../LICENSE)) | yes, everything |
| Runtime libraries | — | — | none |
| Build and test tools | Node.js standard library only | — | no |
| Fonts, icons, images | — | — | none (system fonts, text labels) |

The reference editor that was studied is not a dependency. No part of it is contained in this folder. See [SPECIFICATION.md](SPECIFICATION.md#3-origin) for what was read and for the limits of that statement. The independent review compared samples and found no substantial copied implementation within its sampled scope; it is not a certification for every line.

## Open points

| # | Point | Kind |
| --- | --- | --- |
| 1 | Independent re-review of alpha.2 | process |
| 2 | Run the suite in Chrome | measurement |
| 3 | Try native Open, Save (write-back with the permission question) and Save-as by hand in Edge and Chrome | measurement |
| 4 | Visible-window session; input routes that were never tried: spell-check replacement in the page, dragging text inside the source field, speech and handwriting input, autofill | measurement |
| 5 | Trial with pupils and a teacher: are the German texts, the questions and the read-only notes understood? | usability, not measured |
| 6 | "Code aufräumen" is refused for documents with an external style sheet, and its layout comparison sees one pane width only | limitation, by design in this version |
| 7 | The page pane decides by a list of what is left out; the review recommends a list of what is allowed | design decision for a later version |
| 8 | Images referenced by file name are not shown in the editor | limitation, by design in this version |
| 9 | The page pane renders in standards mode also for documents without doctype | limitation |
| 10 | Existing links and images can only be changed in the source | limitation |

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

Hand over to the independent re-review. After it: Chrome run, manual check of the native dialogs, a visible-window session, then a decision about a release. Nothing is merged and there is no release.
