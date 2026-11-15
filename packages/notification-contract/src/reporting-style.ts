import type { NotificationStatus } from './types.js';

/** Provider-neutral visual semantics shared by cards and GitHub run summaries. */
export interface NotificationStyle {
  label: string;
  icon: string;
  tone: 'info' | 'success' | 'warning' | 'danger' | 'neutral';
  accent: string;
}
const styles: Readonly<Record<NotificationStatus, Readonly<NotificationStyle>>> = {
  started: { label: 'Started', icon: 'ℹ️', tone: 'info', accent: '#1877C9' },
  success: { label: 'Succeeded', icon: '✅', tone: 'success', accent: '#168A45' },
  warning: { label: 'Completed with warnings', icon: '⚠️', tone: 'warning', accent: '#B7791F' },
  failure: { label: 'Failed', icon: '❌', tone: 'danger', accent: '#C62828' },
  'internal-error': { label: 'CommerceKit error', icon: '❌', tone: 'danger', accent: '#C62828' },
  cancelled: { label: 'Cancelled', icon: '⏹️', tone: 'neutral', accent: '#6B7280' },
  'action-required': { label: 'Action required', icon: '⚠️', tone: 'warning', accent: '#B7791F' },
};
export function getNotificationStyle(status: NotificationStatus): Readonly<NotificationStyle> {
  if (!Object.hasOwn(styles, status)) throw new Error('Invalid notification status.');
  return Object.freeze({ ...styles[status] });
}
