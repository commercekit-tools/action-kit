import {
  createBuildEvent,
  createDeploymentEvent,
  createCheckEvent,
  type BuildEvent,
  type DeploymentEvent,
  type NotificationEvent,
} from '../../packages/notification-contract/src/index.js';
import { createCcv2Client } from '../../packages/ccv2-client/src/index.js';
const build: BuildEvent = createBuildEvent({ status: 'success', data: {} });
const deploy: DeploymentEvent = createDeploymentEvent({ status: 'action-required', data: {} });
const event: NotificationEvent = createCheckEvent({
  status: 'warning',
  data: { filesChecked: 0, errors: 0, warnings: 0 },
});
void [build, deploy, event];
// @ts-expect-error warning is not a build status
createBuildEvent({ status: 'warning', data: {} });
// @ts-expect-error check cannot start
createCheckEvent({ status: 'started', data: {} });
const client = createCcv2Client({
  baseUrl: 'https://example.com',
  tokens: { get: async () => 'synthetic', invalidate() {} },
});
// @ts-expect-error policy is required even for a GET
void client.request('path', { method: 'GET' });
