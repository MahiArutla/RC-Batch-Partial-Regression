import { Page, Locator, FrameLocator } from '@playwright/test';

const HANGFIRE_IFRAME = "//iframe[contains(@src,'hangfiredashboard')]";

export class HangfireJobsPage {
  private readonly hangfireDashboard: Locator;
  private readonly hfJobs: Locator;
  private readonly hfJobOverview: Locator;
  private readonly hfFileReprocess: Locator;
  private readonly hfDbIframe: Locator;
  private readonly hfDashboardTab: Locator;
  private readonly hfDbRecurringJobsTab: Locator;
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
  }

  async goToHFJobs(db: any, fileDetails: any): Promise<void> {
    await this.hangfireDashboard.click();
    await this.hfJobs.click();
    // Switch to frame is handled by frameLocator
    await this.hfDashboardTab.click();
    await this.hfDbRecurringJobsTab.click();
    await this.triggerHFJob('ClientFileScheduler');
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
    await this.triggerHFJob('SendToCGe');
    console.log('Triggered SendToCGe Hangfire job');
    await db.validateProcessStatusIdAfterJobInDB(fileDetails, 'SendToCGe', 350);
    console.log('Process status validated in DB for SendToCGe job ');
    await this.triggerHFJob('Handshake');
    console.log('Triggered Handshake Hangfire job');
    await db.validateHandshakeJobStatus(fileDetails);
    console.log('Handshake job status validated in DB');
  }
  async goToProcessHFJobs(db: any, fileDetails: any): Promise<void> {
    await this.hangfireDashboard.click();
    await this.hfJobs.click();
    // Switch to frame is handled by frameLocator
    await this.hfDashboardTab.click();
    await this.hfDbRecurringJobsTab.click();
    await this.triggerHFJob('ClientFileScheduler');
    console.log('Triggered ClientFileScheduler Hangfire job');
     
    await db.validateClientFileSchedulerJobFileStatusInDB(fileDetails);
    console.log('File got picked up from SFTP & File status and process status validated in DB for ClientFileScheduler job ');
   
    await this.triggerHFJob('File Parsing');
    console.log('Triggered File Parsing Hangfire job');
    await this.triggerHFJob('LVS');
    console.log('Triggered LVS Hangfire job');
    await this.triggerHFJob('Create JSON');
    console.log('Triggered Create JSON Hangfire job');
    await this.triggerHFJob('SendToCGe');
    console.log('Triggered SendToCGe Hangfire job');
   await this.triggerHFJob('Handshake');
    console.log('Triggered Handshake Hangfire job');
     }
async goToHFJobsForReturnFile(db: any, fileDetails: any): Promise<void> {
    await this.hangfireDashboard.click();
    await this.hfJobs.click();
    // Switch to frame is handled by frameLocator
    await this.hfDashboardTab.click();
    await this.hfDbRecurringJobsTab.click();
    await this.triggerHFJob('FileClientProcessReadyApi');
    console.log('Triggered FileClientProcessReadyApi Hangfire job');
    await this.triggerHFJob('ClientFileScheduler');
    console.log('Triggered ClientFileScheduler Hangfire job');
   
  }
  async triggerHFJob(job: string): Promise<void> {
    try {
      await this.page.waitForTimeout(2000);
      const tableText = await this.recurringJobTable.textContent();
      if (!tableText?.includes(job)) {
        await this.nextBtn.click();
      }
      await this.page.waitForTimeout(1000);
      const jobElement = this.hangfireFrame.locator(`//div[@class='js-jobs-list']/div[2]/table/tbody/tr/td/input[@value='${job}']`);
      await jobElement.click();
      await this.page.waitForTimeout(1000);
      await this.checkScheduledProcessingHFJobCount();
      await this.page.waitForTimeout(1000);
      await this.hangfireFrame.locator("//a[contains(text(),'Recurring Jobs')]").click();
      await this.page.waitForTimeout(1000);
    } catch (error) {
      console.log(error);
    }
  }

  async checkScheduledProcessingHFJobCount(): Promise<void> {
    await this.page.waitForTimeout(2000);
    await this.triggerNow.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(1000);
    await this.triggerNow.click();
    await this.page.waitForTimeout(1000);
    await this.hangFireJobs.click();
    await this.page.waitForTimeout(1000);
    for (let i = 0; i < 3; i++) {
      await this.scheduledJobsCountMethod();
      await this.processingJobsCount();
    }
  }
async waitForHangfireReady(): Promise<void> {
  // Ensure we are on the Hangfire view before waiting for the iframe
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

  async scheduledJobsCountMethod(): Promise<void> {
    try {
      await this.page.waitForTimeout(2000);
      await this.scheduledJobs.click();
     await this.page.waitForTimeout(2000);
      const schCountText = await this.scheduledJobsCount.textContent();
      const schCountVal = parseInt(schCountText || '0', 10);
      if (schCountVal > 0) {
        await this.page.waitForTimeout(2000);
        await this.enqueuedJobsSelectAllCheckbox.click();
        await this.page.waitForTimeout(2000);
        await this.enqueuedJobsTriggerButton.click();
        await this.page.waitForTimeout(2000);
      }
    } catch (error) {
      console.log(error);
    }
  }


  async processingJobsCount(): Promise<void> {
    let countText = await this.processingJobCount.textContent();
    let countNum = parseInt(countText || '0', 10);
    while (countNum > 0) {
      await this.page.waitForTimeout(2000);
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
}