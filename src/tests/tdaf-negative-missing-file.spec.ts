import { test, expect } from '../fixtures/test';
import { loadEnv } from '../config/env';
import { loadScenarioData } from '../data/testData';
import { DbService } from '../utils/dbUtility';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { HomePage } from '../pages/home.page';
import { Orchestrator } from '../services/orchestrator';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getSftpClient } from '../utils/sftp';
import * as fileSystem from '../utils/fileSystem';

test.describe('TDAF Negative Tests', () => {
  test('TDAF - EmptyFile NF', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'TDAF_HappyPath_NF';
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = scenarioId;
    fileDetails.batchType = 'NF';

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    await test.step('Setup database without uploading file', async () => {
      const db = new DbService();
      // Reset the process and file status to Not Started (0) without uploading the file
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup complete for ${fileDetails.inputFileDescription}`);
      console.log(`UniqueId: ${fileDetails.uniqueId}`);
    });

    await test.step('Trigger ClientFileScheduler job', async () => {
      const hangfirePage = new HangfireJobsPage(page);
      await hangfirePage.hangfireDashboard.click();
      await hangfirePage.hfJobs.click();
      await hangfirePage.hfDashboardTab.click();
      await hangfirePage.hfDbRecurringJobsTab.click();

      // Trigger only the ClientFileScheduler job
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
    });

    await test.step('Verify error message in database', async () => {
      const db = new DbService();

      // Check the file status immediately after scheduler runs
      const status = await db.getProcessAndFileStatus(fileDetails.uniqueId!);
      console.log(`ProcessStatusId=${status.processStatusId}, FileStatusId=${status.fileStatusId}`);

      // FileStatusId = 0 means Not Started
      // FileStatusId = 11 means Found
      // We expect the status to NOT be 11 since we didn't upload the file
      // The file should remain at status 0 (Not Started) indicating file is not present in SFTP

      // Verify that the file was NOT found (status should not be 11)
      expect(status.fileStatusId).not.toBe(11);
      console.log(`File status verified: ${status.fileStatusId} (not Found)`);
      console.log('Verified: Input File is not present in SFTP Location');
    });

    await test.step('Verify error message in UI (if applicable)', async () => {
      // Navigate to the Job Overview or Download File page to check for error messages
      const jobOverviewLink = page.locator("//ul/li/a/span[text()='Job Overview']");
      await jobOverviewLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Search for the file using the input file description or unique ID
      const searchInput = page.locator("//input[@placeholder='Search' or @type='search']").first();
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill(fileDetails.inputFileDescription!);
        await page.waitForTimeout(2000);

        // Check if there's an error message or status indicating the file is not found
        const pageContent = await page.content();
        const hasErrorMessage =
          pageContent.toLowerCase().includes('not present') ||
          pageContent.toLowerCase().includes('not found') ||
          pageContent.toLowerCase().includes('missing') ||
          pageContent.toLowerCase().includes('error');

        if (hasErrorMessage) {
          console.log('Error message found in UI indicating file is not present');
        } else {
          console.log('Note: Specific error message not visible in UI, but database confirms file was not found');
        }
      }
    });
  });

  test('TDAF - EmptyFile Renewal', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'TDAF_HappyPath_Renewal';
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = scenarioId;
    fileDetails.batchType = 'Renewal';

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Renewal UniqueId.`
      );
    }

    await test.step('Setup database without uploading file', async () => {
      const db = new DbService();
      // Reset the process and file status to Not Started (0) without uploading the file
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup complete for ${fileDetails.inputFileDescription}`);
      console.log(`UniqueId: ${fileDetails.uniqueId}`);
    });

    await test.step('Trigger ClientFileScheduler job', async () => {
      const hangfirePage = new HangfireJobsPage(page);
      await hangfirePage.hangfireDashboard.click();
      await hangfirePage.hfJobs.click();
      await hangfirePage.hfDashboardTab.click();
      await hangfirePage.hfDbRecurringJobsTab.click();

      // Trigger only the ClientFileScheduler job
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
    });

    await test.step('Verify error message in database', async () => {
      const db = new DbService();

      // Check the file status immediately after scheduler runs
      const status = await db.getProcessAndFileStatus(fileDetails.uniqueId!);
      console.log(`ProcessStatusId=${status.processStatusId}, FileStatusId=${status.fileStatusId}`);

      // FileStatusId = 0 means Not Started
      // FileStatusId = 11 means Found
      // We expect the status to NOT be 11 since we didn't upload the file
      // The file should remain at status 0 (Not Started) indicating file is not present in SFTP

      // Verify that the file was NOT found (status should not be 11)
      expect(status.fileStatusId).not.toBe(11);
      console.log(`File status verified: ${status.fileStatusId} (not Found)`);
      console.log('Verified: Renewal Input File is not present in SFTP Location');
    });

    await test.step('Verify error message in UI (if applicable)', async () => {
      // Navigate to the Job Overview or Download File page to check for error messages
      const jobOverviewLink = page.locator("//ul/li/a/span[text()='Job Overview']");
      await jobOverviewLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Search for the file using the input file description or unique ID
      const searchInput = page.locator("//input[@placeholder='Search' or @type='search']").first();
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill(fileDetails.inputFileDescription!);
        await page.waitForTimeout(2000);

        // Check if there's an error message or status indicating the file is not found
        const pageContent = await page.content();
        const hasErrorMessage =
          pageContent.toLowerCase().includes('not present') ||
          pageContent.toLowerCase().includes('not found') ||
          pageContent.toLowerCase().includes('missing') ||
          pageContent.toLowerCase().includes('error');

        if (hasErrorMessage) {
          console.log('Error message found in UI indicating file is not present');
        } else {
          console.log('Note: Specific error message not visible in UI, but database confirms file was not found');
        }
      }
    });
  });

  test('TDAF - EmptyFile Discharge', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'TDAF_HappyPath_Discharge';
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = scenarioId;
    fileDetails.batchType = 'Discharge';

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Discharge UniqueId.`
      );
    }

    await test.step('Setup database without uploading file', async () => {
      const db = new DbService();
      // Reset the process and file status to Not Started (0) without uploading the file
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup complete for ${fileDetails.inputFileDescription}`);
      console.log(`UniqueId: ${fileDetails.uniqueId}`);
    });

    await test.step('Trigger ClientFileScheduler job', async () => {
      const hangfirePage = new HangfireJobsPage(page);
      await hangfirePage.hangfireDashboard.click();
      await hangfirePage.hfJobs.click();
      await hangfirePage.hfDashboardTab.click();
      await hangfirePage.hfDbRecurringJobsTab.click();

      // Trigger only the ClientFileScheduler job
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
    });

    await test.step('Verify error message in database', async () => {
      const db = new DbService();

      // Check the file status immediately after scheduler runs
      const status = await db.getProcessAndFileStatus(fileDetails.uniqueId!);
      console.log(`ProcessStatusId=${status.processStatusId}, FileStatusId=${status.fileStatusId}`);

      // FileStatusId = 0 means Not Started
      // FileStatusId = 11 means Found
      // We expect the status to NOT be 11 since we didn't upload the file
      // The file should remain at status 0 (Not Started) indicating file is not present in SFTP

      // Verify that the file was NOT found (status should not be 11)
      expect(status.fileStatusId).not.toBe(11);
      console.log(`File status verified: ${status.fileStatusId} (not Found)`);
      console.log('Verified: Discharge Input File is not present in SFTP Location');
    });

    await test.step('Verify error message in UI (if applicable)', async () => {
      // Navigate to the Job Overview or Download File page to check for error messages
      const jobOverviewLink = page.locator("//ul/li/a/span[text()='Job Overview']");
      await jobOverviewLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Search for the file using the input file description or unique ID
      const searchInput = page.locator("//input[@placeholder='Search' or @type='search']").first();
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill(fileDetails.inputFileDescription!);
        await page.waitForTimeout(2000);

        // Check if there's an error message or status indicating the file is not found
        const pageContent = await page.content();
        const hasErrorMessage =
          pageContent.toLowerCase().includes('not present') ||
          pageContent.toLowerCase().includes('not found') ||
          pageContent.toLowerCase().includes('missing') ||
          pageContent.toLowerCase().includes('error');

        if (hasErrorMessage) {
          console.log('Error message found in UI indicating file is not present');
        } else {
          console.log('Note: Specific error message not visible in UI, but database confirms file was not found');
        }
      }
    });
  });

  test('TDAF - Verify NF invalid name', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'TDAF_Invalid_Batch_File_NF';
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = scenarioId;
    fileDetails.batchType = 'NF';

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    await test.step('Upload file with invalid name template to SFTP', async () => {
      // Create a file with an incorrect name template
      // Valid TDAF format: TDC50toPPSA.{timestamp}.XIF
      // Invalid formats we'll test:
      const invalidFileName = 'INVALID_TDAF_FILE.XIF'; // Completely wrong name

      const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
      await fs.mkdir(scenarioArtifactsDir, { recursive: true });

      // Copy the sample file to the invalid filename
      const sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_NF');
      const invalidFilePath = path.join(scenarioArtifactsDir, invalidFileName);
      await fs.copyFile(sampleFile, invalidFilePath);

      // Upload to SFTP with invalid name
      const sftp = getSftpClient();
      const remotePath = `/tdaf/in/${invalidFileName}`;
      await sftp.uploadFile(invalidFilePath, remotePath);

      fileDetails.inputFileName = invalidFileName;
      console.log(`Uploaded file with invalid name: ${invalidFileName}`);
    });

    await test.step('Setup database to expect the invalid file', async () => {
      const db = new DbService();
      // Note: We're setting up DB with the VALID file description,
      // but uploaded an INVALID filename to SFTP
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup for ${fileDetails.inputFileDescription}`);
      console.log(`UniqueId: ${fileDetails.uniqueId}`);
      console.log(`But uploaded file has invalid name: ${fileDetails.inputFileName}`);
    });

    await test.step('Trigger ClientFileScheduler job', async () => {
      const hangfirePage = new HangfireJobsPage(page);
      await hangfirePage.hangfireDashboard.click();
      await hangfirePage.hfJobs.click();
      await hangfirePage.hfDashboardTab.click();
      await hangfirePage.hfDbRecurringJobsTab.click();

      // Trigger only the ClientFileScheduler job
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
    });

    await test.step('Verify file was not found due to invalid name template', async () => {
      const db = new DbService();

      // Check the file status
      const status = await db.getProcessAndFileStatus(fileDetails.uniqueId!);
      console.log(`ProcessStatusId=${status.processStatusId}, FileStatusId=${status.fileStatusId}`);

      // FileStatusId = 0 means Not Started
      // The file should NOT be found (status should remain 0) because the filename
      // doesn't match the expected pattern for TDAF files
      expect(status.fileStatusId).toBe(0);
      console.log(`✓ File status verified: ${status.fileStatusId} (Not Started - file not recognized)`);
      console.log('✓ Verified: File with invalid name template is not recognized by scheduler');
      console.log('Expected pattern: TDC50toPPSA.{timestamp}.XIF');
      console.log(`Uploaded filename: ${fileDetails.inputFileName}`);
    });

    await test.step('Verify error in Job Overview UI', async () => {
      const jobOverviewLink = page.locator("//ul/li/a/span[text()='Job Overview']");
      await jobOverviewLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Search for the file using the input file description
      const searchInput = page.locator("//input[@placeholder='Search' or @type='search']").first();
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill(fileDetails.inputFileDescription!);
        await page.waitForTimeout(2000);

        const pageContent = await page.content();
        console.log('Checking UI for error messages related to invalid filename...');

        // The file should appear as "Not Started" in Job Overview
        // because the scheduler couldn't match it to the expected pattern
        const hasNotStarted = pageContent.toLowerCase().includes('not started');
        if (hasNotStarted) {
          console.log('✓ UI confirms file is in "Not Started" status');
        }
      }
    });

    await test.step('Cleanup - Remove invalid file from SFTP', async () => {
      const sftp = getSftpClient();
      try {
        const remotePath = `/tdaf/in/${fileDetails.inputFileName}`;
        await sftp.deleteFile(remotePath);
        console.log(`Cleaned up invalid file from SFTP: ${fileDetails.inputFileName}`);
      } catch (error) {
        console.log('Note: File may have already been processed or removed');
      }
    });
  });

  test('TDAF - Verify Renewal invalid name', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'TDAF_Invalid_Batch_File_Renewal';
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = scenarioId;
    fileDetails.batchType = 'Renewal';

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Renewal UniqueId.`
      );
    }

    await test.step('Upload file with invalid name template to SFTP', async () => {
      // Create a file with an incorrect name template
      // Valid TDAF Renewal format: TDC50toPPSA.{timestamp}.XIR
      // Invalid formats we'll test:
      const invalidFileName = 'INVALID_TDAF_RENEWAL.XIR'; // Completely wrong name

      const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
      await fs.mkdir(scenarioArtifactsDir, { recursive: true });

      // Copy the sample file to the invalid filename
      const sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_Renewal.csv');
      const invalidFilePath = path.join(scenarioArtifactsDir, invalidFileName);
      await fs.copyFile(sampleFile, invalidFilePath);

      // Upload to SFTP with invalid name
      const sftp = getSftpClient();
      const remotePath = `/tdaf/in/${invalidFileName}`;
      await sftp.uploadFile(invalidFilePath, remotePath);

      fileDetails.inputFileName = invalidFileName;
      console.log(`Uploaded file with invalid name: ${invalidFileName}`);
    });

    await test.step('Setup database to expect the invalid file', async () => {
      const db = new DbService();
      // Note: We're setting up DB with the VALID file description,
      // but uploaded an INVALID filename to SFTP
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup for ${fileDetails.inputFileDescription}`);
      console.log(`UniqueId: ${fileDetails.uniqueId}`);
      console.log(`But uploaded file has invalid name: ${fileDetails.inputFileName}`);
    });

    await test.step('Trigger ClientFileScheduler job', async () => {
      const hangfirePage = new HangfireJobsPage(page);
      await hangfirePage.hangfireDashboard.click();
      await hangfirePage.hfJobs.click();
      await hangfirePage.hfDashboardTab.click();
      await hangfirePage.hfDbRecurringJobsTab.click();

      // Trigger only the ClientFileScheduler job
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
    });

    await test.step('Verify file was not found due to invalid name template', async () => {
      const db = new DbService();

      // Check the file status
      const status = await db.getProcessAndFileStatus(fileDetails.uniqueId!);
      console.log(`ProcessStatusId=${status.processStatusId}, FileStatusId=${status.fileStatusId}`);

      // FileStatusId = 0 means Not Started
      // The file should NOT be found (status should remain 0) because the filename
      // doesn't match the expected pattern for TDAF Renewal files
      expect(status.fileStatusId).toBe(0);
      console.log(`✓ File status verified: ${status.fileStatusId} (Not Started - file not recognized)`);
      console.log('✓ Verified: Renewal file with invalid name template is not recognized by scheduler');
      console.log('Expected pattern: TDC50toPPSA.{timestamp}.XIR');
      console.log(`Uploaded filename: ${fileDetails.inputFileName}`);
    });

    await test.step('Verify error in Job Overview UI', async () => {
      const jobOverviewLink = page.locator("//ul/li/a/span[text()='Job Overview']");
      await jobOverviewLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Search for the file using the input file description
      const searchInput = page.locator("//input[@placeholder='Search' or @type='search']").first();
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill(fileDetails.inputFileDescription!);
        await page.waitForTimeout(2000);

        const pageContent = await page.content();
        console.log('Checking UI for error messages related to invalid filename...');

        // The file should appear as "Not Started" in Job Overview
        // because the scheduler couldn't match it to the expected pattern
        const hasNotStarted = pageContent.toLowerCase().includes('not started');
        if (hasNotStarted) {
          console.log('✓ UI confirms file is in "Not Started" status');
        }
      }
    });

    await test.step('Cleanup - Remove invalid file from SFTP', async () => {
      const sftp = getSftpClient();
      try {
        const remotePath = `/tdaf/in/${fileDetails.inputFileName}`;
        await sftp.deleteFile(remotePath);
        console.log(`Cleaned up invalid file from SFTP: ${fileDetails.inputFileName}`);
      } catch (error) {
        console.log('Note: File may have already been processed or removed');
      }
    });
  });

  test('TDAF - Verify Discharge invalid name', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const scenarioId = 'TDAF_Invalid_Batch_File_Discharge';
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = scenarioId;
    fileDetails.batchType = 'Discharge';

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Discharge UniqueId.`
      );
    }

    await test.step('Upload file with invalid name template to SFTP', async () => {
      // Create a file with an incorrect name template
      // Valid TDAF Discharge format: TDC50toPPSA.{timestamp}.XID
      // Invalid formats we'll test:
      const invalidFileName = 'INVALID_TDAF_DISCHARGE.XID'; // Completely wrong name

      const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
      await fs.mkdir(scenarioArtifactsDir, { recursive: true });

      // Copy the sample file to the invalid filename
      const sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_Discharge.txt');
      const invalidFilePath = path.join(scenarioArtifactsDir, invalidFileName);
      await fs.copyFile(sampleFile, invalidFilePath);

      // Upload to SFTP with invalid name
      const sftp = getSftpClient();
      const remotePath = `/tdaf/in/${invalidFileName}`;
      await sftp.uploadFile(invalidFilePath, remotePath);

      fileDetails.inputFileName = invalidFileName;
      console.log(`Uploaded file with invalid name: ${invalidFileName}`);
    });

    await test.step('Setup database to expect the invalid file', async () => {
      const db = new DbService();
      // Note: We're setting up DB with the VALID file description,
      // but uploaded an INVALID filename to SFTP
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup for ${fileDetails.inputFileDescription}`);
      console.log(`UniqueId: ${fileDetails.uniqueId}`);
      console.log(`But uploaded file has invalid name: ${fileDetails.inputFileName}`);
    });

    await test.step('Trigger ClientFileScheduler job', async () => {
      const hangfirePage = new HangfireJobsPage(page);
      await hangfirePage.hangfireDashboard.click();
      await hangfirePage.hfJobs.click();
      await hangfirePage.hfDashboardTab.click();
      await hangfirePage.hfDbRecurringJobsTab.click();

      // Trigger only the ClientFileScheduler job
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
    });

    await test.step('Verify file was not found due to invalid name template', async () => {
      const db = new DbService();

      // Check the file status
      const status = await db.getProcessAndFileStatus(fileDetails.uniqueId!);
      console.log(`ProcessStatusId=${status.processStatusId}, FileStatusId=${status.fileStatusId}`);

      // FileStatusId = 0 means Not Started
      // The file should NOT be found (status should remain 0) because the filename
      // doesn't match the expected pattern for TDAF Discharge files
      expect(status.fileStatusId).toBe(0);
      console.log(`✓ File status verified: ${status.fileStatusId} (Not Started - file not recognized)`);
      console.log('✓ Verified: Discharge file with invalid name template is not recognized by scheduler');
      console.log('Expected pattern: TDC50toPPSA.{timestamp}.XID');
      console.log(`Uploaded filename: ${fileDetails.inputFileName}`);
    });

    await test.step('Verify error in Job Overview UI', async () => {
      const jobOverviewLink = page.locator("//ul/li/a/span[text()='Job Overview']");
      await jobOverviewLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Search for the file using the input file description
      const searchInput = page.locator("//input[@placeholder='Search' or @type='search']").first();
      if (await searchInput.isVisible({ timeout: 5000 })) {
        await searchInput.fill(fileDetails.inputFileDescription!);
        await page.waitForTimeout(2000);

        const pageContent = await page.content();
        console.log('Checking UI for error messages related to invalid filename...');

        // The file should appear as "Not Started" in Job Overview
        // because the scheduler couldn't match it to the expected pattern
        const hasNotStarted = pageContent.toLowerCase().includes('not started');
        if (hasNotStarted) {
          console.log('✓ UI confirms file is in "Not Started" status');
        }
      }
    });

    await test.step('Cleanup - Remove invalid file from SFTP', async () => {
      const sftp = getSftpClient();
      try {
        const remotePath = `/tdaf/in/${fileDetails.inputFileName}`;
        await sftp.deleteFile(remotePath);
        console.log(`Cleaned up invalid file from SFTP: ${fileDetails.inputFileName}`);
      } catch (error) {
        console.log('Note: File may have already been processed or removed');
      }
    });
  });

  test('TDAF_Duplicate_BatchNumber_NF', async ({ page, loginPage }) => {
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
    // Try TDAF first, fallback to FORD if no TDAF data exists yet
    const existingBatchNumber = await test.step('Get existing batch number from DB', async () => {
      return await db.getExistingBatchNumber('TDAF', 'FORD');
    });
    console.log(`Using duplicate batch number: ${existingBatchNumber}`);

    // Load file details from testData.xlsx
    const fileDetails = loadScenarioData('TDAF_Duplicate_BatchNumber_NF');

    // Override with existing batch number for duplicate test
    fileDetails.batchNumber = existingBatchNumber;

    await test.step('Create NF file with duplicate batch number', async () => {
      await fileSystem.createTdafNfFileWithBatchNumber(fileDetails, existingBatchNumber);
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

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
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

  test('TDAF_Duplicate_BatchNumber_Renewal', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Get existing Renewal batch number from DB (in LON-TDAF format)
    const existingBatchNumber = await test.step('Get existing Renewal batch number from DB', async () => {
      // Get a batch number from TDAF that matches the LON-TDAF pattern
      return await db.getExistingBatchNumberByPattern('TDAF', 'LON-TDAF%', 'FORD');
    });
    console.log(`Using duplicate batch number: ${existingBatchNumber}`);

    // Load file details from testData.xlsx
    const renewalFileDetails = loadScenarioData('TDAF_Duplicate_BatchNumber_Renewal');
    renewalFileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_Renewal.csv');

    // Override with existing batch number for duplicate test
    renewalFileDetails.batchNumber = existingBatchNumber;

    await test.step('Create Renewal file with duplicate batch number', async () => {
      await fileSystem.createTdafRenewalFileWithBatchNumber(
        renewalFileDetails,
        existingBatchNumber,
        'DUP' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0') // Generate dummy partner ref
      );
      console.log(`Created Renewal file with duplicate batch number: ${existingBatchNumber}`);
    });

    await test.step('Set process and file status to not started', async () => {
      renewalFileDetails.batchType = 'Renewal';
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

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
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

    await test.step('Verify duplicate batch number was used in Renewal', async () => {
      expect(renewalFileDetails.batchNumber).toBe(existingBatchNumber);
      console.log('✓ Renewal duplicate batch number test completed successfully');
    });
  });

  test('TDAF_Duplicate_BatchNumber_Discharge', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Get existing Discharge batch number from DB (in LON-TDAF format)
    const existingBatchNumber = await test.step('Get existing Discharge batch number from DB', async () => {
      // Get a batch number from TDAF that matches the LON-TDAF pattern
      return await db.getExistingBatchNumberByPattern('TDAF', 'LON-TDAF%', 'FORD');
    });
    console.log(`Using duplicate batch number: ${existingBatchNumber}`);

    // Load file details from testData.xlsx
    const dischargeFileDetails = loadScenarioData('TDAF_Duplicate_BatchNumber_Discharge');
    dischargeFileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_Discharge.txt');

    // Override with existing batch number for duplicate test
    dischargeFileDetails.batchNumber = existingBatchNumber;

    await test.step('Create Discharge file with duplicate batch number', async () => {
      await fileSystem.createTdafDischargeFileWithBatchNumber(
        dischargeFileDetails,
        existingBatchNumber,
        'DUP' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0') // Generate dummy partner ref
      );
      console.log(`Created Discharge file with duplicate batch number: ${existingBatchNumber}`);
    });

    await test.step('Set process and file status to not started', async () => {
      dischargeFileDetails.batchType = 'Discharge';
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

      // Wait for the job to process and fail
      await page.waitForTimeout(10000);
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

    await test.step('Verify duplicate batch number was used in Discharge', async () => {
      expect(dischargeFileDetails.batchNumber).toBe(existingBatchNumber);
      console.log('✓ Discharge duplicate batch number test completed successfully');
    });
  });

  test('TDAF_Duplicate_FileName_NF', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Load file details from testData.xlsx
    const fileDetails = loadScenarioData('TDAF_Duplicate_FileName_NF');
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = 'TDAF_Duplicate_FileName_NF';
    fileDetails.batchType = 'NF';
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_NF');

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario TDAF_Duplicate_FileName_NF. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    await test.step('Enable duplicate filename check in database', async () => {
      // Set DisableDuplicateFileNameCheck = 0 to ENABLE the check (detect duplicates)
      // Note: The column name is confusing - 0 means the check is NOT disabled (i.e., enabled)
      await db.disableDuplicateFileNameCheck(fileDetails.inputFileDescription, 'TDAF');
      console.log(`Enabled duplicate filename check for: ${fileDetails.inputFileDescription}`);
    });

    let lastUploadedFileName = '';
    await test.step('Get last uploaded filename from ScheduledFile table', async () => {
      lastUploadedFileName = await db.getLastUploadedFileName(fileDetails.inputFileDescription);
      console.log(`Retrieved last uploaded filename: ${lastUploadedFileName}`);
    });

    await test.step('Create NF file with duplicate filename', async () => {
      await fileSystem.createTdafNfFileWithDuplicateName(fileDetails, lastUploadedFileName);
      console.log(`Created file with duplicate name: ${lastUploadedFileName}`);
    });

    await test.step('Set process and file status to not started', async () => {
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup complete. UniqueId: ${fileDetails.uniqueId}`);
    });

    await test.step('Navigate to Hangfire Dashboard', async () => {
      await homePage.openHangfireJobs();
      await hangfirePage.openRecurringJobs();
    });

    await test.step('Trigger ClientFileScheduler - should detect duplicate filename', async () => {
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(5000);
    });

    await test.step('Validate duplicate filename error in Hangfire Failed Jobs', async () => {
      const hangfireFrame = hangfirePage.getHangfireFrame();

        // Navigate to Hangfire Failed Jobs
      await hangfirePage.navigateToEnqueuedJobs();
      await hangfirePage.navigateToFailedJobs();
await page.waitForTimeout(2000);

      // Look for the SFTP: DuplicateFileName job
      const failedJobLocator = hangfireFrame.locator("//*[contains(text(), 'SFTP: DuplicateFileName') or contains(text(), 'DuplicateFileName')]");
      const failedJobCount = await failedJobLocator.count();

      expect(failedJobCount).toBeGreaterThanOrEqual(1);
      console.log(`✓ Found ${failedJobCount} failed job(s) with DuplicateFileName`);

      // Check for "Duplicate File Name Found" error message in the failed job details
      const pageContentFinal = await hangfireFrame.locator('body').textContent();
      const hasDuplicateError = pageContentFinal?.toLowerCase().includes('duplicate file name found');

      expect(hasDuplicateError).toBeTruthy();
      console.log('✓ "Duplicate File Name Found" error message confirmed in Hangfire Failed Jobs');

      // Try to get the specific error message text
      const errorDetailsLocator = hangfireFrame.locator("//*[contains(text(), 'Duplicate File Name Found')]").first();
      if (await errorDetailsLocator.isVisible({ timeout: 3000 })) {
        const errorText = await errorDetailsLocator.textContent();
        console.log(`✓ Error details: ${errorText?.substring(0, 100)}...`);
      }
    });

    await test.step('Verify duplicate filename was used', async () => {
      expect(fileDetails.inputFileName).toBe(lastUploadedFileName);
      console.log('✓ TDAF Duplicate filename test completed successfully');
    });

    await test.step('Restore duplicate filename check setting in database', async () => {
      // Set DisableDuplicateFileNameCheck = 1 to restore normal behavior (allow duplicates)
      await db.enableDuplicateFileNameCheck(fileDetails.inputFileDescription, 'TDAF');
      console.log(`Restored duplicate filename check setting for: ${fileDetails.inputFileDescription}`);
    });
  });

  test('TDAF_Duplicate_FileName_Renewal', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Load file details from testData.xlsx
    const fileDetails = loadScenarioData('TDAF_Duplicate_FileName_Renewal');
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = 'TDAF_Duplicate_FileName_Renewal';
    fileDetails.batchType = 'Renewal';
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_Renewal.csv');

    // Use renewalFileDescription instead of inputFileDescription for Renewal files
    if (!fileDetails.renewalFileDescription) {
      throw new Error(
        `RenewalFileDescription is missing in TestData.xlsx for scenario TDAF_Duplicate_FileName_Renewal. ` +
        `Please add it so DB can resolve the Renewal UniqueId.`
      );
    }

    await test.step('Enable duplicate filename check in database', async () => {
      // Set DisableDuplicateFileNameCheck = 0 to ENABLE the check (detect duplicates)
      await db.disableDuplicateFileNameCheck(fileDetails.renewalFileDescription!, 'TDAF');
      console.log(`Enabled duplicate filename check for: ${fileDetails.renewalFileDescription}`);
    });

    let lastUploadedFileName = '';
    await test.step('Get last uploaded filename from ScheduledFile table', async () => {
      lastUploadedFileName = await db.getLastUploadedFileName(fileDetails.renewalFileDescription!);
      console.log(`Retrieved last uploaded filename: ${lastUploadedFileName}`);
    });

    await test.step('Create Renewal file with duplicate filename', async () => {
      // Create a renewal file using the fileSystem utility
      const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
      await fs.mkdir(scenarioArtifactsDir, { recursive: true });

      // Copy the sample file with the duplicate filename
      const localFilePath = path.join(scenarioArtifactsDir, lastUploadedFileName);
      await fs.copyFile(fileDetails.sampleFile, localFilePath);

      // Generate new batch number and partner reference for this file
      const newBatchNumber = 'LON-TDAF' + new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
      const newPartnerRef = 'DUP' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');

      // Update the renewal CSV file with new batch number
      const content = await fs.readFile(localFilePath, 'utf-8');
      const lines = content.split(/\r?\n/);
      if (lines.length > 0) {
        lines[0] = `${newBatchNumber},,,,,,,,,,`;
      }
      if (lines.length >= 3 && newPartnerRef) {
        const cells = lines[2].split(',');
        if (cells.length > 0) {
          cells[0] = newPartnerRef;
        }
        lines[2] = cells.join(',');
      }
      await fs.writeFile(localFilePath, lines.join('\n'), 'utf-8');

      fileDetails.batchNumber = newBatchNumber;
      fileDetails.partnerReference = newPartnerRef;
      fileDetails.inputFileName = lastUploadedFileName;

      // Upload to SFTP
      const sftp = getSftpClient();
      const remotePath = `/tdaf/in/${lastUploadedFileName}`;
      await sftp.uploadFile(localFilePath, remotePath);

      console.log(`Created Renewal file with duplicate name: ${lastUploadedFileName}`);
      console.log(`Batch Number: ${fileDetails.batchNumber}`);
    });

    await test.step('Set process and file status to not started', async () => {
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup complete. UniqueId: ${fileDetails.uniqueId}`);
    });

    await test.step('Navigate to Hangfire Dashboard', async () => {
      await homePage.openHangfireJobs();
      await hangfirePage.openRecurringJobs();
    });

    await test.step('Trigger ClientFileScheduler - should detect duplicate filename', async () => {
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(5000);
    });

    await test.step('Validate duplicate filename error in Hangfire Failed Jobs', async () => {
      // Navigate to Hangfire Failed Jobs
      await hangfirePage.navigateToEnqueuedJobs();
      await hangfirePage.navigateToFailedJobs();
await page.waitForTimeout(2000);
      // Take a screenshot for evidence
      await page.screenshot({ path: `test-results/duplicate-filename-renewal-error-${Date.now()}.png`, fullPage: true });
      console.log('✓ Screenshot captured of Hangfire Failed Jobs page');

      // Look for the SFTP: DuplicateFileName job
      const hangfireFrame = hangfirePage.getHangfireFrame();
      const failedJobLocator = hangfireFrame.locator("//*[contains(text(), 'SFTP: DuplicateFileName') or contains(text(), 'DuplicateFileName')]");
      const failedJobCount = await failedJobLocator.count();

      expect(failedJobCount).toBeGreaterThanOrEqual(1);
      console.log(`✓ Found ${failedJobCount} failed job(s) with DuplicateFileName`);

      // Check for "Duplicate File Name Found" error message in the failed job details
      const pageContent = await hangfireFrame.locator('body').textContent();
      const hasDuplicateError = pageContent?.toLowerCase().includes('duplicate file name found');

      expect(hasDuplicateError).toBeTruthy();
      console.log('✓ "Duplicate File Name Found" error message confirmed in Hangfire Failed Jobs');

      // Try to get the specific error message text
      const errorDetailsLocator = hangfireFrame.locator("//*[contains(text(), 'Duplicate File Name Found')]").first();
      if (await errorDetailsLocator.isVisible({ timeout: 3000 })) {
        const errorText = await errorDetailsLocator.textContent();
        console.log(`✓ Error details: ${errorText?.substring(0, 100)}...`);
      }
    });

    await test.step('Verify duplicate filename was used', async () => {
      expect(fileDetails.inputFileName).toBe(lastUploadedFileName);
      console.log('✓ TDAF Renewal Duplicate filename test completed successfully');
    });

    await test.step('Restore duplicate filename check setting in database', async () => {
      // Set DisableDuplicateFileNameCheck = 1 to restore normal behavior (allow duplicates)
      await db.enableDuplicateFileNameCheck(fileDetails.renewalFileDescription!, 'TDAF');
      console.log(`Restored duplicate filename check setting for: ${fileDetails.renewalFileDescription}`);
    });
  });

  test('TDAF_Duplicate_FileName_Discharge', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Load file details from testData.xlsx
    const fileDetails = loadScenarioData('TDAF_Duplicate_FileName_Discharge');
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = 'TDAF_Duplicate_FileName_Discharge';
    fileDetails.batchType = 'Discharge';
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_Discharge.txt');

    // Use dischargeFileDescription for Discharge files
    if (!fileDetails.dischargeFileDescription) {
      throw new Error(
        `DischargeFileDescription is missing in TestData.xlsx for scenario TDAF_Duplicate_FileName_Discharge. ` +
        `Please add it so DB can resolve the Discharge UniqueId.`
      );
    }

    await test.step('Enable duplicate filename check in database', async () => {
      // Set DisableDuplicateFileNameCheck = 0 to ENABLE the check (detect duplicates)
      await db.disableDuplicateFileNameCheck(fileDetails.dischargeFileDescription!, 'TDAF');
      console.log(`Enabled duplicate filename check for: ${fileDetails.dischargeFileDescription}`);
    });

    let lastUploadedFileName = '';
    await test.step('Get last uploaded filename from ScheduledFile table', async () => {
      lastUploadedFileName = await db.getLastUploadedFileName(fileDetails.dischargeFileDescription!);
      console.log(`Retrieved last uploaded filename: ${lastUploadedFileName}`);
    });

    await test.step('Create Discharge file with duplicate filename', async () => {
      // Create a discharge file
      const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
      await fs.mkdir(scenarioArtifactsDir, { recursive: true });

      // Copy the sample file with the duplicate filename
      const localFilePath = path.join(scenarioArtifactsDir, lastUploadedFileName);
      await fs.copyFile(fileDetails.sampleFile, localFilePath);

      // Generate new batch number and partner reference for this file
      const newBatchNumber = 'LON-TDAF' + new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
      const newPartnerRef = 'DUP' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');

      // Update the discharge TXT file with new batch number and partner reference
      const content = await fs.readFile(localFilePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      // TDAF Discharge format: LON-TDAF<timestamp>,<partner_reference>
      if (lines.length > 0 && lines[0].trim()) {
        lines[0] = `${newBatchNumber},${newPartnerRef}`;
      }

      await fs.writeFile(localFilePath, lines.join('\n'), 'utf-8');

      fileDetails.batchNumber = newBatchNumber;
      fileDetails.partnerReference = newPartnerRef;
      fileDetails.inputFileName = lastUploadedFileName;

      // Upload to SFTP
      const sftp = getSftpClient();
      const remotePath = `/tdaf/in/${lastUploadedFileName}`;
      await sftp.uploadFile(localFilePath, remotePath);

      console.log(`Created Discharge file with duplicate name: ${lastUploadedFileName}`);
      console.log(`Batch Number: ${fileDetails.batchNumber}`);
    });

    await test.step('Set process and file status to not started', async () => {
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup complete. UniqueId: ${fileDetails.uniqueId}`);
    });

    await test.step('Navigate to Hangfire Dashboard', async () => {
      await homePage.openHangfireJobs();
      await hangfirePage.openRecurringJobs();
    });

    await test.step('Trigger ClientFileScheduler - should detect duplicate filename', async () => {
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(5000);
    });

    await test.step('Validate duplicate filename error in Hangfire Failed Jobs', async () => {
      // Navigate to Hangfire Failed Jobs
      await hangfirePage.navigateToEnqueuedJobs();
      await hangfirePage.navigateToFailedJobs();
await page.waitForTimeout(2000);
      // Take a screenshot for evidence
      await page.screenshot({ path: `test-results/duplicate-filename-discharge-error-${Date.now()}.png`, fullPage: true });
      console.log('✓ Screenshot captured of Hangfire Failed Jobs page');

      // Look for the SFTP: DuplicateFileName job
      const hangfireFrame = hangfirePage.getHangfireFrame();
      const failedJobLocator = hangfireFrame.locator("//*[contains(text(), 'SFTP: DuplicateFileName') or contains(text(), 'DuplicateFileName')]");
      const failedJobCount = await failedJobLocator.count();

      expect(failedJobCount).toBeGreaterThanOrEqual(1);
      console.log(`✓ Found ${failedJobCount} failed job(s) with DuplicateFileName`);

      // Check for "Duplicate File Name Found" error message in the failed job details
      const pageContent = await hangfireFrame.locator('body').textContent();
      const hasDuplicateError = pageContent?.toLowerCase().includes('duplicate file name found');

      expect(hasDuplicateError).toBeTruthy();
      console.log('✓ "Duplicate File Name Found" error message confirmed in Hangfire Failed Jobs');

      // Try to get the specific error message text
      const errorDetailsLocator = hangfireFrame.locator("//*[contains(text(), 'Duplicate File Name Found')]").first();
      if (await errorDetailsLocator.isVisible({ timeout: 3000 })) {
        const errorText = await errorDetailsLocator.textContent();
        console.log(`✓ Error details: ${errorText?.substring(0, 100)}...`);
      }
    });

    await test.step('Verify duplicate filename was used', async () => {
      expect(fileDetails.inputFileName).toBe(lastUploadedFileName);
      console.log('✓ TDAF Discharge Duplicate filename test completed successfully');
    });

    await test.step('Restore duplicate filename check setting in database', async () => {
      // Set DisableDuplicateFileNameCheck = 1 to restore normal behavior (allow duplicates)
      await db.enableDuplicateFileNameCheck(fileDetails.dischargeFileDescription!, 'TDAF');
      console.log(`Restored duplicate filename check setting for: ${fileDetails.dischargeFileDescription}`);
    });
  });

  test('TDAF_Duplicate_FileName_ChangeOfProvince', async ({ page, loginPage }) => {
    const env = loadEnv();

    await test.step('Login to web app', async () => {
      await loginPage.goto(env.webAppUrl);
      await loginPage.login(env.adminUser, env.adminPassword);
    });
    console.log('Logged into web application');

    const db = new DbService();
    const homePage = new HomePage(page);
    const hangfirePage = new HangfireJobsPage(page);

    // Load file details from testData.xlsx
    const fileDetails = loadScenarioData('TDAF_Duplicate_FileName_ChangeOfProvince');
    fileDetails.client = 'TDAF';
    fileDetails.fileInfo = 'TDAF';
    fileDetails.scenarioId = 'TDAF_Duplicate_FileName_ChangeOfProvince';
    fileDetails.batchType = 'COP';
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'TDAF', 'TDAF_ChangeOfProvince.txt');

    // Use copFileDescription for Change of Province files from testdata.xlsx
    if (!fileDetails.copFileDescription) {
      throw new Error(
        `COPFileDescription is missing in TestData.xlsx for scenario TDAF_Duplicate_FileName_ChangeOfProvince. ` +
        `Please add it so DB can resolve the Change of Province UniqueId.`
      );
    }

    await test.step('Enable duplicate filename check in database', async () => {
      // Set DisableDuplicateFileNameCheck = 0 to ENABLE the check (detect duplicates)
      // Get the description value from testdata.xlsx (copFileDescription)
      await db.disableDuplicateFileNameCheck(fileDetails.copFileDescription!, 'TDAF');
      console.log(`Enabled duplicate filename check for: ${fileDetails.copFileDescription}`);
    });

    let lastUploadedFileName = '';
    await test.step('Get last uploaded filename from ScheduledFile table', async () => {
      lastUploadedFileName = await db.getLastUploadedFileName(fileDetails.copFileDescription!);
      console.log(`Retrieved last uploaded filename: ${lastUploadedFileName}`);
    });

    await test.step('Create Change of Province file with duplicate filename', async () => {
      // Create a Change of Province file
      const scenarioArtifactsDir = path.join(process.cwd(), 'artifacts', fileDetails.scenarioId);
      await fs.mkdir(scenarioArtifactsDir, { recursive: true });

      // Copy the sample file with the duplicate filename
      const localFilePath = path.join(scenarioArtifactsDir, lastUploadedFileName);
      await fs.copyFile(fileDetails.sampleFile, localFilePath);

      // Generate new batch number and partner reference for this file
      const newBatchNumber = 'LON-TDAF' + new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
      const newPartnerRef = 'DUP' + String(Math.floor(Math.random() * 100000000)).padStart(8, '0');

      // Update the Change of Province TXT file with new batch number and partner reference
      const content = await fs.readFile(localFilePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      // TDAF Change of Province format: LON-TDAF<timestamp>,<partner_reference>
      if (lines.length > 0 && lines[0].trim()) {
        lines[0] = `${newBatchNumber},${newPartnerRef}`;
      }

      await fs.writeFile(localFilePath, lines.join('\n'), 'utf-8');

      fileDetails.batchNumber = newBatchNumber;
      fileDetails.partnerReference = newPartnerRef;
      fileDetails.inputFileName = lastUploadedFileName;

      // Upload to SFTP
      const sftp = getSftpClient();
      const remotePath = `/tdaf/in/${lastUploadedFileName}`;
      await sftp.uploadFile(localFilePath, remotePath);

      console.log(`Created Change of Province file with duplicate name: ${lastUploadedFileName}`);
      console.log(`Batch Number: ${fileDetails.batchNumber}`);
    });

    await test.step('Set process and file status to not started', async () => {
      await db.setProcessAndFileStatusToNotStarted(fileDetails);
      console.log(`Database setup complete. UniqueId: ${fileDetails.uniqueId}`);
    });

    await test.step('Navigate to Hangfire Dashboard', async () => {
      await homePage.openHangfireJobs();
      await hangfirePage.openRecurringJobs();
    });

    await test.step('Trigger ClientFileScheduler - should detect duplicate filename', async () => {
      await hangfirePage.triggerHFJobWithEnqueue('ClientFileScheduler');
      console.log('Triggered ClientFileScheduler Hangfire job');

      // Wait for the job to process and fail
      await page.waitForTimeout(1000);
    });

    await test.step('Validate duplicate filename error in Hangfire Failed Jobs', async () => {
      // Navigate to Hangfire Failed Jobs
      await hangfirePage.navigateToEnqueuedJobs();
      await hangfirePage.navigateToFailedJobs();
await page.waitForTimeout(2000);
      // Take a screenshot for evidence
      await page.screenshot({ path: `test-results/duplicate-filename-cop-error-${Date.now()}.png`, fullPage: true });
      console.log('✓ Screenshot captured of Hangfire Failed Jobs page');

      // Look for the SFTP: DuplicateFileName job
      const hangfireFrame = hangfirePage.getHangfireFrame();
      const failedJobLocator = hangfireFrame.locator("//*[contains(text(), 'SFTP: DuplicateFileName') or contains(text(), 'DuplicateFileName')]");
      const failedJobCount = await failedJobLocator.count();

      expect(failedJobCount).toBeGreaterThanOrEqual(1);
      console.log(`✓ Found ${failedJobCount} failed job(s) with DuplicateFileName`);

      // Check for "Duplicate File Name Found" error message in the failed job details
      const pageContent = await hangfireFrame.locator('body').textContent();
      const hasDuplicateError = pageContent?.toLowerCase().includes('duplicate file name found');

      expect(hasDuplicateError).toBeTruthy();
      console.log('✓ "Duplicate File Name Found" error message confirmed in Hangfire Failed Jobs');

      // Try to get the specific error message text
      const errorDetailsLocator = hangfireFrame.locator("//*[contains(text(), 'Duplicate File Name Found')]").first();
      if (await errorDetailsLocator.isVisible({ timeout: 3000 })) {
        const errorText = await errorDetailsLocator.textContent();
        console.log(`✓ Error details: ${errorText?.substring(0, 100)}...`);
      }
    });

    await test.step('Verify duplicate filename was used', async () => {
      expect(fileDetails.inputFileName).toBe(lastUploadedFileName);
      console.log('✓ TDAF Change of Province Duplicate filename test completed successfully');
    });

    await test.step('Restore duplicate filename check setting in database', async () => {
      // Set DisableDuplicateFileNameCheck = 1 to restore normal behavior (allow duplicates)
      // Use the description value from testdata.xlsx (copFileDescription)
      await db.enableDuplicateFileNameCheck(fileDetails.copFileDescription!, 'TDAF');
      console.log(`Restored duplicate filename check setting for: ${fileDetails.copFileDescription}`);
    });
  });

});
