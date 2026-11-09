import { randomUUID } from 'node:crypto';
import { schema } from './schema.js';
import { validateNotificationEvent } from './validate.js';
import { extractSafeGitHubContext, mergeProducerContext } from './context.js';
import type {
  NotificationContext,
  NotificationLink,
  NotificationSource,
  CheckEvent,
  BuildEvent,
  DeploymentEvent,
  CheckEventOutcome,
  BuildEventData,
  DeploymentEventData,
} from './types.js';
interface Options {
  eventId?: string;
  occurredAt?: string;
  source?: NotificationSource;
  context?: NotificationContext;
  env?: Readonly<Record<string, string | undefined>>;
  links?: NotificationLink[];
}
function create(kind: 'check' | 'build' | 'deployment', status: string, data: object, options: Options) {
  const allowed = Object.keys(schema.$defs[kind].properties);
  const selected = Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
  if (selected.error && typeof selected.error === 'object') {
    const e = selected.error as { code?: string; message?: string };
    selected.error = { ...(e.code !== undefined ? { code: e.code } : {}), message: e.message };
  }
  const eventType =
    kind === 'check'
      ? 'check.completed'
      : `ccv2.${kind}.${status === 'started' ? 'started' : status === 'action-required' ? 'action-required' : 'completed'}`;
  return validateNotificationEvent({
    schemaVersion: 1,
    eventId: options.eventId ?? `ckevt_${randomUUID()}`,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    eventType,
    status,
    source: options.source
      ? {
          product: options.source.product,
          component: options.source.component,
          ...(options.source.version !== undefined ? { version: options.source.version } : {}),
        }
      : {
          product: 'commercekit',
          component: kind === 'check' ? 'cli-check' : `ccv2-${kind === 'deployment' ? 'deploy' : 'build'}`,
        },
    context: mergeProducerContext(options.context ?? {}, extractSafeGitHubContext(options.env ?? {})),
    data: selected,
    ...(options.links ? { links: options.links.map(({ label, url }) => ({ label, url })) } : {}),
  });
}
export function createCheckEvent(input: Options & CheckEventOutcome): CheckEvent {
  return create('check', input.status, input.data, input) as CheckEvent;
}
export function createBuildEvent(
  input: Options & { status: BuildEvent['status']; data: BuildEventData },
): BuildEvent {
  return create('build', input.status, input.data, input) as BuildEvent;
}
export function createDeploymentEvent(
  input: Options & { status: DeploymentEvent['status']; data: DeploymentEventData },
): DeploymentEvent {
  return create('deployment', input.status, input.data, input) as DeploymentEvent;
}
