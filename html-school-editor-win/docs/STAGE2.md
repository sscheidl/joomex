# Plan for stage 2 editing and code formatting

**Status.** Draft for review, updated 2026-11-26. E1 is decided. The Windows editor keeps two WebView2 views. E2 to E5 are proposals. Stage 2 implementation follows the independent review of the stage 1 candidate and a local native acceptance run.

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

Select focused cases from the [single-file editor acceptance results](../../html-school-editor/docs/ACCEPTANCE_RESULTS.md), including RV-01 for late events, RV-02 for formatting and RV-03 for preserving attributes. Changes to shared modules run through both test suites.

## 3. Two WebView2 views

The second WebView2 loads the raw page at its project address in **Ansehen**, using the stage 1 request policy. Its separate origin and controller keep the raw pupil document out of the application interface. The first WebView2 contains the interface and the native file bridge.

For **Bearbeiten**, the proposed design hides the second view and displays a fixed, app-owned sandboxed frame in the same right-hand area. The interface uses DOM access only for the filtered projection it creates from supported HTML elements and attributes. The frame has no native file bridge. Privileged messages are authorised only from the trusted top-level UI document. Active or unsupported parts stay in the original source, with a note or placeholder where useful in the projection.

The asset policy applies from the first parse, including any auxiliary parse. Only admitted project assets of the expected type may load, with a base set by the app for the current page. Project and document changes revoke the previous context. The first native prototype uses local images. Allowing project CSS also requires checking imports, fonts and nested URLs against the same project boundary while preserving each stylesheet's own base.

## 4. Editing and saving

The proposed “Seite bearbeiten” switch starts in **Ansehen** when a page opens. **Bearbeiten** uses a projection of the current source, including unsaved text. A visual edit applies only when its source range can be mapped to the current project, open document and text revision. If the source changes first or the range becomes ambiguous, preserve the current source and rebuild the projection from it. Affected portions can be read-only when their mapping is uncertain.

Both panes use one document history. A valid pending edit in the page pane is applied before switching to **Ansehen**, saving, opening another page or closing. The existing checks for unsaved changes then use the resulting document state. Cancelling preserves the document, its text and its history. A late save confirmation still records the bytes sent by that save.

Visual changes use the same document update path as source edits, including each stored line ending. Repeat the byte comparisons F-07 to F-10 through the page pane, including delayed save acknowledgement, undo to an unsaved step and two line endings that meet after a deletion.

## 5. Work packages and acceptance

| Package | Scope | Acceptance |
| --- | --- | --- |
| P0 Stage 1 baseline | Record an independently reviewed candidate with native checks for the project boundary, raw preview isolation, paths with special characters and the open, save and close lifecycle. Prepare mock cases and fixtures while the review runs. | [Stage 1 criteria](ACCEPTANCE.md) and a recorded Windows build. Verify startup and SMB behaviour on the school setup before use with pupils' files. |
| P1 Native prototype | Switch between the two modes in the existing right side, render a filtered page and load a local image. Review the projection's trust boundary before integration. | Visible Windows check of focus, Tab, Ctrl+S, dialogs, scaling and project-scoped asset requests. |
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
| E5 Shared modules | Proposed. Share by reference and test both products when shared code changes. |

The existing Chromium editing workarounds remain relevant. The single-file editor's table whitespace cases F7 and F8 remain open. Crash recovery and autosave are outside this stage.
