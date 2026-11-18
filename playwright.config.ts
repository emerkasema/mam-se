import { defineConfig, devices } from '@playwright/test';

// Testujeme nasaditelný build, protože vývojový server service worker nespouští.
const base = process.env.PUBLIC_APP_BASE || '/mam-se/';
export default defineConfig({
  outputDir: 'test-results/e2e',
  testDir: './tests/e2e',
  fullyParallel: false,
  // Úložiště čeká na potvrzení až 15 s. Výchozích 5 s pro UI assertion
  // může na vytíženém CI skončit dřív než platný zápis; chyby dál test selžou.
  expect: { timeout: process.env.CI ? 20_000 : 5_000 },
  use: { baseURL: `http://127.0.0.1:4321${base}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'], testIgnore: '**/baseline.spec.ts' },
    { name: 'webkit', use: devices['Desktop Safari'], testIgnore: '**/baseline.spec.ts' },
  ],
  webServer: {
    command: 'bun run preview -- --host 127.0.0.1 --port 4321 --ignore-lock',
    url: `http://127.0.0.1:4321${base}`,
    reuseExistingServer: false,
  },
});
