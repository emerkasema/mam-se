import assert from 'node:assert/strict';
import test from 'node:test';
import { maxMutationSize, PositiveInt } from '@evolu/common';
import { mapLegacySnapshot, restoreLegacySnapshot } from '../../src/data/mapping.ts';
import { mappingFixture } from '../fixtures/mapping.ts';

const sizes = { getMutationSize: () => PositiveInt.orThrow(100) };
test('all six stores roundtrip with optional and unknown fields and explicit settings keys', async () => {
  const input = mappingFixture();
  delete input.zaznamy[1]!.fotka;
  const original = structuredClone(input);
  const writes = await mapLegacySnapshot(input, sizes);
  assert.deepEqual(input, original);
  assert.deepEqual(await restoreLegacySnapshot(writes, sizes), original);
  assert.equal(writes.filter((row) => row.table === 'entry').length, 3);
  assert.ok(
    writes.some((row) => row.table === 'setting' && row.values.legacyKey.includes('tvar_osloveni')),
  );
  assert.deepEqual(await mapLegacySnapshot(original, sizes), writes);
});

test('rejects malformed known fields, lossy JSON, duplicate keys and unsupported settings keys', async () => {
  const mutations = [
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy[0]!.prijemnost = 99;
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy[0]!.vytvoreno = '2026-02-30T10:00:00Z';
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy[0]!.cinnost = 'práce';
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy[0]!.extra = undefined;
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy[0]!.extra = new Date();
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy[0]!.extra = new Array(3);
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy[0]!.fotka = 'https://example.invalid/photo';
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.dny[0]!.datum = '2026-02-30';
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.tydny[1]!.who5 = { odpovedi: [6, 1, 2, 3, 4] };
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.nastaveni[0]!.value = { pripominka_zapnuta: 'ano' };
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.nastaveni[0]!.key = 1;
    },
    (s: ReturnType<typeof mappingFixture>) => {
      s.zaznamy.push(s.zaznamy[0]!);
    },
    (s: ReturnType<typeof mappingFixture>) => {
      Object.assign(s, { foreignStore: [] });
    },
  ];
  for (const mutate of mutations) {
    const input = mappingFixture();
    mutate(input);
    await assert.rejects(mapLegacySnapshot(input, sizes), Error);
  }
});

test('checks every resulting mutation limit and rejects inconsistent reverse mapping', async () => {
  const input = mappingFixture();
  await assert.rejects(
    mapLegacySnapshot(input, { getMutationSize: () => PositiveInt.orThrow(maxMutationSize + 1) }),
    /limit/,
  );
  const writes = await mapLegacySnapshot(input, sizes);
  const entry = writes.find((row) => row.table === 'entry')!;
  if (entry.table === 'entry') Object.assign(entry.values, { startedAt: 'bad' });
  await assert.rejects(restoreLegacySnapshot(writes, sizes), Error);
});

test('rejects hidden collection content and accessors instead of dropping them', async () => {
  for (const alter of [
    (s: ReturnType<typeof mappingFixture>) => {
      Object.assign(s.zaznamy, { extra: 'lost' });
    },
    (s: ReturnType<typeof mappingFixture>) => {
      Object.assign(s, { [Symbol('extra')]: 'lost' });
    },
    (s: ReturnType<typeof mappingFixture>) => {
      Object.defineProperty(s.zaznamy[0], 'extra', { get: () => 'lost', enumerable: true });
    },
  ]) {
    const snapshot = mappingFixture();
    alter(snapshot);
    await assert.rejects(mapLegacySnapshot(snapshot, sizes));
  }
});

test('preserves additional JSON setting values and rejects dangerous top-level record keys', async () => {
  const input = mappingFixture();
  input.nastaveni.push(
    { key: 'scalar', value: false },
    { key: 'array', value: [1, null, 'x'] },
    { key: 'null', value: null },
  );
  assert.deepEqual(
    await restoreLegacySnapshot(await mapLegacySnapshot(input, sizes), sizes),
    input,
  );
  input.zaznamy[0] = JSON.parse(
    JSON.stringify(input.zaznamy[0]).replace('"typ":', '"__proto__":{},"typ":'),
  );
  await assert.rejects(mapLegacySnapshot(input, sizes), /klíč/);
});

test('reverse mapping refuses unprojected or deleted rows and orphan setting fields', async () => {
  for (const alter of [
    (writes: Awaited<ReturnType<typeof mapLegacySnapshot>>) => {
      Object.assign(writes[0]!.values, { isDeleted: 1 });
    },
    (writes: Awaited<ReturnType<typeof mapLegacySnapshot>>) => {
      const index = writes.findIndex(
        (w) =>
          w.table === 'setting' &&
          JSON.parse(w.values.payload).storeKey === 'hlavni' &&
          !Object.hasOwn(JSON.parse(w.values.payload), 'field'),
      );
      writes.splice(index, 1);
    },
  ]) {
    const writes = await mapLegacySnapshot(mappingFixture(), sizes);
    alter(writes);
    await assert.rejects(restoreLegacySnapshot(writes, sizes));
  }
});
