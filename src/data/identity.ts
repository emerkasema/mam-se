import { OwnerSecret, createOwnerSecret, createRandomBytes } from '@evolu/common';

// Toto je místní tajemství, nikoliv zámek telefonu: kód stejného originu má
// k IndexedDB přístup. Fráze ani tajemství nepatří do JSON záloh nebo logů.
export async function getOrCreateOwnerSecret(): Promise<OwnerSecret> {
  return navigator.locks.request('mam-se:identity', async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('mamse-identity', 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore('identity');
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else resolve(request.result);
      };
      request.onerror = () => reject(new Error('Identitu se nepodařilo otevřít. Deník nebyl připojen.'));
      request.onblocked = () => {
        blocked = true;
        reject(new Error('Zavři ostatní karty aplikace a zkus znovu otevřít identitu.'));
      };
    });
    try {
      return await new Promise<OwnerSecret>((resolve, reject) => {
        const transaction = db.transaction('identity', 'readwrite');
        const store = transaction.objectStore('identity');
        let secret: OwnerSecret | undefined;
        let failure: Error | undefined;
        // getAll odlišuje chybějící klíč od poškozené uložené hodnoty undefined.
        const request = store.getAll('ownerSecret');
        request.onsuccess = () => {
          try {
            if (request.result.length) {
              const parsed = OwnerSecret.fromUnknown(request.result[0]);
              if (!parsed.ok) throw new Error('Uložená identita je poškozená. Nebyla nahrazena.');
              secret = parsed.value;
            } else {
              secret = createOwnerSecret({ randomBytes: createRandomBytes() });
              store.put(secret, 'ownerSecret');
            }
          } catch (error) {
            failure = error instanceof Error ? error : new Error('Identitu se nepodařilo uložit.');
            transaction.abort();
          }
        };
        transaction.onabort = () => reject(failure ?? new Error('Identitu se nepodařilo trvale uložit. Deník nebyl připojen.'));
        transaction.onerror = () => { /* Odmítnutí řeší onabort po ukončení transakce. */ };
        // Klient Evolu smí vzniknout až po potvrzeném uložení klíče. Samotný
        // úspěch požadavku put ještě neznamená dokončenou IDB transakci.
        transaction.oncomplete = () => {
          if (!secret) reject(new Error('Identita chybí. Deník nebyl připojen.'));
          else resolve(OwnerSecret.orThrow(secret.slice()));
        };
      });
    } finally { db.close(); }
  });
}
