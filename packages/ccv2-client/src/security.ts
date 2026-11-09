export function redactTransportText(value: string, secrets: readonly string[] = []): string {
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length))
    for (const form of new Set([
      secret,
      encodeURIComponent(secret),
      new URLSearchParams({ v: secret }).toString().slice(2),
    ]))
      value = value.split(form).join('[REDACTED]');
  return value
    .replace(/(?:x-approuter-authorization|authorization)\s*[:=][^\r\n]+/gi, '[REDACTED]')
    .replace(/\bBearer\s+\S+/gi, '[REDACTED]')
    .replace(/\b(?:client_secret|access_token|token|password)\s*[=:]\s*[^\s&,;]+/gi, '[REDACTED]')
    .replace(/https?:\/\/\S+/gi, '[URL]')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .slice(0, 1000);
}
