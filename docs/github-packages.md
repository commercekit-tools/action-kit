# GitHub Packages authentication and owner setup

Packages target `https://npm.pkg.github.com`, associated with public source repository `commercekit-tools/action-kit`. A public source repository does not automatically prove the package visibility/access settings. No package is claimed published by this PR.

Repository and consumer `.npmrc`:

```ini
@commercekit-tools:registry=https://npm.pkg.github.com
```

Local contributors need a classic PAT with `read:packages` (and organization SSO authorization when required). Put authentication in **user-level** npm configuration or an ephemeral environment-managed file, never repository files. Never commit package tokens. `pnpm install` in this source workspace fetches public dependencies from npm; scope auth is only needed for installed published CommerceKit packages.

The publishing repository uses `GITHUB_TOKEN` with `packages: write`. Consumer Action repositories need package **Manage Actions access** read permission. After the owner grants access, consumer workflows can use their own `GITHUB_TOKEN`:

```yaml
permissions:
  contents: read
  packages: read
steps:
  # Include pinned checkout/setup-node steps in the consumer workflow.
  # Configure setup-node registry-url: https://npm.pkg.github.com
  - run: pnpm install --frozen-lockfile
    env:
      NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Pin exact versions only after they are published and accessible:

```json
{
  "dependencies": {
    "@commercekit-tools/notification-contract": "0.0.1",
    "@commercekit-tools/ccv2-client": "0.0.1"
  }
}
```

Install only the packages that a consumer needs; Notify and future Check do not need ccv2-client. Avoid runtime dependency ranges for bundled Actions.

Post-publication owner checklist (not performed by this task):

- Set each package visibility to **Public**.
- Confirm source repository association: `commercekit-tools/action-kit`.
- For notification-contract grant read Actions access to `commercekit-tools/notify`, `commercekit-tools/ccv2-build`, `commercekit-tools/ccv2-deploy`, and future `commercekit-tools/check` once it exists.
- For ccv2-client grant read Actions access to `commercekit-tools/ccv2-build` and `commercekit-tools/ccv2-deploy`.
- Verify exact-version installation using each consumer repository token.

The repository currently has no configured protected publication environment. Add `environment: package-publish` to the publication job after owners configure and verify its protections; manual main-only confirmations remain mandatory regardless.
