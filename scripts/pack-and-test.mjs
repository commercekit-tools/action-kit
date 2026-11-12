import { mkdtempSync, writeFileSync, rmSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectTarball } from './check-package-contents.mjs';
import { parsePackArguments, retainTestedTarball } from './pack-output.mjs';
const root = process.cwd();
const { selected, directory } = parsePackArguments(process.argv.slice(2));
const names = ['notification-contract', 'ccv2-client'];
const run = (command, args, cwd = root) => {
  const options = { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  // Invoke JS CLIs with Node on every platform; never pass code or paths through a shell.
  if (command === 'pnpm') {
    const executable = process.env.npm_execpath;
    if (!executable) throw Error('Run pack:check through pnpm.');
    return /\.[cm]?js$/.test(executable)
      ? execFileSync(process.execPath, [executable, ...args], options)
      : execFileSync(executable, args, options);
  }
  if (command === 'npm') {
    const npmCli = [
      resolve(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
    ].find(existsSync);
    if (!npmCli) throw Error('Cannot locate the npm CLI supplied with Node.');
    return execFileSync(process.execPath, [npmCli, ...args], options);
  }
  return execFileSync(command, args, options);
};
const temp = mkdtempSync(join(tmpdir(), 'commercekit-pack-'));
try {
  run('pnpm', ['build']);
  const tarballs = [];
  for (const name of selected ? [selected] : names) {
    const result = JSON.parse(
      run('npm', ['pack', '--json', '--pack-destination', temp], resolve('packages', name)),
    )[0];
    const file = join(temp, result.filename);
    const report = inspectTarball(file, name);
    console.log(JSON.stringify({ ...report, packedBytes: statSync(file).size }));
    tarballs.push(file);
  }
  writeFileSync(join(temp, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--registry=https://registry.npmjs.org',
      ...tarballs,
    ],
    temp,
  );
  const smoke = [];
  const types = [];
  if (!selected || selected === 'notification-contract') {
    smoke.push(
      `import {createCheckEvent,validateNotificationEvent,stripAngleBracketText,redactJwtLikeTokens} from '@commercekit-tools/notification-contract'; import schema from '@commercekit-tools/notification-contract/schema' with {type:'json'}; if(stripAngleBracketText('a<b>c')!=='ac'||redactJwtLikeTokens('eyJheader.payload.signature')!=='[REDACTED]')throw Error('Packed text primitives'); if(schema.properties.schemaVersion.const!==1)throw Error('Schema export'); validateNotificationEvent(createCheckEvent({status:'success',data:{filesChecked:1,errors:0,warnings:0}}));`,
    );
    types.push(
      `import {createCheckEvent,stripAngleBracketText,redactJwtLikeTokens,type NotificationEvent} from '@commercekit-tools/notification-contract'; const event:NotificationEvent=createCheckEvent({status:'success',data:{filesChecked:1,errors:0,warnings:0}}); void event; const text:string=stripAngleBracketText(redactJwtLikeTokens('synthetic'));void text;`,
    );
  }
  if (!selected || selected === 'ccv2-client') {
    smoke.push(
      `import {createCcv2Client,encodeCcv2PathSegment} from '@commercekit-tools/ccv2-client'; if(encodeCcv2PathSegment('synthetic id')!=='synthetic%20id')throw Error('Packed path primitive'); const client=createCcv2Client({baseUrl:'https://synthetic.example/',tokens:{get:async()=> 'synthetic',invalidate(){}},runtime:{fetch:async()=>new Response('[1]',{headers:{'content-type':'application/json'}})}}); const result=await client.request('test',{policy:'safe-read'}); if(result.body.kind!=='json'||!Array.isArray(result.body.value))throw Error('Packed transport');`,
    );
    types.push(
      `import {createCcv2Client,encodeCcv2PathSegment,type Ccv2Response} from '@commercekit-tools/ccv2-client'; const client=createCcv2Client({baseUrl:'https://synthetic.example/',tokens:{get:async()=> 'synthetic',invalidate(){}}}); const response:Promise<Ccv2Response>=client.request('path',{policy:'unsafe-mutation'});void response;const segment:string=encodeCcv2PathSegment('synthetic');void segment; // compile only`,
    );
  }
  writeFileSync(join(temp, 'smoke.mjs'), smoke.join('\n'));
  writeFileSync(join(temp, 'consumer.ts'), types.join('\n'));
  run(process.execPath, ['smoke.mjs'], temp);
  run(
    process.execPath,
    [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '--noEmit',
      '--strict',
      '--module',
      'NodeNext',
      '--target',
      'ES2023',
      '--skipLibCheck',
      'consumer.ts',
    ],
    temp,
  );
  for (const name of selected ? [selected] : names) {
    run(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `try { await import('@commercekit-tools/${name}/dist/index.js'); throw Error('Internal export leaked'); } catch(e) { if(e.code!=='ERR_PACKAGE_PATH_NOT_EXPORTED')throw e; }`,
      ],
      temp,
    );
  }
  console.log('Packed ESM imports, schema, declarations and export boundaries passed.');
  if (directory)
    console.log(JSON.stringify(retainTestedTarball(tarballs[0], directory, process.env.GITHUB_OUTPUT)));
} finally {
  rmSync(temp, { recursive: true, force: true });
}
