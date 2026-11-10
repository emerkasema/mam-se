import { type Evolu, Json, maxMutationSize, NonNegativeInt, object } from '@evolu/common';
import {
  asObject,
  assertSafeJson,
  checkRange,
  checkTime,
  type LegacyObject,
  legacyCollections,
  requireString,
} from './backup.ts';
import type { BatchWrite } from './batch.ts';
import type { LegacySnapshot } from './legacy.ts';
import { joinPhoto, type PhotoReference, splitPhoto } from './photos.ts';
import { createRowId, type DiarySchema, schema } from './schema.ts';

type MutationSizer = Pick<Evolu<DiarySchema>, 'getMutationSize'>;
const validators = {
  entry: object(schema.entry),
  day: object(schema.day),
  week: object(schema.week),
  setting: object(schema.setting),
  consent: object(schema.consent),
  recommendation: object(schema.recommendation),
  photoChunk: object(schema.photoChunk),
  _migration: object(schema._migration),
};
const collections = {
  zaznamy: ['entry', 'id'],
  dny: ['day', 'datum'],
  tydny: ['week', 'tyden'],
  souhlasy: ['consent', 'id'],
  doporuceni: ['recommendation', 'co'],
} as const;

function invalid(field: string): never {
  throw new Error(`Neplatné pole ${field}; převod byl zastaven bez zápisu.`);
}
function text(value: unknown, field: string) {
  if (typeof value !== 'string') invalid(field);
}
function boolean(value: unknown, field: string) {
  if (typeof value !== 'boolean') invalid(field);
}
function optional(
  row: LegacyObject,
  fields: string[],
  validate: (value: unknown, field: string) => void,
) {
  for (const field of fields)
    if (Object.hasOwn(row, field) && row[field] !== null) validate(row[field], field);
}
function range(min: number, max: number) {
  return (value: unknown, field: string) => checkRange(value, field, min, max);
}
function integer(value: unknown, field: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(field);
}
function date(value: unknown, field: string) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString().slice(0, 10) !== value
  )
    invalid(field);
}
function strings(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) invalid(field);
}
function record(value: unknown, field: string): LegacyObject {
  try {
    return asObject(value);
  } catch {
    return invalid(field);
  }
}

// Rozsahy vycházejí ze sestavZaznam, ulozVecer, ulozOslavu a tydenUlozit.
// Neznámé JSON položky zachováváme celé. Neprovádíme převody typů ani defaulty:
// chybějící položka musí po návratu zůstat chybějící, null musí zůstat null.
function validateRecord(collection: keyof typeof collections, row: LegacyObject) {
  const key = row[collections[collection][1]];
  requireString(key, collection);
  optional(row, ['vytvoreno', 'upraveno', 'kdy'], checkTime);
  if (collection === 'zaznamy') {
    if (!['okamzity', 'vecerni', 'oslava'].includes(String(row.typ))) invalid('typ');
    checkTime(row.vytvoreno, 'vytvoreno');
    checkTime(row.chvile_od, 'chvile_od');
    optional(row, ['prijemnost'], range(-3, 3));
    optional(row, ['smysluplnost'], range(0, 6));
    optional(row, ['chvile_delka_min'], range(0, Number.MAX_SAFE_INTEGER));
    optional(row, ['poradi'], integer);
    optional(
      row,
      [
        'vlastni_slova',
        'strategie',
        'prosba',
        'popis_bloku',
        'podekovani',
        'kde',
        'verze_protokolu',
      ],
      text,
    );
    optional(row, ['zdroj_textu'], (value, field) => {
      if (!['psano', 'diktovano', 'obe'].includes(String(value))) invalid(field);
    });
    optional(row, ['cinnost', 's_kym'], strings);
    for (const [field, label] of [
      ['emoce', 'slovo'],
      ['telo', 'pocit'],
      ['potreby', 'potreba'],
    ] as const) {
      if (!Array.isArray(row[field])) invalid(field);
      for (const item of row[field]) {
        const part = record(item, field);
        requireString(part[label], `${field}.${label}`);
        optional(part, ['intenzita'], range(1, 6));
        optional(part, ['naplneni'], range(0, 4));
        optional(part, ['zakladni', 'skupina', 'smer', 'pod_tim', 'kde', 'upresneni'], text);
        optional(part, ['skripnuta'], boolean);
      }
    }
    if (row.vyzkum != null)
      for (const [field, value] of Object.entries(record(row.vyzkum, 'vyzkum')))
        checkRange(value, `vyzkum.${field}`, 0, 6);
  }
  if (collection === 'dny') {
    date(key, 'datum');
    optional(row, ['barva', 'poznamka'], text);
    optional(row, ['vecerni_hotovo'], boolean);
  }
  if (collection === 'tydny') {
    if (!/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(key)) invalid('tyden');
    optional(row, ['od', 'do'], date);
    optional(row, ['odlozeno', 'vyplneno'], boolean);
    optional(row, ['barva', 'vzpominka', 'tema', 'dal', 'verze_aplikace'], text);
    optional(row, ['minuty'], range(0, Number.MAX_SAFE_INTEGER));
    optional(row, ['pocet_zaznamu'], integer);
    if (row.podily != null) {
      const shares = record(row.podily, 'podily');
      for (const field of ['prijemny', 'neutralni', 'neprijemny']) {
        if (shares[field] == null) invalid(`podily.${field}`);
        checkRange(shares[field], field, 0, 100);
      }
    }
    if (row.who5 != null) {
      const score = record(row.who5, 'who5');
      if (
        !Array.isArray(score.odpovedi) ||
        score.odpovedi.length !== 5 ||
        score.odpovedi.some((value) => !Number.isInteger(value) || value < 0 || value > 5)
      )
        invalid('who5.odpovedi');
      const sum = score.odpovedi.reduce((a: number, b: number) => a + b, 0);
      if (
        score.hruby !== sum ||
        score.index !== sum * 4 ||
        score.nizky !== (sum < 13 || score.odpovedi.some((v) => v <= 1))
      )
        invalid('who5');
    }
  }
  if (collection === 'doporuceni') optional(row, ['stav'], text);
}
function validateSettings(value: LegacyObject) {
  optional(
    value,
    [
      'prvni_spusteni_hotovo',
      'pripominka_zapnuta',
      'barva_dne_zapnuta',
      'barva_tydne_zapnuta',
      'chronicka_bolest',
      'souhrn_zapnut',
    ],
    boolean,
  );
  optional(value, ['pripominka_cas'], (v, field) => {
    if (typeof v !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v)) invalid(field);
  });
  optional(value, ['tvar_osloveni'], (v, field) => {
    if (!['oba', 'zensky', 'muzsky'].includes(String(v))) invalid(field);
  });
  optional(value, ['kod_ucastnika', 'verze_aplikace'], text);
  optional(value, ['duveryhodne_kontakty'], (v, field) => {
    if (!Array.isArray(v)) invalid(field);
    for (const item of v) {
      const contact = record(item, field);
      text(contact.jmeno, 'jmeno');
      text(contact.hodnota, 'hodnota');
      if (!['telefon', 'email'].includes(String(contact.zpusob))) invalid('zpusob');
    }
  });
}

async function validatePhoto(photo: Blob) {
  // MIME ani hash neprokazují obrázek. Dekódování je browser API; mimo browser
  // fotku odmítneme, nikoli přeskočíme kontrolu. Původní bajty se nepřekreslují.
  if (typeof createImageBitmap !== 'function')
    throw new Error('Fotku musí ověřit prohlížeč s dekodérem obrázků.');
  try {
    const bitmap = await createImageBitmap(photo);
    const valid = bitmap.width > 0 && bitmap.height > 0;
    bitmap.close();
    if (!valid) invalid('fotka');
  } catch {
    throw new Error('Fotku nelze dekódovat; převod byl zastaven bez zápisu.');
  }
}

function checkWrites(writes: readonly BatchWrite[], evolu: MutationSizer) {
  const seen = new Set<string>();
  for (const write of writes) {
    if (
      !write ||
      !Object.hasOwn(schema, write.table) ||
      !validators[write.table].fromUnknown(write.values).ok
    )
      invalid('Evolu řádek');
    const key = `${write.table}:${write.values.id}`;
    if (seen.has(key)) invalid('duplicitní ID');
    seen.add(key);
    if (evolu.getMutationSize(write.table, write.values) > maxMutationSize)
      throw new Error('Zápis překračuje limit Evolu. Obsah nebyl zkrácen ani odeslán.');
  }
}

// Čistá příprava bez DB zápisů; writer musí i nadále ověřit dávku před odesláním.
// Toto není prepareImport: nevstupuje sem JSON záloha ani data URL fotky.
export function copyLegacySnapshot(input: LegacySnapshot): LegacySnapshot {
  const sourceSnapshot = record(input, 'snapshot');
  if (
    Reflect.ownKeys(sourceSnapshot).length !== 6 ||
    [...legacyCollections, 'nastaveni'].some((key) => !Object.hasOwn(sourceSnapshot, key))
  )
    invalid('stores');
  // Nejdřív ověříme strukturované hodnoty a pořídíme vlastní snapshot. Během
  // hashování/dekódování nesmí volající změnit pozdější řádky nebo nastavení.
  for (const name of [...legacyCollections, 'nastaveni']) {
    const descriptor = Object.getOwnPropertyDescriptor(sourceSnapshot, name);
    if (!descriptor?.enumerable || !('value' in descriptor)) invalid(name);
    const rows = sourceSnapshot[name];
    if (
      !Array.isArray(rows) ||
      Object.getPrototypeOf(rows) !== Array.prototype ||
      Reflect.ownKeys(rows).length !== rows.length + 1
    )
      invalid(name);
    for (let i = 0; i < rows.length; i++) {
      const itemDescriptor = Object.getOwnPropertyDescriptor(rows, String(i));
      if (!itemDescriptor?.enumerable || !('value' in itemDescriptor)) invalid(name);
      const row = record(itemDescriptor.value, name);
      for (const key of Reflect.ownKeys(row)) {
        const property = Object.getOwnPropertyDescriptor(row, key);
        if (typeof key !== 'string' || !property?.enumerable || !('value' in property))
          invalid(name);
        if (name === 'zaznamy' && key === 'fotka' && property.value instanceof Blob) continue;
        assertSafeJson(property.value);
      }
    }
  }
  return structuredClone(input);
}

export async function mapLegacySnapshot(
  input: LegacySnapshot,
  evolu: MutationSizer,
): Promise<BatchWrite[]> {
  const snapshot = copyLegacySnapshot(input);
  const writes: BatchWrite[] = [];
  const photos = new Map<string, BatchWrite>();
  for (const collection of legacyCollections) {
    const rows = snapshot[collection];
    if (!Array.isArray(rows)) invalid(collection);
    const [table, keyField] = collections[collection];
    for (const value of rows) {
      const source = record(value, collection);
      // Blob lze uložit jen v deklarovaném poli fotka; jiný binární/ne-JSON
      // obsah odmítáme s chybou místo jeho tiché změny při JSON.stringify.
      const photo = collection === 'zaznamy' && source.fotka instanceof Blob ? source.fotka : null;
      const data = { ...source };
      if (photo) delete data.fotka;
      assertSafeJson(data);
      validateRecord(collection, data);
      let reference: PhotoReference | undefined;
      if (collection === 'zaznamy' && data.fotka != null) invalid('fotka (očekáván Blob)');
      if (photo) {
        const split = await splitPhoto(photo);
        await validatePhoto(photo);
        reference = split.reference;
        for (const chunk of split.chunks) {
          const key = `${chunk.hash}:${chunk.index}`;
          photos.set(key, {
            table: 'photoChunk',
            values: {
              id: createRowId('photoChunk', key),
              ...chunk,
              index: NonNegativeInt.orThrow(chunk.index),
            },
          });
        }
      }
      const key = data[keyField] as string;
      const values = {
        id: createRowId(table, key),
        legacyKey: key,
        payload: Json.orThrow(
          JSON.stringify({ record: data, ...(reference ? { photo: reference } : {}) }),
        ),
      };
      writes.push(
        table === 'entry'
          ? {
              table,
              values: {
                ...values,
                id: createRowId('entry', key),
                startedAt: data.chvile_od as string,
              },
            }
          : ({ table, values } as BatchWrite),
      );
    }
  }
  if (!Array.isArray(snapshot.nastaveni)) invalid('nastaveni');
  for (const item of snapshot.nastaveni) {
    const pair = record(item, 'nastaveni');
    assertSafeJson(pair);
    if (
      Object.keys(pair).length !== 2 ||
      !Object.hasOwn(pair, 'key') ||
      !Object.hasOwn(pair, 'value')
    )
      invalid('nastaveni');
    // Původní aplikace používá řetězcové klíče; jiné IDB klíče hlásíme jako
    // nekompatibilní, nikdy je nekolidujícím způsobem nepřetypujeme na text.
    if (typeof pair.key !== 'string') invalid('nastaveni.key (podporován řetězec)');
    const isObject =
      pair.value !== null && typeof pair.value === 'object' && !Array.isArray(pair.value);
    if (pair.key === 'hlavni') validateSettings(record(pair.value, 'nastaveni.value'));
    const value = isObject ? record(pair.value, 'nastaveni.value') : null;
    const add = (field: string | null, content?: unknown) => {
      const key = JSON.stringify([pair.key, field]);
      writes.push({
        table: 'setting',
        values: {
          id: createRowId('setting', key),
          legacyKey: key,
          payload: Json.orThrow(
            JSON.stringify(
              field === null
                ? value === null
                  ? { storeKey: pair.key, value: pair.value }
                  : { storeKey: pair.key }
                : { storeKey: pair.key, field, value: content },
            ),
          ),
        },
      });
    };
    // Marker uchová i prázdný objekt, jednotlivé položky mají vlastní Evolu ID.
    add(null);
    if (value !== null) for (const [field, content] of Object.entries(value)) add(field, content);
  }
  writes.push(...photos.values());
  checkWrites(writes, evolu);
  return writes;
}

// Volající promítne živé DB řádky na sloupce schématu (bez systémových
// metadat Evolu). Mazání a čtení dotazů zůstává úkolem budoucího adaptéru.
export async function restoreLegacySnapshot(
  writes: readonly BatchWrite[],
  evolu: MutationSizer,
): Promise<LegacySnapshot> {
  checkWrites(writes, evolu);
  writes = structuredClone(writes);
  const result: LegacySnapshot = {
    zaznamy: [],
    dny: [],
    tydny: [],
    souhlasy: [],
    doporuceni: [],
    nastaveni: [],
  };
  const settings = new Map<string, unknown>();
  const chunks = writes
    .filter((w) => w.table === 'photoChunk')
    .map((w) => ({ ...w.values, bytes: new Uint8Array(w.values.bytes) }));
  for (const write of writes) {
    if (write.table === 'photoChunk') continue;
    if (write.table === '_migration') invalid('tabulka _migration není deník');
    const payload = record(JSON.parse(write.values.payload), 'payload');
    if (write.table === 'setting') {
      if (typeof payload.storeKey !== 'string') invalid('storeKey');
      if (!Object.hasOwn(payload, 'field')) {
        if (settings.has(payload.storeKey)) invalid('nastaveni marker');
        settings.set(payload.storeKey, Object.hasOwn(payload, 'value') ? payload.value : {});
      }
      continue;
    }
    const collection = legacyCollections.find((key) => collections[key][0] === write.table);
    if (!collection) invalid('tabulka');
    const row = record(payload.record, 'record');
    if (payload.photo !== undefined) {
      if (write.table !== 'entry' || Object.hasOwn(row, 'fotka')) invalid('fotka');
      const reference = payload.photo as PhotoReference;
      row.fotka = await joinPhoto(
        reference,
        chunks.filter((chunk) => chunk.hash === reference.hash),
      );
    }
    result[collection].push(row);
  }
  for (const write of writes) {
    if (write.table !== 'setting') continue;
    const payload = record(JSON.parse(write.values.payload), 'setting');
    if (!Object.hasOwn(payload, 'field')) continue;
    const value = record(settings.get(payload.storeKey as string), 'nastaveni objekt');
    if (typeof payload.field !== 'string' || Object.hasOwn(value, payload.field))
      invalid('nastaveni položka');
    Object.defineProperty(value, payload.field, {
      value: payload.value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  result.nastaveni = Array.from(settings, ([key, value]) => ({ key, value }));
  // Znovu vytvořená sada musí přesně souhlasit: zachytí cizí obálky, osiřelé
  // chunky, změněná ID, startedAt i ztracené položky. Pořadí DB řádků nerozhoduje.
  const expected = await mapLegacySnapshot(result, evolu);
  const byId = new Map(writes.map((write) => [`${write.table}:${write.values.id}`, write]));
  if (
    expected.length !== writes.length ||
    expected.some((write) => {
      const actual = byId.get(`${write.table}:${write.values.id}`);
      return (
        !actual ||
        Object.entries(write.values).some(([key, value]) => {
          const stored = (actual.values as unknown as LegacyObject)[key];
          return value instanceof Uint8Array
            ? !(stored instanceof Uint8Array) ||
                value.length !== stored.length ||
                value.some((byte, i) => byte !== stored[i])
            : value !== stored;
        })
      );
    })
  )
    invalid('nesouhlasí zpětné mapování');
  return result;
}
