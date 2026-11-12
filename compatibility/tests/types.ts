import {
  createBuildEvent,
  stripAngleBracketText,
  redactJwtLikeTokens,
  createDeploymentEvent,
  createCheckEvent,
  type BuildEvent,
  type DeploymentEvent,
  type NotificationEvent,
} from '../../packages/notification-contract/src/index.js';
import { createCcv2Client, encodeCcv2PathSegment } from '../../packages/ccv2-client/src/index.js';
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

const plain: string = stripAngleBracketText('<b>synthetic</b>');
const redacted: string = redactJwtLikeTokens('synthetic');
const segment: string = encodeCcv2PathSegment('synthetic identifier');
void [plain, redacted, segment];
// @ts-expect-error path segments accept raw strings only
encodeCcv2PathSegment(123);
// @ts-expect-error text filters accept strings only
stripAngleBracketText(null);
// @ts-expect-error JWT-like redaction accepts strings only
redactJwtLikeTokens({});
