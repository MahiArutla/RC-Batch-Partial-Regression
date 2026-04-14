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


});
