import { describe, expect, it } from 'vitest';
import { createBuildCleanupEvent, validateNotificationEvent } from '../src/index.js';
const data = {
  mode: 'dry-run' as const,
  subscriptionCode: 'test-subscription',
  retentionDays: 30,
  keepLatest: 10,
  cleanupStatus: 'dry-run',
  scannedCount: 20,
  eligibleCount: 4,
  plannedCount: 2,
  deletionRequestedCount: 0,
  skippedCount: 16,
  failedCount: 0,
  unknownCount: 0,
  deferredCount: 2,
  durationMs: 1200,
};
describe('cleanup event', () => {
  for (const status of ['success', 'failure', 'cancelled', 'internal-error'] as const)
    it(`creates and validates ${status}`, () => {
      const event = createBuildCleanupEvent({
        status,
        data,
        env: { GITHUB_REPOSITORY: 'test/repo', GITHUB_RUN_ID: '42' },
      });
      expect(event.eventType).toBe('ccv2.build-cleanup.completed');
      expect(event.source.component).toBe('ccv2-build-cleanup');
      expect(event.data).toEqual(data);
      expect(event.context?.runUrl).toBe('https://github.com/test/repo/actions/runs/42');
      expect(validateNotificationEvent(event)).toBe(event);
    });
  for (const patch of [
    { mode: 'truthy' },
    { subscriptionCode: '' },
    { keepLatest: 0 },
    { retentionDays: -1 },
    { failedCount: 0.5 },
    { durationMs: Number.MAX_SAFE_INTEGER + 1 },
    { cleanupStatus: 'x'.repeat(101) },
  ])
    it(`rejects invalid cleanup data ${JSON.stringify(patch)}`, () => {
      const event = createBuildCleanupEvent({ status: 'success', data });
      expect(() => validateNotificationEvent({ ...event, data: { ...data, ...patch } })).toThrow(
        'Invalid NotificationEvent',
      );
    });
  it('rejects non-completed status and missing fields', () => {
    const event = createBuildCleanupEvent({ status: 'success', data });
    expect(() => validateNotificationEvent({ ...event, status: 'warning' })).toThrow();
    expect(() => validateNotificationEvent({ ...event, data: {} })).toThrow();
  });
  it('projects data and safe error fields', () => {
    const event = createBuildCleanupEvent({
      status: 'failure',
      data: { ...data, error: { code: 'FAIL', message: 'Safe', raw: 'secret' }, raw: 'secret' },
    } as Parameters<typeof createBuildCleanupEvent>[0]);
    expect(event.data).not.toHaveProperty('raw');
    expect(event.data.error).toEqual({ code: 'FAIL', message: 'Safe' });
  });
});
