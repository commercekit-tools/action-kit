# Owner release procedure

Nothing is published by a feature PR or ordinary CI. Package versions are immutable. Never force, delete, overwrite or republish a version. All workflows run from main and use GITHUB_TOKEN; review the selected commit, changelog and external gates first.

1. Merge implementation PR after approval.
2. Verify main CI and CodeQL.
3. Optionally dispatch `reserve-package-names` with confirmation `RESERVE-COMMERCEKIT-PACKAGES`. It publishes only temporary unsupported `0.0.0-reserved.1` packages under `reserved`, never source implementations or `preview`/`latest`. Both versions are checked absent before publishing. If one succeeds and the second fails, stop for owner review rather than bypassing immutability checks.
4. Configure public visibility, repository association and Actions read access as documented in `docs/github-packages.md`.
5. Prepare a selected-package version/changelog PR. Source manifests currently express intended `0.1.0-preview.1`, not publication evidence.
6. Merge the reviewed version PR.
7. Dispatch `publish-package`: package `notification-contract` or `ccv2-client`, channel `preview` or `stable`, exact confirmation `PUBLISH-COMMERCEKIT-PREVIEW` or `PUBLISH-COMMERCEKIT-STABLE`. Preview requires `0.x.y-preview.n`; stable requires 1.0.0 or later without prerelease. The workflow checks version absence, full quality, selected pack/install, metadata and clean generated files before publishing exactly one package with `preview` or `latest`.
8. Verify the exact package version in GitHub Packages and its visibility/access.
9. Dispatch `create-package-release`: package, exact version, optional full `commit-sha` (defaults to current main), confirmation `CREATE-COMMERCEKIT-PACKAGE-RELEASE`. It verifies registry presence, committed manifest, main ancestry, successful CI/CodeQL checks, no existing tag/release, installed public exports and selected changelog before creating an annotated package-specific tag and GitHub Release. Prereleases are marked prerelease. No tarballs are attached.
10. Verify tag and Release point to the reviewed commit.
11. Install the exact version in compatibility harnesses/consumer migration branches.
12. Migrate consumers through focused PRs.
13. Run coordinated tests, Sandbox suites and build → deploy → notify.
14. Promote stable only after all gates in `docs/package-release-policy.md` and recorded owner approval.

Publication and GitHub Release creation are deliberately separate. If publication succeeds and release validation fails, **do not republish**: correct the cause and rerun only create-package-release against the same version/commit. If tag push succeeded but GitHub Release creation failed, the workflow deliberately stops on the existing tag: an owner must inspect the tag target and finish only the missing Release using reviewed notes, without moving/deleting the immutable tag. If a Release exists without the registry version, treat it as a process defect requiring owner review; never silently publish a different version.

The release workflow fails closed if required CI check evidence is unavailable. Owners should fix access/check evidence rather than bypassing it. Concurrency serializes publication and release operations; no moving major tags are used. Package changelogs are independent; schema version remains independent of package SemVer. Package access settings and stable integration gates require owner work outside this repository.
