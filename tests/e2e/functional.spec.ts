import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { mappingFixture, photoBase64 } from '../fixtures/mapping.ts';
import { test } from '../integration/browser.ts';

async function openSettings(page: Page) {
  await page.goto('./#/nastaveni');
  await expect(page.getByRole('heading', { name: 'Záloha', exact: true })).toBeVisible();
}
async function uploadBackup(page: Page, data: unknown) {
  await page.locator('[data-akce="nahrat"]').setInputFiles({
    name: 'synthetic-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(data)),
  });
}
async function downloadBackup(page: Page) {
  const download = page.waitForEvent('download');
  await page.locator('[data-akce="zaloha"]').click();
  const file = await (await download).path();
  if (!file) throw new Error('Missing backup download');
  return JSON.parse(await readFile(file, 'utf8'));
}
function backupFixture() {
  const snapshot = mappingFixture();
  snapshot.zaznamy[0]!.fotka = `data:image/png;base64,${photoBase64}`;
  return {
    ...snapshot,
    aplikace: 'Mám se!',
    format_zalohy: 1,
    nastaveni: snapshot.nastaveni[0]!.value,
    settingsEntries: snapshot.nastaveni,
  };
}

test('new user can back up, reset, restore all stores and use a photo offline', async ({
  page,
  context,
}) => {
  let sockets = 0;
  page.on('websocket', () => sockets++);
  await openSettings(page);
  await uploadBackup(page, backupFixture());
  await expect(page.getByText('Hotovo. Přibylo záznamů: 3.', { exact: true })).toBeVisible();
  const before = await downloadBackup(page);
  expect(before.zaznamy).toHaveLength(3);
  expect(
    before.zaznamy.find((row: { id: string }) => row.id === '11111111-1111-4111-8111-111111111111')
      .fotka,
  ).toBe(`data:image/png;base64,${photoBase64}`);
  expect(before.tydny).toHaveLength(2);
  expect(before.souhlasy).toHaveLength(1);
  expect(before.doporuceni).toHaveLength(1);
  expect(before.settingsEntries).toHaveLength(3);
  await page.locator('[data-akce="smazat"]').click();
  await page.locator('[data-akce="smazatAno"]').click();
  await expect(page.locator('[data-akce="novyZaznam"]')).toBeVisible();
  await openSettings(page);
  const empty = await downloadBackup(page);
  for (const name of ['zaznamy', 'dny', 'tydny', 'souhlasy', 'doporuceni', 'settingsEntries'])
    expect(empty[name]).toEqual([]);
  await uploadBackup(page, before);
  await expect(page.getByText('Hotovo. Přibylo záznamů: 3.', { exact: true })).toBeVisible();
  const after = await downloadBackup(page);
  expect({ ...after, exportovano: '' }).toEqual({ ...before, exportovano: '' });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await page.goto('./#/detail/11111111-1111-4111-8111-111111111111');
  await expect(page.locator('.fotka-velka')).toBeVisible();
  expect(
    await page.locator('.fotka-velka').evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBe(1);
  await page.locator('[data-akce="smazatZaznam"]').click();
  await page.locator('[data-akce="smazatZaznamAno"]').click();
  await expect(page).toHaveURL(/#\/domov/);
  await openSettings(page);
  expect((await downloadBackup(page)).zaznamy).toHaveLength(2);
  await page.reload();
  expect((await downloadBackup(page)).zaznamy).toHaveLength(2);
  expect(sockets).toBe(0);
});

test('invalid import leaves the actual diary unchanged', async ({ page }) => {
  await openSettings(page);
  await uploadBackup(page, backupFixture());
  await expect(page.getByText('Hotovo. Přibylo záznamů: 3.', { exact: true })).toBeVisible();
  const before = await downloadBackup(page);
  const invalid = structuredClone(before);
  invalid.zaznamy[0].vlastni_slova = 'Must not be written';
  invalid.zaznamy[0].upraveno = '2026-11-12T10:00:00Z';
  invalid.zaznamy[2].fotka = 'data:image/png;base64,AQID';
  await uploadBackup(page, invalid);
  await expect(page.getByText(/Fotku nelze dekódovat/)).toBeVisible();
  const after = await downloadBackup(page);
  expect({ ...after, exportovano: '' }).toEqual({ ...before, exportovano: '' });
});

test('editing an evening entry preserves its description and additional fields', async ({
  page,
}) => {
  await openSettings(page);
  const backup = backupFixture();
  backup.zaznamy[1]!.extra = { preserved: true };
  await uploadBackup(page, backup);
  await expect(page.getByText('Hotovo. Přibylo záznamů: 3.', { exact: true })).toBeVisible();
  await page.goto('./#/detail/id-evening');
  await page.locator('[data-akce="upravitZaznam"]').click();
  await page.locator('#text').fill('Doplněný večerní záznam.');
  await page.locator('[data-akce="ulozit"]').click();
  await expect(page).toHaveURL(/#\/hotovo/);
  await openSettings(page);
  const saved = (await downloadBackup(page)).zaznamy.find(
    (row: { id: string }) => row.id === 'id-evening',
  );
  expect(saved.popis_bloku).toBe('Práce');
  expect(saved.extra).toEqual({ preserved: true });
  expect(saved.vlastni_slova).toBe('Doplněný večerní záznam.');
});

test('new user can save an evening schedule, a celebration and a week', async ({ page }) => {
  await page.goto('./#/vecer/2026-11-10');
  await page.locator('#blok-popis').fill('Syntetický večerní blok');
  await page.locator('[data-akce="blokCinnost"]').first().click();
  await page.locator('[data-akce="vecerUlozitRozvrh"]').click();
  await expect(
    page.getByText('Rozvrh je uložený. Můžeš kdykoli pokračovat.', { exact: true }),
  ).toBeVisible();
  await page.locator('[data-akce="vecerDal"]').click();
  await page.locator('[data-akce="vecerUlozit"]').click();
  await page.goto('./#/tyden/2026-W46');
  await page.locator('#tyden-tema').fill('Syntetické téma týdne');
  await page.locator('[data-akce="tydenUlozit"]').click();
  await expect(page).toHaveURL(/#\/domov/);
  await page.locator('[data-akce="novyZaznam"]').click();
  await page.locator('#text').fill('Syntetická chvíle před oslavou');
  await page.locator('[data-akce="ulozit"]').click();
  await page.locator('[data-akce="oslavaZacit"]').click();
  await page.locator('#oslava-text').fill('Syntetická oslava');
  await page.locator('[data-akce="oslavaUlozit"]').first().click();
  await expect(page).toHaveURL(/#\/hotovo/);
  await openSettings(page);
  const saved = await downloadBackup(page);
  expect(
    saved.zaznamy.some(
      (row: { typ: string; vlastni_slova: string }) =>
        row.typ === 'oslava' && row.vlastni_slova === 'Syntetická oslava',
    ),
  ).toBe(true);
  expect(
    saved.dny.find((row: { datum: string }) => row.datum === '2026-11-10').vecerni_hotovo,
  ).toBe(true);
  expect(saved.tydny.find((row: { tyden: string }) => row.tyden === '2026-W46').tema).toBe(
    'Syntetické téma týdne',
  );
});
