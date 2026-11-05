import { defineConfig } from 'vitest/config';

// Attacks the real production build over HTTP. Run `npm run build` first.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/http/**/*.test.ts'],
    globalSetup: ['tests/http/setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
