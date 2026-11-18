import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/browser',
  workers: 1,
  timeout: 90_000,
  use: { baseURL: 'https://planestudio.test', ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) }
});
