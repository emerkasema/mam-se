import {
  Uint8Array as Bytes,
  createIdFromString,
  id,
  Json,
  NonNegativeInt,
  String as Text,
} from '@evolu/common';

// JSON je jedna konfliktní jednotka. Ověření doménových polí a legacy mapování
// patří budoucímu adaptéru; samotné platné JSON ještě není platný záznam deníku.
export const schema = {
  entry: { id: id('Entry'), legacyKey: Text, payload: Json, startedAt: Text },
  day: { id: id('Day'), legacyKey: Text, payload: Json },
  week: { id: id('Week'), legacyKey: Text, payload: Json },
  setting: { id: id('Setting'), legacyKey: Text, payload: Json },
  consent: { id: id('Consent'), legacyKey: Text, payload: Json },
  recommendation: { id: id('Recommendation'), legacyKey: Text, payload: Json },
  photoChunk: { id: id('PhotoChunk'), hash: Text, index: NonNegativeInt, bytes: Bytes },
  // Podtržítko má v Evolu význam: marker se nikdy nesynchronizuje.
  _migration: { id: id('Migration'), payload: Json },
};
export type DiarySchema = typeof schema;
export type TableName = keyof DiarySchema;

export function createRowId<T extends TableName>(table: T, key: string) {
  return schema[table].id.orThrow(createIdFromString(`mamse:v1:${table}:${key}`));
}
