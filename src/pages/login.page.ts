import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base.page';
export class LoginPage extends BasePage {
  private readonly emailInput: Locator;
  private readonly passwordInput: Locator;
  private readonly signInButton: Locator;

  constructor(page: Page) {
    super(page);
    // Prefer role/text locators; fallback to attributes if needed
    this.emailInput = page.locator("//input[@ng-model='email']");
    this.passwordInput = page.locator("//input[@formcontrolname='password']");
    this.signInButton = page.getByRole('button', { name: /sign in/i });
  }

  async goto(url: string): Promise<void> {
    await super.goto(url);
  }

  async login(user: string, password: string): Promise<void> {
    await this.fill(this.emailInput, user);
    await this.fill(this.passwordInput, password);
    await this.signInButton.click();
    await this.page.waitForLoadState('networkidle');
    // Optional: confirm we navigated away from login
    await expect(this.signInButton).not.toBeVisible({ timeout: 15000 });
  }
}
