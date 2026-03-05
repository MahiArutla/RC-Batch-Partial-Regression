import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('BNS_COMM Amendment Happy Path', () => {
  test('BNS_COMM NF -> Amendment HappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: New Finance
    const scenarioId1 = 'BNS_COMM_AmendmentHappyPath_NF';
    let fileDetails = await test.step('Run orchestrator path cycle 1 (New Finance)', async () => {
      return orchestrator.runBnsCommHappyPathNF(page, scenarioId1);
    });

    await test.step('Validate unique id present cycle 1', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Validate return file generated cycle 1', async () => {
      expect(fileDetails.returnFileName).toBeTruthy();
    });

    // Cycle 2: Amendment
    const scenarioId2 = 'BNS_COMM_AmendmentHappyPath_Amendment';
    fileDetails = await test.step('Run orchestrator path cycle 2 (Amendment)', async () => {
      return orchestrator.runBnsCommHappyPathAmendment(
        page,
        scenarioId2,
        fileDetails.baseRegistrationNum!,
        fileDetails.partnerReference!
      );
    });

    await test.step('Validate unique id present cycle 2', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
    });

    await test.step('Validate return file generated cycle 2', async () => {
      expect(fileDetails.returnFileName).toBeTruthy();
    });
  });
});
