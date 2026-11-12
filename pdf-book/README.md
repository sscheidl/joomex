# PDF Book for Joomla 6 (`mod_pdfbook`)

A self-contained PDF flipbook module for Joomla 6. It aims to replace a previously used commercial flipbook module with similar operation and appearance, and to rebuild every security-relevant part. It uses its own code and PDF.js 6.5.438.

**Status 2026-11-12: alpha 0.1.0-alpha.2. Not for production.** Installation in Joomla 6 has not been tested yet. The independent review of the functionally identical 0.1.0-alpha.1 candidate found one install-related defect (P1). See [docs/STATUS.md](docs/STATUS.md) and [docs/reviews/REVIEW_0.1.0-alpha.1.md](docs/reviews/REVIEW_0.1.0-alpha.1.md).

- [Specification](docs/SPECIFICATION.md)
- [Security requirements](docs/SECURITY.md)
- [Development status and test results](docs/STATUS.md)
- [Independent review of 0.1.0-alpha.1](docs/reviews/REVIEW_0.1.0-alpha.1.md)
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
python tests/browser_smoke.py
```

`browser_smoke.py` needs Playwright with Microsoft Edge and the running preview server. `scripts/get_php.py` can fetch a portable PHP 8.4 for Windows into the ignored folder `.tools/`.

## Build

```bash
python scripts/build.py
```

The build checks every PDF.js file against `dependencies.json` and writes `dist/mod_pdfbook-<version>.zip`, `dist/SHA256SUMS.txt` and `dist/manifest.json`. Release packages are published as GitHub pre-releases, not committed.

## Module use (test installations only)

Install the ZIP through the Joomla installer of a **test** installation. Create a site module **PDF Book (Prototyp)**, enter a public PDF path such as `images/brochure.pdf`, then choose a position, menu assignment and publish. PDFs are not part of the package.

Current limits: public local PDFs up to 32 MB, no spaces in file names, no external PDFs. The user interface is German only. Hiding the download button is not access control.

## License

GPL-3.0-or-later ([LICENSE.txt](LICENSE.txt)). PDF.js: Apache-2.0, see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). This folder's license applies to this extension, not the repository-wide `LICENSE`.
