import { Page, Locator, expect } from '@playwright/test';
import { FileDetails } from '../models/fileDetails';
import { selectMatValue } from '../utils/uihelper';

export class DownloadPage {
  readonly page: Page;
  readonly corporationDropDown: Locator;
  readonly corporationDropDownList: Locator;
  readonly fileTypeDropDown: Locator;
  readonly fileTypeDropDownList: Locator;
  readonly fromDate: Locator;
  readonly toDate: Locator;
  readonly searchRef: Locator;
  readonly includeDltdFileCheckBox: Locator;
  readonly goBtn: Locator;
  readonly searchInTable: Locator;
  readonly fileTableSearchResult: Locator;
  readonly fileTableResultCount: Locator;
  readonly downloadFileIcon: Locator;
  readonly fileTableSummaryReportFileName: string;
  readonly downloadFileNav: Locator;

  constructor(page: Page) {
    this.page = page;
    this.corporationDropDown = page.locator("//div/mat-select[@formcontrolname='corportionid']/div/div[2]");
    this.corporationDropDownList = page.locator("//div[@id='mat-select-0-panel']/mat-option/span");
    this.fileTypeDropDown = page.locator("//div/mat-select[@formcontrolname='filetype']/div/div[2]");
    this.fileTypeDropDownList = page.locator("//div[@id='mat-select-1-panel']/mat-option/span");
    this.fromDate = page.locator("//input[@formcontrolname='fromDate']");
    this.toDate = page.locator("//input[@formcontrolname='toDate']");
    this.searchRef = page.locator("//input[@formcontrolname='searchRef']");
    this.includeDltdFileCheckBox = page.locator("//mat-checkbox[@id='mat-checkbox-1']");
    this.goBtn = page.locator("//button[@type='submit']");
    this.searchInTable = page.locator("//input[@placeholder='Search']");
    this.fileTableSearchResult = page.locator("//ngx-datatable[contains(@class,'ngx-datatable teranet_grid')]");
    this.fileTableResultCount = page.locator("//ngx-datatable//descendant::div[contains(@class,'page-count')]");
    this.downloadFileIcon = page.locator("//ngx-datatable/descendant::datatable-body/descendant::datatable-body-row/div[2]/datatable-body-cell/descendant::fa-icon[@icon='download']");
    this.fileTableSummaryReportFileName = "//datatable-body-cell[3]/div";
    this.downloadFileNav = page.locator("//ul/li/a/span[text()='Download File']");
  }

  private async getTableResultCount(): Promise<number> {
    const text = (await this.fileTableResultCount.textContent())?.trim();
    if (!text) return 0;

    const num = parseInt(text.split(' total')[0].trim(), 10);
    return Number.isNaN(num) ? 0 : num;
  }

  private async searchTableWithCandidates(candidates: string[], timeoutPerCandidate: number = 10000): Promise<boolean> {
    for (const candidate of candidates) {
      const trimmedCandidate = candidate.trim();
      if (!trimmedCandidate) {
        continue;
      }

      await this.searchInTable.fill(trimmedCandidate);
      try {
        await expect
          .poll(async () => this.getTableResultCount(), { timeout: timeoutPerCandidate })
          .toBeGreaterThan(0);
        return true;
      } catch {
        // Try the next candidate.
      }
    }

    return false;
  }

  async setDownloadCriteria(fileDetails: FileDetails) {
    await this.downloadFileNav.waitFor({ state: 'visible', timeout: 20000 });
    await this.downloadFileNav.click();
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(1500);
    await selectMatValue(this.page, 'corportionid', fileDetails.client);
    await selectMatValue(this.page, 'filetype', fileDetails.downloadFileType);

    if (fileDetails.fromDate) {
      await this.fromDate.fill(fileDetails.fromDate);
    }
    if (fileDetails.toDate) {
      await this.toDate.fill(fileDetails.toDate);
    }

    if (fileDetails.includeDeletedFile) {
      await this.includeDltdFileCheckBox.click();
    }

    await this.goBtn.click();
  }

  async downloadAndVerify(fileDetails: FileDetails, downloadDir: string, testName: string) {
    const isSummaryFile = fileDetails.downloadFileType !== 'ReturnFile';
    const candidates = isSummaryFile
      ? [
          fileDetails.inputFileName ?? '',
          fileDetails.batchNumber ?? '',
          fileDetails.partnerReference ?? '',
          'SummaryReport_',
        ]
      : [
          fileDetails.batchNumber ?? '',
          fileDetails.partnerReference ?? '',
          fileDetails.inputFileName ?? '',
        ];

    const matchedCriteria = await this.searchTableWithCandidates(candidates);
    if (!matchedCriteria) {
      await this.searchInTable.fill('');
      await this.goBtn.click();
      await expect
        .poll(async () => this.getTableResultCount(), {
          timeout: 30000,
          message:
            'Waiting for search results to load. Ensure that the search criteria are correct and that the file exists in the table.',
        })
        .toBeGreaterThan(0);
    }

    const summaryFileRegex = /SummaryReport_/;
    const candidateRow = this.page
      .locator('datatable-body-row')
      .filter({ hasText: summaryFileRegex })
      .first();
    const row = (await candidateRow.count()) > 0
      ? candidateRow
      : this.page.locator('datatable-body-row').first();

    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.scrollIntoViewIfNeeded();

    const fileNameLocator = row
      .locator('datatable-body-cell')
      .nth(2)
      .locator('.datatable-body-cell-label');
    await expect(fileNameLocator).toBeVisible({ timeout: 5000 });

    const rawName = (await fileNameLocator.innerText()).trim();
    if (!rawName) {
      throw new Error('Summary report row found in table but unable to read the filename text.');
    }

    fileDetails.summaryReportFileName = rawName;

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      row.locator('fa-icon#edit[icon="download"], fa-icon[icon="download"]').click(),
    ]);

    const path = await import('path');
    const artifactsDir = path.join(process.cwd(), 'artifacts', testName);
    const fs = await import('fs');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    if (!fileDetails.summaryReportFileName) {
      throw new Error('summaryReportFileName is undefined. Could not find the file name in the table row.');
    }
    const targetPath = path.join(artifactsDir, fileDetails.summaryReportFileName);
    await download.saveAs(targetPath);

    if (fileDetails.downloadFileType === 'ReturnFile') {
      fileDetails.returnFileName = fileDetails.summaryReportFileName;
    }
  }
  async downloadAndVerifyReturnFile(
    fileDetails: FileDetails,
    downloadDir: string,
    testName: string
  ) {
    const candidates = [
      fileDetails.batchNumber,
      fileDetails.partnerReference,
      fileDetails.inputFileName,
    ].filter((v): v is string => Boolean(v && v.trim()));

    let matchedCriteria = false;
    for (const candidate of candidates) {
     // await this.searchInTable.fill(candidate);
      try {
        await expect
          .poll(
            async () => this.getTableResultCount(),
            { timeout: 10000 }
          )
          .toBeGreaterThan(0);
        matchedCriteria = true;
        break;
      } catch {
        // try next candidate
      }
    }
    if (!matchedCriteria) {
      await this.searchInTable.fill('');
    }

    await expect
      .poll(
        async () => this.getTableResultCount(),
        {
          timeout: 30000,
          message:
            'Waiting for search results to load. Ensure search criteria are correct and the file exists in the table.',
        }
      )
      .toBeGreaterThan(0);

    const row = this.page.locator('datatable-body-row').first();
    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.scrollIntoViewIfNeeded();

    const fileNameLocator = row
      .locator('datatable-body-cell')
      .nth(2)
      .locator('.datatable-body-cell-label');

    await expect(fileNameLocator).toBeVisible({ timeout: 5000 });

    const rawName = (await fileNameLocator.innerText()).trim();

    fileDetails.summaryReportFileName = rawName;

    const downloadIcon = row.locator('fa-icon[icon="download"]').first();
    await expect(downloadIcon).toBeVisible({ timeout: 5000 });

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      downloadIcon.click(),
    ]);

    const path = await import('path');
    const fs = await import('fs');

    const artifactsDir = path.join(
      process.cwd(),
      'artifacts',
      testName
    );
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const finalName = fileDetails.summaryReportFileName || download.suggestedFilename();
    if (!finalName) {
      throw new Error('Could not determine a filename for the downloaded artifact.');
    }

    const targetPath = path.join(artifactsDir, finalName);
    await download.saveAs(targetPath);

    if (fileDetails.downloadFileType === 'ReturnFile') {
      fileDetails.returnFileName = finalName;
    }

    return targetPath;
  }

  async downloadAndVerifySLAReport(fileDetails: FileDetails, downloadDir: string, testName: string) {
    const candidates = [
      fileDetails.inputFileName ?? '',
      fileDetails.batchNumber ?? '',
      fileDetails.partnerReference ?? '',
      'ClientSLAReport',
    ];

    const matchedCriteria = await this.searchTableWithCandidates(candidates);
    if (!matchedCriteria) {
      await this.searchInTable.fill('');
      await this.goBtn.click();
      await expect
        .poll(async () => this.getTableResultCount(), {
          timeout: 30000,
          message:
            'Waiting for SLA Report search results. Ensure that the search criteria are correct and that the file exists in the table.',
        })
        .toBeGreaterThan(0);
    }

    const slaReportRegex = /ClientSLAReport/i;
    const candidateRow = this.page
      .locator('datatable-body-row')
      .filter({ hasText: slaReportRegex })
      .first();
    const row = (await candidateRow.count()) > 0
      ? candidateRow
      : this.page.locator('datatable-body-row').first();

    await row.waitFor({ state: 'visible', timeout: 10000 });
    await row.scrollIntoViewIfNeeded();

    const fileNameLocator = row
      .locator('datatable-body-cell')
      .nth(2)
      .locator('.datatable-body-cell-label');
    await expect(fileNameLocator).toBeVisible({ timeout: 5000 });

    const rawName = (await fileNameLocator.innerText()).trim();
    if (!rawName) {
      throw new Error('SLA Report row found in table but unable to read the filename text.');
    }

    fileDetails.slaReportFileName = rawName;

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      row.locator('fa-icon#edit[icon="download"], fa-icon[icon="download"]').click(),
    ]);

    const path = await import('path');
    const artifactsDir = path.join(process.cwd(), 'artifacts', testName);
    const fs = await import('fs');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }
    if (!fileDetails.slaReportFileName) {
      throw new Error('slaReportFileName is undefined. Could not find the file name in the table row.');
    }
    const targetPath = path.join(artifactsDir, fileDetails.slaReportFileName);
    await download.saveAs(targetPath);
    console.log(`✓ ClientSLAReport downloaded: ${fileDetails.slaReportFileName}`);
  }
}
