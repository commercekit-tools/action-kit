import { copyFile } from 'node:fs/promises';
await copyFile('schema/notification-event-v1.schema.json', 'dist/notification-event-v1.schema.json');
