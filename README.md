# joomex

Independently written Joomla extensions: modules, plugins, templates.

| Folder | Content | Status |
| --- | --- | --- |
| [`pdf-book/`](pdf-book/) | `mod_pdfbook`: PDF flipbook module for Joomla 6, built on PDF.js 6.5.438 | Alpha, not for production |
| [`research/legacy-flipbook/`](research/legacy-flipbook/) | Sanitized behaviour analysis of a legacy commercial flipbook module that `mod_pdfbook` replaces | Findings, no original material |
| [`html-school-editor/`](html-school-editor/) | Offline single-file HTML learning editor for classroom use (stand-alone, not a Joomla extension), with its task brief and acceptance contract | Beta 1.0.0-beta.3 for an accompanied classroom trial ([release](https://github.com/sscheidl/joomex/releases/tag/html-school-editor-v1.0.0-beta.3)); not a final release |
| [`html-school-editor-win/`](html-school-editor-win/) | Successor of the single-file editor for Windows: native C++ program with the WebView2 engine; pages and pictures load from their real place in the pupil's project folder | 0.1.0-alpha.21 (branch): stage 1 with the stage 2 pilot (editing on the page side), two-row header, code in the middle, help and the owner's collection of 2026-11-27; built and measured on Windows; not yet for pupils' files |

Binding rules for this repository, including the publication check: [RULES.md](RULES.md).

## Licences

Each extension folder carries its own licence file, and that licence applies to the extension. `pdf-book/` is GPL-3.0-or-later (bundled PDF.js: Apache-2.0). `html-school-editor/` is MIT and has no bundled third-party code. `html-school-editor-win/` is MIT. The repository-wide [LICENSE](LICENSE) applies to files not covered by a folder licence.

## Releases

Installable packages are published as [GitHub releases](https://github.com/sscheidl/joomex/releases) with their SHA-256. Alpha packages are pre-releases and must only be installed on test installations.
