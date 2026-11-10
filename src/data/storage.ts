import { createQueryBuilder, getOrThrow } from '@evolu/common';
import {
  exportSnapshot,
  type LegacyCollection,
  type LegacyObject,
  legacyCollections,
  prepareImport,
  shouldReplace,
} from './backup.ts';
import type { BatchChange, BatchWrite } from './batch.ts';
import { initializeDiaryClient } from './client.ts';
import { forgetOwnerSecret } from './identity.ts';
import type { LegacySnapshot } from './legacy.ts';
import { copyLegacySnapshot, mapLegacySnapshot, restoreLegacySnapshot } from './mapping.ts';
import { schema } from './schema.ts';

export const appVersion = '0.7.0';
export const defaultSettings = {
  prvni_spusteni_hotovo: false,
  pripominka_zapnuta: false,
  pripominka_cas: '19:30',
  barva_dne_zapnuta: true,
  barva_tydne_zapnuta: true,
  duveryhodne_kontakty: [],
  chronicka_bolest: false,
  tvar_osloveni: 'oba',
  souhrn_zapnut: false,
  kod_ucastnika: null,
  verze_aplikace: appVersion,
};
const collections = {
  zaznamy: 'id',
  dny: 'datum',
  tydny: 'tyden',
  souhlasy: 'id',
  doporuceni: 'co',
} as const;
const tables = [
  'entry',
  'day',
  'week',
  'setting',
  'consent',
  'recommendation',
  'photoChunk',
] as const;
const emptySnapshot = (): LegacySnapshot => ({
  zaznamy: [],
  dny: [],
  tydny: [],
  souhlasy: [],
  doporuceni: [],
  nastaveni: [],
});
const createQuery = createQueryBuilder(schema);

interface LocalControl {
  epoch: string;
  resetting: boolean;
}
// Tento malý stav musí přežít smazání Evolu DB a její identity. Rozpracovaný
// reset se dokončí při příštím startu; další karta nesmí zapsat pod starou identitou.
async function localControl(next?: LocalControl): Promise<LocalControl> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mamse-storage', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('control');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    return await new Promise<LocalControl>((resolve, reject) => {
      const tx = db.transaction('control', 'readwrite');
      const store = tx.objectStore('control');
      let value: LocalControl;
      const request = store.get('state');
      request.onsuccess = () => {
        value = next ?? request.result ?? { epoch: crypto.randomUUID(), resetting: false };
        if (typeof value.epoch !== 'string' || typeof value.resetting !== 'boolean') {
          tx.abort();
          return;
        }
        store.put(value, 'state');
      };
      tx.oncomplete = () => resolve(value);
      tx.onabort = () => reject(tx.error ?? new Error('Místní stav deníku je poškozený.'));
    });
  } finally {
    db.close();
  }
}

export async function initializeStorage() {
  return navigator.locks.request('mam-se:storage', async () => {
    let control = await localControl();
    let client = await initializeDiaryClient();
    if (control.resetting) {
      // Obnovujeme jen nedokončený reset, nikdy původní deník z legacy DB.
      getOrThrow(await client.evolu.deleteDatabase());
      await client.close();
      await forgetOwnerSecret();
      control = { epoch: control.epoch, resetting: false };
      await localControl(control);
      client = await initializeDiaryClient();
    }
    const epoch = control.epoch;
    let stopped = false;
    async function locked<T>(work: () => Promise<T>): Promise<T> {
      return navigator.locks.request('mam-se:storage', async () => {
        const state = await localControl();
        if (stopped || state.resetting || state.epoch !== epoch)
          throw new Error('Deník byl uzavřen nebo vymazán v jiné kartě. Obnov stránku.');
        return work();
      });
    }
    async function rows(): Promise<BatchWrite[]> {
      const writes: BatchWrite[] = [];
      for (const table of tables) {
        // Čteme jen živé řádky. Systémové sloupce Evolu nejsou součástí mapperu.
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const result = await Promise.race([
            client.evolu.loadQuery(
              createQuery((db) => db.selectFrom(table).selectAll().where('isDeleted', 'is not', 1)),
            ),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => {
                stopped = true;
                reject(new Error('Načtení úložiště vypršelo. Obnov stránku.'));
              }, 15_000);
            }),
          ]);
          for (const row of result) {
            const values = Object.fromEntries(
              Object.keys(schema[table]).map((key) => [key, (row as Record<string, unknown>)[key]]),
            );
            writes.push({ table, values } as BatchWrite);
          }
        } finally {
          clearTimeout(timer);
        }
      }
      return writes;
    }
    async function read() {
      return restoreLegacySnapshot(await rows(), client.evolu);
    }
    async function replace(snapshot: LegacySnapshot, previous: BatchWrite[]) {
      // Celý nový stav připravíme před zápisem. Diff navíc smaže osiřelé chunky
      // a odstraněné položky nastavení; sdílená fotka ostatních záznamů zůstane.
      const next = await mapLegacySnapshot(snapshot, client.evolu);
      const key = (w: BatchWrite) => `${w.table}:${w.values.id}`;
      const old = new Map(previous.map((w) => [key(w), w]));
      const keep = new Set(next.map(key));
      const changes: BatchChange[] = next.filter((w) => {
        const before = old.get(key(w));
        if (!before) return true;
        return Object.entries(w.values).some(([field, value]) => {
          const stored = (before.values as unknown as LegacyObject)[field];
          return value instanceof Uint8Array
            ? !(stored instanceof Uint8Array) ||
                value.length !== stored.length ||
                value.some((b, i) => b !== stored[i])
            : value !== stored;
        });
      });
      for (const oldRow of previous)
        if (!keep.has(key(oldRow)))
          changes.push({ table: oldRow.table, delete: oldRow.values.id } as BatchChange);
      try {
        await client.writeBatch(changes);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
    async function mutate<T>(change: (snapshot: LegacySnapshot) => T | Promise<T>): Promise<T> {
      return locked(async () => {
        const previous = await rows();
        const snapshot = await restoreLegacySnapshot(previous, client.evolu);
        const result = await change(snapshot);
        await replace(snapshot, previous);
        return result;
      });
    }
    function put(snapshot: LegacySnapshot, collection: LegacyCollection, row: LegacyObject) {
      const key = collections[collection];
      const index = snapshot[collection].findIndex((item) => item[key] === row[key]);
      if (index === -1) snapshot[collection].push(row);
      else snapshot[collection][index] = row;
      return row[key];
    }
    const save = (collection: LegacyCollection, row: LegacyObject) => {
      const copy = copyLegacySnapshot({ ...emptySnapshot(), [collection]: [row] })[
        collection
      ][0] as LegacyObject;
      return mutate((snapshot) => put(snapshot, collection, copy));
    };
    const find = (collection: LegacyCollection, key: string) =>
      locked(async () =>
        (await read())[collection].find((row) => row[collections[collection]] === key),
      );
    const all = (collection: LegacyCollection) =>
      locked(async () =>
        (await read())[collection].sort((a, b) =>
          String(a[collections[collection]]).localeCompare(String(b[collections[collection]])),
        ),
      );
    const remove = (collection: LegacyCollection, key: string) =>
      mutate((snapshot) => {
        snapshot[collection] = snapshot[collection].filter(
          (row) => row[collections[collection]] !== key,
        );
      });
    return {
      getSnapshot: () => locked(read),
      getEntry: (id: string) => find('zaznamy', id),
      getEntries: () => all('zaznamy'),
      saveEntry: (row: LegacyObject) => save('zaznamy', row),
      deleteEntry: (id: string) => remove('zaznamy', id),
      getEntriesSince: (date: Date) =>
        locked(async () =>
          (await read()).zaznamy.filter((row) => new Date(row.chvile_od as string) >= date),
        ),
      getDay: (date: string) => find('dny', date),
      saveDay: (row: LegacyObject) => save('dny', row),
      getWeek: (week: string) => find('tydny', week),
      getWeeks: () => all('tydny'),
      saveWeek: (row: LegacyObject) => save('tydny', row),
      getRecommendations: () => all('doporuceni'),
      dismissRecommendation: (key: string, state: string) =>
        save('doporuceni', { co: key, stav: state, kdy: timestamp() }),
      restoreRecommendation: (key: string) => remove('doporuceni', key),
      getSettings: () =>
        locked(async () => ({
          ...structuredClone(defaultSettings),
          ...((await read()).nastaveni.find((s) => s.key === 'hlavni')?.value as
            | LegacyObject
            | undefined),
        })),
      saveSettings: (value: LegacyObject) => {
        const copy = copyLegacySnapshot({
          ...emptySnapshot(),
          nastaveni: [{ key: 'hlavni', value }],
        }).nastaveni.at(0)?.value;
        return mutate((snapshot) => {
          const existing = snapshot.nastaveni.find((s) => s.key === 'hlavni');
          if (existing) existing.value = copy;
          else snapshot.nastaveni.push({ key: 'hlavni', value: copy });
        });
      },
      saveEveningBatch: (entries: LegacyObject[], day: LegacyObject, deleted: string[]) => {
        const captured = copyLegacySnapshot({ ...emptySnapshot(), zaznamy: entries, dny: [day] });
        const copy = {
          entries: captured.zaznamy,
          day: captured.dny[0] as LegacyObject,
          deleted: [...deleted],
        };
        return mutate((snapshot) => {
          snapshot.zaznamy = snapshot.zaznamy.filter(
            (row) => !copy.deleted.includes(row.id as string),
          );
          for (const row of copy.entries) put(snapshot, 'zaznamy', row);
          put(snapshot, 'dny', copy.day);
        });
      },
      exportBackup: () => locked(async () => exportSnapshot(await read())),
      importBackup: async (input: unknown) => {
        // Příprava je nezávislá na existujících datech, nikdy nezapisuje. Merge
        // se provede znovu nad aktuálním stavem pod zámkem všech nových karet.
        const incoming = await prepareImport(input, client.evolu);
        return mutate((snapshot) => {
          let added = 0;
          for (const row of incoming.zaznamy) {
            const current = snapshot.zaznamy.find((item) => item.id === row.id);
            if (!current || shouldReplace(current, row)) {
              put(snapshot, 'zaznamy', row);
              if (!current) added++;
            }
          }
          for (const collection of legacyCollections)
            if (collection !== 'zaznamy')
              for (const row of incoming[collection]) put(snapshot, collection, row);
          for (const setting of incoming.nastaveni) {
            const old = snapshot.nastaveni.find((s) => s.key === setting.key);
            if (old) old.value = setting.value;
            else snapshot.nastaveni.push(setting);
          }
          return added;
        });
      },
      resetStorage: () =>
        locked(async () => {
          const next = { epoch: crypto.randomUUID(), resetting: true };
          await localControl(next);
          stopped = true;
          getOrThrow(await client.evolu.deleteDatabase());
          await client.close();
          await forgetOwnerSecret();
          await localControl({ ...next, resetting: false });
        }),
      close: async () => {
        stopped = true;
        await client.close();
      },
    };
  });
}
let storage: ReturnType<typeof initializeStorage> | undefined;
export function getStorage() {
  storage ??= initializeStorage();
  return storage;
}
export function timestamp(date = new Date()): string {
  const offset = -date.getTimezoneOffset();
  const pair = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return `${date.getFullYear()}-${pair(date.getMonth() + 1)}-${pair(date.getDate())}T${pair(date.getHours())}:${pair(date.getMinutes())}:${pair(date.getSeconds())}${offset >= 0 ? '+' : '-'}${pair(offset / 60)}:${pair(offset % 60)}`;
}
export function dayDate(date = new Date()) {
  return timestamp(date).slice(0, 10);
}
export function newId() {
  return crypto.randomUUID();
}
