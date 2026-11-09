import type {
  TechnicalUserCredentials,
  TokenResponse,
  RuntimeDependencies,
  TokenProvider,
  RetryOptions,
} from './types.js';
import { defaultRuntime } from './retry.js';
import { validateTechnicalUserTokenEndpoint } from './url.js';
import { Ccv2TransportError } from './errors.js';
import { transport } from './transport.js';
export class TechnicalUserTokenManager implements TokenProvider {
  #token?: string;
  #expires = 0;
  readonly #credentials: TechnicalUserCredentials;
  readonly #rt: RuntimeDependencies;
  constructor(
    credentials: TechnicalUserCredentials,
    private readonly options: {
      runtime?: Partial<RuntimeDependencies>;
      safetyWindowMs?: number;
      retry?: RetryOptions;
    } = {},
  ) {
    validateTechnicalUserTokenEndpoint(credentials.tokenEndpoint);
    if (
      [credentials.clientId, credentials.clientSecret, credentials.resource].some(
        (v) => !v || v.length > 8192,
      ) ||
      !Number.isFinite(options.safetyWindowMs ?? 60000) ||
      (options.safetyWindowMs ?? 60000) < 0
    )
      throw new Ccv2TransportError('INVALID_OPTIONS');
    this.#credentials = { ...credentials };
    this.#rt = { ...defaultRuntime, ...options.runtime };
    for (const value of Object.values(credentials)) this.#rt.maskSecret?.(value);
  }
  invalidate(): void {
    this.#token = undefined;
    this.#expires = 0;
  }
  async get(signal?: AbortSignal): Promise<string> {
    if (signal?.aborted) throw new Ccv2TransportError('ABORTED');
    if (this.#token && this.#rt.now() < this.#expires) return this.#token;
    const start = this.#rt.now();
    const c = this.#credentials;
    const response = await transport(
      validateTechnicalUserTokenEndpoint(c.tokenEndpoint),
      {
        policy: 'token',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          client_id: c.clientId,
          client_secret: c.clientSecret,
          grant_type: 'client_credentials',
          resource: c.resource,
        }).toString(),
        signal,
        retry: this.options.retry,
      },
      this.#rt,
      Object.values(c),
    );
    if (response.status !== 200) throw new Ccv2TransportError('HTTP_ERROR', response.status);
    const token =
      response.body.kind === 'json' ? (response.body.value as Partial<TokenResponse> | null) : null;
    if (typeof token?.access_token === 'string') this.#rt.maskSecret?.(token.access_token);
    if (
      !token ||
      typeof token.access_token !== 'string' ||
      !token.access_token ||
      token.access_token.length > 32768 ||
      /\s/.test(token.access_token) ||
      typeof token.token_type !== 'string' ||
      token.token_type.toLowerCase() !== 'bearer' ||
      (token.expires_in !== undefined && (!Number.isSafeInteger(token.expires_in) || token.expires_in <= 0))
    )
      throw new Ccv2TransportError('INVALID_TOKEN');
    this.#token = token.access_token;
    this.#expires =
      token.expires_in === undefined
        ? Infinity
        : start +
          Math.max(
            0,
            token.expires_in * 1000 - Math.min(this.options.safetyWindowMs ?? 60000, token.expires_in * 100),
          );
    return this.#token;
  }
}
