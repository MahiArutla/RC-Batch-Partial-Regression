import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { loadEnv } from './src/config/env';

const env = loadEnv();

export default defineConfig({
  testDir: './src/tests',
  timeout: 5 * 60 * 1000,
  retries: 1,
  expect: {
    timeout: 15_000
  },
  outputDir: path.join(__dirname, 'test-results'),
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './src/global-setup.ts',
  use: {
    baseURL: env.webAppUrl,
    headless: true,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    acceptDownloads: true,
    storageState: path.join(__dirname, 'storage', 'admin.json')
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
