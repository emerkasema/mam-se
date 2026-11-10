import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';

// Přechodný manifest před Workboxem: seznam odpovídá skutečnému Astro buildu.
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((e) => (e.isDirectory() ? files(`${dir}/${e.name}`) : `${dir}/${e.name}`)),
    )
  ).flat();
}
const assets = (await files('dist')).filter((p) => !p.endsWith('/sw.js')).sort();
const hash = createHash('sha256');
for (const path of assets) hash.update(await readFile(path));
let sw = await readFile('scripts/sw-legacy.js', 'utf8');
sw = sw
  .replace(/const VERZE = .*?;/, `const VERZE = 'mamse-${hash.digest('hex').slice(0, 16)}';`)
  .replace(
    /const SOUBORY = \[[\s\S]*?\];/,
    `const SOUBORY = ${JSON.stringify(assets.map((p) => p.slice(5)))};`,
  )
  .replace('k !== VERZE', "k.startsWith('mamse-') && k !== VERZE")
  .replace(
    "ulozene || caches.match('index.html')",
    "ulozene || (ev.request.mode === 'navigate' ? caches.match('index.html') : Response.error())",
  );
await writeFile('dist/sw.js', sw);
