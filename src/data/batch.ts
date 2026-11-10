import {
  createQueryBuilder,
  type Evolu,
  type EvoluError,
  type InferType,
  type MutationValues,
  maxMutationSize,
  object,
  type ReadonlyStore,
} from '@evolu/common';
import { type DiarySchema, schema, type TableName } from './schema.ts';

export type BatchWrite = {
  [T in TableName]: {
    table: T;
    values: Omit<MutationValues<DiarySchema[T], 'upsert'>, 'isDeleted'>;
  };
}[TableName];

// Neposkytuje rollback již odeslaného požadavku. Chyba/timeout znamená neověřený
// výsledek, po kterém je nutné znovu otevřít a přečíst databázi. Žádný auto-retry.
export function createBatchWriter(
  evolu: Evolu<DiarySchema>,
  errors: ReadonlyStore<EvoluError | null>,
) {
  const validators = {
    entry: object(schema.entry),
    day: object(schema.day),
    week: object(schema.week),
    setting: object(schema.setting),
    consent: object(schema.consent),
    recommendation: object(schema.recommendation),
    photoChunk: object(schema.photoChunk),
    _migration: object(schema._migration),
  };
  const photoChunkType = () => object(schema.photoChunk);
  const createQuery = createQueryBuilder(schema);
  const lifetime = new AbortController();
  let queue = Promise.resolve();
  const invalidate = (message: string) => lifetime.abort(new Error(message));
  const checkError = () => {
    const error = errors.get();
    if (error) invalidate(`Úložiště selhalo (${error.type}). Výsledek zápisu není ověřený.`);
  };
  const unsubscribe = errors.subscribe(checkError);
  checkError();

  function prepare<T extends TableName>(table: T, input: unknown) {
    // TypeScript není runtime brána. Nejdřív validujeme VŠECHNY řádky a kopírujeme
    // jejich bajty, aby pozdější chyba nebo změna vstupu nezanechala půl dávky.
    const parsed = validators[table].fromUnknown(input);
    if (!parsed.ok) throw new Error('Neplatné hodnoty dávky.');
    const values = parsed.value;
    const snapshot = structuredClone(values) as unknown as MutationValues<DiarySchema[T], 'upsert'>;
    if (
      evolu.getMutationSize(table, snapshot as Partial<MutationValues<DiarySchema[T], 'update'>>) >
      maxMutationSize
    )
      throw new Error('Zápis překračuje limit Evolu. Obsah nebyl zkrácen ani odeslán.');
    if (table === 'photoChunk') {
      const chunk = values as unknown as InferType<ReturnType<typeof photoChunkType>>;
      if (!/^[a-f0-9]{64}$/.test(chunk.hash) || !chunk.bytes.length || chunk.bytes.length > 262_144)
        throw new Error('Neplatná část fotky.');
    }
    return {
      table,
      values: snapshot,
      send: (onComplete: () => void) => evolu.upsert(table, snapshot, { onComplete }),
    };
  }

  async function execute(operations: ReturnType<typeof prepare>[]) {
    lifetime.signal.throwIfAborted();
    if (!operations.length) return;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let onAbort: () => void = () => {};
    try {
      await new Promise<void>((resolve, reject) => {
        onAbort = () => reject(lifetime.signal.reason);
        lifetime.signal.addEventListener('abort', onAbort, { once: true });
        // Evolu nechává některé požadavky při odmítnutém workeru čekat. Timeout
        // nepředstírá zrušení transakce, pouze ukončí čekání a zneplatní writer.
        timeout = setTimeout(
          () => invalidate('Čas ověření vypršel. Výsledek zápisu není známý.'),
          15_000,
        );
        let remaining = operations.length;
        const complete = () => {
          if (--remaining !== 0) return;
          void (async () => {
            for (const operation of operations) {
              const rows = await evolu.loadQuery(
                createQuery((db) =>
                  db.selectFrom(operation.table).selectAll().where('id', '=', operation.values.id),
                ),
              );
              const row = rows[0];
              if (
                !row ||
                rows.length !== 1 ||
                row.isDeleted === 1 ||
                Object.entries(operation.values).some(([key, value]) => {
                  const stored = (row as Record<string, unknown>)[key];
                  return value instanceof Uint8Array
                    ? !(stored instanceof Uint8Array) ||
                        value.length !== stored.length ||
                        value.some((byte, i) => byte !== stored[i])
                    : value !== stored;
                })
              )
                throw new Error('Zpětné čtení nepotvrdilo obsah celé dávky.');
            }
          })()
            .then(() => {
              lifetime.signal.throwIfAborted();
              resolve();
            })
            .catch(reject);
        };
        try {
          // Bez await: jedna Evolu microtask dávka. Callbacky samotné nestačí,
          // např. karanténa časových razítek nemusí změnu promítnout do tabulky.
          for (const operation of operations) operation.send(complete);
        } catch {
          invalidate('Odeslání dávky selhalo. Výsledek zápisu není ověřený.');
        }
      });
    } catch (error) {
      invalidate('Dávka nebyla ověřena. Před dalším zápisem znovu otevři úložiště.');
      throw error;
    } finally {
      clearTimeout(timeout);
      lifetime.signal.removeEventListener('abort', onAbort);
    }
  }

  return {
    // Každý řádek i bajty kontrolujeme interně; volající nemůže readback přeskočit.
    writeBatch(writes: readonly BatchWrite[]): Promise<void> {
      let operations: ReturnType<typeof prepare>[];
      try {
        lifetime.signal.throwIfAborted();
        const seen = new Set<string>();
        operations = Array.from(writes, ({ table, values }) => {
          if (!Object.hasOwn(schema, table)) throw new Error('Neznámá tabulka.');
          const operation = prepare(table, values);
          const key = `${table}:${operation.values.id}`;
          if (seen.has(key)) throw new Error('Dávka obsahuje opakované ID stejné tabulky.');
          seen.add(key);
          return operation;
        });
      } catch (error) {
        return Promise.reject(error);
      }
      const result = queue.then(() => execute(operations));
      queue = result.catch(() => {});
      return result;
    },
    close() {
      invalidate('Úložiště bylo uzavřeno.');
      unsubscribe();
    },
  };
}
