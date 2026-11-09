import { redactTransportText } from './security.js';
import type { Ccv2Problem } from './types.js';
export type TransportErrorCode =
  | 'INVALID_URL'
  | 'INVALID_OPTIONS'
  | 'INVALID_TOKEN'
  | 'REQUEST_FAILED'
  | 'TIMEOUT'
  | 'ABORTED'
  | 'DEADLINE'
  | 'INVALID_RESPONSE'
  | 'RESPONSE_TOO_LARGE'
  | 'HTTP_ERROR';
export class Ccv2TransportError extends Error {
  constructor(
    public readonly code: TransportErrorCode,
    public readonly status?: number,
    public readonly problem?: Ccv2Problem,
  ) {
    super(`CCv2 transport: ${code}.`);
    this.name = 'Ccv2TransportError';
  }
  toJSON() {
    return {
      code: this.code,
      ...(this.status !== undefined ? { status: this.status } : {}),
      ...(this.problem ? { problem: this.problem } : {}),
    };
  }
}
export function parseProblemResponse(
  value: unknown,
  status: number,
  retryAfterMs?: number,
  secrets: readonly string[] = [],
): Ccv2Problem {
  const problem: Ccv2Problem = { status, ...(retryAfterMs !== undefined ? { retryAfterMs } : {}) };
  if (value && typeof value === 'object' && !Array.isArray(value))
    for (const key of ['title', 'detail'] as const) {
      const text = (value as Record<string, unknown>)[key];
      if (typeof text === 'string') problem[key] = redactTransportText(text, secrets);
    }
  return problem;
}
