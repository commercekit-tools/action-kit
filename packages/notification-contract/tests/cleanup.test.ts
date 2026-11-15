import { describe, expect, it } from 'vitest';
import {
  createBuildCleanupEvent,
  createBuildEvent,
  createDeploymentEvent,
  validateNotificationEvent,
  type BuildCleanupInputSnapshot,
} from '../src/index.js';
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
  for (const status of ['success', 'warning', 'failure', 'cancelled', 'internal-error'] as const)
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
    expect(() => validateNotificationEvent({ ...event, status: 'started' })).toThrow();
    expect(() => validateNotificationEvent({ ...event, status: 'action-required' })).toThrow();
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

const inputs: BuildCleanupInputSnapshot = {
  'token-endpoint': '[REDACTED]',
  'client-id': '[REDACTED]',
  'client-secret': '[REDACTED]',
  resource: '[REDACTED]',
  'subscription-code': 'synthetic-subscription',
  'api-base-url': 'https://synthetic.example',
  'application-code': '(all applications)',
  'retention-days': '30',
  'keep-latest': '10',
  'dry-run': 'true',
  'max-deletions': '20',
  'exclude-build-codes': '(none)',
  'timeout-minutes': '15',
  'continue-on-delete-error': 'false',
};
const extended = {
  ...data,
  inputs,
  inputsValidated: true,
  inputsTruncated: false,
  protectedCount: 12,
  blockedCount: 8,
  issues: [{ code: 'eligibility-unverified', message: 'Deletion eligibility was not verified.' }],
};

describe('cleanup warning and redacted input context', () => {
  it('round-trips all supplied input names and bounded warning detail', () => {
    const event = createBuildCleanupEvent({ status: 'warning', data: extended });
    expect(event.status).toBe('warning');
    expect(event.data).toEqual(extended);
    expect(Object.keys(event.data.inputs ?? {})).toHaveLength(14);
    expect(validateNotificationEvent(JSON.parse(JSON.stringify(event)))).toEqual(event);
  });

  it('keeps old cleanup events and unrelated completed-status vocabularies unchanged', () => {
    const event = createBuildCleanupEvent({ status: 'success', data });
    expect(event.data).not.toHaveProperty('inputs');
    for (const old of [
      createBuildEvent({ status: 'success', data: {} }),
      createDeploymentEvent({ status: 'success', data: {} }),
    ])
      expect(() => validateNotificationEvent({ ...old, status: 'warning' })).toThrow(
        'Invalid NotificationEvent',
      );
  });

  for (const name of ['token-endpoint', 'client-id', 'client-secret', 'resource'])
    it(`rejects unredacted confidential ${name} without echoing its value`, () => {
      const event = createBuildCleanupEvent({ status: 'warning', data: extended });
      expect(() =>
        validateNotificationEvent({
          ...event,
          data: { ...extended, inputs: { ...inputs, [name]: 'synthetic-confidential-value' } },
        }),
      ).toThrowError(/^Invalid NotificationEvent v1\.$/);
    });

  for (const name of Object.keys(inputs))
    it(`requires ${name} when a snapshot is supplied`, () => {
      const snapshot = Object.fromEntries(Object.entries(inputs).filter(([key]) => key !== name));
      const event = createBuildCleanupEvent({ status: 'warning', data: extended });
      expect(() => validateNotificationEvent({ ...event, data: { ...extended, inputs: snapshot } })).toThrow(
        'Invalid NotificationEvent',
      );
    });

  it('rejects snapshot expansion, non-string fields and an oversized display value', () => {
    const event = createBuildCleanupEvent({ status: 'warning', data: extended });
    for (const snapshot of [
      { ...inputs, raw: 'synthetic-confidential-value' },
      { ...inputs, 'keep-latest': 10 },
      { ...inputs, 'exclude-build-codes': 'x'.repeat(257) },
      null,
      [],
    ])
      expect(() => validateNotificationEvent({ ...event, data: { ...extended, inputs: snapshot } })).toThrow(
        'Invalid NotificationEvent',
      );
    expect(
      createBuildCleanupEvent({
        status: 'success',
        data: { ...extended, inputs: { ...inputs, 'exclude-build-codes': 'x'.repeat(256) } },
      }).data.inputs?.['exclude-build-codes'],
    ).toHaveLength(256);
  });

  it('preserves boolean and count boundary values and three safe issues', () => {
    const event = createBuildCleanupEvent({
      status: 'failure',
      data: {
        ...extended,
        inputsValidated: false,
        inputsTruncated: true,
        protectedCount: 0,
        blockedCount: Number.MAX_SAFE_INTEGER,
        issues: [{ message: 'First' }, { code: 'SECOND', message: 'Second' }, { code: '', message: 'Third' }],
      },
    });
    expect(event.data).toMatchObject({
      inputsValidated: false,
      inputsTruncated: true,
      protectedCount: 0,
      blockedCount: Number.MAX_SAFE_INTEGER,
    });
    expect(event.data.issues).toHaveLength(3);
    expect(
      createBuildCleanupEvent({ status: 'success', data: { ...extended, issues: [] } }).data.issues,
    ).toEqual([]);
  });

  for (const patch of [
    { inputsValidated: 'true' },
    { inputsTruncated: 1 },
    { protectedCount: -1 },
    { protectedCount: 0.5 },
    { blockedCount: Number.MAX_SAFE_INTEGER + 1 },
    { issues: Array(4).fill({ message: 'Too many' }) },
    { issues: [null] },
    { issues: ['unsafe'] },
    { issues: [{}] },
    { issues: [{ code: 'x'.repeat(101), message: 'Safe' }] },
    { issues: [{ message: 'x'.repeat(1001) }] },
  ])
    it(`rejects invalid optional context ${JSON.stringify(patch).slice(0, 70)}`, () => {
      expect(() =>
        Reflect.apply(createBuildCleanupEvent, undefined, [
          { status: 'warning', data: { ...extended, ...patch } },
        ]),
      ).toThrow('Invalid NotificationEvent');
    });

  it('projects safe issue fields without retaining raw nested payloads', () => {
    const source = {
      ...extended,
      issues: [
        { code: 'SYNTHETIC', message: 'Safe issue', raw: 'synthetic-confidential-value' },
        { message: 'No code', raw: 'synthetic-confidential-value' },
      ],
    };
    const event = createBuildCleanupEvent({ status: 'warning', data: source });
    expect(event.data.issues).toEqual([{ code: 'SYNTHETIC', message: 'Safe issue' }, { message: 'No code' }]);
    expect(JSON.stringify(event)).not.toContain('synthetic-confidential-value');
  });
});
