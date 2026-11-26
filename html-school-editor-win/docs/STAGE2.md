# Plan for stage 2: editing on the page side and "Code aufräumen"

**State:** Stage 2 local pilot based on Stage 1 Alpha.12. **E1: two WebView2 views stay. E2: the page opens for direct editing.** The pilot covers the basic toolbar, shared source and page undo, and the title field. The deployment decision (E6) is open.

## 1. Goal

As in the single-file editor 1.0.0-beta.3, pupils can also write on the page side: type text, set headings, bold, lists, links, pictures, tables, alignment and colour, and the code on the left follows, changing only what was edited. "Code aufräumen" indents the code, only if the page looks exactly the same afterwards.

What the Windows program does better than the single-file editor, because the page loads from its real place in the project folder:

* Pictures and style sheets of the page appear on the page side as in the browser, from subfolders and with `../` (single-file editor: only from the editor's own folder).
* "Code aufräumen" can also check pages with an external style sheet of the project (single-file editor: refused).
* One engine only (Chromium in WebView2): the Firefox defects of the single-file editor (B2, B3, B4, the downloads) do not apply.

## 2. What can be reused

The single-file editor's modules, own code under MIT, with 106 tested cases behind them:

| Module | Task | Reuse |
| --- | --- | --- |
| `util`, `tokenizer`, `highlight`, `history` | text, tokens, colours, undo | already shared in stage 1 |
| `tree` | position tree with source offsets | share unchanged |
| `project` | compares the browser's parser with the position tree, safe projection into the page side, position mapping | share; the projection needs one new way to resolve addresses (section 4) |
| `serialize` | page side → code, minimal rewrite | share unchanged |
| `commands` | all editing commands of the toolbar | share unchanged |
| `format` | "Code aufräumen" | share unchanged |
| `images` | picture checks | share unchanged |
| `app.js` (1,404 lines) | synchronisation, file access through the browser, dialogs, top bar | **not shared**: it is tied to the browser's file access. Its synchronisation part (about a third) is carried over into a new module of the Windows program, with the cases that test it |

Sharing means: the Windows program serves these files from `../html-school-editor/src/js/` (as `ui/resources.json` already does for four of them). D5 says the single-file editor gets defect corrections only; this plan changes nothing there except the one addition in section 4, which is new code that the single-file editor does not use.

## 3. Two WebView2 views stay (decision E1, 2026-11-25)

Stage 1 has two WebView2 views: the interface and, laid over it, the page view. They stay in stage 2.

The proposal of 2026-11-24 was one WebView2 with the page as a frame of the same origin as the interface, so the editing core could reach the page's document. The Codex review of stage 1 advised against it: a frame that keeps the interface's origin shares its storage, cookies, workers and origin-based capabilities as soon as active content gets through, and the sandbox adds no storage boundary for that origin; a reserved URL path routes requests but does not separate authorities. The owner decided on 2026-11-25 to keep two views.

Direction for stage 2 from the review (to be designed in P1, not decided in detail):

* The raw page stays in the isolated page view, on its own origin and controller, as a fallback when direct editing is unavailable.
* The trusted interface edits a filtered projection in a fixed, sandboxed shell. Its response and document policies disable scripts. The UI sets the project base and the native request handler admits project images and style sheets by request context and file type after checking the project boundary. Active or unsupported content stays in the source.
* The interface authorises privileged messages only from its own top-level document; `window.name` and named browsing contexts are never used for authorisation.

## 4. Direct editing on the page side (decision E2)

| Mode | What the frame shows | Edit |
| --- | --- | --- |
| **Direct editing** | a filtered projection in the fixed shell, using the project's page URL as the base for relative addresses | yes |
| **Automatic fallback** | the existing isolated view, using the current source at the original page address | no |

In direct editing, the preview uses the single-file editor's projection, commands and serializer. A picture or style sheet keeps its address in the source. The browser resolves it from the page's position in the project. Project style sheets (`<link rel="stylesheet">` inside the project) are applied in the projection.

The owner chose direct editing without a mode button. The source stays editable in the fallback. “Im Browser ansehen” opens the saved page in the standard browser.

## 5. Work packages

| # | Package | Contents | Tests |
| --- | --- | --- | --- |
| P0 | Stage 1 corrections | the open findings of the Codex review of stage 1 (file boundary, protection of the page view, threads and lifetime, stale requests) and a small native acceptance baseline (DevTools against the test build) | native acceptance tests; review of every change to the trust boundary or the save lifecycle where it is made |
| P1 | Projection | filtered projection served apart from the raw page, its trust boundary (reviewed before merging), address resolution, admitted project style sheets and automatic fallback (E2) | ported cases of the single-file editor for projection and safety (X-01 … X-08, A3, A5 projection cases) |
| P2 | Editing and synchronisation | carry over the synchronisation of `app.js`: commit of the page side, undo across both sides, caret mapping, locked pages (unclosed tags) | ported cases T-01 … T-17, R-01, R-02, A7 … A11 (Chromium only) |
| P3 | Toolbar | the commands of the single-file editor; link dialog; picture dialog through the C++ file dialog with relative address (stage 1 function); table, alignment, colour | ported cases F-01 … F-16, B2-05 |
| P4 | "Code aufräumen" | `format` plus the layout check in a hidden frame built like the page side, now with project style sheets | ported format cases, new case with an external project style sheet |
| P5 | Review | independent review of P0 to P4 after integration, with the focus on the trust boundary of the projection and on lost text | — |

All of P0 to P4 runs in headless Chromium with the mock of the core (as the stage 1 interface tests do), because the editing happens inside one browser page. Only file access, dialogs and the request handler need Windows; those are covered by the acceptance tests against a test build.

Before the Stage 2 integration, close P0 and independently review the projection boundary and save lifecycle. The local pilot exercises P1, P2 and the basic P3 commands. P4 remains separate.

### Line breaks and the byte promise (owner's decision of 2026-11-25)

Stage 1 keeps every line break as read (`ui/js/breaks.js`; criteria F-07 to F-10). The page side edits the same document state as the code field: the text together with the kind of every break, through the same history of raw texts. Its commits must therefore go through the code field's change path (so breaks outside the change stay and new breaks follow the local kind), never by writing a new text from the page side alone. The byte comparisons F-07 to F-10 are repeated with changes made on the page side, including the case of two breaks that meet after a deletion (F-10). The two WebView2 views of stage 1 are unchanged by this.

## 6. Decisions for the owner

| # | Question | Proposal |
| --- | --- | --- |
| E1 | One WebView2 with the page as a same-origin frame, or two views? | **decided 2026-11-25: two views stay** (section 3) |
| E2 | How does editing start? | Directly on opening a page, with automatic read-only fallback for unsupported source. |
| E3 | Which toolbar commands are available? | The pilot includes paragraph, headings 1–3, emphasis, colour, lists, alignment, links, pictures and basic table creation. Advanced link, image and table editing remain part of P3. |
| E4 | Where is the title field? | Above the editable page. A title change follows the same undo history as source and page changes. |
| E5 | How are editing modules shared? | By reference through `ui/resources.json`. Verify changes against both editors. |
| E6 | When does the Windows editor replace the single-file editor in class? | Open. |

### Local pilot evidence

- **MEASURED, 2026-11-26.** Windows 11 26300.10075 and WebView2 `Edg/158.0.4370.45`. On a disposable `seiten/käse.html` fixture, the native test build loaded an image and stylesheet via `../`, accepted direct typing, applied shared undo and redo, changed the page title and saved the expected bytes, including the UTF-8 BOM and mixed line breaks. Test executable SHA-256 `96fe45e29921e885f7f32d03eb20fcce762736c8bae477d156344b5cb93a8f11`.
- **MEASURED.** The Release pilot started and closed normally, did not open the requested test port and added no entry next to the executable in the smoke run. Release SHA-256 `06d8aeb941e0b07a8435fa92581f99bddf7604eb6797483e69efef930bf10ed4`.
- **MEASURED.** The single-file editor's 27 unit tests and six selected Edge cases (T-02, T-04, T-05, T-06, T-09, T-13) passed. The complete multi-browser run did not finish. The single-file editor's sources were identical to the base revision.
- **NOT MEASURED.** The native pilot used local test files. An independent review of the editing projection, extended editing acceptance, real sign-out and SMB acceptance are outstanding. The pilot inherits the unresolved Alpha.12 session-end handoff.

## 7. What this plan does not solve

* The defects of Chromium's own editing engine that the single-file editor works around (B1) stay worked around, by the same code; others may appear only in real lessons.
* F7 and F8 (white space left in tables) of the single-file editor remain open in the shared code.
* A recovery after a crash (autosave) is not part of stage 2.
