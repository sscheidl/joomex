# Development status 0.1.0-alpha.2

2026-11-12. **Browser prototype runs. Joomla module package built; installation NOT MEASURED. Not for production.**

## Versions

| Version | Date | Content |
| --- | --- | --- |
| 0.1.0-alpha.1 | 2026-11-11 | First candidate; reviewed independently (verdict BLOCKED). Built under an earlier working name and not published. |
| 0.1.0-alpha.2 | 2026-11-12 | Public package. Same functionality as alpha.1. Changes: neutral identifiers (`mod_pdfbook`, namespace `Joomex\Module\Pdfbook`, CSS prefix `pdfbook`, `data-pdfbook*`), neutral third-party notice, neutral demo and test fixtures. **The review findings F1–F16 still apply.** Fixes are planned for 0.1.0-alpha.3. |

## Implemented

- Native Joomla module structure with namespaces, service provider, dispatcher, form fields and separate media resources.
- Own viewer with PDF.js 6.5.438 and its own WebGL page mesh and shading, without jQuery or Three.js. A static fallback is used in single-page view, with animation turned off, or when WebGL is missing.
- Next/previous, first/last page, page input, single/double page, RTL, zoom, fullscreen button, thumbnails, PDF bookmarks and links.
- Dialog view with Escape and focus return; several independent instances.
- Autoplay with a fixed 3-second interval. A swipe gesture turns the page; interactive dragging of a curved page is not implemented yet.
- Limited to the site's own public media PDFs: 32 MB download, 1000 pages, 2.4 million pixels and at most 4096 pixels per page edge, six cache entries.
- HTML output through JSON/attribute encoding and DOM text nodes. No PDF scripting manager, no XFA, no foreign PDF URLs, no proxy or upload endpoint.

## Legacy reference

Public GET requests on 2026-11-11 identified two published legacy instances and their rendered settings, with no back-end access and no production changes. The neutral summary is in the [legacy findings](../../research/legacy-flipbook/FINDINGS.md). Two further instances and the complete stored parameters and menu assignments are still open.

## Checks

| Check | Result | Limit |
| --- | --- | --- |
| Node model tests | PASS, 4 test groups (alpha.1 2026-11-11, alpha.2 2026-11-12) | Paths/URL schemes, page order/RTL, render sizes |
| PHP 8.4.27 syntax | PASS for all module files | No Joomla bootstrap |
| PHP file/output tests | PASS, 15 checks | No Joomla access matrix |
| Browser smoke test (Edge 157, headless) | PASS | One desktop browser; mobile size emulated, no real device |
| Independent review of alpha.1 | Verdict BLOCKED; 0 × P0, 1 × P1, 3 × P2, 12 × P3 | See [review](reviews/REVIEW_0.1.0-alpha.1.md) |
| Installation/update/uninstallation | NOT RUN | Needs an isolated Joomla 6 |

## Still open

- Fixes for review findings F1–F16, starting with F1 (stylesheet URL in the Web Asset Manager).
- Content plugin, multi-book cover gallery and cover selection in the back end.
- Sound, configurable toolbar and autoplay interval, manual tables of contents, image folders and wide inner spreads.
- Internationalisation and a text/screen-reader layer.
- Real touch devices, Firefox and Safari, and stress/memory tests.
- Full Joomla integration.

The interface and error messages are German for now. PDF file names with spaces and external PDFs are rejected on purpose. Hiding the "open PDF" button does not prevent downloads. Protected documents must not be embedded from the public media path.
