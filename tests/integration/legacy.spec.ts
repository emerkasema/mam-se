import { expect } from '@playwright/test';
import { legacyFixture } from '../fixtures/legacy.ts';
import { test } from './browser.ts';

test('legacy reader does not create a database and preserves a complete snapshot', async ({
  page,
}) => {
  await page.goto('./legacy/');
  await expect(page.locator('#snapshot')).toHaveText('null');
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).some((db) => db.name === 'mamse'),
    ),
  ).toBe(false);
  await page.evaluate(async (fixture) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('mamse', 1);
      request.onupgradeneeded = () => {
        for (const name of ['zaznamy', 'dny', 'tydny', 'souhlasy', 'doporuceni']) {
          request.result.createObjectStore(name, {
            keyPath:
              name === 'dny'
                ? 'datum'
                : name === 'tydny'
                  ? 'tyden'
                  : name === 'doporuceni'
                    ? 'co'
                    : 'id',
          });
        }
        request.result.createObjectStore('nastaveni');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(Object.keys(fixture), 'readwrite');
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
        for (const [name, values] of Object.entries(fixture)) {
          if (name === 'nastaveni') transaction.objectStore(name).put(values, 'hlavni');
          else
            for (const value of values as Record<string, unknown>[]) {
              transaction.objectStore(name).put(
                name === 'zaznamy'
                  ? {
                      ...value,
                      fotka: new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], {
                        type: 'image/png',
                      }),
                    }
                  : value,
              );
            }
          if (name === 'nastaveni') transaction.objectStore(name).put({ original: true }, 'extra');
        }
      });
    } finally {
      db.close();
    }
  }, legacyFixture);
  await page.reload();
  await expect(page.locator('#snapshot')).toHaveText(/^\{/);
  expect(JSON.parse(await page.locator('#snapshot').innerText())).toEqual({
    ...legacyFixture,
    zaznamy: [
      {
        ...legacyFixture.zaznamy[0],
        fotka: { mime: 'image/png', bytes: [137, 80, 78, 71, 13, 10, 26, 10] },
      },
    ],
    nastaveni: [
      { key: 'extra', value: { original: true } },
      { key: 'hlavni', value: legacyFixture.nastaveni },
    ],
  });
  await page.reload();
  await expect(page.locator('#snapshot')).toHaveText(/^\{/);
  expect(JSON.parse(await page.locator('#snapshot').innerText())).toEqual({
    ...legacyFixture,
    zaznamy: [
      {
        ...legacyFixture.zaznamy[0],
        fotka: { mime: 'image/png', bytes: [137, 80, 78, 71, 13, 10, 26, 10] },
      },
    ],
    nastaveni: [
      { key: 'extra', value: { original: true } },
      { key: 'hlavni', value: legacyFixture.nastaveni },
    ],
  });
});

test('unknown legacy key paths are rejected without dropping original keys', async ({ page }) => {
  await page.goto('./legacy/');
  await expect(page.locator('#snapshot')).toHaveText('null');
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('mamse', 1);
      request.onupgradeneeded = () => {
        for (const name of ['zaznamy', 'dny', 'tydny', 'souhlasy', 'doporuceni', 'nastaveni'])
          request.result.createObjectStore(name);
      };
      request.onsuccess = () => {
        request.result.close();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });
  await page.reload();
  await expect(page.locator('#snapshot')).toContainText('neznámé klíče');
});
