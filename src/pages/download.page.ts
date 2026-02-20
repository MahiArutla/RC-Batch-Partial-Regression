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
  let targetRowLocator;
  let summaryReportFileName;
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

  targetRowLocator = row;
  summaryReportFileName = rawName;

  fileDetails.summaryReportFileName = summaryReportFileName;

  const [download] = await Promise.all([
    this.page.waitForEvent('download'),
    targetRowLocator.locator('fa-icon#edit[icon="download"], fa-icon[icon="download"]').click(),
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


  // 2) Wait for results count > 0
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

  // 3) Select the FIRST row (you said: always download the first one)
  const row = this.page.locator('datatable-body-row').first();
  await row.waitFor({ state: 'visible', timeout: 10000 });
  await row.scrollIntoViewIfNeeded();

  // 4) Read file name from the "File Name" column (3rd column = nth(2))
  const fileNameLocator = row
    .locator('datatable-body-cell')
    .nth(2)
    .locator('.datatable-body-cell-label');

  await expect(fileNameLocator).toBeVisible({ timeout: 5000 });

  const rawName = (await fileNameLocator.innerText()).trim();
 

  fileDetails.summaryReportFileName = rawName;

  // 5) Click download icon in the same row and wait for download
  const downloadIcon = row.locator('fa-icon[icon="download"]').first();
  await expect(downloadIcon).toBeVisible({ timeout: 5000 });

  const [download] = await Promise.all([
    this.page.waitForEvent('download'),
    downloadIcon.click(),
  ]);

  // 6) Prepare artifacts directory
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

 
  // 7) Save file (prefer table name; fallback to suggested filename)
  const finalName = fileDetails.summaryReportFileName || download.suggestedFilename();
  if (!finalName) {
    throw new Error('Could not determine a filename for the downloaded artifact.');
  }

  const targetPath = path.join(artifactsDir, finalName);
  await download.saveAs(targetPath);

  // 8) Update fileDetails for return file type
  if (fileDetails.downloadFileType === 'ReturnFile') {
    fileDetails.returnFileName = finalName;
  }

  return targetPath;
}



}
