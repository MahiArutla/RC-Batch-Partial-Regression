import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { Orchestrator } from '../services/orchestrator';

test.describe('GMFCL Happy Path Tests', () => {
  test('GMFCL_NFHappyPath', async ({ page, loginPage }) => {
    const env = loadEnv();
    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();
    const scenarioId = 'GMFCL_NFHappyPath';

    const fileDetails = await test.step('Run GMFCL NF Happy Path', async () => {
      return orchestrator.runGmfclNfHappyPath(page, scenarioId);
    });

    await test.step('Validate GMFCL file processing completed', async () => {
      expect(fileDetails.uniqueId).toBeTruthy();
      expect(fileDetails.partnerReference).toBeTruthy();
      expect(fileDetails.batchNumber).toBeTruthy();
      expect(fileDetails.returnFileName).toBeTruthy();
      console.log(`✓ GMFCL NF file processed successfully`);
      console.log(`  File: ${fileDetails.inputFileName}`);
      console.log(`  Partner Reference: ${fileDetails.partnerReference}`);
      console.log(`  Batch Number: ${fileDetails.batchNumber}`);
      console.log(`  Order ID: ${fileDetails.orderId}`);
      console.log(`  Return File: ${fileDetails.returnFileName}`);
    });
  });
});
