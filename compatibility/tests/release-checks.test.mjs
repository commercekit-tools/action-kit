import { it, expect } from 'vitest';
import { assertReleaseChecks, requiredReleaseChecks } from '../../scripts/release-checks.mjs';
const passed = () =>
  requiredReleaseChecks.map((name, index) => ({
    name,
    id: index + 1,
    app: { slug: name === 'CodeQL' ? 'github-advanced-security' : 'github-actions' },
    status: 'completed',
    conclusion: 'success',
  }));
it('requires every official CI and CodeQL check across API pages', () => {
  const checks = passed();
  expect(() =>
    assertReleaseChecks([{ check_runs: checks.slice(0, 2) }, { check_runs: checks.slice(2) }]),
  ).not.toThrow();
  for (const name of requiredReleaseChecks)
    expect(() => assertReleaseChecks([{ check_runs: checks.filter((c) => c.name !== name) }])).toThrow(name);
});
for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', null])
  it('rejects unsuccessful checks: ' + conclusion, () => {
    const checks = passed();
    checks[0].conclusion = conclusion;
    expect(() => assertReleaseChecks([{ check_runs: checks }])).toThrow('quality');
  });
it('does not accept old success when the newest rerun failed or is pending', () => {
  for (const status of ['completed', 'in_progress', 'queued']) {
    const checks = passed();
    checks.push({ ...checks[0], id: 100, status, conclusion: status === 'completed' ? 'failure' : null });
    expect(() => assertReleaseChecks([{ check_runs: checks }])).toThrow('quality');
  }
});
it('allows a successful latest rerun and ignores other apps', () => {
  const checks = passed();
  checks.unshift({ ...checks[0], id: 0, conclusion: 'failure' });
  checks.push({ ...checks[1], id: 100, app: { slug: 'untrusted-app' }, conclusion: 'failure' });
  expect(() => assertReleaseChecks([{ check_runs: checks }])).not.toThrow();
  checks[2].app.slug = 'untrusted-app';
  expect(() => assertReleaseChecks([{ check_runs: checks }])).toThrow();
});
for (const value of [null, {}, [], [{ check_runs: null }]])
  it('fails closed on absent/malformed evidence ' + JSON.stringify(value), () =>
    expect(() => assertReleaseChecks(value)).toThrow(),
  );
it('blocks a failed CodeQL result even when the analysis job succeeded', () => {
  const checks = passed();
  checks.find((check) => check.name === 'CodeQL').conclusion = 'failure';
  expect(() => assertReleaseChecks([{ check_runs: checks }])).toThrow('CodeQL');
});

it('rejects an Actions check impersonating the security app result', () => {
  const checks = passed();
  checks.find((check) => check.name === 'CodeQL').app.slug = 'github-actions';
  expect(() => assertReleaseChecks([{ check_runs: checks }])).toThrow('CodeQL');
});
