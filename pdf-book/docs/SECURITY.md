# PDF Book: security requirements

Status: 2026-11-12 (0.1.0-alpha.3). Binding target requirements from the owner's assignment. **Partly implemented and tested in the alpha; this is not a complete security acceptance.**

## Starting point (legacy module)

The legacy commercial module bundles PDF.js 1.10.100, jQuery 1.11.0 and Three.js r81. Mozilla lists PDF.js up to and including 4.1.392 as affected by [CVE-2024-4367](https://github.com/mozilla/pdf.js/security/advisories/GHSA-wgrm-67xf-hhpq); 4.2.67 contained the fix at the time. This is not a recommendation to use that version. With eval support enabled, a crafted PDF can run JavaScript in the context of the embedding page. The examined inline call of the legacy module lacks the documented countermeasure, and the bundled library defaults to `true`.

This is a risk assessment based on version and source evidence. The live site, possible local changes, CSP and actual exploitability were not tested. No malicious PDF was run.

Other documented renewal points: settings interpolated directly into JavaScript/HTML, custom JavaScript emitted verbatim, outdated Joomla classes, a vendor update endpoint, missing CMap files. The new development replaces these mechanisms. Evidence: [legacy findings](../../research/legacy-flipbook/FINDINGS.md).

## Threat model

In scope: visitors, article authors with limited rights, editors with media access, administrators, untrusted PDF content, manipulated file names/URLs and compromised dependencies. Article text must not gain capabilities reserved for administrators. A hidden button is not access control. The viewer cannot stop a PDF delivered to the browser from being copied.

## Requirements and evidence

| ID | Requirement | Evidence before release |
| --- | --- | --- |
| SEC-01 | Current, supported libraries, exact version pinning, lock file and documented provenance | Software bill of materials, dated version/advisory check, package hashes; no known open relevant high/critical findings |
| SEC-02 | PDF.js including worker/resources consistent; no mixing of old and new releases | Functional test, version comparison and complete package manifest |
| SEC-03 | No execution of embedded PDF scripts or automatic PDF actions | No scripting manager; tests for OpenAction, JavaScript actions, form actions and external targets |
| SEC-04 | Context-appropriate output encoding; settings passed as data | Tests with quotes, HTML, `</script>`, Unicode, manipulated titles/file names; no executable DOM nodes |
| SEC-05 | Strict URL rules: local sources by default, optional external HTTPS sources only after a defined approval | Rejection of script/data/file schemes, protocol-relative URLs and unexpected targets; test redirect and CORS behaviour |
| SEC-06 | File paths stay inside the allowed media area, also after decoding and path resolution | Traversal, symlink, Windows path, UNC and double-encoding tests; public URL and file system path kept separate |
| SEC-07 | No generic server-side PDF proxy or new upload endpoint in the first product | Route review; therefore no additional SSRF/upload attack surface. Later endpoints get their own design |
| SEC-08 | Joomla access rights preserved; CSRF protection for any later writing endpoint | Tests as guest, author, editor and administrator; protected files are not delivered through public media paths |
| SEC-09 | No raw JavaScript/HTML/style settings taken over from legacy modules | Migration report flags these fields for individual handling; executable text is not imported |
| SEC-10 | Self-hosted scripts, fonts, workers and required resources; no vendor login | Network recording without vendor, CDN or tracking requests; deliberately configured external PDFs marked separately |
| SEC-11 | New scripts need no unsafe inline scripts/handlers and no JavaScript `eval` | Test under a suitable CSP on an isolated Joomla test page; document any WASM rules separately |
| SEC-12 | PDF links limited to safe targets; new tabs without opener access | Tests of annotations, internal targets, foreign URLs and `rel` attributes |
| SEC-13 | Limit memory and rendering work; cancel running jobs and release resources | Load test with a large document, fast zoom/page turning, repeated dialog opening; cache budget and pixel limit defined |
| SEC-14 | Damaged, oversized, encrypted or unreachable PDFs handled in a controlled way | Error fixtures; clear message, no uncaught errors, no permanently blocked viewer |
| SEC-15 | Own reproducible build and update path | Reproducible installation package, licence notices, checksum, changelog, tested update/rollback |
| SEC-16 | Production stays separate from experiments | Staging acceptance and a documented fallback before replacing existing modules |

## Important technical distinctions

- A web worker protects the interface from computation load. On its own it is not a complete security container for untrusted PDFs.
- Turning off PDF scripting does not replace current libraries or input validation. Security options are checked against the PDF.js version actually used. Example: `isEvalSupported` no longer exists in PDF.js 6.5.438; it was removed from the code in alpha.3, and `scripts/build.py` rejects it (review finding F7).
- A current version is necessary, but it does not prove the integration is safe. Parser, DOM output, path resolution and access behaviour get their own tests.
- A strict CSP for the new viewer is tested on a test page first. The site's existing template and page-builder scripts can have other needs, so production headers are never changed in passing. Measured 2026-11-11 in Edge: the viewer works with `style-src 'self'` without `unsafe-inline`, and with `script-src 'nonce-…' 'strict-dynamic'`.
- `useWasm: false` avoids `wasm-unsafe-eval` but also disables ICC colour management; JPEG 2000/JBIG2 use slower JavaScript fallbacks (JPEG 2000 measured working on 2026-11-12). Since alpha.3 the unused `.wasm` decoders, the ICC module and the QuickJS scripting sandbox are not shipped (`dependencies.json`, `excluded`).
- Images above 16 megapixels inside a PDF are skipped by PDF.js (`LIMITS.imagePixels`) to bound memory; the page is shown without that image (review finding F14, kept by design).
- Existing public PDF URLs stay public even when the module is not shown. Protected documents need a real access-checked delivery path.

## Maintenance

Before each release, direct and transitive dependencies, vendor advisories, browser support and Joomla compatibility are checked again. The installed build lists exact versions, provenance, licences and hashes. Library updates are tested on a test copy against the PDF corpus and shipped as a new extension version. There is no runtime-loaded `latest` script.

Regular checks and prompt checks after new security advisories are part of operations. No automated monitoring or schedule has been set up yet.

## Release status

[STATUS.md](STATUS.md) records the individual status of the alpha checks. The [independent review of alpha.1](reviews/REVIEW_0.1.0-alpha.1.md) found no exploitable vulnerability in the tested scope; its verdict was BLOCKED (Joomla installation gate not run, finding F1). alpha.3 contains fixes for all findings and awaits an independent review ([request](reviews/REVIEW_REQUEST_0.1.0-alpha.3.md)). Full resource stress tests, Joomla access/installation checks and checks on real devices are still open.
