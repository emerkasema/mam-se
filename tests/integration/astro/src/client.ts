import {
  AppName,
  createAppOwner,
  createEvolu,
  createOwnerSecret,
  createQueryBuilder,
  createRun,
  getOrThrow,
  id,
  NonEmptyTrimmedString100,
  OwnerSecret,
} from '@evolu/common';
import { createEvoluDeps } from '@evolu/web';

const schema = { entry: { id: id('Entry'), text: NonEmptyTrimmedString100 } };
const run = createRun(createEvoluDeps());
// Pouze syntetický test: sessionStorage drží náhodnou identitu přes reload.
// Aplikace bude ukládat identitu do samostatné IndexedDB pod Web Lockem.
const savedSecret = sessionStorage.getItem('integration-owner');
const secret = savedSecret
  ? OwnerSecret.orThrow(new Uint8Array(JSON.parse(savedSecret)))
  : createOwnerSecret(run.deps);
sessionStorage.setItem('integration-owner', JSON.stringify(Array.from(secret)));
const evolu = getOrThrow(
  await run(
    createEvolu(schema, {
      appName: AppName.orThrow('mam-se-integration'),
      appOwner: createAppOwner(secret),
      transports: [],
    }),
  ),
);
document.body.dataset.persistence = await evolu.devicePersistence;
const query = createQueryBuilder(schema)((db) =>
  db.selectFrom('entry').select('text').where('isDeleted', 'is not', 1),
);
const render = async () => {
  const rows = await evolu.loadQuery(query);
  document.querySelector('#rows')!.textContent = JSON.stringify(rows.map((row) => row.text));
};
document.querySelector('#save')!.addEventListener('click', () => {
  evolu.insert(
    'entry',
    { text: NonEmptyTrimmedString100.orThrow('Synthetic entry') },
    {
      onComplete: () => {
        void render();
      },
    },
  );
});
await render();
