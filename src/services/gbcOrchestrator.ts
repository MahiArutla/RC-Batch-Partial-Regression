import { DownloadPage } from '../pages/download.page';
import { Page } from '@playwright/test';
import path from 'path';
import { loadScenarioData } from '../data/testData';
import { FileDetails } from '../models/fileDetails';
import { GbcNfService } from './gbcNfService';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { processManualTransaction } from './processManualTransaction';
import { ExcelHelper } from '../utils/excelHelper';

export class GbcOrchestrator {
  async runGbcAllProvinceHappyPath(page: Page, scenarioId: string, client: string, sampleFileName: string, testName: string = 'GBC_AllProvinceHappyPath'): Promise<FileDetails> {
    const fileDetails = loadScenarioData(scenarioId);
    const localSample = path.resolve(process.cwd(), 'src', 'data', client, sampleFileName);
    fileDetails.sampleFile = localSample;
    fileDetails.client = client;
    fileDetails.fileInfo = client;
    fileDetails.scenarioId = scenarioId;

    const gbcNfService = new GbcNfService();

    // Create NF file and set OrderId in fileDetails as a side effect
    await gbcNfService.createNfFileXif(fileDetails);

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add it so DB can resolve the NF UniqueId.`
      );
    }

    const db = gbcNfService.getDbService();
    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.goToHFJobs(db, fileDetails);

    // Call manual processing API for YT jurisdiction
    const manualResponse = await processManualTransaction(fileDetails, 'YT', 'superuser');
    console.log('Manual Processing API response:', manualResponse);

    // Download and verify summary report after manual processing
    const downloadPage = new DownloadPage(page);
    await downloadPage.setDownloadCriteria(fileDetails);
    // You may want to set the download directory dynamically or use a config value
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
    // Validate that PartnerReference is present in the return file
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
      throw new Error(`${fileDetails.partnerReference} not present in Return File ${fileDetails.returnFileName  }`);
    }
    console.log(`PartnerReference ${fileDetails.partnerReference} found in Return File ${fileDetails.returnFileName}`);
    console.log(`File processed with Batchnumber ${fileDetails.batchNumber}, filename ${fileDetails.inputFileName}  PartnerReference ${fileDetails.partnerReference} and OrderId ${fileDetails.orderId}`);

    return fileDetails;
  }
}