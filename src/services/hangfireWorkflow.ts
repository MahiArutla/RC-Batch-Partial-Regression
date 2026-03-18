import { Page } from '@playwright/test';
import { loadEnv } from '../config/env';
import { FileDetails } from '../models/fileDetails';
import { DbService } from '../utils/dbUtility';
import { LoginPage } from '../pages/login.page';
import { HomePage } from '../pages/home.page';
import { HangfireJobsPage } from '../pages/hangfire-jobs.page';
import { DownloadFilePage } from '../pages/download-file.page';

const env = loadEnv();

interface HangfireJobExpectation {
  name: string;
  expectedStatusId: number;
}

export class HangfireWorkflow {
  constructor(private readonly dbService: DbService) {}

  async runAllProvinceHappyPath(page: Page, fileDetails: FileDetails): Promise<void> {
    const homePage = new HomePage(page);
    await homePage.openHangfireJobs();

    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.openRecurringJobs();
    await hangfirePage.triggerRecurringJob('ClientFileScheduler');
    await this.dbService.validateClientFileSchedulerJobStatus(fileDetails);

    const jobs: HangfireJobExpectation[] = [
      { name: 'File Parsing', expectedStatusId: 150 },
      { name: 'LVS', expectedStatusId: 260 },
      { name: 'Create JSON', expectedStatusId: 280 },
      { name: 'SendToCGe', expectedStatusId: 350 },
      { name: 'ProcessScheduledEmailReports', expectedStatusId: 350 }
    ];

    for (const job of jobs) {
      await hangfirePage.triggerRecurringJob(job.name);
      await this.dbService.validateProcessStatusAfterJob(fileDetails, job.expectedStatusId, job.name);
    }

    await hangfirePage.triggerRecurringJob('Handshake');
    await this.dbService.validateHandshakeJobStatus(fileDetails);

    await homePage.openDownloadFile();
    const downloadPage = new DownloadFilePage(page);
    await downloadPage.downloadClientFile(fileDetails);
  }

  async runReturnFileFlow(page: Page, fileDetails: FileDetails): Promise<void> {
    await this.login(page);
    const homePage = new HomePage(page);
    await homePage.openHangfireJobs();

    const hangfirePage = new HangfireJobsPage(page);
    await hangfirePage.openRecurringJobs();
    await hangfirePage.triggerRecurringJob('FileClientProcessReadyApi');
    await hangfirePage.triggerRecurringJob('ClientFileScheduler');

    await homePage.openDownloadFile();
    const downloadPage = new DownloadFilePage(page);
    await downloadPage.downloadReturnFile(fileDetails);
  }

  private async login(page: Page): Promise<void> {
    const loginPage = new LoginPage(page);
    await loginPage.goto(env.webAppUrl);
    await loginPage.login(env.adminUser, env.adminPassword);
  }
}
