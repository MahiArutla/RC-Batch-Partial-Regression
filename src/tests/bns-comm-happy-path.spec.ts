import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('BNS Commercial Smoke', () => {
  test('BNS COMM NF', async ({ page, loginPage }) => {
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
  test('BNS COMM Discharge', async ({ page, loginPage }) => {
    const env = loadEnv();
    // --- Cycle 1: Same as Happy Path ---
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });

    const scenarioId = 'BNS_COMM_HappyPath_NF';
    const orchestrator = new Orchestrator();

    // Cycle 1: Generate and capture partnerReference
    let fileDetails = await test.step('Run BNS COMM NF orchestrator', async () => {
      return orchestrator.runBnsCommHappyPathNF(page, scenarioId);
    });
    const partnerReference = fileDetails.partnerReference;
    const registrationNumber = fileDetails.baseRegistrationNum || '';

    // --- Cycle 2: Discharge ---
    const dischargeScenarioId = 'BNS_COMM_DischargeHappyPath';
    // Pass partnerReference explicitly to ensure it is the same
    let dischargeFileDetails = await test.step('Run BNS COMM Discharge orchestrator', async () => {
      // Set partnerReference in fileDetails for discharge
      return orchestrator.runBnsCommHappyPathDischarge(page, dischargeScenarioId, registrationNumber, partnerReference!);
    });

    // Validate unique id present
    expect(dischargeFileDetails.uniqueId).toBeTruthy();
  });
});
