# Plan for stage 2: editing on the page side and "Code aufräumen"

**State:** plan of 2026-11-24, updated 2026-11-25. Nothing of it is built. Stage 1 is built and run on Windows. **E1 is decided: two WebView2 views stay** (owner, 2026-11-25, after the Codex review of stage 1); E2 to E5 are still open.

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

* The raw page stays in the isolated page view, on its own origin and controller, exactly as in stage 1 ("Ansehen").
* For editing, the trusted interface gets DOM access only to a separately served, filtered projection of the page (only admitted local assets of the right type, no uncontrolled base addresses or navigation, the policy enforced from the first parse). Active or unsupported content stays in the pupil's source with a visible placeholder in the projection.
* The interface authorises privileged messages only from its own top-level document; `window.name` and named browsing contexts are never used for authorisation.

## 4. Two modes of the page side (decision E2)

| Mode | What the frame shows | Edit |
| --- | --- | --- |
| **Ansehen** (stage 1) | the page as the browser shows it: the C++ core serves the current text at the page's address | no |
| **Bearbeiten** (stage 2) | the single-file editor's safe projection of the page, built in a fixed shell document that the core serves at the page's address (so its base address is the page's place) | yes |

In "Bearbeiten" the projection works as in the single-file editor; the only new piece is the way addresses resolve: instead of reading files from the editor's folder, a picture or style sheet keeps the address as written and the browser resolves it from the shell's address. Project style sheets (`<link rel="stylesheet">` inside the project) are applied in the projection; the single-file editor leaves them out.

Proposal for the switch: a button "Seite bearbeiten" above the page side, **off when a page is opened**, so that pupils write code first; the teacher decides when the class uses it. Alternative: always editable, as in the single-file editor.

## 5. Work packages

| # | Package | Contents | Tests |
| --- | --- | --- | --- |
| P0 | Stage 1 corrections | the open findings of the Codex review of stage 1 (file boundary, protection of the page view, threads and lifetime, stale requests) and a small native acceptance baseline (DevTools against the test build) | native acceptance tests; review of every change to the trust boundary or the save lifecycle where it is made |
| P1 | Projection | filtered projection served apart from the raw page, its trust boundary (reviewed before merging), address resolution, admitted project style sheets; mode switch (E2) | ported cases of the single-file editor for projection and safety (X-01 … X-08, A3, A5 projection cases) |
| P2 | Editing and synchronisation | carry over the synchronisation of `app.js`: commit of the page side, undo across both sides, caret mapping, locked pages (unclosed tags) | ported cases T-01 … T-17, R-01, R-02, A7 … A11 (Chromium only) |
| P3 | Toolbar | the commands of the single-file editor; link dialog; picture dialog through the C++ file dialog with relative address (stage 1 function); table, alignment, colour | ported cases F-01 … F-16, B2-05 |
| P4 | "Code aufräumen" | `format` plus the layout check in a hidden frame built like the page side, now with project style sheets | ported format cases, new case with an external project style sheet |
| P5 | Review | independent review of P0 to P4 after integration, with the focus on the trust boundary of the projection and on lost text | — |

All of P0 to P4 runs in headless Chromium with the mock of the core (as the stage 1 interface tests do), because the editing happens inside one browser page. Only file access, dialogs and the request handler need Windows; those are covered by the acceptance tests against a test build.

Order: P0 first (stage 1 is corrected and has its native acceptance baseline before stage 2 starts), then P1 with a review of its trust boundary, then P2 (synchronisation and undo), P3 (toolbar) and P4 (formatting checks).

### Line breaks and the byte promise (owner's decision of 2026-11-25)

Stage 1 keeps every line break as read (`ui/js/breaks.js`; criteria F-07 to F-10). The page side edits the same document state as the code field: the text together with the kind of every break, through the same history of raw texts. Its commits must therefore go through the code field's change path (so breaks outside the change stay and new breaks follow the local kind), never by writing a new text from the page side alone. The byte comparisons F-07 to F-10 are repeated with changes made on the page side, including the case of two breaks that meet after a deletion (F-10). The two WebView2 views of stage 1 are unchanged by this.

## 6. Decisions for the owner

| # | Question | Proposal |
| --- | --- | --- |
| E1 | One WebView2 with the page as a same-origin frame, or two views? | **decided 2026-11-25: two views stay** (section 3) |
| E2 | Page side editable always, or by a switch "Seite bearbeiten" that is off when a page opens? | switch, off |
| E3 | Toolbar on the page side: the full set of the single-file editor (paragraph, headings 1–3, bold, italic, underline, superscript, subscript, marker, colour, lists, table, alignment, link, picture)? | the full set, unchanged, so the class knows it |
| E4 | Title field above the page side, as in the single-file editor? | yes |
| E5 | Share the modules of the single-file editor by reference (one copy, tests of both folders) or copy them (two copies that drift apart)? | by reference |

## 7. What this plan does not solve

* The defects of Chromium's own editing engine that the single-file editor works around (B1) stay worked around, by the same code; others may appear only in real lessons.
* F7 and F8 (white space left in tables) of the single-file editor remain open in the shared code.
* A recovery after a crash (autosave) is not part of stage 2.
