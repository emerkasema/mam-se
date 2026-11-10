import { expect } from '@playwright/test';
import { test } from './browser.ts';

test('storage preserves backups, deletes and restores the same entry', async ({ page }) => {
  await page.goto('./storage/');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const { storage, fixture } = window.storageTest;
    const snapshot = await storage.getSnapshot();
    const entry = snapshot.zaznamy[0]!;
    await storage.deleteEntry(entry.id as string);
    const missing = await storage.getEntry(entry.id as string);
    await storage.saveEntry(entry);
    const backup = await storage.exportBackup();
    const added = await storage.importBackup(backup);
    return {
      entries: snapshot.zaznamy.length,
      weeks: snapshot.tydny,
      missing: missing ?? null,
      added,
      settings: snapshot.nastaveni,
      expectedSettings: fixture.nastaveni,
    };
  });
  expect(result.entries).toBe(3);
  expect(result.weeks).toHaveLength(2);
  expect(result.missing).toBeNull();
  expect(result.added).toBe(0);
  expect(result.settings.sort((a, b) => String(a.key).localeCompare(String(b.key)))).toEqual(
    result.expectedSettings.sort((a, b) => String(a.key).localeCompare(String(b.key))),
  );
  await page.reload();
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(
    await page.evaluate(
      async () => (await window.storageTest.storage.getSnapshot()).zaznamy.length,
    ),
  ).toBe(3);
});

test('invalid later import cannot change earlier rows or settings', async ({ page }) => {
  await page.goto('./storage/');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const { storage } = window.storageTest;
    const before = await storage.exportBackup();
    const bad = structuredClone(before);
    bad.zaznamy[0]!.vlastni_slova = 'Must not commit';
    bad.zaznamy[0]!.upraveno = '2026-11-11T12:00:00Z';
    bad.zaznamy[2]!.fotka = 'data:image/png;base64,AQID';
    let error = '';
    try {
      await storage.importBackup(bad);
    } catch (e) {
      error = (e as Error).message;
    }
    const after = await storage.exportBackup();
    return { error, before: { ...before, exportovano: '' }, after: { ...after, exportovano: '' } };
  });
  expect(result.error).toBeTruthy();
  expect(result.after).toEqual(result.before);
});

test('reset removes new data and identity and stays empty after reload', async ({ page }) => {
  await page.goto('./storage/');
  await expect(page.locator('#status')).toHaveText('Ready');
  await page.evaluate(() => window.storageTest.storage.resetStorage());
  await page.reload();
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => ({
    snapshot: await window.storageTest.storage.getSnapshot(),
    legacy: await window.storageTest.readLegacySnapshot(),
  }));
  expect(result.snapshot.zaznamy).toEqual([]);
  expect(result.snapshot.nastaveni).toEqual([]);
  expect(result.legacy?.zaznamy ?? []).toEqual([]);
});

test('two tabs serialize writes and a reset invalidates the older tab', async ({
  page,
  context,
}) => {
  await page.goto('./storage/');
  await expect(page.locator('#status')).toHaveText('Ready');
  const other = await context.newPage();
  await other.goto('./storage/');
  await expect(other.locator('#status')).toHaveText('Ready');
  await Promise.all(
    [page, other].map((tab, index) =>
      tab.evaluate(async (i) => {
        const { storage } = window.storageTest;
        const original = (await storage.getSnapshot()).zaznamy[0]!;
        await storage.saveEntry({ ...original, id: `synthetic-concurrent-${i}` });
      }, index),
    ),
  );
  expect(
    await page.evaluate(async () => (await window.storageTest.storage.getEntries()).length),
  ).toBe(5);
  await other.evaluate(() => window.storageTest.storage.resetStorage());
  const error = await page.evaluate(async () => {
    try {
      await window.storageTest.storage.saveDay({ datum: '2026-11-10', barva: null });
      return 'unexpected';
    } catch (e) {
      return (e as Error).message;
    }
  });
  expect(error).toMatch(/jiné kartě/);
  await page.reload();
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(
    await page.evaluate(async () => (await window.storageTest.storage.getEntries()).length),
  ).toBe(0);
});

test('interrupted reset resumes after reload without recreating old identity or data', async ({
  page,
}) => {
  await page.goto('./storage/');
  await expect(page.locator('#status')).toHaveText('Ready');
  const error = await page.evaluate(async () => {
    const original = IDBObjectStore.prototype.delete;
    IDBObjectStore.prototype.delete = function (key) {
      const request = original.call(this, key);
      if (this.transaction.db.name === 'mamse-identity')
        request.addEventListener('success', () => this.transaction.abort());
      return request;
    };
    try {
      await window.storageTest.storage.resetStorage();
      return 'unexpected';
    } catch {
      return 'reset interrupted';
    }
  });
  expect(error).toBe('reset interrupted');
  await page.reload();
  await expect(page.locator('#status')).toHaveText('Ready');
  expect(
    await page.evaluate(async () => (await window.storageTest.storage.getEntries()).length),
  ).toBe(0);
});

test('evening batch preserves the day with its blocks and rejected input cannot partially save it', async ({
  page,
}) => {
  await page.goto('./storage/');
  await expect(page.locator('#status')).toHaveText('Ready');
  const result = await page.evaluate(async () => {
    const { storage } = window.storageTest;
    const entry = (await storage.getEntries()).find((row) => row.typ === 'vecerni')!;
    await storage.saveEveningBatch(
      [{ ...entry, popis_bloku: 'Nový rozvrh' }],
      { datum: '2026-11-10', vecerni_hotovo: true, barva: '#abcdef' },
      [],
    );
    const before = await storage.exportBackup();
    let error = '';
    try {
      await storage.saveEveningBatch(
        [{ ...entry, prijemnost: 99 }],
        { datum: '2026-11-10', vecerni_hotovo: false },
        [],
      );
    } catch (e) {
      error = (e as Error).message;
    }
    const after = await storage.exportBackup();
    return { error, before: { ...before, exportovano: '' }, after: { ...after, exportovano: '' } };
  });
  expect(result.error).toMatch(/prijemnost/);
  expect(result.after).toEqual(result.before);
  expect(result.after.dny[0].vecerni_hotovo).toBe(true);
});
