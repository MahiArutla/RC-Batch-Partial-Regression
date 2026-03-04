import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('TDAF All Province Happy Path', () => {
  test('TDAF NF -> Renewal -> Discharge HappyPath', async ({ page, loginPage }) => {
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

    // Cycle 2: Renewal
    const scenarioId2 = 'TDAF_HappyPath_Renewal';
    fileDetails = await test.step('Run orchestrator path cycle 2 (Renewal)', async () => {
      return orchestrator.runRenewalHappyPath(
        page,
        scenarioId2,
        'TDAF',
        'TDAF_Renewal.csv',
        scenarioId2,
        'BC',
        fileDetails.partnerReference!
      );
    });

    await test.step('Validate unique id present cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    // Cycle 3: Discharge
    const scenarioId3 = 'TDAF_HappyPath_Discharge';
    fileDetails = await test.step('Run orchestrator path cycle 3 (Discharge)', async () => {
      return orchestrator.runDischargeHappyPath(
        page,
        scenarioId3,
        'TDAF',
        'TDAF_Discharge.txt',
        scenarioId3,
        'BC',
        fileDetails.partnerReference!
      );
    });

    await test.step('Validate unique id present cycle 3', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });

  test('TDAF Change of Province HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: New Finance
    const scenarioId1 = 'TDAF_HappyPath_NF';
    let fileDetails = await test.step('Run orchestrator path cycle 1', async () => {
      return orchestrator.runHappyPath(page, scenarioId1, 'TDAF', 'TDAF_NF', scenarioId1, 'BC', false);
    });
    fileDetails.batchType = 'NF';

    await test.step('Validate unique id present cycle 1', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    // Cycle 2: Change of Province
    const scenarioId2 = 'TDAF_HappyPath_ChangeOfProvince';
    fileDetails = await test.step('Run orchestrator path cycle 2', async () => {
      return orchestrator.runChangeOfProvinceHappyPath(page, scenarioId2, 'TDAF', 'TDAF_ChangeOfProvince.txt', scenarioId2, 'MB', fileDetails.partnerReference!);
    });

    await test.step('Validate unique id present cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });
  });
});
