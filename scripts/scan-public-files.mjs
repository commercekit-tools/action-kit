import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const patterns = [
  new RegExp('/Users/' + 'anil/'),
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bnpm_[A-Za-z0-9]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /https:\/\/hooks\.slack\.com\/services\/[^\s"']+/,
  /https:\/\/[^\s"']+\.logic\.azure\.com\//,
  /\/:_authToken\s*=/,
];
export function scanPublicContent(value, label) {
  if (patterns.some((pattern) => pattern.test(value))) throw Error(`Unsafe public content: ${label}`);
}
if (process.argv[1]?.endsWith('scan-public-files.mjs')) {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    encoding: 'utf8',
  })
    .split('\0')
    .filter(Boolean);
  for (const file of files) scanPublicContent(readFileSync(file, 'utf8'), file);
  console.log(
    `Public source scan passed (${files.length} files). Tarballs use the same scanner. Review synthetic identifiers and unknown credential formats manually.`,
  );
}
