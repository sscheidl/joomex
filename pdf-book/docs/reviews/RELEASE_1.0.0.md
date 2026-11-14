# PDF Book 1.0.0 release record

Prepared 2026-11-14 at the owner's request. Version 1.0.0 is a new build based on the independently reviewed alpha.19 source and documented deployment follow-up. **Validation is in progress; artifact identity and measured results will be recorded before hand-off.** No stable tag, published release or production installation is created by preparing this record.

The package retains its module identifier and settings. The display name loses the prototype suffix. Changes close the archive deletion case N19-1, the numeric edge cases N19-2 and the intermediate letterbox resource concern from [the alpha.19 review](REVIEW_0.1.0-alpha.19.md).

The website-wide CSP conflict found in the prior local replay concerns adopting a new policy in an existing page builder. Such a rollout is separate hardening work; it is not by itself a condition for the module's release. Prior alpha.19 deployment evidence remains attributed to that exact version, not silently transferred to changed 1.0.0 bytes.

The artifact manifest records the clean committed package inputs, toolchain and per-entry hashes. ZIP compression can vary across zlib implementations; immutable source-entry comparisons remain required.
