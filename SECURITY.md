# Security

Report vulnerabilities using GitHub private vulnerability reporting for `commercekit-tools/action-kit`; do not post credentials or exploit details in public issues. No reporting email is invented here.

Packages contain no credentials, logging or telemetry. Technical-user tokens are cached in memory only. Inject `maskSecret` in Action adapters and register exact runtime values for redaction. HTTPS is required, redirects are blocked, responses are bounded and requests support abort/timeouts. Unsafe mutations do not retry ambiguous outcomes. Explicit 401 replay requires consumer opt-in. Errors expose structured safe facts; consumers retain disclosure decisions.

See [security boundaries](docs/security-boundaries.md) for limitations. Never include real credentials, subscriptions or provider responses in fixtures or reports. Supported releases do not exist until manually published; reservation versions are never supported.
