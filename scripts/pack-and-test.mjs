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
      `import {createCheckEvent,createBuildCleanupEvent,validateNotificationEvent,stripAngleBracketText,redactJwtLikeTokens} from '@commercekit-tools/notification-contract'; import schema from '@commercekit-tools/notification-contract/schema' with {type:'json'}; if(stripAngleBracketText('a<b>c')!=='ac'||redactJwtLikeTokens('eyJheader.payload.signature')!=='[REDACTED]')throw Error('Packed text primitives'); if(schema.properties.schemaVersion.const!==1)throw Error('Schema export'); validateNotificationEvent(createCheckEvent({status:'success',data:{filesChecked:1,errors:0,warnings:0}})); const cleanup=validateNotificationEvent(createBuildCleanupEvent({status:'warning',data:{mode:'dry-run',subscriptionCode:'synthetic',retentionDays:30,keepLatest:10,cleanupStatus:'dry-run',scannedCount:0,eligibleCount:0,plannedCount:0,deletionRequestedCount:0,skippedCount:0,failedCount:0,unknownCount:0,deferredCount:0,durationMs:0,inputs:{"token-endpoint":"[REDACTED]","client-id":"[REDACTED]","client-secret":"[REDACTED]","resource":"[REDACTED]","subscription-code":"synthetic","api-base-url":"https://synthetic.example","application-code":"","retention-days":"30","keep-latest":"10","dry-run":"true","max-deletions":"20","exclude-build-codes":"","timeout-minutes":"15","continue-on-delete-error":"false"},inputsValidated:true,inputsTruncated:false,protectedCount:0,blockedCount:0,issues:[{code:'eligibility-unverified',message:'Safe packed issue.'}]}})); if(cleanup.status!=='warning'||cleanup.data.inputs['client-secret']!=='[REDACTED]'||cleanup.data.issues[0].code!=='eligibility-unverified'||cleanup.eventType!=='ccv2.build-cleanup.completed'||cleanup.data.mode!=='dry-run'||cleanup.data.deletionRequestedCount!==0)throw Error('Packed cleanup event');`,
    );
    types.push(
      `import {createCheckEvent,createBuildCleanupEvent,stripAngleBracketText,redactJwtLikeTokens,type NotificationEvent,type BuildCleanupEvent,type BuildCleanupInputSnapshot,type BuildCleanupStatus} from '@commercekit-tools/notification-contract'; const event:NotificationEvent=createCheckEvent({status:'success',data:{filesChecked:1,errors:0,warnings:0}}); void event; const text:string=stripAngleBracketText(redactJwtLikeTokens('synthetic'));void text;const inputs:BuildCleanupInputSnapshot={"token-endpoint":"[REDACTED]","client-id":"[REDACTED]","client-secret":"[REDACTED]","resource":"[REDACTED]","subscription-code":"synthetic","api-base-url":"https://synthetic.example","application-code":"","retention-days":"30","keep-latest":"10","dry-run":"true","max-deletions":"20","exclude-build-codes":"","timeout-minutes":"15","continue-on-delete-error":"false"};const status:BuildCleanupStatus='warning';const cleanup:BuildCleanupEvent=createBuildCleanupEvent({status,data:{mode:'dry-run',subscriptionCode:'synthetic',retentionDays:30,keepLatest:10,cleanupStatus:'dry-run',scannedCount:0,eligibleCount:0,plannedCount:0,deletionRequestedCount:0,skippedCount:0,failedCount:0,unknownCount:0,deferredCount:0,durationMs:0,inputs,inputsValidated:true,inputsTruncated:false,protectedCount:0,blockedCount:0,issues:[{message:'Safe packed issue.'}]}});void cleanup;`,
    );
  }
  if (!selected || selected === 'notification-contract') {
    smoke.push(
      `import {createSetupEvent,createActionInputContext,captureActionInputs,getNotificationStyle,renderActionSummary} from '@commercekit-tools/notification-contract'; const defs=[{name:'version'},{name:'client-secret'}];const captured=captureActionInputs(defs,n=>n==='version'?'latest':'synthetic-private',()=>{});const ctx=createActionInputContext(defs,captured,{validated:true});const setup=createSetupEvent({status:'success',data:{...ctx,version:'1.0.0'}});const text=renderActionSummary({title:'Setup CommerceKit',status:setup.status,inputContext:ctx});if(setup.eventType!=='commercekit.setup.completed'||setup.source.component!=='setup-commercekit'||getNotificationStyle('success').icon!=='✅'||!text.includes('### Inputs')||text.includes('synthetic-private'))throw Error('Packed Action reporting API');`,
    );
    types.push(
      `import {createSetupEvent,createActionInputContext,renderActionSummary,type SetupEvent,type NotificationInputContext,type ActionSummaryOptions} from '@commercekit-tools/notification-contract';const context:NotificationInputContext=createActionInputContext([{name:'version'}],{version:'latest'},{validated:true});const setup:SetupEvent=createSetupEvent({status:'success',data:context});const options:ActionSummaryOptions={title:'Setup CommerceKit',status:setup.status,inputContext:context};const report:string=renderActionSummary(options);void report;`,
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
