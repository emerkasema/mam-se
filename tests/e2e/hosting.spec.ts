import { expect } from '@playwright/test';
import { test } from '../integration/browser.ts';

// Stejný scénář ověřuje projektovou podcestu i kořen podle PUBLIC_APP_BASE.
test('hosting resolves manifest, icons, SW scope and WASM under the configured base', async ({
  page,
  baseURL,
}) => {
  await page.goto('./');
  await expect(page.locator('[data-akce="novyZaznam"]')).toBeVisible();
  const expectedBase = new URL(baseURL!);
  const manifestURL = await page
    .locator('link[rel="manifest"]')
    .evaluate((link: HTMLLinkElement) => {
      return link.href;
    });
  expect(manifestURL).toBe(new URL('manifest.webmanifest', expectedBase).href);
  const response = await page.request.get(manifestURL);
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(new URL(manifest.start_url, manifestURL).href).toBe(expectedBase.href);
  expect(new URL(manifest.scope, manifestURL).href).toBe(expectedBase.href);
  const icons = [
    ...manifest.icons.map((icon: { src: string }) => new URL(icon.src, manifestURL).href),
    ...(await page
      .locator('link[rel="icon"], link[rel="apple-touch-icon"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLLinkElement).href))),
  ];
  for (const url of icons) {
    expect(url.startsWith(expectedBase.href)).toBe(true);
    const icon = await page.request.get(url);
    expect(icon.ok()).toBe(true);
    expect(icon.headers()['content-type']).toMatch(/^image\//);
  }
  const registration = await page.evaluate(async () => {
    const sw = await navigator.serviceWorker.ready;
    return { scope: sw.scope, script: sw.active?.scriptURL };
  });
  expect(registration.scope).toBe(expectedBase.href);
  expect(registration.script).toBe(new URL('sw.js', expectedBase).href);
  const sw = await page.request.get(registration.script!);
  const assets: string[] = JSON.parse(
    (await sw.text()).match(/const SOUBORY = (\[[\s\S]*?\]);/)![1]!,
  );
  const wasmPaths = assets.filter((path) => path.endsWith('.wasm'));
  expect(wasmPaths.length).toBeGreaterThan(0);
  for (const path of wasmPaths) {
    const url = new URL(path, expectedBase);
    expect(url.href.startsWith(expectedBase.href)).toBe(true);
    const wasm = await page.request.get(url.href);
    expect(wasm.ok()).toBe(true);
    expect(wasm.headers()['content-type']).toMatch(/^application\/wasm/);
    expect((await wasm.body()).subarray(0, 4).toString('hex')).toBe('0061736d');
  }
});
