import { loadEnv } from '../config/env';
import { test, expect } from '../fixtures/test';
import path from 'path';
import { DownloadPage } from '../pages/download.page';
import { FileDetails } from '../models/fileDetails';
import { LoginPage } from '../pages/login.page';

import { ExcelHelper } from '../utils/excelHelper';

test('DownloadPage dummy test for GBC Daily Input File', async ({ page, downloadPage }) => {

  // Prepare dummy FileDetails
  const fileDetails: FileDetails = {
    scenarioId: 'dummy-scenario',
    client: 'GBC',
    fileInfo: 'GBC',
    inputFileDescription: '',
    sampleFile: '',
    downloadFileType: 'ClientSummaryFile',
    inputFileName: 'PPtoDH_20260128_061614.XIF',
    fromDate: undefined,
    toDate: undefined,
    includeDeletedFile: false,
    // Add other required fields as needed
  };
  const env = loadEnv();
  const loginPage = new LoginPage(page);
  await test.step('Login to web app', async () => {
    await loginPage.goto(env.webAppUrl);
    await loginPage.login(env.adminUser, env.adminPassword);
  });
    console.log('Logged into web application');

  await test.step('Set download criteria', async () => {
    await downloadPage.setDownloadCriteria(fileDetails);
  });
  const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
  // Get test name for foldering
  let testName = 'default';
  try {
    // @ts-ignore
    if (typeof test !== 'undefined' && test.info) {
      // @ts-ignore
      testName = test.info().title.replace(/[^a-zA-Z0-9_-]/g, '_');
    }
  } catch {}
  await test.step('Download and verify file', async () => {
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
  });
  expect(fileDetails.summaryReportFileName).toBeTruthy();
  const summaryReportPath = path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!);
  ExcelHelper.verifyImportedSuccessfullyGreaterThanZero(summaryReportPath);
  console.log('Dummy test completed. Summary report:', fileDetails.summaryReportFileName);
});
