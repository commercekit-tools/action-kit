/**
 * Discard angle brackets and text between them, including an unclosed suffix.
 * This preserves the Actions' conservative text filter; it is not an HTML parser
 * or an HTML sanitizer. Callers still own output escaping and disclosure policy.
 */
export function stripAngleBracketText(value: string): string {
  let inside = false;
  let output = '';
  for (const character of value) {
    if (character === '<') inside = true;
    else if (character === '>') inside = false;
    else if (!inside) output += character;
  }
  return output;
}

/** Redact the JWT-like shape recognized by Build/Deploy; no token verification. */
export function redactJwtLikeTokens(value: string): string {
  // Scan maximal word runs once. A regex that searches for eyJ followed by an
  // unbounded word suffix can retry overlapping prefixes quadratically.
  const pending: { text: string; start: number; end: number }[] = [];
  let output = '';
  let consumed = 0;
  for (const match of value.matchAll(/[\w-]+/g)) {
    pending.push({ text: match[0], start: match.index, end: match.index + match[0].length });
    if (pending.length < 3) continue;
    const first = pending[0]!,
      second = pending[1]!,
      third = pending[2]!;
    const prefix = first.text.indexOf('eyJ');
    if (
      prefix >= 0 &&
      prefix + 3 < first.text.length &&
      first.end + 1 === second.start &&
      value[first.end] === '.' &&
      second.end + 1 === third.start &&
      value[second.end] === '.'
    ) {
      output += value.slice(consumed, first.start + prefix) + '[REDACTED]';
      consumed = third.end;
      pending.length = 0;
    } else {
      pending.shift();
    }
  }
  return output + value.slice(consumed);
}

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
