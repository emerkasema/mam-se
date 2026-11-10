import { defineConfig, devices } from '@playwright/test';

const base = process.env.PUBLIC_APP_BASE || '/mam-se/';
export default defineConfig({
  testDir: './tests/integration',
  use: { baseURL: `http://127.0.0.1:4322${base}` },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
  webServer: {
    command: `bunx --no-install astro ${process.env.INTEGRATION_DEV ? 'dev' : 'preview'} --root tests/integration/astro --host 127.0.0.1 --port 4322 --ignore-lock`,
    url: `http://127.0.0.1:4322${base}`,
    reuseExistingServer: false,
  },
});
