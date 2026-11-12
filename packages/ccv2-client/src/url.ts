import { Ccv2TransportError } from './errors.js';

/** Encode a raw CCv2 identifier once, preserving Build/Deploy's segment policy. */
export function encodeCcv2PathSegment(value: string): string {
  try {
    if (
      !value.trim() ||
      value.length > 128 ||
      /[/?#\\\u0000-\u001f\u007f-\u009f]/.test(value) ||
      value === '.' ||
      value === '..'
    )
      throw Error();
    return encodeURIComponent(value);
  } catch {
    // Includes malformed Unicode; never expose the raw identifier in diagnostics.
    throw new Ccv2TransportError('INVALID_URL');
  }
}

function https(value: string): URL {
  try {
    if (value.length > 2048 || /[\s\\?#\u0000-\u001f\u007f-\u009f]/.test(value)) throw Error();
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw Error();
    return url;
  } catch {
    throw new Ccv2TransportError('INVALID_URL');
  }
}
// Token endpoint query parameters are intentionally forbidden.
export function validateTechnicalUserTokenEndpoint(value: string): URL {
  return https(value);
}
export function validateManagementApiBaseUrl(value: string): URL {
  const url = https(value);
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  return url;
}
