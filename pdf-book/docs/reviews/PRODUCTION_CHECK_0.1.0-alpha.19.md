# Production acceptance follow-up: PDF Book alpha.19

**Measured 2026-11-13; embedded-page browser follow-up 2026-11-14. Production approval remains open.** This record supplements [the alpha.19 artifact review](REVIEW_0.1.0-alpha.19.md). Deployment-specific evidence is retained privately by the owner; no site names, document paths, account identifiers or credentials are included here.

## Staging update

The owner explicitly authorized updating the staging installation. The existing private operations bridge was used over host-key-pinned SSH; the production installation was not modified. The Joomla API helper itself is read-only and was not expanded to allow writes.

- Real environment: **Joomla 6.2.0, PHP 8.4.27, MariaDB 10.6.19**, compatibility plugin enabled.
- Before installation, the staging database was verified to be distinct from production. A full file/database snapshot was created outside the webroot in a protected location; gzip, archive inventory and SHA-256 checks passed. A restore was **not** exercised.
- Joomla's CLI installer updated the existing module using the supplied ZIP with SHA-256 `c98668f54897975d0100237d65fbf5e6c7275e9fdeb222681cb38cdb708ed46e`.
- **All 211 installed files** were compared to the original ZIP and matched. Both the installed manifest and extension record report **0.1.0-alpha.19**; the publicly served JavaScript also reports alpha.19.
- Existing module rows/settings remained unchanged. The production configuration hash was unchanged across the staging update.

## Real Joomla module rights/cache test

**PASS in the measured server-side rendering scope: 48/48 assertions**, plus a restricted-account check.

The deployed Joomla `SiteApplication`, module dispatcher, `ModuleRenderer` and file-cache implementation were used. Existing account identities supplied the real permission checks; no users, permissions, passwords, stored module settings or stored global configuration were changed. Runtime-only configuration enabled/disabled module caching in a private isolated directory. Application and legacy session identity were kept consistent using memory-only CLI session storage; no authenticated browser session was manufactured.

| Dimension | Measured cases |
| --- | --- |
| Source | valid public PDF; missing PDF; rejected traversal path |
| Module cache | off / on |
| Warm-up sequence | editor → guest → guest → editor; guest → editor → guest → editor |
| Guest result on invalid source | empty output in every case; no editor diagnostic |
| Editor result on invalid source | explanatory status output in every case |
| Valid source | viewer markup in every case |
| Existing account without edit permission | empty error output |

Seven actual cache data files were observed, so cache-on results are not inferred solely from a configuration flag. The persistent global cache remained disabled, as before the test; the staging system page-cache plugin was also disabled. Stored configuration and module rows were verified unchanged. This review's isolated temporary cache files were subsequently removed; the full rollback snapshot and measured results were retained.

**Scope limit:** these are real CMS render/cache tests over SSH/CLI, not authenticated end-to-end HTTP sessions. Reverse-proxy caches, enabled system page caching and authenticated browser sessions have not been accepted by this test. The guest embedded-page path was subsequently checked below.

An initial diagnostic driver used inconsistent application/session identities and produced false cache failures. That run is not product-vulnerability evidence. The final driver explicitly checks matching identities and passes all 48 assertions; the private execution history retains the correction.

## Embedded staging page: browser follow-up

**MEASURED 2026-11-14 in the desktop app's Chromium in-app browser, as a guest on the owner-supplied HTTP staging page.** Both existing books loaded to `data-state="ready"`; the loaded viewer script used the alpha.19 version query and both instances reported PDF.js 6.5.438. Desktop rendering used WebGL. No console warnings or errors were captured during this session.

- The first book displayed four pages. Next-page navigation, selecting the last page from the thumbnail sidebar with Enter, ArrowLeft, Home, zoom to 125% and resetting zoom worked. The sidebar toggle exposed `aria-expanded` changes, page changes updated a `role="status"` element, and Tab moved to the next toolbar control with visible focus.
- The second book advanced automatically. Home on its focusable page area returned it to page 1 and stopped autoplay; it stayed there through the remaining checks.
- At a **390 × 844 CSS-pixel viewport**, both books remained ready, switched to the flat renderer and displayed one page. The first book advanced to page 2. Neither book's stage had horizontal overflow in the settled state (client width and scroll width both 352 pixels); the toolbar wrapped. Screenshots confirmed rendered content after resizing. The viewport override was reset afterward.
- Both regions currently have the same generic accessible name. Distinct, meaningful configured titles would help users distinguish the two books. The visible direct PDF links provide an alternative route; the accessibility of the PDF documents themselves was not assessed.

This confirms the real guest page-builder/template embedding. It does **not** establish authenticated HTTP cache isolation, real mobile-device behavior, screen-reader speech, PDF document accessibility or production HTTPS/CSP compatibility. Raw page evidence and screenshots remain private.

## Production HTTPS/CSP preflight

**Measured read-only against the live HTTPS homepage:**

- Certificate trust and hostname validation passed; TLS 1.3 negotiated.
- HTTP redirected to HTTPS.
- No direct `http://` resource references were found in the inspected homepage markup; the inspected browser console had no errors. This is not an exhaustive crawl of every stylesheet or page.
- Neither an enforced CSP header, a report-only CSP header nor a CSP meta element was present in the inspected response/page. HSTS was not present in that response.
- The new module was not embedded on the live homepage, and the three probed module asset paths returned 404. Therefore **PDF Book's actual production HTTPS/CSP integration remains NOT MEASURED**. This preflight does not install the module or change headers.

## Screen-reader listening: owner confirmation

**PASS, owner-reported on 2026-11-14.** The owner confirmed that they performed the actual listening test and that it passed. This closes the listening-test acceptance item on the basis of the owner's confirmation. Device, browser, screen-reader/version and individual test cases were not supplied; no particular combination or case coverage is inferred. This is owner attestation, not an independently instrumented result from this review.

## Remaining acceptance

1. Complete authenticated HTTP sessions and any intended site-level cache matrix. The actual guest embedded page has passed the browser checks above.
2. Review and test the intended production CSP in the context of the existing site. Do not claim an enforced policy was tested when none is deployed; any production header change is a separate authorized action.
3. Retain the prior alpha.19 findings about dirty-checkout archive identity, numeric edge parsing and large intermediate textures. The staging update does not fix those source-level limitations.

No production deployment, configuration change or overall production approval is implied by the successful staging update and module-level checks.
