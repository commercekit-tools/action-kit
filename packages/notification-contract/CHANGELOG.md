# notification-contract changelog

## 0.0.5 — unpublished candidate

Allow the existing `warning` status specifically for build cleanup through new
public `BuildCleanupStatus`, preserving Build/Deploy `CompletedStatus` semantics.
Add optional, bounded all-input display context (`BuildCleanupInputSnapshot`),
validation/truncation flags, protected/blocked counts and safe issue explanations.
All fourteen snapshot keys are required when supplied; authentication values must
be literal `[REDACTED]`, public values are at most 256 characters, and at most three
safe issues are accepted. Issue factories project only safe code/message fields.
Old cleanup events remain valid and existing event meanings are unchanged.

Registry checks found published 0.0.4 and no 0.0.5. This source version is not a
published registry dependency. Consumers require coordinated source/tarball tests
and separately authorized publication before normal exact-version adoption.
No OAuth/transport, provider delivery, package publication or release change.

## 0.0.4

Add the provider-neutral `ccv2.build-cleanup.completed` event, `BuildCleanupEvent`/`BuildCleanupEventData` public types, shared schema validation and `createBuildCleanupEvent` factory. Cleanup data reports dry-run/apply mode, exact scope, combined retention settings, bounded outcome counts and duration using the existing completed-status vocabulary. Accepted deletion requests are distinct from physical removal. Existing events, schema version 1, sanitizers and factory semantics are preserved.

Prepared for exact-version preview integration with Notify; the consumer must use a compatible cleanup renderer. Package publication is separate from tags/GitHub Releases and does not authorize SAP deletion. Packed-install validation now exercises cleanup imports, validation and declarations through public exports.

## 0.0.3

Add opt-in `stripAngleBracketText` and `redactJwtLikeTokens` primitives extracted from Build/Deploy. JWT-shaped redaction uses a linear word-run scan to avoid the copied regex's quadratic behavior on repeated prefixes. Existing sanitizers, redaction order, event factories and schema are unchanged. Prepared for preview publication; consumer migrations must verify registry availability before installation.

## 0.0.2

Maintenance release following Dependabot updates to globals 17.14.0 and @types/node 26.6.6 (including undici-types 8.9.0). Refresh dependency notices and release metadata. Runtime JavaScript, declarations and the NotificationEvent v1 schema are unchanged; validation continues on Node 24.21.0. Includes the verified package Release pagination fix in repository tooling.

Distributed under the `preview` dist-tag for exact-version consumer integration; pre-1.0 API status is unchanged.

## 0.0.1

Initial NotificationEvent v1 schema, exact types, semantic validation, safe context merge, event factories and sanitization primitives.

Initial pre-1.0 release for exact-version integration by CommerceKit Actions. Distributed under the `preview` npm dist-tag and marked as a GitHub prerelease; no stable API guarantee is made. Synthetic compatibility adapters, public scanning and installed-tarball tests pass. Consumer migrations and coordinated Sandbox gates remain separate work.
