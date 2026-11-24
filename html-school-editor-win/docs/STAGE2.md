# Plan for stage 2: editing on the page side and "Code aufräumen"

**State:** plan of 2026-11-24 for the owner's decision. Nothing of it is built. Stage 1 (0.1.0-alpha.1) is not yet built on Windows either.

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

## 3. Architecture change: one WebView2 instead of two (decision E1)

Stage 1 has two WebView2 views: the interface and, laid over it, the page view. For editing, the editing core (JavaScript) must reach the page's document. Across two views that is not possible without opening the page view to scripts.

Proposal: **one WebView2**, the page side as a frame inside the interface, as in the single-file editor, but with both under the project's own address:

* The interface is served at `https://projekt.example/__hse__/index.html` (a reserved folder name; a project folder of that name is refused).
* The page side is a frame with `sandbox="allow-same-origin"` (no scripts of the page, as in the single-file editor) whose document lives at the page's own address, for example `https://projekt.example/seiten/tiere.html`. Same origin as the interface, so the editing core can work in it; relative addresses resolve from the page's real place.
* The C++ core keeps serving every request of the one view, refusing the network, reporting missing files and case differences.

What it changes in stage 1 (before the first build, so nothing built is lost):

* Simpler native code: no second view, no layout messages, no hiding of the page view while a dialog is open (an HTML dialog can lie over the frame).
* Shortcuts work everywhere without forwarding.
* "So zeigt es der Browser" stays true: in the mode "Ansehen" the frame loads the page itself (scripts off), exactly as now.

Risk: the interface and the page share an origin. Page scripts never run (sandbox without `allow-scripts`, plus a `script-src 'none'` header on every page response), so a page cannot reach the interface. The independent review must check exactly this.

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
| P0 | One view (E1) | C++: interface under `/__hse__/`, one controller, response headers with `script-src 'none'` for pages; interface: frame instead of layout messages | stage 1 tests adapted; review point "same origin" |
| P1 | Projection | shell document, address resolution from the shell, project style sheets; mode switch (E2) | ported cases of the single-file editor for projection and safety (X-01 … X-08, A3, A5 projection cases) |
| P2 | Editing and synchronisation | carry over the synchronisation of `app.js`: commit of the page side, undo across both sides, caret mapping, locked pages (unclosed tags) | ported cases T-01 … T-17, R-01, R-02, A7 … A11 (Chromium only) |
| P3 | Toolbar | the commands of the single-file editor; link dialog; picture dialog through the C++ file dialog with relative address (stage 1 function); table, alignment, colour | ported cases F-01 … F-16, B2-05 |
| P4 | "Code aufräumen" | `format` plus the layout check in a hidden frame built like the page side, now with project style sheets | ported format cases, new case with an external project style sheet |
| P5 | Review | independent review of P0 to P4, with the focus on the shared origin and on lost text | — |

All of P0 to P4 runs in headless Chromium with the mock of the core (as the stage 1 interface tests do), because the editing happens inside one browser page. Only file access, dialogs and the request handler need Windows; those are covered by the acceptance tests against a test build.

Order: P0 first, before the first build of stage 1, because it removes code that would otherwise be built, tested and thrown away. Then stage 1 is built and tried in class; P1 to P4 follow.

## 6. Decisions for the owner

| # | Question | Proposal |
| --- | --- | --- |
| E1 | One WebView2 with the page as a same-origin frame, already for stage 1? | yes, before the first build |
| E2 | Page side editable always, or by a switch "Seite bearbeiten" that is off when a page opens? | switch, off |
| E3 | Toolbar on the page side: the full set of the single-file editor (paragraph, headings 1–3, bold, italic, underline, superscript, subscript, marker, colour, lists, table, alignment, link, picture)? | the full set, unchanged, so the class knows it |
| E4 | Title field above the page side, as in the single-file editor? | yes |
| E5 | Share the modules of the single-file editor by reference (one copy, tests of both folders) or copy them (two copies that drift apart)? | by reference |

## 7. What this plan does not solve

* The defects of Chromium's own editing engine that the single-file editor works around (B1) stay worked around, by the same code; others may appear only in real lessons.
* F7 and F8 (white space left in tables) of the single-file editor remain open in the shared code.
* A recovery after a crash (autosave) is not part of stage 2.
