# ccv2-client changelog

## Unreleased

Add `encodeCcv2PathSegment` for the existing Build/Deploy raw identifier policy, with fixed non-disclosing errors and a distinct `INVALID_PATH_ENCODING` code for malformed Unicode so Action adapters can preserve existing diagnostics. Existing URL validators and request policies are unchanged. These exports are not available in published 0.0.2; a new package release and separate consumer migrations are required.

## 0.0.2

Maintenance release following Dependabot updates to globals 17.14.0 and @types/node 26.6.6 (including undici-types 8.9.0). Refresh dependency notices and release metadata. Runtime JavaScript, declarations and the NotificationEvent v1 schema are unchanged; validation continues on Node 24.21.0. Includes the verified package Release pagination fix in repository tooling.

Distributed under the `preview` dist-tag for exact-version consumer integration; pre-1.0 API status is unchanged.

## 0.0.1

Initial technical-user OAuth, memory-only token management, explicit safe-read/unsafe-mutation policies and bounded JSON/empty/binary HTTP transport.

Initial pre-1.0 release for exact-version integration by CommerceKit Actions. Distributed under the `preview` npm dist-tag and marked as a GitHub prerelease; no stable API guarantee is made. Synthetic compatibility adapters, public scanning and installed-tarball tests pass. Consumer migrations and coordinated Sandbox gates remain separate work.
