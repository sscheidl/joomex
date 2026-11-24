# Status

**Version:** none yet · **Date:** 2026-11-24 · **State:** planning; specification, architecture and acceptance criteria are drafts for the owner's approval. No code.

## Decisions so far

The owner's decisions of 2026-11-24 are listed in [SPECIFICATION.md](SPECIFICATION.md#2-decisions-of-the-owner-2026-11-24): a native C++ program with the WebView2 engine; stage 1 shows the page only; a fixed project folder; this folder of the repository; the single-file editor stays in class with defect corrections only.

## Evidence from the school

| Date | Report | State |
| --- | --- | --- |
| 2026-11-24 | A portable third-party `.exe` provided on the school server was started locally by pupils without administrator rights and without installation. | owner's report, NOT MEASURED here; whether that exe is code-signed is not known |
| 2026-11-24 | In the single-file editor, pictures one folder below the page work if the folder name is written; nested folders and folders above the page do not, and in one case a picture in the same folder as editor and page was not shown. | owner's report; the cause (resolution from the editor's place) is measured in [../html-school-editor/](../html-school-editor/), the single case is not explained |

## Build environment

NOT AVAILABLE in the implementer's environment: it is Linux without a Windows compiler, and the WebView2 SDK cannot be downloaded there. Building and testing need Windows (question Q5).

## Next step

The owner approves or changes the specification, answers Q4 (code editor component) and Q5 (build route). Then: project skeleton (CMake, window, both WebView2 controllers, folder mapping, request filter) as `0.1.0-alpha.1`, with the tests R-01 to R-04 first.
