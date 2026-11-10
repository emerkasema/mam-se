import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

// Spouštíme skutečnou UI funkci s pozastavenou hranicí úložiště. Tím lze
// deterministicky vyvolat změnu obrazovky mezi přípravou a potvrzením zápisu.
const source = await readFile('src/app/app.js', 'utf8');
const code = source.slice(
  source.indexOf('async function ulozVecer('),
  source.indexOf('\nconst MAX_CINNOSTI'),
);
const block = (id: string) => ({
  id,
  vytvoreno: '2026-11-10T10:00:00Z',
  delkaMin: 30,
  popis: id,
  cinnost: [],
  sKym: [],
  kde: null,
  hodnotit: false,
  text: '',
  vyzkum: {},
  ulozeny: false,
  puvodni: undefined as unknown,
});
function fixture() {
  let confirm!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    confirm = resolve;
  });
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  const first = block('original');
  const evening = {
    datum: '2026-11-10',
    bloky: [first],
    smazane: ['already-deleted'],
    revision: 0,
  };
  const context = vm.createContext({
    vecer: evening,
    structuredClone,
    oznam: () => {},
    prekresli: () => {},
    S: { VERZE_PROTOKOLU: '0.7.0' },
    U: {
      timestamp: () => '2026-11-10T00:00:00Z',
      getDay: async () => undefined,
      saveEveningBatch: async () => {
        started();
        await waiting;
      },
    },
  });
  vm.runInContext(
    `${code}\nglobalThis.save = ulozVecer; globalThis.confirmView = confirmEveningView;`,
    context,
  );
  return { evening, first, context, began, confirm, save: context.save as () => Promise<unknown> };
}

test('late evening confirmation cannot mark a different day or clear its pending deletions', async () => {
  const f = fixture();
  const pending = f.save();
  await f.began;
  const nextBlock = block('other-day');
  const next = { datum: '2026-11-11', bloky: [nextBlock], smazane: ['keep-deletion'], revision: 0 };
  f.context.vecer = next;
  f.confirm();
  const saved = await pending;
  assert.equal(f.context.confirmView(saved), false);
  assert.equal(f.first.ulozeny, true);
  assert.equal(nextBlock.ulozeny, false);
  assert.deepEqual(next.smazane, ['keep-deletion']);
});

test('late confirmation preserves edits, new deletions and removal of a previously unsaved block', async () => {
  const f = fixture();
  const pending = f.save();
  await f.began;
  f.evening.bloky = [];
  f.evening.smazane.push('new-deletion');
  f.evening.revision++;
  f.confirm();
  const saved = await pending;
  assert.equal(f.context.confirmView(saved), false);
  assert.ok(f.evening.smazane.includes('new-deletion'));
  assert.ok(f.evening.smazane.includes('original'));
  assert.ok(!f.evening.smazane.includes('already-deleted'));
});
