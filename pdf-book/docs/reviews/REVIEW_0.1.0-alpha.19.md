# Release follow-up: PDF Book 0.1.0-alpha.19

Independent measurements: **2026-11-13**. Candidate: `e13659a6549495b62d10f3f8058bd117149e81f8`. Baseline: [alpha.18 review](REVIEW_0.1.0-alpha.18.md). This follow-up checks the corrections, private publication rules and the exact supplied release files. No package source was changed.

## Verdict

**The exact supplied alpha.19 ZIP is approved for a GitHub pre-release for testing only.** This approval is bound to the artifact below and its independently verified source commit; it is not approval of every archive that the current publication checker might accept. The principal alpha.18 archive bypasses are fixed. One dirty-checkout deletion case remains (N19-1); this review bypasses that verifier weakness by comparing the complete package inventory and bytes directly to immutable Git blobs from the candidate. The candidate package sources were clean during verification.

**Production remains blocked.** Real Joomla rights/cache, production HTTPS/CSP and screen-reader evidence remain required. The owner retains the release/tag decision; no production changes, tag pushes or release publication are performed by this report.

## Exact artifact identity

| Item | MEASURED result |
| --- | --- |
| File | `mod_pdfbook-0.1.0-alpha.19.zip` |
| SHA-256 | `c98668f54897975d0100237d65fbf5e6c7275e9fdeb222681cb38cdb708ed46e` |
| Size / entries | 2,436,333 bytes / 211 unique regular-file entries |
| Supplied `SHA256SUMS.txt` | package name and complete hash match the actual ZIP |
| Supplied `manifest.json` | package/hash match; all 211 names and uncompressed entry hashes match |
| Immutable source comparison | exact inventory from `git ls-tree -rz e13659a`: `pdf-book/module`, `pdf-book/media`, project license and third-party notice; every entry equals its corresponding `git cat-file blob` bytes |
| Supplied build toolchain | manifest records Python 3.13.18, `1.3.1.zlib-ng`, Linux; toolchain execution itself was not independently reproduced |
| Private publication check | exact supplied ZIP against the clean candidate: 269 repository files, 41 private terms, **0 findings** |

The Windows reviewer build has SHA-256 `9ad94b6fa766103754dcedc1dd41cacfb39a9e5dc573d1c6b7fcedb77ff4a595` (2,427,629 bytes). It is a control build, **not** the approved release asset. Different deflate implementations explain why source identity and artifact identity are separate checks. Preserve the three supplied files unchanged for release; do not replace them with the local build or regenerate their manifest.

The three supplied files were placed together in the ignored `pdf-book/dist/` directory of the local repository. They are release artifacts and must not be committed to Git.

## Independent checks

Environment: Windows x64; Python 3.12.10 / stock zlib 1.3.1; Node 24.22.1; portable PHP 8.5.12; Playwright 1.65.1; Edge 157.0.4341.46 and Firefox 159.0, headless. PHP checks use Joomla stubs. Test fixtures are generated synthetic PDFs. Results below are **MEASURED**, not copied from the developer's changelog.

| Check | Result |
| --- | --- |
| JS model unit tests | 13 passed, including 21 shared numeric vectors |
| PHP source / dispatcher | 32 / 34 passed |
| Supplied archive regression suite | 12/12 passed |
| Independent CLI archive probes | genuine accepted; directory payload, symlink, untracked source and changed matching source/archive rejected; deleted matching source/archive accepted (N19-1) |
| R1/R2/R5/R6 regression suite | 9/9 in Edge; 9/9 in Firefox |
| Browser smoke | passed in Edge and Firefox, WebGL active and mobile flat fallback exercised |
| Changed legacy assertions: outline, queue, JPX/space-name, WebGL | 7 PASS / 1 environment INFO in each browser, 0 FAIL/ERROR |
| New mixed-format texture probe | landscape page now supplied to WebGL in a letterboxed 607×858 canvas; red rectangle ratio 3.326, consistent with the fixture's 200/60 ratio and raster rounding; viewer remains ready |
| Audio 302 probe | redirect to a different origin: **0 attempted foreign requests**, 0 decoded sounds, viewer remains ready |
| Historical private scan | 14 fetched remote branches descending from alpha.9; 17 reachable commits from alpha.9 inclusive; 372 distinct path/blob/vendor-lock combinations; 41 private terms; **0 findings** |

The historical scan includes the newly fetched alpha.19 branch and reachable earlier review commits. It applies the current generic/private text rules, forbidden-path, binary/size and per-tree vendor-lock checks. It does not recover deleted or unavailable force-pushed history, scan commit messages, or authenticate earlier release archives. The current full legacy suite was not rerun in its entirety; the changed assertions and browser smoke were rerun, while the alpha.18 report supplies the prior broader coverage.

## Correction assessment

| Finding | Status at alpha.19 |
| --- | --- |
| N18-1: directory payload / count | **Fixed in measured cases.** Empty/payload/`./` directory entries are findings. Entry-count and declared-size limits precede reads, and duplicate counting uses `Counter`. |
| N18-2: symlink / special modes | **Fixed in measured cases.** Unix symlink metadata is rejected; regular files with absent type bits remain allowed for compatibility. |
| N18-3: untracked package inputs / source identity | **Original case fixed; incomplete for deletions.** Untracked and modified matching-source cases fail. See N19-1. |
| N18-4: mixed-format WebGL texture stretch | **Fixed for the measured ordinary mixed-format fixture.** Faces are letterboxed before upload. Large aspect-ratio/device limits remain an open resource concern below. |
| N18-5: numeric parsing parity | **Original cases fixed; extreme cases remain.** Zero, decimal/scientific/hex policy and the shared vectors pass; overflow and Unicode whitespace still diverge (N19-2). |
| N18-6: favicon false failure / click settlement | **Fixed in measured cases.** Failed resource URLs are scoped and rapid clicks use settled-queue waiting. Both engines passed the affected groups. |
| Same-origin audio | **Fixed in measured redirect case and inspected code.** Origin filter, `mode:'same-origin'`, `redirect:'error'`; the book remains usable without audio. |
| Provenance / review links | Official-versus-mirror hashes/newline difference documented; baseline reports are now present in the candidate. The recordings are unchanged from the verified alpha.18 assets. |

## Remaining findings and limits

**N19-1 — P2, publication-tool source identity: deleted tracked sources are omitted from the expected inventory.** `scripts/check_publication.py:97–107` derives membership from files currently present in the worktree. At `:154–156`, the changed-source check visits only those surviving expected paths. Independently measured reproduction: delete tracked `pdf-book/media/js/model.js`, remove that entry from an otherwise genuine ZIP, and run the CLI. It reports 268 checked files, zero findings and exits **0**. The test restored the source bytes in `finally`, and the checkout was clean afterward. Modified-but-present source and untracked additions do fail.

Fix by deriving expected package paths from the identified commit/index and rejecting deleted package paths, or enforce a clean package-source state before constructing expected membership. Add a CLI regression covering matching source deletion/archive omission. Until then, the guard alone is insufficient to claim arbitrary archive identity from a dirty checkout. This **does not affect the supplied 211-entry artifact**: its full membership and content were independently bound to the candidate Git blobs. Keep that immutable comparison, or a clean-checkout prerequisite, in the release process.

**N19-2 — P3, numeric edge parity remains incomplete.** `media/js/model.js:89–93` rejects nonfinite converted values; `module/src/Dispatcher/Dispatcher.php:27–36` allows decimal strings before converting/clamping them. A string of 400 decimal `9` digits yields height **1000 in PHP / 500 in JS**. U+00A0 surrounding `501` yields **500 in PHP / 501 in JS** because the two whitespace grammars differ. Ordinary `'0'` now yields 320 in both. These are bounded presentation differences, with no demonstrated injection path. Define the allowed whitespace explicitly and handle nonfinite conversion identically, then add shared vectors.

**Letterboxing resource limit — partial measurement, device consequence NOT MEASURED.** `media/js/viewer.js:12–16` enlarges one texture dimension without applying the existing render/texture cap. A synthetic 1:10 page slot led to two **607×6079** face canvases; the current Edge GPU reports a 16384 texture limit and the test remained ready. A device with a 4096 texture limit and more extreme aspect ratios were not tested. Bound the intermediate canvas size to the render budget and actual GPU maximum before production/resource acceptance. Do not infer a particular device crash from this limited probe.

No exact audio-processing rerun, new advisory audit, real weak-GPU stress matrix, physical mobile/Safari run or screen-reader run was performed in this follow-up.

## Publication and production hand-back

1. Publish only the supplied ZIP with SHA-256 `c98668f54897975d0100237d65fbf5e6c7275e9fdeb222681cb38cdb708ed46e`, its supplied manifest and supplied checksum file. Mark the GitHub release **pre-release**, test installations only, at `e13659a`; no silent artifact substitution.
2. Preserve a clean package-source checkout and the independent immutable inventory comparison until N19-1 is fixed. Fix N19-1 and numeric/resource limits on a separate branch; any changed package gets a new version.
3. **Real Joomla rights/cache: NOT MEASURED.** Record Joomla/PHP version, module permissions and cache settings; test valid/missing/forbidden PDFs as guest/editor, cache on/off, warmed editor→guest and guest→editor. Guests must never receive editor diagnostics in HTML or cached output.
4. **Production HTTPS/CSP: NOT MEASURED.** Obtain read-only evidence of trusted HTTPS, no mixed content, intended script/worker/PDF/audio policy and browser network/CSP logs. Blocked optional audio must not break navigation.
5. **Screen reader: NOT MEASURED.** Record device/browser/reader and verify sidebar state announcements, keyboard/dialog focus return, autoplay stopping, errors and an accessible PDF alternative. Physical mobile/fullscreen/orientation and resource limits remain additional production acceptance work.
6. Tags require the owner's explicit consent, as stated in the supplied hand-back. All mappings below were verified against each commit's module version; remote alpha.9–19 tags were absent at inspection. Preparing this plan does not authorize pushing tags or publishing a release.

| Proposed tag | Verified target |
| --- | --- |
| `pdf-book-v0.1.0-alpha.9` | `7d458f4a10c63352cf2db074e1cf7004e79ee44a` |
| `pdf-book-v0.1.0-alpha.10` | `cb1aafaf1fbf3fb85ecdbe5a7168fff8afed41c9` |
| `pdf-book-v0.1.0-alpha.11` | `218b73cf14fcf6f9e1dd42eae5d8ffd5e466a490` |
| `pdf-book-v0.1.0-alpha.12` | `fada5a127a3089a8ad9f4b244529c96e20c8557d` |
| `pdf-book-v0.1.0-alpha.13` | `380ec91a62828a11337df56d86242a486b0b6468` |
| `pdf-book-v0.1.0-alpha.14` | `5f50cee486fa0c5a53c4f0f81aa4fe4c82146ba6` |
| `pdf-book-v0.1.0-alpha.15` | `21e68150d6d8cd2463428965118ff7fb8eba411a` |
| `pdf-book-v0.1.0-alpha.16` | `7a252f1472c5ba6cfb430cf69893da26c23b2d78` |
| `pdf-book-v0.1.0-alpha.17` | `ca8af3444d5f4734bad8d34db5c958ea9c5459bf` |
| `pdf-book-v0.1.0-alpha.18` | `e4be5052819323ac6899880c5c810d848c8237da` |
| `pdf-book-v0.1.0-alpha.19` | `e13659a6549495b62d10f3f8058bd117149e81f8` |

Evidence: `evidence-0.1.0-alpha.19/results.json`. The measured pass for the exact supplied artifact supersedes alpha.18's missing-artifact limitation; it does not imply production approval.
