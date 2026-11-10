export interface PhotoReference {
  hash: string;
  mime: string;
  byteLength: number;
  chunkCount: number;
}
export interface PhotoChunk {
  hash: string;
  index: number;
  bytes: Uint8Array<ArrayBuffer>;
}
const chunkSize = 262_144;
const photoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

// Dělíme původní bajty, nikoliv znovu komprimovaný obrázek. Velikost části
// ponechává rezervu pro metadata mutace; úplnost a hash ověřujeme při složení.
// MIME je zde deklarace volajícího, nikoliv ověření dekódovatelného obrázku.
// Import musí obrázek ověřit předem a změřit celou výslednou Evolu mutaci
// včetně metadat. Hash kontroluje shodu bajtů; sám data nešifruje.
export async function splitPhoto(
  photo: Blob,
): Promise<{ reference: PhotoReference; chunks: PhotoChunk[] }> {
  if (!photoTypes.has(photo.type)) throw new Error('Nepodporovaný formát fotky.');
  if (!photo.size) throw new Error('Fotka je prázdná.');
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const hash = await digest(bytes);
  const chunks: PhotoChunk[] = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push({ hash, index: chunks.length, bytes: bytes.slice(offset, offset + chunkSize) });
  }
  return {
    reference: { hash, mime: photo.type, byteLength: bytes.length, chunkCount: chunks.length },
    chunks,
  };
}

export async function joinPhoto(
  reference: PhotoReference,
  chunks: readonly PhotoChunk[],
): Promise<Blob> {
  if (
    !photoTypes.has(reference.mime) ||
    !/^[a-f0-9]{64}$/.test(reference.hash) ||
    !Number.isSafeInteger(reference.byteLength) ||
    reference.byteLength <= 0 ||
    reference.chunkCount !== Math.ceil(reference.byteLength / chunkSize)
  ) {
    throw new Error('Neplatná reference fotky.');
  }
  const ordered = [...chunks].sort((left, right) => left.index - right.index);
  if (
    ordered.length !== reference.chunkCount ||
    ordered.some(
      (chunk, index) =>
        chunk.index !== index ||
        chunk.hash !== reference.hash ||
        chunk.bytes.byteLength !== Math.min(chunkSize, reference.byteLength - index * chunkSize),
    )
  ) {
    throw new Error('Fotka je neúplná; počkej na dokončení synchronizace.');
  }
  const bytes = new Uint8Array(reference.byteLength);
  for (const chunk of ordered) bytes.set(chunk.bytes, chunk.index * chunkSize);
  if ((await digest(bytes)) !== reference.hash)
    throw new Error('Nesouhlasí kontrolní součet fotky.');
  return new Blob([bytes], { type: reference.mime });
}
