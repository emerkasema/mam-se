import { readdir } from 'node:fs/promises';
import { expect } from '@playwright/test';
import { test } from './browser.ts';

test('client entry persists through reload without a relay', async ({ page }) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('websocket', (socket) => sockets.push(socket.url()));
  await page.goto('./');
  await expect(page.locator('#rows')).toHaveText('[]');
  await expect(page.locator('body')).not.toHaveAttribute('data-persistence', 'NotPersisted');
  await page.locator('#save').click();
  await expect(page.locator('#rows')).toHaveText('["Synthetic entry"]');
  await page.reload();
  await expect(page.locator('#rows')).toHaveText('["Synthetic entry"]');
  expect(errors).toEqual([]);
  expect(
    sockets.filter((url) => !process.env.INTEGRATION_DEV || !url.startsWith('ws://127.0.0.1:4322')),
  ).toEqual([]);
});

// Chybná base nebo HTML fallback nesmí zamaskovat nedostupný worker/WASM.
test('build serves emitted workers and WASM under the configured base', async ({ request }) => {
  test.skip(Boolean(process.env.INTEGRATION_DEV), 'Asset names belong to the production build.');
  const files = await readdir('tests/integration/astro/dist/_astro');
  const assets = files.filter((name) => name.endsWith('.wasm') || name.includes('.worker-'));
  expect(assets.some((name) => name.endsWith('.wasm'))).toBe(true);
  expect(assets.filter((name) => name.includes('.worker-'))).toHaveLength(2);
  for (const name of assets) {
    const response = await request.get(`./_astro/${name}`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain(
      name.endsWith('.wasm') ? 'application/wasm' : 'javascript',
    );
    if (name.endsWith('.wasm'))
      expect([...(await response.body()).subarray(0, 4)]).toEqual([0, 97, 115, 109]);
  }
});
