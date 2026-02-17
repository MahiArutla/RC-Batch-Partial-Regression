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

    // Navigate to Download File section first
    await this.downloadFileNav.waitFor({ state: 'visible', timeout: 20000 });
    await this.downloadFileNav.click();
    await this.page.waitForLoadState('networkidle');

  // Wait for 5 seconds before selecting Corporation dropdown
  await this.page.waitForTimeout(5000);
  // Use selectMatValue for Corporation dropdown
  await selectMatValue(this.page, 'corportionid', fileDetails.client);

    // Use selectMatValue for FileType dropdown
    await selectMatValue(this.page, 'filetype', fileDetails.downloadFileType);

    // Set FromDate if present
    if (fileDetails.fromDate) {
      await this.fromDate.fill(fileDetails.fromDate);
    }
    // Set ToDate if present
    if (fileDetails.toDate) {
      await this.toDate.fill(fileDetails.toDate);
    }

    // Click Include Deleted File checkbox if needed
    if (fileDetails.includeDeletedFile) {
      await this.includeDltdFileCheckBox.click();
    }

    // Click Go button
    await this.goBtn.click();
  }

  async downloadAndVerify(fileDetails: FileDetails, downloadDir: string, testName: string) {
  // Search for the most stable identifier available for this file type.
  const searchValue =
    fileDetails.downloadFileType === 'ReturnFile'
      ? (fileDetails.batchNumber ?? fileDetails.partnerReference ?? fileDetails.inputFileName ?? '')
      : (fileDetails.inputFileName ?? '');
  await this.searchInTable.fill(searchValue);

  // ⏳ Wait for grid to refresh & results to appear
  await expect.poll(async () => {
    const text = await this.fileTableResultCount.textContent();
    if (!text) return 0;

    const num = parseInt(text.split(' total')[0].trim());
    return isNaN(num) ? 0 : num;
  }, {
    timeout: 30000,
    message: 'Waiting for search results to load. Ensure that the search criteria are correct and that the file exists in the table.',
  }).toBeGreaterThan(0);

  // Get the final count value after polling succeeds
  const text = await this.fileTableResultCount.textContent();
  const count = text ? parseInt(text.split(' total')[0].trim()) : 0;

  if (count === 0) {
    throw new Error(
      `No search results found for search value: ${searchValue}. ` +
      `Please verify that the file exists and the search criteria are correct.`
    );
  }

  // Download first row
  const [download] = await Promise.all([
    this.page.waitForEvent('download'),
    this.downloadFileIcon.first().click(),
  ]);

  // Capture file name from table
  const summaryReportFileName = await this.page
    .locator(this.fileTableSummaryReportFileName)
    .first()
    .textContent();

  fileDetails.summaryReportFileName = summaryReportFileName?.trim();

  if (!fileDetails.summaryReportFileName) {
    throw new Error('Summary report filename not found in table.');
  }

  const path = await import('path');
  const artifactsDir = path.join(process.cwd(), 'artifacts', testName);
  const fs = await import('fs');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  const targetPath = path.join(artifactsDir, fileDetails.summaryReportFileName);
  await download.saveAs(targetPath);

  // If downloading a ReturnFile, set returnFileName
  if (fileDetails.downloadFileType === 'ReturnFile') {
    fileDetails.returnFileName = fileDetails.summaryReportFileName;
  }
}

}
