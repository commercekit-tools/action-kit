import { Ccv2TransportError, parseProblemResponse } from './errors.js';
import { readResponse } from './response.js';
import { parseRetryAfter, exponentialBackoff } from './retry.js';
import type { Ccv2RequestOptions, Ccv2Response, RuntimeDependencies } from './types.js';
const transient = [429, 500, 502, 503, 504];
export async function transport(
  url: URL,
  options: Ccv2RequestOptions,
  rt: RuntimeDependencies,
  secrets: readonly string[] = [],
): Promise<Ccv2Response> {
  const attempts = options.policy === 'unsafe-mutation' ? 1 : (options.retry?.maxAttempts ?? 3);
  const timeout = options.timeoutMs ?? 30000;
  const limit = options.maxResponseBytes ?? 262144;
  if (
    !['token', 'safe-read', 'unsafe-mutation'].includes(options.policy) ||
    !Number.isSafeInteger(attempts) ||
    attempts < 1 ||
    attempts > 10 ||
    !Number.isSafeInteger(timeout) ||
    timeout < 1 ||
    timeout > 2147483647 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    (options.deadline !== undefined && !Number.isFinite(options.deadline)) ||
    Object.values(options.retry ?? {}).some((v) => !Number.isFinite(v) || v < 0)
  )
    throw new Ccv2TransportError('INVALID_OPTIONS');
  for (let attempt = 0; ; attempt++) {
    if (options.signal?.aborted) throw new Ccv2TransportError('ABORTED');
    const remaining = options.deadline === undefined ? Infinity : options.deadline - rt.now();
    if (remaining <= 0) throw new Ccv2TransportError('DEADLINE');
    const controller = new AbortController();
    const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
    const timer = setTimeout(() => controller.abort(), Math.min(timeout, remaining));
    let reply: Ccv2Response | undefined;
    let failure: Ccv2TransportError | undefined;
    try {
      const response = await rt.fetch(url, {
        method: options.method ?? 'GET',
        headers: options.headers,
        body: options.body,
        signal,
        redirect: 'error',
        credentials: 'omit',
      });
      if (response.status >= 300 && response.status < 400)
        throw new Ccv2TransportError('HTTP_ERROR', response.status);
      const body = await readResponse(response, limit, signal);
      const retryAfterMs = parseRetryAfter(
        response.headers.get('retry-after'),
        rt.now(),
        options.retry?.maxRetryAfterMs,
      );
      const problem =
        response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ===
        'application/problem+json'
          ? parseProblemResponse(
              body.kind === 'json' ? body.value : undefined,
              response.status,
              retryAfterMs,
              secrets,
            )
          : undefined;
      // Error response bodies never leave transport; only bounded, redacted problem facts do.
      reply = {
        status: response.status,
        body: response.ok ? body : { kind: 'empty' },
        retryAfterMs,
        ...(problem ? { problem } : {}),
      };
    } catch (error) {
      failure = options.signal?.aborted
        ? new Ccv2TransportError('ABORTED')
        : controller.signal.aborted
          ? new Ccv2TransportError('TIMEOUT')
          : error instanceof Ccv2TransportError
            ? error
            : new Ccv2TransportError('REQUEST_FAILED');
    } finally {
      clearTimeout(timer);
    }
    const retryable = failure
      ? ['TIMEOUT', 'REQUEST_FAILED'].includes(failure.code)
      : transient.includes(reply!.status);
    if (!retryable || attempt + 1 >= attempts) {
      if (failure) throw failure;
      return reply!;
    }
    const delay = Math.max(
      reply?.retryAfterMs ?? 0,
      exponentialBackoff(attempt, options.retry?.baseDelayMs, options.retry?.maxDelayMs, rt.random),
    );
    if (options.deadline !== undefined && rt.now() + delay >= options.deadline)
      throw new Ccv2TransportError('DEADLINE');
    try {
      await rt.sleep(delay, options.signal);
    } catch {
      throw new Ccv2TransportError('ABORTED');
    }
  }
}
