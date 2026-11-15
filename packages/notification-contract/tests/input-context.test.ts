import { describe, expect, it } from 'vitest';
import {
  captureActionInputs,
  createActionInputContext,
  isConfidentialInputName,
  sanitizeActionText,
  redactKnownSecrets,
  type ActionInputDefinition,
} from '../src/index.js';

const definitions: readonly ActionInputDefinition[] = [
  { name: 'version' },
  { name: 'client-secret' },
  { name: 'client-id' },
  { name: 'resource' },
  { name: 'token-endpoint' },
  { name: 'api-base-url', display: 'url-origin' },
  { name: 'custom', confidential: true },
  { name: 'payload', display: 'presence' },
];
describe('shared action input context', () => {
  it('captures each name once, masking each secret before public values are read', () => {
    const operations: string[] = [];
    const raw = captureActionInputs(
      definitions,
      (name) => {
        operations.push(`read:${name}`);
        return name === 'resource' ? '' : name;
      },
      (value) => operations.push(`mask:${value}`),
    );
    expect(Object.keys(raw)).toEqual(definitions.map(({ name }) => name));
    expect(operations).toEqual([
      'read:client-secret',
      'mask:client-secret',
      'read:client-id',
      'mask:client-id',
      'read:resource',
      'read:token-endpoint',
      'mask:token-endpoint',
      'read:custom',
      'mask:custom',
      'read:version',
      'read:api-base-url',
      'read:payload',
    ]);
  });
  it('permits no inputs and propagates input-read failures before publishing anything', () => {
    expect(
      captureActionInputs(
        [],
        () => '',
        () => {},
      ),
    ).toEqual({});
    expect(() =>
      captureActionInputs(
        definitions,
        () => {
          throw Error('read failed');
        },
        () => {},
      ),
    ).toThrow('read failed');
  });
  for (const invalid of [
    [{ name: 'bad_name' }],
    [{ name: 'version' }, { name: 'version' }],
    Array.from({ length: 51 }, (_, n) => ({ name: `input-${n}` })),
  ])
    it('rejects invalid or unbounded definitions', () => {
      expect(() =>
        captureActionInputs(
          invalid,
          () => '',
          () => {},
        ),
      ).toThrow('Invalid action input definitions');
      expect(() => createActionInputContext(invalid, {}, { validated: false })).toThrow(
        'Invalid action input definitions',
      );
    });
  for (const name of [
    'client-id',
    'CLIENT_ID',
    'resource',
    'token-endpoint',
    'db-password',
    'webhook-url',
    'api-key',
    'private_key',
    'credential',
  ])
    it(`recognizes confidential ${name}`, () => expect(isConfidentialInputName(name)).toBe(true));
  it('keeps public names public', () => expect(isConfidentialInputName('timeout-minutes')).toBe(false));
  it('reports every setting, normalized defaults and forced authentication placeholders', () => {
    const context = createActionInputContext(
      definitions,
      { version: '', custom: 'private', payload: 'secret data' },
      { validated: true, effective: { version: 'latest', 'api-base-url': 'https://public.example.test/' } },
    );
    expect(context).toEqual({
      inputs: {
        version: 'latest',
        'client-secret': '[REDACTED]',
        'client-id': '[REDACTED]',
        resource: '[REDACTED]',
        'token-endpoint': '[REDACTED]',
        'api-base-url': 'https://public.example.test',
        custom: '[REDACTED]',
        payload: '[PROVIDED: VALUE OMITTED]',
      },
      inputsValidated: true,
      inputsTruncated: false,
    });
  });
  it('does not substitute effective configuration for a rejected input', () => {
    expect(
      createActionInputContext(
        [{ name: 'version' }, { name: 'blank' }],
        { version: 'invalid' },
        { validated: false, effective: { version: 'latest' } },
      ),
    ).toEqual({
      inputs: { version: 'invalid', blank: '(not set)' },
      inputsValidated: false,
      inputsTruncated: false,
    });
    const inherited = Object.create({ version: 'inherited' });
    expect(
      createActionInputContext(
        [{ name: 'version' }],
        { version: 'raw' },
        { validated: true, effective: inherited },
      ).inputs.version,
    ).toBe('raw');
  });
  it('redacts confidential and received tokens in other values, including sanitizer output', () => {
    const context = createActionInputContext(
      definitions,
      {
        'client-secret': 'private marker',
        version: 'private marker|private%20marker|private+marker|received-token',
      },
      {
        validated: true,
        secrets: ['received-token'],
        sanitize: (value, max) => {
          expect(max).toBe(Number.MAX_SAFE_INTEGER);
          return `${value} private marker received-token`;
        },
      },
    );
    expect(JSON.stringify(context)).not.toContain('private marker');
    expect(JSON.stringify(context)).not.toContain('private%20marker');
    expect(JSON.stringify(context)).not.toContain('private+marker');
    expect(JSON.stringify(context)).not.toContain('received-token');
    expect(context.inputs.version).toContain('[REDACTED]');
  });
  it('handles malformed Unicode credentials without abandoning redaction', () => {
    const secret = '\ud800private';
    expect(redactKnownSecrets(`${secret} %EF%BF%BDprivate`, [secret])).toBe('[REDACTED] [REDACTED]');
    expect(
      createActionInputContext(
        definitions,
        { 'client-secret': secret, version: secret },
        { validated: false },
      ).inputs.version,
    ).toBe('[REDACTED]');
  });
  it('redacts URL and form secrets with upper, lower and mixed percent hex without folding literal text', () => {
    const secret = 'Synthetic/Private+Value €';
    const url = encodeURIComponent(secret);
    const form = new URLSearchParams({ value: secret }).toString().slice(6);
    const lower = url.replace(/%[0-9A-F]{2}/g, (escape) => escape.toLowerCase());
    const mixed = form.replace(/%[0-9A-F]{2}/g, (escape, index: number) =>
      index % 2 ? escape.toLowerCase() : escape,
    );
    const value = `${url}|${lower}|${mixed}|${form}|${lower}`;
    expect(redactKnownSecrets(value, [secret])).toBe(Array(5).fill('[REDACTED]').join('|'));
    expect(redactKnownSecrets(lower.replace('Synthetic', 'synthetic'), [secret])).toBe(
      lower.replace('Synthetic', 'synthetic'),
    );
    const context = createActionInputContext(
      [{ name: 'client-secret' }, { name: 'branch' }],
      { 'client-secret': secret, branch: value },
      { validated: false },
    );
    expect(context.inputs.branch).toBe(Array(5).fill('[REDACTED]').join('|'));
    expect(sanitizeActionText(value, 256, [secret])).toBe(Array(5).fill('[REDACTED]').join('|'));
    expect(redactKnownSecrets('100% private', ['100% private'])).toBe('[REDACTED]');
  });
  it('bounds after redaction and marks multibyte previews explicitly', () => {
    const context = createActionInputContext(
      [{ name: 'version' }],
      { version: '✅'.repeat(257) },
      { validated: true },
    );
    expect([...context.inputs.version!].length).toBeLessThanOrEqual(256);
    expect(context.inputs.version).toMatch(/… \[truncated\]$/);
    expect(context.inputsTruncated).toBe(true);
    expect(
      createActionInputContext([{ name: 'version' }], { version: 'a'.repeat(256) }, { validated: true })
        .inputsTruncated,
    ).toBe(false);
  });
  for (const name of ['event-json', 'event-file', 'traffic-split-json', 'decision-reason', 'cancel-reason'])
    it(`omits free-form ${name} values by policy`, () => {
      expect(
        createActionInputContext([{ name }], { [name]: 'unclassified secret' }, { validated: false }).inputs[
          name
        ],
      ).toBe('[PROVIDED: VALUE OMITTED]');
      expect(createActionInputContext([{ name }], {}, { validated: true }).inputs[name]).toBe('(not set)');
    });
  for (const url of [
    'http://public.example.test',
    'https://user:pass@public.example.test',
    'https://public.example.test?key=private',
    'https://public.example.test#private',
    'https://public.example.test/path',
    'not-a-url',
  ])
    it(`does not echo invalid/private API origins: ${url}`, () =>
      expect(
        createActionInputContext(
          [{ name: 'api-base-url', display: 'url-origin' }],
          { 'api-base-url': url },
          { validated: false },
        ).inputs['api-base-url'],
      ).toBe('[INVALID OR PRIVATE URL]'));
  it('reports a blank optional origin safely', () =>
    expect(
      createActionInputContext([{ name: 'api-base-url', display: 'url-origin' }], {}, { validated: false })
        .inputs['api-base-url'],
    ).toBe('(not set)'));
  for (const value of [
    'https://user:pass@example.test/path',
    'https://example.test?private=value',
    'https://example.test/#private',
    'https://' + 'hooks.slack.com/services/opaque/value',
    'https://hooks.slack-gov.com/services/opaque/value',
    'https://' + 'hooks.slack.com./services/synthetic/private',
    'https://' + 'HOOKS.SLACK.COM./services/synthetic/private',
    'https://' + '%68ooks.slack.com./services/synthetic/private',
    'https://' + 'hooks.slack-gov.com./services/synthetic/private',
    'https://%',
  ])
    it(`redacts private URL-shaped display text: ${value}`, () =>
      expect(sanitizeActionText(value)).toBe('[REDACTED URL]'));
  it('preserves ordinary public origins and removes known credential shapes', () => {
    expect(sanitizeActionText('https://public.example.test')).toBe('https://public.example.test');
    expect(
      sanitizeActionText('eyJheader.payload.signature ghp_privateMarker Bearer opaque\u0000'),
    ).not.toContain('privateMarker');
    expect(sanitizeActionText('eyJheader.payload.signature')).toBe('[REDACTED]');
    expect(() => sanitizeActionText('public', -1)).toThrow('Invalid text limit');
  });
});
