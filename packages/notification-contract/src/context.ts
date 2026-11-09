import type { NotificationContext } from './types.js';
import { validateGitHubRunUrl } from './links.js';
const fields = {
  repository: ['GITHUB_REPOSITORY', 200],
  ref: ['GITHUB_REF', 300],
  commit: ['GITHUB_SHA', 128],
  actor: ['GITHUB_ACTOR', 128],
  workflow: ['GITHUB_WORKFLOW', 200],
  job: ['GITHUB_JOB', 200],
  runId: ['GITHUB_RUN_ID', 64],
} as const;
export function extractSafeGitHubContext(
  env: Readonly<Record<string, string | undefined>>,
): NotificationContext {
  const context: NotificationContext = {};
  for (const [key, [variable, max]] of Object.entries(fields)) {
    const value = env[variable]?.trim();
    if (!value || value.length > max || /[\u0000-\u001f\u007f-\u009f]/.test(value)) continue;
    if (key === 'repository' && !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) continue;
    if (key === 'runId' && !/^\d+$/.test(value)) continue;
    context[key] = value;
  }
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  if (Number.isSafeInteger(attempt) && attempt >= 1) context.runAttempt = attempt;
  try {
    const server = validateGitHubRunUrl(env.GITHUB_SERVER_URL ?? 'https://github.com');
    if (server.search || server.pathname !== '/') throw Error();
    if (context.repository && context.runId)
      context.runUrl = validateGitHubRunUrl(
        `${server.origin}/${context.repository}/actions/runs/${context.runId}`,
      ).href;
  } catch {
    /* Omit unsafe environment URLs. */
  }
  return context;
}
function merge(provided: NotificationContext, extracted: NotificationContext): NotificationContext {
  const result = { ...provided };
  for (const [key, value] of Object.entries(extracted))
    if (result[key] === undefined || result[key] === '') result[key] = value;
  if (result.runUrl !== undefined) validateGitHubRunUrl(result.runUrl);
  return result;
}
export function mergeProducerContext(
  provided: NotificationContext,
  extracted: NotificationContext,
): NotificationContext {
  return merge(provided, extracted);
}
export function mergeNotifierContext(
  provided: NotificationContext,
  extracted: NotificationContext,
): NotificationContext {
  return merge(provided, extracted);
}
