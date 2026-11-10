import test from 'node:test';
import assert from 'node:assert/strict';
import { splitPhoto, joinPhoto } from '../../src/data/photos.ts';

test('1.5 MiB photo survives out-of-order chunks without changing bytes', async () => {
  const bytes = new Uint8Array(1_572_864);
  for (let index = 0; index < bytes.length; index++) bytes[index] = index % 251;
  const source = new Blob([bytes], { type: 'image/jpeg' });
  const prepared = await splitPhoto(source);
  assert.equal(prepared.chunks.length, 6);
  assert.ok(prepared.chunks.every(chunk => chunk.bytes.byteLength <= 262_144));
  const photo = await joinPhoto(prepared.reference, [...prepared.chunks].reverse());
  assert.deepEqual(new Uint8Array(await photo.arrayBuffer()), bytes);
  assert.equal(photo.type, 'image/jpeg');
  assert.deepEqual(await splitPhoto(source), prepared);
});

test('missing or corrupt chunks cannot become an exportable photo', async () => {
  const prepared = await splitPhoto(new Blob([new Uint8Array(300_000)], { type: 'image/png' }));
  await assert.rejects(joinPhoto(prepared.reference, prepared.chunks.slice(1)), /neúplná/);
  const corrupt = prepared.chunks.map(chunk => ({ ...chunk, bytes: chunk.bytes.slice() }));
  corrupt[0]!.bytes[0] = 1;
  await assert.rejects(joinPhoto(prepared.reference, corrupt), /kontrolní/);
  await assert.rejects(splitPhoto(new Blob(['<svg/>'], { type: 'image/svg+xml' })), /formát/);
});
