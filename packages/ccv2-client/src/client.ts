import { validateManagementApiBaseUrl } from './url.js';
import { Ccv2TransportError } from './errors.js';
import { defaultRuntime } from './retry.js';
import { transport } from './transport.js';
import type { Ccv2Client, TokenProvider, RuntimeDependencies } from './types.js';
export function createCcv2Client(options: {
  baseUrl: string;
  tokens: TokenProvider;
  runtime?: Partial<RuntimeDependencies>;
  secrets?: readonly string[];
}): Ccv2Client {
  const base = validateManagementApiBaseUrl(options.baseUrl);
  const rt = { ...defaultRuntime, ...options.runtime };
  return {
    async request(path, request) {
      let url: URL;
      try {
        url = new URL(path, base);
      } catch {
        throw new Ccv2TransportError('INVALID_URL');
      }
      if (
        url.origin !== base.origin ||
        !url.pathname.startsWith(base.pathname) ||
        url.username ||
        url.password ||
        url.hash ||
        /[\\\u0000-\u0020]/.test(path)
      )
        throw new Ccv2TransportError('INVALID_URL');
      for (let replay = 0; ; replay++) {
        if (request.deadline !== undefined && !Number.isFinite(request.deadline))
          throw new Ccv2TransportError('INVALID_OPTIONS');
        const remaining = request.deadline === undefined ? Infinity : request.deadline - rt.now();
        if (remaining <= 0) throw new Ccv2TransportError('DEADLINE');
        const deadlineSignal = Number.isFinite(remaining)
          ? AbortSignal.timeout(Math.min(Math.ceil(remaining), 2147483647))
          : undefined;
        const signal = deadlineSignal
          ? request.signal
            ? AbortSignal.any([request.signal, deadlineSignal])
            : deadlineSignal
          : request.signal;
        let token: string;
        try {
          token = await options.tokens.get(signal);
        } catch (error) {
          if (request.signal?.aborted) throw new Ccv2TransportError('ABORTED');
          if (deadlineSignal?.aborted) throw new Ccv2TransportError('DEADLINE');
          throw error instanceof Ccv2TransportError ? error : new Ccv2TransportError('REQUEST_FAILED');
        }
        rt.maskSecret?.(token);
        let headers: Headers;
        try {
          headers = new Headers(request.headers);
          headers.set('x-approuter-authorization', `Bearer ${token}`);
        } catch {
          throw new Ccv2TransportError('INVALID_OPTIONS');
        }
        const response = await transport(url, { ...request, headers }, rt, [
          ...(options.secrets ?? []),
          token,
        ]);
        if (response.status === 401 && request.refreshOn401 === true && replay === 0) {
          options.tokens.invalidate();
          continue;
        }
        return response;
      }
    },
  };
}
