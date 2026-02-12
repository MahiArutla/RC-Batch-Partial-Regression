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
  async runGbcAllProvinceHappyPath(
    page: Page,
    scenarioId: string,
    client: string,
    sampleFileName: string,
    testName: string = 'GBC_AllProvinceHappyPath'
  ): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    const localSample = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    fileDetails.sampleFile = localSample;
    fileDetails.client = client;
    fileDetails.fileInfo = client;
    fileDetails.scenarioId = scenarioId;

    await fileSystem.createGbcNfXif(fileDetails);

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
    const manualResponse = await manualProcessingService.processManualTransaction(fileDetails, 'YT', 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);
    ExcelHelper.verifyImportedSuccessfullyGreaterThanZero(
      path.join(process.cwd(), 'artifacts', testName, fileDetails.summaryReportFileName!)
    );
    console.log('Summary report file downloaded and verified:', fileDetails.summaryReportFileName);

    if (!fileDetails.returnFileDescription) {
      throw new Error(
        `ReturnFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the Return UniqueId.`
      );
    }
    await db.setProcessAndFileStatusToNotStartedReturn(fileDetails);
    await hangfirePage.waitForHangfireReady();
    await hangfirePage.disableStickyHeader();
    await hangfirePage.goToHFJobsForReturnFile(db, fileDetails);

    fileDetails.downloadFileType = 'ReturnFile';
    await downloadPage.setDownloadCriteria(fileDetails);
    await downloadPage.downloadAndVerify(fileDetails, downloadDir, testName);

    await this.validatePartnerReferenceInReturnFile(fileDetails, testName);

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
  

  // ─────────────────────────────────────────────────────────────────────────────
  // BNS Commercial Happy Path NF
  // ─────────────────────────────────────────────────────────────────────────────
 
  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────
  private async validatePartnerReferenceInReturnFile(fileDetails: FileDetails, testName: string): Promise<void> {
    const fs = await import('fs');
    if (!fileDetails.returnFileName || !fileDetails.partnerReference) {
      throw new Error('Return file name or partner reference is not set in fileDetails.');
    }
    const returnFilePath = path.join(process.cwd(), 'artifacts', testName, fileDetails.returnFileName);
    let found = false;
    for (const line of fs.readFileSync(returnFilePath, 'utf-8').split(/\r?\n/)) {
      if (line.includes(fileDetails.partnerReference)) {
        found = true;
        break;
      }
    }
    if (!found) {
      throw new Error(`${fileDetails.partnerReference} not present in Return File ${fileDetails.returnFileName}`);
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
