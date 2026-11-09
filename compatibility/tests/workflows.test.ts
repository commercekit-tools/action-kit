import { it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'yaml';
const workflow = (name: string) => parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'));
it('all external actions pinned; no artifacts, PR target or non-token secrets', () => {
  for (const file of readdirSync('.github/workflows')) {
    const text = readFileSync(`.github/workflows/${file}`, 'utf8');
    expect(text).not.toMatch(/pull_request_target|upload-artifact|--force|delete-package/);
    for (const match of text.matchAll(/uses:\s*(\S+)/g))
      expect(match[1]).toMatch(/^[\w-]+\/[\w/-]+@[a-f0-9]{40}$/);
    for (const match of text.matchAll(/secrets\.(\w+)/g)) expect(match[1]).toBe('GITHUB_TOKEN');
  }
});
it('CI is read-only and never publishes', () => {
  const ci = workflow('ci');
  expect(ci.permissions).toEqual({ contents: 'read' });
  expect(Object.keys(ci.on)).toEqual(['pull_request', 'push', 'workflow_dispatch']);
  expect(JSON.stringify(ci)).not.toMatch(/packages.*write|npm publish/);
});
for (const name of ['reserve-package-names', 'publish-package', 'create-package-release'])
  it(name + ' is manually guarded with least permissions', () => {
    const w = workflow(name);
    expect(Object.keys(w.on)).toEqual(['workflow_dispatch']);
    expect(w.concurrency['cancel-in-progress']).toBe(false);
    expect(w.permissions).toEqual(
      name === 'create-package-release'
        ? { contents: 'write', packages: 'read', checks: 'read' }
        : { contents: 'read', packages: 'write', ...(name === 'publish-package' ? { checks: 'read' } : {}) },
    );
    expect(JSON.stringify(w.jobs)).toContain('refs/heads/main');
  });
it('reservation only uses reserved tag and exact confirmation', () => {
  const w = workflow('reserve-package-names');
  const text = JSON.stringify(w);
  expect(text).toContain('RESERVE-COMMERCEKIT-PACKAGES');
  expect(text.match(/--tag reserved/g)).toHaveLength(2);
  expect(text).not.toMatch(/--tag (?:preview|latest)|git tag|gh release/);
});
it('publication fixes choices and guards quality/pack checks', () => {
  const w = workflow('publish-package');
  expect(w.on.workflow_dispatch.inputs.package.options).toEqual(['notification-contract', 'ccv2-client']);
  expect(w.on.workflow_dispatch.inputs.channel.options).toEqual(['preview', 'stable']);
  const text = readFileSync('.github/workflows/publish-package.yml', 'utf8');
  for (const value of [
    'PUBLISH-COMMERCEKIT-PREVIEW',
    'PUBLISH-COMMERCEKIT-STABLE',
    'pnpm quality',
    'pnpm pack:check',
    'verify-registry-version',
    'git status --porcelain',
  ])
    expect(text).toContain(value);
  expect(text).not.toMatch(/git tag|gh release/);
});
it('release uses package-specific immutable tags and registry verification', () => {
  const w = workflow('create-package-release');
  expect(JSON.stringify(w)).toContain('CREATE-COMMERCEKIT-PACKAGE-RELEASE');
  const script = readFileSync('scripts/create-package-release.mjs', 'utf8');
  for (const value of [
    '${name}-v${version}',
    'verify-registry-version',
    'merge-base',
    'release-checks.mjs',
    '--verify-tag',
    'CHANGELOG.md',
  ])
    expect(script).toContain(value);
  expect(script).not.toMatch(/--force|npm.*publish/);
});

it('publication gates the exact commit and publishes only the tested tarball', () => {
  const steps = workflow('publish-package').jobs.publish.steps;
  const checkIndex = steps.findIndex((s: { run?: string }) =>
    s.run?.includes('scripts/release-checks.mjs "$GITHUB_SHA"'),
  );
  const packIndex = steps.findIndex((s: { id?: string }) => s.id === 'packed');
  const publishIndex = steps.findIndex((s: { run?: string }) => s.run?.includes('npm publish'));
  expect(checkIndex).toBeGreaterThan(-1);
  expect(packIndex).toBeGreaterThan(checkIndex);
  expect(publishIndex).toBeGreaterThan(packIndex);
  expect(steps[packIndex].run).toContain('--output-directory "$RUNNER_TEMP/commercekit-publication"');
  expect(steps[publishIndex].env.TARBALL).toBe('${{ steps.packed.outputs.tarball }}');
  expect(steps[publishIndex].run).toContain('sha256sum --check --status');
  expect(steps[publishIndex].run).toContain('npm publish "$TARBALL" --ignore-scripts');
});
it('registry workflows disable automatic package-manager caching', () => {
  for (const name of ['publish-package', 'create-package-release', 'reserve-package-names']) {
    const job = Object.values(workflow(name).jobs)[0] as {
      steps: Array<{ uses?: string; with?: Record<string, unknown> }>;
    };
    const setup = job.steps.find((s) => s.uses?.startsWith('actions/setup-node@'))!;
    expect(setup.with?.['package-manager-cache']).toBe(false);
  }
});

it('marks zero-major package GitHub Releases as prereleases', () => {
  const script = readFileSync('scripts/create-package-release.mjs', 'utf8');
  expect(script).toContain("version.startsWith('0.') || version.includes('-')");
});
