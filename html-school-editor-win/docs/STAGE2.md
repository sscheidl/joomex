# Plan for stage 2: editing on the page side and "Code aufräumen"

**State (2026-11-26).**

* **Stage 1 is on `main`.** It was merged as 0.1.0-alpha.14 through PR #26 and PR #27 (`c8b09fa`), after the independent re-review of alpha.14 found it READY TO MERGE. The editor is NOT READY for pupils' files; section 7 lists what is missing.
* **P0 is done: the stage 2 pilot is on `main`.** It was merged as 0.1.0-alpha.16 through PR #29 (`ea99acc`) on 2026-11-27, after Codex's re-review of alpha.16 concluded READY TO MERGE for P0.
  * Codex's pilot (`2f43a27`, built on alpha.12) was brought over with the alpha.13 and alpha.14 handover.
  * Two corrections came with it. alpha.15 applies a page-side edit that is still open before saving and closing. alpha.16 stops saving and closing when a typed title cannot be applied.
  * **Next is P1.** Codex's native frame probes on alpha.15 found no script running, 0 external requests, and outside images blocked, also through a junction. Still to do: a complete network measurement, focus, Tab and scaling, and the open findings of Claude's review of the pilot (S2-2 to S2-5, listed in PR #29).
* **Decisions.** E1 to E6 are decided (section 8).

## 1. Goal

As in the single-file editor 1.0.0-beta.3, pupils can write on the page side:

* type text;
* set headings, bold, lists, links, pictures, tables, alignment and colour.

The code on the left follows and changes only what was edited. "Code aufräumen" indents the code, and only if the page looks exactly the same afterwards.

What the Windows program does better than the single-file editor, because the page loads from its real place in the project folder:

* Pictures and style sheets of the page appear on the page side as in the browser, also from subfolders and through `../`. The single-file editor shows them only from its own folder.
* "Code aufräumen" can also check pages that use an external style sheet of the project. The single-file editor refuses these.
* There is only one engine, Chromium in WebView2. The Firefox defects of the single-file editor (B2, B3, B4 and the downloads) do not apply.

## 2. What is shared with the single-file editor

The single-file editor's modules are our own code under MIT, with 106 tested cases behind them. The Windows program serves them by reference from `../html-school-editor/src/js/` through `ui/resources.json`.

| Module | Task | Use in the Windows program |
| --- | --- | --- |
| `util`, `tokenizer`, `highlight`, `history` | text, tokens, colours, undo | shared since stage 1 |
| `tree` | position tree with source offsets | shared unchanged |
| `project` | compares the browser's parser with the position tree, builds the safe projection, maps positions | shared; the Windows program supplies the page base and the asset policy |
| `serialize` | page side → code, with a minimal rewrite | shared unchanged |
| `commands`, `images` | the toolbar commands and the picture checks | shared; file choice and copying go through the existing native dialogs and copy flow of stage 1 |
| `format` | "Code aufräumen" | shared; its layout check is adapted to the Windows projection (P4) |
| `app.js` | synchronisation, browser file access, dialogs, top bar | **not shared**; its synchronisation part is carried over into `ui/js/visual.js`, together with the cases that test it |

**Limits from the single-file editor (D5).**

* It stays in class with defect corrections only. A shared module changes there only in one of two ways: through new code that the single-file editor does not use, or through a defect correction that both products need.
* Its delivered file must stay at or below 250,000 bytes. beta.3 was 196,056 bytes. Every change to a shared module is measured against that limit.
* Changes to shared modules run through both test suites.

**Test cases.** Choose focused cases from the [single-file editor acceptance results](../../html-school-editor/docs/ACCEPTANCE_RESULTS.md):

* RV-01, late events;
* RV-02, formatting;
* RV-03, attributes are kept;
* RV-04, resources stopped by the policy are announced.

That file is a source of cases, not evidence for the Windows program.

## 3. Two WebView2 views stay (E1, decided 2026-11-25)

Stage 1 has two WebView2 views: the interface, and the page view laid over it. Both stay in stage 2. The owner decided this on 2026-11-25, after the Codex review of stage 1 advised against a single view. A frame that keeps the interface's origin shares its storage and capabilities as soon as active content gets through.

**The raw page.** It stays in the isolated page view, on its own origin and controller, under the stage 1 request policy. It is used as the automatic fallback when direct editing is not possible (section 4).

**The editing projection.** The interface edits a filtered projection inside a fixed, app-owned, sandboxed frame. DOM access from the interface requires that this frame shares the interface's origin, so the frame's origin alone separates nothing. The trust boundary is four layers together, and each has to hold on its own:

1. the projection filter;
2. the frame's sandbox;
3. the frame document's content policy;
4. the native project check of every asset request.

The rules for these layers:

* The frame's sandbox never contains `allow-scripts`. The frame document carries its own restrictive CSP. Its URL, origin and sandbox tokens are stated in ARCHITECTURE.md.
* The projection is built from admitted elements and attributes only. Raw pupil markup is never inserted with `innerHTML`, or by any other parse that can load or run something. Active or unsupported parts stay in the source, with a note or placeholder in the projection where that helps.
* Privileged messages are accepted only from the interface's own top-level document. `window.name` and named browsing contexts are never used for authorisation.

**Assets of the projection.** These are requests of the interface view. They use their own branch of the request handler, separate from the interface's own resources and the native bridge.

* Each request gets the same project boundary check as the page view (`CheckedFile`). The file is read on the preview workers, never on the window thread.
* Each answer is tied to the current project, document and projection generation. A late answer for an older projection changes nothing.
* The policy applies from the first parse, including any auxiliary parse. Only project assets of the expected type load, against a base that the app sets for the current page. Changing project or document revokes the previous context.
* Project CSS also needs its imports, fonts and nested URLs checked against the same boundary. Each style sheet keeps its own base.

## 4. Direct editing (E2, decided by the owner on 2026-11-26)

There is no mode button. When a page opens, the right side is editable at once if the projection can show it. Otherwise the editor falls back automatically to the read-only page view.

| State | Right side | Editable |
| --- | --- | --- |
| **Direct editing** | the filtered projection in the fixed frame; relative addresses resolve from the page's place in the project | yes |
| **Automatic fallback** | the stage 1 page view of the current source; a short note says why it is read-only | no, edit the code on the left |

**What stays the same.**

* The code field stays editable in both states.
* A picture or style sheet keeps its address in the source.
* "Im Browser ansehen" opens the saved page in the standard browser, where scripts and links work.

**Consequences of having no mode button.**

* **Links (owner's decision, 2026-11-26).** A click in the page sets the caret and never follows a link. The first version has no extra gesture such as Ctrl+click. Other project pages open from the list on the left, and "Im Browser ansehen" is the way to try out the links of the saved page.
* The editable projection is filtered (no scripts, forms or frames). The exact page appears only in the browser.

## 5. Editing and saving: what stage 1 promises and stage 2 must keep

**One document.** The page side edits the same document state as the code field: the text and the kind of every line break, through the same history of raw texts.

* The code field gets one named entry point for changes from the page side, taking a range, the new text and the revision. The change runs through its history and `breaks.follow`. The page side never sets the whole text.
* The byte comparisons F-07 to F-10 are repeated with changes made on the page side. This includes a delayed save acknowledgement, undo to an unsaved step, and two line breaks that meet after a deletion (F-10).

**Edits apply only where they belong.** A visual edit applies only when its source range maps to the current project, open document and text revision. If the source changed first, or the range is ambiguous, the current source is kept and the projection is rebuilt from it. Parts whose mapping is uncertain can be read-only.

**Pending edits are not lost.** A valid pending edit on the page side is applied before any decision about saving or closing, in each of these cases:

* saving;
* a rescue copy (F-15);
* opening another page;
* changing the project folder;
* closing;
* a logoff query (F-12).

The checks for unsaved text then see the result. Cancelling keeps the document, its text and its history. A late save confirmation still records only the bytes that save sent.

**Stage 1 rules the page side must follow.**

* **Locks:** while a page is being opened or created (`opening`), the page side accepts no edit.
* **One system dialog per window (X-07):** the picture and link dialogs of the page side use the stage 1 claim and `dialogDone`.
* **Answers belong to their request:** picker results carry the operation number of their request and the document they were started for (F-14, `state.picture`).
* **Questions take turns:** a close request during another question is kept and answered after it (F-04).
* **Logoff (F-12):** the Windows host refuses the query as long as text could still be lost. The `opened` / `seq` handover and its acknowledgement `seen` stay as they are in alpha.14: a page counts as open from the moment the core hands it over until the interface has taken or refused it, and building the projection or falling back must not report "no page" meanwhile. After refusing, the host asks the interface to close. The interface first applies a pending page-side edit, and only then decides between the save question and closing at once.

## 6. Work packages

| # | Package | Contents | Acceptance |
| --- | --- | --- | --- |
| P0 | Stage 1 baseline | **Done:** the independently reviewed candidate 0.1.0-alpha.14 on `main`, and the pilot brought onto `main` with the alpha.13 and alpha.14 handover (`seq` / `seen`) as 0.1.0-alpha.15 and alpha.16 (PR #29). Merged as 0.1.0-alpha.16 through PR #29 after Codex's re-review (READY TO MERGE). | All stage 1 tests pass on the rebased pilot: 100 core checks, the UI suite (41 tests on `main`) and the pilot's own tests. Codex's alpha.12 to alpha.14 F-12 probes pass natively on the pilot, together with one new probe: text typed on the page side and not yet applied, then a logoff query with the interface's reports held back. The query is refused, the edit is applied, and the save question appears with the text kept. |
| P1 | Projection and trust boundary | The filtered projection in the fixed frame, address resolution, admitted project style sheets, the asset branch of the request handler, and the automatic fallback (E2). **An independent review of the trust boundary before integration.** | Ported projection and safety cases of the single-file editor (X-01 to X-08, the A3 and A5 projection cases). Natively: no request outside the project and no active content; asset reads off the window thread; a late asset answer of an older projection changes nothing; focus, Tab, Ctrl+S and scaling are checked visibly. |
| P2 | Editing and synchronisation | Commits from the page side, undo across both sides, caret mapping, and locked parts (unclosed tags). | Ported cases T-01 to T-17, R-01, R-02 and A7 to A11 (Chromium only). The regression cases below. F-07 to F-10 through the page side. |
| P3 | Toolbar | The pilot's basic toolbar (E3) completed and tested: link dialog; picture dialog through the native dialog and copy flow with a relative address; table, alignment and colour; the title field (E4). Advanced table, link and picture editing are work packages of their own after P3. | Ported cases F-01 to F-16 and B2-05. Late dialog results are tied to the initiating document. X-07 with the new dialogs. |
| P4 | "Code aufräumen" | `format`, plus the layout check in a hidden frame built like the projection, now with project style sheets. | A bounded wait for resources. The source is kept if dependencies fail, the comparison is inconclusive, or a newer edit arrives. A new case with an external project style sheet. |
| P5 | Independent review | Review of P0 to P4 after integration, focused on the projection boundary and every path that can lose or misapply a pupil's text. | Mock results and native results are recorded separately. |

Editing happens inside one browser page, so source mapping, targeted edits and history are tested in headless Chromium with the mock of the core, like the stage 1 interface tests. File access, dialogs, the request handler, WebView2 focus and layout, and native save timing need a Windows test build.

**Version.** Every change gets its own version (RULES.md). Stage 2 continues the stage 1 numbering after alpha.14, so the pilot on `main` becomes 0.1.0-alpha.15 or later.

### Regression cases

* In `<p id='a'>Hallo Welt</p><!-- bleibt -->`, replace only "Welt" with "Klasse" on the page side. The quotes and the comment are kept, and undo restores the exact source.
* Type on the page side, then save or close at once. The valid edit is included. If typing goes on during the save, the later text stays in the editor and closing asks again.
* Switch documents during a picture selection or another pending operation. The old result changes neither the current text nor its history or saved state.
* Open, edit, save and reopen `Übungen/Grüße #1/100% Süß.html`. Relative images and CSS appear, the picture dialog produces the right address, and a quick second open works. The visible names stay readable. Repeat in direct editing and in the fallback.
* Include local assets from neighbouring folders inside the project. Under Windows, check that access outside the project and web requests are blocked and that active pupil content never runs.
* Type on the page side, then send a logoff query while the interface's reports are held back (Codex's F-12 probe). The query is refused, the save question appears, and the text stays. Repeat with the first page of the session, a new page, and a page in another encoding.

## 7. Before use with pupils' files (stage 1, still open)

* A real Windows logoff and a session that ends without asking (F-12).
* A network share, both as a mapped drive and as a UNC path: R-08, F-01 to F-03, F-06, F-13, and F-15 while the share really stalls; also ACLs and attributes after replacing a file.
* The release build: P-05 and X-03, with a full trace of what the program writes.
* "Im Browser ansehen" (`ShellExecuteW`) and the command-line file check still run on the window thread. A blocked share can keep the process alive after the window closes.
* B7: the builds are not reproducible. B8: a `target=_blank` link does nothing and gives no hint.
* Owner only: X-01 (start from the school server without administrator rights), X-04 (texts with a class), the school computer and its share.

## 8. Decisions

| # | Question | State |
| --- | --- | --- |
| E1 | One WebView2 or two? | **Decided 2026-11-25:** two views stay (section 3). |
| E2 | How does editing start? | **Decided by the owner, 2026-11-26:** directly, with no mode button, and an automatic read-only fallback (section 4). |
| E3 | Which toolbar commands? | **Decided by the owner, 2026-11-26:** the basic toolbar as in the pilot, which is paragraph, headings 1 to 3, bold, italic, underline, superscript, subscript, mark, both lists, link, remove link, picture, basic table, alignment and colour. Advanced table, link and picture editing are work packages of their own. |
| E4 | Where is the title field? | **Decided by the owner, 2026-11-26:** above the editable page, in the same undo history as the HTML code. |
| E5 | How are modules shared? | **Decided by the owner, 2026-11-26:** by reference through `ui/resources.json`. Every change to a shared module runs both test suites and the single-file editor's 250,000-byte check (section 2). |
| E6 | When does the Windows editor replace the single-file editor in class? | **Decided by the owner, 2026-11-26.** Only stage 2 replaces it in regular lessons, and only after two steps: the release for pupils' files (section 7) and a pilot lesson with a typical class task. After the release for pupils' files, stage 1 may be used for lessons focused on HTML. Until then the single-file editor stays in class (D5). |

### Local pilot evidence (pilot `2f43a27`, based on alpha.12)

* **MEASURED, 2026-11-26** (Codex; Windows 11 26300.10075, WebView2 `Edg/158.0.4370.45`). On a disposable `seiten/käse.html`, the native test build did the following:
  * loaded an image and a style sheet through `../`;
  * accepted direct typing;
  * applied shared undo and redo;
  * changed the page title;
  * saved the expected bytes, including the UTF-8 BOM and mixed line breaks.

  Test build SHA-256 `96fe45e29921e885f7f32d03eb20fcce762736c8bae477d156344b5cb93a8f11`.
* **MEASURED.** The release pilot started and closed normally, did not open the test port, and added nothing next to the executable. Release SHA-256 `06d8aeb941e0b07a8435fa92581f99bddf7604eb6797483e69efef930bf10ed4`.
* **MEASURED.** The single-file editor's 27 unit tests and six Edge cases (T-02, T-04, T-05, T-06, T-09, T-13) passed. Its sources were identical to the base revision. The complete multi-browser run did not finish.
* **NOT MEASURED.**
  * The pilot on `main`, and therefore the logoff handover of alpha.13 and alpha.14.
  * An independent review of the projection.
  * Extended editing acceptance.
  * The size of the single-file editor's delivered file with the shared modules.

## 9. Not part of this plan

* The defects of Chromium's own editing engine that the single-file editor works around (B1) stay worked around, by the same code. Others may appear only in real lessons.
* F7 and F8 of the single-file editor (white space left in tables) remain open in the shared code.
* A recovery after a crash (autosave) is not part of stage 2.
* The simple validator for unclosed or wrongly nested tags, and a toolbar that inserts tags on the code side (SPECIFICATION.md section 4), come later or need their own decision.
