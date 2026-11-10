import { test, expect } from '@playwright/test';

test('záznam přežije reload i offline otevření', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('./');
  await expect(page.locator('[data-akce="novyZaznam"]')).toBeVisible();
  await page.locator('[data-akce="novyZaznam"]').click();
  await page.locator('#text').fill('Syntetický záznam pro test Astro.');
  await page.locator('[data-akce="ulozit"]').click();
  await expect(page).toHaveURL(/#\/hotovo/);
  await page.goto('./#/domov');
  await expect(page.getByText('Syntetický záznam pro test Astro.', { exact: true })).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByText('Syntetický záznam pro test Astro.', { exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Syntetický záznam pro test Astro.', { exact: true })).toBeVisible();
  const wrongFallback = await page.evaluate(async () => {
    try { const response = await fetch('chybejici-test.js'); return response.headers.get('content-type'); }
    catch { return null; }
  });
  expect(wrongFallback).toBeNull();
  expect(errors).toEqual([]);
});

test('mobilní obálka zachovává navigaci a vzhledové assety', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.locator('.znacka img')).toBeVisible();
  expect(await page.locator('.znacka img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  expect(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(247, 242, 234)');
  await page.locator('nav a[href="#/prehled"]').click();
  await expect(page).toHaveURL(/#\/prehled/);
  await page.locator('nav a[href="#/nastaveni"]').click();
  await expect(page.getByRole('heading', { name: 'Záloha', exact: true })).toBeVisible();
});
