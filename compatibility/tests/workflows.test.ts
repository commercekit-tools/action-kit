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
        ? { contents: 'write', packages: 'read' }
        : { contents: 'read', packages: 'write' },
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
    'check-runs',
    '--verify-tag',
    'CHANGELOG.md',
  ])
    expect(script).toContain(value);
  expect(script).not.toMatch(/--force|npm.*publish/);
});
