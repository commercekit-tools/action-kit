import { scanPublicContent } from './scan-public-files.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
export function inspectTarball(file, expected) {
  const entries = execFileSync('tar', ['-tzf', file], { encoding: 'utf8' }).trim().split(/\r?\n/);
  for (const entry of entries) {
    if (
      !/^package\/(dist\/[\w./-]+\.(?:js|json|ts)|README\.md|LICENSE|package\.json)$/.test(entry) ||
      entry.includes('..')
    )
      throw Error(`Unexpected package entry: ${entry}`);
    const content = execFileSync('tar', ['-xOzf', file, entry], { encoding: 'utf8' });
    scanPublicContent(content, entry);
    if (/\/Users\/|[A-Z]:\\Users\\|sourceMappingURL|@actions\/|\.\.\/src\//.test(content))
      throw Error(`Unsafe package content: ${entry}`);
  }
  for (const required of [
    'package/package.json',
    'package/README.md',
    'package/LICENSE',
    'package/dist/index.js',
    'package/dist/index.d.ts',
  ])
    if (!entries.includes(required)) throw Error(`Missing ${required}`);
  const metadata = JSON.parse(
    execFileSync('tar', ['-xOzf', file, 'package/package.json'], { encoding: 'utf8' }),
  );
  if (
    metadata.name !== `@commercekit-tools/${expected}` ||
    metadata.private ||
    metadata.publishConfig.registry !== 'https://npm.pkg.github.com' ||
    metadata.repository.directory !== `packages/${expected}`
  )
    throw Error('Invalid package metadata.');
  const source = JSON.parse(readFileSync(`packages/${expected}/package.json`, 'utf8'));
  if (metadata.version !== source.version) throw Error('Package version mismatch.');
  return {
    name: metadata.name,
    version: metadata.version,
    files: entries.length,
    entries,
    exports: metadata.exports,
  };
}
