import { createBuildEvent, type BuildEvent } from '../../packages/notification-contract/src/index.js';
import {
  createCcv2Client,
  TechnicalUserTokenManager,
  type RuntimeDependencies,
} from '../../packages/ccv2-client/src/index.js';
export const buildEvent = (status: BuildEvent['status']) =>
  createBuildEvent({
    status,
    data: { buildCode: 'synthetic-build', buildName: 'Synthetic build' },
    eventId: 'synthetic-build',
    occurredAt: '2026-01-01T00:00:00Z',
  });
export function buildAdapter(runtime: Partial<RuntimeDependencies>) {
  const tokens = new TechnicalUserTokenManager(
    {
      tokenEndpoint: 'https://auth.synthetic.example/token',
      clientId: 'synthetic-id',
      clientSecret: 'synthetic-secret',
      resource: 'synthetic-resource',
    },
    { runtime },
  );
  const client = createCcv2Client({ baseUrl: 'https://api.synthetic.example/', tokens, runtime });
  return {
    read: () => client.request('synthetic', { policy: 'safe-read', refreshOn401: true }),
    mutate: () => client.request('synthetic', { policy: 'unsafe-mutation', method: 'POST' }),
  };
}
