import { expect } from '@playwright/test';
import { legacyFixture } from '../fixtures/legacy.ts';
import { test } from '../integration/browser.ts';

// Fixní okamžik nestačí: UI používá místní datum i čas.
test.use({ timezoneId: 'Europe/Prague' });

for (const width of [390, 1280]) {
  test(`upstream visual baseline ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-11-10T12:00:00+01:00'));
    await page.goto('./#/nastaveni');
    await expect(page.getByRole('heading', { name: 'Záloha', exact: true })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'synthetic-backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({ aplikace: 'Mám se!', format_zalohy: 1, ...legacyFixture }),
      ),
    });
    await expect(page.getByText('Hotovo. Přibylo záznamů: 1.', { exact: true })).toBeVisible();
    await expect(page.locator('.oznameni')).toBeHidden();
    const routes = [
      ['home', 'domov'],
      ['entry', 'zaznam'],
      ['detail', `detail/${legacyFixture.zaznamy[0]!.id}`],
      ['evening', 'vecer/2026-11-10'],
      ['week', 'tyden/2026-W45'],
      ['overview', 'prehled'],
      ['settings', 'nastaveni'],
    ];
    for (const [name, route] of routes) {
      await page.goto(`./#/${route}`);
      await expect(page.locator('main')).toBeVisible();
      if (name === 'home')
        await expect(page.getByRole('heading', { name: 'Jak se máš?', exact: true })).toBeVisible();
      if (name === 'entry') await expect(page.locator('#text')).toBeVisible();
      if (name === 'detail') await expect(page.locator('[data-akce="smazatZaznam"]')).toBeVisible();
      if (name === 'evening')
        await expect(
          page.getByRole('heading', { name: 'Co jsi dnes dělala/dělal?', exact: true }),
        ).toBeVisible();
      if (name === 'week')
        await expect(page.getByRole('heading', { name: 'Tvůj týden', exact: true })).toBeVisible();
      if (name === 'overview')
        await expect(page.getByRole('heading', { name: 'Můj přehled', exact: true })).toBeVisible();
      if (name === 'settings')
        await expect(page.getByRole('heading', { name: 'Záloha', exact: true })).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixels: 50,
      });
    }
  });
}
