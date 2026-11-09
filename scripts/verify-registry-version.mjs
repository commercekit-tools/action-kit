import { spawnSync } from 'node:child_process';
import { packages, versionPattern } from './release-plan.mjs';
const [name, version, mode] = process.argv.slice(2);
if (!packages.includes(name) || !versionPattern.test(version) || !['absent', 'exists'].includes(mode))
  throw Error('Invalid registry verification arguments.');
const result = spawnSync(
  'npm',
  [
    'view',
    `@commercekit-tools/${name}@${version}`,
    'version',
    '--json',
    '--registry=https://npm.pkg.github.com',
  ],
  { encoding: 'utf8', shell: process.platform === 'win32' },
);
if (result.error) throw Error('Registry process failed.');
if (result.status === 0) {
  if (JSON.parse(result.stdout) !== version) throw Error('Registry version mismatch.');
  if (mode === 'absent') throw Error('Version already exists; immutable versions cannot be republished.');
} else if (mode === 'exists' || !/\bE404\b/.test(result.stderr))
  throw Error('Registry verification failed; check package access/authentication.');
console.log(`Registry version check passed (${mode}).`);
