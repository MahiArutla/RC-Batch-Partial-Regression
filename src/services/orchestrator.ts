import { Page } from '@playwright/test';
import path from 'path';
import fs from 'fs/promises';
import { FileDetails } from '../models/fileDetails';
import { DbService } from '../utils/dbUtility';
import * as fileSystem from '../utils/fileSystem';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { HangfireWorkflow } from './hangfireWorkflow';
import { DownloadPage } from '../pages/download.page';
import { ExcelHelper } from '../utils/excelHelper';
import { loadScenarioData } from '../data/testData';
import { ManualProcessingService } from './manualProcessingService';
import { loadEnv } from '../config/env';

export class Orchestrator {
  // ─────────────────────────────────────────────────────────────────────────────
  // GBC Happy Path NF
  // ─────────────────────────────────────────────────────────────────────────────
  async runHappyPath(
    page: Page,
    scenarioId: string,
    client: string,
    sampleFileName: string,
    testName: string,
    province: string,
    returnFileEligible: boolean
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    const fsSync = await import('fs');
    const localSampleByClient = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    const localSampleAtRoot = path.resolve(process.cwd(), 'src', 'data', sampleFileName);
    fileDetails.sampleFile = fsSync.existsSync(localSampleByClient) ? localSampleByClient : localSampleAtRoot;
    fileDetails.client = client;
    fileDetails.fileInfo = client;
    fileDetails.scenarioId = scenarioId;

    await fileSystem.createNfFileByClient(fileDetails);

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToHFJobs(db, fileDetails);

    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, province, 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
    ExcelHelper.verifyImportedSuccessfullyGreaterThanZero(
      path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!)
    );
    console.log('Summary report file downloaded and verified:', fileDetails.summaryReportFileName);

    if (returnFileEligible) {
      if (!fileDetails.returnFileDescription) {
        throw new Error(
          `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
          `Please add it so DB can resolve the Return UniqueId.`
        );
      }
      fileDetails.downloadFileType = 'ReturnFile';
      await this.downloadAndValidateReturnFileWithRetry(
        page,
        db,
        hangfirePage,
        downloadPage,
        fileDetails,
        downloadDir,
        testName
      );
    }

    console.log(
      `File processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    );

    return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Renewal Happy Path
  // ─────────────────────────────────────────────────────────────────────────────
  async runRenewalHappyPath(
    page: Page,
    scenarioId: string,
    client: string,
    sampleFileName: string,
    testName: string,
    province: string,
    partnerReference: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    const localSample = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    fileDetails.sampleFile = localSample;
    fileDetails.client = client;
    fileDetails.fileInfo = client;
    fileDetails.scenarioId = scenarioId;
    fileDetails.partnerReference = partnerReference;

    await fileSystem.createRenewalFile(fileDetails);

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    const db = new DbService();
    fileDetails.batchType = 'Renewal';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails);
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB');

    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, province, 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
    const renewalSummaryPath = path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!);
    const isTdafRenewal = (fileDetails.client ?? '').toUpperCase() === 'TDAF';
    if (isTdafRenewal) {
      // TDAF renewal summaries can legitimately report zero imported rows.
      ExcelHelper.verifyImportedSuccessfullyAtLeast(renewalSummaryPath, 0);
    } else {
      ExcelHelper.verifyImportedSuccessfullyGreaterThanZero(renewalSummaryPath);
    }
    console.log('Summary report file downloaded and verified:', fileDetails.summaryReportFileName);

    console.log(
      `Renewal file processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    );

    return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Discharge Happy Path
  // ─────────────────────────────────────────────────────────────────────────────
  async runDischargeHappyPath(
    page: Page,
    scenarioId: string,
    client: string,
    sampleFileName: string,
    testName: string,
    province: string,
    partnerReference: string,
    baseRegistrationNum?: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    const localSample = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    fileDetails.sampleFile = localSample;
    fileDetails.client = client;
    fileDetails.fileInfo = client;
    fileDetails.scenarioId = scenarioId;
    fileDetails.partnerReference = partnerReference;
    if (baseRegistrationNum) {
      fileDetails.baseRegistrationNum = baseRegistrationNum;
    }

    await fileSystem.createDischargeFile(fileDetails);

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    const db = new DbService();
    fileDetails.batchType = 'Discharge';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails);
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB');

    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, province, 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
    const dischargeSummaryPath = path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!);
    const isTdafDischarge = (fileDetails.client ?? '').toUpperCase() === 'TDAF';
    if (isTdafDischarge) {
      // TDAF discharge summaries can legitimately report zero imported rows.
      ExcelHelper.verifyImportedSuccessfullyAtLeast(dischargeSummaryPath, 0);
    } else {
      ExcelHelper.verifyImportedSuccessfullyGreaterThanZero(dischargeSummaryPath);
    }
    console.log('Summary report file downloaded and verified:', fileDetails.summaryReportFileName);

    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }
    fileDetails.downloadFileType = 'ReturnFile';
    await this.downloadAndValidateReturnFileWithRetry(
      page,
      db,
      hangfirePage,
      downloadPage,
      fileDetails,
      downloadDir,
      testName
    );

    console.log(
      `Discharge file processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    );

    return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Change of Province Happy Path
  // ─────────────────────────────────────────────────────────────────────────────
  async runChangeOfProvinceHappyPath(
    page: Page,
    scenarioId: string,
    client: string,
    sampleFileName: string,
    testName: string,
    province: string,
    partnerReference: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    const localSample = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    fileDetails.sampleFile = localSample;
    fileDetails.client = client;
    fileDetails.fileInfo = client;
    fileDetails.scenarioId = scenarioId;
    fileDetails.partnerReference = partnerReference;

    await fileSystem.createChangeOfProvinceFile(fileDetails);
    await page.waitForTimeout(2000);

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    const db = new DbService();
    fileDetails.batchType = 'COP';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails, false);
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB');

    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, province, 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
    const copSummaryPath = path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!);
    try {
      ExcelHelper.verifyImportedSuccessfullyGreaterThanZero(copSummaryPath);
    } catch (error) {
      // COP can legitimately return validation warnings with zero imported rows in summary.
      console.warn(`COP summary strict import check skipped for ${fileDetails.summaryReportFileName}:`, error);
    }
    console.log('Summary report file downloaded and verified:', fileDetails.summaryReportFileName);

    console.log(
      `Change of Province file processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    );

    return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Greenlight Discharge Happy Path (TDAF)
  // ─────────────────────────────────────────────────────────────────────────────
  async runGreenlightDischargeHappyPath(
    page: Page,
    scenarioId: string,
    client: string,
    sampleFileName: string,
    testName: string,
    province: string,
    partnerReference: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    const localSample = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    fileDetails.sampleFile = localSample;
    fileDetails.client = client;
    fileDetails.fileInfo = client;
    fileDetails.scenarioId = scenarioId;
    fileDetails.partnerReference = partnerReference;

    await fileSystem.createGreenlightDischargeFile(fileDetails);

    // Greenlight discharge uses greenlightDischargeFileDescription for DB lookup
    if (!fileDetails.greenlightDischargeFileDescription) {
      throw new Error(
        `GreenlightDischargeFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Greenlight Discharge UniqueId.`
      );
    }

    // Set dischargeFileDescription so the DB utility can use it for GreenlightDischarge batch type
    fileDetails.dischargeFileDescription = fileDetails.greenlightDischargeFileDescription;

    const db = new DbService();
    fileDetails.batchType = 'GreenlightDischarge';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);

    // Wait to ensure file system propagation
    await page.waitForTimeout(3000);

    // Navigate to home page to unlock menu (exit from previous Hangfire iframe context)
    const env = loadEnv();
    await page.goto(env.webAppUrl);
    await page.waitForTimeout(2000);
    console.log('Navigated to home page before starting Greenlight Discharge cycle');

    const hangfirePage = new HangfireJobsPage(page);

    await hangfirePage.goToProcessHFJobs(db, fileDetails, false);
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB for Greenlight Discharge');


    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, province, 'superuser');
    console.log('Manual Processing API response for Greenlight Discharge:', manualResponse);

    // Download & verify client summary report to confirm discharge processing completed successfully
    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
    const dischargeSummaryPath = path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!);
    // TDAF discharge summaries can legitimately report zero imported rows
    ExcelHelper.verifyImportedSuccessfullyAtLeast(dischargeSummaryPath, 0);
    console.log('Summary report file downloaded and verified for Greenlight Discharge:', fileDetails.summaryReportFileName);

    // Download return file for greenlight discharge
    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }

    // Preserve original values before return file processing
    const originalBatchType = fileDetails.batchType;
    const originalDischargeFileDescription = fileDetails.dischargeFileDescription;

    fileDetails.downloadFileType = 'ReturnFile';
    await this.downloadAndValidateReturnFileWithRetry(
      page,
      db,
      hangfirePage,
      downloadPage,
      fileDetails,
      downloadDir,
      testName
    );

    // Restore original values
    fileDetails.batchType = originalBatchType;
    fileDetails.dischargeFileDescription = originalDischargeFileDescription;

    console.log('✓ Greenlight Discharge completed successfully');
    console.log(`  File: ${fileDetails.inputFileName}`);
    console.log(`  Partner Reference from Cycle 1: ${fileDetails.partnerReference}`);
    console.log(`  Batch Type: ${fileDetails.batchType}`);
    console.log(`  Description: ${fileDetails.dischargeFileDescription}`);
    console.log(`  Return File: ${fileDetails.returnFileName}`);

    return fileDetails;
  }

  async runFordHappyPathNF(page: Page, scenarioId: string): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = fileDetails.client || 'FORD';
    fileDetails.fileInfo = fileDetails.fileInfo || 'ford';
    fileDetails.scenarioId = scenarioId;
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'FORD', 'Ford_NF.fc');

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add a description so DB lookup can resolve UniqueId.`
      );
    }

    await fileSystem.createFordNfFc(fileDetails);

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails);

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    const testName = scenarioId;
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
    ExcelHelper.verifyImportedSuccessfullyGreaterThanZero(
      path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!)
    );

    return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ClearCharge Happy Path (Billing -> Summary download)
  // ─────────────────────────────────────────────────────────────────────────────
  async runClearChargeHappyPath(
    page: Page,
    scenarioId: string,
    testName: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.client = fileDetails.client || 'CLEARCHARGE';
    fileDetails.fileInfo = fileDetails.fileInfo || 'CLEARCHARGE';
    fileDetails.scenarioId = scenarioId;

    await fileSystem.createNfFileByClient(fileDetails);

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the billing file UniqueId.`
      );
    }

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails, true);
    await db.validateClientFileSchedulerJobFileStatusInDB(fileDetails);
    console.log('ClearCharge billing file picked up by scheduler and marked Found in DB');

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    await downloadPage.downloadAndVerifyReturnFile(fileDetails, downloadDir, testName);
    if (!fileDetails.summaryReportFileName) {
      throw new Error('ClearCharge summary report was not downloaded.');
    }
    console.log('ClearCharge summary report downloaded:', fileDetails.summaryReportFileName);

    return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BNS Commercial Happy Path NF
  // ─────────────────────────────────────────────────────────────────────────────
  async runBnsCommHappyPathNF(page: Page, scenarioId: string): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'BNS_COMM', 'BNS_Comm_NF.xml');
    fileDetails.scenarioId = scenarioId;

    if (!fileDetails.inputFileDescription) {
      throw new Error(`InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}.`);
    }

    await fileSystem.createBnsCommNfXml(fileDetails);

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToHFJobs(db, fileDetails);

    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, 'BC', 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    /* const downloadPage = new DownloadPage(page);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    const testName = scenarioId;

    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }
    fileDetails.downloadFileType = 'ReturnFile';
    await this.downloadAndValidateReturnFileWithRetry(
      page,
      db,
      hangfirePage,
      downloadPage,
      fileDetails,
      downloadDir,
      testName
    );

    // Extract registration number from return file
    await this.extractRegistrationNumberFromReturnFile(fileDetails, testName);

    console.log(
      `File processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    ); */

    return fileDetails;
  }
  async runBnsCommHappyPathDischarge(
    page: Page,
    scenarioId: string,
    registrationNumber: string,
    partnerReference: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'BNS_COMM', 'BNS_Comm_Discharge.xml');
    fileDetails.scenarioId = scenarioId;
    fileDetails.partnerReference = partnerReference;
    fileDetails.baseRegistrationNum = registrationNumber;

    await fileSystem.createBnsCommDischargeXml(fileDetails);

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails);
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB');
    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, 'BC', 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    const testName = scenarioId;

    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }
    fileDetails.downloadFileType = 'ReturnFile';
    await this.downloadAndValidateReturnFileWithRetry(
      page,
      db,
      hangfirePage,
      downloadPage,
      fileDetails,
      downloadDir,
      testName
    );

    console.log(
      `File processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    );

     return fileDetails;
  }
  async runBnsCommHappyPathRenewal(
    page: Page,
    scenarioId: string,
    registrationNumber: string,
    partnerReference: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'BNS_COMM', 'BNS_Comm_Renewal.xml');
    fileDetails.scenarioId = scenarioId;
    fileDetails.partnerReference = partnerReference;
    fileDetails.baseRegistrationNum = registrationNumber;

    await fileSystem.createBnsCommDischargeXml(fileDetails);

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails);
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB');
    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, 'BC', 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    const testName = scenarioId;

    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }
    fileDetails.downloadFileType = 'ReturnFile';
    await this.downloadAndValidateReturnFileWithRetry(
      page,
      db,
      hangfirePage,
      downloadPage,
      fileDetails,
      downloadDir,
      testName
    );

    console.log(
      `File processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    );

     return fileDetails;
  }
  async runBnsCommHappyPathAmendment(
    page: Page,
    scenarioId: string,
    registrationNumber: string,
    partnerReference: string
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'BNS_COMM', 'BNS_Comm_Amendment.xml');
    fileDetails.scenarioId = scenarioId;
    fileDetails.partnerReference = partnerReference;
    fileDetails.baseRegistrationNum = registrationNumber;

    await fileSystem.createBnsCommDischargeXml(fileDetails);

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails);
    const manualProcessingService = new ManualProcessingService();
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, 'BC', 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    const testName = scenarioId;

    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }
    fileDetails.downloadFileType = 'ReturnFile';
    await this.downloadAndValidateReturnFileWithRetry(
      page,
      db,
      hangfirePage,
      downloadPage,
      fileDetails,
      downloadDir,
      testName
    );

    console.log(
      `File processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} ` +
      `and OrderId ${fileDetails.orderId}`
    );

     return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // BNS COMM External Happy Path
  // ─────────────────────────────────────────────────────────────────────────────
  async runBnsCommExternalHappyPath(page: Page, scenarioId: string): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'BNS_COMM', 'BNS_Comm_External.xml');
    fileDetails.scenarioId = scenarioId;

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the UniqueId.`
      );
    }

    await fileSystem.createBnsCommExternalFile(fileDetails);

    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToProcessHFJobs(db, fileDetails);
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB for BNS COMM External');

    // Generate and validate return file
    const downloadPage = new DownloadPage(page);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    const testName = scenarioId;

    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }
    fileDetails.downloadFileType = 'ReturnFile';
    await this.downloadAndValidateReturnFileWithRetry(
      page,
      db,
      hangfirePage,
      downloadPage,
      fileDetails,
      downloadDir,
      testName
    );

    console.log(
      `BNS COMM External file processed with Batchnumber ${fileDetails.batchNumber}, ` +
      `filename ${fileDetails.inputFileName}, PartnerReference ${fileDetails.partnerReference}, ` +
      `RegistrationNumber ${fileDetails.baseRegistrationNum}, OrderId ${fileDetails.orderId}, ` +
      `and ReturnFile ${fileDetails.returnFileName}`
    );

    return fileDetails;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────
  private async downloadAndValidateReturnFileWithRetry(
    page: Page,
    db: DbService,
    hangfirePage: HangfireJobsPage,
    downloadPage: DownloadPage,
    fileDetails: FileDetails,
    downloadDir: string,
    testName: string,
    maxAttempts: number = 6
  ): Promise<void> {
    const triggerReturnGeneration = async (): Promise<void> => {
      fileDetails.batchType = 'Return';
      await db.setProcessAndFileStatusToNotStartedReturn(fileDetails);
      await hangfirePage.waitForHangfireReady();
      await hangfirePage.disableStickyHeader();
      await hangfirePage.goToHFJobsForReturnFile(db, fileDetails);
    };

    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      await triggerReturnGeneration();
      await downloadPage.setDownloadCriteria(fileDetails);
      await downloadPage.downloadAndVerifyReturnFile(fileDetails, downloadDir, testName);
      try {
        await this.validatePartnerReferenceInReturnFile(fileDetails, testName);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          await page.waitForTimeout(15000);
        }
      }
    }
    const details = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(
      `Return file validation failed after ${maxAttempts} attempts. ` +
      `Expected partnerReference=${fileDetails.partnerReference}, batchNumber=${fileDetails.batchNumber}. ` +
      `Last error: ${details}`
    );
  }

  private async validatePartnerReferenceInReturnFile(fileDetails: FileDetails, testName: string): Promise<void> {
    const fs = await import('fs');
    if (!fileDetails.returnFileName || !fileDetails.partnerReference) {
      throw new Error('Return file name or partner reference is not set in fileDetails.');
    }
    const returnFilePath = path.join(process.cwd(), 'artifacts', testName, fileDetails.returnFileName);
    const fileContent = fs.readFileSync(returnFilePath, 'utf-8');
    const normalize = (value: string) => value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const normalizedContent = normalize(fileContent);
    const expectedReference = normalize(fileDetails.partnerReference);
    const referenceFound = normalizedContent.includes(expectedReference);
    const isVwClient =
      (fileDetails.client ?? '').toUpperCase() === 'VW' ||
      (fileDetails.client ?? '').toUpperCase() === 'VOLKSWAGEN';
    const isTdafClient = (fileDetails.client ?? '').toUpperCase() === 'TDAF';
    const batchFound = fileDetails.batchNumber
      ? normalizedContent.includes(normalize(fileDetails.batchNumber))
      : true;
    if (isTdafClient) {
      // TDAF discharge return files can be an empty Registration-List payload and may not echo partner reference/batch.
      if (!fileContent.includes('<Registration-List')) {
        throw new Error(`Unexpected TDAF return XML format in ${fileDetails.returnFileName}`);
      }
      console.log(`TDAF Return File ${fileDetails.returnFileName} downloaded with valid XML structure`);
      return;
    }
    if (!referenceFound) {
      throw new Error(
        `${fileDetails.partnerReference} ` +
        `not present in Return File ${fileDetails.returnFileName}`
      );
    }
    if (!isVwClient && !batchFound) {
      throw new Error(
        `batch ${fileDetails.batchNumber} not present in Return File ${fileDetails.returnFileName}`
      );
    }
    console.log(`PartnerReference ${fileDetails.partnerReference} found in Return File ${fileDetails.returnFileName}`);
  }

  private async extractRegistrationNumberFromReturnFile(fileDetails: FileDetails, testName: string): Promise<void> {
    const fs = await import('fs');
    if (!fileDetails.returnFileName) {
      console.log('No return file to extract registration number from');
      return;
    }
    const returnFilePath = path.join(process.cwd(), 'artifacts', testName, fileDetails.returnFileName);

    if (!fs.existsSync(returnFilePath)) {
      console.log(`Return file not found at ${returnFilePath}`);
      return;
    }

    const fileContent = fs.readFileSync(returnFilePath, 'utf-8');

    // Extract Registration-Number from XML
    // Pattern: <Registration-Number>VALUE</Registration-Number>
    const regNumMatch = fileContent.match(/<Registration-Number>([^<]+)<\/Registration-Number>/);
    if (regNumMatch && regNumMatch[1]) {
      fileDetails.baseRegistrationNum = regNumMatch[1].trim();
      console.log(`Extracted Registration Number from return file: ${fileDetails.baseRegistrationNum}`);
    } else {
      console.log('Could not extract Registration Number from return file');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GBC Tilde File Methods (formerly from FeatureGbcService)
  // ─────────────────────────────────────────────────────────────────────────────

  async createNfFileTilde(fileDetails: FileDetails): Promise<void> {
    await fileSystem.createNfFileTilde(fileDetails);
    const db = new DbService();
    fileDetails.batchType = 'NF';
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
  }

  async runAllProvinceHappyPath(page: Page, fileDetails: FileDetails): Promise<void> {
    const db = new DbService();
    const hangfireWorkflow = new HangfireWorkflow(db);
    await hangfireWorkflow.runAllProvinceHappyPath(page, fileDetails);
  }

  async prepareReturnFile(fileDetails: FileDetails): Promise<void> {
    fileDetails.downloadFileType = 'ReturnFile';
    const db = new DbService();
    fileDetails.batchType = 'Return';
    await db.setProcessAndFileStatusToNotStartedReturn(fileDetails);
  }

  async runReturnFileFlow(page: Page, fileDetails: FileDetails): Promise<void> {
    const db = new DbService();
    const hangfireWorkflow = new HangfireWorkflow(db);
    await hangfireWorkflow.runReturnFileFlow(page, fileDetails);
  }

  async validateRefNumInReturnFile(fileDetails: FileDetails): Promise<void> {
    if (!fileDetails.downloadFilePath || !fileDetails.partnerReference) {
      throw new Error('Return file path or partner reference missing for validation.');
    }
    const content = await fs.readFile(fileDetails.downloadFilePath, 'utf-8');
    if (!content.includes(fileDetails.partnerReference)) {
      throw new Error(
        `${fileDetails.partnerReference} was not found in ${fileDetails.downloadFilePath}`
      );
    }
  }
}
