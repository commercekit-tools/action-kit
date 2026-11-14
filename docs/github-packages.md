# GitHub Packages authentication and owner setup

This is the configuration checklist for future package releases and consumer updates. The release sequence, dispatch confirmations and recovery steps live in [RELEASING.md](../RELEASING.md).

Packages use `https://npm.pkg.github.com` and are associated with public source repository `commercekit-tools/action-kit`. Source visibility does not prove package visibility, access or publication. The current source prepares `0.0.3`; verify registry availability before consumer installation.

## Publishing repository

Enable GitHub Actions and allow the pinned actions used by this repository, including CodeQL. Repository and organization policies must allow the permissions declared in the workflows:

| Workflow                     | `contents` | `packages` | `checks` | `security-events` |
| ---------------------------- | ---------- | ---------- | -------- | ----------------- |
| `publish-package.yml`        | read       | write      | read     | read              |
| `create-package-release.yml` | write      | read       | read     | read              |
| `reserve-package-names.yml`  | read       | write      | —        | —                 |

**No custom Actions secret is required for package publication or GitHub Release creation.** GitHub supplies `secrets.GITHUB_TOKEN` automatically for each workflow run. The workflows pass it as `NODE_AUTH_TOKEN` for GitHub Packages and `GH_TOKEN` for GitHub API operations where needed. Do not create or commit a replacement token, SAP credentials or notification webhook secrets for package release jobs. Consumer Sandbox/provider tests have their own configuration in the consumer repositories.

Both release workflows require dispatch from `main`. Before publication, the exact main commit must have successful `quality`, all three `cross-platform` checks and `analyze`, plus a complete main CodeQL analysis without errors, warnings or open alerts. A green feature-branch run cannot satisfy the main analysis requirement. Fix missing permissions or check evidence instead of bypassing the release gates. Action Kit is public; if its visibility changes, re-evaluate CodeQL availability before configuring releases.

No protected publication environment is currently attached to the jobs. If owners choose to add one, configure its protections first, then review a workflow change attaching that environment; creating an environment alone does not protect these workflows. Manual confirmations remain required.

## Package access

For each package, open its GitHub Packages settings and verify the following after first publication and before subsequent consumer updates:

- Visibility is **Public** and the associated source repository is `commercekit-tools/action-kit`.
- The publishing repository has package write access, through inherited repository access or explicit **Manage Actions access**.
- Consumer repositories have **Read** permission under **Manage Actions access** as listed below.

| Package                 | Consumer repositories                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| `notification-contract` | `commercekit-tools/notify`, `commercekit-tools/ccv2-build`, `commercekit-tools/ccv2-deploy` |
| `ccv2-client`           | `commercekit-tools/ccv2-build`, `commercekit-tools/ccv2-deploy`                             |

Grant the future Check repository contract access only when that repository exists and needs installation. Verify exact-version installation using each consumer repository's own workflow token; successful installation with an owner's local token does not verify Actions access.

## Consumer CI

Keep the scope registry in the source-controlled `.npmrc`, without credentials:

```ini
@commercekit-tools:registry=https://npm.pkg.github.com
```

Consumer workflows use their own automatic `GITHUB_TOKEN` after the package access grants above. Preserve the consumer's pinned checkout/setup-node actions and configure setup-node with `registry-url: https://npm.pkg.github.com` and `scope: '@commercekit-tools'`. The relevant job permissions and install step are:

```yaml
permissions:
  contents: read
  packages: read
steps:
  # Existing pinned checkout/setup-node steps configure the registry above.
  - run: corepack enable
  - run: pnpm install --frozen-lockfile
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Pin exact versions only after they are published and accessible. For the prepared release, Notify needs `@commercekit-tools/notification-contract` at `0.0.3`; Build and Deploy need both packages at `0.0.3`. Regenerate and commit each consumer's lockfile and standalone Action bundle using its documented commands, then run its complete quality gate before pushing. Avoid dependency ranges, local links, git dependencies or copied library source in released Actions.

Users running an already bundled Action do not need package registry credentials. Package authentication is needed when installing dependencies to develop or rebuild it.

## Local contributors

GitHub Packages installation requires authentication, including for public packages. Use a classic personal access token with `read:packages`, authorized for organization SSO when required. Store authentication in **user-level** npm configuration or an ephemeral environment-managed file; never in a repository. Configure registry authentication there to reference `NODE_AUTH_TOKEN` rather than storing the token value. Use `npm config get userconfig` to confirm the selected file, especially when an IDE overrides it; do not print authentication settings.

Supply `NODE_AUTH_TOKEN` through the local credential manager or secret environment, and do not print it. This token is for package installation; normal releases use the workflows above. Running `pnpm install` in the Action Kit source workspace fetches public dependencies from npm and does not require package credentials. An authenticated `gh` session with repository workflow access is needed only when dispatching or inspecting workflows from the command line.
