import assert from 'node:assert/strict';
import test from 'node:test';
import { object } from '@evolu/common';
import { createRowId, schema } from '../../src/data/schema.ts';

test('schema keeps deterministic keys separated by table and validates stored values', () => {
  assert.equal(createRowId('entry', 'legacy-1'), createRowId('entry', 'legacy-1'));
  assert.notEqual(createRowId('entry', 'legacy-1'), createRowId('day', 'legacy-1'));
  assert.equal(
    object(schema.day).fromUnknown({
      id: createRowId('day', '2026-11-10'),
      legacyKey: '2026-11-10',
      payload: '{broken',
    }).ok,
    false,
  );
  assert.equal(
    object(schema.photoChunk).fromUnknown({
      id: createRowId('photoChunk', 'synthetic:0'),
      hash: 'synthetic',
      index: -1,
      bytes: new Uint8Array([1]),
    }).ok,
    false,
  );
});
