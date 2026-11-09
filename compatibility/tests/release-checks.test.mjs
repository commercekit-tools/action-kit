import { it, expect } from 'vitest';
import {
  assertReleaseChecks,
  requiredReleaseChecks,
  assertMainCodeqlEvidence,
} from '../../scripts/release-checks.mjs';
const passed = () =>
  [...requiredReleaseChecks, 'CodeQL'].map((name, index) => ({
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

it('accepts main checks without the PR-only CodeQL security check', () =>
  expect(() =>
    assertReleaseChecks([{ check_runs: passed().filter((check) => check.name !== 'CodeQL') }]),
  ).not.toThrow());
const sha = 'a'.repeat(40);
const analysis = () => ({
  id: 10,
  commit_sha: sha,
  ref: 'refs/heads/main',
  tool: { name: 'CodeQL' },
  analysis_key: '.github/workflows/codeql.yml:analyze',
  error: '',
  warning: '',
});
it('requires an exact main-commit analysis with no errors, warnings or open alerts', () => {
  expect(() => assertMainCodeqlEvidence([[], [analysis()]], [[]], sha)).not.toThrow();
  for (const patch of [
    { commit_sha: 'b'.repeat(40) },
    { ref: 'refs/pull/1/merge' },
    { tool: { name: 'other' } },
    { analysis_key: 'other' },
    { error: 'failed' },
    { warning: 'partial scan' },
  ])
    expect(() => assertMainCodeqlEvidence([[{ ...analysis(), ...patch }]], [[]], sha)).toThrow();
  expect(() =>
    assertMainCodeqlEvidence([[analysis(), { ...analysis(), id: 11, error: 'failed' }]], [[]], sha),
  ).toThrow();
  expect(() =>
    assertMainCodeqlEvidence([[analysis()]], [[{ state: 'open', tool: { name: 'CodeQL' } }]], sha),
  ).toThrow('alerts');
  expect(() =>
    assertMainCodeqlEvidence([[analysis()]], [[{ state: 'fixed', tool: { name: 'CodeQL' } }]], sha),
  ).not.toThrow();
  for (const pages of [null, {}, [{}]]) expect(() => assertMainCodeqlEvidence(pages, [[]], sha)).toThrow();
});
