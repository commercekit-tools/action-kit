import { execFileSync } from 'node:child_process';
export const requiredReleaseChecks = [
  'quality',
  'cross-platform (ubuntu-24.04)',
  'cross-platform (windows-2025)',
  'cross-platform (macos-15)',
  'analyze',
];
export function assertReleaseChecks(pages) {
  if (!Array.isArray(pages) || pages.some((page) => !Array.isArray(page?.check_runs)))
    throw Error('Invalid CI check evidence.');
  const checks = pages.flatMap((page) => page.check_runs);
  for (const name of requiredReleaseChecks) {
    const trustedApp = 'github-actions';
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
  // GitHub emits this security-app check for PRs, but not necessarily for main.
  const securityChecks = checks.filter((check) => check.name === 'CodeQL');
  if (securityChecks.length) {
    const latest = securityChecks
      .filter((check) => check.app?.slug === 'github-advanced-security')
      .sort((a, b) => b.id - a.id)[0];
    if (!latest || latest.status !== 'completed' || latest.conclusion !== 'success')
      throw Error('CodeQL security check is not successful.');
  }
}
export function assertMainCodeqlEvidence(analysisPages, alertPages, sha) {
  if (
    !Array.isArray(analysisPages) ||
    analysisPages.some((page) => !Array.isArray(page)) ||
    !Array.isArray(alertPages) ||
    alertPages.some((page) => !Array.isArray(page))
  )
    throw Error('Invalid CodeQL evidence.');
  const latest = analysisPages
    .flat()
    .filter(
      (analysis) =>
        analysis.commit_sha === sha &&
        analysis.ref === 'refs/heads/main' &&
        analysis.tool?.name === 'CodeQL' &&
        analysis.analysis_key === '.github/workflows/codeql.yml:analyze',
    )
    .sort((a, b) => b.id - a.id)[0];
  if (!latest || !Number.isSafeInteger(latest.id) || latest.error !== '' || latest.warning !== '')
    throw Error('Successful complete CodeQL analysis missing for the selected main commit.');
  if (alertPages.flat().some((alert) => alert.tool?.name === 'CodeQL' && alert.state === 'open'))
    throw Error('Open CodeQL alerts block release.');
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
  const query = (path) =>
    JSON.parse(
      execFileSync('gh', ['api', '--paginate', '--slurp', `repos/${repository}/${path}`], {
        encoding: 'utf8',
      }),
    );
  assertMainCodeqlEvidence(
    query('code-scanning/analyses?ref=refs/heads/main&per_page=100'),
    query('code-scanning/alerts?ref=refs/heads/main&state=open&tool_name=CodeQL&per_page=100'),
    sha,
  );
  console.log(
    'Required CI and complete CodeQL analysis passed for the selected main commit; no open CodeQL alerts.',
  );
}
