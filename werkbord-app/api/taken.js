// De server-functie van het werkbord, achter de pincode.
import { pasToe, Fout, SOORTEN } from '../lib/taken.js';
import { lees, wijzig } from '../lib/opslag.js';
import { controleer } from '../lib/pin.js';

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

async function leesBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let tekst = '';
  for await (const deel of req) {
    tekst += deel;
    if (tekst.length > 20_000) throw new Fout('Te groot');
  }
  try { return JSON.parse(tekst || '{}'); } catch { throw new Fout('Ongeldige gegevens'); }
}

const uit = (staat) => ({ taken: staat.taken || [], soorten: SOORTEN });

export default async function handler(req, res) {
  try {
    const nee = await controleer(req);
    if (nee) return json(res, nee.status, { error: nee.error });
    if (req.method === 'GET') return json(res, 200, uit(await lees()));
    if (req.method === 'POST') {
      const actie = await leesBody(req);
      return json(res, 200, uit(await wijzig((huidig) => pasToe(huidig, actie))));
    }
    return json(res, 405, { error: 'Niet toegestaan' });
  } catch (e) {
    if (e instanceof Fout) return json(res, e.status, { error: e.message });
    console.error('Werkbord: fout', e);
    return json(res, 500, { error: 'Er ging iets mis. Probeer het opnieuw.' });
  }
}
