import { test, expect } from '../fixtures/test';
import { LoginPage } from '../pages/login.page';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';
import path from 'path';

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

  test('TDAF Renewal HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1
    const scenarioId1 = 'TDAF_HappyPath_NF';
    let fileDetails = await test.step('Run orchestrator path cycle 1', async () => {
      return orchestrator.runHappyPath(page, scenarioId1, 'TDAF', 'TDAF_NF', scenarioId1, 'BC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present cycle 1', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    // Cycle 2
    const scenarioId2 = 'TDAF_HappyPath_Renewal';
    fileDetails = await test.step('Run orchestrator path cycle 2', async () => {
      return orchestrator.runRenewalHappyPath(page, scenarioId2, 'TDAF', 'TDAF_Renewal.csv', scenarioId2, 'BC', fileDetails.partnerReference!);
    });

    await test.step('Validate unique id present cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
