# Contributing

Use Node 24.21.0 and pnpm 12.6.0; enable Corepack, then `pnpm install --frozen-lockfile`.

```sh
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
pnpm pack:check
pnpm scan:public
pnpm audit
pnpm quality
```

Quality is the complete pre-push gate and never publishes, creates tags/releases, contacts GitHub Packages/SAP/Sandbox, or modifies consumers. Tarball tests use temporary installed ESM consumers, compile declarations and remove temporary directories. Keep every package above 95% statements, branches, functions and lines. Review error, credential, URL and mutation safety branches carefully.

Changes to public exports require compatibility/type tests and selected-package changelog notes. Preserve schema v1 semantics and additive compatibility. If changing the canonical schema JSON, regenerate the embedded schema module and verify parity; document a deliberate compatibility decision before any expansion. Update synthetic fixtures and baseline provenance when consumers advance. Never copy a full Action into a harness.

Use synthetic values only: no real secrets, subscriptions, customer names or live SAP calls. Keep generated dist, coverage, tarballs, local auth and IDE files out of commits. Inspect staged files and run `git diff --check` before each commit. Publication is a separate manual owner workflow; no automatic publishing or consumer migration belongs in foundation changes.
