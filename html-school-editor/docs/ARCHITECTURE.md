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
src/js/images.js      image signature check and size of a chosen file
src/js/project.js     analysis (browser parser vs. position tree), safe projection into the preview, position mapping
src/js/serialize.js   preview DOM -> source text
src/js/commands.js    editing commands on the preview DOM
src/js/app.js         state, synchronisation, files, dialogs, event wiring
tools/build.mjs       joins everything into dist/school-editor.html
tests/                unit tests, browser acceptance suite, fixtures, results
```

The modules are ES modules so that the DOM-free ones can be unit-tested in Node. The build removes the import lines and `export` keywords, concatenates the modules in a fixed order inside one function and writes one `<script>` and one `<style>` into the template. Since 0.1.0-alpha.7 it leaves out lines that are only a `//` comment (owner's decision, to stay below the size limit); it refuses a template literal that spans lines, because only inside one could such a line be part of a string. Comments behind code on the same line stay. It computes the SHA-256 of the script text that is delivered and puts it into the page's content security policy. The build output is deterministic; `node tools/build.mjs --check` compares it with the committed artefact.

## Data model

There is one authoritative document: `state.text` in `src/js/app.js`, the complete HTML source with LF line ends, and its revision counter `state.rev`. The source field shows exactly this text.

The preview is a projection of one revision, `state.pvRev`. Two flags describe pending work:

* `state.pvRev !== state.rev`: the text is newer than the preview (after typing in the source).
* `state.visualDirty`: the preview DOM is newer than the text (after typing in the page).

The guarded input paths keep the two from being true at the same time. The preview can only be edited while it has the focus, and it is brought up to date when it gets the focus, on pointer-down and, as a last guard, in `beforeinput` (`src/js/app.js:1100–1125`). The source can only be edited while it has the focus, and pending page edits are committed when it gets the focus and when the preview loses it. JavaScript runs these handlers to completion, so there is no interleaving within them. This is an argument from the input routes that were tried, not a proof for every route an operating system offers; the routes that were not tried are listed in [REVIEW_CODEX.md](REVIEW_CODEX.md).

Timers (`scheduleRender`, `scheduleCommit`) only bring these steps forward while the user pauses. Every operation that reads the text first calls `commitVisual()` (`src/js/app.js:292`): save and download, format (`:765`), undo/redo, new/open (`mayReplace`, `:837`), toolbar commands, `beforeunload`. If these guards were ever skipped, `commitVisual()` refuses to write from an outdated preview and re-renders it; the outdated page edit is then lost and a warning is shown. `onSourceInput()` (`:1046`) keeps both versions in the history when both panes changed.

Every replaced document increases `state.docId`, every change of the text increases `state.rev`. An asynchronous operation acts only on the state it was started for:

* **Replacing the document** (New, Open, dropped file). Each operation takes a ticket (`beginReplace`, `src/js/app.js:833`). `mayReplace` (`:837`) is the only way to a replacement: it lets only the newest ticket pass, and only for the document id and revision for which the pupil has accepted the loss of unsaved work. If the text changed since then, also in the page pane, it asks again. The check is the last step before `replaceDocument` (`:802`); nothing is awaited in between. The ticket is taken before the browser's file chooser opens, so choosing and reading a file are covered (`openDoc`, `:896`; `loadFile`, `:859`).
* **Saving** marks only the document it wrote (`markSaved`, `:664`), and the saved state is a text comparison, so later typing stays unsaved.
* **Formatting** remembers id and revision and drops its result if either changed while the layout check ran (`formatDoc`, `:523`).
* **Link and image dialogs** insert only if id and revision are unchanged.

## Source → preview

`analyze()` (`src/js/project.js:96`) parses the text twice:

1. With the browser's `DOMParser`. The result is an inert document: nothing in it runs or loads. It is the truth about how a browser reads the text.
2. With the tokenizer (`src/js/tokenizer.js:63`) and a small tree builder (`src/js/tree.js:30`). Its nodes carry source offsets. The children of a node tile its inner range completely, so writing all children back reproduces the inner text exactly.

`matchKids()` (`src/js/project.js:110`) compares both trees child by child (element names, text after decoding character references). Where they agree, a position-tree node is attached to the DOM node. Where the children of an element disagree, that element is marked as not editable. If the body level disagrees, the whole page is read-only. The tree builder therefore does not need to be a complete HTML parser: what it does not model is detected, not guessed. Its rule set covers void elements, raw-text elements, optional end tags (`p`, `li`, `dt`/`dd`, table parts, headings, options), the implied `tbody`, stray end tags, self-closing tags inside SVG/MathML and a depth limit.

`renderView()` (`src/js/project.js:349`) then updates the preview document. For every DOM node of the parsed document, `describe()` (`:215`) says what the preview should contain: a text node, a comment (also used as invisible stand-in for scripts, `meta`, `link`, `base`, `title`, `template`), a labelled box for frames and media, or an element with filtered attributes. `syncKids()` (`:269`) compares that list with the existing preview children from both ends, updates matching nodes in place and replaces only the middle part. Typing in the source therefore changes one text node of the preview, not the whole document; scroll position and selection stay. For every preview node the WeakMap `info` records its source node and a snapshot (text data or list of children).

The preview frame itself is created once from a fixed shell (`PREVIEW_SHELL`, `src/js/app.js:30`). The opened document is never written into the frame as markup.

## Preview → source

`serializeBody()` (`src/js/serialize.js:370`) writes new text for the body content only; everything before and after the body content is copied from the old text.

For each preview node, `emitNode()` (`:212`) decides:

* The node still equals its snapshot (`isClean()`, `:21`): the source slice of its source node is copied verbatim. This covers untouched paragraphs, inactive scripts, comments and white space.
* A text node from the source was edited: `emitText()` (`:124`) keeps the unchanged beginning and end of the text exactly as written (including character references) and writes only the changed middle. It also undoes two side effects of the browser's editing engine: ordinary spaces turned into no-break spaces, and line breaks at the edge of a text that were dropped.
* An element from the source has changed content: its original start and end tags are copied, its children are written recursively. An omitted end tag is added only if the following element is no longer the original one and does not end it just as well: a cell, row, list item, `dt` or `dd` followed by an element of the same kind or by the end of its parent stays without one (`needsEndTag()`, `:122`). New children get the indentation of the first child from the source (`childIndent()`, `:59`); in the parts of a table whose children stand without line breaks they get none, and `freshLine()` (`:46`) then writes no line.
* A new node (created by typing, Enter or a command): `emitNew()` (`:184`) writes it with a fixed vocabulary of tags and attributes. Decorative wrappers without attributes are dropped, addresses are re-checked, and of a `style` attribute only a single `text-align` declaration is written.
* An element from the source whose attributes a command changed: its start tag is copied and only those attributes are patched in (`patchAttrs()`, `src/js/util.js:314`, called at `src/js/serialize.js:312`).

Before writing, `rescueHidden()` (`:313`) puts back invisible stand-ins and formatting line breaks that the browser removed as a side effect of joining or deleting text, with the text they had. Source content without a visible counterpart can only be deleted in the source pane.

Browsers also tidy white space in texts next to the one being edited; Firefox does so while the pupil types. `engineTidied()` (`:138`) recognises such a change of a text that was not edited: emptied line breaks and indentation always, a dropped space at the edge only if it could not be seen (`unseenEdge()`, `:123`) and only while the pending input consisted of insertions (`state.onlyInserts`, set from the input events in `src/js/app.js:1117`). The text is then written as it stands in the source. After a deletion the same change counts as an edit, so a gap can still be closed on purpose. A single `<br>` standing alone directly in the page is the line break a browser keeps for itself in a page without visible content; it is never written (`paddingBreak()`, `src/js/serialize.js:76`), and the projection never takes such a node over as one of its own (`src/js/project.js:275`).

A command that removes a line break on purpose (between paragraphs that become neighbouring list items) marks its source node, so that it is not put back.

After every commit the new text goes through `analyze()` and `renderView()` again. Normally this changes nothing in the preview, because the writer mirrors the DOM. Where the writer normalized something, the preview is corrected and the selection is restored from source offsets that the writer recorded for the caret.

## Position mapping

* Preview position → source offset: `srcOffsetOf()` (`src/js/project.js:368`), through the snapshot map and `rawPos()` (`:75`), which converts between decoded text offsets and source offsets across character references.
* Source offset → preview position: `previewPosOf()` (`:348`), a descent through the position tree.
* Used for: marking the source range of the element or selection under the page caret, marking the page element under the source caret (CSS Custom Highlight API, no DOM change, no focus change; `src/js/app.js:326`), caret placement after undo/redo and after normalizing commits.

## Commands

All commands (`src/js/commands.js`) change the preview DOM directly and are then committed like typing, as their own history step. Paragraph/heading renames an element and keeps the mapping to the source element, so its start tag is written back with the attributes as typed (`rename`, `:96`). List commands use the same renaming: a paragraph becomes the list item and is moved into a new list element in the same parent, which cannot produce a list inside a paragraph; an item becomes a paragraph again (`toggleList`, `:194`; `unlist`, `:158`). Paragraphs with anything other than white space between them (a line, a picture, a comment) get a list each, so that the order stays. The writer recognises a renamed element that left its source parent (`src/js/serialize.js:304`) and puts it on its own line. Bold, italic, underline, superscript, subscript and highlight wrap or unwrap text nodes by structure, not by computed style (`toggleInline`, `:315`, with the tag table `INLINE_ON`, `:246`); before superscript is applied, the text is lifted out of any subscript, and the other way round. Lifting text out of an element cuts it with a range (`liftOut`, `:291`); the range copies the element for the part behind the cut. Such a copy has no source tag, so it is marked as a copy and `emitNew()` (`src/js/serialize.js:245`) writes it with all attributes of its original, the style included, but without `id`. A new link around part of an element marks the copies in the same way (`insertLink`, `src/js/commands.js:358`). Typing, Enter and deletion are done by the browser's `contenteditable`; the writer normalizes what the browser produces.

### Attributes of existing elements

The writer copies the start tag of an element from the source text; it does not read attributes back from the page. A command that changes an attribute of such an element therefore leaves a note with the element (`record()`, `src/js/commands.js:110`): a map from attribute name to new value, or to null for removal. `isClean()` treats an element with a note as changed, and the writer applies the note to the original tag text with `patchAttrs()` (`src/js/util.js:314`), using the attribute offsets the tokenizer has recorded (`src/js/tree.js:62`). A removed attribute takes the white space in front of it along, unless the neighbours would then join; a changed value keeps the spelling of its unchanged beginning and end, character references with a semicolon included (`keepRaw()`, `src/js/util.js:364`, with the writer's decoder). Three commands use it: changing an image (`changeImage`, `src/js/commands.js:421`), changing the address of a link (`changeLink`, `:450`) and alignment (`setAlign`, `:485`). The note lives until the next render, like the snapshot it belongs to.

### Images

The source names an image by a relative address. `readImage()` (`src/js/images.js:18`) refuses files above 20 MB and checks the signature of a chosen file; it returns name and size only and keeps nothing. Each check belongs to one choice in one dialog: a counter (`pickSeq`, `src/js/app.js:505`) is raised by every choice and every opening and closing of the dialog, and a check that finishes for an older value is dropped (`pickImage`, `:584`).

Pictures are shown from the folder of the editor. `localFileUrl()` (`src/js/util.js:122`) resolves a plain relative address against the editor's own `file:` address and accepts the result only on the same host. The app hands the projection a resolver `local` (`src/js/app.js:57`) with that function and the set `missing` of file addresses that failed. The projection (`safeAttrs()`, `src/js/project.js:178`) gives a found `img` the file address as `src` and the written address in `data-se-file`; every other `img` gets an SVG picture in a `data:` address that names the reason (`boxPicture()`, `:167`), plus `data-se-src`, and a missing one is listed in `report.lost`. A new image carries the same attributes, and `emitNew()` writes `data-se-file` as `src`, so the file address never reaches the source.

A missing file raises `error` on its element; the listener runs in the capture phase on the frame document, because the event does not bubble (`onImageError`, `src/js/app.js:515`). It adds the address to `missing` and, after a short delay and after pending edits are committed, renders again (`showLost`, `:522`). `retryLost()` (`:530`) empties `missing` and renders again; it is called when the pupil comes back from another program (`cameBack`, `:1168`, which ignores focus changes between the panes), when a document is replaced and after the image dialog. The dialog itself probes the address it will write with an `Image` object of the editor window and shows the result; a probe that finishes for an older address is dropped (`foundSeq`, `showAddress`, `:629`).

### Links: address and target

The page pane keeps the address of a link in `data-se-href` and, since 0.1.0-alpha.5, its target in `data-se-target` (`src/js/project.js:186`); neither has an effect there. The link dialog reads the check box "In neuem Tab öffnen" from `data-se-target`. `changeLink()` (`src/js/commands.js:450`) records only the attributes that change (`href`, `target`), so the writer patches exactly those in the original tag. `emitNew()` writes `data-se-target` of a new link as `target` (`src/js/serialize.js:256`).

### Head and title

Visual edits never touch the head. The title field is the one exception and does not go through the page pane: `commitTitle()` (`src/js/app.js:1017`) computes a new source text with `withTitle()` (`src/js/format.js:89`, DOM-free, on the tokens), checks it with `DOMParser` (title, body, rendering mode) and installs it like a command, as one history step. The field shows `document.title` of the analysed page after every render, except while the pupil is typing in it.

### Opening the page in the browser

`browseDoc()` (`src/js/app.js:998`) saves first if needed and then opens the file name of the same document (if another one was opened meanwhile, nothing opens), resolved against the editor's address, with `window.open(…, '_blank', 'noopener')`. Whether the page is a file next to the editor is tracked as `state.onDisk`: set when a file is opened or written through a file handle, cleared for a new page and after a download (the copy is in "Downloads").

### Dialogs

`wireDrag()` (`src/js/app.js:102`) lets every dialog be moved by its heading, or by the text of the two question dialogs, with pointer capture; the position is clamped to the window, again when the window changes its size, and reset when the dialog closes.

### Text colour

`setColor()` (`src/js/commands.js:543`) works on the text nodes of the selection like the inline commands. It decides the target in this order: every block of the selection (`p`, `h1`–`h6`, `li`) if each of them is selected entirely; the outermost inline element that holds exactly the selected text; otherwise new spans. Colour declarations are set and removed with `withDecl()` (`src/js/util.js:172`, the reader behind `withAlign()` as well) and recorded like an alignment, so that `patchAttrs()` rewrites only the style attribute and `keepRaw()` keeps the spelling of its other declarations (`putColor()`, `src/js/commands.js:528`). Text is taken out of a span that carries nothing but a colour with `liftOut()` (`:276`), which now takes a filter for the elements it unwraps and marks the copies of cut elements as before. A new span gets `style="color: …"`; `emitNew()` writes the style of a new element only through `plainStyle()` (`src/js/util.js:146`): alignment with four keywords and colour with the eight palette names, nothing else (`src/js/serialize.js:259`).

### Tables

`insertTable()` (`src/js/commands.js:626`) builds `table > tbody > tr > th|td` in the page pane and inserts it behind the block with the caret (behind the list for a list item). `emitNew()` writes a new `tbody` without attributes as its rows only (`src/js/serialize.js:267`), because the browser adds it when it reads the rows; rows and cells are new blocks and get lines and indentation from the writer. `tableRow()` and `tableColumn()` (`src/js/commands.js:648`, `:668`) work on `table.rows` and `row.cells` and refuse tables with `rowspan` or `colspan`; `tableColumn()` also refuses tables with `<colgroup>` or `<col>`, whose column definitions it would have to change as well; a deleted row or cell takes the line break in front of it (behind it, if it was the first), so that the remaining source keeps its layout. `stepCell()` (`:693`) moves the selection for Tab and Shift+Tab. Empty cells have the height of a line in the page pane through one rule of the pane's own style (`:where(td,th):empty::after`, `src/js/app.js:28`); the source does not get anything for it.

### Saving

Saves run one after another (`saveDoc()`, `src/js/app.js:956`): a save asked for while one writes joins one single save behind it (`startSave()`, `:965`), which takes its snapshot when its turn comes and writes through the file handle; asking again and again gives two writes, not a queue. While a file is written the footer says "Speichert …" and the message stays until the save ends (`setStatus()`, `:72`). A file handle's writer commits on `close()`, and two writers of one file that close in the wrong order would leave the older text; the chain makes the newest text the last one written. `isDirty()` (`:194`) also counts a title that is typed into the title field and not yet taken over.

## History

`createHistory()` (`src/js/history.js:3`) stores complete text states. There is no second history: the native undo of the text field and of the frame are intercepted (`beforeinput` with `historyUndo`/`historyRedo`, Ctrl+Z/Y) and routed to it.

## Formatting

`formatSource()` (`src/js/format.js:16`) moves white space on the position tree, assuming the default display of HTML elements. Because style rules can change what white space means, `formatDoc()` (`src/js/app.js:765`) applies the result only after three checks:

1. `cssFacts()` (`src/js/project.js:483`) hands every style element and style attribute to `cssRisks()` (`src/js/util.js:267`), which reads the text as CSS: strings, comments, escapes and brackets are respected, rules and declarations are told apart by their braces, and names are compared the way the browser reads them. It reports a `white-space` declaration with a value outside the collapsing ones, rules from a file (`link`, `@import`), a string or comment that is not closed, and rules that hold only sometimes (conditional at-rules including `@keyframes`, selectors with a state such as `:hover` or `[open]`) if they declare `display`, `content`, `all` or a custom property, or if one of the first three takes its value through `var()`. Any of these stops the formatting.
2. Both texts are parsed by the browser and must have the same canonical form (`canonDom()`, `:396`), and the same characters apart from white space.
3. `sameLayout()` (`src/js/app.js:723`) builds a second frame like the page pane (same shell, sandbox, policy, width; animations stopped), renders first the old and then the new text into it with the ordinary projection, and compares `layoutPrint()` (`src/js/project.js:527`): the box of every element and of every rendered piece of text in quarter pixels. White space that is not rendered has no box; white space that is rendered moves a box or has one. The frame is removed afterwards.

The third check is what decides for unconditional `display` rules, generated content and anything else the first two cannot know. It sees one state of the page, which is why the first check refuses rules that hold only sometimes. Before comparing, `hiddenLayoutRisk()` (`src/js/project.js:507`) looks at block elements that have no box at the moment (hidden attribute, closed `details`): if one of them is displayed inline or has generated content, the formatting is refused, because that part cannot be compared.

## Things that are deliberately simple

* Full re-analysis after every change. Measured on a 146,000-character document: 162 keystrokes typed into the page and both panes in sync after about 2 s in total, including the automation overhead (T-12).
* Complete text snapshots in the history, bounded by count and size.
* A complete second rendering for the layout check of "Code aufräumen". Measured on a 140,000-character document with 1,500 paragraphs: about 0.6 s from the click to the formatted text (exploratory run, Edge 157, 2026-11-19).
* No virtual scrolling in the source pane.
