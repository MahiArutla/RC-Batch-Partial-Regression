import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('BNS Commercial Happy Path NF', () => {
  test('BNS COMM NF smoke', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });

    const scenarioId = 'BNS_COMM_HappyPath_NF';
    const orchestrator = new Orchestrator();
    const fileDetails = await test.step('Run BNS COMM NF orchestrator', async () => {
      return orchestrator.runBnsCommHappyPathNF(page, scenarioId);
    });

    await test.step('Validate unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
});
