import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

// Samotný hash JSON odpovědi při převodu mezi Docker a OCI formátem nemusí
// být adresovatelný v registru. Ověřujeme proto uložený digest přímo přes API.
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const paths = ['.github/workflows/ci.yml', '.gitlab-ci.yml'];
const images = await Promise.all(
  paths.map(async (path) => {
    const content = await readFile(path, 'utf8');
    const image = content.match(/image:\s*(mcr\.microsoft\.com\/playwright:[^\s]+)/)?.[1];
    if (!image) throw new Error(`Chybí připnutý Playwright image v ${path}.`);
    return image;
  }),
);
if (images[0] !== images[1]) throw new Error('GitHub a GitLab musí mít stejný Playwright image.');
const expected = `mcr.microsoft.com/playwright:v${pkg.devDependencies['@playwright/test']}-noble@`;
const image = images[0];
if (!image?.startsWith(expected)) throw new Error('Image neodpovídá verzi @playwright/test.');
const digest = image.slice(expected.length);
if (!/^sha256:[a-f0-9]{64}$/.test(digest)) throw new Error('Neplatný digest image.');

async function readManifest(value) {
  const response = await fetch(`https://mcr.microsoft.com/v2/playwright/manifests/${value}`, {
    headers: {
      Accept:
        'application/vnd.oci.image.index.v1+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.docker.distribution.manifest.v2+json',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Registry odmítl digest ${value}: HTTP ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (response.headers.get('docker-content-digest') !== value || actual !== value)
    throw new Error('Registry nepotvrdil požadovaný digest manifestu.');
  return JSON.parse(bytes.toString('utf8'));
}

const index = await readManifest(digest);
const platform = index.manifests?.find(
  (manifest) => manifest.platform?.os === 'linux' && manifest.platform?.architecture === 'amd64',
);
if (!platform) throw new Error('Image nemá požadovanou platformu linux/amd64.');
await readManifest(platform.digest);
console.log(`Oba CI image odkazují na existující manifest linux/amd64: ${image}`);
