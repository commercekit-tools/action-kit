import { it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parsePackArguments, retainTestedTarball } from '../../scripts/pack-output.mjs';
it('retention is explicit and requires exactly one selected package', () => {
  expect(parsePackArguments([])).toEqual({ selected: undefined, directory: undefined });
  expect(parsePackArguments(['ccv2-client'])).toEqual({ selected: 'ccv2-client', directory: undefined });
  expect(parsePackArguments(['notification-contract', '--output-directory', tmpdir()])).toEqual({
    selected: 'notification-contract',
    directory: tmpdir(),
  });
  for (const args of [
    ['other'],
    ['ccv2-client', '--bad', tmpdir()],
    ['ccv2-client', '--output-directory'],
    ['ccv2-client', '--output-directory', 'relative'],
    ['ccv2-client', '--output-directory', tmpdir() + '\nunsafe'],
    ['ccv2-client', '--output-directory', tmpdir(), 'extra'],
  ])
    expect(() => parsePackArguments(args)).toThrow();
});
it('retains byte-identical tested tarball and emits its integrity for publication', () => {
  const temp = mkdtempSync(join(tmpdir(), 'commercekit-pack-output-'));
  try {
    const file = join(temp, 'synthetic.tgz'),
      output = join(temp, 'github-output');
    const content = Buffer.from('synthetic tested package bytes');
    writeFileSync(file, content);
    const result = retainTestedTarball(file, join(temp, 'retained'), output);
    expect(readFileSync(result.tarball)).toEqual(content);
    expect(result.sha256).toBe(createHash('sha256').update(content).digest('hex'));
    expect(readFileSync(output, 'utf8')).toBe(`tarball=${result.tarball}\nsha256=${result.sha256}\n`);
    rmSync(file);
    expect(existsSync(result.tarball)).toBe(true);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
it('supports local retention without GitHub output', () => {
  const temp = mkdtempSync(join(tmpdir(), 'commercekit-pack-output-'));
  try {
    const file = join(temp, 'synthetic.tgz');
    writeFileSync(file, 'synthetic');
    expect(retainTestedTarball(file, join(temp, 'retained')).sha256).toHaveLength(64);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
