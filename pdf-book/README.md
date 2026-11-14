# PDF Book for Joomla 6 (`mod_pdfbook`)

A self-contained PDF flipbook module for Joomla 6. It aims to replace a previously used commercial flipbook module with similar operation and appearance, and to rebuild every security-relevant part. It uses its own code and PDF.js 6.5.438.

**Status 2026-11-14: 1.0.0 release build in preparation.** This line follows the independently reviewed alpha.19 package and its [deployment checks](docs/reviews/PRODUCTION_CHECK_0.1.0-alpha.19.md). Version 1.0.0 fixes the remaining archive identity, numeric parsing and intermediate texture limits. Exact build identity, current validation and deployment limits are recorded in [the release record](docs/reviews/RELEASE_1.0.0.md). A website-wide CSP rollout is a separate hardening project and is not by itself a prerequisite for using this module.

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

The build checks every PDF.js file against `dependencies.json` (and that nothing else is vendored), checks that the manifest, `Dispatcher::VERSION`, `package.json` and every `?v=` import suffix carry the same version, and writes `dist/mod_pdfbook-<version>.zip`, `dist/SHA256SUMS.txt` and `dist/manifest.json`. Release packages and their checksums/manifests are distributed as release assets, not committed. Stable builds require clean committed package inputs; the manifest records their source commit and build toolchain.

## Module use

Verify an update on a test installation before changing a production site, and retain a file/database backup. Install the ZIP through the Joomla extension installer. Create a site module **PDF Book**, choose a public PDF under `images/` with the media picker (or enter `images/brochure.pdf` / `/images/brochure.pdf`), then choose a position, menu assignment and publish. PDFs are not part of the package.

Current limits: public local PDFs up to 32 MB and 1000 pages, images inside a PDF up to 16 megapixels (larger embedded images are left out without a notice, review finding F14), no external PDFs. Configuration errors are shown to module editors only. The user interface is German only. Hiding the download button is not access control.

## License

GPL-3.0-or-later ([LICENSE.txt](LICENSE.txt)). PDF.js: Apache-2.0, see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). This folder's license applies to this extension, not the repository-wide `LICENSE`.
