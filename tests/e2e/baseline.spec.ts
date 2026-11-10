import { expect, test } from '@playwright/test';
import { legacyFixture } from '../fixtures/legacy.ts';

// Fixní okamžik nestačí: UI používá místní datum i čas.
test.use({ timezoneId: 'Europe/Prague' });

for (const width of [390, 1280]) {
  test(`upstream visual baseline ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-11-10T12:00:00+01:00'));
    await page.goto('./');
    await expect(page.locator('[data-akce="novyZaznam"]')).toBeVisible();
    await page.evaluate(async (fixture) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('mamse', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(Object.keys(fixture), 'readwrite');
          transaction.oncomplete = () => resolve();
          transaction.onabort = () => reject(transaction.error);
          for (const [name, values] of Object.entries(fixture)) {
            const store = transaction.objectStore(name);
            store.clear();
            if (name === 'nastaveni') store.put(values, 'hlavni');
            else for (const value of values as unknown[]) store.put(value);
          }
        });
      } finally {
        db.close();
      }
    }, legacyFixture);
    await page.reload();
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
