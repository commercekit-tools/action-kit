# Consistent Action reporting candidate

The five release-candidate Actions are setup-commercekit, ccv2-build,
ccv2-deploy, ccv2-build-cleanup and notify. They share this reporting contract
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

## Provenance and rollout gate

Source prepares **0.0.6**, an unpublished candidate. Registry-backed baseline
0.0.5 is published; it lacks these shared helpers and the setup event. Existing
source baselines inspected for this change:

| Repository               | Main inspected                             |
| ------------------------ | ------------------------------------------ |
| action-kit               | `7cc2e8e6af46e7438064cc6205b22f4f7154eb94` |
| notify                   | `6331ff4a60956a3a2b546e84d737c9338ca46bda` |
| setup-commercekit        | `7f650f3162ab027bfd784cf879832f44d3248584` |
| ccv2-build               | `923535d589bd8cebece4f3cbf479608f9535c4c3` |
| ccv2-deploy              | `bb6d1d6a2ac43a5b6e5b6831c78c5cf28bdb95ca` |
| ccv2-build-cleanup       | `9b7ab34515a2fb8ed643f786f754e44e485868d2` |
| action-integration-tests | `e6cefd75d5a926ca2232ac06f332e5b4394a09b5` |

Candidate consumers must use the exact-source packed tarball only in isolated
private integration workspaces, recording source commits, tarball integrity and
bundle hashes. Normal registry dependencies/lockfiles must never pretend that
0.0.6 is published or contain developer-local links. Consumer readiness remains
**BLOCKED** until a separately authorized publication, exact registry repinning,
normal bundle regeneration and green validation. Publication and source merge
do not authorize release tags, deployment, provider sends or real SAP deletion.

## Validation

The additive contract suite passes **394 tests in 12 files** on Node 24.21.0
and pnpm 12.6.0. Notification-contract coverage is **100% statements, 99.64%
branches, 100% functions and 100% lines**. All existing 95% thresholds remain
unchanged, including the untouched CCv2 client package. Focused tests cover every
new status, confidential-first capture, all-input previews, forged snapshots,
malformed Unicode secrets, schema/type compatibility, private links, Markdown/
HTML escaping, explicit truncation and the UTF-8 summary cap.

Packed ESM, JSON schema, declarations and public export boundaries are exercised
with installed temporary consumers. Full quality, public scanning and audit must
pass before the exact-source tarball is retained for final consumer replay.
Candidate consumer totals and exact artifact/source/bundle fingerprints are
recorded separately; WIP artifact success is not final registry readiness.

Independent privacy review found and reproduced two gaps before publication:
known secrets encoded with lowercase/mixed-case percent hex, and Slack webhook
hosts using a trailing DNS dot. Regression tests now cover raw/URL/form encodings
with literal case preserved, forged cross-field snapshots, and case/encoded-host/
trailing-dot webhook variants in values and links. The existing shared redactor
and display policy were corrected without changing OAuth or transport.
