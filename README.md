# CommerceKit Action Kit

Shared contracts and runtime libraries for CommerceKit GitHub Actions. This public repository is a pnpm monorepo, not a GitHub Marketplace Action. There is no root `action.yml`.

`notification-contract@0.0.6` and `ccv2-client@0.0.3` are published preview packages. APIs remain pre-1.0; pin supported exact versions. See the [publication evidence and consumer compatibility record](docs/release-status.md) for the current pins and the distinction between source integrations and released Actions. Reservation versions are unsupported placeholders.

| Package                                    | Responsibility                                                                                | Consumers                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `@commercekit-tools/notification-contract` | NotificationEvent v1 schema, semantic validation, safe context, factories and text primitives | Notify, Setup, Build, Deploy, Cleanup and integration tests; future Check/reusable workflows |
| `@commercekit-tools/ccv2-client`           | Technical-user OAuth and policy-driven Cloud Portal HTTP transport                            | Build, Deploy, Cleanup and integration tests; future CCv2 Actions                            |

The packages release independently and do not depend on each other. Notification producers need no CCv2 knowledge. Neither package depends on GitHub Actions SDKs.

```mermaid
flowchart LR
  Notify --> Contract[notification-contract]
  Setup --> Contract
  Cleanup --> Contract
  Harness[Integration tests] --> Contract
  Build --> Contract
  Deploy --> Contract
  Check[Future Check] --> Contract
  Workflows[Future reusable workflows] --> Contract
  Build --> Client[ccv2-client]
  Deploy --> Client
  Cleanup --> Client
  Harness --> Client
```

Provider rendering and delivery, Action inputs/outputs and summary writes, lifecycle state machines and endpoint-specific validation remain in consumers. See [architecture](docs/architecture.md), the original [extraction audit](docs/extraction-audit.md), and the historical [remaining extraction audit](docs/remaining-extraction-audit.md).

Installation requires GitHub Packages access, including for public packages. Configure the scope registry and credentials using [the release configuration and authentication guide](docs/github-packages.md). Verify any future version's publication before adopting it; a source manifest alone is not evidence.

Develop with Node **24.21.0** and pnpm **12.6.0**:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm quality
```

The quality suite checks formatting, lint, TypeScript, coverage, builds, installed package tarballs, public files and dependency advisories. Tests use synthetic data and injected fetch; no SAP, Sandbox or GitHub Packages calls occur in the quality suite. Dependency installation/auditing uses the public npm registry.

See [CONTRIBUTING](CONTRIBUTING.md) for individual commands, [compatibility policy](docs/compatibility-policy.md), [migration plan](docs/migration-plan.md) and [SECURITY](SECURITY.md).

Package reservation, preview/stable publication and GitHub Releases are separate manually confirmed owner workflows. Publication never runs on push or PR. [RELEASING](RELEASING.md) describes two-phase recovery and coordinated stable gates. Documentation and normal CI do not publish packages or Actions.

The manual publish workflow verifies the exact commit's CI/CodeQL results and publishes the tested tarball after an integrity check. A separate manual workflow verifies registry publication before creating a package-specific Git tag and GitHub Release. See [dispatch examples](RELEASING.md#dispatch-examples-after-merge-and-owner-approval). Tags do not trigger publication.

The [published consistent Action reporting contract](docs/action-reporting.md) adds shared
input snapshots, status styling, GitHub summary formatting and setup events.
The [compatibility record](docs/release-status.md) identifies the registry-backed
consumers and reporting enhancements that remain unreleased as Actions.
