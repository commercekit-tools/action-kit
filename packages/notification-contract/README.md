# @commercekit-tools/notification-contract

Provider-neutral NotificationEvent v1 types, schema and validation for Notify, Setup, Build, Deploy and Cleanup, with future Check/reusable-workflow consumers. It also provides pure status/summary formatting and bounded input display context. No CCv2 calls, CLI diagnostics, Action I/O, polling, provider rendering or webhook delivery.

Public exports: `NotificationEvent`, `NotificationStatus`, `NotificationEventType`, `NotificationSource`, `NotificationContext`, `NotificationLink`, `SafeNotificationError`, `CheckEventData`, `BuildEventData`, `DeploymentEventData`, `BuildCleanupEvent`, `BuildCleanupEventData`, `BuildCleanupStatus`, `BuildCleanupInputSnapshot`; `validateNotificationEvent`, `parseNotificationEventJson`, `validateNotificationLink`, `validateGitHubRunUrl`, `extractSafeGitHubContext`, `mergeProducerContext`, `mergeNotifierContext`, `createCheckEvent`, `createBuildEvent`, `createDeploymentEvent`, `createBuildCleanupEvent`, `redactKnownSecrets`, `sanitizeBoundedText`, `sanitizeLabel`, `sanitizeErrorMessage`.

```ts
import { createCheckEvent, parseNotificationEventJson } from '@commercekit-tools/notification-contract';
const event = createCheckEvent({
  status: 'success',
  data: { mode: 'full', filesChecked: 3, errors: 0, warnings: 0 },
  env: { GITHUB_REPOSITORY: 'synthetic/example', GITHUB_RUN_ID: '123' },
});
const validated = parseNotificationEventJson(JSON.stringify(event), { maxBytes: 65536 });
```

Import the JSON Schema using `@commercekit-tools/notification-contract/schema` with a JSON import attribute. Root imports include declarations. Internal paths are unsupported.

Validation combines draft 2020-12 JSON Schema, status compatibility, safe HTTPS links/run URLs and bounds. It returns typed data and throws fixed messages without echoing input. Additive v1 properties remain accepted. Factories omit unknown/raw data and validate normalized input. They generate IDs and timestamps when omitted. Timeout uses internal-error plus a safe code, not a new status.

Extraction reads only approved runner fields, never event payloads. Explicit producer context wins. Notifier merge preserves producer context and fills gaps only. Ensure enrichment belongs to the intended event/run. Factories do not sanitize arbitrary raw API responses: callers normalize text with focused primitives and retain provider markup escaping and secret masking locally.

Install from GitHub Packages after a supported version is published. Configure `@commercekit-tools:registry=https://npm.pkg.github.com`; local users need a classic PAT with `read:packages` in user-level configuration. Consumer Actions need package Actions read access and `GITHUB_TOKEN` with `packages: read`. See the repository authentication guide. Pin exact versions, never ranges.

Version `0.0.6` is a published pre-1.0 preview. Use the
[publication and consumer compatibility record](../../docs/release-status.md)
for immutable publication evidence, supported exact pins and the distinction
between source integrations and released Action interfaces. Verify future
versions before adoption; normal lockfiles must not contain machine-local links.

Independent package SemVer applies; stable breaking changes require a major increment. NotificationEvent schema version is separate from package version. Preserve current consumer contracts during migration. No telemetry or logging is performed. Use synthetic tests and register exact runtime secrets; pattern redaction cannot identify all secrets.

## Text primitives added in 0.0.3

Version 0.0.3 adds `stripAngleBracketText(value: string): string` and `redactJwtLikeTokens(value: string): string` at the public root. They are **not available in published 0.0.2**.

The first removes angle brackets and all text between each opening bracket and the next closing bracket, discarding an unclosed suffix. It neither parses HTML nor removes script text or decodes entities. The second replaces the existing Build/Deploy `eyJ`-prefixed three-segment token shape with `[REDACTED]`; it does not verify tokens or detect every credential. Both preserve unrelated characters and impose no length bound.

These are opt-in primitives: existing sanitizers/factories do not call them automatically. Consumers retain secret registration, ordering, text bounds, fallback labels and provider escaping. See the [remaining extraction audit](../../docs/remaining-extraction-audit.md) for compatibility evidence and rollout.

## Build cleanup event added in 0.0.4

`createBuildCleanupEvent` creates `ccv2.build-cleanup.completed`. Its data contains
mode, scope, retention policy, outcome, bounded counts, duration, and an optional
safe error. A successful `deletionRequestedCount` represents accepted deletion
initiation, never confirmed physical removal. Status uses the existing completed
status vocabulary. Producers must sanitize identifiers and errors before creating
an event. This additive event requires a compatible Notify renderer. Consumers using
published 0.0.3 or older reject it. Verify 0.0.4 registry availability and the
matching Notify revision before enabling this integration; a source manifest
is not publication evidence.

## Cleanup warning and input context — 0.0.5

This additive cleanup-only extension accepts the existing global `warning` status
through public `BuildCleanupStatus`; Build and Deploy continue using unchanged
`CompletedStatus`. Old cleanup events remain valid. A published 0.0.4 validator
rejects cleanup warnings, so producer and Notify revisions must be coordinated.
The 0.0.5 package was subsequently published through authorized package-only
workflow run 43667757934. That publication created no Git tag or Action release.

`BuildCleanupEventData` adds optional `inputs`, `inputsValidated`,
`inputsTruncated`, `protectedCount`, `blockedCount` and `issues` fields. If an
`inputs` snapshot is present, it must contain exactly all 14 names from the Cleanup
Action: token-endpoint, client-id, client-secret, resource, subscription-code,
api-base-url, application-code, retention-days, keep-latest, dry-run, max-deletions,
exclude-build-codes, timeout-minutes and continue-on-delete-error. No new Action
input or retention option is introduced.

The public `BuildCleanupInputSnapshot` type and schema require all four
technical-user authentication values to be the literal `[REDACTED]`; unredacted
values are rejected with a fixed error that does not echo the payload. Other
snapshot values are display strings bounded to 256 characters, allowing an
invalid supplied setting to be reported without inventing a valid effective
number. Producers set `inputsValidated=false` when execution stopped during
input validation and `inputsTruncated=true` when bounded display omitted text.
They must still redact registered secrets and credential-like text from public
settings with the shared sanitizers before calling the factory.

Counts remain nonnegative safe integers. `issues` holds at most three reusable
`SafeNotificationError` values, with code at most 100 and message 1–1000 characters.
The factory retains only code/message for each issue, dropping raw nested fields,
then validates the event. Outcome/severity interpretation belongs to the producer:
a warning must not hide a deletion failure or unknown mutation result. Accepted
deletion counts still describe initiation rather than physical removal.

## Consistent Action reporting — 0.0.6 preview

New public exports: `SetupEvent`, `SetupEventData`, `NotificationInputContext`,
`NotificationInputData`, `ActionInputDefinition`, `NotificationStyle`,
`ActionSummaryOptions`, `ActionSummarySection`, `createSetupEvent`,
`captureActionInputs`, `createActionInputContext`, `isConfidentialInputName`,
`sanitizeActionText`, `getNotificationStyle` and `renderActionSummary`.

Build, Deploy and Check data accept optional bounded input snapshots and issues.
Setup uses `commercekit.setup.completed`; completed Build/Deploy semantics are
unchanged. The shared renderer creates a bounded escaped GitHub summary string;
callers perform Action I/O and preserve operation outcomes if reporting fails.

Read the [format, masking, compatibility and rollout contract](../../docs/action-reporting.md).
The package remains one of the existing two action-kit packages. No provider
payload/delivery or OAuth/transport behavior is added here.
