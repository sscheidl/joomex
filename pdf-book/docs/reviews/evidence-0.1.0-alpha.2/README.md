# Evidence: review suite on 0.1.0-alpha.2

`results.json` is the unedited output of `tests/review/review_browser.py`, run on 2026-11-12 with Microsoft Edge 157.0.4341.46 (headless, Playwright 1.65.0) against `tests/review/review_server.py` and pages rendered by `tests/review/render_pages.php`. Fixtures came from `tests/review/make_review_fixtures.py` and `scripts/make_fixtures.py`.

Expected FAIL entries: "rapid input / resize while busy" and "resize to 520 px during page-turn animation" document finding F2 of the review. INFO entries record measurements that the review interprets (F3, F4, F5, F10, F14, F16).

Screenshots are not committed (binary files outside `media/vendor/` are not allowed in this repository); re-run the suite to reproduce them.

Reproduce (paths relative to `pdf-book/`, scratch directory outside the repository):

```bash
python tests/review/make_review_fixtures.py <scratch>/fixtures
# copy <scratch>/fixtures/*.pdf and images/*.pdf into <scratch>/site/images/
php tests/review/render_pages.php . <scratch>/site <scratch>/pages
python tests/review/review_server.py . <scratch>
python tests/review/review_browser.py <scratch>/out
```
