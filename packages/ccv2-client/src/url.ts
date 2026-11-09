import { Ccv2TransportError } from './errors.js';
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
