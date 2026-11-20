# Independent review: HTML School Editor 0.1.0-alpha.1

**Overall verdict: FAIL.** A delayed file read can discard newer work and erase its undo history. Formatting can change rendered text, and list conversion loses existing attributes. The measured protection against execution, navigation and resource delivery held; one resource-blocking case lacks the required inactive-content notice.

Reviewed by Codex on 2026-11-18, against import commit `6994be7ab8a6370fbe01530b5c48a3c0311eeaca`. This review changes no product source or distributable. The contract is [ACCEPTANCE.md](../brief/ACCEPTANCE.md).

| Part | Verdict | Scope of conclusion |
| --- | --- | --- |
| A: data integrity | FAIL | RV-01, RV-02 and RV-03 contradict preservation requirements. Ordinary pane switching passed the existing schedules. |
| B: contract and tests | FAIL | The existing suite passes, but misses the demonstrated defects; target-browser and native-file evidence is incomplete. |
| C: protective design | FAIL for S-04 notice; measured containment passes | RV-04 fails the inactive-content indication. No script execution, navigation escape or delivered external request was observed in the measured cases. |
| D: origin | PASS within sampled scope | No substantial copied implementation identified; short shared idioms are documented below. This is a sampled comparison, not proof that every line has independent provenance. |

## Findings, ordered by lost-work and protection impact

### RV-01 — High: completion of an old file read discards newer work

**Requirements:** S-06, T-15. **Locations:** `src/js/app.js:536`, `:547`, `:560`, `:499`, `:512`, `:530`; misleading assurance in `docs/ARCHITECTURE.md:38`.

`loadFile()` checks only `loadSeq`, which increases when another `loadFile()` starts. New-document creation and subsequent edits do not invalidate a pending read. The completion unconditionally calls `replaceDocument()`, resets history, and sets the opened text as saved. Unlike save completion, file-read completion does not check the original document identity. An unchanged document identity alone would also fail to protect text typed during the read.

**MEASURED:** two deterministic schedules against the delivered file:

1. Begin reading a real file containing `<p>DELAYED FILE</p>`; hold completion of `File.arrayBuffer()` at a test timing seam.
2. In one schedule click **Neu**; in the other stay in the existing document.
3. Type ` KEEP-MY-WORK` in the source with real key events and wait for synchronization.
4. Release the pending read.

In both schedules the complete source becomes `<p>DELAYED FILE</p>`, the new text disappears, **Rückgängig is disabled**, the document says **gespeichert**, and no confirmation is open. The test delays completion, not file bytes or the editor's state transitions. Native pickers and the frequency of this timing during normal disk access were not measured.

**Correction proposed for alpha.2:** use an operation token that is invalidated by New and competing opens, and bind acceptance of a read to the document/revision for which discard was authorized. On intervening edits, preserve them and ask again or cancel the stale read. Include the asynchronous picker/getFile stages in that policy. Add both schedules to T-15. Do not solve only the New case with a `docId` check.

### RV-04 — Medium: a policy-blocked SVG resource is not announced

**Requirements:** S-04; related evidence X-03. **Locations:** `src/js/project.js:150`, `:178`, `:132`, `:136`; `src/js/app.js:220`.

An SVG `image` with a child `set` that assigns its `href` to the controlled local image address reaches the preview projection. The `to` and `attributeName` attributes are retained, so the animation can introduce a resource address after attribute filtering. The SVG subtree is read-only, but that does not stop animation.

**MEASURED:** one image request attempt, two CSP issue reports, **zero counter hits**, unchanged source, and `inactive.hidden === true` with an empty inactive-content message. This is a missing indication, **not a demonstrated CSP or sandbox bypass**. See `RV-C-svg-animation` and `RV-04-inactive-notice` in the probe evidence.

**Correction proposed for alpha.2:** account for animation-driven resource changes or project animation as an inactive placeholder, and show the short inactive-content notice. Keep the CSP resource restriction. Add an assertion about the notice for this fixture.

### RV-02 — High: the formatter's equivalence check accepts visible changes

**Requirements:** S-05 (whitespace-significant content), P-04/T-07 (formatting without semantic/text loss). **Locations:** `src/js/app.js:473`, `:483`, `:484`; `src/js/project.js:398`, `:413`; `src/js/format.js:27`, `:57`.

The guard searches literal source text for selected `white-space` declarations. `canonDom()` then collapses spaces and treats boundaries as insignificant based on tag names, without applying CSS. Equal canonical forms therefore do not establish equal rendering for the supported inline styles and style elements.

**MEASURED:** both documents below are accepted by **Code aufräumen**, without a refusal dialog:

```html
<!doctype html><p style="white-space:/**/pre">Alpha   Beta</p>
```

The three visible spaces become one in the saved file and its rendering. The CSS comment is valid; it defeats the literal guard while the browser still computes preformatted whitespace.

```html
<!doctype html><style>p {display:inline}</style><p>Alpha</p><p>Beta</p>
```

The formatter inserts a newline between the paragraphs. In ordinary local-file rendering of the original and the actual downloaded result, the gap between the last character of `Alpha` and the first of `Beta` increases from **0 to 4 CSS pixels**. The word boundary changes. Geometry is used here because this browser's `innerText` also inserts paragraph separators for inline paragraphs.

**Correction proposed for alpha.2:** conservatively preserve whitespace whose significance depends on author CSS, or refuse formatting when equivalent rendering cannot be established. Extending the literal regex alone cannot address `display` rules, CSS escapes, variables and inherited whitespace. Add rendered-output expectations independent of `canonDom()`.

### RV-03 — Medium: creating a list deletes paragraph attributes

**Requirements:** S-05; T-05/P-04. **Locations:** `src/js/commands.js:183`, `:186`; `src/js/serialize.js:179`. The reverse conversion at `src/js/commands.js:129` also needs a preservation policy.

**MEASURED:** open the following file, put the caret in `Alpha`, and click **• Liste**:

```html
<!doctype html><p id="anchor" class="special" title="Keep me">Alpha</p><p>Beta</p>
```

The downloaded result contains `<li>Alpha</li>` and the untouched second paragraph, but no `id`, `class` or `title`. `toggleList()` moves children into a new `li` and removes the mapped paragraph. Its attributes and original-source mapping are discarded. This can break anchors and CSS and is not one of the documented lexical normalizations. Undo remains available, unlike RV-01.

**Correction proposed for alpha.2:** retain the original paragraph inside the list item or define and implement a source-preserving conversion that retains attributes and their spelling. Do not silently drop them. Test list creation and removal with attributed paragraphs/items.

## Evidence and reproduction

**MEASURED 2026-11-18:** Windows 11 (`Windows_NT 10.0.26300`), Node `v24.22.1`, Edge `Edg/157.0.4341.60`, headless, fresh disposable browser profiles. Editor operations use the delivered `file://` artefact. The formatter comparison additionally renders only the synthetic input and downloaded output as ordinary local files. The extra resource probe uses only a self-started `127.0.0.1` counter with browser networking available.

Artefact: **132,525 bytes**, SHA-256 `ef9585a6c323bf9913f7dff2baf8d475eb5eb70b0c4700f5545ba6c120385079`.

Commands below run inside `html-school-editor/` unless noted. Run the two browser scripts sequentially because they share the acceptance harness's temporary directory.

| Command | Independent result |
| --- | --- |
| `node tools/build.mjs --check` | PASS; byte-for-byte reproducible, size/hash as above |
| `node --test tests/unit/*.test.mjs` | PASS; 13/13 |
| `node tests/run.mjs --browser edge --no-write` | PASS; 26/26 cases, 242 assertions |
| `node tests/run.mjs --browser chrome --no-write` | NOT MEASURED; browser not installed |
| `node docs/reviews/review-alpha1.mjs` | Exit 1, as expected for unmet product expectations: six failing assertions across RV-01–RV-04; the additional containment assertion passes |
| Repository publication check with the private deny-list, from repository root | PASS; 0 findings before commit/push |

Review evidence: [acceptance console transcript](../../tests/results/review-acceptance-edge.txt), [probe results with exact inputs/outputs](../../tests/results/review-alpha1-edge.json), [reusable probes](review-alpha1.mjs). `productPass: false` records a failed product expectation, not a broken probe. The implementer's existing result files were not overwritten.

## Part A: assessment of the six requested properties

1. **Both panes retain edits — qualified support for tested input, not a universal invariant.** Guards at `src/js/app.js:702`, `:708`, `:788` and fallback at `:648` are sensible; T-11 retains input in all 42 timing schedules and the 24-keystroke alternation. No ordinary cross-pane overwrite was reproduced. However, `commitVisual()` at `:242` discards a stale dirty preview by rendering again; it does not retain that preview as a recoverable revision. Thus the safety argument still depends on event coverage. Source spellcheck and autocomplete are disabled (`src/app.html:40`), which narrows some routes. Real spellcheck replacement in the page, source text drag, speech, handwriting, autofill, and non-cancelable OS input paths were **NOT MEASURED**. Architecture statements that the conflicting state is impossible exceed the evidence. RV-01 independently disproves the broader no-stale-operation guarantee of S-06.
2. **Unedited round trip — PASS within measured corpus.** `isClean()`/source slices at `src/js/serialize.js:21`, `:212`, `:271` support identity. R-02 verifies exact identity for 2,128 editable documents from 3,044 inputs; the remaining documents are not identity successes, because they are skipped as uneditable. T-08 checks actual byte-identical downloads for the supported UTF-8/BOM/EOL combinations. Mixed line endings follow the explicitly announced normalization policy. Arbitrary HTML identity is not proven.
3. **Only the edited place changes — FAIL.** Many text edits are checked against explicit expected source in T-02/T-09/R-01, and `rescueHidden()` at `src/js/serialize.js:243` preserves the exercised inactive content. R-01 has one documented whitespace side effect. RV-03 demonstrates attribute loss during a toolbar edit. Hidden-node relocation and `emitText()` space/NBSP equivalence (`:141`) have not been exhaustively checked for all CSS/layout/structural edits.
4. **Safe source ranges — qualified support.** `matchKids()` at `src/js/project.js:98` aligns order, element local names and decoded text; attributes and comment data are not compared. These omissions do not by themselves show a wrong range: unchanged attributes/comments are copied from source, not reconstructed from the projection. The `isTail` exception (`:111`, `:117`) accepts only trailing HTML whitespace, including the browser's post-body append. No wrong source range was demonstrated in the reviewed cases. Namespace-sensitive parsing, all malformed-comment forms and arbitrary parser differentials were **NOT REVIEWED exhaustively**; the claim should remain an approximation guarded by read-only fallback, not full parser equality.
5. **Formatting preserves meaning — FAIL**, RV-02. Non-whitespace byte equality at `src/js/app.js:483` is useful, but does not prove whitespace insignificance under CSS.
6. **Saved state belongs to a completed snapshot — PASS for inspected paths, with limits.** `snapshotForSave()` flushes at `src/js/app.js:597`; `writeToHandle()` awaits write and close at `:586`; `markSaved()` checks document identity at `:580`. Later edits differ from `savedText` and remain dirty. T-10/T-15 exercise failure/cancellation and stale completion with labelled mocks; T-10/T-16 read real downloads. A started download is marked saved at `:610`, as explicitly documented; browser-side retention/failure cannot be inferred. Native handle writes, overlapping native saves and native dialog error behaviour remain **NOT MEASURED**.

**Part A verdict: FAIL.** Missing OS-input and native-file measurements do not negate the failures already reproduced.

## Part B: do the cases establish their stated claims?

**Part B verdict: FAIL for full contract acceptance; PASS for execution of the existing Edge assertions.** The tests contain useful independent handwritten expectations, real keys/mouse events, file-input imports and actual downloaded bytes. They do not call private product state to manufacture success. DOM selection setup is appropriate for precise targeting but is not evidence about mouse selection usability. Below, “bounded” means that the recorded assertions held, with the stated coverage limit.

| Case | Review of evidence and remaining gap |
| --- | --- |
| T-01 | Valid fresh-profile offline `file://` test in Edge; Chrome half of P-02 is missing. |
| T-02 | Strong explicit whole-source expectation for its two edits; bounded to the fixture. |
| T-03 | Repeated/nested text, focus and next keystroke checked; some selection is installed through DOM APIs. No full keyboard/accessibility or real-drag selection coverage. |
| T-04 | Independent expected source and downloaded structure; attribute retention proven for block renaming, not all commands. |
| T-05 | Valid create/switch/remove/reopen structure assertions; attributed paragraphs are not retained in its expected result. RV-03 is missed. |
| T-06 | Useful parsed injection assertions, byte-exact embedded small image and type checks. Large image check is less strict than all documented scaling/output limits; not every image size/dimension/error case is covered. |
| T-07 | Handwritten expected formatting and preserved raw text are useful. Whitespace-stripped equality and CSS-unaware fixtures cannot establish semantic equivalence. RV-02 is missed. |
| T-08 | Strong real-byte tests for UTF-8, BOM, LF/CRLF and conversion/refusal. Ordinary successful reopen is also exercised elsewhere; unsupported encodings are not silently accepted in these fixtures. |
| T-09 | Strong envelope/source expectations for local edits and inactive scripts. Broader replacements have weaker presence/absence assertions; this is not an exact oracle for every retained node and attribute. |
| T-10 | Confirms pending edit before real download/keyboard save, and final bytes. Direct writes, failures and cancellation use explicitly labelled mocks. |
| T-11 | Independent final text over 42 repeated schedules and 24 alternated keys. Exercises guarded focus routes, not the OS-input routes listed in Part A. |
| T-12 | Useful 146,008-character typing/scroll/selection checks and CDP composition. Not a physical IME, speech, handwriting or long-session test. Some accepted source alternatives permit documented whitespace variation. |
| T-13 | Explicit expected undo/redo states and redo invalidation. No claim about retained history after file replacement; RV-01 destroys it. |
| T-14 | Real malformed/empty/oversize/deep inputs with read-only behaviour. Large nesting is a robustness check, not full interactive performance at the file-size limit. |
| T-15 | Confirms discard dialogs, rejected input, chooser/drop and stale **save** completion. No delayed **open** schedule, so its title and S-06 mapping overstate operation coverage; RV-01 is missed. |
| T-16 | Good actual download fallback. Native picker/write-back explicitly NOT MEASURED. |
| T-17 | Checks actual storage counts and another launch in the same profile; supports in-memory-only sessions. Not persistent crash recovery, which is deliberately absent. |
| X-01 | Real actions plus DOM/source markers and a storage sentinel support non-execution for the supplied samples; not proof against every future element/browser feature. |
| X-02 | Good navigation/target/frame assertions in editable/read-only variants. Scripted `submit()` on the form's projected div throws, as intended; it tests removal of the mechanism, not submission of a surviving form. |
| X-03 | Valid local control and counter distinguish possible networking from actual delivery. Attempt and CSP event totals are reported as notes, not required one-to-one matches. Counter silence alone cannot establish every possible network scheme; the inspected CSP and projection supply the design argument. RV-04's missing notice is not covered. |
| X-04 | Trusted clipboard paste actually succeeded in this run; synthetic paste/drop separately check handlers. At `tests/browser/security.mjs:230`–`:232`, failure or absence of the trusted paste can become a passing note, so the case can still be called PASS without that submeasurement. Use explicit subcase status. |
| X-05 | Static absence of a message channel agrees with the inspected code; no bridge was added. |
| X-06 | Exact sandbox/CSP/script hash assertions and regex checks agree with source inspection. Regex absence is not a JavaScript semantic proof, and the dependency claim also relies on build/package inspection. |
| X-07 | Good targeted clobbering regression using original DOM accessors. Does not enumerate every named property. |
| R-01 | Helpful real-artefact corpus and undo oracle. Whitespace-normalized comparisons can hide visible changes under CSS. Only a small part of the space of structural edits is exercised. |
| R-02 | Exact identity and append-one-character expectations are independent of serialization output. Expected append position depends on the product's own mapping, and incompatible parses are skipped. This is module-level localhost evidence, not 3,044 successful single-file cases. No-policy resource absence applies only to the generated resources. |

Another reporting weakness: file-drop failure at `tests/browser/functional.mjs:698`–`:700` becomes a note and skips follow-up assertions while the enclosing T-15 can pass. Drop **did** succeed in this run. Distinguish unavailable subcases from tested PASS in future result files.

P-01/P-03/P-06/P-07 and the delivery tree are supported by inspection: German UI, both panes, no extra runtime file, size below the cap, no runtime dependency, own-code MIT licence, reproducible build and German guide. Pupil comprehension, visible-window behaviour and accessibility remain unmeasured. `docs/ACCEPTANCE_RESULTS.md` should no longer be used as evidence of unrestricted S-04/S-05/S-06 acceptance after this review.

## Part C: containment and protective design

**Verdict: FAIL for the S-04 indication in RV-04. Measured S-01/S-02/S-03/S-09 containment: PASS within this Edge environment.** All seven existing X cases pass independently; no opened-document script execution, parent mutation, navigation escape or delivered resource request was observed. Source remained separate from the display filter in the exercised inputs.

The fixed shell, node-by-node projection and original DOM accessors (`src/js/project.js:26`, `:150`, `:178`, `:303`) keep source parsing separate from the loaded frame document. The frame at `src/app.html:68` permits same-origin parent editing without script permission. The parent CSP at `tools/build.mjs:59` permits its one hashed script, inline style and data images; `form-action` and `base-uri` explicitly deny those mechanisms. The additional frame CSP at `src/js/app.js:30` has no script source. These are correctly composed for the measured file, including preservation of the matching hash in X-06.

**The layers are complementary, not independently complete.** `docs/SECURITY.md:30` should be corrected. The projection deliberately allows CSS that attempts resource loads. RV-C also shows SVG animation assigning a resource URL after filtering. Sandbox without scripts is not a network-blocking policy, and a generic CSP is not a complete self-navigation policy. The combination, including URL removal and event cancellation, is the protection actually tested. R-02 does not prove the entire projection resource-free without CSP.

For a classroom tool, an allow-list of displayed elements/attributes, or at least omission of SVG/MathML animation and other unsupported dynamic features, would reduce browser-feature exposure. Preserve omitted source verbatim and explain limitations. Keeping arbitrary inline CSS still requires CSP even with such a list. This is a design recommendation; no containment failure is inferred merely from using a deny-list.

New link/image data uses text nodes and attribute APIs (`src/js/commands.js:309`, `:344`) and escaped serialization (`src/js/serialize.js:179`, `src/js/util.js:5`, `:9`). `checkLinkUrl()` at `src/js/util.js:51` rejects the exercised active/encoded schemes; unsafe imported source is retained but not used as a live preview link. Unit/T-06/X-04 evidence supports data-only dialog handling. No `eval`, function constructor, string timer, runtime import or storage/network API was found in the reviewed product or reproduced bundle.

The X-03 argument is sound within its scope: the same browser fetches the control image and stylesheet, while the editor produces 11 reported CSS attempts, 27 policy issue reports and zero delivered requests. Those counts represent different event streams and need not match. RV-C produces one further animation-driven attempted path, two policy reports and zero delivered requests. Neither a static zero-hit regex nor a zero-hit counter alone is treated as complete protection evidence.

The original accessors and conversion of forms prevent the tested DOM-property clobbering (X-07). The position tree caps nesting (`src/js/tree.js:26`), and a failed analysis empties and locks the page (`src/js/app.js:210`). T-14's 30,000-level sample confirms the exercised fallback; it does not establish a general CPU/memory bound.

**NOT MEASURED:** Chrome and other engines; isolation of each layer; physical-device/native-input paths; arbitrary new HTML/SVG/CSS features; long-session resource exhaustion. No content from a non-controlled third-party service was requested for this review.

## Part D: origin comparison

**Verdict: PASS within sampled scope.** The private identity record and the specified source ranges of `[REFERENCE-APP]` were available. No reference source, original filename, identity or reference hash is included in this change. `[REFERENCE-NOTES]` remains an alias.

Manual comparison covered the layout range 555–604 and the principal source ranges 622–1219: state/highlighting, preview/write-back, selection, toolbar, open/save/download and formatting. Screening compared that script range with all eleven own JavaScript modules, once as approximate lexical tokens and once with identifiers normalized; comments were omitted. This is text/token screening, not a full JavaScript AST clone detector or a whole-history audit.

The only matching token runs at or above the screening threshold of 30 tokens were:

| Own location | Reference alias location | Observation |
| --- | --- | --- |
| `src/js/app.js:608` | `[REFERENCE-APP]:1132` | 35 tokens in the standard append-anchor/click/remove/revoke-object-URL download sequence; same browser API idiom |
| `src/js/highlight.js:5` | `[REFERENCE-APP]:691` | 34 tokens in a character-reference regex suffix |
| `src/js/project.js:68` | `[REFERENCE-APP]:691` | 31 tokens in a similar character-reference regex suffix |

The normalized pass found the same three runs. Short common idioms also occur, including an element-by-ID helper and cancelling toolbar mousedown. They do not establish copied authorship. The central implementations differ substantially: source-position tree and patch serialization instead of whole-DOM serialization; structural mapping instead of whitespace-stripped text search; DOM toolbar operations instead of a general editing-command toolbar; guarded revision state instead of suppression flags; tree-based formatting instead of a tag scanner. The sampled layout/highlighter code likewise uses different structure and styling.

No substantial copied or merely identifier-renamed implementation was identified in these samples. This supports the documented source-assisted development account. It cannot certify the categorical sentence “nothing reused” for every line; keep the existing disclosure that the author read the reference and that no clean-room process is claimed. Unread reference ranges after 1219, full historical provenance, assets outside the reviewed product tree and a comprehensive similarity/legal determination were **NOT REVIEWED**.

## Conditions before classroom use

1. Correct RV-01–RV-04 on a separate alpha.2 product branch; add the failing examples as regressions and retain failed-before evidence.
2. Rerun the full acceptance suite and independent probes on the new artefact. Make optional/absent submeasurements explicit; update the acceptance matrix and the two overstated architecture/security assurances.
3. Measure current Chrome as well as Edge, native Open/Save/permission/cancellation/write-back to disposable real files, and a visible-window session. Try the outstanding input routes and a short pupil/teacher usability session before calling the tool classroom-ready.

This review is complete for its stated scope. No merge, release, product fix or new CI workflow is part of this change.
