import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import * as api from '../src/index.js';
import { schema } from '../src/schema.js';
const fixture = () =>
  api.createCheckEvent({ status: 'success', data: { filesChecked: 1, errors: 0, warnings: 0 } });
describe('v1 schema and semantic validation', () => {
  it('preserves the canonical schema', () =>
    expect(schema).toEqual(
      JSON.parse(
        readFileSync('packages/notification-contract/schema/notification-event-v1.schema.json', 'utf8'),
      ),
    ));
  for (const kind of ['check', 'build', 'deployment'])
    for (const name of readdirSync(`compatibility/fixtures/${kind}`))
      it(`${kind}/${name}`, () => {
        const value = readFileSync(`compatibility/fixtures/${kind}/${name}`, 'utf8');
        expect(api.parseNotificationEventJson(value).schemaVersion).toBe(1);
      });
  for (const patch of [
    { schemaVersion: 2 },
    { eventType: 'other' },
    { status: 'started' },
    { data: { filesChecked: -1 } },
    { data: {} },
    { links: Array(4).fill({ label: 'x', url: 'https://example.com' }) },
    { eventId: 'x'.repeat(129) },
    { context: { runUrl: 'http://example.com' } },
  ])
    it(`rejects ${JSON.stringify(patch)}`, () =>
      expect(() => api.validateNotificationEvent({ ...fixture(), ...patch })).toThrow());
  for (const value of [null, [], 4, 'x', false])
    it(`rejects nonobject ${value}`, () => expect(() => api.validateNotificationEvent(value)).toThrow());
  for (const url of [
    'http://example.com',
    'https://a:b@example.com',
    'https://example.com/#x',
    'https://example.com/#',
    'not url',
    'https://example.com/\n',
    'https://example.com/' + 'x'.repeat(2048),
  ])
    it(`unsafe URL ${url.slice(0, 40)}`, () => expect(() => api.validateNotificationLink(url)).toThrow());
  it('accepts additive optional properties', () => {
    const v = {
      ...fixture(),
      future: true,
      data: { filesChecked: 0, errors: 0, warnings: 0, future: true },
      links: [{ label: 'safe', url: 'https://example.com' }],
    };
    expect(api.validateNotificationEvent(v)).toBe(v);
  });
  it('parses safely and enforces bytes', () => {
    expect(() => api.parseNotificationEventJson('{secret')).toThrow('JSON');
    expect(() => api.parseNotificationEventJson('é', { maxBytes: 1 })).toThrow('byte limit');
    expect(api.parseNotificationEventJson(JSON.stringify(fixture()))).toBeTruthy();
  });
});
describe('safe context', () => {
  const env = {
    GITHUB_REPOSITORY: 'synthetic/example',
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '2',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: 'abc',
    GITHUB_ACTOR: 'synthetic',
    GITHUB_WORKFLOW: 'test',
    GITHUB_JOB: 'job',
  };
  it('extracts approved fields only', () => {
    const c = api.extractSafeGitHubContext({ ...env, UNAPPROVED: 'secret' });
    expect(c).toEqual({
      repository: 'synthetic/example',
      runId: '123',
      runAttempt: 2,
      ref: 'refs/heads/main',
      commit: 'abc',
      actor: 'synthetic',
      workflow: 'test',
      job: 'job',
      runUrl: 'https://github.com/synthetic/example/actions/runs/123',
    });
  });
  for (const patch of [
    { GITHUB_REPOSITORY: 'bad' },
    { GITHUB_RUN_ID: 'bad' },
    { GITHUB_RUN_ATTEMPT: '0' },
    { GITHUB_ACTOR: 'x'.repeat(129) },
    { GITHUB_JOB: 'a\nb' },
    { GITHUB_SERVER_URL: 'http://example.com' },
    { GITHUB_SERVER_URL: 'https://example.com/path' },
    { GITHUB_SERVER_URL: 'https://example.com/?q=x' },
  ])
    it('omits unsafe environment ' + JSON.stringify(patch), () => {
      const c = api.extractSafeGitHubContext({ ...env, ...patch });
      expect(c).not.toContain('secret');
    });
  it('handles missing values', () => expect(api.extractSafeGitHubContext({})).toEqual({}));
  for (const merge of [api.mergeProducerContext, api.mergeNotifierContext])
    it('preserves explicit producer values and fills only gaps', () => {
      const provided = {
        repository: 'producer/repo',
        actor: '',
        future: true,
        runUrl: 'https://example.com/run',
      };
      const c = merge(provided, { repository: 'notifier/repo', actor: 'synthetic', runId: '12' });
      expect(c).toEqual({ ...provided, actor: 'synthetic', runId: '12' });
      expect(provided.actor).toBe('');
      expect(() => merge({ runUrl: 'http://example.com' }, {})).toThrow();
    });
});
describe('factories', () => {
  it('sets metadata, omits raw and nested error properties', () => {
    const e = api.createBuildEvent({
      status: 'failure',
      data: {
        buildCode: 'synthetic',
        error: { message: 'safe', code: 'FAIL', raw: 'secret' },
        raw: 'secret',
      } as api.BuildEventData,
    });
    expect(e.eventId).toMatch(/^ckevt_/);
    expect(e.occurredAt).toMatch(/Z$/);
    expect(e.data).toEqual({ buildCode: 'synthetic', error: { code: 'FAIL', message: 'safe' } });
  });
  for (const status of ['started', 'success', 'failure', 'cancelled', 'internal-error'] as const)
    it('build ' + status, () =>
      expect(
        api.createBuildEvent({
          status,
          data: {},
          eventId: 'synthetic',
          occurredAt: '2026-01-01T00:00:00Z',
          source: { product: 'commercekit', component: 'workflow', version: 'test' },
          links: [{ label: 'run', url: 'https://example.com' }],
        }).status,
      ).toBe(status),
    );
  for (const status of [
    'started',
    'success',
    'failure',
    'cancelled',
    'internal-error',
    'action-required',
  ] as const)
    it('deployment ' + status, () =>
      expect(api.createDeploymentEvent({ status, data: { error: { message: 'safe' } } }).status).toBe(status),
    );
  it('rejects missing check counts', () =>
    expect(() => {
      // @ts-expect-error runtime untyped producers still need count validation
      return api.createCheckEvent({ status: 'success', data: {} });
    }).toThrow());
});
describe('focused sanitization', () => {
  it('redacts exact, URL encoded and form encoded secrets', () => {
    expect(api.redactKnownSecrets('a b a%20b a+b', ['', 'a b'])).toBe('[REDACTED] [REDACTED] [REDACTED]');
  });
  it('redacts recognizable credentials', () => {
    const value = api.redactKnownSecrets(
      'Bearer synthetic-token ghp_synthetic token=synthetic\nauthorization: secret\nx-approuter-authorization: secret',
    );
    expect(value).not.toContain('synthetic');
    expect(value).not.toContain('secret');
  });
  it('bounds, strips controls and normalizes labels', () => {
    expect(api.sanitizeBoundedText('a\0b', 3)).toBe('a b');
    expect(api.sanitizeLabel(' a\n b\t c ')).toBe('a b c');
    expect(api.sanitizeLabel('x'.repeat(100))).toHaveLength(75);
    expect(() => api.sanitizeBoundedText('x', -1)).toThrow();
  });
  it('sanitizes errors with safe fallback', () => {
    expect(api.sanitizeErrorMessage('https://example.com/secret at f (stack)')).toBe('[URL]');
    expect(api.sanitizeErrorMessage('')).toBe('Operation failed.');
    expect(api.sanitizeBoundedText('ok')).toBe('ok');
  });
});
it('redacts longer registered secrets first', () =>
  expect(api.redactKnownSecrets('long-secret short', ['short', 'long-secret'])).toBe(
    '[REDACTED] [REDACTED]',
  ));
for (const merge of [api.mergeProducerContext, api.mergeNotifierContext])
  it('derives missing run links from merged producer identity', () => {
    const extracted = api.extractSafeGitHubContext({
      GITHUB_REPOSITORY: 'synthetic/runner',
      GITHUB_RUN_ID: '222',
      GITHUB_SERVER_URL: 'https://github.synthetic.example',
    });
    expect(merge({ repository: 'synthetic/producer', runId: '111' }, extracted).runUrl).toBe(
      'https://github.synthetic.example/synthetic/producer/actions/runs/111',
    );
    expect(merge({ repository: 'invalid', runId: '111' }, extracted).runUrl).toBeUndefined();
    expect(merge({ repository: 'synthetic/producer', runId: 'invalid' }, extracted).runUrl).toBeUndefined();
    expect(
      merge({ repository: 'synthetic/producer', runId: undefined }, { runUrl: 'https://github.com/path' })
        .runUrl,
    ).toBeUndefined();
  });
