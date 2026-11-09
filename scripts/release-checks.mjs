import { execFileSync } from 'node:child_process';
export const requiredReleaseChecks = [
  'quality',
  'cross-platform (ubuntu-24.04)',
  'cross-platform (windows-2025)',
  'cross-platform (macos-15)',
  'analyze',
  'CodeQL',
];
export function assertReleaseChecks(pages) {
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page?.check_runs)))
    throw Error('Invalid CI check evidence.');
  const checks = pages.flatMap((page) => page.check_runs);
  for (const name of requiredReleaseChecks) {
    const trustedApp = name === 'CodeQL' ? 'github-advanced-security' : 'github-actions';
    const latest = checks
      .filter((check) => check.name === name && check.app?.slug === trustedApp)
      .sort((a, b) => b.id - a.id)[0];
    if (
      !latest ||
      !Number.isSafeInteger(latest.id) ||
      latest.status !== 'completed' ||
      latest.conclusion !== 'success'
    )
      throw Error(`Required CI check missing, pending or unsuccessful: ${name}`);
  }
}
if (process.argv[1]?.endsWith('/release-checks.mjs') || process.argv[1]?.endsWith('\\release-checks.mjs')) {
  const sha = process.argv[2];
  const repository = process.env.GITHUB_REPOSITORY;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !/^[\w.-]+\/[\w.-]+$/.test(repository ?? ''))
    throw Error('Expected repository and full commit SHA for CI verification.');
  const pages = JSON.parse(
    execFileSync(
      'gh',
      ['api', '--paginate', '--slurp', `repos/${repository}/commits/${sha}/check-runs?per_page=100`],
      { encoding: 'utf8' },
    ),
  );
  assertReleaseChecks(pages);
  console.log('Required CI and CodeQL checks passed for the selected commit.');
}
