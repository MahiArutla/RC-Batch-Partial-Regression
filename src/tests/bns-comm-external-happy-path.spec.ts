import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('BNS COMM External Happy Path', () => {
  test('BNS_COMM_ExternalHappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'BNS_COMM_ExternalHappyPath';

    const fileDetails = await test.step('Run BNS COMM External Happy Path', async () => {
      return orchestrator.runBnsCommExternalHappyPath(page, scenarioId);
    });

    await test.step('Validate External file processing completed', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.baseRegistrationNum).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.orderId).toBeTruthy();
      expect(fileDetails.returnFileName).toBeTruthy();
      console.log(`✓ BNS COMM External file processed successfully`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Registration Number: ${fileDetails.baseRegistrationNum}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Return File: ${fileDetails.returnFileName}`);
    });
  });
});
