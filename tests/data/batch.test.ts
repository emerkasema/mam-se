import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore, type Evolu, type EvoluError, Json, PositiveInt } from '@evolu/common';
import { createBatchWriter } from '../../src/data/batch.ts';
import { createRowId, type DiarySchema } from '../../src/data/schema.ts';

const write = {
  table: 'day' as const,
  values: {
    id: createRowId('day', 'synthetic'),
    legacyKey: 'synthetic',
    payload: Json.orThrow('{}'),
  },
};
function fixture(options: { complete?: boolean; rows?: unknown[] } = {}) {
  const errors = createStore<EvoluError | null>(null);
  let sends = 0;
  const evolu = {
    getMutationSize: () => PositiveInt.orThrow(100),
    upsert: (_table: unknown, _values: unknown, callbacks: { onComplete: () => void }) => {
      sends++;
      if (options.complete !== false) queueMicrotask(callbacks.onComplete);
    },
    loadQuery: async () => options.rows ?? [{ ...write.values, isDeleted: 0 }],
  } as unknown as Evolu<DiarySchema>;
  return { errors, writer: createBatchWriter(evolu, errors), sends: () => sends };
}

test('callbacks without matching readback cannot confirm a batch or permit further writes', async () => {
  const { writer, sends } = fixture({ rows: [] });
  try {
    await assert.rejects(writer.writeBatch([write]), /Zpětné čtení/);
    await assert.rejects(writer.writeBatch([write]), /nebyla ověřena/);
    assert.equal(sends(), 1);
  } finally {
    writer.close();
  }
});

test('Evolu error releases pending and queued writes without waiting for callbacks', async () => {
  const { writer, errors, sends } = fixture({ complete: false });
  try {
    const first = assert.rejects(writer.writeBatch([write]), /OtherBuildRunningError/);
    const second = assert.rejects(writer.writeBatch([write]), /OtherBuildRunningError/);
    await Promise.resolve();
    errors.set({ type: 'OtherBuildRunningError' });
    await Promise.all([first, second]);
    assert.equal(sends(), 1);
  } finally {
    writer.close();
  }
});

test('timeout reports unknown outcome, invalidates writer and removes its timer', async (context) => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const { writer } = fixture({ complete: false });
  try {
    const pending = assert.rejects(writer.writeBatch([write]), /Výsledek zápisu není známý/);
    await Promise.resolve();
    context.mock.timers.tick(15_000);
    await pending;
    await assert.rejects(writer.writeBatch([write]), /Výsledek zápisu není známý/);
  } finally {
    writer.close();
  }
});

test('duplicate row IDs reject before sending and input changes cannot modify a queued batch', async () => {
  const { writer, sends } = fixture();
  try {
    await assert.rejects(writer.writeBatch([write, write]), /opakované ID/);
    assert.equal(sends(), 0);
    const mutable = structuredClone(write);
    const pending = writer.writeBatch([mutable]);
    mutable.values.payload = Json.orThrow('{"changed":true}');
    await pending;
    assert.equal(sends(), 1);
  } finally {
    writer.close();
  }
});

test('sparse input cannot send earlier rows before discovering a missing operation', async () => {
  const { writer, sends } = fixture();
  try {
    const sparse = [write];
    sparse.length = 2;
    await assert.rejects(writer.writeBatch(sparse));
    assert.equal(sends(), 0);
  } finally {
    writer.close();
  }
});
