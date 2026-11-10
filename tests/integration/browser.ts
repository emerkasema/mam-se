import { test as baseTest } from '@playwright/test';

// WebKit v ephemeral kontextu nemá OPFS a nepodporuje ukládání Blobů do IDB.
// Vlastní dočasný profil ověřuje trvalé ukládání bez přístupu k profilu uživatele.
export const test = baseTest.extend({
  context: async ({ playwright, browserName, baseURL, timezoneId }, use) => {
    const context = await playwright[browserName].launchPersistentContext('', {
      ...(baseURL ? { baseURL } : {}),
      ...(timezoneId ? { timezoneId } : {}),
    });
    try {
      await use(context);
    } finally {
      await context.close();
    }
  },
});
