import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

test('rapid preference changes compose after confirmation instead of overwriting each other', async () => {
  const source = await readFile('src/app/app.js', 'utf8');
  const code = source.slice(
    source.indexOf('function createConsent('),
    source.indexOf('function isOnboardingComplete('),
  );
  let confirm!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>((resolve) => {
    confirm = resolve;
  });
  const began = new Promise<void>((resolve) => {
    started = resolve;
  });
  const writes: { summary: boolean; dictation: boolean }[] = [];
  const context = vm.createContext({
    nastaveni: { summary: false, dictation: false },
    U: {
      saveSettings: async (settings: { summary: boolean; dictation: boolean }) => {
        writes.push({ ...settings });
        if (writes.length === 1) {
          started();
          await waiting;
        }
      },
    },
  });
  vm.runInContext(`${code}\nglobalThis.save = savePreferences;`, context);
  const first = context.save({ summary: true });
  await began;
  const second = context.save({ dictation: true });
  confirm();
  await Promise.all([first, second]);
  assert.deepEqual(writes.at(-1), { summary: true, dictation: true });
  assert.equal(context.nastaveni.summary, true);
  assert.equal(context.nastaveni.dictation, true);
});
