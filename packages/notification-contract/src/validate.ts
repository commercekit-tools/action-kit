import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { schema } from './schema.js';
import { validateNotificationLink, validateGitHubRunUrl } from './links.js';
import type { NotificationEvent } from './types.js';
const ajv = new Ajv2020({ strict: false, validateFormats: true });
(addFormats as unknown as (a: Ajv2020) => void)(ajv);
const validate = ajv.compile(schema);
export function validateNotificationEvent(value: unknown): NotificationEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !validate(value))
    throw new Error('Invalid NotificationEvent v1.');
  const event = value as NotificationEvent;
  for (const link of event.links ?? []) validateNotificationLink(link.url);
  if (event.context?.runUrl !== undefined) validateGitHubRunUrl(event.context.runUrl);
  return event;
}
export function parseNotificationEventJson(
  text: string,
  options: { maxBytes?: number } = {},
): NotificationEvent {
  if (new TextEncoder().encode(text).length > (options.maxBytes ?? 65536))
    throw new Error('NotificationEvent exceeds byte limit.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Invalid NotificationEvent JSON.');
  }
  return validateNotificationEvent(value);
}
