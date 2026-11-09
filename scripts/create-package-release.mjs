import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packages, versionPattern } from './release-plan.mjs';
const name = process.env.SELECTED_PACKAGE,
  version = process.env.VERSION;
if (
  process.env.CONFIRMATION !== 'CREATE-COMMERCEKIT-PACKAGE-RELEASE' ||
  process.env.GITHUB_REF !== 'refs/heads/main' ||
  !packages.includes(name) ||
  !versionPattern.test(version) ||
  version === '0.0.0-reserved.1'
)
  throw Error('Invalid release request.');
const run = (command, args, options = {}) => execFileSync(command, args, { encoding: 'utf8', ...options });
const sha = process.env.COMMIT_SHA || run('git', ['rev-parse', 'origin/main']).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw Error('Expected full commit SHA.');
run('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
const manifest = JSON.parse(run('git', ['show', `${sha}:packages/${name}/package.json`]));
if (
  manifest.name !== `@commercekit-tools/${name}` ||
  manifest.version !== version ||
  manifest.repository.directory !== `packages/${name}` ||
  manifest.publishConfig.registry !== 'https://npm.pkg.github.com' ||
  manifest.private
)
  throw Error('Commit manifest mismatch.');
run(process.execPath, ['scripts/verify-registry-version.mjs', name, version, 'exists']);
const tag = `${name}-v${version}`;
const tags = run('git', ['ls-remote', '--tags', 'origin', `refs/tags/${tag}`]);
if (tags.trim()) throw Error('Package tag already exists; inspect partial release state.');
const releases = JSON.parse(
  run('gh', ['api', '--paginate', '--slurp', `repos/${process.env.GITHUB_REPOSITORY}/releases?per_page=100`]),
)
  .flat()
  .map((release) => release.tag_name);
if (releases.includes(tag)) throw Error('GitHub Release already exists.');
run(process.execPath, ['scripts/release-checks.mjs', sha]);
const temp = mkdtempSync(join(tmpdir(), 'commercekit-release-'));
try {
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  writeFileSync(join(temp, '.npmrc'), '@commercekit-tools:registry=https://npm.pkg.github.com\n');
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      `@commercekit-tools/${name}@${version}`,
      '--registry=https://registry.npmjs.org',
    ],
    { cwd: temp },
  );
  const installed = JSON.parse(
    run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import p from '@commercekit-tools/${name}/package.json' with {type:'json'}; console.log(JSON.stringify(p));`,
      ],
      { cwd: temp },
    ),
  );
  if (installed.version !== version || installed.name !== manifest.name)
    throw Error('Installed metadata mismatch.');
  run(process.execPath, ['--input-type=module', '-e', `await import('@commercekit-tools/${name}');`], {
    cwd: temp,
  });
  const notes = run('git', ['show', `${sha}:packages/${name}/CHANGELOG.md`]);
  if (!notes.includes(`## ${version}`)) throw Error('Missing selected package release notes.');
  writeFileSync(join(temp, 'notes.md'), notes);
  run('git', [
    '-c',
    'user.name=github-actions[bot]',
    '-c',
    'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'tag',
    '-a',
    tag,
    sha,
    '-m',
    `${manifest.name}@${version}`,
  ]);
  run('git', ['push', 'origin', `refs/tags/${tag}`]);
  run('gh', [
    'release',
    'create',
    tag,
    '--verify-tag',
    '--title',
    `${manifest.name}@${version}`,
    '--notes-file',
    join(temp, 'notes.md'),
    ...(version.startsWith('0.') || version.includes('-') ? ['--prerelease'] : []),
  ]);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
