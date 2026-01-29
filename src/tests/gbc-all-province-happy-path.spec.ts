import { test, expect } from '../fixtures/test';
import { LoginPage } from '../pages/login.page';
import { loadEnv } from '../config/env';
import { GbcOrchestrator } from '../services/gbcOrchestrator';

test.describe('GBC All Province Happy Path', () => {
  test('GBC NF smoke', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'GBC_AllProvinceHappyPath';
    const orchestrator = new GbcOrchestrator();
    const fileDetails = await test.step('Run orchestrator path', async () => {
      return orchestrator.runGbcAllProvinceHappyPath(page, scenarioId, 'GBC', 'GBC_NF.XIF');
    });

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
});
