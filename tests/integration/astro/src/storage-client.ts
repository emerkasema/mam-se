import { exportSnapshot } from '../../../../src/data/backup.ts';
import { readLegacySnapshot } from '../../../../src/data/legacy.ts';
import { initializeStorage } from '../../../../src/data/storage.ts';
import { mappingFixture, photoBase64 } from '../../../fixtures/mapping.ts';

const fixture = mappingFixture();
const status = document.querySelector('#status')!;
try {
  // Seedujeme jen jednou, v samostatném testovacím profilu. Produkce nic takového nedělá.
  if (!localStorage.getItem('synthetic-seeded')) {
    fixture.zaznamy[0]!.fotka = new Blob(
      [Uint8Array.from(atob(photoBase64), (c) => c.charCodeAt(0))],
      { type: 'image/png' },
    );
  }
  const storage = await initializeStorage();
  if (!localStorage.getItem('synthetic-seeded')) {
    await storage.importBackup(await exportSnapshot(fixture));
    localStorage.setItem('synthetic-seeded', '1');
  }
  Object.assign(window, { storageTest: { storage, fixture, readLegacySnapshot } });
  status.textContent = 'Ready';
} catch (e) {
  status.textContent = (e as Error).message;
}
declare global {
  interface Window {
    storageTest: {
      storage: Awaited<ReturnType<typeof initializeStorage>>;
      fixture: typeof fixture;
      readLegacySnapshot: typeof readLegacySnapshot;
    };
  }
}
