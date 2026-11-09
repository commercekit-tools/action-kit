import { Ccv2TransportError } from './errors.js';
import type { Ccv2ResponseBody } from './types.js';
export async function readResponse(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Ccv2ResponseBody> {
  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => {
    void reader?.cancel().catch(() => {});
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (reader)
      while (true) {
        signal.throwIfAborted();
        const part = await reader.read();
        signal.throwIfAborted();
        if (part.done) break;
        size += part.value.length;
        if (size > maxBytes) throw new Ccv2TransportError('RESPONSE_TOO_LARGE');
        chunks.push(part.value);
      }
  } finally {
    signal.removeEventListener('abort', abort);
    await reader?.cancel().catch(() => {});
  }
  if (size === 0) return { kind: 'empty' };
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType === 'application/json' || contentType?.endsWith('+json')) {
    try {
      return { kind: 'json', value: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
    } catch {
      throw new Ccv2TransportError('INVALID_RESPONSE');
    }
  }
  return { kind: 'binary', value: bytes, ...(contentType ? { contentType } : {}) };
}
