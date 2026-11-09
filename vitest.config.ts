import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**/*.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
        'packages/notification-contract/src/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
        'packages/ccv2-client/src/**': { statements: 95, branches: 95, functions: 95, lines: 95 },
      },
    },
  },
});
