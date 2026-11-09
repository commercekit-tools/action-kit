import { it, expect, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { acceptNotification } from '../consumers/notify.js';
import { buildAdapter, buildEvent } from '../consumers/ccv2-build.js';
import { deploymentAdapter, deploymentEvent } from '../consumers/ccv2-deploy.js';
import { checkEvent } from '../consumers/check.js';
it('Notify accepts every fixture without replacing producer context', () => {
  for (const kind of ['check', 'build', 'deployment'])
    for (const name of readdirSync(`compatibility/fixtures/${kind}`)) {
      const value = JSON.parse(readFileSync(`compatibility/fixtures/${kind}/${name}`, 'utf8'));
      const event = acceptNotification(value);
      expect(event.context?.repository).toBe('synthetic/example');
      expect(event.context?.runId).toBe('123');
    }
});
for (const status of ['success', 'failure', 'cancelled', 'internal-error'] as const)
  it('Build exact projection ' + status, () => {
    expect(buildEvent(status)).toEqual({
      schemaVersion: 1,
      eventId: 'synthetic-build',
      occurredAt: '2026-01-01T00:00:00Z',
      eventType: 'ccv2.build.completed',
      status,
      source: { product: 'commercekit', component: 'ccv2-build' },
      context: {},
      data: { buildCode: 'synthetic-build', buildName: 'Synthetic build' },
    });
  });
for (const status of ['success', 'failure', 'cancelled', 'action-required', 'internal-error'] as const)
  it('Deploy projection ' + status, () => {
    const event = deploymentEvent(status);
    expect(acceptNotification(event)).toMatchObject({
      status,
      data: { deploymentCode: 'synthetic-deployment' },
      eventType:
        status === 'action-required' ? 'ccv2.deployment.action-required' : 'ccv2.deployment.completed',
    });
  });
it('future Check has no CCv2 dependency', () =>
  expect(acceptNotification(checkEvent())).toMatchObject({
    eventType: 'check.completed',
    data: { filesChecked: 2 },
  }));
for (const adapter of [buildAdapter, deploymentAdapter])
  it('technical-user adapter retries reads but never ambiguous mutations', async () => {
    const replies = [
      new Response(JSON.stringify({ access_token: 'synthetic-access', token_type: 'Bearer' }), {
        headers: { 'content-type': 'application/json' },
      }),
      new Response(null, { status: 503 }),
      new Response('[1]', { headers: { 'content-type': 'application/json' } }),
      new Response(null, { status: 202 }),
    ];
    const fetcher = vi.fn(async () => replies.shift()!);
    const client = adapter({ fetch: fetcher, sleep: async () => {}, random: () => 0 });
    expect((await client.read()).body).toEqual({ kind: 'json', value: [1] });
    expect((await client.mutate()).body).toEqual({ kind: 'empty' });
    expect(fetcher).toHaveBeenCalledTimes(4);
    const unsafe = adapter({
      fetch: async () => {
        throw Error('synthetic network');
      },
      sleep: async () => {},
    });
    await expect(unsafe.mutate()).rejects.toMatchObject({ code: 'REQUEST_FAILED' });
  });
