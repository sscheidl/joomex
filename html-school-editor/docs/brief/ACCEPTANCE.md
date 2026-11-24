# Product requirements and acceptance contract

These requirements apply to the **new delivered artefact**, not to the reference editor. All new-product results are **NOT MEASURED** until Claude implements and runs the checks. Record actual browser/tool versions, artefact revision/hash, commands, inputs, assertions and results. `PASS` means the stated expectation was verified, not merely that a test ran.

## Product boundary

| ID | Requirement |
| --- | --- |
| P-01 | A German-language HTML learning editor for pupils around age 12–13, with a short, understandable toolbar. A standalone application, not a Joomla component or multi-file IDE. |
| P-02 | Open the delivered single `school-editor.html` directly from the filesystem in current Windows Edge and Chrome, without installation, admin rights, Node, a local server or internet. No prefilled cache. |
| P-03 | Keep full editable HTML source on the left and an actual directly editable WYSIWYG document on the right. Both remain visible during normal editing and selection; no selected-element-only replacement of the source. |
| P-04 | Support new document, HTML file open, save/download, explicit format, paragraph and H1–H3, bold/italic, ordered/unordered lists, link insertion/removal, local raster-image insertion with alt text, undo/redo. Keyboard and German umlaut input must work. |
| P-05 | Use legible simple tags and valid nesting. Do not create decorative spans, font tags or inline CSS for basic text formatting. Prefer a documented consistent choice of semantic/basic emphasis tags. |
| P-06 | Target at most **250,000 bytes** (200,000 until 2026-11-24, raised by the owner) for the complete distributable HTML, including embedded runtime dependencies, CSS and UI assets. Reliability and safety take precedence: a justified overrun is reported and measured, not hidden by gzip or by moving required files outside the count. Pupil document images are counted separately. |
| P-07 | Exclude mail/newsletter tools, merge fields, minification, CSS inlining, templates with remote resources, tracking, registration, advertising, cloud services, IDE features and mandatory background services. No persistent autosave in version one; session undo/recovery in memory is allowed. |

## Safety and data model

| ID | Requirement |
| --- | --- |
| S-01 | Treat imported HTML and pasted content as untrusted data. In the editor preview they must not execute scripts, event handlers or active URL schemes, reach the parent editor, open/navigate windows, submit forms or access storage. |
| S-02 | Prevent automatic external resource access: scripts, CSS, imports, fonts, images, srcset, CSS URLs, nested frames, objects, media, preloads, base URLs and refresh/navigation mechanisms. Do not rely on a list of network JS APIs or on the machine being offline. Ordinary authoring must remain network-free even while the machine is online. |
| S-03 | A suitable lean candidate is a parent-controlled editable iframe with a sandbox that omits script permission, a restrictive CSP and a safe preview projection. Same-origin DOM access can be evaluated without enabling imported scripts. Prove the actual composition in the delivered file; a sandbox attribute alone is not a test. Never combine equal-origin imported documents with script permission. A different design needs equivalent measured guarantees and no needless new framework. |
| S-04 | Keep original source separate from its safe visual projection. Disabling active/external content in the preview must not silently delete it from the source or saved file. Show a short, understandable indication when some content is inactive. Do not describe a saved arbitrary HTML document as safe to run outside the editor. |
| S-05 | Visual commits preserve unrelated document content: doctype including public/system identifiers, head, charset/title/styles, comments, attributes, whitespace-significant content and unsupported content. Use supported-subtree edits/mappings or another demonstrated preservation strategy; do not replace the entire document with a filtered preview or plain text. If a particular fragment cannot be edited safely, preserve it and explain the visual limitation. |
| S-06 | Use one explicit document revision/transaction model. Delayed visual renders cannot overwrite newer source, and old visual DOM cannot commit over a newer document. Flush pending visual input before save/download, open/new, formatting and history operations. Conflicting edits must not disappear silently; prevent stale editing or retain recoverable revisions with a clear resolution. |
| S-07 | Restore useful selection/caret and scroll anchors after changes; preserve visual selection through toolbar interaction. Use a coherent source-and-visual undo/redo history. Avoid global source focus theft on preview selection. |
| S-08 | Create link attributes and image alt text as data, not interpolated HTML. Normalize and validate URL schemes for UI insertion, including whitespace/entity/case tricks. Imported unsafe source can remain in source but stays inert in preview. Explicitly selected local raster images may be embedded; no implicit neighbouring-file reads. Bound file/image size and report rejected/unsupported input without replacing unsaved work. |
| S-09 | Do not use `eval`, dynamic function constructors or string-evaluated timers. No runtime CDN loading. Any new library must be necessary, pinned, licence-reviewed, statically checked before execution and included in the measured artefact. Build/test tools may be separate from the pupil-facing file. |

## Functional and regression checks

Use original synthetic fixtures. Exercise realistic timing as well as deterministic scheduling. Keep expected results independent of the implementation; inspect actual downloaded bytes and parsed output, not only UI text or snapshots.

| Test ID | Check and pass criterion |
| --- | --- |
| T-01 | Fresh offline `file://` start in Edge **and** Chrome: no server, no warm cache, both views edit successfully. Record each actual browser; mark unavailable tests `NOT MEASURED`, not PASS. |
| T-02 | Source → preview and preview → source for full HTML: body changes appear, the entire source remains visible, and unrelated head/comments/attributes remain. |
| T-03 | Select an element and text in each pane, including repeated identical text and nested emphasis: target mapping stays correct, other source remains visible, next keystroke enters the intended pane. |
| T-04 | H1, paragraph, bold and italic: inspect the saved HTML and parsed tree; no unwanted spans, inline styling or loss of existing child elements. |
| T-05 | Ordered/unordered list creation, multiple items, switching and removal: valid OL/UL/LI placement, no list inside P, no phantom paragraphs after reopen. |
| T-06 | Link creation/removal and local raster-image embedding: correct elements, escaped alt/caption input, no executable attribute injection; unsupported image types receive an understandable response. |
| T-07 | Explicit formatting of full HTML with comments, entities, quoted greater-than characters, pre/textarea/style/script text and spaces between inline elements: no semantic/text loss, clean indentation where safe; unsupported constructs are preserved rather than guessed. |
| T-08 | Real import → download → reopen without edits: preserve the supported UTF-8 input, including BOM handling if present. Document exact bytes versus line-ending policy. Unsupported encodings must not be silently corrupted. |
| T-09 | Import → visual edit → download → reopen: preserve full document envelope and unrelated markup, including a public/system doctype and inactive content. Report precisely what lexical normalization is allowed after an intentional edit. |
| T-10 | Type in WYSIWYG and save **immediately**, including before any debounce expires: actual downloaded file contains the final keystroke. Cover explicit save/download, keyboard save and supported direct-write API. Cancellation/failure must not mark work as saved. |
| T-11 | Alternate edits between panes rapidly, including an edit against an older preview: final state is deterministic, no newer text is replaced with stale text, all input is retained or recoverably resolved. Cover several timing schedules and repeated runs. |
| T-12 | Long source/preview, fast typing, toolbar operations and IME/composition: no lost characters, cursor teleporting to end, destroyed selection or unnecessary scroll reset. Keep timing/load limits explicit. |
| T-13 | Undo/redo across source edits, visual edits and toolbar changes: expected states and edit grouping are documented, redo invalidates correctly after a new edit, no hidden independent histories discard work. |
| T-14 | Malformed, incomplete, empty and oversized HTML: no crash or silent source rewrite on open/typing; invalid/uneditable fragments and limits are reported without losing the original text. |
| T-15 | Open/new/drop while dirty; failed or cancelled open/save: work remains available unless the pupil confirms discarding it. Opening a document invalidates stale operations from the previous document. |
| T-16 | File-save fallback: actual browser download works when direct filesystem-write support is absent. Exercise native pickers/write-back where available; mocks alone are not evidence of native-browser support. |
| T-17 | Session privacy: fresh launch does not recover a previous pupil's document from localStorage/IndexedDB/cookies. New-document and close behaviour are documented; in-memory history is not misrepresented as persistent backup. |

## Security checks

Run the new artefact with networking **available to the browser** while intercepting/logging attempted requests. A test that merely makes every request fail does not prove the product itself blocks them. Use explicit offline mode separately for T-01. Keep external probes on synthetic invalid destinations or a controlled local sink; do not send real data.

| Test ID | Check and pass criterion |
| --- | --- |
| X-01 | Imported inline/external/module scripts and common load/error/click handlers cannot execute or modify the parent DOM. Synthetic parent-storage sentinels cannot be read; editor state remains intact. |
| X-02 | Active links, encoded/mixed-case schemes, meta refresh, base changes, forms, nested frames, object/embed and popup/standalone-preview paths cannot escape the editor or cause navigation/submission. The simplest solution may omit secondary preview windows altogether. |
| X-03 | Remote stylesheet/font/image/srcset/CSS-import/CSS-URL/media/preload attempts are prevented by the delivered product. Use browser network events and, where needed, controlled local-server hit counts; distinguish attempted, CSP-blocked and actually served requests. |
| X-04 | Pasting rich HTML and entering markup-shaped alt text/URLs does not create active content. Plain text fields remain plain text in both DOM and saved source. |
| X-05 | Any message bridge, if introduced, rejects wrong-window, wrong-session and malformed payloads. Do not add a bridge when parent-controlled passive editing suffices. No broad unauthenticated mutation channel. |
| X-06 | Static scan of the delivered file: sandbox/CSP/URL/resource policy, dynamic code mechanisms, storage, all URLs, runtime imports and dependencies. Reconcile scan results with measured behaviour; no blanket safety claim from a zero-hit search. |

## Delivery gate

* Provide a complete source tree, reproducible build if needed, single-file artefact, own-code licence, dependency/licence inventory, small German pupil guide and English maintenance documentation.
* Maintain a matrix `requirement/test → implementation file:line → command/fixture → result → evidence`. Link RF findings to fixes and regressions. Preserve failed-before evidence and label measurement dates/versions.
* All functional safety/data-loss regressions and security checks must pass in the measured target environment. Security, rights or data-integrity failures exclude PASS regardless of size or convenience. Missing browser/native-dialog measurements remain explicit gaps and prevent claims of complete cross-browser readiness.
* Finish with `PASS`, `HOLD` or `FAIL`, limitations and an independent Codex review brief. Independent review is a separate later action, not something Claude may self-attest.
