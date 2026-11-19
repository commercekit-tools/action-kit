# Consistent Action reporting

The reporting implementations in setup-commercekit, ccv2-build,
ccv2-deploy, ccv2-build-cleanup and notify share this contract
through the existing notification-contract package. No new package, authentication
implementation, provider delivery, schedule or SAP operation is introduced.

## Visual contract

| Status          | Icon | Meaning                                               |
| --------------- | ---- | ----------------------------------------------------- |
| success         | ✅   | The reported operation succeeded                      |
| failure         | ❌   | The operation failed                                  |
| warning         | ⚠️   | The producer identified an issue that needs attention |
| action-required | ⚠️   | A deployment requires an explicit decision            |
| internal-error  | ❌   | The Action could not complete its operation           |
| started         | ℹ️   | The operation started                                 |
| cancelled       | ⏹️   | The operation was cancelled                           |

`getNotificationStyle` owns labels, icons, semantic tones and accent colors.
Cancellation remains neutral. A warning never changes a failed build/deployment
into success. Build and Deploy completed-status types remain unchanged.

Cards and summaries present the operation title/status, result facts, inputs,
issues and workflow reference in that order. Provider layouts retain native
Slack blocks and Teams containers/fact sets. GitHub summaries use escaped
Markdown headings and tables. Consumers provide meaningful human labels rather
than dumping raw objects or internal property names.

`renderActionSummary` is pure. The caller writes its result through the existing
GitHub Actions summary API on handled success, failure and warning. Summary or
notification generation failure must not replace the underlying operation result.
A delivery Action reports its own delivery outcome separately from the source
event severity: successful delivery of a failed build is successful delivery.

## Safe input context

`captureActionInputs` reads configured confidential fields first and registers
each value before reading public settings. `createActionInputContext` includes
every declared input name, effective values after validation, and safely captured
supplied values when validation failed. Exact input coverage is checked against
each Action's metadata by consumer tests.

- Authentication fields, webhook URLs, credentials and secret-bearing input
  names always display `[REDACTED]`, including missing or invalid values.
- Known secrets and their encoded forms, Bearer/PAT/JWT-like values and
  credential-bearing/query URLs are redacted before bounding display values.
- Event JSON, event-file paths, traffic JSON and free-form decision/cancellation
  reasons show presence only. Arbitrary payloads are never copied into cards.
- Public API origins may be shown after strict origin validation. Authentication
  token endpoints remain fully redacted.
- Display values are bounded to 256 Unicode code points. Truncation is explicit;
  `inputsValidated` and `inputsTruncated` distinguish safe previews from execution
  configuration. Provider previews may be shorter with a visible note.
- Common snapshots permit at most 50 kebab-case names and enforce confidential
  placeholders in the schema. Cleanup's existing exact 14-name schema is retained.

The common summary renderer escapes HTML, Markdown, table separators, mentions
and newlines. It masks confidential names defensively even for a forged snapshot,
filters private links and preserves safe enterprise workflow URLs. Result tables
and decision tables are bounded to 50 rows, sections to eight, columns to eight,
links to three and the complete UTF-8 summary to 64 KiB, with an omission notice.

## Additive event support

Check, Build and Deploy data gain optional input-context and safe issue fields;
old payloads remain valid. Setup gains `commercekit.setup.completed`, public
`SetupEvent`/`SetupEventData` types and `createSetupEvent`. It records requested and
resolved version, target, build ID, cache result, duration and safe failure detail.
It does not expose executable paths or invent warnings for a cache hit.

The package contains no CLI execution, Action I/O or provider renderer. Factories
project known event fields and validate; callers retain endpoint-specific result
projection and register tokens with their existing masker.

## Release and validation provenance

These helpers are available in published notification-contract 0.0.6. Use normal
exact registry dependencies, not private candidate tarballs or machine-local
links. The [publication and consumer compatibility record](release-status.md)
owns the successful publication evidence, reviewed source pins and separate
Action release status. Setup's released v1 interface does not yet contain the
reporting output present on main.

The original source-candidate baseline table, test totals and packed replay
procedure remain archived in the
[immutable pre-publication report](https://github.com/commercekit-tools/action-kit/blob/3fecce40414d709884fa48e48eca278f470b20b0/docs/action-reporting.md#provenance-and-rollout-gate).
Those historical results do not replace current consumer validation or prove
live provider delivery, real SAP behavior or coordinated stable readiness.

Independent privacy review found and reproduced two gaps before publication:
known secrets encoded with lowercase/mixed-case percent hex, and Slack webhook
hosts using a trailing DNS dot. Regression tests now cover raw/URL/form encodings
with literal case preserved, forged cross-field snapshots, and case/encoded-host/
trailing-dot webhook variants in values and links. The existing shared redactor
and display policy were corrected without changing OAuth or transport.
