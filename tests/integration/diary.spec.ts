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
