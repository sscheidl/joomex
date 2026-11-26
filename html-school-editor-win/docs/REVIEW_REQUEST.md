# Review request: HTML School Editor for Windows 0.1.0-alpha.10 and alpha.11, and the open cases

Implementer of alpha.10 and alpha.11: Claude Code. Reviewer: Codex. Requested by the owner of this repository on 2026-11-26. (The first request, for alpha.1, is in the history: `git show 36c0905:html-school-editor-win/docs/REVIEW_REQUEST.md`.)

## Re-review of alpha.12 (added 2026-11-26)

Codex reviewed alpha.11 on 2026-11-26 (CHANGE BEFORE MERGE). alpha.12 (`cb9d679`) corrects the merge findings; `e717f4c` only records the owner's decision on deleting rescue copies. Please check, in that order:

1. **Logoff** (`WM_QUERYENDSESSION`, `noteUnsaved` in `src/win/app.cpp`): the state now reaches the core in the `WebMessageReceived` callback, and while a page is open the query is always refused first. Repeat your held-report case and the "Neue Seite" case. With a saved page the editor must close itself.
2. **Kept close request and the question queue** (`ask`, `showNextQuestion`, `requestClose` in `ui/js/main.js`): repeat your question-completion probe. The new tests are "a close request while another question is open …" and "questions take turns …" in `tests/ui/ui.test.mjs`.
3. **Dialog claim when queueing fails** (the `WebMessageReceived` callback, `refuseDialog`).
4. **Rescue copy:** `profileDataFolder` (`src/win/winutil.cpp`) with no fallback, the name limit, `page` in the answer.

Give a new verdict for PR #26. The open items listed in [STATUS.md](STATUS.md#corrections) under alpha.12 are known and not part of the merge decision unless you disagree. Part 2 of the request below still applies to what you could not measure.

## What this is

[PR #26](https://github.com/sscheidl/joomex/pull/26) brings the Windows editor onto `main` and is on **HOLD**. The owner decided on 2026-11-26: B4 and the late page choice are fixed before the merge, and B3 is fixed before the editor is used with pupils' files. alpha.10 and alpha.11 contain those fixes. Claude wrote them, so nobody has reviewed them independently yet, and several acceptance cases have never been measured.

Three parts, independent of each other. If a part cannot be carried out, record it as `NOT REVIEWED` or `NOT MEASURED` with the reason and complete the others.

## State of the repository

* Branch `fix/html-school-editor-win-0.1.0-alpha.10` (PR #26). Thirteen commits on top of `main` lead to alpha.10 (`b9cf7d3`), then come alpha.11 (`aa35c05`) and this request. alpha.9 (`6cc716d`) was the subject of Claude's review of 2026-11-26 (findings B1 to B8).
* Folder `html-school-editor-win/`. Hashes of the builds Claude measured are in [STATUS.md](STATUS.md#evidence-on-windows). The builds are not reproducible (B7), so compare behaviour, not hashes.

```bash
git fetch --prune origin
git worktree add <new folder> -b review/html-school-editor-win-0.1.0-alpha.11 origin/fix/html-school-editor-win-0.1.0-alpha.10
git log --format='%ae %ce' origin/main..HEAD | sort -u  # must list noreply addresses only
git diff 6cc716d..HEAD -- html-school-editor-win          # the code under review
```

## Part 1: reading review of alpha.10 and alpha.11

What changed: [STATUS.md, "Corrections"](STATUS.md#corrections), the alpha.10 and alpha.11 sections. The rules are in [ARCHITECTURE.md, "Messages"](ARCHITECTURE.md). In this order of weight:

**Lost work.**

* **Late page choice** (`openOp_`, `src/win/app.cpp`, the `openDialog` branch of `onUiMessage`): only `openDialog` checks the latest open request before it switches the project folder. Can another late answer still switch the folder or empty the editor? Check `setProject` with a `then`, the start page (`op` 0), `LastProject` at start-up, `newPage`, and a picture answer after a page change (`state.picture`).
* **Rescue copy** (`App::rescue`, `rescue`/`rescued` in `ui/js/main.js`): the bytes must be exactly those a save would write at that moment. Check the name collision loop, the 5 MB limit, `createFileAtomic` on the local disk, the folder fallback to `%TEMP%` (`localDataFolder`), and that the save on its way and `savedRaw` stay untouched. Rescue copies are never deleted. Judge that for shared school accounts (SPECIFICATION.md 6).
* **Dialog queue** in `ask()` (`ui/js/main.js`): a question that comes while another one is open waits for that one to close. Can a question be lost, or an answer reach the wrong dialog? `closeRequest` returns early while `state.modal` is set. Can closing then stop asking?
* **Logoff** (`WM_QUERYENDSESSION`, `unsaved`): `WM_ENDSESSION` is not handled, and the block reason is removed only when `unsaved` becomes false. Is there a case where Windows ends the program with unsaved text without asking?

**Threads and lifetime.**

* **One dialog per window** (`claimDialog`, `endDialog`, `AtExit` in `onUiMessage`): the claim is taken in the `WebMessageReceived` callback and released after the handler returns. Can `dialogBusy_` stay set, for example when `runLater` fails, the window closes, or a dialog request throws? Is `dialogDone` sent exactly once for every accepted request, and never for a refused one?
* **`ProjectBoundary`** (`src/win/winutil.hpp`): the resolved folder is cached per project folder, an empty result is tried again, and the mutex is held while it resolves. Can this stall the page view workers or shutdown (`FileWorkers::join` with `CancelSynchronousIo`)?
* **`rescueWorkers_`**: one thread, writes drain at shutdown. Can a rescue copy that hangs block closing?
* Is any file or network call left on the window thread apart from the system dialogs (finding B1)?

**Interface.** The lock of the dialog buttons (`state.picking`, `startPicking`). Is any path to a system dialog left unguarded, for example the conflict dialog's "Als neue Datei speichern …" or `Ctrl+Shift+S`? And is the German of the new texts clear to a 12-year-old?

**Open findings of the alpha.9 review, still unchanged:** B6 (the root `README.md` still names alpha.1), B7 (exe hashes not reproducible), B8 (a `target=_blank` link does nothing, with no hint). Please confirm or close them.

## Part 2: the open cases (native, Windows)

Build as in [BUILD.md](BUILD.md), with the release build and the test build (`HSE_TEST_HOOKS=ON`). Use disposable folders only, never pupils' files. Report each case as `MEASURED` (with date, Windows and WebView2 versions, and the exe hash) or `NOT MEASURED` with the reason.

1. **Repeat Claude's measurements independently:** X-07, F-12, F-13, F-14 and F-15 ([ACCEPTANCE.md](ACCEPTANCE.md)). Claude drove the dialogs with window messages (`WM_SETTEXT` to the file name field, `IDOK`, `IDCANCEL`) and the interface through DevTools (`HSE_DEBUG_PORT`). Use your own harness. For F-14, also check that the case fails without the `op != openOp_` check, so you know the harness catches the fault.
2. **X-06 with confirmed choices:** confirm a valid choice in each of the four system dialogs: project folder, page, picture (inside `bilder/` and outside the project, then "In „bilder“ kopieren"), and Save As (new name, existing name, outside the project). Check the returned path, the operation and the page state.
3. **Network share** (a local SMB share such as `\\localhost\<share>` is enough, as a mapped drive and as a UNC path): R-08, F-01, F-02, F-03 (the share disconnects while saving), F-06 (the watcher), F-13 without the test hook, and **F-15 with a share that really stops answering** (Claude's test only held the answer back after the write). Record ACL and attribute behaviour after `ReplaceFileW`.
4. **A real logoff** (F-12), in a VM or with a second account: unsaved text, then log off. The program must block, ask, and keep the text. Then once with the page saved.
5. **Release build:** P-05 (no developer tools, no "Inspect", no new windows or downloads) and X-03 (what the program writes, including the rescue folder).
6. **Owner only** (do not try): X-01 (school server, no administrator rights), X-04 (a class), the school computer and its share.

## Part 3: documents

Do SPECIFICATION, ARCHITECTURE, ACCEPTANCE and STATUS describe what alpha.11 does, and does STATUS claim anything that was not measured?

## Delivery

1. A report in English with findings per part. Give each finding a severity, `file:line`, the requirement concerned (SPECIFICATION section or acceptance criterion) and the smallest retest. List what was not reviewed or not measured.
2. Two verdicts:
   * PR #26: `READY TO MERGE`, `CHANGE BEFORE MERGE` or `REDESIGN`.
   * Use with pupils' files: what is still missing.
3. Do not change the product on this branch. Put the report and measurement notes on your review branch. If anything is pushed: the publication check of [RULES.md](../../RULES.md) with no findings, and the ancestry check above. Merging and releases are the owner's decision.
