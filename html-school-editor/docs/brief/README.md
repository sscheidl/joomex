# HTML School Editor: source-assisted L2A reconstruction brief

> **Note of 2026-11-18.** These documents were written before the implementation and are kept unchanged as the contract it was built against. Where they say that the product belongs in a separate repository and that nothing is pushed, that was the plan at the time: the owner later decided to keep the implementation in this repository, in the parent folder [`html-school-editor/`](../../). Current state: [../STATUS.md](../STATUS.md).

This folder contains a development brief, acceptance criteria and sanitized reference findings. **It contains no analysed third-party source.**

The owner requested a source-assisted reconstruction of a portable HTML editor for introductory classroom use. The reference code may be read and used to understand working behaviour, architecture and algorithms. This is not a blind exercise, and there is no requirement to invent every working idea again. The new implementation must address the known safety and data-integrity defects.

## Start here

| Document | Purpose |
| --- | --- |
| [CLAUDE_CODE_TASK.md](CLAUDE_CODE_TASK.md) | Canonical task for Claude Code |
| [CLAUDE_CODE_TASK.de.md](CLAUDE_CODE_TASK.de.md) | German task translation |
| [ACCEPTANCE.md](ACCEPTANCE.md) | Shared, numbered product and test requirements |
| [REFERENCE_FINDINGS.md](REFERENCE_FINDINGS.md) | Sanitized findings, evidence aliases and measurement limits |
| [METHOD.md](METHOD.md) | Exact L2A sources and their application to this source/script case |

The full local analysis case and its private handoff supply the reference identity, pinned revision, source paths and raw audit evidence. They remain outside this public repository. An implementation session should receive that local handoff in addition to these public documents when source access is available. Do not fabricate missing evidence or search unrelated personal folders.

## Repository boundary

This directory is the **briefing location in joomex**. The resulting application belongs in its **own separate local Git repository**, working name `html-school-editor`, outside both joomex and the L2A repository. Do not create a nested Git repository here, add the product to the L2A tool, or turn it into a Joomla extension. No remote repository, push, PR or release has been created by this briefing task.

The new repository should carry its own concise agent instructions, English developer documentation and a licence covering its independently written code. Its pupil-facing interface is German. The existing [repository rules](../../../RULES.md), including publication hygiene, apply to everything stored here.

## Status

* Brief and acceptance contract: prepared on 2026-11-18.
* Reference defects: measured during the prior audit; see the individual findings and limits.
* New product implementation: built as 0.1.0-alpha.1 after this brief was written; measurements and open points are in [../STATUS.md](../STATUS.md) and [../ACCEPTANCE_RESULTS.md](../ACCEPTANCE_RESULTS.md).
* Next action: the separate Codex review, see [../REVIEW_CODEX.md](../REVIEW_CODEX.md).
