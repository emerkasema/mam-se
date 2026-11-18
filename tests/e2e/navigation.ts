import { expect, type Page } from '@playwright/test';

// Běžné scénáře projdou stejným úvodem jako člověk. Samostatný upstream test
// ověřuje i zakázané pokračování a volitelné souhlasy; zde je nezapínáme.
export async function openDiary(page: Page, route = './') {
  await page.goto(route);
  await expect(page.locator('main')).toBeVisible();
  if (await page.getByRole('heading', { name: 'Vítej v Mám se!' }).isVisible()) {
    await page.locator('[data-akce="onboardingNext"]').click();
    await page.locator('[data-akce="onboardingConsent"]').check();
    await page.locator('[data-akce="onboardingNext"]').click();
    await page.getByRole('button', { name: 'Začít', exact: true }).click();
    await expect(page.locator('[data-akce="novyZaznam"]')).toBeVisible();
    await page.goto(route);
  }
}
