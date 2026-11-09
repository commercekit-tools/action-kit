# Compatibility policy

Preserve Action input names, output names, result-json shapes, NotificationEvent shapes, status mapping, error classification, retry safety, secret behavior and bundled execution. Extraction is not permission to redesign consumers.

Baseline SHAs are immutable evidence, not claims that consumer branches will never advance. Refresh by inspecting current main and still-open implementation PRs before a migration; record both starter main and implementation head where relevant. Schema parity is byte-semantically checked against the copied current Notify schema; baseline provenance records its SHA.

Fixtures are synthetic and provider-neutral: Check success/warning/failure/internal-error/cancelled; Build success/failure/cancelled/internal-error/timeout; Deploy success/failure/cancelled/action-required/internal-error/timeout/prepare-canary-handoff. Timeout maps to internal-error. Harnesses are minimal adapters, not copies of Actions. Packed consumers import only public exports and compile declarations without Actions SDKs.

Additive v1 properties remain valid, but factories omit unsupported data. Consumers must explicitly select renderable fields. Notification schema version is independent of package SemVer. After stable, incompatible API changes require a major package version. Consumers pin exact package versions in manifests and lockfiles.
