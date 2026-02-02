import { Page } from '@playwright/test';
import path from 'path';
import { FileDetails } from '../models/fileDetails';
import { NfService } from './nfService';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { DownloadPage } from '../pages/download.page';
import { ExcelHelper } from '../utils/excelHelper';
import { loadScenarioData } from '../data/testData';
import { processManualTransaction } from './processManualTransaction';

export class Orchestrator {
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

    const nfService = new NfService();
    await nfService.createGbcNfXif(fileDetails);

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    const db = nfService.getDbService();
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToHFJobs(db, fileDetails);

    const manualResponse = await processManualTransaction(fileDetails, 'YT', 'superuser');
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

    const nfService = new NfService();
    await nfService.createFordNfFc(fileDetails);

    const db = nfService.getDbService();
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToFordHFJobs(db, fileDetails);

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

    const service = new NfService();
    await service.createBnsCommNfXml(fileDetails);

    const db = service.getDbService();
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToHFJobs(db, fileDetails);

    const manualResponse = await processManualTransaction(fileDetails, 'BC', 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    const downloadDir = process.env.PW_DOWNLOADS_DIR || path.resolve(process.cwd(), 'downloads');
    const testName = scenarioId;

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
}
