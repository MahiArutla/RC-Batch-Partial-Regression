import { test, expect } from '../fixtures/test';
import { LoginPage } from '../pages/login.page';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('TDAF All Province Happy Path', () => {
  test('TDAF NF smoke', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'TDAF_HappyPath_NF';
    const orchestrator = new Orchestrator();
    const fileDetails = await test.step('Run orchestrator path', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'TDAF', 'TDAF_NF', scenarioId, 'BC', false);
    });

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
});
