import { readFile } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { mappingFixture, photoBase64 } from '../fixtures/mapping.ts';
import { test } from '../integration/browser.ts';
import { openDiary } from './navigation.ts';

test('onboarding preserves consent, theme and privacy defaults across reload and reset', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Vítej v Mám se!' })).toBeVisible();
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pokračovat', exact: true })).toBeDisabled();
  await expect(page.locator('[data-akce="onboardingSummary"]')).not.toBeChecked();
  await expect(page.locator('[data-akce="onboardingDictation"]')).not.toBeChecked();
  await page.locator('[data-akce="onboardingConsent"]').check();
  await page.getByRole('button', { name: 'Pokračovat', exact: true }).click();
  await page.getByRole('button', { name: 'Nejdřív nastavit', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Záloha', exact: true })).toBeVisible();
  await page.locator('[data-akce="changeTheme"][value="tmavy"]').check();
  await expect(page.locator('html')).toHaveAttribute('data-vzhled', 'tmavy');
  await page.locator('[data-akce="toggleDictation"]').check();
  await expect(page.getByText('Diktování je zapnuté.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-vzhled', 'tmavy');
  await expect(page.locator('[data-akce="toggleDictation"]')).toBeChecked();
  await expect(page.locator('[data-akce="toggleSummary"]')).not.toBeChecked();
  const downloading = page.waitForEvent('download');
  await page.locator('[data-akce="zaloha"]').click();
  const file = await (await downloading).path();
  const backup = JSON.parse(await readFile(file!, 'utf8'));
  expect(backup.souhlasy).toHaveLength(2);
  expect(backup.souhlasy).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ co: 'pouzivani', zapnuto: true }),
      expect.objectContaining({ co: 'diktovani', zapnuto: true }),
    ]),
  );
  await page.locator('[data-akce="smazat"]').click();
  await page.locator('[data-akce="smazatAno"]').click();
  await expect(page.getByRole('heading', { name: 'Vítej v Mám se!' })).toBeVisible();
});

test('weekly summary stays optional and previews only aggregate fields without sending requests', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).hostname === 'docs.google.com') requests.push(request.url());
  });
  await openDiary(page, './#/nastaveni');
  await page.locator('[data-akce="toggleSummary"]').check();
  await expect(
    page.getByText('Souhlas je zapnutý. Po týdenním ohlédnutí se nabídne souhrn.'),
  ).toBeVisible();
  await page.goto('./#/tyden/2026-W46');
  await page.locator('#tyden-tema').fill('Soukromý text, který nesmí do odkazu');
  await page.locator('[data-akce="tydenUlozit"]').click();
  await expect(page.getByRole('heading', { name: 'Chceš poslat souhrn?' })).toBeVisible();
  const link = new URL(
    (await page.getByRole('link', { name: 'Otevřít formulář' }).getAttribute('href'))!,
  );
  expect(link.hostname).toBe('docs.google.com');
  expect(link.searchParams.get('entry.1512813664')).toBe('2026-W46');
  expect(link.searchParams.get('entry.9703391')).toBe('0.10.0');
  expect([...link.searchParams.keys()]).toEqual(
    expect.arrayContaining(['usp', 'entry.1512813664', 'entry.1395908083', 'entry.9703391']),
  );
  expect(link.href).not.toContain(encodeURIComponent('Soukromý'));
  expect(requests).toEqual([]);
  await page.goto('./#/nastaveni');
  await page.locator('[data-akce="toggleSummary"]').uncheck();
  await expect(page.getByText('Souhlas je vypnutý. Nic dalšího se neposílá.')).toBeVisible();
  await page.goto('./#/souhrn/2026-W46');
  await expect(page.getByText(/Posílání souhrnu je vypnuté/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Otevřít formulář' })).toHaveCount(0);
});

test('an instant entry becomes an evening block without losing its photo or the original', async ({
  page,
}) => {
  await openDiary(page, './#/nastaveni');
  const snapshot = mappingFixture();
  snapshot.zaznamy[0]!.fotka = `data:image/png;base64,${photoBase64}`;
  await page.locator('[data-akce="nahrat"]').setInputFiles({
    name: 'synthetic-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        ...snapshot,
        aplikace: 'Mám se!',
        format_zalohy: 1,
        nastaveni: snapshot.nastaveni[0]!.value,
        settingsEntries: snapshot.nastaveni,
      }),
    ),
  });
  await expect(page.getByText('Hotovo. Přibylo záznamů: 3.')).toBeVisible();
  await page.goto('./#/vecer/2026-11-10');
  await page.locator('[data-akce="entryToEveningBlock"]').click();
  await page.locator('[data-akce="vecerUlozitRozvrh"]').click();
  await expect(page.getByText('Rozvrh je uložený. Můžeš kdykoli pokračovat.')).toBeVisible();
  await page.goto('./#/nastaveni');
  const downloading = page.waitForEvent('download');
  await page.locator('[data-akce="zaloha"]').click();
  const file = await (await downloading).path();
  const backup = JSON.parse(await readFile(file!, 'utf8'));
  const original = backup.zaznamy.find((row: { id: string }) => row.id === snapshot.zaznamy[0]!.id);
  const linked = backup.zaznamy.find(
    (row: { zdroj_okamzity?: string }) => row.zdroj_okamzity === original.id,
  );
  expect(original.typ).toBe('okamzity');
  expect(linked.typ).toBe('vecerni');
  for (const key of [
    'fotka',
    'emoce',
    'telo',
    'potreby',
    'vlastni_slova',
    'cinnost',
    's_kym',
    'kde',
  ])
    expect(linked[key]).toEqual(original[key]);
});
