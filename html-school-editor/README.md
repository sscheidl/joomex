# HTML School Editor

A small offline HTML learning editor for pupils of about 12–13 years. One HTML file, opened by double-click: the complete HTML source on the left, the directly editable page on the right. No installation, no server, no internet.

**Version:** 1.0.0-beta.2 · **State:** beta for an accompanied classroom trial, see [docs/STATUS.md](docs/STATUS.md) · **User interface:** German

A screenshot and the download of 1.0.0-beta.1 are on its [release page](https://github.com/sscheidl/joomex/releases/tag/html-school-editor-v1.0.0-beta.1).

## Use

Give pupils the single file [`dist/school-editor.html`](dist/school-editor.html). Each pupil keeps it in the project folder, next to the pages and pictures, and opens it in Microsoft Edge or Google Chrome. In Firefox the editor was measured as well: editing works, and Save is always a download there, because Firefox cannot write to a chosen file. A short German guide for pupils is in [docs/ANLEITUNG.de.md](docs/ANLEITUNG.de.md).

What the editor does:

* New page, open an HTML file, save, save as a new file (in a browser without file access, Firefox for example, every save is a new copy in "Downloads", and the editor says so).
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

## Report a problem, take part

The editor is in beta and is tried in class. Every report helps, especially from real lessons. Please open an issue in this repository with the form "HTML-Schuleditor: Fehler melden" and give:

1. the editor version (bottom right in the editor, for example `html-school-editor 1.0.0-beta.2`),
2. browser and version, operating system,
3. what you did, step by step, what you expected and what happened instead,
4. if possible the smallest HTML file that shows the problem.

Do not post names of pupils or schools, photos or other personal data; shorten or rewrite the example first. Pupils report to their teacher rather than on GitHub (GitHub accounts require an age of at least 13). During the class trial the feature set is frozen: defects are corrected, ideas for new functions are collected as issues with the label `enhancement` and decided after the trial.

Pull requests are welcome. The rules in [AGENTS.md](AGENTS.md) and [RULES.md](../RULES.md) apply: every behaviour change comes with a test, and the delivered file stays one self-contained file below 200,000 bytes.

## How this was made

Most of the code, the tests and the documentation were written by AI coding agents, Claude Code (Anthropic) and Codex (OpenAI), under the direction of the maintainer, who set the requirements, tried the editor by hand and decided on every version. The review rounds were done by other AI models (Codex, Claude, GPT), independently of the implementing agent; their findings and the corrections are recorded in [docs/STATUS.md](docs/STATUS.md) and [docs/reviews/](docs/reviews/). No review is a guarantee; treat the editor like any beta software and keep copies of important pages.

## Origin and licence

The editor was written new for this project. A third-party single-file editor was studied as a reference for interaction concepts; no code, assets or templates of it are contained here. Details and the limits of that statement are in [docs/SPECIFICATION.md](docs/SPECIFICATION.md#origin). There are no runtime or build dependencies.

Own code in this folder: MIT, see [LICENSE](LICENSE). The editor may be used, copied, given to pupils and changed, also in schools and commercially, as long as the licence notice is kept. The delivered file contains no third-party code, fonts, icons or images; it uses the system fonts of the computer. Build and tests use the Node.js standard library only. Pages written with the editor belong to their authors; the editor adds nothing to them and sends nothing anywhere.
