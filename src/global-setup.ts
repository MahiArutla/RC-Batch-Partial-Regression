import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { loadEnv } from './config/env';

export default async function globalSetup() {
  const env = loadEnv();
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(env.webAppUrl);
  // Use role-based selectors where possible; fallback to current attributes
  const email = page.locator("//input[@ng-model='email']");
  const password = page.locator("//input[@formcontrolname='password']");
  const signIn = page.getByRole('button', { name: /sign in/i });

  await email.fill(env.adminUser);
  await password.fill(env.adminPassword);
  await signIn.click();

  // Wait for app to finish initial navigation
  await page.waitForLoadState('networkidle');

  const storageDir = path.join(process.cwd(), 'storage');
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir);
  const storagePath = path.join(storageDir, 'admin.json');
  await context.storageState({ path: storagePath });

  await browser.close();
}
