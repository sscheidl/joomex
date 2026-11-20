# Independent review: PDF Book 0.1.0-alpha.15

Date: 2026-11-13. Reviewer: Codex. Request: REVIEW_REQUEST_0.1.0-alpha.15.md.

## 1. Verdict

NEEDS FURTHER REVIEW for acceptance of the exact requested package. The source at the specified commit is suitable for continued, limited staging use with the findings below; production approval is withheld.

The package identity gate is unresolved: two unchanged Linux builds are byte-identical to each other, but their SHA-256 is not the hash in the request. No alpha.15 tag or release asset was available from the repository at review time. This is not evidence of malicious modification; it prevents a claim that the named binary package was reviewed. Obtain the original ZIP and compare entries/metadata before accepting that package.

No exploitable visitor-to-server or PDF-to-script vulnerability was demonstrated in the measured scope. This is not a blanket security statement. There is a confirmed weakness in the ZIP publication guard, plus functional and accessibility findings. Real Joomla installation/access/caching, HTTPS integration, Safari and real mobile devices remain release gates.

No runtime, manifest, vendor or package-source file was changed. Review tests and this report are the only repository additions. A separate fix/pdf-book-0.1.0-alpha.16 already exists at 7a252f1 (sound changes); it was not included in this review or overwritten. Any implementation corrections require a separately coordinated new package version.

## 2. Reviewed state and evidence

|Item                     |MEASURED state                                                                                                                                                                                     |
|-------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Candidate                |`fix/pdf-book-0.1.0-alpha.15`, `21e68150d6d8cd2463428965118ff7fb8eba411a`                                                                                                                          |
|Review starting point    |`review/pdf-book-0.1.0-alpha.15`, `6109eea`; only the request document differs from the candidate                                                                                                  |
|Requested package SHA-256|`d67a50fbe28ce1e8f3978a3658709771a8200a7c470723c93519a583ea6374e0` — NOT reproduced                                                                                                                |
|Locally built package    |208 entries, 2,419,803 bytes; SHA-256 `7ca48681743374c1bc5e5a1a64074527fee36a49dfde5446e4b826ec8287aa07`                                                                                           |
|Build platform           |Debian 13 Linux; Python 3.12.14, zlib 1.3.2. Python 3.13.5 / zlib 1.3.1 produced the same local hash                                                                                               |
|Node / PHP               |Node 24.22.1; PHP CLI 8.4.24 with SimpleXML for dispatcher tests                                                                                                                                   |
|Browsers                 |Chromium headless shell 150.0.7871.181, software rendering; Firefox 153.0, both through Playwright 1.62.0                                                                                          |
|WebGL                    |Available and exercised in Chromium; unavailable in this Firefox environment, where flat fallback works                                                                                            |
|Joomla / database        |No real Joomla or database used. Dispatcher/template tests use the supplied Joomla stubs                                                                                                           |
|Devices                  |Linux headless browsers; desktop/narrow widths and Chromium touch emulation. No physical phone/tablet, Safari, Windows, macOS, Edge or screen reader                                               |
|PDF.js                   |6.5.438; official archive SHA-256 `fcbe9ba21d9911843e3502adc178a7f549a524a4055f887bedc942e5490c6ba1`; all 196 shipped files match both the lock and official archive, including renamed build files|

Evidence: evidence-0.1.0-alpha.15. All new measurements in this report were made on the date above. Earlier owner/developer observations are identified separately and are not treated as fresh measurements.

All files explicitly named in section 1 of the request were read completely. The review also inspected security requirements, prior reports, fixtures and browser tests. The request’s developer findings were consulted as comparison, not accepted as evidence by themselves.

## 3. Findings, by severity

No P0 or P1 runtime vulnerability was established. P2 findings below need resolution or an explicit, documented scope decision before production. P3 items do not independently block continued staging.

### R1 — P2 operation: automatic height ignores a height-only viewport change

Location: pdf-book/media/js/viewer.js:87, :297–303; manifest promise at pdf-book/module/mod_pdfbook.xml:19.

Expected: automatic height remains bounded by the current browser window. Actual, MEASURED in both browsers: with single-page mode and automatic height, the stage is 776 px high in a 1280×900 viewport. Resize to 1280×450: it stays 776 px high. Even an explicit non-animated redraw does not fix it.

Reproduction: alpha15_browser.py, “autoheight respects a smaller viewport at unchanged width”. The observer watches the stage, whose fixed CSS height need not change when the viewport height changes; fitHeight() additionally returns early whenever width/count are unchanged, without checking innerHeight, chrome or padding.

Impact/preconditions: any visitor resizing window height or encountering changing browser chrome with autoHeight=true; controls/book can fall outside the intended window-sized layout. Not an access-control or script-injection issue.

Fix/acceptance: include viewport height and relevant chrome/padding in the fit cache; trigger recalculation on viewport changes. At unchanged width, shrink and enlarge height, enter/leave fullscreen, and assert a stable bounded height without observer oscillation.

### R2 — P2 operation: mixed-format spreads misplace link annotations

Location: pdf-book/media/js/viewer.js:253–282; pdf-book/media/css/viewer.css:5.

Expected: the clickable rectangle follows the visible PDF link. Actual, MEASURED in both browsers: a portrait left page and landscape right page share the first page’s wrapper ratio. object-fit:contain letterboxes the right canvas, but annotation percentages use the entire wrapper. In the synthetic fixture, the link begins about 120 px above its visible red rectangle: actual 56.88 px vs expected 176.90 px within the wrapper.

Reproduction: alpha15_followups.py generates four pages with a landscape third page and a safe link over a red rectangle, then opens spread 2–3. See followups-chromium.json / followups-firefox.json.

Impact/preconditions: a document containing adjacent pages with different aspect ratios. Links activate over the wrong content and may be unreachable where drawn. This is a confirmed UI correctness issue, not demonstrated malicious redirection. It affects fixed height as well as automatic height and is distinct from D5. The layout mechanism predates the newly reviewed animations.

Fix/acceptance: position annotations within each page’s actual fitted image rectangle, or size individual page content containers to their own aspect ratios. Assert ≤2 CSS px error for portrait/landscape, rotations, RTL, zoom and single/double mode; verify the WebGL texture aspect treatment separately.

### R3 — P2 publication/security tooling: ZIP contents bypass the vendor/binary policy

Location: scripts/check_publication.py:102–111.

Expected: release archives enforce the same hash-pinned vendor and binary policy as repository files. Actual, MEASURED: both an archive containing an unlisted binary unlisted.dat and an archive containing altered binary bytes at media/vendor/pdfjs/build/pdf.js pass with exit code 0 and zero findings.

Entry/preconditions/data flow: a packager, compromised build step or accidental post-build mutation supplies the ZIP passed to --zip. Repository verification still examines the clean checkout. The ZIP loop skips binary data under any path containing media/vendor/; elsewhere it text-scans but does not reject unlisted binary files. It does not compare archive vendor bytes with dependencies.json.

Impact: a passing publication check cannot establish that a release archive follows the binary/vendor policy. No evidence that the reviewed source or an actual distributed package was compromised. build.py independently rejects a modified mapped shipped_as file; that protection does not authenticate an arbitrary archive passed later to the guard.

Reproduction: alpha15_integrity.py, the two “ZIP guard rejects …” assertions. Fix/acceptance: map ZIP paths to the expected project manifest; verify vendor hashes; reject unexpected binaries, missing/extra entries and duplicates. Both adversarial archives must fail, the genuine package must pass. Keep the private deny-list check as a separate required gate.

### R4 — P2 release evidence: the requested package hash is not reproducible here

Location: pdf-book/scripts/build.py:48–67; exact-candidate table in the request.

Expected: a clean Linux build reproduces the specified Linux artifact. Actual, MEASURED: two builds with no package-source changes yield the local hash in section 2. A second Python/zlib combination yields that same local hash. All shipped dependency bytes match the official archive; tracked text has LF endings. Repacking with Windows/Unix creator metadata and compression levels 1, 6 and 9 did not recover the requested hash.

Impact/preconditions: release verification cannot bind the requested ZIP to this tested source. Cause is unresolved, and must not be attributed solely to D4 or zlib without the original archive.

Fix/acceptance: supply the original artifact; compare all entry names, uncompressed hashes, timestamps, flags, creator fields and compression settings. Record the exact build toolchain. Correct stale release metadata or publish a correctly versioned replacement as appropriate; never silently relabel different package bytes.

### R5 — P3 lifecycle: disposal leaves CSS animations running briefly

Location: pdf-book/media/js/viewer.js:175–248, :398.

Expected: closing a viewer immediately cancels active animations and releases transient layers. Actual, MEASURED in both browsers: disposing during an 1800 ms fold returns with pdf.disposed=true, but five animations remain running, one fold remains and busy=true. They finish and clean up after their original duration; queued work does not restart. This is bounded retention, not evidence of an accumulating permanent leak.

Impact/preconditions: closing/removing a dialog during a fold keeps its cloned canvases and animation work alive temporarily, particularly relevant at high zoom/DPR. Slide/fade use the same untracked animation-promise pattern, although the measured five-animation example is the fold.

Fix/acceptance: track/cancel active Animation objects on dispose/error and settle cleanup idempotently. Immediately after await dispose(), no running animation or transient layer should remain, and no navigation should resume.

### R6 — P2 accessibility: sidebar toggles do not expose their state

Location: pdf-book/media/js/viewer.js:45, :330–354.

Expected: users of assistive technology can determine whether thumbnails or the outline are open. Actual, MEASURED in both browsers: opening the outline leaves both aria-pressed and aria-expanded absent; accessible names remain unchanged. The same construction is used for thumbnails. Autoplay does correctly update aria-pressed.

Impact/preconditions: keyboard/screen-reader users navigating these toggle buttons. No screen reader was run; the missing DOM accessibility state is directly measured.

Fix/acceptance: use aria-expanded plus aria-controls (or an appropriate pressed-button pattern); update both controls when opening, switching and closing the sidebar. Assert initial/expanded/collapsed states and confirm announcements with a screen reader.

### T1 — P3 test maintenance: legacy assertions produce misleading failures

Location: pdf-book/tests/review/review_browser.py:83, :136 and WebGL setup in t_webgl().

The outline test counts all .pdfbook svg nodes, including 11 legitimate toolbar icons. Its FAIL is not an XSS finding: scoped follow-up assertions show inert text, no injected nodes and no execution. The rapid-arrow test waits 1500 ms, less than two complete 800 ms turns; Chromium reports intermediate page 6. Waiting for navigation to settle yields page 8 in both browsers. Firefox’s context-loss probe throws because this environment has no WebGL context; its flat fallback is functioning.

Acceptance: scope injection assertions to untrusted-content containers; await final page and queue settlement; label unavailable WebGL tests SKIP/NOT RUN and independently test fallback. Derive browser/Playwright metadata dynamically: the old suite hard-codes Edge and Playwright 1.65.0.

## 4. Developer findings D1–D9

|ID|Independent assessment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
|--|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|D1|**Partly confirmed fix; real-device result NOT MEASURED.** Chromium touch emulation starts without an audio context; tapping Next creates a running context and reaches page 2. Disposal clears the context reference. Event coverage and resume callbacks were inspected. Actual sound was not listened to; iOS/Android activation remains open. P2 until device confirmation; alpha.16 sound changes are outside this review                                                                                                                                                                                                                            |
|D2|**Fixed in measured scope.** Eight manual paths stop autoplay: Next, page field, thumbnail, bookmark, internal destination, arrow key, pointer swipe and page tap; cinema-mode paths included. Page remains unchanged across another interval. Zoom preserves autoplay; reduced motion suppresses autostart. Keyboard has a stop mechanism via the focusable stage; a separate pause button is not inherently required by the [W3C explanation of SC 2.2.2](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), which permits other stopping mechanisms. Discoverability/screen-reader usability and full WCAG conformance are NOT MEASURED|
|D3|**Confirmed at source level, P3.** Nine depth lookups remain in the shader before multiplication by a zero uniform (`turn.js:80–82`, `:245`). Actual GPU cost/driver optimization NOT MEASURED. Remove/compile out unused work rather than claiming a quantified performance gain                                                                                                                                                                                                                                                                                                                                                                         |
|D4|**Confirmed, P2 reproducibility.** `ZipInfo` defaults to creator system 3 on Unix and 0 when its platform branch is Windows; build does not set it. Actual Windows execution NOT RUN. This does not explain away R4, which occurred on Linux                                                                                                                                                                                                                                                                                                                                                                                                              |
|D5|**Confirmed behavior, documented limitation.** `autoRatio` captures the first displayed format. The manifest explicitly promises first-page format, so this alone is not a newly established regression. Mixed-format content may leave space or scroll. R2 is an additional concrete link-placement defect                                                                                                                                                                                                                                                                                                                                               |
|D6|**Private check not available.** No private deny-list was supplied in this checkout/environment; generic checks passed. Historical pushes and their checks cannot be independently reconstructed from the statement alone. No actual forbidden-name disclosure was established. Full publication gate remains open                                                                                                                                                                                                                                                                                                                                        |
|D7|**Not reproduced in Chromium/Firefox fold snapshots.** Both axes show plausible front/back behavior in inspected mid-fold screenshots. Filter/preserve-3d code is present; Safari behavior remains NOT MEASURED. Do not promote the hypothesis to a confirmed Safari defect                                                                                                                                                                                                                                                                                                                                                                               |
|D8|**Remote alpha.15 tag/release missing at review time.** Repository tag inventory lacks alpha.15 and the release-by-tag endpoint returns 404. Older alpha.9–14 publication states were not exhaustively checked. No tags were pushed                                                                                                                                                                                                                                                                                                                                                                                                                       |
|D9|**Confirmed, intentional tradeoff; P3 at most.** A render delayed behind an injected gate can be discarded when newer input wins. Follow-up reaches the final requested page with the queue cleared. Some wasted render work is expected; no lost final request was observed                                                                                                                                                                                                                                                                                                                                                                              |

## 5. Earlier findings

“Fixed” below is limited to the evidence shown; stub tests do not certify real Joomla.

|ID |Status                               |Current evidence / remaining limit                                                                                                                                         |
|---|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|F1 |Fixed in source/stubs                |Correct media asset registration, CSS loads/applies in both browsers; actual Joomla update still NOT RUN here                                                              |
|F2 |Fixed in measured scope              |Rapid button/key input, delayed rendering, mode/zoom changes during a fold and resize settle; legacy timing false failure explained in T1                                  |
|F3 |Fixed                                |1001-page rejection remains an error after resize; controls stay disabled in both browsers                                                                                 |
|F4 |Fixed                                |Slow response completes in about 45 s; stalled response fails at about 20 s, both browsers                                                                                 |
|F5 |Fixed                                |Tested network/parser failures show fixed German messages; no raw exception in user status                                                                                 |
|F6 |Fixed in source/build                |Versioned relative imports/worker and build validation; stale browser-cache upgrade path NOT MEASURED                                                                      |
|F7 |Fixed in measured subset             |Unused scripting/WASM files excluded; JPEG 2000 fallback passes; official vendor hashes verified. JBIG2 and color fidelity remain open                                     |
|F8 |Fixed in stubs/browser               |Root-relative base resolves correctly in supplied `/sub/` test harness; real Joomla subdirectory/proxy deployment NOT RUN                                                  |
|F9 |Fixed for measured Linux paths       |32 supplied PHP checks plus 41 extended vectors: 10 valid accepts, 31 rejects including an actual symlink out of `images/`. Windows junction/ADS/8.3 semantics NOT MEASURED|
|F10|Fixed in measured layouts            |Legacy width/DPR matrix and low-height dialog tests pass; R1 is a separate automatic-height issue                                                                          |
|F11|Fixed                                |Three-mode cycle and narrow automatic single-page behavior pass                                                                                                            |
|F12|Fixed                                |Singular/plural unit tests pass; displayed status matches tested spreads                                                                                                   |
|F13|Partly verified                      |Mouse-simulated zoom/edge swipe passes; touch-action code present. Real touch pan/pinch NOT MEASURED                                                                       |
|F14|Not fixed; intentionally retained    |25 MP fixture omits the image; 15 MP fixture renders. No user-facing omission notice; document the limit                                                                   |
|F15|Fixed in stubs; live access gate open|Guest output empty, editor output explanatory; full Joomla ACL/module-caching matrix NOT RUN                                                                               |
|F16|Documented; local CSP rechecked      |Existing policies and new-animation strict-style tests pass locally; real server HTTPS/CSP NOT RUN                                                                         |
|N1 |Fixed in measured layouts            |Dialog toolbar usable at 320×225, 640×300, 568×320, 844×390, both browsers                                                                                                 |
|N2 |Fixed                                |Injected render failure disposes document, empties cache and releases the extra worker                                                                                     |
|N3 |Fixed                                |Mapped PDF.js error names match shipped code; unit test passes                                                                                                             |
|L1 |Fixed in source/build                |No shipped `.mjs`; module imports use `.js`; actual server MIME update NOT RUN here                                                                                        |
|L2 |Partly verified                      |Sheet geometry length/endpoints pass; exact visual size/color parity on real GPUs NOT MEASURED. Mixed-format behavior requires R2 follow-up                                |
|L3 |Partly verified                      |Curved renderer and gutter/shadow paths inspected; Chromium extremes/context-loss pass. No quantified smoothness/legacy-parity or weak-GPU result                          |
|L4 |Fixed in measured layouts            |24 px SVG icons, layout/hit-target checks pass; old injection test needs T1 update                                                                                         |
|L5 |Fixed in measured scope              |Page clicks, active-book arrows, input-field exclusion, RTL, Home, End and dialog isolation pass                                                                           |

## 6. Test matrix

|Area                                                                                     |Result                                |Scope and evidence                                                                                                                                                                                                                                         |
|-----------------------------------------------------------------------------------------|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|Model tests                                                                              |PASS                                  |12/12, `node --test tests/model.test.mjs`                                                                                                                                                                                                                  |
|PHP source / dispatcher                                                                  |PASS                                  |32 / 11 checks; PHP syntax valid for all eight project PHP files; not real Joomla                                                                                                                                                                          |
|Extended paths                                                                           |PASS within Linux scope               |41 vectors, real outward symlink, sparse oversized file and header checks                                                                                                                                                                                  |
|Browser smoke                                                                            |PASS                                  |All supplied smoke assertions, Chromium; browser launcher adapted, product source unchanged                                                                                                                                                                |
|Full legacy Chromium suite                                                               |24 PASS, 2 FAIL, 4 INFO               |Both FAILs explained/rechecked in T1; not presented as an all-green original run                                                                                                                                                                           |
|Full legacy Firefox suite                                                                |22 PASS, 1 FAIL, 1 ERROR, 4 INFO      |Inert-outline false failure; WebGL probe unavailable/error; other recorded checks pass                                                                                                                                                                     |
|New matrix                                                                               |PASS in both engines                  |42 combinations per engine: WebGL/fold(auto/horizontal/vertical)/slide/fade/flat × auto/single/double × LTR/RTL. Forward/end/back navigation; correlated heading/toolbar/frame/autoheight variants. Firefox WebGL rows exercise fallback, not GPU rendering|
|New targeted suite                                                                       |9 PASS, 3 FAIL per engine             |Queue/delayed-render/state/autoplay/reduced-motion pass; R1/R5/R6 fail as expected. Strict CSP produces no violation in 42-case matrix                                                                                                                     |
|Mixed-page links                                                                         |FAIL                                  |R2 in both engines; generated benign fixture and numeric geometry measurement                                                                                                                                                                              |
|Sheet geometry                                                                           |PASS, sampled                         |20,541 progress/curvature pairs; no nonfinite points, negative height or proper segment intersection; length error <9×10^-16. This is a sampled numerical check, not a proof for every real input                                                          |
|Animation visual checks                                                                  |PARTIAL                               |Mid-fold horizontal/vertical screenshots inspected in Chromium/Firefox; no reproduced D7 fault. Full four-case direction/RTL frame-by-frame visual acceptance NOT RUN                                                                                      |
|Tempo / appearance extremes                                                              |PARTIAL PASS                          |150 ms matrix, 800 ms queue, 1800 ms fold/disposal and legacy maximum/zero-curvature-shadow tests. No physical GPU frame-time benchmark                                                                                                                    |
|Autoplay                                                                                 |PASS in measured paths                |1 s manual-stop tests, legacy end/hidden-tab checks, reduced-motion suppression, 60 s configuration with zoom preservation; a complete elapsed 60 s playback/loop matrix NOT RUN                                                                           |
|Audio                                                                                    |PARTIAL PASS                          |Chromium touch emulation context unlock/dispose. Audible quality, repeated real-device activation and concurrent-book audio NOT MEASURED                                                                                                                   |
|PDF actions / DOM / links                                                                |PASS for supplied adversarial fixtures|OpenAction, AA, document/link JavaScript, Launch, SubmitForm, GoToR, XFA inert; title/bookmark data inert; safe external links use noopener/noreferrer; internal destinations work                                                                         |
|Network / CSP                                                                            |PASS locally                          |Same-origin resources, redirect refusal, no observed external requests; default/strict-style/nonce policies. HTTPS deployment NOT RUN                                                                                                                      |
|Resource/error lifecycle                                                                 |PARTIAL PASS                          |Damaged/encrypted/oversized/1001-page files handled; 1000-page/2000-link/image fixtures load within tested limits; 1000-page test creates 5 then 10 thumbnail canvases. Not a worst-case CPU/GPU/memory proof                                              |
|Package/dependencies                                                                     |PARTIAL / FAIL identity               |196/196 official file matches; repeated local build passes; expected artifact SHA fails; `shipped_as` mutation rejected                                                                                                                                    |
|Publication guard                                                                        |Generic PASS; policy incomplete       |Clean repo/local ZIP scan has zero generic findings. Adversarial ZIP policy tests fail R3. Private deny-list NOT RUN                                                                                                                                       |
|Joomla install/update/rollback/uninstall, Atum light/dark and showon/save, ACL/cache     |NOT RUN                               |Historical owner observations are useful context, not current independent acceptance                                                                                                                                                                       |
|Safari/macOS, iOS Safari, Android Chrome, Windows/Edge, screen readers, physical weak GPU|NOT RUN                               |Emulated dimensions and touch events are not device tests                                                                                                                                                                                                  |

The settings matrix is deliberately reported as partial coverage, not the full Cartesian product requested. Fullscreen/orientation, portrait/landscape/mixed formats under every renderer, browser zoom, native touch scrolling and all backend extreme/empty values still need targeted device/Joomla work.

## 7. Security assessment and open limits

The PHP source resolver remains anchored to realpath(images/), checks size/header and does not proxy external URLs. JSON is encoded into a quoted data attribute and then parsed as data; titles/bookmarks use textContent; links are scheme-allowlisted. The browser revalidates settings and clamps numeric geometry inputs. PHP does not independently allowlist every enum (flipAxis, mode, renderer); JS does, and no executable sink was demonstrated. The maximum render dimension/pixel and six-item cache limits remain present.

DOM cloning removes page links/buttons from visual fold copies. Current page wrappers/canvases have no IDs or other interactive descendants to duplicate. Listener abort and final mounts passed tested navigation paths. CSS animation cancellation is the bounded exception R5. Document errors dispose the PDF; WebGL context loss in Chromium settles to a usable flat view. Partial GL allocation failure, device texture limits, mediump precision artifacts and worst-case PDF parser/render workloads were not exhaustively fault-injected or profiled.

Dated dependency advisory check (2026-11-13): the upstream advisory list lists GHSA-wgrm-67xf-hhpq / CVE-2024-4367 and GHSA-hq66-cqwq-w95j / CVE-2026-16633. Their listed patched versions, 4.2.67 and 6.2.108, precede 6.5.438. The upstream releases page identifies 6.5.438 as the latest release consulted. No relevant unfixed advisory was found in those consulted sources. This does not rule out unknown defects; no scripting manager is instantiated and action fixtures passed independently.

Known limits in the request remain: no text layer, no plugin/gallery/manual-TOC/image-folder features, German-only UI, no interactive dragging, WebGL animation only in double view and no promised legacy visual parity. Canvas page labels do not make PDF content accessible. In cinema mode keyboard navigation stops autoplay, but discoverability and content accessibility still need a real assistive-technology evaluation. Hiding the PDF-open link is not access control and should be stated explicitly in its field description. Public media cannot hold confidential documents.

Staging HTTP offers no transport integrity against an on-path attacker; source hashing during review does not protect later HTTP delivery. HTTPS behavior and real server CSP must be checked before production. No production or staging server was changed.

Minor configuration/documentation points from source review: the height default is 500 in manifest/PHP but 560 in standalone JS; PHP casts empty numeric values differently from JS fallback normalization; duration is hidden for flat mode even though it still affects synthesized sound length and minimum autoplay spacing. These are not demonstrated injection vulnerabilities, but defaults/descriptions should be aligned and extreme/empty values tested through Joomla.

## 8. Prioritized hand-back

|Priority          |Task                                                                              |Verifiable acceptance                                                                                                                                                                  |
|------------------|----------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
|First             |Reconcile R4 and package provenance                                               |Original ZIP supplied; complete entry/metadata comparison; exact source/build/toolchain and final SHA recorded                                                                         |
|First             |Repair archive publication policy R3; run private deny-list                       |Both malformed archives rejected, genuine artifact accepted, required private scan completed before commit/release                                                                     |
|Before production |Fix mixed-page annotation coordinates R2                                          |≤2 CSS px error across format/rotation/RTL/zoom matrix and correct clickable target                                                                                                    |
|Before production |Fix viewport-aware autoheight R1                                                  |Height-only resize shrinks/grows appropriately; fullscreen/sidebar/orientation transitions stabilize without repeated renders                                                          |
|Before production |Expose toggle state R6 and verify accessible playback                             |State assertions pass; screen-reader/keyboard user can locate, stop and navigate autoplay/cinema mode; PDF content has an accepted accessible alternative                              |
|Next correction   |Cancel animation lifecycle R5                                                     |No active animations/transient layers immediately after dispose/error; no queued restart; repeated close during high-DPR fold does not accumulate work                                 |
|Next test work    |Repair T1 and extend new tests                                                    |Reliable awaited queue assertions; scoped injection probes; truthful environment metadata and unavailable-GPU handling. Preserve regression checks for R1/R2/R5/R6                     |
|Device/Joomla gate|Complete backend, install/update, ACL/cache, HTTPS/CSP and physical-browser matrix|Record actual versions/devices; confirm D1 on iOS/Android and D7 in Safari; verify restricted-editor errors and cached module output across roles                                      |
|Performance gate  |Profile rather than infer                                                         |100-page high-DPR fold/WebGL stress, repeated dialog close, many books, worst-case PDFs, bounded CPU/memory/GPU and no resource growth after disposal; remove inactive self-shadow work|

Deliverables prepared: this English report, sanitized measurement files and four independent review test scripts under tests/review/alpha15_*. They are review tooling, not an alpha.16 implementation. The private deny-list is unavailable, so the mandatory full publication check and consequently commit/push/PR remain pending. Generic checks alone are not reported as completion of that gate.
