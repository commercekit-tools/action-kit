import { mkdtempSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packages } from './release-plan.mjs';
if (
  process.env.CONFIRMATION !== 'RESERVE-COMMERCEKIT-PACKAGES' ||
  process.env.GITHUB_REF !== 'refs/heads/main'
)
  throw Error('Reservation requires exact confirmation on main.');
const directory = mkdtempSync(join(tmpdir(), 'commercekit-reservation-'));
for (const name of packages) {
  const path = join(directory, name);
  const { mkdirSync } = await import('node:fs');
  mkdirSync(path);
  writeFileSync(
    join(path, 'package.json'),
    JSON.stringify({
      name: `@commercekit-tools/${name}`,
      version: '0.0.0-reserved.1',
      description: 'Reserved CommerceKit shared-library package name.',
      license: 'MIT',
      repository: {
        type: 'git',
        url: 'git+https://github.com/commercekit-tools/action-kit.git',
        directory: `packages/${name}`,
      },
      publishConfig: { registry: 'https://npm.pkg.github.com' },
      files: ['README.md', 'LICENSE'],
    }),
  );
  writeFileSync(
    join(path, 'README.md'),
    'Reserved package name for a future CommerceKit shared library.\n\nThis version is not supported and must not be used as a dependency.\n\nThe first supported package will use a preview version such as 0.1.0-preview.1.\n',
  );
  writeFileSync(join(path, 'LICENSE'), readFileSync('LICENSE'));
}
appendFileSync(process.env.GITHUB_OUTPUT, `directory=${directory}\n`);
