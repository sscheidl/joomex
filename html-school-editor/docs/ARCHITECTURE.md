# Architecture

## Files

```
src/app.html          page template (toolbar, panes, dialogs)
src/style.css         styles of the editor chrome
src/js/util.js        escaping, offset mapping, link check, file bytes <-> text      (no DOM)
src/js/tokenizer.js   HTML tokens with source offsets                                (no DOM)
src/js/tree.js        position tree from the tokens, body location                   (no DOM)
src/js/format.js      formatter on the position tree                                 (no DOM)
src/js/highlight.js   syntax colours per source line, line patching
src/js/history.js     undo/redo entries                                              (no DOM)
src/js/images.js      image signature check, object URL for a chosen file
src/js/project.js     analysis (browser parser vs. position tree), safe projection into the preview, position mapping
src/js/serialize.js   preview DOM -> source text
src/js/commands.js    editing commands on the preview DOM
src/js/app.js         state, synchronisation, files, dialogs, event wiring
tools/build.mjs       joins everything into dist/school-editor.html
tests/                unit tests, browser acceptance suite, fixtures, results
```

The modules are ES modules so that the DOM-free ones can be unit-tested in Node. The build removes the import lines and `export` keywords, concatenates the modules in a fixed order inside one function and writes one `<script>` and one `<style>` into the template. It computes the SHA-256 of the script text and puts it into the page's content security policy. The build output is deterministic; `node tools/build.mjs --check` compares it with the committed artefact.

## Data model

There is one authoritative document: `state.text` in `src/js/app.js`, the complete HTML source with LF line ends, and its revision counter `state.rev`. The source field shows exactly this text.

The preview is a projection of one revision, `state.pvRev`. Two flags describe pending work:

* `state.pvRev !== state.rev`: the text is newer than the preview (after typing in the source).
* `state.visualDirty`: the preview DOM is newer than the text (after typing in the page).

The guarded input paths keep the two from being true at the same time. The preview can only be edited while it has the focus, and it is brought up to date when it gets the focus, on pointer-down and, as a last guard, in `beforeinput` (`src/js/app.js:860–878`). The source can only be edited while it has the focus, and pending page edits are committed when it gets the focus and when the preview loses it. JavaScript runs these handlers to completion, so there is no interleaving within them. This is an argument from the input routes that were tried, not a proof for every route an operating system offers; the routes that were not tried are listed in [REVIEW_CODEX.md](REVIEW_CODEX.md).

Timers (`scheduleRender`, `scheduleCommit`) only bring these steps forward while the user pauses. Every operation that reads the text first calls `commitVisual()` (`src/js/app.js:251`): save and download, format (`:596`), undo/redo, new/open (`mayReplace`, `:664`), toolbar commands, `beforeunload`. If these guards were ever skipped, `commitVisual()` refuses to write from an outdated preview and re-renders it; the outdated page edit is then lost and a warning is shown. `onSourceInput()` (`:806`) keeps both versions in the history when both panes changed.

Every replaced document increases `state.docId`, every change of the text increases `state.rev`. An asynchronous operation acts only on the state it was started for:

* **Replacing the document** (New, Open, dropped file). Each operation takes a ticket (`beginReplace`, `src/js/app.js:660`). `mayReplace` (`:664`) is the only way to a replacement: it lets only the newest ticket pass, and only for the document id and revision for which the pupil has accepted the loss of unsaved work. If the text changed since then, also in the page pane, it asks again. The check is the last step before `replaceDocument` (`:631`); nothing is awaited in between. The ticket is taken before the browser's file chooser opens, so choosing and reading a file are covered (`openDoc`, `:723`; `loadFile`, `:686`).
* **Saving** marks only the document it wrote (`markSaved`, `:664`), and the saved state is a text comparison, so later typing stays unsaved.
* **Formatting** remembers id and revision and drops its result if either changed while the layout check ran (`formatDoc`, `:523`).
* **Link and image dialogs** insert only if id and revision are unchanged.

## Source → preview

`analyze()` (`src/js/project.js:87`) parses the text twice:

1. With the browser's `DOMParser`. The result is an inert document: nothing in it runs or loads. It is the truth about how a browser reads the text.
2. With the tokenizer (`src/js/tokenizer.js:63`) and a small tree builder (`src/js/tree.js:30`). Its nodes carry source offsets. The children of a node tile its inner range completely, so writing all children back reproduces the inner text exactly.

`matchKids()` (`src/js/project.js:101`) compares both trees child by child (element names, text after decoding character references). Where they agree, a position-tree node is attached to the DOM node. Where the children of an element disagree, that element is marked as not editable. If the body level disagrees, the whole page is read-only. The tree builder therefore does not need to be a complete HTML parser: what it does not model is detected, not guessed. Its rule set covers void elements, raw-text elements, optional end tags (`p`, `li`, `dt`/`dd`, table parts, headings, options), the implied `tbody`, stray end tags, self-closing tags inside SVG/MathML and a depth limit.

`renderView()` (`src/js/project.js:319`) then updates the preview document. For every DOM node of the parsed document, `describe()` (`:193`) says what the preview should contain: a text node, a comment (also used as invisible stand-in for scripts, `meta`, `link`, `base`, `title`, `template`), a labelled box for frames and media, or an element with filtered attributes. `syncKids()` (`:247`) compares that list with the existing preview children from both ends, updates matching nodes in place and replaces only the middle part. Typing in the source therefore changes one text node of the preview, not the whole document; scroll position and selection stay. For every preview node the WeakMap `info` records its source node and a snapshot (text data or list of children).

The preview frame itself is created once from a fixed shell (`PREVIEW_SHELL`, `src/js/app.js:30`). The opened document is never written into the frame as markup.

## Preview → source

`serializeBody()` (`src/js/serialize.js:292`) writes new text for the body content only; everything before and after the body content is copied from the old text.

For each preview node, `emitNode()` (`:212`) decides:

* The node still equals its snapshot (`isClean()`, `:21`): the source slice of its source node is copied verbatim. This covers untouched paragraphs, inactive scripts, comments and white space.
* A text node from the source was edited: `emitText()` (`:124`) keeps the unchanged beginning and end of the text exactly as written (including character references) and writes only the changed middle. It also undoes two side effects of the browser's editing engine: ordinary spaces turned into no-break spaces, and line breaks at the edge of a text that were dropped.
* An element from the source has changed content: its original start and end tags are copied, its children are written recursively. An omitted end tag is added only if the following element is no longer the original one (`needsEndTag()`, `:93`).
* A new node (created by typing, Enter or a command): `emitNew()` (`:184`) writes it with a fixed vocabulary of tags and attributes. Decorative wrappers without attributes are dropped, addresses are re-checked, and of a `style` attribute only a single `text-align` declaration is written.
* An element from the source whose attributes a command changed: its start tag is copied and only those attributes are patched in (`patchAttrs()`, `src/js/util.js:142`, called at `src/js/serialize.js:248`).

Before writing, `rescueHidden()` (`:243`) puts back invisible stand-ins and formatting line breaks that the browser removed as a side effect of joining or deleting text. Source content without a visible counterpart can only be deleted in the source pane.

A command that removes a line break on purpose (between paragraphs that become neighbouring list items) marks its source node, so that it is not put back.

After every commit the new text goes through `analyze()` and `renderView()` again. Normally this changes nothing in the preview, because the writer mirrors the DOM. Where the writer normalized something, the preview is corrected and the selection is restored from source offsets that the writer recorded for the caret.

## Position mapping

* Preview position → source offset: `srcOffsetOf()` (`src/js/project.js:338`), through the snapshot map and `rawPos()` (`:66`), which converts between decoded text offsets and source offsets across character references.
* Source offset → preview position: `previewPosOf()` (`:348`), a descent through the position tree.
* Used for: marking the source range of the element or selection under the page caret, marking the page element under the source caret (CSS Custom Highlight API, no DOM change, no focus change; `src/js/app.js:285`), caret placement after undo/redo and after normalizing commits.

## Commands

All commands (`src/js/commands.js`) change the preview DOM directly and are then committed like typing, as their own history step. Paragraph/heading renames an element and keeps the mapping to the source element, so its start tag is written back with the attributes as typed (`rename`, `:96`). List commands use the same renaming: a paragraph becomes the list item and is moved into a new list element in the same parent, which cannot produce a list inside a paragraph; an item becomes a paragraph again (`toggleList`, `:186`; `unlist`, `:150`). The writer recognises a renamed element that left its source parent (`src/js/serialize.js:240`) and puts it on its own line. Bold and italic wrap or unwrap text nodes by structure (not by computed style). Typing, Enter and deletion are done by the browser's `contenteditable`; the writer normalizes what the browser produces.

### Attributes of existing elements

The writer copies the start tag of an element from the source text; it does not read attributes back from the page. A command that changes an attribute of such an element therefore leaves a note with the element (`record()`, `src/js/commands.js:110`): a map from attribute name to new value, or to null for removal. `isClean()` treats an element with a note as changed, and the writer applies the note to the original tag text with `patchAttrs()`, using the attribute offsets the tokenizer has recorded (`src/js/tree.js:62`). Three commands use it: changing an image (`changeImage`, `src/js/commands.js:406`), changing the address of a link (`changeLink`, `:430`) and alignment (`setAlign`, `:449`). The note lives until the next render, like the snapshot it belongs to.

### Images

The source names an image by file name. `readImage()` (`src/js/images.js:17`) checks the signature of a chosen file and creates an object URL for a copy that is labelled with the type found by the signature. The session-wide map `files` (`src/js/app.js:54`) keeps these by file name. The projection (`safeAttrs()`, `src/js/project.js:158`) looks at the address of every `img`: if it is a plain relative address whose last segment is a known file name, the page pane gets the object URL as `src` and the written address in `data-se-file`; otherwise the image becomes a box as before. A new image carries the same two attributes, and `emitNew()` writes `data-se-file` as `src`. The address in the source is never given to the browser, so no file next to the editor or the page is ever requested.

## History

`createHistory()` (`src/js/history.js:3`) stores complete text states. There is no second history: the native undo of the text field and of the frame are intercepted (`beforeinput` with `historyUndo`/`historyRedo`, Ctrl+Z/Y) and routed to it.

## Formatting

`formatSource()` (`src/js/format.js:16`) moves white space on the position tree, assuming the default display of HTML elements. Because style rules can change what white space means, `formatDoc()` (`src/js/app.js:596`) applies the result only after three checks:

1. `cssFacts()` (`src/js/project.js:453`) collects every style element and style attribute, resolves CSS comments and escapes, and reports whether a `white-space` declaration with a value outside the collapsing ones occurs anywhere, and whether rules come from a file (`link`, `@import`). Either stops the formatting.
2. Both texts are parsed by the browser and must have the same canonical form (`canonDom()`, `:396`), and the same characters apart from white space.
3. `sameLayout()` (`src/js/app.js:557`) builds a second frame like the page pane (same shell, sandbox, policy, width; animations stopped), renders first the old and then the new text into it with the ordinary projection, and compares `layoutPrint()` (`src/js/project.js:481`): the box of every element and of every rendered piece of text in quarter pixels. White space that is not rendered has no box; white space that is rendered moves a box or has one. The frame is removed afterwards.

The third check is what decides for `display` rules, generated content and anything else the first two cannot know. It sees the layout at the current width of the page pane only.

## Things that are deliberately simple

* Full re-analysis after every change. Measured on a 146,000-character document: 162 keystrokes typed into the page and both panes in sync after about 2 s in total, including the automation overhead (T-12).
* Complete text snapshots in the history, bounded by count and size.
* A complete second rendering for the layout check of "Code aufräumen". Measured on a 140,000-character document with 1,500 paragraphs: about 0.6 s from the click to the formatted text (exploratory run, Edge 157, 2026-11-19).
* No virtual scrolling in the source pane.
