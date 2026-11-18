# HTML School Editor

A small offline HTML learning editor for pupils of about 12–13 years. One HTML file, opened by double-click: the complete HTML source on the left, the directly editable page on the right. No installation, no server, no internet.

**Version:** 0.1.0-alpha.1 · **State:** HOLD, see [docs/STATUS.md](docs/STATUS.md) · **User interface:** German

## Use

Give pupils the single file [`dist/school-editor.html`](dist/school-editor.html). They open it in Microsoft Edge or Google Chrome. A short German guide for pupils is in [docs/ANLEITUNG.de.md](docs/ANLEITUNG.de.md).

What the editor does:

* New page, open an HTML file, save, download a copy.
* Edit in either pane; the other pane follows. The source text is always the complete document.
* Paragraph, headings 1–3, bold (`<b>`), italic (`<i>`), bulleted and numbered lists, links, images from the computer (embedded, with alternative text).
* One undo/redo history for both panes. "Code aufräumen" indents the source without changing anything but white space.
* Scripts, forms, frames and anything from the network are switched off inside the editor and stay untouched in the source.

What it deliberately does not do: no autosave or recovery after closing, no templates, no CSS tools, no multi-file projects, no preview window that runs scripts.

## Build and test

Requirements for development only: Node.js 22 or newer, Git, and an installed Edge or Chrome for the browser tests. There are no npm dependencies.

```bash
node tools/build.mjs                 # writes dist/school-editor.html
node tools/build.mjs --check         # verifies that dist/ matches the sources (reproducible build)
node --test tests/unit/*.test.mjs    # unit tests of the DOM-free modules
node tests/run.mjs                   # acceptance suite in Edge and Chrome against dist/school-editor.html
node tests/run.mjs --browser edge --only T-10,X-03
node tools/check_publication.mjs --denylist <private list outside the repository>
```

The acceptance suite starts the delivered file from `file://` in a fresh browser profile and drives it with real key and mouse events over the DevTools protocol. Results are written to `tests/results/acceptance-<browser>.json`. A browser that is not installed is recorded as `NOT MEASURED`.

A locally branded copy (different product name in the title bar) can be built with `node tools/build.mjs --brand local/brand.json`; the `local/` folder is ignored by Git. The file needs `name`, `sub` and `file`.

## Documentation

| Document | Content |
| --- | --- |
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | Behaviour of the product; which ideas of the studied reference editor were kept, corrected or left out |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Modules, data model, synchronisation, write-back |
| [docs/SECURITY.md](docs/SECURITY.md) | Trust boundary, sandbox and policy, what is measured |
| [docs/ACCEPTANCE_RESULTS.md](docs/ACCEPTANCE_RESULTS.md) | Requirement → code → test → measured result |
| [docs/STATUS.md](docs/STATUS.md) | Current state, artefact size and hash, open points, licences |
| [docs/REVIEW_CODEX.md](docs/REVIEW_CODEX.md) | Hand-over for the independent review |
| [docs/ANLEITUNG.de.md](docs/ANLEITUNG.de.md) | Guide for pupils (German) |

## Origin and licence

The editor was written new for this repository. A third-party single-file editor was studied as a reference for interaction concepts; no code, assets or templates of it are contained here. Details and the limits of that statement are in [docs/SPECIFICATION.md](docs/SPECIFICATION.md#origin). There are no runtime or build dependencies.

Own code: MIT, see [LICENSE](LICENSE).
