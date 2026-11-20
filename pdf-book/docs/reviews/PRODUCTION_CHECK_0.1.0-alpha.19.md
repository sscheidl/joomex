# Production acceptance follow-up: PDF Book alpha.19

**Measured 2026-11-13; staging/live embedded-page browser follow-up and owner listening-test confirmation 2026-11-14. Production approval remains open.** This record supplements [the alpha.19 artifact review](REVIEW_0.1.0-alpha.19.md). Deployment-specific evidence is retained privately by the owner; no site names, document paths, account identifiers or credentials are included here.

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

**Initially measured 2026-11-13 read-only against the live HTTPS homepage:**

- Certificate trust and hostname validation passed; TLS 1.3 negotiated.
- HTTP redirected to HTTPS.
- No direct `http://` resource references were found in the inspected homepage markup; the inspected browser console had no errors. This is not an exhaustive crawl of every stylesheet or page.
- Neither an enforced CSP header, a report-only CSP header nor a CSP meta element was present in the inspected response/page. HSTS was not present in that response.
- At that time, the new module was not embedded on the live homepage, and the three probed module asset paths returned 404. The actual module page was subsequently supplied and checked below. This initial preflight did not install the module or change headers.

## Actual production HTTPS page follow-up

**MEASURED 2026-11-14, read-only guest checks of the owner-supplied live page. HTTPS integration PASS in this scope.** The module was already deployed when this check began; this review did not install or change anything on production.

- The actual embedded page returned HTTP 200 over HTTPS. Certificate trust/hostname validation passed with TLS 1.3; its HTTP URL redirected to the HTTPS page.
- Both books reached `ready`, reporting PDF.js 6.5.438 and the WebGL renderer. The viewer script and stylesheet references carried alpha.19. Next-page navigation and ArrowLeft worked on the first book; Home returned the autoplaying second book to page 1 and stopped it.
- Seven HTTPS-served files matched the original release ZIP byte for byte: the viewer, model, PDF document adapter, turn renderer, stylesheet, PDF.js library and PDF.js worker. This is a seven-file public asset check, not a repeat of the 211-file staging installation check. Both configured PDF URLs returned HTTP 200 to HEAD requests over HTTPS.
- No warnings or errors, including mixed-content or CSP errors, were captured in the inspected browser session. No direct `http://` resource attributes were found in the inspected page markup/DOM. This is not an exhaustive crawl or a recorded inventory of every network request.
- The actual page response had neither enforced CSP, report-only CSP nor HSTS; no CSP meta element was present. Consequently compatibility with an enforced CSP remains **NOT MEASURED**. The HTML response advertised `no-store, no-cache, must-revalidate`; this header alone does not establish authenticated HTTP/cache isolation.

Private HTTP/TLS/hash evidence, browser state and a screenshot are retained by the owner.

## Screen-reader listening: owner confirmation

**PASS, owner-reported on 2026-11-14.** The owner confirmed that they performed the actual listening test and that it passed. This closes the listening-test acceptance item on the basis of the owner's confirmation. Device, browser, screen-reader/version and individual test cases were not supplied; no particular combination or case coverage is inferred. This is owner attestation, not an independently instrumented result from this review.

## Remaining acceptance

1. Retest the full end-to-end invalid-source/role matrix if site-level caching is subsequently enabled. The regular authenticated frontend and independent guest reads of the current valid-source page passed the follow-up below; global/system page caching is currently off.
2. Resolve the existing page-builder inline-script conflict and validate any intended production CSP on the server. The local replay below passes the module-level checks but does not accept a policy for the complete production site. Any production header change is a separate authorized action.
3. Retain the prior alpha.19 findings about dirty-checkout archive identity, numeric edge parsing and large intermediate textures. The staging update does not fix those source-level limitations.

No production deployment, configuration change or overall production approval is implied by the successful staging update and module-level checks.

## Cache configuration and local CSP experiment

**MEASURED 2026-11-14.** A read-only inventory through the existing pinned SSH operations bridge confirmed that **both staging and production have global Joomla caching set to 0 and the system page-cache plugin disabled**. Neither installed PDF Book instance explicitly overrides the module-cache parameters. The configuration files remained unchanged. Four HTTPS requests in the sequence guest A → guest B → guest B → guest A, using two independent unauthenticated cookie jars, all returned HTTP 200 with two book instances and `no-store, no-cache, must-revalidate`. No `Age` or `X-Cache` header was present. These facts describe the current cache-off deployment; they do not prove editor/guest isolation through an enabled site or proxy cache. The prior real Joomla 48/48 module-cache assertions remain the cache-on rendering evidence.

A loopback-only replay of the captured public live page was served with test CSP response headers in the Chromium in-app browser. Public assets were fetched by bounded GET only; no client cookies or authorization were forwarded upstream. Protocol-relative resource attributes were resolved to HTTPS as on the original live page. The test changed no live/staging content, settings or headers. Report-only monitoring followed the [CSP policy delivery model](https://www.w3.org/TR/CSP/#csp-header).

| Local experiment | Measured result |
| --- | --- |
| Report-only, scripts from self, no inline-script allowance | Both books ready with WebGL; seven inline-script violation reports from the captured document and existing page-builder runtime. |
| Same policy enforced | Both books ready; next-page navigation reached pages 2–3. Seven inline-script violations were enforced. This is not whole-page compatibility. |
| Enforced policy plus hashes for six captured inline script blocks | Both books ready; Enter on Next reached pages 2–3. One runtime-injected page-builder inline script remained blocked. Snapshot-specific hashes are not a deployable site-wide configuration. |
| Separate module fixture: sound enabled, sound fetches excluded from connect-src | Two enforced connect-src violations; neither audio request reached the proxy. The book remained ready and navigated to pages 2–3 with WebGL. Optional blocked audio did not break navigation. |

The local policies allowed self-hosted module scripts/workers/PDF fetches and inline styling, omitted `unsafe-eval`, and denied object embedding and inline event handlers. This is not a strict-style test. No upstream public-asset failures occurred. The initial replay used HTTP resolution for a protocol-relative video iframe; that harness artifact was corrected, and the final HTTPS-normalized runs are the evidence summarized here. No video-frame violation remained in those runs.

**Outcome:** the measured module behavior tolerates the tested CSP, including blocked optional sound. The existing page-builder inline script still needs integration work before accepting the complete page under that policy. Production itself still has no CSP. Real HTTPS policy delivery, additional pages, ordinary authenticated login and the complete editor/guest HTTP cache matrix remain outside this local experiment. Test servers were stopped afterward. Raw private reports, policies and screenshots are retained outside this public repository.

## Ordinary authenticated frontend follow-up

**MEASURED 2026-11-14: PASS for the current valid-source page with site caching off.** The owner completed the normal HTTPS frontend login in the in-app browser. Three authenticated page loads were interleaved with four fresh independent unauthenticated HTTPS clients in the sequence **authenticated → guest → guest → authenticated → guest → guest → authenticated**. No authenticated browser cookies, credentials, account names or account IDs were extracted or recorded.

- Both books reached `ready` on all three authenticated loads; the viewer query reported alpha.19 and the initial authenticated books reported PDF.js 6.5.438. The narrow browser pane selected the flat renderer.
- An article-edit link was present in each authenticated DOM. All four guest HTTP responses contained two books and no article-edit link, with HTTP 200 and `no-store, no-cache, must-revalidate`; no `Age` or `X-Cache` header was present. This demonstrates the observed frontend distinction for the current page; the article-edit link does not establish module-edit permission for this account.
- Authenticated next-page navigation, Enter to select page 4 in the thumbnail sidebar, sidebar open/close, zoom to 125%, ArrowRight and ArrowLeft worked. Home returned the second book to its first page. No browser console warnings or errors were captured; the final view was restored to page 1.
- No production content, PDF sources, permissions, module parameters or cache settings were changed. Missing/forbidden source diagnostics were not induced on the live page. Those cases remain covered by the separate 48/48 real Joomla renderer tests, not by this HTTP follow-up. An enabled system/proxy cache matrix was not measured.

The ordinary authenticated-page check is now complete in this scope. Private timed evidence and a screenshot are retained by the owner; the existing whole-site CSP integration finding remains open.
