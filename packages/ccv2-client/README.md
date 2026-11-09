# @commercekit-tools/ccv2-client

Framework-independent technical-user OAuth and safe Cloud Portal HTTP transport. No build/deployment operations, status models, polling, preflight, decisions, cancellation, traffic split, notifications, Action I/O or summaries.

Public exports include `TechnicalUserTokenManager`, `createCcv2Client`, `validateTechnicalUserTokenEndpoint`, `validateManagementApiBaseUrl`, `parseRetryAfter`, `exponentialBackoff`, `parseProblemResponse`, `redactTransportText`, `Ccv2TransportError` and types `TechnicalUserCredentials`, `TokenResponse`, `RuntimeDependencies`, `TokenProvider`, `Ccv2Client`, `RequestPolicy`, `Ccv2RequestOptions`, `Ccv2Response`, `Ccv2ResponseBody`, `Ccv2Problem`, `RetryOptions`, `TransportErrorCode`. Only root and package metadata exports are supported.

```ts
import { TechnicalUserTokenManager, createCcv2Client } from '@commercekit-tools/ccv2-client';
// Obtain credentials from the host runtime; never hardcode or print them.
export async function readPortal(credentials: ConstructorParameters<typeof TechnicalUserTokenManager>[0]) {
  const tokens = new TechnicalUserTokenManager(credentials, {
    runtime: {
      maskSecret: (value) => {
        /* register with host secret masker */ void value;
      },
    },
  });
  const client = createCcv2Client({
    baseUrl: 'https://synthetic.example/api/',
    tokens,
    secrets: Object.values(credentials),
  });
  return client.request('synthetic-path', { policy: 'safe-read', refreshOn401: true });
}
```

Tokens use form client_credentials with resource, memory-only cache, proactive expiry margin (default up to 60s, limited to 10% of lifetime), explicit invalidation and optional one 401 replay. Missing expiry caches until invalidation/401. Mask credentials and tokens through injected callbacks. Never serialize token responses.

Every request requires `token`, `safe-read` or `unsafe-mutation`. Token/safe-read default to 3 transient attempts; unsafe mutation never repeats timeout/network/429/5xx. Caller opt-in `refreshOn401` permits exactly one explicit 401 invalidation/replay. Method does not select safety. Bodies must be strings or bytes. Consumers classify ambiguous mutations and validate endpoint-specific response shapes/statuses.

Responses are `{kind:'json',value:unknown}`, `{kind:'empty'}` or `{kind:'binary',value:Uint8Array,contentType?}`. JSON supports arrays and primitives; empty 202/204 is valid. Content type controls JSON parsing. Default bound is 256 KiB; timeout 30s. Caller signal, timeout, absolute epoch-ms deadline, retry attempts/delays/Retry-After cap are configurable. `parseRetryAfter` supports integer seconds and HTTP dates, bounded by an optional caller cap. Default backoff is exponential with up to 250ms injected jitter and a 30s backoff cap; Retry-After is constrained separately and deadlines fail instead of shortening required waits.

HTTP error replies discard raw bodies and expose status plus optional redacted bounded problem facts. Actions decide whether to show title/detail. Safe transport errors serialize only code/status/problem; the inherited stack property is removed. Success bodies remain untrusted and must be projected by consumers. HTTPS, no credentials/query/fragment and blocked redirects apply; management bases normalize trailing slash. Endpoints must be trusted configuration, not arbitrary user URLs.

Inject fetch, clock, abortable sleep, random and secret masking through `runtime`; defaults use standard Node APIs. Injected implementations must honor AbortSignal. No filesystem credential storage exists.

Install from GitHub Packages after a supported version is published. Configure `@commercekit-tools:registry=https://npm.pkg.github.com`; local users need a classic PAT with `read:packages` in user-level configuration. Consumer Actions need package Actions read access and `GITHUB_TOKEN` with `packages: read`. See the repository authentication guide. Pin exact versions, never ranges.

Current release: source version `0.0.1`, an initial pre-1.0 integration release under the `preview` dist-tag. Verify registry availability before installation and pin `0.0.1` exactly. Stable API and coordinated consumer/Sandbox validation remain future gates. Reservation versions are unsupported.

Independent package SemVer applies; stable breaking changes require a major increment. NotificationEvent schema version is separate from package version. Preserve current consumer contracts during migration. No telemetry or logging is performed. Use synthetic tests and register exact runtime secrets; pattern redaction cannot identify all secrets.
