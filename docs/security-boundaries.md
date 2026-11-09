# Security boundaries

Both packages are public, framework-independent code with no logging, telemetry or credential persistence. The token manager caches tokens only in memory. Consumers inject masking callbacks and register exact runtime secrets; pattern redaction is defense in depth and cannot discover arbitrary unknown credentials. Never stringify token responses or invalid input.

HTTPS is mandatory. Token endpoints prohibit queries, fragments, credentials, whitespace and control characters. Management bases have the same restrictions and normalize a trailing slash. Request paths cannot escape the configured origin/base path. Configured hosts remain caller-controlled: these validators are not a general SSRF defense for arbitrary untrusted endpoints. Fetch redirects are blocked and browser credential forwarding is disabled. Callers must provide trusted configured endpoints and replayable bodies.

Event action links and run URLs have distinct named validators using the existing v1 HTTPS safety rules. They are not webhook destination policies. GitHub environment extraction accepts approved fields only. No event payload is read. Caller context must belong to the intended event/run before merging.

Transport responses are byte-bounded and abortable; errors expose fixed codes/status and optionally bounded, redacted problem title/detail. Success JSON is untrusted endpoint data and may contain secrets: endpoint adapters must validate and project it. Actions decide whether problem facts may appear in setFailed, result-json, events or summaries. No raw headers, request body, authorization or provider exception cause is attached to safe transport errors. Transport errors remove the inherited stack property and serialize only safe facts.

Mutation replay is forbidden after ambiguous network/timeout/429/5xx outcomes. Only an explicit 401 opt-in permits one token invalidation/replay. The policy is caller-selected, not inferred from method. Retries respect per-policy waits/deadlines and caller cancellation. Injected fetch and sleep implementations must honor AbortSignal, matching the standard runtime contract.

Public scanning covers tracked and candidate source files and package contents for known credential patterns and local paths. It cannot establish that arbitrary customer names or identifiers are absent without human review. All included fixture identifiers are explicitly synthetic. No live SAP, Sandbox or real credentials are needed for tests.
