# Independent package release policy

Each package has its own manifest version, changelog, dist-tags and immutable package-specific Git tags. There is no root release and no moving `v1` package tag.

| Stage       | Version            | Dist-tag   | Support                      |
| ----------- | ------------------ | ---------- | ---------------------------- |
| Reservation | `0.0.0-reserved.1` | `reserved` | Unsupported placeholder only |
| Preview     | `0.x.y-preview.n`  | `preview`  | Reviewed prerelease          |
| Stable      | `1.0.0` and later  | `latest`   | Coordinated stable support   |

Tags are `notification-contract-v<version>` and `ccv2-client-v<version>`. Notification schema version is a separate contract identifier. Breaking stable API changes require a major version bump.

Preview contract gates: current Notify schema parity, all fixtures, Notify/Build/Deploy/Check harnesses, packed install checks, public scan and full quality. Preview client gates: token/auth, safe reads, mutation safety, response variants, Build/Deploy adapters, packed installs, public scan and full quality.

Do not publish stable until consumer migration PRs merge; Notify passes with the exact preview contract; Build/Deploy pass tests and Sandbox suites with exact previews; combined build → deploy and producer event delivery to Notify pass; Check harness passes; APIs are reviewed; no known drift remains; and owner approval is recorded in the version PR. Manual workflow dispatch confirmation is the final owner attestation to those external gates, which this repository cannot prove automatically.

See RELEASING.md for dispatch confirmations and partial-failure recovery. No publication, reservation, tags or releases are triggered by CI, push, PR, schedule or release creation.
