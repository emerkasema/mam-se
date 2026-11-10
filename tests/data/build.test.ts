import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

test('offline manifest obsahuje existující obálku, skripty, styly a fonty', async () => {
  // Po buildu: jediný chybějící soubor znefunkční celou instalaci SW.
  const sw = await readFile('dist/sw.js', 'utf8');
  const match = sw.match(/const SOUBORY = (\[[\s\S]*?\]);/);
  assert.ok(match, 'Vygenerovaný SW musí mít precache manifest.');
  const assets: string[] = JSON.parse(match[1]!);
  assert.ok(assets.includes('index.html'));
  assert.ok(assets.includes('styl.css'));
  assert.ok(assets.some(path => path.startsWith('_astro/') && path.endsWith('.js')));
  assert.ok(assets.includes('fonty/Inter-Regular.woff'));
  for (const path of assets) {
    assert.ok(!path.startsWith('/') && !path.includes('..'));
    assert.ok((await stat(`dist/${path}`)).isFile(), path);
  }
});
