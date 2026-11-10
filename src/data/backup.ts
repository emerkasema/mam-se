// České klíče jsou přenosový kontrakt záloh 0.7.0, nikoliv nové schéma Evolu.
export type LegacyObject = Record<string, unknown>;
export const legacyCollections = ['zaznamy', 'dny', 'tydny', 'souhlasy', 'doporuceni'] as const;
export type LegacyCollection = (typeof legacyCollections)[number];
export type LegacyBackup = Record<LegacyCollection, LegacyObject[]> & {
  aplikace: 'Mám se!';
  format_zalohy: 1;
  nastaveni: LegacyObject;
  exportovano?: string;
  verze_aplikace?: string;
};
const dangerousKeys = new Set(['__proto__', 'prototype', 'constructor']);

export function assertSafeJson(value: unknown, depth = 0): void {
  if (depth > 40) throw new Error('Záloha má příliš hlubokou strukturu.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return;
  if (value && typeof value === 'object') {
    // JSON nesmí tiše zahodit symbol, getter, skryté pole ani díru v poli.
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (Array.isArray(value) && key === 'length') continue;
      if (
        typeof key !== 'string' ||
        !descriptor ||
        !descriptor.enumerable ||
        !('value' in descriptor)
      )
        throw new Error('Obsah nelze bezeztrátově uložit jako JSON.');
    }
  }
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length)
      throw new Error('Pole nelze bezeztrátově uložit jako JSON.');
    for (const item of value) assertSafeJson(item, depth + 1);
    return;
  }
  const object = asObject(value);
  for (const [key, item] of Object.entries(object)) {
    if (dangerousKeys.has(key)) throw new Error('Záloha obsahuje nebezpečný klíč.');
    assertSafeJson(item, depth + 1);
  }
}
export function asObject(value: unknown): LegacyObject {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new Error('Záloha obsahuje neplatný objekt.');
  }
  return value as LegacyObject;
}
export function requireString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Neplatné pole ${field}.`);
}
export function checkTime(value: unknown, field: string): void {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(
      value,
    ) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10)
  ) {
    throw new Error(`Neplatné datum ${field}.`);
  }
}
export function checkRange(value: unknown, field: string, min: number, max: number): void {
  if (
    value != null &&
    (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
  ) {
    throw new Error(`Neplatný rozsah ${field}.`);
  }
}

export function validateBackupStructure(input: unknown): LegacyBackup {
  assertSafeJson(input);
  const backup = asObject(input);
  if (backup.aplikace !== 'Mám se!') throw new Error('Tohle není záloha aplikace Mám se!');
  if (backup.format_zalohy !== 1) throw new Error('Nepodporovaná verze zálohy.');
  asObject(backup.nastaveni);
  for (const collection of legacyCollections) {
    const rows = backup[collection];
    if (!Array.isArray(rows)) throw new Error(`Chybí kolekce ${collection}.`);
    const keys = new Set<string>();
    for (const value of rows) {
      const row = asObject(value);
      const key =
        row[
          collection === 'dny'
            ? 'datum'
            : collection === 'tydny'
              ? 'tyden'
              : collection === 'doporuceni'
                ? 'co'
                : 'id'
        ];
      requireString(key, collection);
      if (keys.has(key)) throw new Error(`Duplicitní klíč v ${collection}.`);
      keys.add(key);
      for (const field of ['vytvoreno', 'upraveno', 'kdy'])
        if (row[field] != null) checkTime(row[field], field);
      if (collection === 'zaznamy') {
        checkTime(row.chvile_od, 'chvile_od');
        checkTime(row.vytvoreno, 'vytvoreno');
        if (!['okamzity', 'vecerni', 'oslava'].includes(String(row.typ)))
          throw new Error('Neplatný typ záznamu.');
        checkRange(row.prijemnost, 'prijemnost', -3, 3);
        checkRange(row.smysluplnost, 'smysluplnost', 0, 6);
        checkRange(row.chvile_delka_min, 'chvile_delka_min', 0, Number.MAX_SAFE_INTEGER);
        for (const field of ['emoce', 'telo', 'potreby']) {
          if (!Array.isArray(row[field])) throw new Error(`Neplatné pole ${field}.`);
          for (const item of row[field]) {
            const part = asObject(item);
            checkRange(part.intenzita, 'intenzita', 1, 6);
            checkRange(part.naplneni, 'naplneni', 0, 4);
          }
        }
        if (row.fotka != null) {
          const prefix =
            typeof row.fotka === 'string'
              ? /^data:image\/(jpeg|png|webp);base64,/.exec(row.fotka)
              : null;
          const encoded = prefix ? (row.fotka as string).slice(prefix[0].length) : '';
          // Opakované skupiny regexu přetékají u velkých fotek zásobník. Jediná
          // znaková třída a samostatná kontrola délky nezávisí na hloubce vstupu.
          if (
            !encoded.length ||
            encoded.length % 4 !== 0 ||
            !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)
          ) {
            throw new Error('Neplatná vložená fotka v záloze.');
          }
        }
      }
      if (collection === 'dny' && !/^\d{4}-\d{2}-\d{2}$/.test(key))
        throw new Error('Neplatný den.');
      if (collection === 'tydny' && !/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(key))
        throw new Error('Neplatný týden.');
    }
  }
  // Zatím pouze strukturální validace. Dekódování fotek a velikosti Evolu mutací
  // musí následovat před jakýmkoliv zápisem; návrat není povolením k importu.
  return structuredClone(backup) as LegacyBackup;
}

export function shouldReplace(local: LegacyObject, incoming: LegacyObject): boolean {
  const timestamp = (row: LegacyObject) => {
    const value = row.upraveno ?? row.vytvoreno;
    return typeof value === 'string' ? Date.parse(value) : NaN;
  };
  const localTime = timestamp(local),
    incomingTime = timestamp(incoming);
  return Number.isFinite(localTime) && Number.isFinite(incomingTime) && incomingTime > localTime;
}
