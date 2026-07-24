import { defineConfig, devices } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';
const WEB_URL = process.env.E2E_WEB_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  timeout: 30000,

  use: {
    baseURL: WEB_URL,
    trace: process.env.CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    extraHTTPHeaders: {
      'x-e2e-test': '1',
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: [
    {
      command: 'pnpm --filter @platform/api exec tsx src/index.ts',
      port: 3001,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
      env: { PORT: '3001' },
    },
    {
      command: 'pnpm --filter @platform/web dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
      env: { NEXT_PUBLIC_API_URL: API_URL },
    },
  ],
});
