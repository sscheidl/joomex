# Evidence: review of 0.1.0-alpha.3

All runs on 2026-11-12, Windows 11, loopback server `tests/review/review_server.py` with pages from `tests/review/render_pages.php` (real dispatcher and template, Joomla stubs). Firefox is the Playwright build 159.0 (revision 1572) matching Playwright 1.65.0.

| File | Content | By |
| --- | --- | --- |
| `codex-review-suite-edge.json` | Unedited output of `tests/review/review_browser.py` in Edge 157 | Codex |
| `codex-independent-checks.json` | Codex's own checks in Edge and Firefox: CMYK/ICC fallback, JPEG 2000 under strict style CSP, dialog at 320×225, render-failure fault injection, dispose with queued navigation | Codex |
| `codex-php-path-vectors.txt`, `codex-js-url-vectors.txt` | Output of `tests/review/source_ext.php` (41 vectors, with a directory junction pointing outside) and `tests/review/js_ext.mjs` | Codex |
| `claude-review-suite-firefox.json` | Unedited output of `tests/review/review_browser.py` in Firefox 159 (browser switched in a local copy: `pw.firefox.launch`, WebGL disabled via the `webgl.disabled` preference) | Claude |
| `claude-recheck-n1-n2.json`, `claude-recheck-n1-n2.py` | Re-check of findings N1 (dialog at 320×225, 640×300, 568×320, 844×390) and N2 (render failure) in Edge and Firefox | Claude |

Codex's read-only staging preflight is not included here, because it contains site details. Its neutral summary is in the review, section 2.
