import { redactJwtLikeTokens, redactKnownSecrets, sanitizeBoundedText } from './sanitize.js';
import type { NotificationInputContext } from './types.js';

export interface ActionInputDefinition {
  name: string;
  confidential?: boolean;
  display?: 'text' | 'presence' | 'url-origin';
}
const omittedNames = new Set([
  'event-json',
  'event-file',
  'traffic-split-json',
  'decision-reason',
  'cancel-reason',
]);
export function isConfidentialInputName(name: string): boolean {
  return (
    /token|secret|password|credential|webhook|authorization|private[-_]?key|api[-_]?key/i.test(name) ||
    ['client-id', 'resource'].includes(name.toLowerCase().replaceAll('_', '-'))
  );
}
function definitionsChecked(definitions: readonly ActionInputDefinition[]): void {
  if (
    definitions.length > 50 ||
    new Set(definitions.map(({ name }) => name)).size !== definitions.length ||
    definitions.some(({ name }) => !/^[a-z][a-z0-9-]{0,63}$/.test(name))
  )
    throw new Error('Invalid action input definitions.');
}
/** Redact before bounding. Query-bearing/credential URLs and webhooks are never display text. */
export function sanitizeActionText(value: string, maxLength = 256, secrets: readonly string[] = []): string {
  return sanitizeBoundedText(
    redactJwtLikeTokens(redactKnownSecrets(value, secrets)).replace(/https?:\/\/[^\s<>"']+/gi, (text) => {
      try {
        const url = new URL(text);
        return url.username ||
          url.password ||
          url.search ||
          url.hash ||
          /^hooks\.slack(?:-gov)?\.com$/i.test(url.hostname)
          ? '[REDACTED URL]'
          : text;
      } catch {
        return '[REDACTED URL]';
      }
    }),
    maxLength,
    secrets,
  );
}
/** Read and mask confidential inputs before reading any public setting. Values stay in memory. */
export function captureActionInputs(
  definitions: readonly ActionInputDefinition[],
  getInput: (name: string) => string,
  registerSecret: (value: string) => void,
): Record<string, string> {
  definitionsChecked(definitions);
  const confidential = (definition: ActionInputDefinition) =>
    definition.confidential || isConfidentialInputName(definition.name);
  const values = new Map<string, string>();
  for (const definition of [
    ...definitions.filter(confidential),
    ...definitions.filter((d) => !confidential(d)),
  ]) {
    const value = getInput(definition.name);
    if (confidential(definition) && value) registerSecret(value);
    values.set(definition.name, value);
  }
  return Object.fromEntries(definitions.map(({ name }) => [name, values.get(name)!]));
}
export function createActionInputContext(
  definitions: readonly ActionInputDefinition[],
  raw: Readonly<Record<string, string>>,
  options: {
    validated: boolean;
    effective?: Readonly<Record<string, string>>;
    secrets?: readonly string[];
    sanitize?: (value: string, max: number) => string;
  },
): NotificationInputContext {
  definitionsChecked(definitions);
  const secrets = [
    ...(options.secrets ?? []),
    ...definitions
      .filter((d) => d.confidential || isConfidentialInputName(d.name))
      .map((d) => raw[d.name] ?? ''),
  ];
  let truncated = false;
  const inputs = Object.fromEntries(
    definitions.map((definition) => {
      const { name } = definition;
      if (definition.confidential || isConfidentialInputName(name)) return [name, '[REDACTED]'];
      const original =
        options.validated && Object.hasOwn(options.effective ?? {}, name)
          ? options.effective![name]!
          : (raw[name] ?? '');
      if (definition.display === 'presence' || omittedNames.has(name))
        return [name, original ? '[PROVIDED: VALUE OMITTED]' : '(not set)'];
      let value = original || '(not set)';
      if (definition.display === 'url-origin' && original) {
        try {
          const url = new URL(original);
          value =
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.search &&
            !url.hash &&
            url.pathname === '/'
              ? url.origin
              : '[INVALID OR PRIVATE URL]';
        } catch {
          value = '[INVALID OR PRIVATE URL]';
        }
      }
      value = sanitizeActionText(value, Number.MAX_SAFE_INTEGER, secrets);
      if (options.sanitize)
        value = sanitizeActionText(
          options.sanitize(value, Number.MAX_SAFE_INTEGER),
          Number.MAX_SAFE_INTEGER,
          secrets,
        );
      const chars = [...value];
      if (chars.length > 256) {
        value = `${chars.slice(0, 242).join('')}… [truncated]`;
        truncated = true;
      }
      return [name, value];
    }),
  );
  return { inputs, inputsValidated: options.validated, inputsTruncated: truncated };
}
