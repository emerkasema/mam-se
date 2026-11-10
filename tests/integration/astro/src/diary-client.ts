import { Json, NonNegativeInt, type Query } from '@evolu/common';
import { initializeDiaryClient } from '../../../../src/data/client.ts';
import { mapLegacySnapshot, restoreLegacySnapshot } from '../../../../src/data/mapping.ts';
import { createRowId, type DiarySchema, type schema } from '../../../../src/data/schema.ts';
import { mappingFixture, photoBase64 } from '../../../fixtures/mapping.ts';

const status = document.querySelector('#status')!;
try {
  const client = await initializeDiaryClient();
  // Pouze testovací root: raw SQL slouží k injekci chyby SQLite v syntetické DB.
  // Produkční adaptér má používat writeBatch, ne přímé mutace na evolu.
  const raw = (sql: string) =>
    client.evolu.loadQuery(JSON.stringify([sql, [], []]) as Query<DiarySchema>);
  const day = (key: string, payload = '{}') => ({
    table: 'day' as const,
    values: {
      id: createRowId('day', key),
      legacyKey: key,
      payload: Json.orThrow(payload),
    },
  });
  Object.assign(window, {
    diary: {
      client,
      raw,
      day,
      createRowId,
      mapLegacySnapshot,
      restoreLegacySnapshot,
      mappingFixture,
      photoBase64,
      zero: NonNegativeInt.orThrow(0),
    },
  });
  status.textContent = client.persistence;
} catch (error) {
  status.textContent = error instanceof Error ? error.message : 'error';
}

declare global {
  interface Window {
    diary: {
      mapLegacySnapshot: typeof mapLegacySnapshot;
      restoreLegacySnapshot: typeof restoreLegacySnapshot;
      mappingFixture: typeof mappingFixture;
      photoBase64: typeof photoBase64;
      client: Awaited<ReturnType<typeof initializeDiaryClient>>;
      raw: (sql: string) => Promise<unknown>;
      day: (
        key: string,
        payload?: string,
      ) => {
        table: 'day';
        values: {
          id: typeof schema.day.id.Output;
          legacyKey: string;
          payload: Json;
        };
      };
      createRowId: typeof createRowId;
      zero: typeof NonNegativeInt.Output;
    };
  }
}
