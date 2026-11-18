# Status

**Version:** 0.1.0-alpha.1 · **Date:** 2026-11-18 · **Branch:** `feature/alpha-1` (local, not pushed)

## Verdict: HOLD

Every functional, data-integrity and security check that could be measured on the development machine passes. The product is not released, because three things are still open:

1. **Chrome is NOT MEASURED.** Chrome is not installed on the test machine. All measurements are from Microsoft Edge.
2. **Native file dialogs are NOT MEASURED.** The browser's open/save pickers and writing back to a real file handle cannot be driven by the test harness. The code paths behind them are covered with a labelled mock handle (T-10, T-15) and with the real download fallback (T-10, T-16). A person has to try Open and Save once in Edge and once in Chrome.
3. **The independent review has not happened.** The implementer's tests are not a review. See [REVIEW_CODEX.md](REVIEW_CODEX.md).

There is no known failing check and no known rights problem in the delivered file.

## Artefact

| | |
| --- | --- |
| File | `dist/school-editor.html` |
| Size | **132,438 bytes** (limit 200,000) — complete: HTML, CSS, script, no other file |
| SHA-256 | `5453d49ec893fb5ebb1e1d55391c3d51353df0b92126076d8945821e55a0ca55` |
| Build | `node tools/build.mjs`; `node tools/build.mjs --check` reproduces the file byte for byte |

The size and hash are those of the run recorded in `tests/results/acceptance-edge.json`. If the sources change, rebuild and re-run; `--check` and the result file state the current values.

## Measurements

MEASURED 2026-11-18 · Windows 11 Pro (10.0.26300) · Node v24.22.1.

| Suite | Environment | Result |
| --- | --- | --- |
| Unit tests (`node --test tests/unit/*.test.mjs`) | Node | 13 of 13 pass |
| Acceptance T-01…T-17, X-01…X-07 | Edge 157.0.4341.60, headless, artefact from `file://` | 24 of 24 cases pass |
| Robustness R-01, R-02 | same | 2 of 2 pass (R-02 runs the source modules in a test page, not the single file) |
| All of the above | Chrome | **NOT MEASURED** (not installed) |
| Publication check with the private deny-list | — | 0 findings |

In total 242 individual checks in Edge. Per-check results: [`tests/results/acceptance-edge.json`](../tests/results/acceptance-edge.json). Summary with code references: [ACCEPTANCE_RESULTS.md](ACCEPTANCE_RESULTS.md).

## Dependencies and licences

| Component | Version | Licence | In the delivered file |
| --- | --- | --- | --- |
| Own code | 0.1.0-alpha.1 | MIT ([LICENSE](../LICENSE)) | yes, everything |
| Runtime libraries | — | — | none |
| Build and test tools | Node.js standard library only | — | no |
| Fonts, icons, images | — | — | none (system fonts, text labels) |

The reference editor that was studied is not a dependency. No part of it is contained in this repository. See [SPECIFICATION.md](SPECIFICATION.md#3-origin) for what was read and for the limits of that statement. Whether the reference may be reused is irrelevant for this artefact, because nothing of it is reused; the question would return only if someone wanted to copy a passage from it later.

## Open points

| # | Point | Kind |
| --- | --- | --- |
| 1 | Run the suite in Chrome | measurement |
| 2 | Try native Open, Save (write-back with the permission question) and Save-as by hand in Edge and Chrome | measurement |
| 3 | Independent review | process |
| 4 | Trial with pupils: are the German texts and the read-only notes understood? | usability, not measured |
| 5 | Images referenced by file name are not shown in the editor | limitation, by design in this version |
| 6 | The page pane renders in standards mode also for documents without doctype | limitation |
| 7 | Existing links and images can only be changed in the source | limitation |
| 8 | Headed (visible window) run and other screen sizes were not part of the measured runs | measurement |

## Defects found and fixed during development

Each has a regression check. The first acceptance run on 2026-11-18 passed 16 of 23 cases; four of the seven failures were wrong expectations in the tests, the others are items 1–3 below. Items 4–9 were found by exploratory scripts and by the corpus tests, not by the numbered cases.

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

Hand over to the independent review. After it: Chrome run, manual check of the native dialogs, then a decision about a release. No push, pull request or release has been made.
