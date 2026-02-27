import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('VW Happy Path', () => {
  test('VW_HappyPath_NF', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'VW_HappyPath_NF';
    const orchestrator = new Orchestrator();
    const fileDetails = await test.step('Run orchestrator path', async () => {
      return orchestrator.runHappyPath(page, scenarioId, 'VW', 'VW_NF.XIF', scenarioId, 'BC', true);
    });

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
});
