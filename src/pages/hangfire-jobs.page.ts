import { Page, Locator, FrameLocator } from '@playwright/test';
import { expect } from '../fixtures/test';

const HANGFIRE_IFRAME = "//iframe[contains(@src,'hangfiredashboard')]";

export class HangfireJobsPage {
  public readonly hangfireDashboard: Locator;
  public readonly hfJobs: Locator;
  public readonly hfJobOverview: Locator;
  public readonly hfFileReprocess: Locator;
  public readonly hfDbIframe: Locator;
  public readonly hfDashboardTab: Locator;
  public readonly hfDbRecurringJobsTab: Locator;
  private readonly recurringJobTable: Locator;
  private readonly nextBtn: Locator;
  private readonly triggerNow: Locator;
  private readonly hangFireJobs: Locator;
  private readonly scheduledJobs: Locator;
  private readonly failedJobs: Locator;
  private readonly succeededJobs: Locator;
  private readonly processingJobCount: Locator;
  private readonly scheduledJobsCount: Locator;
  private readonly enqueuedJobsSelectAllCheckbox: Locator;
  private readonly enqueuedJobsTriggerButton: Locator;
  private readonly hangfireFrame: FrameLocator;
  private readonly recurringJobsLink: Locator;

  constructor(private readonly page: Page) {
    this.hangfireDashboard = page.locator("//ul/li/a/span[text()='HangFire Dashboard']");
    this.hfJobs = page.locator("//ul/li/a/span[text()='Hangfire Jobs']");
    this.hfJobOverview = page.locator("//ul/li/a/span[text()='Job Overview']");
    this.hfFileReprocess = page.locator("//ul/li/a/span[text()='File Reprocess']");
    this.hfDbIframe = page.locator("//iframe[contains(@src,'http://qa.admin.cd.cge.dhltd.corp/hangfiredashboard')]");
    this.hangfireFrame = page.frameLocator(HANGFIRE_IFRAME);
    this.hfDashboardTab = this.hangfireFrame.locator("//a[text()='Hangfire Dashboard']");
    this.hfDbRecurringJobsTab = this.hangfireFrame.locator("//a[contains(text(),'Recurring Jobs')]");
    this.recurringJobTable = this.hangfireFrame.locator("//div[@class='js-jobs-list']/div[2]/table/tbody");
    this.nextBtn = this.hangfireFrame.locator("//a[contains(text(),'Next')]");
    this.triggerNow = this.hangfireFrame.locator("//button[@data-url='/hangfiredashboard/hangfire/recurring/trigger']");
    this.hangFireJobs = this.hangfireFrame.locator("//a[@href='/hangfiredashboard/hangfire/jobs/enqueued']");
    this.scheduledJobs = this.hangfireFrame.locator("//a[@href='/hangfiredashboard/hangfire/jobs/scheduled']");
    this.failedJobs = this.hangfireFrame.locator("//a[@href='/hangfiredashboard/hangfire/jobs/failed']");
    this.succeededJobs = this.hangfireFrame.locator("//a[@href='/hangfiredashboard/hangfire/jobs/succeeded']");
    this.processingJobCount = this.hangfireFrame.locator("//a[@href='/hangfiredashboard/hangfire/jobs/processing']/span/span");
    this.scheduledJobsCount = this.hangfireFrame.locator("//a[@href='/hangfiredashboard/hangfire/jobs/scheduled']/span/span");
    this.enqueuedJobsSelectAllCheckbox = this.hangfireFrame.locator("//input[@class='js-jobs-list-select-all']");
    this.enqueuedJobsTriggerButton = this.hangfireFrame.locator("//button[@data-url='/hangfiredashboard/hangfire/jobs/scheduled/enqueue']");
    this.recurringJobsLink = this.hangfireFrame.locator("//a[contains(text(),'Recurring Jobs')]");
  }

  async goToHFJobs(db: any, fileDetails: any): Promise<void> {
    await this.hangfireDashboard.click();
    await this.hfJobs.click();
     await this.hfDashboardTab.click();
    await this.hfDbRecurringJobsTab.click();
    await this.triggerHFJobWithEnqueue('ClientFileScheduler');
    console.log('Triggered ClientFileScheduler Hangfire job');
    await db.validateClientFileSchedulerJobFileStatusInDB(fileDetails);
    console.log('File got picked up from SFTP & File status and process status validated in DB for ClientFileScheduler job ');
    await this.triggerHFJob('File Parsing');
    console.log('Triggered File Parsing Hangfire job');
    await db.validateProcessStatusIdAfterJobInDB(fileDetails, 'File Parsing', 150);
    console.log('Process status validated in DB for File Parsing job ');
    await this.triggerHFJob('LVS');
    console.log('Triggered LVS Hangfire job');
    await db.validateProcessStatusIdAfterJobInDB(fileDetails, 'LVS', 260);
    console.log('Process status validated in DB for LVS job ');
    await this.triggerHFJob('Create JSON');
    console.log('Triggered Create JSON Hangfire job');
    await db.validateProcessStatusIdAfterJobInDB(fileDetails, 'Create JSON', 280);
    console.log('Process status validated in DB for Create JSON job ');
    await this.triggerHFJobWithEnqueue('SendToCGe');
    console.log('Triggered SendToCGe Hangfire job');
    await db.validateProcessStatusIdAfterJobInDB(fileDetails, 'SendToCGe', 350);
    console.log('Process status validated in DB for SendToCGe job ');
    await this.triggerHFJob('Handshake');
    console.log('Triggered Handshake Hangfire job');
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB');
  }
  async goToProcessHFJobs(db: any, fileDetails: any, fastMode: boolean = false): Promise<void> {
    await this.hangfireDashboard.click();
    await this.hfJobs.click();
    await this.hfDashboardTab.click();
    await this.hfDbRecurringJobsTab.click();
    await this.triggerHFJobWithEnqueue('ClientFileScheduler', fastMode);
    console.log('Triggered ClientFileScheduler Hangfire job');
    await db.validateClientFileSchedulerJobFileStatusInDB(fileDetails);
    console.log('File got picked up from SFTP & File status and process status validated in DB for ClientFileScheduler job ');
    await this.triggerHFJob('File Parsing');
    console.log('Triggered File Parsing Hangfire job');
    await this.triggerHFJob('LVS');
    console.log('Triggered LVS Hangfire job');
    await this.triggerHFJob('Create JSON');
    console.log('Triggered Create JSON Hangfire job');
    await this.triggerHFJobWithEnqueue('SendToCGe', fastMode);
    console.log('Triggered SendToCGe Hangfire job');
   await this.triggerHFJob('Handshake');
    console.log('Triggered Handshake Hangfire job');
     }
  async goToHFJobsForReturnFile(db: any, fileDetails: any): Promise<void> {
    await this.hangfireDashboard.click();
    await this.hfJobs.click();
    await this.hfDashboardTab.click();
    await this.hfDbRecurringJobsTab.click();
    await this.triggerHFJobWithEnqueue('FileClientProcessReadyApi');
    console.log('Triggered FileClientProcessReadyApi Hangfire job');
    await this.triggerHFJobWithEnqueue('ClientFileScheduler');
    console.log('Triggered ClientFileScheduler Hangfire job');
  }
  async triggerHFJob(job: string): Promise<void> {
    try {
      const tableText = await this.recurringJobTable.textContent();
      if (!tableText?.includes(job)) {
        await this.nextBtn.click();
      }
      const jobElement = this.hangfireFrame.locator(`//div[@class='js-jobs-list']/div[2]/table/tbody/tr/td/input[@value='${job}']`);
      await expect(jobElement).toBeEnabled();
      await jobElement.click();
      await this.page.waitForTimeout(500);
      const TriggerNowBttn = this.hangfireFrame.locator(`//button[normalize-space()='Trigger now']`);

      // Wait longer for button to become enabled (up to 120 seconds)
      // The button might be disabled from a previous job trigger
      await expect(TriggerNowBttn).toBeEnabled({ timeout: 120000 });
      await TriggerNowBttn.click();

      // Wait longer after clicking to allow job to complete before triggering next one
      await this.page.waitForTimeout(3000);
    } catch (error) {
      console.log(error);
    }
  }
  async triggerHFJobWithEnqueue(job: string, fastMode: boolean = false): Promise<void> {
    try {
      const tableText = await this.recurringJobTable.textContent();
      if (!tableText?.includes(job)) {
        await this.nextBtn.click();
      }
      const jobElement = this.hangfireFrame.locator(`//div[@class='js-jobs-list']/div[2]/table/tbody/tr/td/input[@value='${job}']`);
      await jobElement.click();
      await this.checkScheduledProcessingHFJobCount(fastMode);
      await this.recurringJobsLink.click();

      // Wait longer after triggering to allow job to complete
      await this.page.waitForTimeout(2000);
    } catch (error) {
      console.log(error);
    }
  }
  async checkScheduledProcessingHFJobCount(fastMode: boolean = false): Promise<void> {
    await this.triggerNow.click();
    await this.page.waitForTimeout(fastMode ? 250 : 1000);
    await this.hangFireJobs.click();
    await this.page.waitForTimeout(fastMode ? 250 : 1000);
    const rounds = fastMode ? 1 : 3;
    for (let i = 0; i < rounds; i++) {
      await this.scheduledJobsCountMethod(fastMode);
      await this.processingJobsCount();
    }
  }
  async waitForHangfireReady(): Promise<void> {
    try { await this.hangfireDashboard.click({ timeout: 5000 }); } catch {}
    try { await this.hfJobs.click({ timeout: 5000 }); } catch {}

    const iframe = this.page.locator(HANGFIRE_IFRAME);
    await iframe.waitFor({ state: 'attached', timeout: 30000 });

    await this.hangfireFrame
      .getByRole('link', { name: /Hangfire Dashboard/i })
      .waitFor({ state: 'visible', timeout: 20000 });
  }
  async disableStickyHeader(): Promise<void> {
    await this.page.addStyleTag({
      content: `
        app-header, mat-toolbar {
          display: none !important;
        }
      `
    });
  }

  async scheduledJobsCountMethod(fastMode: boolean = false): Promise<void> {
    try {
      await expect(this.scheduledJobs).toBeEnabled();
      await this.scheduledJobs.click();
      const schCountText = await this.scheduledJobsCount.textContent();
      const schCountVal = parseInt(schCountText || '0', 10);
      if (schCountVal > 0) {
        await expect(this.enqueuedJobsSelectAllCheckbox).toBeEnabled();
        await this.page.waitForTimeout(fastMode ? 250 : 2000);
        await this.enqueuedJobsSelectAllCheckbox.click();
        await this.enqueuedJobsTriggerButton.click();
        await this.page.waitForTimeout(fastMode ? 250 : 2000);
      }
    } catch (error) {
      console.log(error);
    }
  }


  async processingJobsCount(): Promise<void> {
    let countText = await this.processingJobCount.textContent();
    let countNum = parseInt(countText || '0', 10);
    while (countNum > 0) {
      countText = await this.processingJobCount.textContent();
      countNum = parseInt(countText || '0', 10);
    }
  }

  async openRecurringJobs(): Promise<void> {
    await this.hfDashboardTab.click();
    await this.hfDbRecurringJobsTab.click();
  }

  async triggerRecurringJob(jobName: string): Promise<void> {
    const jobCheckbox = this.hangfireFrame.locator(
      `//div[@class='js-jobs-list']//input[@value='${jobName}']`
    );
    await jobCheckbox.scrollIntoViewIfNeeded();
    await jobCheckbox.check({ force: true });
    await this.triggerNow.click();
    await this.page.waitForTimeout(1000);
  }

  async navigateToEnqueuedJobs(): Promise<void> {
    await this.hangFireJobs.click();
    console.log('Navigated to Enqueued Jobs');
  }

  async navigateToFailedJobs(): Promise<void> {
    await this.failedJobs.click();
    console.log('Navigated to Failed Jobs');
  }

  async validateDuplicateBatchNumberError(batchNumber: string): Promise<{ count: number; message: string }> {
    // Wait a bit for the failed job to appear
    await this.page.waitForTimeout(2000);

    // Locator for error message containing "Error: BatchNumber:" and "already exists"
    const errorLocator = this.hangfireFrame.locator(
      `//*[contains(text(), 'Error: BatchNumber:') and contains(text(), 'already exists')]`
    );

    const count = await errorLocator.count();
    let message = '';

    if (count > 0) {
      message = await errorLocator.first().textContent() || '';
      console.log(`Found ${count} duplicate batch number error(s)`);
      console.log(`Error message: ${message}`);
    } else {
      console.log('No duplicate batch number errors found');
    }

    return { count, message };
  }

  async validateInvalidFileTypeError(fileName: string): Promise<{ count: number; message: string }> {
    // Wait a bit for the failed job to appear
    await this.page.waitForTimeout(2000);

    // Locator for error message containing file type, extension, or unsupported format errors
    const errorLocator = this.hangfireFrame.locator(
      `//*[contains(text(), 'invalid') or contains(text(), 'extension') or contains(text(), 'unsupported') or contains(text(), 'file type') or contains(text(), '${fileName}')]`
    );

    const count = await errorLocator.count();
    let message = '';

    if (count > 0) {
      message = await errorLocator.first().textContent() || '';
      console.log(`Found ${count} invalid file type error(s)`);
      console.log(`Error message: ${message}`);
    } else {
      // If no specific error found, check if there are any failed jobs at all
      const anyFailedJob = this.hangfireFrame.locator('//div[@class="js-jobs-list"]//tr[contains(@class, "failed") or .//span[contains(@class, "label-danger")]]');
      const failedCount = await anyFailedJob.count();
      if (failedCount > 0) {
        message = await anyFailedJob.first().textContent() || 'File processing failed';
        console.log(`Found ${failedCount} failed job(s) - file type validation may have failed`);
      } else {
        console.log('No invalid file type errors or failed jobs found');
      }
    }

    return { count, message };
  }
}
