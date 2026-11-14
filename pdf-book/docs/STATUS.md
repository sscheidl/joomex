# Development status 1.0.0

2026-11-14. **Release build in preparation.** Current validation and exact package identity are tracked in [RELEASE_1.0.0](reviews/RELEASE_1.0.0.md). No new production installation is implied by preparing this version.

## Current functionality

- Native Joomla 6 module, media picker, multiple instances, inline or dialog view and separate Web Asset Manager resources.
- PDF.js 6.5.438 with an independently written WebGL page turn; flat, slide, fold and fade alternatives; single/double/automatic views and RTL.
- Navigation, page input, thumbnails, document bookmarks, annotation links, zoom/reset and fullscreen. Sidebar states and dialog focus/Escape are exposed to assistive technologies.
- Optional same-origin page sound, configurable heading/toolbar/frame, automatic height and autoplay with manual stopping and reduced-motion handling.
- Only public local PDFs: 32 MB and 1000 pages; 2.4 million render pixels; 4096-pixel edge cap; page-turn textures also respect the GPU limit. Embedded images above 16 megapixels are omitted. Six cached pages and bounded response/idle/parse timeouts.
- Fixed German error messages; source errors visible only to module editors. PDF scripts/XFA are not executed, WebAssembly is disabled, and the scripting sandbox is not shipped.

## Evidence and remaining scope

The alpha.19 [artifact review](reviews/REVIEW_0.1.0-alpha.19.md) and [deployment follow-up](reviews/PRODUCTION_CHECK_0.1.0-alpha.19.md) record the immutable package check, real Joomla installation and 48 module role/cache assertions, actual guest/authenticated HTTPS pages and owner-reported screen-reader listening. These identify alpha.19; fresh 1.0.0 checks are recorded separately.

The 1.0.0 line fixes the archive deletion hole, numeric overflow/whitespace mismatch and unbounded intermediate letterboxing. The interface remains German. Public PDF links are not access control. A selectable text layer, internationalisation, cover gallery and arbitrary image-folder books are not implemented.

Physical-device/weak-GPU coverage remains limited to the recorded tests. Enabling site/proxy page caching requires the corresponding end-to-end role/source checks. A whole-site CSP rollout needs template/page-builder integration; absence of a newly introduced CSP is not a module defect or an automatic release blocker.

The full version history is in [CHANGELOG.md](../CHANGELOG.md).
