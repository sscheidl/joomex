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
src/js/images.js      image signature check, scaling, data URLs
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

The two cannot be true at the same time. The preview can only be edited while it has the focus, and it is brought up to date when it gets the focus, on pointer-down and, as a last guard, in `beforeinput` (`src/js/app.js:702–720`). The source can only be edited while it has the focus, and pending page edits are committed when it gets the focus (`src/js/app.js:788`) and when the preview loses it (`:707`). JavaScript runs these handlers to completion, so there is no interleaving.

Timers (`scheduleRender`, `scheduleCommit`) only bring these steps forward while the user pauses. Every operation that reads the text first calls `commitVisual()` (`src/js/app.js:239`): save and download (`:597`), format (`:470`), undo/redo (`:338`, `:344`), new/open (`:524`), toolbar commands (`:361`), `beforeunload` (`:795`). If these guards were ever skipped, `commitVisual()` refuses to write from an outdated preview (`:242`) and `onSourceInput()` keeps both versions in the history (`:650`).

Every replaced document increases `state.docId`. Asynchronous operations (file reading, saving, dialogs) remember the id they started with and do nothing to a different document (`markSaved`, `src/js/app.js:580`; `loadFile`, `:536`).

## Source → preview

`analyze()` (`src/js/project.js:84`) parses the text twice:

1. With the browser's `DOMParser`. The result is an inert document: nothing in it runs or loads. It is the truth about how a browser reads the text.
2. With the tokenizer (`src/js/tokenizer.js:63`) and a small tree builder (`src/js/tree.js:30`). Its nodes carry source offsets. The children of a node tile its inner range completely, so writing all children back reproduces the inner text exactly.

`matchKids()` (`src/js/project.js:98`) compares both trees child by child (element names, text after decoding character references). Where they agree, a position-tree node is attached to the DOM node. Where the children of an element disagree, that element is marked as not editable. If the body level disagrees, the whole page is read-only. The tree builder therefore does not need to be a complete HTML parser: what it does not model is detected, not guessed. Its rule set covers void elements, raw-text elements, optional end tags (`p`, `li`, `dt`/`dd`, table parts, headings, options), the implied `tbody`, stray end tags, self-closing tags inside SVG/MathML and a depth limit.

`renderView()` (`src/js/project.js:303`) then updates the preview document. For every DOM node of the parsed document, `describe()` (`:178`) says what the preview should contain: a text node, a comment (also used as invisible stand-in for scripts, `meta`, `link`, `base`, `title`, `template`), a labelled box for frames and media, or an element with filtered attributes. `syncKids()` (`:231`) compares that list with the existing preview children from both ends, updates matching nodes in place and replaces only the middle part. Typing in the source therefore changes one text node of the preview, not the whole document; scroll position and selection stay. For every preview node the WeakMap `info` records its source node and a snapshot (text data or list of children).

The preview frame itself is created once from a fixed shell (`PREVIEW_SHELL`, `src/js/app.js:30`). The opened document is never written into the frame as markup.

## Preview → source

`serializeBody()` (`src/js/serialize.js:271`) writes new text for the body content only; everything before and after the body content is copied from the old text.

For each preview node, `emitNode()` (`:212`) decides:

* The node still equals its snapshot (`isClean()`, `:21`): the source slice of its source node is copied verbatim. This covers untouched paragraphs, inactive scripts, comments and white space.
* A text node from the source was edited: `emitText()` (`:124`) keeps the unchanged beginning and end of the text exactly as written (including character references) and writes only the changed middle. It also undoes two side effects of the browser's editing engine: ordinary spaces turned into no-break spaces, and line breaks at the edge of a text that were dropped.
* An element from the source has changed content: its original start and end tags are copied, its children are written recursively. An omitted end tag is added only if the following element is no longer the original one (`needsEndTag()`, `:93`).
* A new node (created by typing, Enter or a command): `emitNew()` (`:179`) writes it with a fixed vocabulary of tags and attributes. Decorative wrappers without attributes are dropped, `style` attributes are never written, addresses are re-checked.

Before writing, `rescueHidden()` (`:243`) puts back invisible stand-ins and formatting line breaks that the browser removed as a side effect of joining or deleting text. Source content without a visible counterpart can only be deleted in the source pane.

After every commit the new text goes through `analyze()` and `renderView()` again. Normally this changes nothing in the preview, because the writer mirrors the DOM. Where the writer normalized something, the preview is corrected and the selection is restored from source offsets that the writer recorded for the caret.

## Position mapping

* Preview position → source offset: `srcOffsetOf()` (`src/js/project.js:322`), through the snapshot map and `rawPos()` (`:63`), which converts between decoded text offsets and source offsets across character references.
* Source offset → preview position: `previewPosOf()` (`:348`), a descent through the position tree.
* Used for: marking the source range of the element or selection under the page caret, marking the page element under the source caret (CSS Custom Highlight API, no DOM change, no focus change; `src/js/app.js:273`), caret placement after undo/redo and after normalizing commits.

## Commands

All commands (`src/js/commands.js`) change the preview DOM directly and are then committed like typing, as their own history step. Paragraph/heading renames an element and keeps the mapping to the source element, so its attributes are written back verbatim. Lists are built by replacing paragraph elements with a list element in the same parent, which cannot produce a list inside a paragraph. Bold and italic wrap or unwrap text nodes by structure (not by computed style). Typing, Enter and deletion are done by the browser's `contenteditable`; the writer normalizes what the browser produces.

## History

`createHistory()` (`src/js/history.js:3`) stores complete text states. There is no second history: the native undo of the text field and of the frame are intercepted (`beforeinput` with `historyUndo`/`historyRedo`, Ctrl+Z/Y) and routed to it.

## Things that are deliberately simple

* Full re-analysis after every change. Measured on a 146,000-character document: 162 keystrokes typed into the page and both panes in sync after 2.3 s in total, including the automation overhead (T-12).
* Complete text snapshots in the history, bounded by count and size.
* No virtual scrolling in the source pane.
