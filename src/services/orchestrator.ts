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

export class Orchestrator {
  static runBnsCommHappyPathNF(page: any, scenarioId: string): any {
    throw new Error('Method not implemented.');
  }
  static runBnsCommHappyPathAmendment(page: any, amendmentScenarioId: string, registrationNumber: any, arg3: any): any {
    throw new Error('Method not implemented.');
  }
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
    const localSample = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    fileDetails.sampleFile = localSample;
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
  // Ford Happy Path NF
  // ─────────────────────────────────────────────────────────────────────────────
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
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToHFJobs(db, fileDetails);

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
  
    // Create discharge file using fileSystem
    await fileSystem.createBnsCommDischargeXml(fileDetails);
    
    const db = new DbService();
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
  
    // Create Renewal file using fileSystem
    await fileSystem.createBnsCommDischargeXml(fileDetails);
    
    const db = new DbService();
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
  
    // Create Amendment file using fileSystem
    await fileSystem.createBnsCommDischargeXml(fileDetails);
    
    const db = new DbService();
    await db.setProcessAndFileStatusToNotStarted(fileDetails);
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToHFJobs(db, fileDetails);
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
    const batchFound = fileDetails.batchNumber
      ? normalizedContent.includes(normalize(fileDetails.batchNumber))
      : true;
    if (!referenceFound || !batchFound) {
      throw new Error(
        `${fileDetails.partnerReference} or batch ${fileDetails.batchNumber} ` +
        `not present in Return File ${fileDetails.returnFileName}`
      );
    }
    console.log(`PartnerReference ${fileDetails.partnerReference} found in Return File ${fileDetails.returnFileName}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GBC Tilde File Methods (formerly from FeatureGbcService)
  // ─────────────────────────────────────────────────────────────────────────────

  async createNfFileTilde(fileDetails: FileDetails): Promise<void> {
    await fileSystem.createNfFileTilde(fileDetails);
    const db = new DbService();
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
