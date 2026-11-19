// Waar het werkbord bewaard wordt: één privé-bestand in Vercel Blob (alleen de server kan het lezen).
// Lokaal, zonder Blob-instellingen: een bestand in .data/, om te testen.
import { get, head, put, BlobNotFoundError, BlobPreconditionFailedError } from '@vercel/blob';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { LEEG } from './taken.js';

const PAD = 'werkbord/taken.json';
const LOKAAL = new URL('../.data/taken.json', import.meta.url);

function online() {
  if (process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID) return true;
  if (process.env.VERCEL) throw new Error('Geen Blob-opslag gekoppeld aan dit project');
  return false;
}

async function leesBlob() {
  let etag;
  try {
    etag = (await head(PAD)).etag;
  } catch (e) {
    if (e instanceof BlobNotFoundError) return { staat: structuredClone(LEEG), etag: null };
    throw e;
  }
  const res = await get(PAD, { access: 'private', useCache: false });
  if (!res || res.statusCode !== 200) return { staat: structuredClone(LEEG), etag: null };
  return { staat: JSON.parse(await new Response(res.stream).text()), etag };
}

async function leesLokaal() {
  try {
    return { staat: JSON.parse(await readFile(LOKAAL, 'utf8')), etag: null };
  } catch {
    return { staat: structuredClone(LEEG), etag: null };
  }
}

export async function lees() {
  return (online() ? await leesBlob() : await leesLokaal()).staat;
}

/** Leest de laatste versie, past de wijziging toe en schrijft terug; bij een botsing opnieuw. */
export async function wijzig(fn) {
  for (let poging = 0; poging < 4; poging++) {
    const { staat, etag } = online() ? await leesBlob() : await leesLokaal();
    const nieuw = fn(staat);
    try {
      if (online()) {
        await put(PAD, JSON.stringify(nieuw), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', ...(etag ? { ifMatch: etag } : {}) });
      } else {
        await mkdir(new URL('.', LOKAAL), { recursive: true });
        await writeFile(LOKAAL, JSON.stringify(nieuw, null, 2));
      }
      return nieuw;
    } catch (e) {
      if (!(e instanceof BlobPreconditionFailedError)) throw e;
    }
  }
  throw new Error('Kon niet bewaren: te veel gelijktijdige wijzigingen');
}
