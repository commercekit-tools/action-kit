import { it, expect } from 'vitest';
import { releasePlan, versionPattern, isPreviewVersion } from '../../scripts/release-plan.mjs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
it('publication requires exact package/channel/confirmation and pre-1.0 version', () => {
  for (const name of ['notification-contract', 'ccv2-client'])
    expect(releasePlan(name, 'preview', 'PUBLISH-COMMERCEKIT-PREVIEW')).toMatchObject({
      version: '0.0.3',
      tag: 'preview',
    });
  for (const args of [
    ['other', 'preview', 'PUBLISH-COMMERCEKIT-PREVIEW'],
    ['notification-contract', 'invalid', 'x'],
    ['notification-contract', 'preview', 'x'],
    ['notification-contract', 'stable', 'PUBLISH-COMMERCEKIT-STABLE'],
  ])
    expect(() => releasePlan(...args)).toThrow();
  for (const v of ['1.0.0', '0.1.0-preview.1', '1.2.3-rc.alpha']) expect(versionPattern.test(v)).toBe(true);
  for (const v of ['1.0', '01.0.0', '1.0.0-01', '1.0.0;echo', 'v1.0.0', '1.0.0+build'])
    expect(versionPattern.test(v)).toBe(false);
});
it('reservation generation contains no implementation and does not edit source manifests', () => {
  const temp = mkdtempSync(join(tmpdir(), 'commercekit-reservation-test-'));
  let reservation;
  try {
    const before = readFileSync('packages/notification-contract/package.json', 'utf8');
    const output = join(temp, 'output');
    const result = spawnSync(process.execPath, ['scripts/create-reservation-package.mjs'], {
      env: {
        ...process.env,
        CONFIRMATION: 'RESERVE-COMMERCEKIT-PACKAGES',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_OUTPUT: output,
      },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    reservation = readFileSync(output, 'utf8').trim().split('=').slice(1).join('=');
    for (const name of ['notification-contract', 'ccv2-client']) {
      const p = JSON.parse(readFileSync(join(reservation, name, 'package.json'), 'utf8'));
      expect(p.version).toBe('0.0.0-reserved.1');
      expect(p.files).toEqual(['README.md', 'LICENSE']);
      expect(readFileSync(join(reservation, name, 'README.md'), 'utf8')).toContain(
        'must not be used as a dependency',
      );
    }
    expect(readFileSync('packages/notification-contract/package.json', 'utf8')).toBe(before);
  } finally {
    rmSync(temp, { recursive: true, force: true });
    if (reservation) rmSync(reservation, { recursive: true, force: true });
  }
});
it('manual scripts reject invalid input before any network or mutation', () => {
  for (const script of [
    'create-reservation-package',
    'create-package-release',
    'release-plan',
    'verify-registry-version',
    'release-checks',
  ]) {
    const result = spawnSync(process.execPath, [`scripts/${script}.mjs`], {
      env: { ...process.env, CONFIRMATION: 'wrong', GITHUB_REF: 'refs/heads/feature' },
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
  }
});
it('public scan rejects secrets without printing their value', async () => {
  const { scanPublicContent } = await import('../../scripts/scan-public-files.mjs');
  for (const value of [
    'ghp_' + 'x'.repeat(40),
    'npm_' + 'x'.repeat(40),
    '/Users/' + 'anil/private',
    '-----BEGIN ' + 'PRIVATE KEY-----',
  ]) {
    expect(() => scanPublicContent(value, 'synthetic-test')).toThrow('synthetic-test');
  }
  expect(() => scanPublicContent('synthetic-build', 'fixture')).not.toThrow();
});

it('accepts initial numeric releases only in the pre-1.0 preview channel', () => {
  for (const version of ['0.0.1', '0.1.0', '0.1.0-preview.1']) expect(isPreviewVersion(version)).toBe(true);
  for (const version of [
    '0.0.0',
    '0.0.0-reserved.1',
    '0.0.0-preview.1',
    '1.0.0',
    '1.0.0-preview.1',
    '0.0.1-other.1',
    '0.0.1-preview.01',
  ])
    expect(isPreviewVersion(version)).toBe(false);
});
