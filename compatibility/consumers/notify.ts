import {
  validateNotificationEvent,
  mergeNotifierContext,
  extractSafeGitHubContext,
} from '../../packages/notification-contract/src/index.js';
export function acceptNotification(value: unknown) {
  const event = validateNotificationEvent(value);
  return validateNotificationEvent({
    ...event,
    context: mergeNotifierContext(
      event.context ?? {},
      extractSafeGitHubContext({ GITHUB_REPOSITORY: 'synthetic/notifier', GITHUB_RUN_ID: '999' }),
    ),
  });
}
