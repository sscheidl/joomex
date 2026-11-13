# Follow-up review: PDF Book 0.1.0-alpha.18

Independent review, 2026-11-13. Candidate: `e4be5052819323ac6899880c5c810d848c8237da`; review-request branch base: `60017aadf5158b9091f31109c0f5c166dc742c0f`. Scope: the 22 changed files in `git diff 21e6815 e4be505`, the requested corrections, archive verification and the new audio component. No package code was changed.

## Verdict

**GitHub pre-release: HOLD.** The ordinary generated package passes the current gate, but that gate still accepts additional, unexamined ZIP payloads (N18-1). Resolve the archive findings and rerun the gate before publishing. The exact developer-supplied ZIP with SHA-256 `3f202ba49333f81ce6ccb2a5298aa6ce92f60ea66b2cbfddc4e27e7e6187466e` was not available in the attachment or checkout; its identity is **NOT MEASURED**. This is a verdict about readiness, not authorization to publish a release or tags.

**Production: BLOCKED.** In addition to the archive gate, close the integration, production-server, accessibility and device evidence listed below. Mixed-format WebGL pages also remain distorted during turns.

The baseline [alpha.15 report at `344287c`](https://github.com/sscheidl/joomex/blob/344287c/pdf-book/docs/reviews/REVIEW_0.1.0-alpha.15.md) was recovered from `origin/review/pdf-book-0.1.0-alpha.15` and read during the final history audit. It is absent from the candidate tree, which explains the broken relative links. Its original evidence directory and four named test scripts are not present in that report commit. Correction IDs below were checked against that report's original acceptance criteria as well as the follow-up request; fresh measurements are distinguished from the baseline's historical results.

## Environment and measured checks

All measurements below were made on **2026-11-13, Windows x64**, Python **3.12.10**, stock zlib **1.3.1**, Node **24.22.1**, portable PHP **8.5.12**, Playwright **1.65.1**, headless Edge **157.0.4341.46** and Playwright Firefox **159.0**. PHP used Joomla stubs, not a Joomla installation. The fixture generators require pypdf before 7; pypdf **6.21.4** and Pillow **13.0.0** were used. An initial attempt with pypdf 7 failed because `add_js` was removed; no candidate code was changed to work around that.

| Check | MEASURED result |
| --- | --- |
| `node --test pdf-book/tests/model.test.mjs` | 12 passed |
| `php pdf-book/tests/source.php` | 32 passed |
| `php pdf-book/tests/dispatcher.php` | 13 passed |
| `python pdf-book/tests/alpha17_regressions.py` | 9/9 in Edge; 9/9 in Firefox |
| `python pdf-book/tests/browser_smoke.py` | passed in Edge and Firefox, with WebGL active |
| Legacy review suite, latest result per case after fixture completion | Firefox: 26 PASS, 4 INFO; Edge: 25 PASS, 1 FAIL, 4 INFO. The intermittent Edge F7 false failure is described under T1. This is an aggregate of the full runs and affected-group reruns, not a claim that the initial runs were clean. |
| `python pdf-book/scripts/build.py` | 211 entries; 2,426,718 bytes; SHA-256 `f22718f6b65ad5d762eb241ad0a4aeebab690bd8eec3a60b24c6a436177d6e1a` |
| `python pdf-book/tests/publication_zip.py` | 6/6 |
| Publication check with private deny-list and locally built ZIP | 263 source files, 41 private terms, zero findings |
| Historical private check | 13 fetched remote branches descending from alpha.9; 14 reachable commits from alpha.9 inclusive; 351 distinct path/blob/lock combinations; zero findings |

The historical scan applies the current generic and private text rules, binary/size restrictions, forbidden paths and per-tree vendor locks to each distinct file revision. It covers the currently reachable history of those fetched branches, not deleted branches, reflogs, unavailable force-pushed history, commit messages or release assets. No private terms or local site identities are included here.

Legacy-suite setup initially lacked the standard book/cover/space-name fixtures and the optional JPEG-2000 fixture. Those infrastructure errors were resolved by generating the supplied fixtures and rerunning affected groups. They are not candidate defects. F7 later passed in Firefox and both passed and failed in Edge with the same decoded pixel; its remaining false failure is separately reproducible (N18-6).

## Correction status

| ID | Status | Evidence and limits |
| --- | --- | --- |
| R1 | **Fixed in measured desktop cases** | `media/js/viewer.js:92` and `:317`: height is part of the fit key; height-only 900→450→900 resized the stage 776→326→776 px. Whole book at the short viewport was 434 px. Four further alternating height changes settled with one cached PDF rendering and zero additional idle render calls over 1.5 s. `render()` method calls can still occur when stage height changes; these are cache hits at unchanged width. Actual mobile browser-bar events, fullscreen/orientation on devices: **NOT MEASURED**. |
| R2 | **Fixed for static link rectangles; partly overall** | `media/js/viewer.js:290`: independent comparison with rendered red pixels, across portrait/landscape, rotations 0/90/180/270, single/double, LTR/RTL and zoom .75/1/2: 132 link rectangles, maximum error **1.008 CSS px**. WebGL uses raw textures and stretches the page during a turn; see N18-4. |
| R3 | **Partly fixed** | Added binary, altered vendor content, missing file, duplicate, case variants, Unicode-name variants, `./` file alias, backslash, absolute/drive/traversal names and a foreign-project file were rejected. A mismatched local-header name raised `BadZipFile` and failed closed. Additional directories and symlink metadata passed; the CLI also accepts an untracked package source. See N18-1–3. The original alpha.15 adversarial archives were unavailable; equivalent extra-binary and changed-vendor cases were independently exercised. |
| R4 | **Acceptable revised identity policy; exact submitted artifact unverified** | See the decision below. A recompressed ZIP passes source comparison and has a different archive hash. |
| R5 | **Fixed for measured disposal** | `media/js/viewer.js:179` and `:426`: Edge and Firefox, long flip/slide/fade disposed mid-animation: zero running animations, zero transient layers, `busy=false` immediately after `await dispose()`. No delayed page restart after 2.2 s. Error cleanup is wired to cancellation; full error-resource regression also passes. |
| R6 | **Code fixed; accessibility validation partial** | `syncSidebarState()` and the regression test verify matching `aria-controls`, initial collapsed state, opening, switching content and closing in both browsers. Screen-reader output: **NOT MEASURED**. |
| D3 | **Fixed** | `media/js/turn.js:59`: inactive self-shadow sampler, varying, uniforms and lookups removed; ground-shadow pass remains. Independent frozen progress-.5 comparison of alpha.16 and alpha.18 on the same Edge GPU context: **0 differing channels out of 3,200,000**. This establishes equality for that frame/environment, not every GPU. |
| D4 | **Fixed by inspection and Windows build** | `scripts/build.py:71`: all 211 locally built entries have explicit creator system 3 and regular-file permissions. A fresh second-operating-system comparison was **NOT MEASURED**. |
| T1 | **Partly fixed** | Browser selection and actual legacy-suite metadata work in Edge and Firefox; scoped injection test and settled-arrow check pass. No-WebGL skip path is present by inspection; both primary environments had WebGL. The first rapid-click check still uses a fixed 300 ms delay, and F7 treats an unrelated favicon 404 as a decoder failure (N18-6). The smoke test still assumes WebGL availability. |
| Section 7 | **Partly fixed** | Height default 500; allowlists and color validation pass; flat autoplay omits duration; PDF-open description and F14 limitation are documented. Zero/extreme numeric values still disagree between PHP and JS (N18-5). No injection was observed from the configuration vectors; arbitrary titles are serialized/escaped and displayed as text. |

## New findings

### N18-1 — P1: directory-named ZIP entries bypass content and membership checks

**MEASURED.** `scripts/check_publication.py:118` skips every name ending in `/` before reading its content or checking whether it belongs to the package. Append a `ZipInfo('extra/')` containing binary bytes or a private-term sentinel to an otherwise genuine ZIP: the CLI still exits **0**, including with the private deny-list. Appending `./` with content also passes. A 16 MiB payload in `large/` passes, and 20,000 extra directory records pass in about 4.8 s.

This is a publication confidentiality defect even if an installer ignores directory payloads: those bytes are still distributed in the archive. It contradicts the advertised exact-entry identity check. Reject every unexpected member, including directories, before reading; this builder emits no directory records, so rejecting them all is appropriate. Reject nonzero directory payloads explicitly, and bound member counts and declared/actual uncompressed sizes. Replace quadratic `names.count()` duplicate detection with a counter. Acceptance: the genuine ZIP and recompressed ZIP pass; every added directory, including zero-byte and nonzero-byte variants, fails.

### N18-2 — P2: symlink and special-file modes are not checked

**MEASURED.** `scripts/check_publication.py:120–122` compares names and uncompressed bytes only. Change `create_system` to 3 and `external_attr` to `0o120777 << 16` on a genuine member while preserving its name/content: the full CLI exits **0**. Extraction semantics now depend on the installer; this is not the same regular-file package.

Require regular-file members and reject symlinks/special types. Compression implementation, timestamps and harmless platform differences need not define source identity, but filesystem entry type does. Recheck the genuine/recompressed controls. Actual Joomla symlink extraction behavior: **NOT MEASURED**.

### N18-3 — P2: the CLI's “tracked” package set includes untracked files

**MEASURED.** `scripts/check_publication.py:35–37` obtains tracked **and untracked** files; `:157` passes that combined set to `expected_packages()` as `tracked`. Create a benign untracked `pdf-book/media/js/probe-untracked.js`, append its bytes under `media/js/probe-untracked.js`, and run the CLI: **exit 0**. Calling `check_archive()` with a real `git ls-files` set rejects it, so testing only that helper misses the CLI defect. An ignored-file addition was rejected.

Keep the broad repository publication scan, but use a separate real tracked set for archive membership. For a release claiming a commit's identity, require clean package/build/lock sources or compare to that commit's blobs. Add a CLI-level untracked-file regression. This is a source-identity defect, not evidence of malicious content in the current package.

### N18-4 — P2: mixed-format pages still stretch in WebGL turns

**MEASURED; carried-forward R2 limit, not a new regression.** `media/js/turn.js:257` uploads each raw page canvas; the sheet shader maps it over the whole common page slot. A landscape source with a red rectangle of aspect ratio **3.0** draws that rectangle at **1.076** in the flat first WebGL frame of a portrait-shaped slot. The DOM page uses `object-fit: contain`, so its static appearance is different.

Letterbox the uploaded front/back textures into the slot aspect, or implement the corresponding UV transform for each face. Acceptance: first/final animation frames agree with the static fitted image rectangle for mixed formats, rotations and RTL; static link error remains at most 2 CSS px. Single-format documents are unaffected by this particular mismatch.

### N18-5 — P3: numeric normalization still differs between PHP and JavaScript

**MEASURED.** `module/src/Dispatcher/Dispatcher.php:27` versus `media/js/model.js:97,103`: height/duration `0` yields **320/150** in PHP but **500/800** in JS. String `1e309` yields **320/150** in PHP but **1000/1800** in JS. String `0x10` yields PHP defaults **500/800**, but JS clamps to **320/150**. These are bounded presentation differences, not an observed injection path. Define one finite-number grammar/default policy and share its test vectors, including zero, whitespace, decimals, scientific notation and overflow.

### N18-6 — P3: unrelated favicon failure still makes legacy F7 fail

**MEASURED.** `tests/review/review_browser.py:252` includes any console message containing `404` or `Failed to load`. With complete fixtures, Edge decoded JPEG 2000 to `[127,126,120,255]` and fetched the JavaScript fallback successfully, yet F7 reported FAIL because `/favicon.ico` returned 404. The server log identifies that unrelated request; another Edge run and Firefox passed. Scope load failures to the decoder/PDF resources, and use the settled-queue helper for the rapid-click assertion too (`:157`). Do not interpret the current flaky F7 as a JPEG-2000 regression.

## R4 decision and archive trust boundary

**Accept the distinction between artifact identity and source identity.** SHA-256 identifies one concrete ZIP; it should not be advertised as a compressor-independent build hash. Toolchain recording plus uncompressed-entry hashes is an acceptable answer to R4 for an alpha release. I do **not** require `ZIP_STORED` or a pinned compressor if this policy is documented. `manifest.json` records Python/zlib/system and entry hashes; this Windows build has LF sources through `.gitattributes` and explicitly fixed creator-system metadata. The developer's claimed alpha.15 bit-for-bit reproduction was **NOT MEASURED** here.

However, the current `--zip` implementation is not yet a sufficient source-identity verifier because of N18-1–3. Publish a manifest/hash for the exact released bytes and verify them against a clean, identified source commit after fixing those defects. The manifest is outside the package, so it must accompany the release artifact.

`expected_packages()` (`scripts/check_publication.py:79–91`) imports and executes every project's `build.py`, including a project not selected by the ZIP. This is acceptable **only as trusted checkout tooling**: running the repository's guard already trusts Python code in that checkout. It is not a sandbox for reviewing untrusted source changes. Review build scripts first, run without publication credentials, and preferably select the project explicitly. Do not run this gate over attacker-controlled source in a privileged publication job. ZIP content itself is not executed by this import.

Local/central header name disagreement fails closed with an uncaught `BadZipFile`; a clearer controlled finding would improve diagnostics. A complete two-project archive test was **NOT MEASURED** because only one project has `scripts/build.py`; an extra foreign-project member was rejected. No unbounded ZIP-bomb stress test was attempted beyond the documented 16 MiB/20,000-entry cases.

## Page-sound provenance and runtime

**MEASURED.** Official source: [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio), [official download](https://kenney.nl/media/pages/assets/rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip). Official archive SHA-256: `6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b`. The mirrored archive named in `dependencies.json` hashes to `4aa23e821281bdeeea8105511e47e08281f37141328b09405fcd512ecdb44786`, matching its lock.

The 55 files match after stripping the mirror's enclosing folder and normalizing CRLF in the three differing text files. Both OGG recordings are **byte-identical** to the official download: `bookFlip2.ogg` SHA-256 `3409042acbfaebc24c1a6327dc073e36f9250841712e96c5040da566a97df73c`; `bookFlip3.ogg` SHA-256 `c85db5dceb3f1df073e960630277eaa88a5afda0477c1ddd68dad707621767be`. Official `License.txt` SHA-256 is `5735dfd72cb64cbbceda4ebc00c380c41ca680edb82ff153aa7c9ab97614c539`; shipped/mirrored LF version is `842c42cc1942963f6fcdc18fe57e9e0631e8a4936f9803688e8152e830088eb9`. License text is identical after newline normalization and states CC0. The notice correctly records origin, license and transformations. Clarify that “unmodified” means the mirrored archive as received, not byte identity to the current official archive.

Both MP3 hashes match the lock. FFprobe identifies one mono 44.1 kHz, 64 kbit/s MP3 stream each, durations 0.418/0.235 s, no metadata tags or extra streams. An independent MPEG-frame walk consumes exactly **16/9 frames** to the end of the **3343/1880-byte** files; no ID3/Xing/Info header or trailing payload was found. Exact reproducibility of the audio-processing/filter chain and subjective listening: **NOT MEASURED**.

With sound disabled: zero MP3 requests and no AudioContext. With sound enabled: zero requests before a gesture, then exactly two requests and two decoded buffers. Forced `decodeAudioData` rejection is caught, gives zero sounds and leaves the viewer ready with no uncaught error. `media-src 'none'` does not block Web Audio fetched through `fetch`; `connect-src` controls that fetch. Tightening `connect-src 'none'` after PDF load suppresses sound and leaves the book usable.

**Additional P2 runtime limit:** `media/js/viewer.js:408` uses `credentials:'same-origin'`, which does not restrict fetch destinations. A controlled 302 from each same-origin MP3 URL produced attempted requests to a different origin; browser local-network/CORS policy denied completion in this test. Successful foreign audio retrieval was **NOT MEASURED**. Enforce `mode:'same-origin'`, `redirect:'error'` and an origin check against `location.origin` if the advertised same-origin guarantee must hold independently of deployment/CSP. Current normal Joomla asset URLs are same-origin; a server redirect or cross-origin module hosting is required to expose this limit.

## Release evidence still required

| Item | Status and acceptable completion evidence |
| --- | --- |
| Joomla rights and module caching | **NOT MEASURED in real Joomla.** Test valid/missing/forbidden PDF configurations as guest and module editor with cache off/on; warm the cache as editor then guest, and guest then editor. Record installed Joomla/PHP version, module permissions and cache settings; guests must never receive editor diagnostics in HTML or cached responses. |
| Production HTTPS and CSP | **NOT MEASURED.** Read-only production-server evidence: trusted HTTPS chain, no mixed content, approved CSP permitting required script/worker/PDF/audio fetches, network and CSP logs while opening PDFs, turning pages and enabling sound. Blocking optional audio must not break navigation. No production changes were made. |
| D6 private check | **MEASURED, no findings**, for the 13 fetched branches/14 commits and locally built alpha.18 ZIP described above. Recheck newly pushed refs and the exact final release bytes immediately before publication. The requested developer ZIP remains unavailable. |
| Tags alpha.9–alpha.18 | **MEASURED missing** in fetched refs; alpha.2–alpha.8 exist. Obtain explicit owner consent before pushing the missing tags, verify each requested commit mapping, then record remote tag resolution and release SHA-256. No tags were created or pushed by this review. |
| Accessibility and device matrix | **NOT MEASURED**: screen reader, Safari/iOS, Android, actual orientation/browser bars/fullscreen. Accept dated device/OS/browser records covering sidebar announcements, focus/dialog return, height changes, animations, sound, autoplay cancellation and errors. Owner-reported staging/iPad/Android results in the request are useful external evidence, not independent measurements by this reviewer. |

## Hand-back

1. Fix N18-1–3 and add CLI-level adversarial regressions; package corrections use a new version, next free **0.1.0-alpha.19**, on a separate fix branch.
2. Preserve fitted image aspect in WebGL (N18-4); unify numeric vectors (N18-5), finish test scoping (N18-6), and enforce the audio-origin promise.
3. Include the alpha.15 report from its review branch or link its stable revision; amend the candidate's broken relative review links. Retain the official-versus-mirror hash/newline explanation in provenance.
4. Provide the exact release ZIP and its manifest, rerun private checks, complete the release-evidence table, then obtain consent for tags/release publication.

This review changes documentation only. It does not merge code, deploy a site, certify a production release or publish tags.
