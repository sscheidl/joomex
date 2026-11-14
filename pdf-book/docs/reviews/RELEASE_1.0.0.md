# PDF Book 1.0.0 release record

Prepared and locally validated 2026-11-14 at the owner's request. Version 1.0.0 is a new build based on the independently reviewed alpha.19 source and documented deployment follow-up. **The new archive passes the measured local checks below.** No stable tag, published release or production installation is created by preparing this record.

The package retains its module identifier and settings. The display name loses the prototype suffix. Changes close the archive deletion case N19-1, the numeric edge cases N19-2 and the intermediate letterbox resource concern from [the alpha.19 review](REVIEW_0.1.0-alpha.19.md).

The website-wide CSP conflict found in the prior local replay concerns adopting a new policy in an existing page builder. Such a rollout is separate hardening work; it is not by itself a condition for the module's release. Prior alpha.19 deployment evidence remains attributed to that exact version, not silently transferred to changed 1.0.0 bytes.

The artifact manifest records the clean committed package inputs, toolchain and per-entry hashes. ZIP compression can vary across zlib implementations; immutable source-entry comparisons remain required.

## Exact package

| Item | MEASURED result |
| --- | --- |
| Package | `mod_pdfbook-1.0.0.zip` |
| SHA-256 | `be92e771c838545419fd3daa3211c3341221a37077860c86235cf48c344c1d5b` |
| Size / entries | 2,428,018 bytes / 211 unique regular-file entries |
| Source identity | Complete entry inventory and bytes match immutable Git blobs at the commit recorded in the supplied manifest. |
| Manifest / checksum | All 211 per-entry hashes and the package checksum agree. |
| Repeat build | Identical ZIP bytes with the same Python/zlib toolchain. |

The original alpha.19 files are preserved unchanged. The new ZIP, its own `manifest.json` and its own `SHA256SUMS.txt` form one artifact set; they must be kept together outside Git.

## Validation

Environment: Windows, Python 3.12.10 / zlib 1.3.1, Node 24.22.1, PHP 8.5.12, Playwright 1.65.1, Edge 157.0.4341.57 and Firefox 159.0. PHP tests use Joomla stubs; browser fixtures are synthetic PDFs. The PHP path checks required filesystem access outside the command sandbox. No product failure was inferred from the sandbox-restricted file lookup.

| Command / check | MEASURED result |
| --- | --- |
| `node --test tests/model.test.mjs` | 14 groups pass; 27 shared numeric vectors; letterbox limits tested across 512–16384 reported texture caps and extreme aspect ratios. |
| `php tests/source.php` | 32 path/header/output checks pass. |
| `php tests/dispatcher.php` | 40 checks pass, including the same 27 numeric vectors. |
| `python tests/publication_zip.py` | 14/14 pass, including deleted source + matching archive omission and modified source + matching content. Genuine/recompressed archives pass. |
| `tests/browser_smoke.py` | PASS in Edge and Firefox: navigation, queue, zoom, outline/dialog, mobile flat fallback, multiple books, inert PDF actions, unsafe links rejected and no external requests/page errors. |
| `tests/alpha17_regressions.py` | 9/9 in Edge and 9/9 in Firefox; height-only resizing, mixed-format annotations, sidebar states and disposal cleanup. |
| `tests/release_regressions.py` | Two fixtures pass in each engine with a simulated 1024-edge GPU cap. Extreme letterboxes upload as 102×1024, both books remain ready, GL error is 0. Mixed-format face uploads are 615×869; the red fixture rectangle ratio is 3.452, within the raster tolerance of 200/60. |
| Private publication guard | Repository and exact ZIP checked with 41 private terms, zero findings. |

The new texture test initially inspected the incoming turn, which does not carry the fixture's red page, and then sampled before the resize queue settled. The corrected test inspects the turn leaving pages 2–3 and waits for the queue to settle. The final successful runs are the recorded measurements; the setup errors were not product findings. The 1024 limit is simulated, not a physical weak-GPU test.

## Dependency advisory snapshot

Checked 2026-11-14: [Mozilla's release list](https://github.com/mozilla/pdf.js/releases) identifies 6.5.438 as current. The two published advisories were reviewed: [GHSA-wgrm-67xf-hhpq](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq) lists patched version 4.2.67, and [GHSA-hq66-cqwq-w95j](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j) lists patched version 6.2.108. The bundled 6.5.438 is newer than both listed patch versions. This module does not load a PDF scripting manager/sandbox, and malicious PDF actions remain inert in both smoke runs. This is a dated advisory/source check, not continuous vulnerability monitoring or a complete security audit.

## Deployment scope

The prior real-Joomla 48/48 rights/cache checks, normal authenticated/guest HTTPS page checks and owner screen-reader confirmation apply to alpha.19. The 1.0.0 ZIP has **not yet been installed on a real Joomla instance in this follow-up**, and no new physical-device or screen-reader listening run was performed on these changed bytes. Retain a backup and validate the new update on staging before a production update. No new production deployment is performed here.

A separate website CSP rollout is optional additional hardening. The existing page-builder integration conflict does not by itself block the module build. Site/proxy caching should retain the recorded cache-off configuration until its full role/source HTTP matrix is tested when enabling it.

Structured measurements: [evidence-1.0.0/results.json](evidence-1.0.0/results.json).
