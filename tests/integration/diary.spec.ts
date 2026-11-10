import { expect } from '@playwright/test';
import { test } from './browser.ts';

test('confirmed batch reads all rows and bytes back and survives reload without relay', async ({
  page,
}) => {
  let sockets = 0;
  page.on('websocket', () => sockets++);
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  await page.evaluate(async () => {
    const { client, day, createRowId } = window.diary;
    await client.writeBatch([
      day('synthetic-a', '{"text":"Syntetický den"}'),
      day('synthetic-b'),
      {
        table: 'photoChunk',
        values: {
          id: createRowId('photoChunk', 'test:0'),
          hash: 'a'.repeat(64),
          index: window.diary.zero,
          bytes: new Uint8Array([1, 2, 255]),
        },
      },
      {
        table: '_migration',
        values: { id: createRowId('_migration', 'test'), payload: day('x').values.payload },
      },
    ]);
  });
  await page.reload();
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  expect(
    await page.evaluate(() =>
      window.diary.raw('select "legacyKey", payload from day order by "legacyKey"'),
    ),
  ).toEqual([
    { legacyKey: 'synthetic-a', payload: '{"text":"Syntetický den"}' },
    { legacyKey: 'synthetic-b', payload: '{}' },
  ]);
  expect(sockets).toBe(0);
});

test('invalid last row and oversize last mutation reject the whole batch before sending', async ({
  page,
}) => {
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  const result = await page.evaluate(async () => {
    const { client, day, raw } = window.diary;
    const messages: string[] = [];
    for (const bad of [
      { ...day('bad'), values: { ...day('bad').values, payload: '{broken' } },
      day('large', JSON.stringify('x'.repeat(640_000))),
    ]) {
      try {
        await client.writeBatch([day('must-not-exist'), bad as ReturnType<typeof day>]);
      } catch (error) {
        messages.push((error as Error).message);
      }
    }
    await client.writeBatch([day('valid-after-rejection')]);
    return { messages, rows: await raw('select "legacyKey" from day') };
  });
  expect(result.messages).toHaveLength(2);
  expect(result.rows).toEqual([{ legacyKey: 'valid-after-rejection' }]);
});

test('SQLite failure rolls back earlier insert, update and local marker', async ({ page }) => {
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  const message = await page.evaluate(async () => {
    const { client, day, raw, createRowId } = window.diary;
    await client.writeBatch([day('existing', '{"original":true}')]);
    await raw(
      `create trigger synthetic_failure before insert on day when NEW.legacyKey = 'fail' begin select raise(ABORT, 'synthetic batch failure'); end`,
    );
    try {
      await client.writeBatch([
        {
          table: '_migration',
          values: { id: createRowId('_migration', 'rollback'), payload: day('x').values.payload },
        },
        day('existing', '{"changed":true}'),
        day('before-failure'),
        day('fail'),
        day('after-failure'),
      ]);
      return 'unexpected success';
    } catch (error) {
      return (error as Error).message;
    }
  });
  expect(message).toMatch(/selhalo/);
  await page.reload();
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  expect(await page.evaluate(() => window.diary.raw('select legacyKey, payload from day'))).toEqual(
    [{ legacyKey: 'existing', payload: '{"original":true}' }],
  );
  expect(await page.evaluate(() => window.diary.raw('select * from _migration'))).toEqual([]);
});

test('NotPersisted rejects the diary client instead of returning a memory-only writer', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.storage, 'getDirectory', {
      value: async () => {
        throw new Error('synthetic storage unavailable');
      },
    });
  });
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(
    'Prohlížeč neposkytuje trvalé úložiště. Deník nebyl připojen.',
  );
  expect(await page.evaluate(() => 'diary' in window)).toBe(false);
});

test('closing client rejects pending batches rather than leaving promises waiting', async ({
  page,
}) => {
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  expect(
    await page.evaluate(async () => {
      const { client, day } = window.diary;
      const result = client.writeBatch([day('pending')]).then(
        () => 'success',
        (error: Error) => error.message,
      );
      await client.close();
      return result;
    }),
  ).toMatch(/uzavřeno/);
});

test('identity transaction abort prevents creating Evolu workers and writer', async ({ page }) => {
  const workers: string[] = [];
  page.on('request', (request) => {
    if (/\.worker.*\.js/.test(request.url())) workers.push(request.url());
  });
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      const request = original.apply(this, args);
      if (this.transaction.db.name === 'mamse-identity') {
        const transaction = this.transaction;
        request.addEventListener('success', () => transaction.abort());
      }
      return request;
    };
  });
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(
    'Identitu se nepodařilo trvale uložit. Deník nebyl připojen.',
  );
  expect(await page.evaluate(() => 'diary' in window)).toBe(false);
  expect(workers).toEqual([]);
});

test('raw Evolu calls can commit an earlier row when a later call throws synchronously', async ({
  page,
}) => {
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  const result = await page.evaluate(async () => {
    const { client, day, raw } = window.diary;
    let completed!: () => void;
    const stored = new Promise<void>((resolve) => {
      completed = resolve;
    });
    client.evolu.upsert('day', day('partial').values, { onComplete: completed });
    let threw = false;
    try {
      client.evolu.upsert('day', day('too-large', JSON.stringify('x'.repeat(640_000))).values);
    } catch {
      threw = true;
    }
    await stored;
    return { threw, rows: await raw('select legacyKey from day') };
  });
  expect(result).toEqual({ threw: true, rows: [{ legacyKey: 'partial' }] });
});

test('legacy mapping preserves all stores and a decodable photo through Evolu and reload', async ({
  page,
}) => {
  let sockets = 0;
  page.on('websocket', () => sockets++);
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  await page.evaluate(async () => {
    const { client, mappingFixture, photoBase64, mapLegacySnapshot } = window.diary;
    const input = mappingFixture();
    input.zaznamy[0]!.fotka = new Blob(
      [Uint8Array.from(atob(photoBase64), (c) => c.charCodeAt(0))],
      { type: 'image/png' },
    );
    // Dvě stejné fotky sdílejí chunky, ale mají samostatné reference.
    input.zaznamy[2]!.fotka = input.zaznamy[0]!.fotka;
    const pending = mapLegacySnapshot(input, client.evolu);
    input.zaznamy[1]!.popis_bloku = 'Změna během hashování';
    input.nastaveni.length = 0;
    await client.writeBatch(await pending);
  });
  await page.reload();
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  const result = await page.evaluate(async () => {
    const { client, raw, restoreLegacySnapshot, mappingFixture, photoBase64 } = window.diary;
    const writes = [];
    for (const table of [
      'entry',
      'day',
      'week',
      'setting',
      'consent',
      'recommendation',
      'photoChunk',
    ]) {
      const rows = (await raw(`select * from "${table}"`)) as Record<string, unknown>[];
      for (const row of rows) {
        const keys =
          table === 'photoChunk'
            ? ['id', 'hash', 'index', 'bytes']
            : table === 'entry'
              ? ['id', 'legacyKey', 'payload', 'startedAt']
              : ['id', 'legacyKey', 'payload'];
        writes.push({ table, values: Object.fromEntries(keys.map((key) => [key, row[key]])) });
      }
    }
    const restored = await restoreLegacySnapshot(
      writes as unknown as Parameters<typeof restoreLegacySnapshot>[0],
      client.evolu,
    );
    const expected = mappingFixture();
    const sizes = [];
    for (const index of [0, 2]) {
      const photo = restored.zaznamy[index]!.fotka as Blob;
      const bitmap = await createImageBitmap(photo);
      sizes.push([bitmap.width, bitmap.height]);
      bitmap.close();
      if (
        photo.type !== 'image/png' ||
        btoa(String.fromCharCode(...new Uint8Array(await photo.arrayBuffer()))) !== photoBase64
      )
        throw new Error('Photo bytes changed');
      restored.zaznamy[index]!.fotka = null;
    }
    // Pořadí vrací DB podle ID, nikoli podle vložení; obsah musí souhlasit.
    const primary: Record<string, string> = {
      zaznamy: 'id',
      dny: 'datum',
      tydny: 'tyden',
      souhlasy: 'id',
      doporuceni: 'co',
      nastaveni: 'key',
    };
    const normalize = (s: typeof restored) =>
      Object.fromEntries(
        Object.entries(s).map(([key, rows]) => [
          key,
          (rows as Record<string, unknown>[]).sort((a, b) =>
            String(a[primary[key]!]).localeCompare(String(b[primary[key]!])),
          ),
        ]),
      );
    return {
      actual: normalize(restored),
      expected: normalize(expected),
      sizes,
      chunks: writes.filter((w) => w.table === 'photoChunk').length,
    };
  });
  expect(result.actual).toEqual(result.expected);
  expect(result.sizes).toEqual([
    [1, 1],
    [1, 1],
  ]);
  expect(result.chunks).toBe(1);
  expect(sockets).toBe(0);
});

test('mapping refuses corrupt photos and oversized content before any diary writes', async ({
  page,
}) => {
  await page.goto('./diary/');
  await expect(page.locator('#status')).toHaveText(/^(Persisted|Unknown)$/);
  const result = await page.evaluate(async () => {
    const { client, raw, mapLegacySnapshot, mappingFixture } = window.diary;
    const errors = [];
    for (const kind of ['photo', 'large']) {
      const snapshot = mappingFixture();
      if (kind === 'photo')
        snapshot.zaznamy[2]!.fotka = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
      else snapshot.souhlasy[0]!.extra = 'x'.repeat(640_000);
      try {
        await client.writeBatch(await mapLegacySnapshot(snapshot, client.evolu));
      } catch (error) {
        errors.push((error as Error).message);
      }
    }
    const counts = [];
    for (const table of [
      'entry',
      'day',
      'week',
      'setting',
      'consent',
      'recommendation',
      'photoChunk',
    ]) {
      counts.push(await raw(`select count(*) as count from "${table}"`));
    }
    return { errors, counts };
  });
  expect(result.errors[0]).toMatch(/dekódovat/);
  expect(result.errors[1]).toMatch(/limit/);
  expect(result.counts).toEqual(Array.from({ length: 7 }, () => [{ count: 0 }]));
});
