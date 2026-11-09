export interface RuntimeDependencies {
  fetch: typeof fetch;
  now: () => number;
  sleep: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  random: () => number;
  maskSecret?: (value: string) => void;
}
export type RequestPolicy = 'token' | 'safe-read' | 'unsafe-mutation';
export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  maxRetryAfterMs?: number;
}
export interface Ccv2RequestOptions {
  policy: RequestPolicy;
  method?: string;
  headers?: HeadersInit;
  body?: string | Uint8Array<ArrayBuffer>;
  signal?: AbortSignal;
  timeoutMs?: number;
  deadline?: number;
  maxResponseBytes?: number;
  retry?: RetryOptions;
  refreshOn401?: boolean;
}
export type Ccv2ResponseBody =
  | { kind: 'json'; value: unknown }
  | { kind: 'empty' }
  | { kind: 'binary'; value: Uint8Array; contentType?: string };
export interface Ccv2Problem {
  status: number;
  title?: string;
  detail?: string;
  retryAfterMs?: number;
}
export interface Ccv2Response {
  status: number;
  body: Ccv2ResponseBody;
  retryAfterMs: number;
  problem?: Ccv2Problem;
}
export interface TechnicalUserCredentials {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  resource: string;
}
export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in?: number;
}
export interface TokenProvider {
  get(signal?: AbortSignal): Promise<string>;
  invalidate(): void;
}
export interface Ccv2Client {
  request(path: string, options: Ccv2RequestOptions): Promise<Ccv2Response>;
}
