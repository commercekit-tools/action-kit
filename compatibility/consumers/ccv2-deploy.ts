import {
  createDeploymentEvent,
  type DeploymentEvent,
} from '../../packages/notification-contract/src/index.js';
import { buildAdapter } from './ccv2-build.js';
export const deploymentEvent = (status: DeploymentEvent['status']) =>
  createDeploymentEvent({
    status,
    data: {
      deploymentCode: 'synthetic-deployment',
      ...(status === 'action-required' ? { decisionType: 'PREPARE_CANARY' } : {}),
    },
  });
// Only a transport integration adapter, with no deployment lifecycle behavior.
export const deploymentAdapter = buildAdapter;
