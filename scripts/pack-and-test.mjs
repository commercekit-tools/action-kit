import { mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectTarball } from './check-package-contents.mjs';
const root = process.cwd();
const selected = process.argv[2];
const names = ['notification-contract', 'ccv2-client'];
if (selected && !names.includes(selected)) throw Error('Unknown selected package.');
const run = (command, args, cwd = root) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...(process.platform === 'win32' ? { shell: true } : {}),
  });
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
      `import {createCheckEvent,validateNotificationEvent} from '@commercekit-tools/notification-contract'; import schema from '@commercekit-tools/notification-contract/schema' with {type:'json'}; if(schema.properties.schemaVersion.const!==1)throw Error('Schema export'); validateNotificationEvent(createCheckEvent({status:'success',data:{filesChecked:1,errors:0,warnings:0}}));`,
    );
    types.push(
      `import {createCheckEvent,type NotificationEvent} from '@commercekit-tools/notification-contract'; const event:NotificationEvent=createCheckEvent({status:'success',data:{filesChecked:1,errors:0,warnings:0}}); void event;`,
    );
  }
  if (!selected || selected === 'ccv2-client') {
    smoke.push(
      `import {createCcv2Client} from '@commercekit-tools/ccv2-client'; const client=createCcv2Client({baseUrl:'https://synthetic.example/',tokens:{get:async()=> 'synthetic',invalidate(){}},runtime:{fetch:async()=>new Response('[1]',{headers:{'content-type':'application/json'}})}}); const result=await client.request('test',{policy:'safe-read'}); if(result.body.kind!=='json'||!Array.isArray(result.body.value))throw Error('Packed transport');`,
    );
    types.push(
      `import {createCcv2Client,type Ccv2Response} from '@commercekit-tools/ccv2-client'; const client=createCcv2Client({baseUrl:'https://synthetic.example/',tokens:{get:async()=> 'synthetic',invalidate(){}}}); const response:Promise<Ccv2Response>=client.request('path',{policy:'unsafe-mutation'});void response; // compile only`,
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
} finally {
  rmSync(temp, { recursive: true, force: true });
}
