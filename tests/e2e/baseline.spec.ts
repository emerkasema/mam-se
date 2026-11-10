import { test, expect } from '@playwright/test';
import { legacyFixture } from '../fixtures/legacy.ts';

for (const width of [390, 1280]) {
  test(`upstream visual baseline ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.setFixedTime(new Date('2026-11-10T12:00:00+01:00'));
    await page.goto('./');
    await expect(page.locator('[data-akce="novyZaznam"]')).toBeVisible();
    await page.evaluate(async fixture => {
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
      } finally { db.close(); }
    }, legacyFixture);
    await page.reload();
    const routes = [
      ['home', 'domov'], ['entry', 'zaznam'],
      ['detail', `detail/${legacyFixture.zaznamy[0]!.id}`],
      ['evening', 'vecer/2026-11-10'], ['week', 'tyden/2026-W45'],
      ['overview', 'prehled'], ['settings', 'nastaveni'],
    ];
    for (const [name, route] of routes) {
      await page.goto(`./#/${route}`);
      await expect(page.locator('main')).toBeVisible();
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, { fullPage: true, animations: 'disabled', maxDiffPixels: 50 });
    }
  });
}
