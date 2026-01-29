import { Page, expect } from '@playwright/test';

export async function selectMatValue(
  page: Page,
  formControlName: string,
  value: string
) {
  const matSelect = page.locator(
    `mat-select[formcontrolname="${formControlName}"]`
  );

  // wait until Angular finishes rendering this control
  await page.waitForFunction(
    name =>
      !!document.querySelector(`mat-select[formcontrolname="${name}"]`),
    formControlName,
    { timeout: 30000 }
  );

  await expect(matSelect).toBeVisible({ timeout: 30000 });

  // wait until not disabled (aria)
  await expect
    .poll(async () => await matSelect.getAttribute('aria-disabled'), {
      timeout: 30000,
    })
    .not.toBe('true');

  // open dropdown
 const arrow = matSelect.locator('.mat-select-arrow');
await arrow.click({ force: true });

  // wait for overlay
  const overlay = page.locator('.cdk-overlay-pane mat-option');
  await overlay.first().waitFor({ timeout: 20000 });

  // pick option
  const option = page.getByRole('option', { name: value });
  await option.click();

  // verify
  await expect(matSelect.locator('.mat-select-value-text')).toHaveText(
    value,
    { timeout: 15000 }
  );
}