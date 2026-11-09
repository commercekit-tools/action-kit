import { readFileSync, appendFileSync } from 'node:fs';
export const packages = ['notification-contract', 'ccv2-client'];
export const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?$/;
export function releasePlan(name, channel, confirmation) {
  if (!packages.includes(name) || !['preview', 'stable'].includes(channel))
    throw Error('Invalid package/channel.');
  if (confirmation !== `PUBLISH-COMMERCEKIT-${channel.toUpperCase()}`)
    throw Error('Incorrect publication confirmation.');
  const manifest = JSON.parse(readFileSync(`packages/${name}/package.json`, 'utf8'));
  if (
    !versionPattern.test(manifest.version) ||
    (channel === 'preview'
      ? !/^0\.\d+\.\d+-preview\.[1-9]\d*$/.test(manifest.version)
      : manifest.version.includes('-') || Number(manifest.version.split('.')[0]) < 1)
  )
    throw Error('Version does not match publication channel.');
  if (
    manifest.name !== `@commercekit-tools/${name}` ||
    manifest.private ||
    manifest.publishConfig.registry !== 'https://npm.pkg.github.com'
  )
    throw Error('Invalid publication metadata.');
  return {
    name: manifest.name,
    version: manifest.version,
    tag: channel === 'preview' ? 'preview' : 'latest',
    directory: `packages/${name}`,
  };
}
if (process.argv[1]?.endsWith('/release-plan.mjs') || process.argv[1]?.endsWith('\\release-plan.mjs')) {
  if (process.env.GITHUB_REF !== 'refs/heads/main') throw Error('Publication requires main.');
  const plan = releasePlan(process.env.SELECTED_PACKAGE, process.env.CHANNEL, process.env.CONFIRMATION);
  for (const [key, value] of Object.entries(plan))
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
