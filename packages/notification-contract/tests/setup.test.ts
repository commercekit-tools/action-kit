import { describe, expect, it } from 'vitest';
import {
  createSetupEvent,
  createBuildEvent,
  createDeploymentEvent,
  createCheckEvent,
  validateNotificationEvent,
} from '../src/index.js';
describe('additive setup and cross-action context', () => {
  for (const status of ['success', 'warning', 'failure', 'cancelled', 'internal-error'] as const)
    it(`creates a supported setup ${status} event`, () => {
      const event = createSetupEvent({
        status,
        data: {
          requestedVersion: 'latest',
          version: '1.0.0',
          target: 'linux-x64',
          buildId: 'synthetic-build',
          cacheHit: true,
          durationMs: 12,
          inputs: { version: 'latest' },
          inputsValidated: true,
          inputsTruncated: false,
          issues: [{ code: 'safe-issue', message: 'A safe explanation.' }],
        },
        env: { GITHUB_REPOSITORY: 'synthetic/repo', GITHUB_RUN_ID: '42' },
      });
      expect(event.eventType).toBe('commercekit.setup.completed');
      expect(event.source.component).toBe('setup-commercekit');
      expect(event.context?.runUrl).toBe('https://github.com/synthetic/repo/actions/runs/42');
      expect(validateNotificationEvent(event)).toBe(event);
      expect(event.data.inputs).toEqual({ version: 'latest' });
    });
  it('projects safe setup fields and accepts failures before version resolution', () => {
    const event = createSetupEvent({
      status: 'failure',
      data: { error: { code: 'invalid-version', message: 'Invalid version.' }, ...{ unexpected: 'omit' } },
    });
    expect(event.data).toEqual({ error: { code: 'invalid-version', message: 'Invalid version.' } });
  });
  for (const patch of [
    { cacheHit: 'true' },
    { version: 'x'.repeat(129) },
    { durationMs: -1 },
    { durationMs: Number.MAX_SAFE_INTEGER + 1 },
    { inputsValidated: 'true' },
    { inputsTruncated: 1 },
    { issues: Array.from({ length: 4 }, () => ({ message: 'issue' })) },
    { inputs: { 'client-secret': 'raw-private' } },
    { inputs: { 'api-key': 'private' } },
    { inputs: { 'client-id': 'private' } },
    { inputs: { version: 'x'.repeat(257) } },
    { inputs: { BadName: 'invalid' } },
    { inputs: { version: 1 } },
    { inputs: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`key-${i}`, 'value'])) },
  ])
    it(`rejects malformed setup data ${Object.keys(patch).join()}`, () => {
      const event = createSetupEvent({ status: 'success', data: {} });
      expect(() => validateNotificationEvent({ ...event, data: patch })).toThrow('Invalid NotificationEvent');
    });
  it('does not change build/deploy completed status semantics', () => {
    for (const event of [
      createBuildEvent({ status: 'success', data: {} }),
      createDeploymentEvent({ status: 'success', data: {} }),
    ])
      expect(() => validateNotificationEvent({ ...event, status: 'warning' })).toThrow();
    expect(() =>
      validateNotificationEvent({ ...createSetupEvent({ status: 'success', data: {} }), status: 'started' }),
    ).toThrow();
  });
  it('accepts bounded input contexts and issues in existing events without requiring them', () => {
    const context = {
      inputs: {
        'client-secret': '[REDACTED]',
        'client-id': '[REDACTED]',
        resource: '[REDACTED]',
        branch: 'main',
      },
      inputsValidated: true,
      inputsTruncated: false,
      issues: [{ message: 'An actionable safe issue.' }],
    };
    const build = createBuildEvent({ status: 'failure', data: context });
    const deploy = createDeploymentEvent({ status: 'action-required', data: context });
    const check = createCheckEvent({
      status: 'warning',
      data: { filesChecked: 1, errors: 0, warnings: 1, ...context },
    });
    for (const event of [build, deploy, check]) {
      expect(event.data.inputs).toEqual(context.inputs);
      expect(event.data.issues).toEqual(context.issues);
      expect(() =>
        validateNotificationEvent({ ...event, data: { ...event.data, inputs: { password: 'private' } } }),
      ).toThrow();
    }
  });
});
