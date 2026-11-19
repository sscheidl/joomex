# HTML School Editor

A small offline HTML learning editor for pupils of about 12–13 years. One HTML file, opened by double-click: the complete HTML source on the left, the directly editable page on the right. No installation, no server, no internet.

**Version:** 0.1.0-alpha.7 · **State:** HOLD, see [docs/STATUS.md](docs/STATUS.md) · **User interface:** German

## Use

Give pupils the single file [`dist/school-editor.html`](dist/school-editor.html). Each pupil keeps it in the project folder, next to the pages and pictures, and opens it in Microsoft Edge or Google Chrome. In Firefox the editor was measured as well: editing works, and Save is always a download there, because Firefox cannot write to a chosen file. A short German guide for pupils is in [docs/ANLEITUNG.de.md](docs/ANLEITUNG.de.md).

What the editor does:

* New page, open an HTML file, save, download a copy.
* Edit in either pane; the other pane follows. The source text is always the complete document.
* Paragraph, headings 1–3, bold (`<b>`), italic (`<i>`), underline (`<u>`), superscript (`<sup>`), subscript (`<sub>`), highlight (`<mark>`), text colour from a palette of eight names, tables, bulleted and numbered lists, alignment (left, centre, right, justified), links, images from the computer. An image is written as its file name (`<img src="bilder/katze.jpg">`, with optional folder, description and width); the picture file itself lies in the project folder, and the editor shows it from there. A missing file is shown as a box that names it. Existing links and images are changed through the same dialogs; a link can open in a new tab. The page title is edited in a field above the page.
* "Im Browser öffnen" shows the saved page in a new tab, where its links and scripts work, so that pupils can test their links.
* One undo/redo history for both panes. "Code aufräumen" indents the source; it is applied only if the page looks exactly the same afterwards, otherwise the code stays as it is and the editor says why.
* Scripts, forms, frames and anything from the network are switched off inside the editor and stay untouched in the source. Picture files of the computer are the one exception: they are shown (see [docs/SECURITY.md](docs/SECURITY.md)).

What it deliberately does not do: no autosave or recovery after closing, no templates, no CSS tools, no multi-file projects, no preview window that runs scripts.

## Build and test

Requirements for development only: Node.js 22 or newer, Git, and an installed Edge or Chrome for the browser tests. There are no npm dependencies. Run the commands in this folder (`html-school-editor/`).

```bash
node tools/build.mjs                 # writes dist/school-editor.html
node tools/build.mjs --check         # verifies that dist/ matches the sources (reproducible build)
node --test tests/unit/*.test.mjs    # unit tests of the DOM-free modules
node tests/run.mjs                   # acceptance suite in Edge, Chrome and Firefox against dist/school-editor.html
node tests/run.mjs --browser edge --only T-10,X-03
```

The acceptance suite starts the delivered file from `file://` in a fresh browser profile and drives it with real key and mouse events, over the DevTools protocol in Edge and Chrome and over WebDriver BiDi in Firefox. Results are written to `tests/results/acceptance-<browser>.json`. A browser that is not installed is recorded as `NOT MEASURED`; a case that needs automation which exists for one protocol only is recorded as `PARTIAL`.

The publication check for the whole repository is described in [RULES.md](../RULES.md).

A locally branded copy (different product name in the title bar) can be built with `node tools/build.mjs --brand local/brand.json`; the `local/` folder is ignored by Git. The file needs `name`, `sub` and `file`.

## Documentation

| Document | Content |
| --- | --- |
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | Behaviour of the product; which ideas of the studied reference editor were kept, corrected or left out |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, data model, synchronisation, write-back |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust boundary, sandbox and policy, what is measured |
| [docs/ACCEPTANCE_RESULTS.md](docs/ACCEPTANCE_RESULTS.md) | Requirement → code → test → measured result |
| [docs/STATUS.md](docs/STATUS.md) | Current state, artefact size and hash, open points, licences |
| [docs/REVIEW_CODEX.md](docs/REVIEW_CODEX.md) | Hand-over for the independent review of the current version |
| [docs/reviews/](docs/reviews/) | Independent reviews of earlier versions, with the reviewer's probes |
| [docs/ANLEITUNG.de.md](docs/ANLEITUNG.de.md) | Guide for pupils (German) |
| [docs/brief/](docs/brief/) | The task brief this product was built from, with the numbered acceptance contract and the sanitized findings about the reference editor |

## Origin and licence

The editor was written new for this project. A third-party single-file editor was studied as a reference for interaction concepts; no code, assets or templates of it are contained here. Details and the limits of that statement are in [docs/SPECIFICATION.md](docs/SPECIFICATION.md#origin). There are no runtime or build dependencies.

Own code in this folder: MIT, see [LICENSE](LICENSE).
