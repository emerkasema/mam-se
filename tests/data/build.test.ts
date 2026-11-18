import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { test } from 'node:test';

test('offline manifest obsahuje existující obálku, skripty, styly a fonty', async () => {
  // Po buildu: jediný chybějící soubor znefunkční celou instalaci SW.
  const sw = await readFile('dist/sw.js', 'utf8');
  const match = sw.match(/const SOUBORY = (\[[\s\S]*?\]);/);
  assert.ok(match, 'Vygenerovaný SW musí mít precache manifest.');
  const assets: string[] = JSON.parse(match[1]!);
  assert.ok(assets.includes('index.html'));
  assert.ok(assets.includes('styl.css'));
  assert.ok(assets.some((path) => path.startsWith('_astro/') && path.endsWith('.js')));
  assert.ok(assets.includes('fonty/Inter-Regular.woff'));
  assert.ok(assets.includes('fonty/Fraunces-Latin.woff2'));
  assert.ok(assets.includes('fonty/Fraunces-LatinExt.woff2'));
  assert.ok(assets.some((path) => /Db\.worker.*\.js$/.test(path)));
  assert.ok(assets.some((path) => /Shared\.worker.*\.js$/.test(path)));
  assert.ok(assets.some((path) => path.endsWith('.wasm')));
  for (const path of assets) {
    assert.ok(!path.startsWith('/') && !path.includes('..'));
    assert.ok((await stat(`dist/${path}`)).isFile(), path);
  }
});

test('lokální odkazy ve stylech směřují na soubory zahrnuté do offline buildu', async () => {
  // Samotný manifest odhalí chybějící položku precache, ale ne překlep v CSS.
  // Projdeme i vnořené styly: fonty mají vlastní soubor s relativními cestami.
  const files = await readdir('dist', { recursive: true });
  for (const file of files.filter((name) => name.endsWith('.css'))) {
    const css = await readFile(`dist/${file}`, 'utf8');
    for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
      const url = match[1]!;
      if (/^(?:data:|https?:|\/\/|#)/.test(url)) continue;
      const asset = resolve('dist', dirname(file), url.split(/[?#]/)[0]!);
      assert.ok((await stat(asset)).isFile(), `${file}: ${url}`);
    }
  }
});
