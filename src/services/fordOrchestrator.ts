import { Page } from '@playwright/test';
import path from 'path';
import { FileDetails } from '../models/fileDetails';
import { FordNfService } from './fordNfService';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { DownloadPage } from '../pages/download.page';
import { ExcelHelper } from '../utils/excelHelper';
import { loadScenarioData } from '../data/testData';

export class FordOrchestrator {
  async runFordHappyPathNF(page: Page, scenarioId: string): Promise<FileDetails> {
    // Load values from TestData.xlsx via helper
    const fileDetails = loadScenarioData(scenarioId);
    // Prefer Excel values; set sensible defaults if missing
    fileDetails.client = fileDetails.client || 'FORD';
    fileDetails.fileInfo = fileDetails.fileInfo || 'ford';
    fileDetails.scenarioId = scenarioId;
    // Use the provided sample in repo instead of legacy path
    fileDetails.sampleFile = path.resolve(process.cwd(), 'src', 'data', 'FORD', 'Ford_NF.fc');

    if (!fileDetails.inputFileDescription) {
      throw new Error(
        `InputFileDescription is missing in TestData.xlsx for scenario ${scenarioId}. ` +
        `Please add a description so DB lookup can resolve UniqueId.`
      );
    }

    const fordService = new FordNfService();
    await fordService.createNfFileFc(fileDetails);

    const db = fordService.getDbService();
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
}
