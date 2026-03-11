import { Page, expect } from '@playwright/test';

export async function selectMatValue(page: Page, formControlName: string, value: string) {
  const matSelect = page.locator(`mat-select[formcontrolname="${formControlName}"]`);

  await page.waitForFunction(
    name => !!document.querySelector(`mat-select[formcontrolname="${name}"]`),
    formControlName,
    { timeout: 30000 }
  );

  await expect(matSelect).toBeVisible({ timeout: 30000 });

  await expect
    .poll(async () => await matSelect.getAttribute('aria-disabled'), {
      timeout: 30000,
    })
    .not.toBe('true');

  await matSelect.click();

  // Wait for the overlay pane to be attached to the DOM
  await page.waitForSelector('.cdk-overlay-pane', { state: 'attached', timeout: 30000 });

  // Wait a bit for the animation to complete
  await page.waitForTimeout(1000);

  // Wait for mat-options to be visible inside the overlay
  const overlay = page.locator('.cdk-overlay-pane mat-option');
  await expect(overlay.first()).toBeVisible({ timeout: 30000 });

  const option = page.getByRole('option', { name: value });
  await option.click();

  await expect(matSelect.locator('.mat-select-value-text')).toHaveText(value, { timeout: 15000 });
}