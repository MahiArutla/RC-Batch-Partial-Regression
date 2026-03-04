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

  test('VW_HappyPath_Discharge', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: New Finance
    const scenarioId1 = 'VW_HappyPath_NF';
    let fileDetails = await test.step('Run orchestrator path cycle 1 (New Finance)', async () => {
      return orchestrator.runHappyPath(page, scenarioId1, 'VW', 'VW_NF.XIF', scenarioId1, 'BC', false);
    });

    await test.step('Validate unique id present cycle 1', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    // Cycle 2: Discharge
    const scenarioId2 = 'VW_HappyPath_Discharge';
    fileDetails = await test.step('Run orchestrator path cycle 2 (Discharge)', async () => {
      return orchestrator.runDischargeHappyPath(
        page,
        scenarioId2,
        'VW',
        'VW_Discharge.txt',
        scenarioId2,
        'BC',
        fileDetails.partnerReference!,
        fileDetails.baseRegistrationNum
      );
    });

    await test.step('Validate unique id present cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
});
