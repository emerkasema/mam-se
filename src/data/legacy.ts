import { legacyCollections, type LegacyCollection, type LegacyObject } from './backup.ts';

export type LegacySnapshot = Record<LegacyCollection, LegacyObject[]> & {
  nastaveni: { key: IDBValidKey; value: unknown }[];
};

// Převod nesmí na novém zařízení vytvořit prázdnou starou DB. Pokud ji někdo
// mezitím smaže, upgrade přerušíme; nepoužíváme žádný legacy zápis ani clear.
export async function readLegacySnapshot(): Promise<LegacySnapshot | null> {
  const databases = await indexedDB.databases();
  if (!databases.some(database => database.name === 'mamse')) return null;
  const db = await new Promise<IDBDatabase | null>((resolve, reject) => {
    const request = indexedDB.open('mamse', 1);
    let missing = false;
    let blocked = false;
    request.onupgradeneeded = () => { missing = true; request.transaction!.abort(); };
    request.onsuccess = () => {
      if (blocked) request.result.close();
      else resolve(request.result);
    };
    request.onerror = () => missing ? resolve(null) : reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Zavři starou verzi deníku v ostatních kartách.'));
    };
  });
  if (!db) return null;
  try {
    const names = [...legacyCollections, 'nastaveni'];
    if (db.objectStoreNames.length !== names.length || names.some(name => !db.objectStoreNames.contains(name))) {
      throw new Error('Původní databáze má neznámá úložiště; automatický převod byl zastaven.');
    }
    return await new Promise<LegacySnapshot>((resolve, reject) => {
      const transaction = db.transaction(names, 'readonly');
      const keyPaths: Record<string, string | null> = {
        zaznamy: 'id', dny: 'datum', tydny: 'tyden', souhlasy: 'id', doporuceni: 'co', nastaveni: null,
      };
      if (names.some(name => transaction.objectStore(name).keyPath !== keyPaths[name] || transaction.objectStore(name).autoIncrement)) {
        transaction.abort();
        reject(new Error('Původní databáze má neznámé klíče; automatický převod byl zastaven.'));
        return;
      }
      const requests = legacyCollections.map(name => [name, transaction.objectStore(name).getAll()] as const);
      const settings = transaction.objectStore('nastaveni');
      const settingKeys = settings.getAllKeys();
      const settingValues = settings.getAll();
      transaction.onabort = () => reject(transaction.error ?? new Error('Čtení původní databáze bylo přerušeno.'));
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        const snapshot = Object.fromEntries(requests.map(([name, request]) => [name, request.result]));
        snapshot.nastaveni = settingKeys.result.map((key, index) => ({ key, value: settingValues.result[index] }));
        resolve(snapshot as LegacySnapshot);
      };
    });
  } finally { db.close(); }
}
