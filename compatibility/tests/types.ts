import {
  createBuildEvent,
  createBuildCleanupEvent,
  type BuildCleanupEvent,
  type BuildCleanupStatus,
  type BuildCleanupInputSnapshot,
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

const cleanupInputs: BuildCleanupInputSnapshot = {
  'token-endpoint': '[REDACTED]',
  'client-id': '[REDACTED]',
  'client-secret': '[REDACTED]',
  resource: '[REDACTED]',
  'subscription-code': 'synthetic',
  'api-base-url': 'https://synthetic.example',
  'application-code': '',
  'retention-days': '30',
  'keep-latest': '10',
  'dry-run': 'true',
  'max-deletions': '20',
  'exclude-build-codes': '',
  'timeout-minutes': '15',
  'continue-on-delete-error': 'false',
};
const cleanupStatus: BuildCleanupStatus = 'warning';
const cleanup: BuildCleanupEvent = createBuildCleanupEvent({
  status: cleanupStatus,
  data: {
    mode: 'dry-run',
    subscriptionCode: 'synthetic',
    retentionDays: 30,
    keepLatest: 10,
    cleanupStatus: 'blocked',
    scannedCount: 1,
    eligibleCount: 0,
    plannedCount: 0,
    deletionRequestedCount: 0,
    skippedCount: 1,
    failedCount: 0,
    unknownCount: 0,
    deferredCount: 0,
    durationMs: 1,
    inputs: cleanupInputs,
    inputsValidated: true,
    inputsTruncated: false,
    protectedCount: 1,
    blockedCount: 0,
    issues: [{ code: 'eligibility-unverified', message: 'Safe explanation.' }],
  },
});
void cleanup;
const invalidCleanupInputs: BuildCleanupInputSnapshot = {
  ...cleanupInputs,
  // @ts-expect-error credentials must be redacted before event construction
  'client-secret': 'synthetic-confidential-value',
};
void invalidCleanupInputs;
// @ts-expect-error cleanup warning support does not widen Deploy status
createDeploymentEvent({ status: 'warning', data: {} });
