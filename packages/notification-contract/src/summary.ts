import { validateNotificationLink } from './links.js';
import { isConfidentialInputName, sanitizeActionText } from './input-context.js';
import { redactJwtLikeTokens, redactKnownSecrets } from './sanitize.js';
import { getNotificationStyle } from './reporting-style.js';
import type {
  NotificationInputContext,
  NotificationLink,
  NotificationStatus,
  SafeNotificationError,
} from './types.js';

type Cell = string | number | boolean;
export interface ActionSummarySection {
  title: string;
  headers: readonly string[];
  rows: readonly (readonly Cell[])[];
}
export interface ActionSummaryOptions {
  title: string;
  status: NotificationStatus;
  description?: string;
  facts?: readonly { label: string; value: Cell }[];
  inputContext?: NotificationInputContext;
  error?: SafeNotificationError;
  issues?: readonly SafeNotificationError[];
  sections?: readonly ActionSummarySection[];
  links?: readonly NotificationLink[];
  secrets?: readonly string[];
}
/** Pure bounded Markdown. This function writes no files and never changes an Action outcome. */
export function renderActionSummary(options: ActionSummaryOptions): string {
  const secrets = [
    ...(options.secrets ?? []),
    ...Object.entries(options.inputContext?.inputs ?? {})
      .filter(([name]) => isConfidentialInputName(name))
      .map(([, value]) => (value === '[REDACTED]' ? '' : value)),
  ];
  let limited = false;
  const text = (value: Cell, max = 256) => {
    const characters = [...sanitizeActionText(String(value), Number.MAX_SAFE_INTEGER, secrets)];
    if (characters.length > max) limited = true;
    const bounded =
      characters.length > max
        ? `${characters.slice(0, max - 13).join('')}… [truncated]`
        : characters.join('');
    return bounded
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/([\\`*_[\]{}()|!#~])/g, '\\$1')
      .replace(/@/g, '＠')
      .replace(/[\r\n\u2028\u2029]/g, ' ');
  };
  const style = getNotificationStyle(options.status);
  const lines = [`## ${style.icon} ${text(options.title, 200)} — ${style.label}`, ''];
  const table = (
    title: string,
    headers: readonly string[],
    rows: readonly (readonly Cell[])[],
    maximum = 50,
  ) => {
    lines.push(
      `### ${text(title, 100)}`,
      '',
      `| ${headers
        .slice(0, 8)
        .map((h) => text(h, 80))
        .join(' | ')} |`,
      `| ${headers
        .slice(0, 8)
        .map(() => '---')
        .join(' | ')} |`,
    );
    for (const row of rows.slice(0, maximum))
      lines.push(
        `| ${row
          .slice(0, 8)
          .map((value) => text(value))
          .join(' | ')} |`,
      );
    lines.push('');
    if (rows.length > maximum || headers.length > 8 || rows.some((row) => row.length > 8)) limited = true;
  };
  if (options.description) lines.push(text(options.description, 1000), '');
  if (options.facts?.length)
    table(
      'Result',
      ['Detail', 'Value'],
      options.facts.map(({ label, value }) => [label, value]),
    );
  if (options.inputContext) {
    const context = options.inputContext;
    table(
      'Inputs',
      ['Input', 'Value'],
      Object.entries(context.inputs).map(([name, value]) => [
        name,
        isConfidentialInputName(name) ? '[REDACTED]' : value,
      ]),
    );
    lines.push(`Validated: ${context.inputsValidated}; truncated: ${context.inputsTruncated}.`, '');
    if (!context.inputsValidated)
      lines.push('⚠️ Input validation did not complete; values reflect safely captured settings.', '');
    if (context.inputsTruncated) lines.push('⚠️ Some input values were truncated before reporting.', '');
  }
  const issues = [...(options.error ? [options.error] : []), ...(options.issues ?? [])];
  if (issues.length)
    table(
      'Issues',
      ['Code', 'Detail'],
      issues.map((issue) => [issue.code ?? 'unreported', issue.message]),
      4,
    );
  for (const section of (options.sections ?? []).slice(0, 8))
    table(section.title, section.headers, section.rows);
  if ((options.sections?.length ?? 0) > 8) limited = true;
  const links: string[] = [];
  if ((options.links?.length ?? 0) > 3) limited = true;
  for (const link of (options.links ?? []).slice(0, 3)) {
    try {
      const url = validateNotificationLink(link.url);
      if (
        [...url.searchParams.entries()].some(
          ([key, value]) =>
            isConfidentialInputName(key) ||
            /^(sig|signature|code|key|auth)$/i.test(key) ||
            sanitizeActionText(value, Number.MAX_SAFE_INTEGER, secrets) !== value,
        ) ||
        redactJwtLikeTokens(redactKnownSecrets(link.url, secrets)) !== link.url ||
        sanitizeActionText(url.origin, 2048) !== url.origin
      )
        continue;
      links.push(`[${text(link.label, 80)}](${url.href.replace(/\(/g, '%28').replace(/\)/g, '%29')})`);
    } catch {
      // Unsafe links are omitted, never included as raw error text.
    }
  }
  if (links.length) lines.push('### Workflow', '', links.join(' · '), '');
  // Keep complete lines/table rows, including under multibyte input, with explicit omission metadata.
  const maximumBytes = 64 * 1024 - 256;
  let output = '';
  for (const line of lines) {
    if (new TextEncoder().encode(output + line + '\n').length > maximumBytes) {
      limited = true;
      break;
    }
    output += `${line}\n`;
  }
  if (limited) output += '\n⚠️ Some details were omitted due to summary limits.\n';
  return output;
}
