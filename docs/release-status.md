# Published packages and consumer compatibility

Verified on 2026-11-18. This is the current package-publication and consumer-pin
record. Source manifest versions alone are not publication evidence. Package
SemVer, NotificationEvent schema version 1, and Action release tags are separate
contracts.

## Published preview packages

| Package                                    | Supported exact version | Publication evidence                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@commercekit-tools/notification-contract` | `0.0.6`                 | Successful owner-authorized [package-only publication run 43678067818](https://github.com/commercekit-tools/action-kit/actions/runs/43678067818), from [source `3fecce4`](https://github.com/commercekit-tools/action-kit/commit/3fecce40414d709884fa48e48eca278f470b20b0) |
| `@commercekit-tools/ccv2-client`           | `0.0.3`                 | Existing [package prerelease and source reference](https://github.com/commercekit-tools/action-kit/releases/tag/ccv2-client-v0.0.3); this package did not change in the reporting publication                                                                              |

Both packages remain pre-1.0 previews. Notification-contract 0.0.6 supplies the
shared input context, status styling, pure summary formatter and setup event.
The older 0.0.5 package lacks those additions. The 0.0.6 publication was
package-only: it did not create an Action tag, Action release, Marketplace
listing or deployment. A package-specific GitHub Release is a separate owner
operation; its absence does not make an already published registry version
unpublished.

The publication source above is immutable provenance. Later documentation or
development-tool changes do not replace that artifact or permit republishing
the same version. Repository documentation updates do not change the README
inside an existing registry tarball.

## Consumer pins

These immutable manifest links record the reviewed source pins, independently
of an Action's released interface. Users of a bundled Action need no registry
credentials; repositories installing these packages for development or CI need
package read access.

| Consumer manifest                                                                                                                                    | notification-contract | ccv2-client | Availability of this integration                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | ----------- | ----------------------------------------------------------------- |
| [Notify](https://github.com/commercekit-tools/notify/blob/c630d1e4c6173a38c818fac3ab80137b79ddad3d/package.json)                                     | `0.0.6`               | —           | Unreleased Action source                                          |
| [Setup CommerceKit](https://github.com/commercekit-tools/setup-commercekit/blob/a2e9f3784c7d3dca4402aee62707a9eb0124ab7b/package.json)               | `0.0.6`               | —           | Reporting enhancement in main; released interface described below |
| [CCv2 Build](https://github.com/commercekit-tools/ccv2-build/blob/1934cf85b3655f571ca5b335e90d8d5f93d397a3/package.json)                             | `0.0.6`               | `0.0.3`     | Unreleased Action source                                          |
| [CCv2 Deploy](https://github.com/commercekit-tools/ccv2-deploy/blob/5a9b9e348ff11294affcbbd6409abd98400b1473/package.json)                           | `0.0.6`               | `0.0.3`     | Unreleased Action source                                          |
| [CCv2 Build Cleanup](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/8b1786b731be8d2d3fac137cd358d2ee5488bd58/package.json)             | `0.0.6`               | `0.0.3`     | Unreleased Action source; real SAP apply remains blocked          |
| [Action integration tests](https://github.com/commercekit-tools/action-integration-tests/blob/1174dd82b4a8c4f049e234d1862387b56571c0b0/package.json) | `0.0.6`               | `0.0.3`     | Integration harness, not a distributable Action                   |

Grant `notification-contract` read access to all six repositories above and
`ccv2-client` read access to Build, Deploy, Cleanup and the integration harness.
Check remains a future Action consumer; its private synthetic compatibility
harness does not create a Check repository or release. General-purpose reusable
workflows also remain future consumers.

### Released Setup interface and main reporting

Setup's existing `v1` and `v1.0.0` tags resolve to
[`dffa026`](https://github.com/commercekit-tools/setup-commercekit/blob/dffa026980479cf96d7a5f4763602d39a7325a7c/action.yml).
That released metadata has no `notification-event` output. Main's
[reporting metadata](https://github.com/commercekit-tools/setup-commercekit/blob/a2e9f3784c7d3dca4402aee62707a9eb0124ab7b/action.yml)
adds it using notification-contract 0.0.6. Document that enhancement as unreleased
until a separately approved Action release includes it; installing a package or
merging source does not change an existing Action tag.

## Remaining gates and maintenance

Normal registry installation and the source pins above resolve the former
candidate-publication dependency. They do not prove live provider delivery,
real SAP behavior or the coordinated stable-release gates. Follow the existing
[stable policy](package-release-policy.md), consumer verification runbooks and
owner approvals. In particular, preserve Cleanup's
[production eligibility and operational-protection gates](https://github.com/commercekit-tools/ccv2-build-cleanup/blob/8b1786b731be8d2d3fac137cd358d2ee5488bd58/docs/release-readiness.md#remaining-gates-before-an-action-release-or-real-apply).

Update this record when supported package versions, consumer pins or released
interfaces change, using successful publication evidence and reviewed immutable
consumer references. Keep original extraction/candidate baselines as historical
provenance. Do not copy their old publication blockers into current setup
instructions or infer readiness from a manifest version alone.
