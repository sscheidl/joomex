# Security

## What is protected

The editor is one local HTML file. Documents that pupils open or paste are untrusted. They must not be able to

* run script or event handlers in the editor,
* read or change the editor window, its storage or other open work,
* navigate the editor or its preview, open windows or submit forms,
* cause any network request or read neighbouring files,
* make the editor rewrite or lose source text.

Not in scope: the safety of a saved document when it is opened in a browser outside the editor. The editor keeps scripts and links of a document in its source; it does not sanitize files.

## Layers

1. **The opened document is never executed or loaded as a page.** It is parsed with `DOMParser` into an inert document (`src/js/project.js:86`). The preview frame holds a fixed shell document (`src/js/app.js:30`); its content is built node by node by the editor.
2. **Projection.** `describe()` and `safeAttrs()` (`src/js/project.js:183`, `:154`) decide what reaches the preview:
   * never created: `script` (any namespace), `link`, `meta`, `base`, `title`, `template`, frames, and the SVG animation elements `set`, `animate`, `animateMotion`, `animateTransform`, `animateColor`, `discard` (`:21`, `:196`), because an animation can assign an address to an attribute after the attributes were filtered; replaced by a box: `iframe`, `object`, `embed`, `applet`, `audio`, `video`; `form` becomes a plain block;
   * attributes removed: every `on…` attribute, `srcdoc`, `action`, `formaction`, `ping`, `background`, `poster`, `data`, `srcset`, `target`, `http-equiv`, `contenteditable`, `name` on elements that would become document properties, and others in `DROP_ATTRS` (`:17`);
   * `href` of links is moved to an inert `data-se-href`; other `href`/`xlink:href` survive only as fragment references;
   * `src` survives only on `img` with a `data:` URL of PNG, JPEG, GIF or WebP.
3. **Frame sandbox.** `<iframe sandbox="allow-same-origin">` (`src/app.html`). No script, form, popup, modal or top-navigation permission. Same-origin access is needed so that the main window can edit the frame's DOM; because the frame can never run script, the opened document cannot use that access. While "Code aufräumen" compares layouts, a second frame of exactly this kind exists for a moment (`sameLayout`, `src/js/app.js:484`): same attribute, same shell, same policy, filled by the same projection, never shown and never focused.
4. **Content security policy.** Main page (`tools/build.mjs`): `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'`. Only the one built-in script runs; inline event handlers and injected scripts are blocked even in the main window. The frame inherits this policy and adds its own: `default-src 'none'; style-src 'unsafe-inline'; img-src data:`. Inline CSS of the document is allowed so that pupils see their styles; every `url()`, `@import` and font in it is blocked by the policy.
5. **Input handling in the preview** (`src/js/app.js:787–832`): paste inserts plain text only, drops and native rich-text commands are cancelled, clicks on links are cancelled.
6. **Write-back** (`src/js/serialize.js:184`): new elements are written from a fixed list of tags; attributes are filtered again; link addresses are re-checked with `checkLinkUrl()` (`src/js/util.js:51`); image sources must be raster `data:` URLs. Text and attribute values are escaped.
7. **Untrusted DOM is read through original accessors** (`src/js/project.js:28–44`), because form controls named like DOM properties shadow those properties.
8. **No persistence, no network API, no dynamic code.** No storage API, `fetch`, `XMLHttpRequest`, WebSocket, `eval`, function constructor or message channel occurs in the file (X-05, X-06).

Layers 2, 3 and 4 complement each other; none is complete alone. The projection deliberately lets inline CSS through, and CSS can ask for resources: only the policy stops those. A frame without script permission does not block network requests. A policy without the projection would not stop a link from navigating the frame. What was measured is the combination in the delivered file (X-01 to X-03, RV-04). R-02 additionally runs the projection in a page without any policy and observes that the image sources it generates cause no request; that says nothing about CSS. Sandbox alone and policy alone were not measured.

## The note about inactive content

Requirement S-04 asks that switched-off content is announced. Two sources feed the note above the page (`showInactive`, `src/js/app.js:235`): the projection counts what it leaves out (`reportText`, `src/js/project.js:138`), and a listener for the browser's policy-violation event in the frame (`src/js/app.js:824`) records the file name of every address the policy stopped. If the projection named nothing, the note still says that content from outside is switched off, for as long as a recorded name occurs in the source text. The second source exists because a list of known cases cannot be complete: an address written with a CSS escape (`u\72 l(…)`) is one example the list does not recognise and the policy stops (RV-04).

## What was measured

MEASURED 2026-11-19, Windows 11, Microsoft Edge 157.0.4341.60 (headless), delivered file from `file://`, network available, local HTTP server counting delivered requests. Details per check: `tests/results/acceptance-edge.json`.

| Case | Result |
| --- | --- |
| X-01 inline, external, module and SVG scripts; `onload`, `onerror`, `onclick`, `onfocus`, `ontoggle`, `onbegin`, `oninput` and other handlers; `javascript:` link | nothing executed, no marker in the editor window or the frame, storage sentinel not read, no request delivered, source unchanged |
| X-02 `javascript:` links in four disguises, plain, `_blank`, `_top` and `data:` links (click, Ctrl+click, middle click, scripted click), `meta refresh` in head and body, `base`, forms (submit button, `formaction`, scripted submit), `iframe` with `src` and `srcdoc`, `object`, `embed`, `frameset`, `area`, popup button; once editable, once read-only | no request delivered, editor and frame did not navigate, no new window |
| X-03 style sheet link, preload/prefetch/preconnect/modulepreload/icon, `@import`, `@font-face`, CSS `url()` in seven properties, `img` `src`/`srcset`/protocol-relative, `picture`, `video`/`audio`/`track`, SVG `image`/`use`, table and body `background`, image input, `ping`, external script, `manifest` | 0 requests delivered; the browser reported 11 attempts from inline CSS, all blocked by the policy; control page in the same browser did fetch |
| RV-04 SVG `set` and `animate` that assign an image address, `style` inside SVG, SVG presentation attribute with an address, `image-set()` without `url()`, `url()` written with a CSS escape | 0 requests delivered; the animated addresses are not attempted any more; every sample shows the note; the escaped address is attempted, stopped by the policy and announced through the policy event; the note disappears when the address is deleted from the code |
| X-04 paste of rich clipboard content with a trusted key event, paste events with markup-shaped text, HTML-only clipboard, drop | text only, no element created, nothing executed or fetched |
| X-05 message bridge | none exists |
| X-06 static scan of the delivered file | no dynamic code, storage, network API; one script; sandbox and policy as stated |
| X-07 names that shadow DOM properties | no error, edits stay exact |

NOT MEASURED: Chrome (not installed on the test machine); behaviour of browsers other than Chromium-based ones; the native file dialogs.

## Residual risks

* The protection relies on the browser enforcing `sandbox` and the content security policy for `srcdoc` frames of a `file://` page. This was measured in one Edge version.
* The projection lists what it leaves out; it does not list what it allows. A browser feature that is neither listed nor stopped by the policy would be shown. The independent review of alpha.1 recommends an allow-list for a classroom tool; this version keeps the deny-list, adds SVG animation to it and announces whatever the policy stops.
* The policy note depends on the browser raising the violation event in a frame without script permission. Measured in Edge 157 only.
* `style-src 'unsafe-inline'` lets a document style the preview arbitrarily (for example hide or overlay its own content). It cannot reach the editor chrome, which is outside the frame.
* A very large or deeply nested document can make the editor slow. Opening is limited to 5 MB; nesting beyond 400 levels is shown read-only.
* A saved file contains what the pupil wrote, including scripts. Opening it in a browser runs them.
