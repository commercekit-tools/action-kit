# @commercekit-tools/notification-contract

Provider-neutral NotificationEvent v1 types, schema and validation for Notify, Build, Deploy, future Check and reusable workflows. No CCv2 calls, CLI diagnostics, Action I/O, polling, provider rendering or webhook delivery.

Public exports: `NotificationEvent`, `NotificationStatus`, `NotificationEventType`, `NotificationSource`, `NotificationContext`, `NotificationLink`, `SafeNotificationError`, `CheckEventData`, `BuildEventData`, `DeploymentEventData`; `validateNotificationEvent`, `parseNotificationEventJson`, `validateNotificationLink`, `validateGitHubRunUrl`, `extractSafeGitHubContext`, `mergeProducerContext`, `mergeNotifierContext`, `createCheckEvent`, `createBuildEvent`, `createDeploymentEvent`, `redactKnownSecrets`, `sanitizeBoundedText`, `sanitizeLabel`, `sanitizeErrorMessage`.

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

Current release: source version `0.0.2`, an initial pre-1.0 integration release under the `preview` dist-tag. Verify registry availability before installation and pin `0.0.2` exactly. Stable API and coordinated consumer/Sandbox validation remain future gates. Reservation versions are unsupported.

Independent package SemVer applies; stable breaking changes require a major increment. NotificationEvent schema version is separate from package version. Preserve current consumer contracts during migration. No telemetry or logging is performed. Use synthetic tests and register exact runtime secrets; pattern redaction cannot identify all secrets.
