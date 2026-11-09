export type NotificationStatus =
  'started' | 'success' | 'warning' | 'failure' | 'cancelled' | 'internal-error' | 'action-required';
export type CompletedStatus = 'success' | 'failure' | 'cancelled' | 'internal-error';
export type NotificationEventType =
  | 'check.completed'
  | 'ccv2.build.started'
  | 'ccv2.build.completed'
  | 'ccv2.deployment.started'
  | 'ccv2.deployment.completed'
  | 'ccv2.deployment.action-required';
export interface NotificationSource {
  product: 'commercekit';
  component: 'cli-check' | 'ccv2-build' | 'ccv2-deploy' | 'workflow';
  version?: string;
}
export interface NotificationContext {
  repository?: string;
  ref?: string;
  commit?: string;
  actor?: string;
  workflow?: string;
  job?: string;
  runId?: string;
  runAttempt?: number;
  runUrl?: string;
  environment?: string;
  [key: string]: unknown;
}
export interface NotificationLink {
  label: string;
  url: string;
}
export interface SafeNotificationError {
  code?: string;
  message: string;
}
export interface CheckEventData {
  mode?: 'full' | 'changed';
  changedFrom?: string;
  filesChecked?: number;
  errors?: number;
  warnings?: number;
  durationMs?: number;
  error?: SafeNotificationError;
}
export interface BuildEventData {
  subscriptionCode?: string;
  applicationCode?: string;
  buildCode?: string;
  buildName?: string;
  branch?: string;
  buildStatus?: string;
  durationMs?: number;
  retryCount?: number;
  error?: SafeNotificationError;
}
export interface DeploymentEventData {
  subscriptionCode?: string;
  applicationCode?: string;
  deploymentCode?: string;
  buildCode?: string;
  environmentCode?: string;
  deploymentMode?: string;
  databaseUpdateMode?: string;
  deploymentStatus?: string;
  durationMs?: number;
  decisionType?: string;
  error?: SafeNotificationError;
}
interface EventBase {
  schemaVersion: 1;
  eventId: string;
  occurredAt: string;
  source: NotificationSource;
  context?: NotificationContext;
  links?: NotificationLink[];
  [key: string]: unknown;
}
export type CheckEventOutcome =
  | {
      status: 'success' | 'warning' | 'failure';
      data: CheckEventData & Required<Pick<CheckEventData, 'filesChecked' | 'errors' | 'warnings'>>;
    }
  | { status: 'cancelled' | 'internal-error'; data: CheckEventData };
export type CheckEvent = EventBase & { eventType: 'check.completed' } & CheckEventOutcome;
export type BuildEvent = EventBase &
  (
    | { eventType: 'ccv2.build.started'; status: 'started' }
    | { eventType: 'ccv2.build.completed'; status: CompletedStatus }
  ) & { data: BuildEventData };
export type DeploymentEvent = EventBase &
  (
    | { eventType: 'ccv2.deployment.started'; status: 'started' }
    | { eventType: 'ccv2.deployment.completed'; status: CompletedStatus }
    | { eventType: 'ccv2.deployment.action-required'; status: 'action-required' }
  ) & { data: DeploymentEventData };
export type NotificationEvent = CheckEvent | BuildEvent | DeploymentEvent;
