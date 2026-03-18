import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { DbService } from '../utils/dbUtility';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { HomePage } from '../pages/home.page';
import { Orchestrator } from '../services/orchestrator';
import { loadScenarioData } from '../data/testData';
import * as fileSystem from '../utils/fileSystem';
import path from 'path';

test.describe('BNS COMM Negative Path - Duplicate Batch Numbers', () => {
  test('BNS_COMM_NF_Duplicate_BatchNumber', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Get existing batch number from DB
    // Try BNS_COMM first, fallback to FORD if no BNS_COMM data exists yet
    const existingBatchNumber = await test.step('Get existing batch number from DB', async () => {
      return await db.getExistingBatchNumber('BNS_COMM', 'FORD');
    });
    console.log(`Using duplicate batch number: ${existingBatchNumber}`);

    // Load file details from testData.xlsx
    const fileDetails = loadScenarioData('BNS_COMM_NF_Duplicate_BatchNumber');

    // Override with existing batch number for duplicate test
    fileDetails.batchNumber = existingBatchNumber;

    await test.step('Create NF file with duplicate batch number', async () => {
      await fileSystem.createBnsCommNfXmlWithBatchNumber(fileDetails, existingBatchNumber);
    });

    await test.step('Set process and file status to not started', async () => {
      fileDetails.batchType = 'NF';
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
    });

    await test.step('Navigate to Hangfire Dashboard', async () => {
      await homePage.openHangfireJobs();
      await hangfirePage.openRecurringJobs();
    });

    await test.step('Trigger ClientFileScheduler - should pass', async () => {
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');
      await db.validateClientFileSchedulerJobFileStatusInDB(fileDetails);
      console.log('ClientFileScheduler completed successfully - file picked up from SFTP');
    });

    await test.step('Trigger File Parsing job - should fail', async () => {
      await hangfirePage.triggerHFJob('File Parsing');
      console.log('Triggered File Parsing Hangfire job');

      // Wait for the job to process
      await page.waitForTimeout(5000);
    });

    await test.step('Validate duplicate batch number error in Hangfire UI', async () => {
      // Navigate to Enqueued Jobs then Failed Jobs
      await hangfirePage.navigateToEnqueuedJobs();
      await hangfirePage.navigateToFailedJobs();

      // Validate the duplicate batch number error message
      const errorValidation = await hangfirePage.validateDuplicateBatchNumberError(existingBatchNumber);

      // Assert that at least one error was found
      expect(errorValidation.count).toBeGreaterThanOrEqual(1);
      expect(errorValidation.message).toContain('Error: BatchNumber:');
      expect(errorValidation.message).toContain('already exists');
      expect(errorValidation.message).toContain(existingBatchNumber);

      console.log('✓ File Parsing failed as expected due to duplicate batch number');
      console.log(`✓ Error found in Hangfire Failed Jobs: ${errorValidation.message}`);
    });

    await test.step('Verify duplicate batch number was used', async () => {
      expect(fileDetails.batchNumber).toBe(existingBatchNumber);
      console.log('✓ NF Duplicate batch number test completed successfully');
    });
  });

  test('BNS_COMM_Renewal_Duplicate_BatchNumber', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: Run BNS_COMM_NF end-to-end (should pass)
    const nfFileDetails = await test.step('Cycle 1: Run BNS COMM NF orchestrator - should pass', async () => {
      return await orchestrator.runBnsCommNfHappyPath(page, 'BNS_COMM_NF');
    }, { timeout: 8 * 60 * 1000 });

    expect(nfFileDetails.uniqueId).toBeTruthy();
    expect(nfFileDetails.batchNumber).toBeTruthy();
    expect(nfFileDetails.partnerReference).toBeTruthy();
    expect(nfFileDetails.baseRegistrationNum).toBeTruthy();

    console.log(`✓ Cycle 1 completed successfully`);
    console.log(`NF Batch Number: ${nfFileDetails.batchNumber}`);
    console.log(`Partner Reference: ${nfFileDetails.partnerReference}`);
    console.log(`Registration Number: ${nfFileDetails.baseRegistrationNum}`);

    // Capture the batch number from Cycle 1 for duplicate test
    const duplicateBatchNumber = nfFileDetails.batchNumber;
    const partnerReference = nfFileDetails.partnerReference!;
    const registrationNumber = nfFileDetails.baseRegistrationNum || '';

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Cycle 2: Process Renewal with duplicate batch number (should fail)
    await test.step('Cycle 2: Load Renewal file details', async () => {
      console.log(`Using duplicate batch number from Cycle 1: ${duplicateBatchNumber}`);
    });

    // Load file details from testData.xlsx
    const renewalFileDetails = loadScenarioData('BNS_COMM_Renewal_Duplicate_BatchNumber');
    renewalFileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'BNS_COMM', 'BNS_Comm_Renewal.xml');
    renewalFileDetails.partnerReference = partnerReference;
    renewalFileDetails.baseRegistrationNum = registrationNumber;

    await test.step('Create Renewal file with duplicate batch number', async () => {
      await fileSystem.createBnsCommRenewalXmlWithBatchNumber(
        renewalFileDetails,
        duplicateBatchNumber,
        registrationNumber,
        partnerReference
      );
      console.log(`Created Renewal file with duplicate batch number: ${duplicateBatchNumber}`);
    });

    await test.step('Set process and file status to not started', async () => {
      renewalFileDetails.batchType = 'NF';
      await db.setProcessAndFileStatusToNotStarted(renewalFileDetails);
    });

    await test.step('Navigate to Hangfire Dashboard', async () => {
      await homePage.openHangfireJobs();
      await hangfirePage.openRecurringJobs();
    });

    await test.step('Trigger ClientFileScheduler - should pass', async () => {
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');
      await db.validateClientFileSchedulerJobFileStatusInDB(renewalFileDetails);
      console.log('ClientFileScheduler completed successfully - file picked up from SFTP');
    });

    await test.step('Trigger File Parsing job - should fail', async () => {
      await hangfirePage.triggerHFJob('File Parsing');
      console.log('Triggered File Parsing Hangfire job');

      // Wait for the job to process
      await page.waitForTimeout(5000);
    });

    await test.step('Validate duplicate batch number error in Hangfire UI', async () => {
      // Navigate to Enqueued Jobs then Failed Jobs
      await hangfirePage.navigateToEnqueuedJobs();
      await hangfirePage.navigateToFailedJobs();

      // Validate the duplicate batch number error message
      const errorValidation = await hangfirePage.validateDuplicateBatchNumberError(duplicateBatchNumber);

      // Assert that at least one error was found
      expect(errorValidation.count).toBeGreaterThanOrEqual(1);
      expect(errorValidation.message).toContain('Error: BatchNumber:');
      expect(errorValidation.message).toContain('already exists');
      expect(errorValidation.message).toContain(duplicateBatchNumber);

      console.log('✓ File Parsing failed as expected due to duplicate batch number');
      console.log(`✓ Error found in Hangfire Failed Jobs: ${errorValidation.message}`);
    });

    await test.step('Verify duplicate batch number was used in Renewal', async () => {
      expect(renewalFileDetails.batchNumber).toBe(duplicateBatchNumber);
      console.log('✓ Renewal duplicate batch number test completed successfully');
    });
  });

  test('BNS_COMM_Discharge_Duplicate_BatchNumber', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const orchestrator = new Orchestrator();

    // Cycle 1: Run BNS_COMM_NF end-to-end (should pass)
    const nfFileDetails = await test.step('Cycle 1: Run BNS COMM NF orchestrator - should pass', async () => {
      return await orchestrator.runBnsCommNfHappyPath(page, 'BNS_COMM_NF');
    }, { timeout: 8 * 60 * 1000 });

    expect(nfFileDetails.uniqueId).toBeTruthy();
    expect(nfFileDetails.batchNumber).toBeTruthy();
    expect(nfFileDetails.partnerReference).toBeTruthy();
    expect(nfFileDetails.baseRegistrationNum).toBeTruthy();

    console.log(`✓ Cycle 1 completed successfully`);
    console.log(`NF Batch Number: ${nfFileDetails.batchNumber}`);
    console.log(`Partner Reference: ${nfFileDetails.partnerReference}`);
    console.log(`Registration Number: ${nfFileDetails.baseRegistrationNum}`);

    // Capture the batch number from Cycle 1 for duplicate test
    const duplicateBatchNumber = nfFileDetails.batchNumber;
    const partnerReference = nfFileDetails.partnerReference!;
    const registrationNumber = nfFileDetails.baseRegistrationNum || '';

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Cycle 2: Process Discharge with duplicate batch number (should fail)
    await test.step('Cycle 2: Load Discharge file details', async () => {
      console.log(`Using duplicate batch number from Cycle 1: ${duplicateBatchNumber}`);
    });

    // Load file details from testData.xlsx
    const dischargeFileDetails = loadScenarioData('BNS_COMM_Discharge_Duplicate_BatchNumber');
    dischargeFileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'BNS_COMM', 'BNS_Comm_Discharge.xml');
    dischargeFileDetails.partnerReference = partnerReference;
    dischargeFileDetails.baseRegistrationNum = registrationNumber;

    await test.step('Create Discharge file with duplicate batch number', async () => {
      await fileSystem.createBnsCommDischargeXmlWithBatchNumber(
        dischargeFileDetails,
        duplicateBatchNumber,
        registrationNumber,
        partnerReference
      );
      console.log(`Created Discharge file with duplicate batch number: ${duplicateBatchNumber}`);
    });

    await test.step('Set process and file status to not started', async () => {
      dischargeFileDetails.batchType = 'NF';
      await db.setProcessAndFileStatusToNotStarted(dischargeFileDetails);
    });

    await test.step('Navigate to Hangfire Dashboard', async () => {
      await homePage.openHangfireJobs();
      await hangfirePage.openRecurringJobs();
    });

    await test.step('Trigger ClientFileScheduler - should pass', async () => {
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');
      await db.validateClientFileSchedulerJobFileStatusInDB(dischargeFileDetails);
      console.log('ClientFileScheduler completed successfully - file picked up from SFTP');
    });

    await test.step('Trigger File Parsing job - should fail', async () => {
      await hangfirePage.triggerHFJob('File Parsing');
      console.log('Triggered File Parsing Hangfire job');

      // Wait for the job to process
      await page.waitForTimeout(5000);
    });

    await test.step('Validate duplicate batch number error in Hangfire UI', async () => {
      // Navigate to Enqueued Jobs then Failed Jobs
      await hangfirePage.navigateToEnqueuedJobs();
      await hangfirePage.navigateToFailedJobs();

      // Validate the duplicate batch number error message
      const errorValidation = await hangfirePage.validateDuplicateBatchNumberError(duplicateBatchNumber);

      // Assert that at least one error was found
      expect(errorValidation.count).toBeGreaterThanOrEqual(1);
      expect(errorValidation.message).toContain('Error: BatchNumber:');
      expect(errorValidation.message).toContain('already exists');
      expect(errorValidation.message).toContain(duplicateBatchNumber);

      console.log('✓ File Parsing failed as expected due to duplicate batch number');
      console.log(`✓ Error found in Hangfire Failed Jobs: ${errorValidation.message}`);
    });

    await test.step('Verify duplicate batch number was used in Discharge', async () => {
      expect(dischargeFileDetails.batchNumber).toBe(duplicateBatchNumber);
      console.log('✓ Discharge duplicate batch number test completed successfully');
    });
  });
});
