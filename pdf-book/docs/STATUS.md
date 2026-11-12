# Development status 0.1.0-alpha.5

2026-11-12. **Browser prototype runs; fixes for all review findings implemented. Joomla installation NOT MEASURED. Not for production.**

## Versions

| Version | Date | Content |
| --- | --- | --- |
| 0.1.0-alpha.1 | 2026-11-11 | First candidate; reviewed independently (verdict BLOCKED). Built under an earlier working name and not published. |
| 0.1.0-alpha.2 | 2026-11-12 | Public package. Same functionality as alpha.1, with neutral identifiers, notice and texts. |
| 0.1.0-alpha.3 | 2026-11-12 | Fixes for F1–F15 and documentation for F16. [Review](reviews/REVIEW_0.1.0-alpha.3.md): suitable for a limited staging test; new findings N1–N3. |
| 0.1.0-alpha.4 | 2026-11-12 | Fixes for N1–N3. Live test on a Joomla 6.2 staging installation: installation and back end OK, F1 confirmed, viewer did not start (`.mjs` served as `text/plain`, L1). |
| 0.1.0-alpha.5 | 2026-11-12 | Fix for L1: all JavaScript files named `.js`; see [CHANGELOG.md](../CHANGELOG.md). **Next: live test of alpha.5 on the staging installation.** |

## Implemented

- Native Joomla module structure with namespaces, service provider, dispatcher, form fields (PDF via the Joomla media picker) and separate media resources registered through the Web Asset Manager.
- Own viewer with PDF.js 6.5.438 and its own WebGL page mesh and shading, without jQuery or Three.js. A static fallback is used in single-page view, with animation turned off, or when WebGL is missing.
- Next/previous, first/last page, page input, page mode (automatic/single/double), RTL, zoom, fullscreen button, thumbnails, PDF bookmarks and links. Input during rendering or page turns is queued.
- Dialog view with Escape and focus return; the book fills the dialog. Several independent instances.
- Autoplay with a fixed 3-second interval. A swipe gesture turns the page (when zoomed, only at the scroll edge); interactive dragging of a curved page is not implemented yet.
- Limits:
  - only the site's own public media PDFs
  - 32 MB download, 1000 pages
  - 2.4 million pixels and at most 4096 pixels per page edge
  - images of at most 16 megapixels inside a PDF (larger images are skipped)
  - six cache entries
  - timeouts: 20 s until the response, 20 s without new data, 30 s for parsing
- Error messages are fixed German texts. Configuration errors are shown to module editors only.
- HTML output through JSON/attribute encoding and DOM text nodes. No PDF scripting manager, no XFA, no WebAssembly, no foreign PDF URLs, no proxy or upload endpoint.

## Checks (MEASURED 2026-11-12, Windows 11, Edge 157 headless, PHP 8.4.27, Node 24.22.1)

| Check | Result | Limit |
| --- | --- | --- |
| `node --test tests/model.test.mjs` | PASS, 9 test groups | Paths/URL schemes, page order/RTL, render sizes, messages, mode cycle |
| `php tests/source.php` | PASS, 32 checks | Path rules including legacy and media-field formats, output encoding, error visibility |
| `php tests/dispatcher.php` | PASS, 9 checks | Asset URIs, version, base, error visibility; against stubs, **not Joomla** |
| `php -l` on all PHP files | PASS | |
| `tests/browser_smoke.py` | PASS | One desktop browser; mobile size emulated |
| `tests/review/review_browser.py` | See [evidence-0.1.0-alpha.3](reviews/evidence-0.1.0-alpha.3/) | Loopback server, Joomla stubs |
| `scripts/build.py` twice | Identical SHA-256 | |
| Installation/update/uninstallation | **NOT RUN** | Needs an isolated Joomla 6 (planned on a staging installation) |

## Still open

- Independent review of alpha.3 and the Joomla installation gate (root and subdirectory installation, SEF, media picker, access matrix, logs, MIME types, CSP).
- Content plugin, multi-book cover gallery and cover selection in the back end.
- Sound, configurable toolbar and autoplay interval, manual tables of contents, image folders and wide inner spreads.
- Internationalisation and a text/screen-reader layer.
- Real touch devices, Firefox and Safari, and stress/memory tests.

The interface is German for now. External PDFs are rejected on purpose. Hiding the "open PDF" button does not prevent downloads. Protected documents must not be embedded from the public media path.
