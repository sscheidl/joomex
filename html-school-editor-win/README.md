# Markup Ninja: HTML School Editor for Windows

A small Windows program in which pupils of about 12–13 years learn HTML: the code in the middle and the page on the right, exactly as Microsoft Edge shows it, and they write in either. Pictures and links are found relative to the page, as in a browser, because the page is loaded from its real place in the pupil's project folder.

**State:** 0.1.0-alpha.24 on a branch (2026-11-28, PR #36): the owner's branding "Markup Ninja" (name, look, light icon, help picture) on top of alpha.22, which is on `main` (PR #33); not reviewed yet; not yet for pupils' files. See [docs/STATUS.md](docs/STATUS.md) and [docs/BUILD.md](docs/BUILD.md).

| Document | Content |
| --- | --- |
| [docs/SPECIFICATION.md](docs/SPECIFICATION.md) | Purpose, decisions, scope of stage 1, open questions |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | C++ core, two WebView2 views, how relative addresses work |
| [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md) | Acceptance criteria of stage 1 |
| [docs/STAGE2.md](docs/STAGE2.md) | Plan for stage 2: editing on the page side, "Code aufräumen"; E1 decided (two views stay), E2 to E5 open |
| [docs/BUILD.md](docs/BUILD.md) | Building on Windows |
| [docs/REVIEW_REQUEST.md](docs/REVIEW_REQUEST.md) | Review request for Codex: stage 1 code and the plan for stage 2 |

It replaces the single-file editor in [`../html-school-editor/`](../html-school-editor/) for Windows; that one stays in use until this program is ready.

Licence: MIT, see [LICENSE](LICENSE).
