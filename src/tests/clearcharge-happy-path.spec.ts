import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('ClearCharge Happy Path', () => {
  test('ClearCharge NF HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'clearcharge_HappyPath';

    const fileDetails = await test.step('Run ClearCharge end-to-end happy path', async () => {
      return orchestrator.runClearChargeHappyPath(page, scenarioId, scenarioId);
    });

    await test.step('Validate scheduler unique id present', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Validate summary report generated', async () => {
      expect(fileDetails.summaryReportFileName).toBeTruthy();
    });
  });
});
