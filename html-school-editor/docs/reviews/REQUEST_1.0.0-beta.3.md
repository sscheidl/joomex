# Review request: HTML School Editor 1.0.0-beta.3 (corrections of the review of beta.2)

Implementer: Claude Code. Reviewer: Codex. Requested by the owner of this repository on 2026-11-24.

## Scope

Your complete review of 1.0.0-beta.2 (2026-11-23, verdict **HOLD**, report handed over to the owner only) found the defects listed below. 1.0.0-beta.3 corrects them. **This request covers only the difference beta.2 → beta.3**: whether each finding is corrected in general and not only for your reproduction, whether a correction breaks something else or reopens an earlier kind of defect, and whether the new tests show what they claim. Nothing else of the product is under review again.

1.0.0-beta.3 is in class since 2026-11-24 (owner's decision: accompanied trial in Edge). Since then only defect corrections are allowed (decision D5 of the owner); new functions are not asked for.

## State of the repository

| | Commit | Branch |
| --- | --- | --- |
| beta.2 (base) | `db83bde` | `fix/html-school-editor-1.0.0-beta.2` |
| **beta.3 (under review)** | `b8e0d6d` | `fix/html-school-editor-1.0.0-beta.3` |
| merged onto `main` | `0ca2fe6` | `main`, with `b243fae` on top: documents and the test size limit (200,000 → 250,000 bytes, owner's decision of 2026-11-24); `dist/school-editor.html` unchanged |

The corrections are `git diff db83bde b8e0d6d -- html-school-editor/`. Changed code: `src/js/app.js`, `src/app.html`, `src/style.css`. New tests: `tests/browser/beta3.mjs` (B3-01 … B3-07); changed expectations in `beta2.mjs`, `features5.mjs`, `functional.mjs`, `review6.mjs`, `review10.mjs`, `security.mjs` (see "Changed tests").

```bash
git fetch --prune origin
git worktree add <new folder> -b review/html-school-editor-1.0.0-beta.3 origin/fix/html-school-editor-1.0.0-beta.3
git config user.email                                   # must be the GitHub noreply address
git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
```

Not done and not to be assumed: no merge of anything of yours, no CI workflow. A GitHub release of beta.3 is prepared by the owner.

## The corrections

Code references are to `src/js/app.js` at `b8e0d6d` unless named otherwise.

| Finding | Correction | Code | Case | Please try |
| --- | --- | --- | --- | --- |
| **E5a** (high) two tabs or another program changed the file; the next save overwrote it silently, both tabs showed "gespeichert" | before writing, the file is read (`readDisk`); if its decoded text differs from `state.diskText` (the text this page last read or wrote), nothing is written; the pupil gets "Als neue Datei speichern …" or cancel. The check and the write are two steps | `readDisk` :47, `saveNow` :1030–1040, `state.diskText` :61, set on opening :914 | B3-01 | two real Edge tabs on one file (you measured this before); Notepad; a change that only differs in invalid UTF-8 bytes or a BOM (both sides are decoded with `TextDecoder`); a file deleted meanwhile (`readDisk` gives `null` → no check, the write recreates the file: acceptable?); a file that cannot be read (permission) |
| **B2-Hang** (high, regression of beta.2) no way to rescue the text while a write hangs | "Speichern unter …" while a write runs saves the newest text as an independent copy (`-kopie` suggested); the page stays with its file; the copy does not mark the page as saved | `saveAsDoc` :1001, `rescueCopy` :1008 | B3-02 | a hanging write, then "Speichern unter …" twice; the copy's picker cancelled; the copy target = the file being written; the editor's own file as target |
| **T1-copy** (high, narrow) a page opened without a handle, same name and text as a page being written, was shown as saved | such a page never counts as saved by that write; message | `otherPageWritten` :1079 | B3-03, A10-01 | dropped file and file input of the same name; a different text of the same name |
| **E6** (high) the editor opened and edited itself | a file whose first 4096 bytes carry `<meta name="html-school-editor">` is not opened and not taken as a save target | `EDITOR_MARK` :45, `isEditorTarget` :50, `loadFile` :881, `src/app.html:5` | B3-04 | the tag written differently (upper case, attribute order, more than 4096 bytes before it, a pupil's page that copies the tag); an earlier editor version without the tag; drag and drop and the file input |
| **E1c / E1d / E8** (medium) green "gespeichert" after a download and for a new page; contradicting messages after a cancelled "Speichern unter …" | top bar: "noch keine Datei", "Kopie in Downloads", "● nicht gespeichert", green "gespeichert" only for a page as its file is; tab title names the page | `updateChrome` :211, `saveNow` :1046 | B3-05 | every path: new, opened, saved, downloaded, saved after a download, cancelled "Speichern unter …", conflict cancelled |
| **E2 / E4** (high for checking work) "Im Browser öffnen" opened a same-named page next to the editor | renamed "Gespeicherte Seite ansehen"; a note first names the file and the folder it opens from | `browseDoc` :1107, `src/app.html` | B3-06 | a page saved in another folder; a page saved as download; the note cancelled |
| **E8** names | "Linksbündig", "Zentriert", "Rechtsbündig", "Blocksatz", "Link einfügen", "Bild einfügen" | `src/app.html` | B3-07, B2-03 | narrow window (toolbar wrapping) |

## Questions where the implementer is least sure

1. **E5a compares decoded text, not bytes.** `readDisk` and the written blob both go through `TextDecoder` (BOM removed, invalid bytes replaced). Can a real change in the file look unchanged, or an unchanged file look changed (for example a file saved by Notepad with a BOM, or with other line endings, by the same page)?
2. **E5a when the file is gone.** `readDisk` gives `null` and the save writes without asking. A file renamed in Explorer is then written again under its old name.
3. **E5a and the save queue.** A save that waits behind a hanging write reads the file when its turn comes; the file may by then hold the text of the write before it. Is `state.diskText` updated in every order (`saveNow` :1070, `otherPageWritten` :1096)?
4. **`rescueCopy` and `isDirty()`.** The copy leaves the page "nicht gespeichert"; after the hanging write ends, the top bar follows the write's text. Is any message in that order wrong?
5. **No check for some pages.** `diskText` stays `null` for a page opened without a handle and for a page converted from Windows-1252 (:914); such pages are written without the check. Is that a gap for the class (Edge always gives a handle when opened with "Öffnen")?
6. **E6 by a tag.** A pupil's page that copies the editor's head would be refused as "the editor". Acceptable?

## Changed tests

B3-01 … B3-07 were written first and failed against the beta.2 build in Edge (0 of 7). Older expectations changed because the visible text changed: the top bar after a download or for a new page (T-10, T-15, T-16, F-11, A5-10, B2-01), the tab title in X-01, X-02, X-04 (the pupil's scripts still cannot change it), the note before the view in F-09, the message in A10-01. Please check that each changed expectation still checks what the case was written for. The mock in B3-01 changes the file as a second tab would; two real tabs and the school drive are NOT MEASURED by the harness.

## Commands and what they printed for the implementer

In `html-school-editor/` on `b8e0d6d` (2026-11-23, Windows 11 Pro 10.0.26300, Node v24.22.1, Edge 158.0.4370.33 and Firefox 160.0.1 headless):

```bash
node tools/build.mjs --check            # up to date: dist/school-editor.html  196056 bytes  sha256 c6c659062631b38b97e78696f82af0fc7958305f3a81ff6ac90459828906167a
node --test tests/unit/*.test.mjs       # 27 of 27 pass
node tests/run.mjs --browser edge       # 106 cases pass, 898 checks, 3 parts NOT MEASURED
node tests/run.mjs --browser firefox    # 100 pass, 5 partial, 1 not measured, none failed, 855 checks
node tests/run.mjs --browser edge --no-write --only B3-01,B3-02,B3-03,B3-04,B3-05,B3-06,B3-07   # 7 pass; against the beta.2 build 0 of 7
```

On 2026-11-24 the implementer repeated on Linux only: the build check (same size and hash) and the unit tests (27 of 27). Browser runs were not repeated.

Note: on `main` the size limit in `tests/run.mjs` is 250,000 bytes; on `b8e0d6d` it is 200,000. Both pass.

## What kind of review this is

Own code, own machine, offline. The editor is a single local HTML file for pupils; it talks to no server. Its protective design (pupils' scripts do not run, nothing is loaded from the network) is not changed by beta.3 and is not under review again, unless a correction touches it. If a part cannot be carried out, record it as `NOT REVIEWED` with the reason and complete the others.

## Delivery

1. A report in English: per finding corrected or not, with `file:line`; new findings with severity and the requirement concerned; what was not reviewed.
2. Overall verdict for the accompanied Edge trial: `PASS`, `HOLD` or `FAIL`. Findings about lost work first.
3. Do not change the product on the fix branch or on `main`. If anything is pushed: the repository publication check with no findings, and the ancestry check above.
