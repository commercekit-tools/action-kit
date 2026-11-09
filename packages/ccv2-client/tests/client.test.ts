import { setTimeout as nodeTimer } from 'node:timers/promises';
import { it, expect, vi } from 'vitest';
vi.mock('node:timers/promises', { spy: true });
import {
  TechnicalUserTokenManager,
  createCcv2Client,
  validateManagementApiBaseUrl,
  validateTechnicalUserTokenEndpoint,
  parseRetryAfter,
  exponentialBackoff,
  parseProblemResponse,
  redactTransportText,
  Ccv2TransportError,
} from '../src/index.js';
import { transport } from '../src/transport.js';
import { defaultRuntime } from '../src/retry.js';
import type { RuntimeDependencies, RequestPolicy } from '../src/index.js';
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const credentials = {
  tokenEndpoint: 'https://auth.example.com/token',
  clientId: 'synthetic id',
  clientSecret: 'synthetic&secret',
  resource: 'synthetic/resource',
};
function runtime(fetcher: typeof fetch): RuntimeDependencies {
  return {
    ...defaultRuntime,
    fetch: fetcher,
    sleep: vi.fn(async () => {}),
    now: () => 1000,
    random: () => 0,
  };
}
function setup(responses: (Response | Error)[], policy: RequestPolicy = 'safe-read') {
  const fetcher = vi.fn(async () => {
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return r!;
  });
  const rt = runtime(fetcher);
  const tokens = { get: vi.fn(async () => 'synthetic-access'), invalidate: vi.fn() };
  const client = createCcv2Client({
    baseUrl: 'https://api.example.com/root',
    tokens,
    runtime: rt,
    secrets: ['synthetic-secret'],
  });
  return {
    client,
    fetcher,
    rt,
    tokens,
    request: (options = {}) => client.request('path', { policy, ...options }),
  };
}
it('form encodes tokens, caches and masks memory-only credentials', async () => {
  const fetcher = vi.fn(async () =>
    json({ access_token: 'synthetic-access', token_type: 'bearer', expires_in: 100 }),
  );
  const mask = vi.fn();
  const rt = runtime(fetcher);
  let now = 0;
  rt.now = () => now;
  const tokens = new TechnicalUserTokenManager(credentials, { runtime: { ...rt, maskSecret: mask } });
  expect(await tokens.get()).toBe('synthetic-access');
  await tokens.get();
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
  expect(url.href).toBe(credentials.tokenEndpoint);
  expect(init.redirect).toBe('error');
  expect(init.headers).toEqual({
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  });
  expect(new URLSearchParams(init.body as string).get('client_secret')).toBe(credentials.clientSecret);
  expect(new URLSearchParams(init.body as string).get('grant_type')).toBe('client_credentials');
  expect(mask).toHaveBeenCalledWith('synthetic-access');
  expect(mask).toHaveBeenCalledWith(credentials.clientSecret);
  now = 90000;
  await tokens.get();
  expect(fetcher).toHaveBeenCalledTimes(2);
  tokens.invalidate();
  await tokens.get();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(JSON.stringify(tokens)).not.toContain(credentials.clientSecret);
});
it('caches absent expiry until invalidation', async () => {
  const f = vi.fn(async () => json({ access_token: 'synthetic', token_type: 'Bearer' }));
  const t = new TechnicalUserTokenManager(credentials, { runtime: runtime(f), safetyWindowMs: 0 });
  await t.get();
  await t.get();
  expect(f).toHaveBeenCalledTimes(1);
});
for (const value of [
  {},
  { access_token: '' },
  { access_token: 'a b', token_type: 'Bearer' },
  { access_token: 'a', token_type: 'Other' },
  { access_token: 'a', token_type: 'Bearer', expires_in: 0 },
  { access_token: 'a', token_type: 'Bearer', expires_in: 1.5 },
  null,
])
  it('rejects malformed token ' + JSON.stringify(value), async () => {
    const t = new TechnicalUserTokenManager(credentials, { runtime: runtime(async () => json(value)) });
    await expect(t.get()).rejects.toMatchObject({ code: 'INVALID_TOKEN' });
  });
it('rejects nonJSON and HTTP token errors', async () => {
  for (const response of [new Response('abc'), json({}, 401)]) {
    const t = new TechnicalUserTokenManager(credentials, { runtime: runtime(async () => response) });
    await expect(t.get()).rejects.toBeInstanceOf(Ccv2TransportError);
  }
});
it('validates credential options and aborts cached tokens', async () => {
  expect(() => new TechnicalUserTokenManager({ ...credentials, clientSecret: '' })).toThrow();
  expect(() => new TechnicalUserTokenManager(credentials, { safetyWindowMs: -1 })).toThrow();
  const t = new TechnicalUserTokenManager(credentials);
  await expect(t.get(AbortSignal.abort())).rejects.toMatchObject({ code: 'ABORTED' });
});
for (const validator of [validateManagementApiBaseUrl, validateTechnicalUserTokenEndpoint]) {
  for (const url of [
    'http://example.com',
    'https://a:b@example.com',
    'https://example.com/?query',
    'https://example.com/#',
    'bad',
    'https://example.com/ a',
    'https://example.com/\\path',
    'https://example.com/' + 'x'.repeat(2049),
  ])
    it('rejects unsafe URL ' + url.slice(0, 50), () => expect(() => validator(url)).toThrow('INVALID_URL'));
  it('accepts safe URL', () => expect(validator('https://example.com/path').protocol).toBe('https:'));
}
it('normalizes base trailing slash', () =>
  expect(validateManagementApiBaseUrl('https://example.com/path///').href).toBe('https://example.com/path/'));
for (const value of [{ a: 1 }, [1, 2], null, 3, 'text', false])
  it('preserves JSON ' + JSON.stringify(value), async () =>
    expect((await setup([json(value)]).request()).body).toEqual({ kind: 'json', value }),
  );
for (const status of [202, 204])
  it('empty ' + status, async () =>
    expect((await setup([new Response(null, { status })]).request()).body).toEqual({ kind: 'empty' }),
  );
it('handles binary and absent content type', async () => {
  for (const headers of [{}, { 'content-type': 'application/octet-stream' }]) {
    const r = await setup([
      new Response(new Uint8Array([0, 255]), { headers: headers as HeadersInit }),
    ]).request();
    expect(r.body.kind).toBe('binary');
    if (r.body.kind === 'binary') expect([...r.body.value]).toEqual([0, 255]);
  }
});
it('handles missing response stream', async () =>
  expect((await setup([new Response(null)]).request()).body).toEqual({ kind: 'empty' }));
it('rejects malformed JSON and oversized bodies without retries', async () => {
  for (const response of [
    new Response('{', { headers: { 'content-type': 'application/json' } }),
    json('x'.repeat(100)),
  ]) {
    const s = setup([response]);
    await expect(s.request({ maxResponseBytes: 10 })).rejects.toBeInstanceOf(Ccv2TransportError);
    expect(s.fetcher).toHaveBeenCalledTimes(1);
  }
});
for (const policy of ['safe-read', 'token'] as const)
  for (const status of [429, 500, 502, 503, 504])
    it(policy + ' retries ' + status, async () => {
      const s = setup([json({}, status), json({ ok: true })], policy);
      await s.request();
      expect(s.fetcher).toHaveBeenCalledTimes(2);
      expect(s.rt.sleep).toHaveBeenCalledWith(1000, undefined);
    });
for (const response of [json({}, 429), json({}, 500), new Error('Bearer synthetic-secret')])
  it('unsafe mutation attempts once', async () => {
    const s = setup([response], 'unsafe-mutation');
    try {
      await s.request({ method: 'POST' });
    } catch (e) {
      expect(JSON.stringify(e)).not.toContain('synthetic-secret');
    }
    expect(s.fetcher).toHaveBeenCalledTimes(1);
    expect(s.rt.sleep).not.toHaveBeenCalled();
  });
it('safe-read retries network failures and stops at bounded limit', async () => {
  const s = setup([new Error('secret'), new Error('secret'), new Error('secret')]);
  await expect(s.request()).rejects.toMatchObject({ code: 'REQUEST_FAILED' });
  expect(s.fetcher).toHaveBeenCalledTimes(3);
});
it('returns final transient HTTP status', async () => {
  const s = setup([json({}, 503), json({}, 503), json({}, 503)]);
  expect((await s.request()).status).toBe(503);
});
for (const policy of ['safe-read', 'unsafe-mutation'] as const)
  it('one explicit 401 replay ' + policy, async () => {
    const s = setup([json({}, 401), json({}, 401)], policy);
    expect((await s.request({ refreshOn401: true })).status).toBe(401);
    expect(s.tokens.invalidate).toHaveBeenCalledTimes(1);
    expect(s.fetcher).toHaveBeenCalledTimes(2);
    const init = s.fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(new Headers(init[1].headers).get('x-approuter-authorization')).toBe('Bearer synthetic-access');
  });
it('does not opt into 401 automatically', async () => {
  const s = setup([json({}, 401)]);
  await s.request();
  expect(s.tokens.invalidate).not.toHaveBeenCalled();
});
it('blocks cross-origin and base escapes', async () => {
  for (const path of [
    'https://evil.example/path',
    '../escape',
    '/escape',
    'path#fragment',
    'path\\evil',
    'path\n',
  ])
    await expect(setup([]).client.request(path, { policy: 'safe-read' })).rejects.toMatchObject({
      code: 'INVALID_URL',
    });
});
it('blocks redirect response', async () => {
  const s = setup([new Response(null, { status: 302 })]);
  await expect(s.request()).rejects.toMatchObject({ code: 'HTTP_ERROR', status: 302 });
  expect(s.fetcher).toHaveBeenCalledTimes(1);
});
it('timeouts, caller abort and body abort are safe', async () => {
  const f: typeof fetch = async (_url, init) =>
    new Promise((_resolve, reject) =>
      init?.signal?.addEventListener('abort', () => reject(new Error('secret')), { once: true }),
    );
  const s = createCcv2Client({
    baseUrl: 'https://example.com',
    tokens: { get: async () => 'synthetic', invalidate() {} },
    runtime: runtime(f),
  });
  await expect(s.request('path', { policy: 'unsafe-mutation', timeoutMs: 5 })).rejects.toMatchObject({
    code: 'TIMEOUT',
  });
  const controller = new AbortController();
  const pending = s.request('path', { policy: 'safe-read', signal: controller.signal });
  setTimeout(() => controller.abort(), 5);
  await expect(pending).rejects.toMatchObject({ code: 'ABORTED' });
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array([1]));
    },
  });
  const b = setup([new Response(stream)], 'unsafe-mutation');
  await expect(b.request({ timeoutMs: 5 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  await expect(setup([]).request({ signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'ABORTED' });
});
it('deadline bounds attempts and waits', async () => {
  await expect(setup([]).request({ deadline: 999 })).rejects.toMatchObject({ code: 'DEADLINE' });
  await expect(setup([json({}, 503)]).request({ deadline: 1500 })).rejects.toMatchObject({
    code: 'DEADLINE',
  });
  const s = setup([json({}, 503)]);
  vi.mocked(s.rt.sleep).mockRejectedValueOnce(Error());
  await expect(s.request()).rejects.toMatchObject({ code: 'ABORTED' });
});
for (const patch of [
  { policy: 'invalid' },
  { timeoutMs: 0 },
  { timeoutMs: NaN },
  { maxResponseBytes: 0 },
  { deadline: NaN },
  { retry: { maxAttempts: 0 } },
  { retry: { maxAttempts: 11 } },
  { retry: { baseDelayMs: -1 } },
])
  it('rejects invalid options ' + JSON.stringify(patch), async () => {
    await expect(setup([]).request(patch)).rejects.toMatchObject({ code: 'INVALID_OPTIONS' });
  });
it('parses bounded Retry-After seconds and HTTP dates', () => {
  expect(parseRetryAfter('2', 0)).toBe(2000);
  expect(parseRetryAfter('Thu, 01 Jan 1970 00:00:03 GMT', 1000)).toBe(2000);
  expect(parseRetryAfter('100', 0, 500)).toBe(500);
  for (const v of [null, '', 'bad', '-1', '1.5', '9'.repeat(500)]) expect(parseRetryAfter(v, 0)).toBe(0);
  expect(parseRetryAfter('Thu, 01 Jan 1970 00:00:00 GMT', 1000)).toBe(0);
});
it('backoff is bounded and jitter injected', () => {
  expect(exponentialBackoff(0, 100, 10000, () => 0.5)).toBe(225);
  expect(exponentialBackoff(10, 100, 300, () => 1)).toBe(300);
  expect(exponentialBackoff(0)).toBeGreaterThanOrEqual(1000);
});
it('honors Retry-After through transport', async () => {
  const first = json({}, 429);
  first.headers.set('retry-after', '4');
  const s = setup([first, json({})]);
  await s.request({ retry: { maxRetryAfterMs: 5000 } });
  expect(s.rt.sleep).toHaveBeenCalledWith(4000, undefined);
});
it('exposes only bounded redacted problem facts on errors', async () => {
  const response = new Response(
    JSON.stringify({
      title: 'Bearer synthetic-access',
      detail: 'synthetic-secret',
      status: 200,
      raw: 'secret',
    }),
    { status: 400, headers: { 'content-type': 'application/problem+json', 'retry-after': '2' } },
  );
  const r = await setup([response]).request();
  expect(r.problem).toEqual({ status: 400, title: '[REDACTED]', detail: '[REDACTED]', retryAfterMs: 2000 });
  expect(r.body).toEqual({ kind: 'empty' });
  expect(parseProblemResponse(null, 500)).toEqual({ status: 500 });
  expect(parseProblemResponse([], 500, 0)).toEqual({ status: 500, retryAfterMs: 0 });
  expect(parseProblemResponse({ title: 4 }, 500)).toEqual({ status: 500 });
});
it('redacts exact credentials and structured transport errors', () => {
  const redacted = redactTransportText(
    'a b a%20b a+b\nclient_secret=synthetic\nAuthorization: synthetic\nBearer synthetic\nhttps://example.com/secret',
    ['', 'a b'],
  );
  expect(redacted).not.toContain('synthetic');
  expect(redacted).not.toContain('secret');
  expect(redactTransportText('x'.repeat(2000))).toHaveLength(1000);
  expect(new Ccv2TransportError('HTTP_ERROR', 400, { status: 400 }).toJSON()).toEqual({
    code: 'HTTP_ERROR',
    status: 400,
    problem: { status: 400 },
  });
  expect(new Ccv2TransportError('ABORTED').toJSON()).toEqual({ code: 'ABORTED' });
});
it('transport uses defaults independently of a token provider', async () => {
  expect(
    (
      await transport(
        new URL('https://example.com'),
        { policy: 'safe-read' },
        runtime(async () => json({})),
      )
    ).status,
  ).toBe(200);
});
it('default runtime is injectable and sleep supports cancellation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => json({})),
  );
  try {
    expect((await defaultRuntime.fetch('https://synthetic.example')).status).toBe(200);
    expect(defaultRuntime.now()).toBeGreaterThan(0);
    expect(defaultRuntime.random()).toBeGreaterThanOrEqual(0);
    await defaultRuntime.sleep(0);
    await expect(defaultRuntime.sleep(100, AbortSignal.abort())).rejects.toThrow();
  } finally {
    vi.unstubAllGlobals();
  }
});
it('handles body read failure and cancellation rejection safely', async () => {
  const stream = new ReadableStream({
    pull() {
      throw Error('synthetic secret');
    },
  });
  await expect(setup([new Response(stream)], 'unsafe-mutation').request()).rejects.toMatchObject({
    code: 'REQUEST_FAILED',
  });
});
it('redacts longest overlapping secrets first', () =>
  expect(redactTransportText('long-secret short', ['short', 'long-secret'])).toBe('[REDACTED] [REDACTED]'));
it('normalizes malformed URL, header and injected token errors', async () => {
  await expect(
    setup([]).client.request('https://[synthetic-secret', { policy: 'safe-read' }),
  ).rejects.toMatchObject({ code: 'INVALID_URL' });
  await expect(setup([]).request({ headers: { 'bad\nheader': 'secret' } })).rejects.toMatchObject({
    code: 'INVALID_OPTIONS',
  });
  const client = createCcv2Client({
    baseUrl: 'https://example.com',
    tokens: {
      get: async () => {
        throw Error('synthetic-secret');
      },
      invalidate() {},
    },
  });
  await expect(client.request('path', { policy: 'safe-read' })).rejects.toMatchObject({
    code: 'REQUEST_FAILED',
  });
});
it('bounds token acquisition by overall deadline and caller signal', async () => {
  const tokens = {
    get: async (signal?: AbortSignal): Promise<string> =>
      new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Ccv2TransportError('ABORTED')), { once: true });
      }),
    invalidate() {},
  };
  const client = createCcv2Client({ baseUrl: 'https://example.com', tokens });
  const keepAlive = setTimeout(() => {}, 100);
  try {
    await expect(
      client.request('path', { policy: 'safe-read', deadline: Date.now() + 5 }),
    ).rejects.toMatchObject({ code: 'DEADLINE' });
    const controller = new AbortController();
    const promise = client.request('path', {
      policy: 'safe-read',
      signal: controller.signal,
      deadline: Date.now() + 100,
    });
    setTimeout(() => controller.abort(), 5);
    await expect(promise).rejects.toMatchObject({ code: 'ABORTED' });
  } finally {
    clearTimeout(keepAlive);
  }
});
it('token retries transient HTTP failures and client refreshes the actual token once', async () => {
  const replies = [
    json({}, 503),
    json({ access_token: 'synthetic-first', token_type: 'Bearer' }),
    json({}, 401),
    json({ access_token: 'synthetic-second', token_type: 'Bearer' }),
    json({ ok: true }),
  ];
  const fetcher = vi.fn(async () => replies.shift()!);
  const rt = runtime(fetcher);
  const tokens = new TechnicalUserTokenManager(credentials, { runtime: rt });
  const client = createCcv2Client({ baseUrl: 'https://example.com', tokens, runtime: rt });
  expect((await client.request('path', { policy: 'unsafe-mutation', refreshOn401: true })).status).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(5);
  expect(rt.sleep).toHaveBeenCalledTimes(1);
  const calls = fetcher.mock.calls as unknown as [URL, RequestInit][];
  expect(new Headers(calls[4]![1].headers).get('x-approuter-authorization')).toBe('Bearer synthetic-second');
});
it('safe-read timeouts stop after the configured attempt bound', async () => {
  const fetcher = vi.fn<typeof fetch>(
    async (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener('abort', () => reject(Error('synthetic')), { once: true }),
      ),
  );
  const client = createCcv2Client({
    baseUrl: 'https://example.com',
    tokens: { get: async () => 'synthetic', invalidate() {} },
    runtime: runtime(fetcher),
  });
  await expect(
    client.request('path', { policy: 'safe-read', timeoutMs: 5, retry: { maxAttempts: 2 } }),
  ).rejects.toMatchObject({ code: 'TIMEOUT' });
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('safe transport errors have no stack, cause, raw response or request', () => {
  const error = new Ccv2TransportError('REQUEST_FAILED');
  expect(error.stack).toBeUndefined();
  expect(error.cause).toBeUndefined();
  for (const key of ['raw', 'response', 'headers', 'request', 'body']) expect(error).not.toHaveProperty(key);
  expect(JSON.stringify(error)).toBe('{"code":"REQUEST_FAILED"}');
});
it('large Retry-After waits are chunked rather than overflowing Node timers', async () => {
  const mock = vi.mocked(nodeTimer);
  mock.mockClear();
  mock.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);
  await defaultRuntime.sleep(2147483648);
  expect(mock.mock.calls.map(([ms]) => ms)).toEqual([2147483647, 1]);
});
