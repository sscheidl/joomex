# Security

## What is protected

The editor is one local HTML file. Documents that pupils open or paste are untrusted. They must not be able to

* run script or event handlers in the editor,
* read or change the editor window, its storage or other open work,
* navigate the editor or its preview, open windows or submit forms,
* cause any network request or read files, except picture files on this computer (owner's decision, see [Pictures from the folder of the editor](#pictures-from-the-folder-of-the-editor)),
* make the editor rewrite or lose source text.

Not in scope: the safety of a saved document when it is opened in a browser outside the editor. The editor keeps scripts and links of a document in its source; it does not sanitize files.

## Layers

1. **The opened document is never executed or loaded as a page.** It is parsed with `DOMParser` into an inert document (`src/js/project.js:96`). The preview frame holds a fixed shell document (`src/js/app.js:29`); its content is built node by node by the editor.
2. **Projection.** `describe()` and `safeAttrs()` (`src/js/project.js:215`, `:178`) decide what reaches the preview:
   * never created: `script` (any namespace), `link`, `meta`, `base`, `title`, `template`, frames, and the SVG animation elements `set`, `animate`, `animateMotion`, `animateTransform`, `animateColor`, `discard` (`:21`, `:196`), because an animation can assign an address to an attribute after the attributes were filtered; replaced by a box: `iframe`, `object`, `embed`, `applet`, `audio`, `video`; `form` becomes a plain block;
   * attributes removed: every `on…` attribute, `srcdoc`, `action`, `formaction`, `ping`, `background`, `poster`, `data`, `srcset`, `target`, `http-equiv`, `contenteditable`, `name` on elements that would become document properties, and others in `DROP_ATTRS` (`:17`);
   * `href` of links is moved to an inert `data-se-href`; other `href`/`xlink:href` survive only as fragment references; since 0.1.0-alpha.5 the `target` of a link is kept in an inert `data-se-target` (`src/js/project.js:186`), so that the link dialog can show it; a link in the page pane has neither address nor target;
   * `src` survives only on `img` with a `data:` URL of PNG, JPEG, GIF or WebP. An `img` whose address is a plain relative one gets, as `src`, the file address that the editor resolved itself (`localFileUrl()`, `src/js/util.js:115`): relative to the editor's own `file:` address, accepted only if the result is a `file:` address on the same host as the editor (`src/js/project.js:194`). Every other `img` gets a generated SVG picture in a `data:` address that names the reason (`boxPicture()`, `:167`). So the projection never puts an address of the network or of another computer on an element.
3. **Frame sandbox.** `<iframe sandbox="allow-same-origin">` (`src/app.html`). No script, form, popup, modal or top-navigation permission. Same-origin access is needed so that the main window can edit the frame's DOM; because the frame can never run script, the opened document cannot use that access. While "Code aufräumen" compares layouts, a second frame of exactly this kind exists for a moment (`sameLayout`, `src/js/app.js:655`): same attribute, same shell, same policy, filled by the same projection, never shown and never focused.
4. **Content security policy.** Main page (`tools/build.mjs`): `default-src 'none'; script-src 'sha256-…'; style-src 'unsafe-inline'; img-src data: 'self'; form-action 'none'; base-uri 'none'`. Only the one built-in script runs; inline event handlers and injected scripts are blocked even in the main window. The frame inherits this policy and adds its own: `default-src 'none'; style-src 'unsafe-inline'; img-src data: 'self'` (`src/js/app.js:29`). Inline CSS of the document is allowed so that pupils see their styles; every `@import`, font and every `url()` that points to the network is blocked by the policy. Since 0.1.0-alpha.4, `img-src 'self'` lets pictures be loaded as files of the editor's own origin: see the next section. The `blob:` source of alpha.3 is gone; the editor no longer makes object addresses for pictures.
5. **Input handling in the preview** (`src/js/app.js:1007–1075`): paste inserts plain text only, drops and native rich-text commands are cancelled, clicks on links are cancelled.
6. **Write-back** (`src/js/serialize.js:232`): new elements are written from a fixed list of tags; attributes are filtered again; link addresses are re-checked with `checkLinkUrl()` (`src/js/util.js:51`); the address of an image must be a raster `data:` URL or a plain relative file address (`fileOfSrc()`, `:86`); of a `style` attribute only a single `text-align` declaration with one of four values is written. Text and attribute values are escaped. A changed attribute of an existing element is written by `patchAttrs()` (`:273`) with the same escaping, inside the quotes of the source.
7. **Untrusted DOM is read through original accessors** (`src/js/project.js:38–54`), because form controls named like DOM properties shadow those properties.
8. **No persistence, no network API, no dynamic code.** No storage API, `fetch`, `XMLHttpRequest`, WebSocket, `eval`, function constructor or message channel occurs in the file (X-05, X-06).

Layers 2, 3 and 4 complement each other; none is complete alone. The projection deliberately lets inline CSS through, and CSS can ask for resources: only the policy stops those. A frame without script permission does not block network requests. A policy without the projection would not stop a link from navigating the frame. What was measured is the combination in the delivered file (X-01 to X-03, RV-04). R-02 additionally runs the projection in a page without any policy and observes that the image sources it generates cause no request; that says nothing about CSS. Sandbox alone and policy alone were not measured.

## The note about inactive content

Requirement S-04 asks that switched-off content is announced. Two sources feed the note above the page (`showInactive`, `src/js/app.js:265`): the projection counts what it leaves out (`reportText`, `src/js/project.js:148`), and a listener for the browser's policy-violation event in the frame (`src/js/app.js:1067`) remembers that the policy stopped something. If the projection named nothing, the note then says that content from outside was stopped by the browser. The remembered stop is cleared only when another document replaces the current one: the editor cannot tell which part of the text caused a stop, so it does not try to decide when the cause is gone. The second source exists because a list of known cases cannot be complete: an address written with a CSS escape (`u\72 l(…)`) is one example the list does not recognise and the policy stops (RV-04, A3-05).

## Pictures from the folder of the editor

Owner's decision for 0.1.0-alpha.4. Each pupil keeps the editor file in the project folder, together with pages and pictures. A relative picture address such as `bilder/katze.jpg` therefore means the same file seen from the editor and from the page, and the page pane loads it from there. Before, it showed only files chosen in the running session, and a page reopened a week later showed every picture as a box.

What the editor does itself (`src/js/util.js:115`, `src/js/project.js:194`, `src/js/app.js:503–524`):

* Only an `img` address that `fileOfSrc()` accepts (no scheme, no host, no drive letter) is resolved, with `new URL(address, location.href)`, and only if the editor itself was opened from `file:`. The result is used only if it is a `file:` address with the same host as the editor. A page cannot make an image element point to another computer this way.
* A file that cannot be loaded raises `error` on its image element. The page pane remembers the address and shows a box "Bild nicht gefunden: …", and the note above the page names it. It looks again only when the pupil comes back to the editor from another program, when another document is opened, and after the image dialog closes, so nothing is loaded over and over.
* The image dialog looks for the address it will write and says "Gefunden" or "Nicht gefunden".

What the policy allows beyond that, and is accepted by the owner:

* `img-src 'self'` applies to every picture of the page pane, also to those named in the **CSS** of an opened page (`background-image: url(…)`, list markers, …). These addresses are not resolved by the editor. A page can therefore load picture files of this computer that lie anywhere the address reaches, also above the project folder (measured in X-08).
* In Microsoft Edge, `'self'` for a `file:` page does not exclude other computers: a `file://computer/share/…` address in the CSS is attempted, without a stop by the policy. Firefox resolves such addresses locally. MEASURED in X-08: Edge 157 reports the attempt for `file://rechner/freigabe/…`; Firefox 160 reports none to the test driver (its driver reports no file requests at all). Whether such an attempt reaches a real share was not measured. The owner accepts this: pupils have no shares except exchange folders.
* Nothing is loaded from the network: the policy stops `http:`, `https:` and protocol-relative addresses in elements and in CSS (F-01, X-03, X-08).
* A picture shown in the page pane is decoded by the browser like any picture on a web page. No script runs in it: an SVG file in an `img` element never runs script, and the editor accepts only PNG, JPEG, GIF and WebP when it writes an address.

**Condition the pupil must know** (in the guide and the help): the pictures are found only if the opened page lies in the same folder as the editor, or the addresses are written relative to the editor. The editor cannot tell where a page was opened from: the browser does not reveal the folder of an opened file.

## Opening the pupil's page in the browser (0.1.0-alpha.5)

Requested by the owner: pupils have to test their relative and external links, "the most important lesson". **This is the first function with which the editor starts a pupil's page as a page, with its scripts running.** It is outside the protection described above, which covers the page pane only, and it is deliberate.

* `browseDoc()` (`src/js/app.js:907`) calls `window.open(address, '_blank', 'noopener')`. The address is the saved file name, encoded with `encodeURIComponent`, resolved against the editor's own `file:` address; nothing else of the document goes into it. Only when the editor itself runs from `file:`.
* `noopener`: the new tab gets no reference to the editor window, and the editor keeps none to the tab. A script of the page can therefore not reach the editor, its open work or its file handles. The page runs in its own `file:` context, exactly as after a double click in the file explorer, which is the manual way the guide also describes.
* What is opened is the saved file, not the text in the editor: unsaved changes are saved first, after a question. A copy that went to "Downloads" is not opened.
* MEASURED in F-09 (Edge 157, Firefox 160) with `window.open` replaced by a recorder (a labelled mock): the exact address and the features `_blank`, `noopener`, and that nothing is opened for a page never saved or saved only as a download. Not measured by the suite: the real tab. Observed by hand in Edge 157 before this version: the neighbouring file opens, its scripts run, the tab has no `opener`.

## The page title (0.1.0-alpha.5)

The title field is the first edit of the head. `withTitle()` (`src/js/format.js:89`) replaces only the text of the first `<title>` outside SVG and MathML, with `&` and `<` escaped, or adds one line with a title element. `commitTitle()` (`src/js/app.js:925`) parses the result with `DOMParser` and applies it only if the page then has exactly this title, the same body and the same rendering mode (F-10, unit test "page title"). Nothing of the head is shown in the page pane because of it.

## What was measured

MEASURED 2026-11-19, Windows 11, Microsoft Edge 157.0.4341.60 (headless) and Firefox/160.0.1 (headless), delivered file from `file://`, network available, local HTTP server counting delivered requests. The table gives the Edge results. In Firefox the cases X-01, X-02, X-03, X-05, X-06, X-07, X-08, RV-04, A3-05 and F-01 pass with the same checks (X-08 records different notes, see above); X-04 is NOT MEASURED there (a constructed paste event carries no data in Firefox and the system clipboard is not automated). Details per check: `tests/results/acceptance-edge.json`, `tests/results/acceptance-firefox.json`.

| Case | Result |
| --- | --- |
| X-01 inline, external, module and SVG scripts; `onload`, `onerror`, `onclick`, `onfocus`, `ontoggle`, `onbegin`, `oninput` and other handlers; `javascript:` link | nothing executed, no marker in the editor window or the frame, storage sentinel not read, no request delivered, source unchanged |
| X-02 `javascript:` links in four disguises, plain, `_blank`, `_top` and `data:` links (click, Ctrl+click, middle click, scripted click), `meta refresh` in head and body, `base`, forms (submit button, `formaction`, scripted submit), `iframe` with `src` and `srcdoc`, `object`, `embed`, `frameset`, `area`, popup button; once editable, once read-only | no request delivered, editor and frame did not navigate, no new window |
| X-03 style sheet link, preload/prefetch/preconnect/modulepreload/icon, `@import`, `@font-face`, CSS `url()` in seven properties, `img` `src`/`srcset`/protocol-relative, `picture`, `video`/`audio`/`track`, SVG `image`/`use`, table and body `background`, image input, `ping`, external script, `manifest` | 0 requests delivered; the browser reported 11 attempts from inline CSS, all blocked by the policy; control page in the same browser did fetch |
| RV-04 SVG `set` and `animate` that assign an image address, `style` inside SVG, SVG presentation attribute with an address, `image-set()` without `url()`, `url()` written with a CSS escape | 0 requests delivered; the animated addresses are not attempted any more; every sample shows the note; the escaped address is attempted, stopped by the policy and announced through the policy event; the note disappears when the address is deleted from the code |
| F-01 a copy of the editor in a folder with pictures in it, in a subfolder and in the folder above; a missing file; picture addresses on the local counting server, without scheme (`//127.0.0.1:…`) and on another computer (`file://rechner/…`); a picture embedded in the code | pictures in, below and above the folder are shown from their files; a missing one is a box that names it and is found after the pupil comes back or after the image dialog; the other addresses are boxes, the browser reports no request for them and nothing reaches the counter; every image element has a `data:` address or one inside the test folder; the source is unchanged |
| X-08 CSS of an opened page with a picture next to the editor, one on another computer and one on the counting server | the local picture is loaded (accepted); nothing reaches the counter and the network address is not attempted; the address on another computer is recorded as a note |
| X-04 paste of rich clipboard content with a trusted key event, paste events with markup-shaped text, HTML-only clipboard, drop | text only, no element created, nothing executed or fetched |
| X-05 message bridge | none exists |
| X-06 static scan of the delivered file | no dynamic code, storage, network API; one script; sandbox and policy as stated |
| X-07 names that shadow DOM properties | no error, edits stay exact |

NOT MEASURED: Chrome (not installed on the test machine); paste in Firefox; other browsers; the native file dialogs.

## Residual risks

* The protection relies on the browser enforcing `sandbox` and the content security policy for `srcdoc` frames of a `file://` page. This was measured in one Edge version and one Firefox version.
* The projection lists what it leaves out; it does not list what it allows. A browser feature that is neither listed nor stopped by the policy would be shown. The independent review of alpha.1 recommends an allow-list for a classroom tool; this version keeps the deny-list, adds SVG animation to it and announces whatever the policy stops.
* The policy note depends on the browser raising the violation event in a frame without script permission. Measured in Edge 157 and Firefox 160. A stop that is reported late, after another document was opened, would be shown for that document.
* `style-src 'unsafe-inline'` lets a document style the preview arbitrarily (for example hide or overlay its own content). It cannot reach the editor chrome, which is outside the frame.
* `img-src 'self'` lets an opened page show picture files of this computer through its CSS, and in Edge attempt picture files on other computers (see [Pictures from the folder of the editor](#pictures-from-the-folder-of-the-editor)). Accepted by the owner. The editor only shows such a picture inside its own window; it does not send it anywhere.
* The note "Im Editor ausgeschaltet" still counts every `url()` in the CSS of a page as switched off, although a picture next to the editor is now shown. The note says too much, never too little.
* A very large or deeply nested document can make the editor slow. Opening is limited to 5 MB; nesting beyond 400 levels is shown read-only.
* A saved file contains what the pupil wrote, including scripts. Opening it in a browser runs them.
