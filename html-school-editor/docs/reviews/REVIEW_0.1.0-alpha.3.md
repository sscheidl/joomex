# Independent review: HTML School Editor 0.1.0-alpha.3

**Overall verdict: FAIL.** The original late-HTML-open data loss and list-attribute examples are corrected. The original formatting and SVG-notice examples are also corrected, but their broader requirements still fail on additional ordinary documents. New alpha.3 functions can alter unrelated CSS, select a file from a cancelled image dialog, and mispatch malformed/duplicate attributes. No script execution, navigation escape or delivered external resource request was observed in the completed protection tests.

Reviewed by Codex on **2026-11-19** at `c3d377062b6aeac56215b27e33eb2c47d5cf372c`. This is one combined review of the changes introduced by alpha.2 (`9438803589a60cb1adedc65d64358692ad59d41c`) and alpha.3. Diffs were inspected separately: review alpha.1 → fix alpha.2, then fix alpha.2 → feature alpha.3. Runtime measurements below use the final alpha.3 artefact; the historical alpha.2 artefact was not separately executed. Product files and previous review evidence are unchanged by this PR.

## Disposition of the four previous findings

| Finding | Disposition | Evidence and code in alpha.3 |
| --- | --- | --- |
| RV-01: late HTML file read | **CORRECTED for the reported defect.** | `src/js/app.js:660`, `:664`, `:680`, `:686`, `:723`, `:797`, `:957`: operation tickets, revision/document consent and a final replacement gate. All six RV-01 schedules and 19 assertions pass. A late image-dialog completion is a separate defect, A3-04 below. |
| RV-02: formatting under author CSS | **PARTIALLY CORRECTED.** Original examples now refused, but S-05/T-07 still fail at another width. | `src/js/project.js:453`, `:481`; `src/js/app.js:557`, `:596`. CSS scanning and layout comparison address the original comment/pre and unconditional-inline cases. A3-03 demonstrates the remaining conditional-layout problem. |
| RV-03: attributes in list commands | **CORRECTED within the documented conversion policy.** | `src/js/commands.js:96`, `:158`, `:194`; `src/js/serialize.js:220`, `:240`, `:262`. Exact source and parsed split-list expectations pass (10 assertions), including the original sample, attributed blocks, original quote spelling, inactive handler retention on the original element and undo. |
| RV-04: missing inactive-content indication | **PARTIALLY CORRECTED.** Original SVG animation omitted and announced; the general policy-event fallback still misses cases. | `src/js/project.js:22`, `:206`; `src/js/app.js:236`, `:909`. All 25 RV-04 assertions pass. A3-05 supplies a blocked short-path resource with no indication. |

The owner-approved changes are treated as requirements: file-name images instead of embedding/scaling, optional alt text (`alt=""` on new images), four alignment values written with `text-align`, and continued use of `<b>`/`<i>`. None of these choices is reported as a defect merely because it differs from the original brief.

## Findings about work preservation and protection

### A3-01 — High: alignment rewrites text inside an unrelated CSS string

**Introduced in alpha.3. Requirements:** S-05 and F-03's promise to preserve other declarations. **Locations:** `src/js/util.js:123`–`:135`, especially the regex at `:126`; `src/js/commands.js:467`–`:472`.

Open a document containing:

```html
<style>p::before{content:var(--label)}</style>
<p style='--label:"A;text-align: left;B"; color:red'>Alpha</p>
```

Place the caret in `Alpha` and click **Mittig**. The saved style becomes:

```css
--label:"A;B"; color:red; text-align: center
```

**MEASURED:** the computed `::before` content changes from `"A;text-align: left;B"` to `"A;B"`. This is visible text loss as well as source alteration. The regex interprets the semicolon inside a quoted custom-property string as a declaration boundary. The data to the right of it happens to start with `text-align`, which is enough to trigger removal. No scripts or resource addresses are needed.

**Proposed correction:** locate top-level CSS declarations with quote/comment/escape and parenthesis awareness, and patch only a genuine `text-align` declaration. Preserve the other source spans verbatim. Refuse an ambiguous edit rather than rewriting unrelated content. Include this exact string in a browser regression and in the helper tests; the existing `"A;B"` font-string unit example does not exercise the dangerous substring.

### A3-04 — Medium: an image from a cancelled dialog replaces a later selection

**Observed in the alpha.3 image workflow; first affected version not established. Requirements:** P-04/F-01/F-02, S-06's stale-operation principle and S-08's explicit file-choice handling. **Locations:** `src/js/app.js:464`, `:509`–`:524`, `:954`.

`pickImage()` awaits decoding, then checks only whether **some** image dialog is open. It has no selection sequence or dialog identity. The revision/document check in `imageFlow()` does not distinguish two dialogs in the same unchanged document.

**MEASURED schedule:** select a real `a3r-slow.png` in dialog 1, hold `createImageBitmap()` completion after actual decoding, cancel dialog 1, open dialog 2 and choose `a3r-fast.png`. Dialog 2 shows the fast file (30 × 15). Release the old completion: dialog 2 changes to the cancelled slow file (20 × 10). Clicking **Einfügen** downloads source containing `src="a3r-slow.png"`, not the later file. The first cancellation itself leaves the source unchanged. The hold is a labelled scheduling seam; file bytes, file inputs and buttons are real. No native picker timing is claimed.

**Proposed correction:** bind each decode to a dialog generation and each file choice to a monotonically increasing sequence. Reject and revoke results after cancellation, reopening or a newer selection. Accept only the latest valid result. Test both successive choices in one dialog and cancellation/reopening.

### A3-05 — Medium: short resource paths bypass the inactive-content indication

**Residual alpha.2 correction gap, still present in alpha.3. Requirement:** S-04. **Locations:** `src/js/app.js:909`–`:915`, particularly `name.length < 3` at `:911`, and `showInactive()` at `:236`; CSS detection at `src/js/project.js:23`, `:183`.

Use a style attribute whose value is `background:u\72 l(...)`, with the address pointing to path `/a` on the test's own `127.0.0.1` counter. The browser resolves the CSS escape to `url()`, while the display filter's regex does not recognize it. The policy listener extracts `a` and discards it because the segment has fewer than three characters.

**MEASURED:** one reported request attempt, two CSP issue reports, **zero counter hits**, unchanged source, empty inactive note. This is **not a containment bypass**. The same short-path issue would not arise merely from the simple unescaped `url()` fixture, because that would already be counted by the projection.

**Proposed correction:** do not discard a genuine policy block based on the length or source spelling of its last path segment. Track a per-document blocked-content indication; clear it on document replacement, or use a complete provenance mechanism before clearing it on edits. A sticky generic notice is preferable to hiding a real block. The raw/percent-decoded substring heuristic also does not establish correspondence for every CSS-escaped spelling; that broader space was not exhaustively tested.

### A3-03 — High: formatting can insert a visible word gap at another width

**Residual alpha.2 correction gap. Requirements:** S-05 and T-07. **Locations:** `src/js/app.js:562` (one probe width), `:573`–`:580`, `:613`; `src/js/project.js:453`, `:481`; documented limitation at `docs/SPECIFICATION.md:73`.

```html
<style>@media(min-width:1500px){p{display:inline}}</style><p>Alpha</p><p>Beta</p>
```

**MEASURED:** with a 679-pixel page pane, **Code aufräumen** accepts this document and inserts line breaks between the paragraphs. Render the original and the actual downloaded file as ordinary local pages at 1800 CSS pixels: both paragraphs are inline, but the gap from the last character of `Alpha` to the first of `Beta` changes from **0 to 4 CSS pixels**. Thus the inserted source newline becomes a visible word separator.

The implementation and specification candidly state the single-width limitation. That disclosure does not establish the original preservation requirement, and the owner-approved changes do not waive it. A page saved by the editor can be opened at another ordinary desktop width.

**Proposed correction:** conservatively refuse formatting when conditional CSS may change whitespace significance, including conditional display/generated-content rules, or preserve the potentially significant spans. Checking several widths alone cannot prove all conditions. Keep the original source and explain the refusal when equivalence cannot be established. Add a result comparison at a width where the media rule actually applies.

### A3-02 — Medium: attribute patching changes the effective meaning of malformed tags

**Introduced in alpha.3. Requirements:** S-05, P-04/F-02 and T-14's handling of malformed input. **Locations:** `src/js/util.js:149`–`:163`; `src/js/serialize.js:248`; `src/js/commands.js:406`–`:420`. Both examples remain visually editable and the dialog accepts the edit.

**Duplicate removal:** open `<img src="a.png" alt="x" width="80" WIDTH="160" height="40" HEIGHT="90">` and clear the width in **Bild ändern**. The first width and height are removed, but the duplicates remain. The saved image now has effective width **160** and height **90**, contrary to the requested removal. `seen.has(name)` skips later duplicates, which is correct for reading the first effective value but insufficient for removing that attribute's effective presence.

**Explicitly empty value:** open `<img src="a.png" alt= >` and change its description to `Changed`. The saved tag contains `alt="Changed"= >`. Parsing confirms a new unwanted attribute named `=`. The tokenizer's missing-value marker is treated as a bare attribute without an equals sign, so the patch inserts a second assignment before the existing `=`.

These inputs are malformed, which limits the claim; no corruption is inferred for all ordinary well-formed tags. Nevertheless, the editor exposes them as editable and manufactures unintended markup/effective attributes rather than preserving or refusing them. The artefact-level failures are also confirmed directly against the tokenizer/patcher helpers with handwritten expected outputs.

**Proposed correction:** removal must handle all duplicate spellings that would become effective, or decline editing ambiguous duplicates. Track assignment syntax for an explicitly empty value separately from a bare attribute. Add both cases to `tests/unit/attrs.test.mjs` and F-02. The existing duplicate test covers replacement of the first value, not removal.

## Review of the correction designs

**RV-01.** All document-replacement callers were inspected. Apart from initial startup, `replaceDocument()` is reached through the operation-ticket gate: New, the file-input path, native-open continuation and file drop. The final consent check is followed immediately by replacement in the caller's async continuation, without another asynchronous operation. `mayReplace()` commits visual input and loops after a dialog, so it checks the captured revision/document and current sequence again before allowing replacement. No ordinary input-task interleaving or stale HTML-file replacement was reproduced. The six regression schedules include both completion orders for competing reads and intervening source/page edits. Native `showOpenFilePicker`/`getFile` timing remains NOT MEASURED.

Cancelling an attempted New still invalidates an older read; undoing back to the saved text permits an open without another discard question. These documented choices preserve work and are reasonable. A concurrent second question is treated as declined; `confirmBox()` writes prompt text before `openDialog()` rejects a second open, so the gate should not be described as a general-purpose dialog queue. No data-loss consequence of that prompt interaction was demonstrated.

**RV-02.** Resolving comments/escapes and conservatively rejecting unknown whitespace values is an improvement over the literal alpha.1 regex. The accepted collapsing keywords and inherited/reset values do not by themselves prove arbitrary layout equivalence; the stylesheet scan is not a full CSS parser. External styles are appropriately refused because they are not loaded. The additional geometry comparison catches the original unconditional-inline example, and the revision check after awaiting it retains later input (RV-02's held-check schedule passes). Its all-width/all-state guarantee remains disproved by A3-03. Text-node bounding boxes and quarter-pixel rounding were inspected, but every possible fragment/rounding/empty-box case was NOT REVIEWED exhaustively.

The temporary frame was also **MEASURED independently at runtime** while the layout check was held: `sandbox="allow-same-origin"`, `about:srcdoc`, policy `default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:`, computed visibility `hidden`, zero script elements, no script marker, focus still on the main preview, and removal after completion. This supplements X-06, which checks the template frame rather than this dynamically created one.

**RV-03.** `rename()` retains mapping and original attribute spelling; the serializer recognizes moved blocks. The div policy avoids dropping an attributed list or an item that contains blocks. In a split list, the first original list retains the original source attributes; the second is a new normalized copy without `id` or filtered attributes. That exception is explicitly documented, so the original missing-attributes defect is not being hidden by an expectation that silently drops them. Exact/parsed tests confirm the stated examples. The `lost`/`dropped` rescue rules were inspected: they skip detached text nodes, not arbitrary non-text content. `dropSpace()` uses `\S` and can also treat a no-break-space-only node as blank; native unusual-whitespace list editing was not separately measured. Exhaustive nested-list/native deletion combinations remain outside the evidence.

**RV-04.** Omitting non-HTML animation nodes at `src/js/project.js:206` removes the reported mutation mechanism at its root; the tested SVG set/animate addresses are no longer attempted. Style elements in other namespaces, presentation attributes and image-set cases are counted. CSP-event fallback covers the supplied escaped-url fixture, but A3-05 shows that it is not a general answer to missing indications. Keeping the deny-list is disclosed; the previous allow-list recommendation still applies as a design simplification. No new automatic-address mutation mechanism or script permission was identified in this review.

## New alpha.3 features and protective design

| Area | Assessment |
| --- | --- |
| F-01: file-name images, folders, optional description and width | Positive ordinary cases pass, including percent-encoded `#`/`%`, folder validation, displayed width and empty alt. F-01's editor copy has real neighbouring files; none is implicitly requested. Filename-only matching across folders/documents is a disclosed approximation, not a new filesystem capability. A3-04 prevents full acceptance of the selection workflow. |
| F-02: existing image/link dialogs and attribute notes | Normal quote-preserving edits, unrelated handlers/attributes, undo, active-URL rejection and inert links pass. `record()`/`isClean()`/`patchAttrs()` integration was inspected. A3-02 prevents the general claim that each accepted edit changes exactly the intended attribute. |
| F-03: alignment | Simple left/center/right/justify, multi-block, list/cell and image-container cases pass, including restoring a class-defined alignment and browser-created paragraphs. The owner-approved `style` output is acceptable. A3-01 prevents acceptance of preservation of other declarations. RTL logical-alignment semantics were NOT MEASURED; the declared classroom scope does not make a claim for them. |

`img-src blob:` was checked in both the built parent policy (`tools/build.mjs:59`) and frame shell (`src/js/app.js:30`). `readImage()` at `src/js/images.js:17` takes an explicitly selected file, identifies its raster type, decodes it and creates an object URL with that type. `safeAttrs()` at `src/js/project.js:158` substitutes a selected in-memory file for the basename; it does not assign the written relative path to `src`. Imported arbitrary blob addresses are not accepted by that img branch. New saved images carry the file address, not the object URL. Existing data images remain supported. URL validation/escaping and the fixed new-element vocabulary were inspected; no new script execution or markup-shaped input failure was demonstrated.

The sandbox still omits script, popup, form and top-navigation permissions. The parent/child policies, projection and cancelled link events work together; the corrected security document no longer claims each layer is independently complete. X-01–X-07, F-01 and the additional controlled-resource probe show no containment failure in the measured Edge environment. A3-05 is a notice failure only. Same-basename substitution and session-long object-URL retention are documented limitations; long-session memory growth and large-image decode limits were NOT MEASURED. The new specification explicitly says there is no editor image-file-size cap, so the old S-08 size-bound assertion is not established by merely passing the rewritten image tests.

## Tests: strengths, gaps and a separate harness defect

**Test execution: PASS. Sufficiency for full contract acceptance: FAIL.** The existing Edge suite contains 33 passing cases and 410 assertions, with two native-file subparts explicitly NOT MEASURED. The targeted repeat contains seven passing cases and 162 assertions, with one native-file subpart NOT MEASURED. All 19 unit tests pass.

The regression inputs retain the reviewer's original examples. RV-02's accepted-result measurements use ordinary local pages with scripts disabled and separate test measuring code, rather than calling product `layoutPrint()` as their oracle. That is independent evidence for those samples, but shares the single-default-width coverage limitation. Its conditional-whitespace refusal sample does not cover a conditional `display` change. F-02 uses concrete source expectations; its malformed-attribute edge coverage omits A3-02. F-03's helper tests include a semicolon inside a font string, but no embedded `;text-align:` token inside a quoted string. F-01 waits for each selection to finish and never schedules the stale decode from A3-04.

**A3-T — Separate test-harness defect:** `tests/lib/harness.mjs:116`–`:123` considers a file open when its basename matches the label, or a confirmation dialog appears. If the previous document already has that basename, it can return before the new read completes. **MEASURED:** load `a3r-same.html` with `<p>OLD BYTES</p>`, hold the read of a second file with the same name and `<p>NEW BYTES</p>`, and call `Editor.openFile()` with its default wait. The helper returns while the source still contains OLD BYTES; after releasing the read, the product correctly loads NEW BYTES. This is a waiting/oracle problem, not another product overwrite. Wait for a load generation/completion signal or an independently expected new source value, not just a filename and an already-synchronized old view.

Automatic discard consent in `Editor.openFile()` is reasonable only as an explicit fixture-setup convenience. It means ordinary tests using it do not demonstrate discard-prompt correctness; T-15/RV-01 intentionally use `wait: false` for that subject. The same-name wait defect makes repeated fixture reuse less reliable even with that convention.

`Checks.skip()` and runner reporting now distinguish unavailable subparts from passing assertions (`tests/lib/harness.mjs:72`, `tests/run.mjs:55`, `:68`). Trusted clipboard and file drop succeeded in this independent run; their failure paths record NOT MEASURED. The overall case status still says PASS for completed measured portions, so the accompanying subpart counts must remain visible. The new asynchronous `Editor.format()` waits for an outcome rather than sleeping a fixed time, an appropriate improvement.

T-06 was correctly rewritten for the accepted new image requirements. Its removed embedding/mandatory-alt/scaling assertions must not be cited as current evidence. Existing T-01–T-17, X-01–X-07 and R-01/R-02 still pass, but their old scope limitations remain: one browser, exact corpus identity only for mapped editable inputs, limited native-edit structure/timing and no native filesystem-write evidence. Static scans inspect the delivered file; they do not prove all future browser semantics.

## Reproduction and evidence

**MEASURED 2026-11-19:** Windows 11 (`Windows_NT 10.0.26300`), Node `v24.22.1`, Edge `Edg/157.0.4341.60`, headless disposable profiles, editor started from `file://`. Browser networking was available for the controlled-counter cases. The responsive comparison uses scripts-disabled ordinary local pages at an explicit 1800-pixel width. No third-party service was a test target.

Artefact: **160,302 bytes**, SHA-256 `2c85f25d11fe0d1207f3e7655334dcbdd6f7b058dad66e0c6a9c9aeb09629244`; reproducible and below 200,000 bytes.

Run from `html-school-editor/`, sequentially because the scripts share a temporary fixture directory:

| Command | Result |
| --- | --- |
| `node tools/build.mjs --check` | PASS, original artefact unchanged |
| `node --test tests/unit/*.test.mjs` | 19/19 PASS |
| `node tests/run.mjs --browser edge --no-write` | 33 cases PASS, 410 assertions, 2 subparts NOT MEASURED |
| `node tests/run.mjs --browser edge --no-write --only RV-01,RV-02,RV-03,RV-04,F-01,F-02,F-03` | 7 cases PASS, 162 assertions, 1 subpart NOT MEASURED |
| `node tests/run.mjs --browser chrome --no-write` | NOT MEASURED, browser not installed |
| `node docs/reviews/review-alpha3.mjs` | Exit 1: eight unmet product expectations across five finding groups, two passing protection/frame checks, and one separately labelled unmet harness expectation |
| Repository publication check with the private deny-list, from repository root | PASS, 0 findings before commit/push |

Evidence: [full acceptance transcript](../../tests/results/review-alpha3-acceptance.txt), [targeted transcript](../../tests/results/review-alpha3-targeted.txt), [exact independent probe results](../../tests/results/review-alpha3-edge.json), [reusable independent probes](review-alpha3.mjs). `productPass: false` means the stated product expectation failed; A3-T uses `testPass` and `scope: test-harness` instead. Two A3-02 browser examples and two direct helper examples corroborate the same patcher finding group. No alpha.1 result file or original implementer acceptance result was overwritten.

An initial sandbox-constrained browser attempt timed out loading T-01 and was interrupted. It is not used as product evidence. The reported results come from completed runs with the required local browser/process/file access; those runs cleaned up their disposable profiles and downloads.

## Unreviewed or unmeasured scope and next gate

All requested parts (RV-01–RV-04, new features, tests) were reviewed. Native Open/Save/permission dialogs, real handle write-back and their delayed continuations; Chrome/other engines; visible-window, touch, physical IME, spellcheck replacement, source text drag, speech, handwriting and autofill; accessibility, printing, long sessions/large-image memory growth and pupil trials remain **NOT MEASURED**. Physical picker timing is not inferred from the deterministic seams. General parser equivalence and the full space of CSS/layout/structural editing combinations were **NOT REVIEWED exhaustively**.

A new reference-code provenance audit and unchanged modules outside the incremental regression scope were **NOT REVIEWED** here; the previous review remains the recorded source-assisted comparison. No new reference source was needed for this change review.

Before classroom acceptance: correct A3-01–A3-05 on a separate product/version branch; fix the A3-T wait helper; keep this failed-before evidence; add the missing schedules and malformed/conditional-CSS inputs; rerun the suite and independent probes on the new artefact; qualify the S-04/S-05/S-06/S-08 acceptance mapping; then complete target-browser/native-file and visible-use measurements. This PR contains review material only and requests no merge, release or CI workflow change.
