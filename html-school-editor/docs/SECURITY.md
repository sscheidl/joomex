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

1. **The opened document is never executed or loaded as a page.** It is parsed with `DOMParser` into an inert document (`src/js/project.js:84`). The preview frame holds a fixed shell document (`src/js/app.js:30`); its content is built node by node by the editor.
2. **Projection.** `describe()` and `safeAttrs()` (`src/js/project.js:178`, `:150`) decide what reaches the preview:
   * never created: `script` (any namespace), `link`, `meta`, `base`, `title`, `template`, frames; replaced by a box: `iframe`, `object`, `embed`, `applet`, `audio`, `video`; `form` becomes a plain block;
   * attributes removed: every `on…` attribute, `srcdoc`, `action`, `formaction`, `ping`, `background`, `poster`, `data`, `srcset`, `target`, `http-equiv`, `contenteditable`, `name` on elements that would become document properties, and others in `DROP_ATTRS` (`:17`);
   * `href` of links is moved to an inert `data-se-href`; other `href`/`xlink:href` survive only as fragment references;
   * `src` survives only on `img` with a `data:` URL of PNG, JPEG, GIF or WebP.
3. **Frame sandbox.** `<iframe sandbox="allow-same-origin">` (`src/app.html`). No script, form, popup, modal or top-navigation permission. Same-origin access is needed so that the main window can edit the frame's DOM; because the frame can never run script, the opened document cannot use that access.
4. **Content security policy.** Main page (`tools/build.mjs`): `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'`. Only the one built-in script runs; inline event handlers and injected scripts are blocked even in the main window. The frame inherits this policy and adds its own: `default-src 'none'; style-src 'unsafe-inline'; img-src data:`. Inline CSS of the document is allowed so that pupils see their styles; every `url()`, `@import` and font in it is blocked by the policy.
5. **Input handling in the preview** (`src/js/app.js:702–740`): paste inserts plain text only, drops and native rich-text commands are cancelled, clicks on links are cancelled.
6. **Write-back** (`src/js/serialize.js:179`): new elements are written from a fixed list of tags; attributes are filtered again; link addresses are re-checked with `checkLinkUrl()` (`src/js/util.js:51`); image sources must be raster `data:` URLs. Text and attribute values are escaped.
7. **Untrusted DOM is read through original accessors** (`src/js/project.js:26–42`), because form controls named like DOM properties shadow those properties.
8. **No persistence, no network API, no dynamic code.** No storage API, `fetch`, `XMLHttpRequest`, WebSocket, `eval`, function constructor or message channel occurs in the file (X-05, X-06).

Layers 2, 3 and 4 are meant to be independent of each other. What was measured is their combination in the delivered file (X-01 to X-03). In addition, R-02 runs the projection in a page without any policy and observes that image sources cause no request. Sandbox alone and policy alone were not measured separately.

## What was measured

MEASURED 2026-11-18, Windows 11, Microsoft Edge 157.0.4341.60 (headless), delivered file from `file://`, network available, local HTTP server counting delivered requests. Details per check: `tests/results/acceptance-edge.json`.

| Case | Result |
| --- | --- |
| X-01 inline, external, module and SVG scripts; `onload`, `onerror`, `onclick`, `onfocus`, `ontoggle`, `onbegin`, `oninput` and other handlers; `javascript:` link | nothing executed, no marker in the editor window or the frame, storage sentinel not read, no request delivered, source unchanged |
| X-02 `javascript:` links in four disguises, plain, `_blank`, `_top` and `data:` links (click, Ctrl+click, middle click, scripted click), `meta refresh` in head and body, `base`, forms (submit button, `formaction`, scripted submit), `iframe` with `src` and `srcdoc`, `object`, `embed`, `frameset`, `area`, popup button; once editable, once read-only | no request delivered, editor and frame did not navigate, no new window |
| X-03 style sheet link, preload/prefetch/preconnect/modulepreload/icon, `@import`, `@font-face`, CSS `url()` in seven properties, `img` `src`/`srcset`/protocol-relative, `picture`, `video`/`audio`/`track`, SVG `image`/`use`, table and body `background`, image input, `ping`, external script, `manifest` | 0 requests delivered; the browser reported 11 attempts from inline CSS, all blocked by the policy; control page in the same browser did fetch |
| X-04 paste of rich clipboard content with a trusted key event, paste events with markup-shaped text, HTML-only clipboard, drop | text only, no element created, nothing executed or fetched |
| X-05 message bridge | none exists |
| X-06 static scan of the delivered file | no dynamic code, storage, network API; one script; sandbox and policy as stated |
| X-07 names that shadow DOM properties | no error, edits stay exact |

NOT MEASURED: Chrome (not installed on the test machine); behaviour of browsers other than Chromium-based ones; the native file dialogs.

## Residual risks

* The protection relies on the browser enforcing `sandbox` and the content security policy for `srcdoc` frames of a `file://` page. This was measured in one Edge version.
* `style-src 'unsafe-inline'` lets a document style the preview arbitrarily (for example hide or overlay its own content). It cannot reach the editor chrome, which is outside the frame.
* A very large or deeply nested document can make the editor slow. Opening is limited to 5 MB; nesting beyond 400 levels is shown read-only.
* A saved file contains what the pupil wrote, including scripts. Opening it in a browser runs them.
