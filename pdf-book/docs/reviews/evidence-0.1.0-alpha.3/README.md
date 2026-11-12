# Evidence: review suite on 0.1.0-alpha.3

`results.json` is the unedited output of `tests/review/review_browser.py`, run on 2026-11-12 with Microsoft Edge 157.0.4341.46 (headless, Playwright 1.65.0) against `tests/review/review_server.py` and pages rendered by `tests/review/render_pages.php` (real `Dispatcher.php` and `tmpl/default.php`, Joomla stubs). Fixtures came from `tests/review/make_review_fixtures.py` and `scripts/make_fixtures.py`.

Since alpha.3 the suite asserts the fixed behaviour (F2–F5, F7, F9–F11, F13, F15) and exits with code 1 if any check fails. INFO entries record measurements without a pass criterion.

**Limit:** the stubs emulate the traced Joomla 6.2 resolution of the relative stylesheet URI (`mod_pdfbook/viewer.css` → `{root}/media/mod_pdfbook/css/viewer.css`). Whether real Joomla does exactly this is the first check of the [review request](../REVIEW_REQUEST_0.1.0-alpha.3.md).

Screenshots are not committed (binary files outside `media/vendor/` are not allowed in this repository); re-run the suite to reproduce them.

Reproduce (paths relative to `pdf-book/`, scratch directory outside the repository):

```bash
python scripts/make_fixtures.py
python tests/review/make_review_fixtures.py <scratch>/fixtures
# copy <scratch>/fixtures/*.pdf and images/*.pdf into <scratch>/site/images/
php tests/review/render_pages.php . <scratch>/site <scratch>/pages
python tests/review/review_server.py . <scratch>
python tests/review/review_browser.py <scratch>/out
```
