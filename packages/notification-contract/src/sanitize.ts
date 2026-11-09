export function redactKnownSecrets(value: string, secrets: readonly string[] = []): string {
  for (const secret of [...secrets].filter(Boolean).sort((a, b) => b.length - a.length)) {
    for (const form of new Set([
      secret,
      encodeURIComponent(secret),
      new URLSearchParams({ v: secret }).toString().slice(2),
    ]))
      value = value.split(form).join('[REDACTED]');
  }
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:ghp_|github_pat_|npm_)[A-Za-z0-9_]+/g, '[REDACTED]')
    .replace(/\b(?:client_secret|password|access_token|token)\s*[=:]\s*[^\s&,;]+/gi, '[REDACTED]')
    .replace(/(?:x-approuter-authorization|authorization)\s*:[^\r\n]+/gi, '[REDACTED]');
}
export function sanitizeBoundedText(
  value: string,
  maxLength = 1000,
  secrets: readonly string[] = [],
): string {
  if (!Number.isSafeInteger(maxLength) || maxLength < 0) throw new Error('Invalid text limit.');
  return redactKnownSecrets(value, secrets)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, ' ')
    .slice(0, maxLength);
}
export function sanitizeLabel(value: string, secrets: readonly string[] = []): string {
  return sanitizeBoundedText(value, 1000, secrets)
    .replace(/[\r\n\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 75);
}
export function sanitizeErrorMessage(value: string, secrets: readonly string[] = []): string {
  return (
    sanitizeBoundedText(value, 1000, secrets)
      .replace(/https?:\/\/\S+/gi, '[URL]')
      .split(/\s+at\s+\S+\s*\(/)[0]!
      .trim() || 'Operation failed.'
  );
}
