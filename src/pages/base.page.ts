import { Page, Locator, expect, Download } from '@playwright/test';

export class BasePage {
  protected readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto(url: string): Promise<void> {
    await this.page.goto(url);
  }

  async click(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
    await locator.click();
  }

  async fill(locator: Locator, value: string): Promise<void> {
    await expect(locator).toBeVisible();
    await locator.fill(value);
  }

  async expectVisible(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible();
  }

  async waitForDownload(clickTarget: Locator): Promise<Download> {
    const dl = this.page.waitForEvent('download');
    await clickTarget.click();
    return dl;
  }
}
