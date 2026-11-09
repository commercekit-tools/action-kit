# Independent package release policy

Each package has its own manifest version, changelog, dist-tags and immutable package-specific Git tags. There is no root release and no moving `v1` package tag.

| Stage       | Version                                       | Dist-tag   | Support                      |
| ----------- | --------------------------------------------- | ---------- | ---------------------------- |
| Reservation | `0.0.0-reserved.1`                            | `reserved` | Unsupported placeholder only |
| Preview     | `0.x.y` (except `0.0.0`) or `0.x.y-preview.n` | `preview`  | Reviewed prerelease          |
| Stable      | `1.0.0` and later                             | `latest`   | Coordinated stable support   |

Tags are `notification-contract-v<version>` and `ccv2-client-v<version>`. Notification schema version is a separate contract identifier. Breaking stable API changes require a major version bump.

Preview contract gates: current Notify schema parity, all fixtures, Notify/Build/Deploy/Check harnesses, packed install checks, public scan and full quality. Preview client gates: token/auth, safe reads, mutation safety, response variants, Build/Deploy adapters, packed installs, public scan and full quality.

Do not publish stable until consumer migration PRs merge; Notify passes with the exact preview contract; Build/Deploy pass tests and Sandbox suites with exact previews; combined build → deploy and producer event delivery to Notify pass; Check harness passes; APIs are reviewed; no known drift remains; and owner approval is recorded in the version PR. Manual workflow dispatch confirmation is the final owner attestation to those external gates, which this repository cannot prove automatically.

See RELEASING.md for dispatch confirmations and partial-failure recovery. No publication, reservation, tags or releases are triggered by CI, push, PR, schedule or release creation.

Publication requires successful quality, three platform checks and CodeQL analysis for the exact commit. The newest check from the expected official app (GitHub Actions for CI/analysis; GitHub Advanced Security for the CodeQL result) must be completed successfully; an older green run cannot override a failed or pending rerun. Check evidence is paginated and validation fails closed.

The selected tarball is built, content-scanned, installed, imported and typechecked before it is retained. The publish step verifies its SHA-256 and publishes that same tarball with lifecycle scripts disabled. Normal `pnpm pack:check` still cleans every temporary file. Optional `pnpm pack:check <package> --output-directory <absolute-directory>` retains one tested tarball for owner inspection or the manual publication workflow; retained files belong outside the repository and must never be committed.

The owner-requested first integration release is `0.0.1` for both packages. It uses the preview publication channel and `preview` dist-tag even though the version has no SemVer prerelease suffix. Its GitHub Releases are marked prerelease. This permits exact-version consumer adoption without claiming the coordinated stable/1.0 gates have passed. The stable channel remains restricted to 1.0.0 and later.

Main-branch releases require the exact commit's completed CodeQL analysis from `.github/workflows/codeql.yml:analyze`, with no scan errors/warnings and no open CodeQL alerts on main. The PR-only GitHub Advanced Security check is validated when present, but its absence on main does not replace this direct analysis evidence. Publication and Release jobs receive `security-events: read` for these read-only API checks.
