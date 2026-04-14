import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('ClearCharge Happy Path NF', () => {
  test('ClearCharge_HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });

    const scenarioId = 'ClearCharge_HappyPath';
    const testName = 'ClearCharge_HappyPath';
    const orchestrator = new Orchestrator();
    const fileDetails = await test.step('Run ClearCharge NF orchestrator', async () => {
      return orchestrator.runClearChargeHappyPath(page, scenarioId, testName);
    });

    await test.step('Validate batch number present', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
    });
  });
});
