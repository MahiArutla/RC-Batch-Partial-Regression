import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('FORD Happy Path NF', () => {
  test('Ford_HappyPath_NF', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });

    const scenarioId = 'Ford_HappyPath_NF';
    const orchestrator = new Orchestrator();
    const fileDetails = await test.step('Run Ford NF orchestrator', async () => {
      return orchestrator.runFordHappyPathNF(page, scenarioId);
    });

    await test.step('Validate batch number present', async () => {
      expect(fileDetails.batchNumber).toBeTruthy();
    });
  });
});
