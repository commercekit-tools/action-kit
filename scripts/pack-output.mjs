import { appendFileSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, isAbsolute, join, resolve } from 'node:path';
export function parsePackArguments(args) {
  const [selected, option, directory] = args;
  if (selected !== undefined && !['notification-contract', 'ccv2-client'].includes(selected))
    throw Error('Unknown selected package.');
  if (
    args.length > 1 &&
    (!selected ||
      args.length !== 3 ||
      option !== '--output-directory' ||
      !directory ||
      !isAbsolute(directory) ||
      /[\r\n]/.test(directory))
  )
    throw Error('Retaining a tested tarball requires one selected package and an absolute output directory.');
  return { selected, directory };
}
export function retainTestedTarball(file, directory, githubOutput) {
  mkdirSync(directory, { recursive: true });
  const tarball = resolve(join(directory, basename(file)));
  if (/[\r\n]/.test(tarball)) throw Error('Invalid tarball path.');
  copyFileSync(file, tarball);
  const sha256 = createHash('sha256').update(readFileSync(tarball)).digest('hex');
  if (githubOutput) appendFileSync(githubOutput, `tarball=${tarball}\nsha256=${sha256}\n`);
  return { tarball, sha256 };
}
