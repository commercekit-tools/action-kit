import { createCheckEvent } from '../../packages/notification-contract/src/index.js';
export const checkEvent = () =>
  createCheckEvent({
    status: 'success',
    data: { mode: 'changed', changedFrom: 'synthetic-base', filesChecked: 2, errors: 0, warnings: 0 },
  });
