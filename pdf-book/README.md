# PDF Book for Joomla 6 (`mod_pdfbook`)

A self-contained PDF flipbook module for Joomla 6. It aims to replace a previously used commercial flipbook module with similar operation and appearance, and to rebuild every security-relevant part. It uses its own code and PDF.js 6.5.438.

**Status 2026-11-13: alpha 0.1.0-alpha.12. Not for production.** alpha.12 turns rapid clicks into one complete turn to the page in the counter and adds a 100 % zoom button. alpha.10 added the page-change modes "Klappen" (flip-board fold) and "Überblenden" (cross-fade); alpha.11 adds a vertical fold, automatic height, a cinema mode (heading and toolbar can be hidden), an optional page sound and autoplay settings. alpha.5 runs on a Joomla 6.2 staging installation (installation, display, update and uninstallation tested by the owner). alpha.6 improved the page-turn animation and the controls after that test; alpha.7 makes its look adjustable in the module settings and adds a slide animation. alpha.3 fixed the findings of the [review of 0.1.0-alpha.1](docs/reviews/REVIEW_0.1.0-alpha.1.md); alpha.4 fixes the new findings of the [review of 0.1.0-alpha.3](docs/reviews/REVIEW_0.1.0-alpha.3.md). See [docs/STATUS.md](docs/STATUS.md) and [CHANGELOG.md](CHANGELOG.md).

- [Specification](docs/SPECIFICATION.md)
- [Security requirements](docs/SECURITY.md)
- [Development status and test results](docs/STATUS.md)
- [Review of 0.1.0-alpha.1](docs/reviews/REVIEW_0.1.0-alpha.1.md), [review of 0.1.0-alpha.3 with the live-test record](docs/reviews/REVIEW_0.1.0-alpha.3.md), [review request for 0.1.0-alpha.7](docs/reviews/REVIEW_REQUEST_0.1.0-alpha.7.md)
- [Behaviour analysis of the legacy module](../research/legacy-flipbook/FINDINGS.md)

## Local preview

```bash
python scripts/make_fixtures.py
python scripts/serve.py
```

Then open `http://127.0.0.1:8765/demo/`. The server binds to the loopback address only. `make_fixtures.py` needs the Python package `pypdf`.

## Tests

```bash
node --test tests/model.test.mjs
php tests/source.php
php tests/dispatcher.php
python tests/browser_smoke.py
```

`browser_smoke.py` needs Playwright with Microsoft Edge and the running preview server. The extended review suite is in `tests/review/` (see `docs/reviews/evidence-0.1.0-alpha.3/README.md`). `scripts/get_php.py` can fetch a portable PHP 8.4 for Windows into the ignored folder `.tools/`.

## Build

```bash
python scripts/build.py
```

The build checks every PDF.js file against `dependencies.json` (and that nothing else is vendored), checks that the manifest, `Dispatcher::VERSION`, `package.json` and every `?v=` import suffix carry the same version, and writes `dist/mod_pdfbook-<version>.zip`, `dist/SHA256SUMS.txt` and `dist/manifest.json`. Release packages are published as GitHub pre-releases, not committed.

## Module use (test installations only)

Install the ZIP through the Joomla installer of a **test** installation. Create a site module **PDF Book (Prototyp)**, choose a public PDF under `images/` with the media picker (or enter `images/brochure.pdf` / `/images/brochure.pdf`), then choose a position, menu assignment and publish. PDFs are not part of the package.

Current limits: public local PDFs up to 32 MB and 1000 pages, images inside a PDF up to 16 megapixels, no external PDFs. Configuration errors are shown to module editors only. The user interface is German only. Hiding the download button is not access control.

## License

GPL-3.0-or-later ([LICENSE.txt](LICENSE.txt)). PDF.js: Apache-2.0, see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). This folder's license applies to this extension, not the repository-wide `LICENSE`.
