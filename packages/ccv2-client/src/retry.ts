import { setTimeout as timer } from 'node:timers/promises';
import type { RuntimeDependencies } from './types.js';
export const defaultRuntime: RuntimeDependencies = {
  fetch: (...args) => fetch(...args),
  now: Date.now,
  sleep: async (ms, signal) => {
    // Node otherwise clamps waits above the timer range to 1ms, violating Retry-After.
    while (ms > 2147483647) {
      await timer(2147483647, undefined, { signal });
      ms -= 2147483647;
    }
    await timer(ms, undefined, { signal });
  },
  random: Math.random,
};
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
  maxMs = Number.MAX_SAFE_INTEGER,
): number {
  if (!value) return 0;
  const milliseconds = /^\d+$/.test(value)
    ? Number(value) * 1000
    : /^[A-Za-z]{3}, /.test(value)
      ? Date.parse(value) - now
      : NaN;
  return Number.isFinite(milliseconds) ? Math.min(Math.max(0, milliseconds), Math.max(0, maxMs)) : 0;
}
export function exponentialBackoff(
  attempt: number,
  baseMs = 1000,
  maxMs = 30000,
  random: () => number = Math.random,
): number {
  return Math.min(maxMs, baseMs * 2 ** attempt + Math.floor(Math.max(0, Math.min(1, random())) * 250));
}
