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

  async setDownloadCriteria(fileDetails: FileDetails) {
    await this.downloadFileNav.waitFor({ state: 'visible', timeout: 20000 });
    await this.downloadFileNav.click();
    await this.page.waitForLoadState('networkidle');

    await this.page.waitForTimeout(5000);
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
    const searchValue =
      fileDetails.downloadFileType === 'ReturnFile'
        ? (fileDetails.batchNumber ?? fileDetails.partnerReference ?? fileDetails.inputFileName ?? '')
        : (fileDetails.inputFileName ?? '');
    await this.searchInTable.fill(searchValue);

    await expect.poll(async () => {
    const text = await this.fileTableResultCount.textContent();
    if (!text) return 0;

    const num = parseInt(text.split(' total')[0].trim());
    return isNaN(num) ? 0 : num;
  }, {
    timeout: 30000,
      message: 'Waiting for search results to load. Ensure that the search criteria are correct and that the file exists in the table.',
    }).toBeGreaterThan(0);

    const text = await this.fileTableResultCount.textContent();
    const count = text ? parseInt(text.split(' total')[0].trim()) : 0;

    if (count === 0) {
      throw new Error(
        `No search results found for search value: ${searchValue}. ` +
        `Please verify that the file exists and the search criteria are correct.`
      );
    }

    const filePrefixRegex = /ClientSummaryReport_/;
    const row = this.page
      .locator('datatable-body-row')
      .filter({ hasText: filePrefixRegex })
      .first();

    await row.waitFor({ state: 'visible', timeout: 10000 });

    const fileNameLocator = row.getByText(filePrefixRegex);
    const rawName = (await fileNameLocator.textContent())?.trim();
    if (!rawName) {
      throw new Error('ClientSummaryReport_ filename found in row but unable to read text.');
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
    await expect
      .poll(
        async () => {
          const text = (await this.fileTableResultCount.textContent())?.trim();
          if (!text) return 0;

          const num = parseInt(text.split(' total')[0].trim(), 10);
          return Number.isNaN(num) ? 0 : num;
        },
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
}
