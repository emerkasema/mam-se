import { defineConfig, devices } from '@playwright/test';

// Testujeme nasaditelný build, protože vývojový server service worker nespouští.
const base = process.env.PUBLIC_APP_BASE || '/mam-se/';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: `http://127.0.0.1:4321${base}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4321 --ignore-lock',
    url: `http://127.0.0.1:4321${base}`,
    reuseExistingServer: false,
  },
});
