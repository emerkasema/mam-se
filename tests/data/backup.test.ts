import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldReplace, validateBackupStructure } from '../../src/data/backup.ts';
import { legacyFixture } from '../fixtures/legacy.ts';

const backup = () => ({ aplikace: 'Mám se!', format_zalohy: 1, ...structuredClone(legacyFixture) });

test('validates complete legacy collections without changing original keys', () => {
  const input = backup();
  assert.deepEqual(validateBackupStructure(input), input);
});
test('rejects an invalid final entry before returning a prepared backup', () => {
  const input = backup();
  input.zaznamy.push({ ...input.zaznamy[0]!, id: 'id-fallback', prijemnost: 99 });
  assert.throws(() => validateBackupStructure(input), /prijemnost/);
});
test('rejects foreign versions, prototype keys and external or active photo URLs', () => {
  assert.throws(() => validateBackupStructure({ ...backup(), format_zalohy: 2 }), /verze/);
  assert.throws(
    () =>
      validateBackupStructure(
        JSON.parse(
          JSON.stringify(backup()).replace('"nastaveni":{', '"nastaveni":{"__proto__":{},'),
        ),
      ),
    /klíč/,
  );
  for (const fotka of [
    'https://example.com/private',
    'data:image/svg+xml;base64,PHN2Zy8+',
    'data:text/html;base64,PGgxPg==',
  ]) {
    const input = backup();
    Object.assign(input.zaznamy[0]!, { fotka });
    assert.throws(() => validateBackupStructure(input), /fotk/);
  }
});
test('compares actual instants across timezones and preserves local values on ties', () => {
  assert.equal(
    shouldReplace(
      { vytvoreno: '2026-11-10T10:00:00+02:00' },
      { vytvoreno: '2026-11-10T09:30:00Z' },
    ),
    true,
  );
  assert.equal(
    shouldReplace(
      { vytvoreno: '2026-11-10T10:00:00+02:00' },
      { vytvoreno: '2026-11-10T08:00:00Z' },
    ),
    false,
  );
  assert.equal(shouldReplace({ tyden: '2026-W45', odlozeno: true }, { tyden: '2026-W45' }), false);
});

test('large embedded photo is structurally validated without regex stack overflow', () => {
  const input = backup();
  const fotka = `data:image/jpeg;base64,${Buffer.alloc(5_000_000).toString('base64')}`;
  Object.assign(input.zaznamy[0]!, { fotka });
  assert.equal(validateBackupStructure(input).zaznamy[0]!.fotka, fotka);
});
