import { AppName, createAppOwner, createEvolu, createRun, getOrThrow } from '@evolu/common';
import { createEvoluDeps } from '@evolu/web';
import { createBatchWriter } from './batch.ts';
import { getOrCreateOwnerSecret } from './identity.ts';
import { schema } from './schema.ts';

// Zatím není importováno aplikací. Připojení deníku čeká na adaptér a migraci.
export async function initializeDiaryClient() {
  const secret = await getOrCreateOwnerSecret();
  const deps = createEvoluDeps();
  let writer: ReturnType<typeof createBatchWriter> | undefined;
  try {
    const evolu = getOrThrow(
      await createRun(deps)(
        createEvolu(schema, {
          appName: AppName.orThrow('mam-se'),
          appOwner: createAppOwner(secret),
          transports: [],
          indexes: (create) => [create('entryStartedAt').on('entry').column('startedAt')],
          onDatabaseDeleted: () => writer?.close(),
        }),
      ),
    );
    const persistence = await evolu.devicePersistence;
    if (persistence === 'NotPersisted') {
      await evolu[Symbol.asyncDispose]();
      throw new Error('Prohlížeč neposkytuje trvalé úložiště. Deník nebyl připojen.');
    }
    writer = createBatchWriter(evolu, deps.evoluError);
    return {
      // Unknown znamená diskové úložiště bez garance ochrany před evikcí.
      persistence,
      evolu,
      writeBatch: writer.writeBatch,
      async close() {
        writer?.close();
        await evolu[Symbol.asyncDispose]();
        deps[Symbol.dispose]();
      },
    };
  } catch (error) {
    deps[Symbol.dispose]();
    throw error;
  }
}
