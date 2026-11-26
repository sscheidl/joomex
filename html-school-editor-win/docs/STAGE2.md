# Plan for stage 2 editing and code formatting

**Status.** Draft for review, updated 2026-11-26. E1 is decided. The Windows editor keeps two WebView2 views. E2 to E5 are proposals, E6 is open. The independent review of the stage 1 candidate 0.1.0-alpha.9 (2026-11-26) rated the local stage 2 prototype READY TO BUILD and the use with pupils' files not yet ready (findings B1 to B8, see P0). The native GUI cases of that review and the local native acceptance run are NOT MEASURED; stage 2 code starts after that run.

## 1. Goal

Pupils can edit text and use formatting tools on the page side. Each visual edit changes only the corresponding part of the HTML source. Local images and CSS resolve relative to the page in its project. “Code aufräumen” is an explicit action with a separate visual-equivalence check.

## 2. Shared code

The Windows editor already shares `util`, `tokenizer`, `highlight` and `history` with the single-file editor. The draft proposes sharing the modules below by reference through `ui/resources.json`.

| Module | Purpose and proposed use |
| --- | --- |
| `tree` | Locate source ranges. |
| `project` | Compare parser output with the source tree, build the filtered projection and map selections. The Windows editor supplies the local asset policy and page base. |
| `serialize` | Write targeted changes back to the source. |
| `commands`, `images` | Reuse the relevant toolbar commands and image handling. Windows file selection and copying go through the existing host. |
| `format` | Reuse the formatting logic and adapt its validation to the Windows projection. |
| `app.js` | Use the existing synchronisation behaviour as a reference for the Windows integration. Windows keeps its own file access, dialogs and document lifecycle. |

Select focused cases from the [single-file editor acceptance results](../../html-school-editor/docs/ACCEPTANCE_RESULTS.md), including RV-01 for late events, RV-02 for formatting, RV-03 for preserving attributes and RV-04 for announcing resources stopped by the policy. That file is a source of cases, not evidence for the Windows editor: the review of alpha.1 limited its use as evidence for S-04 to S-06. Changes to shared modules run through both test suites.

Limits from the single-file editor (D5): it receives defect corrections only, so shared modules change there only through new code it does not use, or through a defect correction that both products need. Its delivered file must stay below 250,000 bytes (beta.3: 196,056 bytes); every change to a shared module is measured against that limit.

## 3. Two WebView2 views

The second WebView2 loads the raw page at its project address in **Ansehen**, using the stage 1 request policy. Its separate origin and controller keep the raw pupil document out of the application interface. The first WebView2 contains the interface and the native file bridge.

For **Bearbeiten**, the proposed design hides the second view and displays a fixed, app-owned sandboxed frame in the same right-hand area. The interface uses DOM access only for the filtered projection it creates from supported HTML elements and attributes. The frame has no native file bridge. Privileged messages are authorised only from the trusted top-level UI document. Active or unsupported parts stay in the original source, with a note or placeholder where useful in the projection.

DOM access from the interface requires that the frame shares the interface's origin. This is the risk named in the review that led to E1, so the trust boundary of **Bearbeiten** is the projection filter itself, not the frame: the frame's sandbox never contains `allow-scripts`, the projection is built from admitted elements and attributes only (no raw pupil markup is inserted with `innerHTML` or a parse that can load or run anything), and the frame document carries its own restrictive CSP. P1 states the frame's origin and sandbox tokens explicitly and the review of P1 checks them.

Assets of the projection are requests of the interface view. They need a new, separate branch of its request handler (today `onUiRequest` serves only the interface's own resources), with the same per-request project boundary check as the page view (`CheckedFile`), read on the preview workers and tied to the current project, document and projection generation. The interface's own resources and the native bridge stay unreachable from that branch.

The asset policy applies from the first parse, including any auxiliary parse. Only admitted project assets of the expected type may load, with a base set by the app for the current page. Project and document changes revoke the previous context. The first native prototype uses local images. Allowing project CSS also requires checking imports, fonts and nested URLs against the same project boundary while preserving each stylesheet's own base.

## 4. Editing and saving

The proposed “Seite bearbeiten” switch starts in **Ansehen** when a page opens. **Bearbeiten** uses a projection of the current source, including unsaved text. A visual edit applies only when its source range can be mapped to the current project, open document and text revision. If the source changes first or the range becomes ambiguous, preserve the current source and rebuild the projection from it. Affected portions can be read-only when their mapping is uncertain.

Both panes use one document history. A valid pending edit in the page pane is applied before switching to **Ansehen**, saving, opening another page or closing. The existing checks for unsaved changes then use the resulting document state. Cancelling preserves the document, its text and its history. A late save confirmation still records the bytes sent by that save.

The page pane follows the locks of the code field: while a page is being opened or created (`opening`), it accepts no edit, and results of pickers carry the operation number of their request as in stage 1.

Visual changes use the same document update path as source edits, including each stored line ending. The code field gets one named entry point for changes from the page pane (range, new text, revision) that runs through its history and `breaks.follow`; the page pane never sets the whole text. Repeat the byte comparisons F-07 to F-10 through the page pane, including delayed save acknowledgement, undo to an unsaved step and two line endings that meet after a deletion.

## 5. Work packages and acceptance

| Package | Scope | Acceptance |
| --- | --- | --- |
| P0 Stage 1 baseline | Record an independently reviewed candidate with native checks for the project boundary, raw preview isolation, paths with special characters and the open, save and close lifecycle. Prepare mock cases and fixtures while the review runs. | [Stage 1 criteria](ACCEPTANCE.md) and a recorded Windows build. Verify startup and SMB behaviour on the school setup before use with pupils' files. Before pupils' files, also: no file or network call on the window thread (review finding B1: `boundary()`, `setProject`, `projectSegments`, picture dialog, `viewInBrowser`); logoff and shutdown with unsaved text ask first (B2); decide on a rescue copy while a save hangs (B3); one picker at a time (B4); `build-test/` ignored (B5). |
| P1 Native prototype | Switch between the two modes in the existing right side, render a filtered page and load a local image. Review the projection's trust boundary before integration. | Visible Windows check of focus, Tab, Ctrl+S, dialogs, scaling and project-scoped asset requests. Asset reads of the projection run off the window thread; a late asset answer of an older projection changes nothing. |
| P2 Text and undo | Edit a paragraph and a heading. Connect source ranges, caret mapping and one shared undo and redo history. | Only the intended source changes. Stale edits leave the current document and history intact. |
| P3 CSS and toolbar | Add admitted project stylesheets and dependencies, then the basic formatting, list, link and picture tools. Add tables, alignment, colour and the title field after the basic controls, subject to E3 and E4. | Relative addresses from a subpage work. The existing checked picture picker and copy flow are used. Late dialog results are tied to the initiating document. |
| P4 Code formatting | Compare the source and candidate rendering using the protected projection. Establish equivalence for the current revision and stable, admitted dependencies before applying the candidate. | A bounded wait for resources. Keep the source unchanged if dependencies fail, comparison is inconclusive, or a newer edit arrives. Verify external project CSS separately. |
| P5 Independent review | Review the integrated projection boundary and all paths that can lose or misapply a pupil's text. | Record mock and native results separately. School computer and SMB checks are required before classroom use. |

### Initial regression cases

- In `<p id='a'>Hallo Welt</p><!-- bleibt -->` replace only “Welt” with “Klasse” in the page pane. The quotes and comment are retained. Undo restores the exact source.
- Type in the page pane, then save or close immediately. The valid edit is included. If typing continues during the save, the later text remains in the editor and close asks again.
- Switch documents during a picture selection or another pending operation. The old result changes neither the current text nor its history or saved state.
- Open, edit, save and reopen `Übungen/Grüße #1/100% Süß.html`. Check relative images and CSS, the URL produced by the picture dialog, and a quick second open. The visible names remain readable. Repeat in both modes when the relevant asset types are supported.
- Include local assets from neighbouring folders inside the project. Verify under Windows that both modes block access outside the project and external web requests and prevent active pupil content.

Source mapping, targeted edits and history can be tested in Chromium with the mock host. WebView2 focus, layout, real asset requests, file dialogs and native save timing require a Windows test build.

## 6. Decisions

| Item | State |
| --- | --- |
| E1 Number of WebView2 views | Decided on 2026-11-25. Keep two views. |
| E2 Default mode | Proposed. Start in “Ansehen” and offer “Seite bearbeiten”. |
| E3 Toolbar | Proposed. Use the familiar single-file editor command set, delivered in the P3 sequence. |
| E4 Title field | Proposed. Add the existing title field pattern after the basic controls. |
| E5 Shared modules | Proposed. Share by reference and test both products when shared code changes, within the limits of D5 and the 250,000-byte limit (section 2). |
| E6 Replacement of the single-file editor | Open. SPECIFICATION.md keeps the single-file editor in use "until this program is ready". Does stage 1 alone (code and view) replace it in class, or only stage 2? |

The simple validator for unclosed or wrongly nested tags and a toolbar that inserts tags on the code side (SPECIFICATION.md, section 4) are not part of this plan; they follow later or need their own decision.

The existing Chromium editing workarounds remain relevant. The single-file editor's table whitespace cases F7 and F8 remain open. Crash recovery and autosave are outside this stage.
