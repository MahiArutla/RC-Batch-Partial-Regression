import { test as base, Page } from '@playwright/test';
import { loadEnv } from '../config/env';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';
import { DownloadPage } from '../pages/download.page';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';

type Pages = {
  page: Page;
  loginPage: LoginPage;
  homePage: HomePage;
  downloadPage: DownloadPage;
  hangfireJobsPage: HangfireJobsPage;
};

export const test = base.extend<Pages>({
  page: async ({ page }, use) => {
    const env = loadEnv();
    // BaseURL is set in config; ensure we have a logged-in storageState
    await use(page);
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  downloadPage: async ({ page }, use) => {
    await use(new DownloadPage(page));
  },
  hangfireJobsPage: async ({ page }, use) => {
    await use(new HangfireJobsPage(page));
  }
});

export const expect = base.expect;
