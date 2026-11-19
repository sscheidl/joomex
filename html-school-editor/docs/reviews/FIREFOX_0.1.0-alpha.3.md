# Firefox compatibility measurement: 0.1.0-alpha.3

**Verdict: FAIL for complete acceptance; basic operation is confirmed.** The installed stock Firefox **160.0.1** starts the unchanged editor from `file://`, works offline, edits both panes, imports files and produces real downloads. Normal list, link, image and alignment cases pass. Additional source-preservation differences and an unnecessarily refused formatting example prevent an unrestricted compatibility claim. The general alpha.3 review verdict also remains FAIL.

MEASURED **2026-11-19**, Windows 11 (`Windows_NT 10.0.26300`), Node `v24.22.1`, Firefox `160.0.1`, headless, fresh disposable profile. Browser networking was available for resource-protection cases; T-01 separately uses Firefox's actual offline emulation. The installed browser and its standard WebDriver BiDi protocol were used, without downloading a replacement browser, installing a driver or opening a normal user profile.

Artefact: `dist/school-editor.html`, **160,302 bytes**, SHA-256 `2c85f25d11fe0d1207f3e7655334dcbdd6f7b058dad66e0c6a9c9aeb09629244`. The measured application is the same alpha.3 artefact as the Edge review; no product source or distributable was changed.

## Results

The runner imports the existing acceptance cases. Including one additional Firefox startup control, **34 cases** were attempted:

| Outcome | Cases |
| --- | --- |
| PASS | 25 |
| Failed existing expectations | 4: T-03, T-07, R-01, R-02 |
| PARTIAL: measured assertions, then an unsupported automation command | 4: T-12, T-15, RV-01, RV-02 |
| NOT MEASURED | 1: X-04 |
| Harness/runtime errors in the completed run | 0 |

**380 assertions were measured; six failed and 374 passed.** A failed existing expectation is not automatically a distinct product defect: T-03 is a native word-selection difference, while the source-preservation cases below have concrete source/output evidence. PARTIAL is not reported as PASS. Native-file and other skipped subparts remain explicit even inside a passing case.

The existing 33 cases alone therefore have 24 PASS, four FAIL, four PARTIAL and one NOT MEASURED. The additional `FF-START` control accounts for the 25th PASS and five assertions.

### What works in the measured samples

* Fresh offline local-file launch and actual typing in both views (T-01); German umlauts, rapid pane alternation, selection/focus basics, history and malformed/oversize-file handling (T-02, T-10, T-11, T-13, T-14).
* Supported UTF-8/BOM/line-ending import/download round trips and local visual edits preserving the tested document envelope (T-08, T-09).
* Paragraph/headings, emphasis, lists, link/image dialogs, file-name pictures, optional alt, width and alignment (T-04–T-06, F-01–F-03). No implicit read of neighbouring images was observed in F-01.
* Real Save/download fallback, including final pending input (T-10, T-16). `showSaveFilePicker` is absent in Firefox; saving produces a download rather than directly writing back through that API. Native OS dialogs were not automated.
* In the supplied script/navigation/resource samples, no script marker, parent mutation, navigation escape, popup or resource delivery to the controlled counter was observed (X-01–X-03). The counter's ordinary-page control did fetch, so networking was available. X-05–X-07 and RV-03/RV-04 pass within their recorded scope.

Firefox reported **zero `network.beforeRequestSent` events for the CSP-blocked CSS addresses**, and the additional parent-installed observer recorded **18 real frame policy-violation events** in X-03. Zero counter hits, request events and policy events are separate observations; they are not interchangeable counts. This supplements the earlier Edge result rather than claiming all possible resource mechanisms are proven safe.

## Differences requiring attention

### FF-01: typing beside a comment changes another text run's whitespace

**Requirements:** S-05; R-01's local-change oracle. Relevant code: `src/js/serialize.js:129`–`:180`, `src/js/app.js:251`.

An independent delivered-file probe opens:

```html
<p>Text <!-- comment --> weiter.</p>
```

Put the caret immediately after `Text`, type `Q`, then download. Expected local change:

```html
<p>TextQ <!-- comment --> weiter.</p>
```

**Actual downloaded bytes contain:**

```html
<p>TextQ <!-- comment -->weiter.</p>
```

The space in the text node after the comment disappears, although the keystroke was before the comment. The comment itself is retained. With ordinary collapsing whitespace this particular example still has a visible gap from the preceding space; it is **not evidence that an entire word or document was lost**. It does disprove exact preservation of the other text run. The existing R-01 corpus independently reports this kind of comment-adjacent change and a removed newline after an unknown element: 92 edits, 89 exact, one classified as whitespace-only, two outside its allowed local-change oracle.

Firefox's native editing normalizations need coverage in the serializer before making the same S-05 promise for this browser. Do not simply weaken preservation expectations to obtain a passing test.

### FF-02: a no-edit module round trip can wrap an unmapped line break

**Requirements:** S-05; R-02 identity. Relevant code: `src/js/project.js:247`, `:319`; `src/js/serialize.js:65`–`:83`, `:292`.

In a controlled module page, analyze/project/serialize the incomplete synthetic document:

```html
<br/><!-- unfinished
```

The analysis says it is mapped/editable, but Firefox's resulting preview `BR` has no source mapping in the WeakMap. Serializing **without an edit** yields:

```html
<p><br></p><!-- unfinished
```

Ordinary paragraph and closed-comment controls round-trip exactly. R-02 also fails its generated-document identity and no-change-on-rerender assertions; the 984 collected append-character checks pass. Its failure examples are capped, so this evidence does not establish the total number of affected generated inputs.

This is explicitly **module-level evidence**, not a claim that opening and immediately downloading every incomplete file rewrites it. The actual application keeps original source until a visual commit; T-08 real no-edit downloads pass. The projection/serialization invariant nevertheless needs to handle Firefox's editable-DOM behavior or disable visual editing of affected structures.

### FF-03: the normal formatter fixture is refused

**Requirement:** P-04/T-07's expected formatting operation. Relevant code: `src/js/app.js:557`–`:580`, `:596`–`:625`; `src/js/project.js:481`.

`tests/fixtures/format-in.html` is not formatted. The editor says its appearance would change and retains the original source. This fails T-07's apply-and-match-handwritten-output assertions, while preserving the pupil's work in the safe direction.

An independent ordinary-page comparison of the original fixture and `format-expected.html`, with scripts blocked by a response CSP and **the viewport set to the editor pane's measured dimensions**, finds identical element/rendered-text geometry. This supports an overly conservative comparison for this fixture; it does not prove layout equivalence for every condition or identify the exact internal cause. Investigate the geometry-print treatment of unrendered whitespace and browser-specific range boxes without weakening the guard against real visible changes. R-01 formats 39 corpus inputs and refuses three; Edge previously formatted 42 and refused none.

### T-03: native word selection differs from the Edge-specific expectation

A real native double-click is verified to generate click counts 1 and 2 and a `dblclick` event. Firefox selects `beides `, including its trailing space. The selection starts at the end of a preceding text node and ends in the following text node. The editor's highlighted source range is `<i>beides</i></b> `, whereas the existing test expects the range to start with `beides`.

The other seven T-03 assertions pass, including the intended pane/next input and repeated-text targeting. This measurement **does not demonstrate a wrong-word edit or focus loss**. If Firefox becomes a supported target, define a browser-neutral selection expectation or normalize boundary-only range positions deliberately. Preserve the failed current expectation in the evidence.

## Explicit measurement gaps

| Case | Measured part and missing part |
| --- | --- |
| T-12 PARTIAL | Nine assertions for the long document, input, caret, scroll and selection pass. CDP's IME injection command has no implemented BiDi equivalent here; real IME/composition remains unmeasured. |
| T-15 PARTIAL | Seven discard/cancel/refusal assertions pass. The Chromium file-chooser interception stops the case before its remaining chooser/drop and mock stale-save scenarios. This is a driver gap, not proof that Firefox has no file-open dialog. |
| RV-01 PARTIAL | The first New-during-delayed-read schedule passes six assertions. The next chooser-interception step is unsupported; the remaining five schedules are not claimed as Firefox measurements. |
| RV-02 PARTIAL | The refusal cases and start of the first accepted case produce 35 passing assertions. The original test then asks for a Chromium scripting-disable command. Its remaining rendering and stale-layout schedules are not claimed; the separate CSP-protected diagnostic provides only the specific formatting control above. |
| X-04 NOT MEASURED | A Firefox control shows that a constructed `DataTransfer` holds the supplied text but a constructed `ClipboardEvent` discards that supplied `clipboardData`. Reusing the Chromium synthetic-paste fixture would therefore produce a false product failure. Trusted system-clipboard automation was not implemented. Real rich/plain clipboard paste and that case's remaining drop assertions are not claimed. |
| T-16 native subpart | The actual download fallback passes; native OS file dialogs and handle write-back are still unmeasured. |

Visible-window use, touch, screen readers, printing, other Firefox versions, long sessions and pupil trials are also NOT MEASURED. Headless trusted input is not a usability trial.

## Test tooling and reproducibility

Commands, from `html-school-editor/`, sequentially:

```text
node tests/run-firefox.mjs
node tests/firefox-diagnostics.mjs
node tools/build.mjs --check
node --test tests/unit/*.test.mjs
```

The full Firefox command exits **1**, retaining failed assertions. The diagnostics command records observations rather than certifying acceptance. Build verification and all **19 unit tests pass**; the original artefact hash remains unchanged.

Use `--only T-02,F-01` for selected cases or `--no-write` for another console-only run. Both options leave the recorded full-run JSON untouched.

The standard-library BiDi adapter is [firefox.mjs](../../tests/lib/firefox.mjs); the runner is [run-firefox.mjs](../../tests/run-firefox.mjs). Existing case bodies and shared helpers were not edited. The Firefox runner explicitly overrides two fixture-setup waits: completed file-open status rather than an already-matching basename, and a decoded-image label rather than the existing `Jetzt: filename` label. Those changes correct test synchronization only and do not delay or suppress actual pupil-facing product input. Without them, reselecting a same-named image can be asserted before decoding finishes. The runner records unsupported automation as a gap rather than fabricating success.

The adapter batches pointer actions to produce actual double-clicks, matches downloads by Firefox's download IDs/completion events rather than taking an older file, and maps genuine BiDi network/log events into the existing helper's event shape. CSP observations come from a parent-installed listener on the real preview's `securitypolicyviolation` events. No resource request is intercepted or blocked by the test driver in the online protection cases. Exploratory adapter runs were corrected with isolated controls before the final full run; their preliminary totals are not acceptance evidence.

Evidence: [per-assertion results](../../tests/results/review-alpha3-firefox.json), [full console transcript](../../tests/results/review-alpha3-firefox.txt), [independent controls](../../tests/results/review-alpha3-firefox-diagnostics.json), [control script](../../tests/firefox-diagnostics.mjs). These are new Firefox files; previous Edge and alpha.1/alpha.3 evidence is unchanged. No runtime dependency or Firefox-related code is added to the pupil's distributable.

**Practical conclusion:** Firefox is usable for the measured basic operations, including offline use and download saving. Do not describe alpha.3 as fully Firefox-compatible or classroom-approved. Address source preservation and formatter behavior, complete the missing native-input/clipboard/chooser measurements, and retain the separate alpha.3 findings already documented in the main review.
