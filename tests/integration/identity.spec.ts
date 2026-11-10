import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from './browser.ts';

test('concurrent tabs create one persistent identity and reload preserves it', async ({ page, context }) => {
  const second = await context.newPage();
  await Promise.all([page.goto('./identity/'), second.goto('./identity/')]);
  await expect(page.locator('#identity')).toHaveText(/^[a-f0-9]{64}$/);
  await expect(second.locator('#identity')).toHaveText(await page.locator('#identity').innerText());
  const fingerprint = await page.locator('#identity').innerText();
  await second.close();
  await page.reload();
  await expect(page.locator('#identity')).toHaveText(fingerprint);
});

test('invalid persisted secret is rejected rather than silently replaced', async ({ page }) => {
  await page.goto('./identity/');
  await expect(page.locator('#identity')).toHaveText(/^[a-f0-9]{64}$/);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('mamse-identity', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('identity', 'readwrite');
        transaction.objectStore('identity').put(new Uint8Array([1, 2]), 'ownerSecret');
        transaction.oncomplete = () => resolve();
        transaction.onabort = () => reject(transaction.error);
      });
    } finally { db.close(); }
  });
  await page.reload();
  await expect(page.locator('#identity')).toHaveText('Uložená identita je poškozená. Nebyla nahrazena.');
});

test('identity survives closing and reopening a browser profile', async ({ playwright, browserName, baseURL }) => {
  const directory = await mkdtemp(join(tmpdir(), 'mam-se-identity-'));
  try {
    let fingerprint = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const context = await playwright[browserName].launchPersistentContext(directory, baseURL ? { baseURL } : {});
      try {
        const page = await context.newPage();
        await page.goto('./identity/');
        await expect(page.locator('#identity')).toHaveText(/^[a-f0-9]{64}$/);
        const current = await page.locator('#identity').innerText();
        if (attempt === 0) fingerprint = current;
        else expect(current).toBe(fingerprint);
      } finally { await context.close(); }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
