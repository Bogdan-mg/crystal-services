// De regels van het werkbord: taken toevoegen, wijzigen, afvinken en wissen.
// Draait op de server op de meest recente versie, zodat twee toestellen elkaars werk niet overschrijven.

export const SOORTEN = ['Klanten & ophalingen', 'Facturen & betalingen', 'Leveranciers & aankopen', 'Administratie', 'Winkel & onderhoud', 'Overige'];
export const LEEG = { taken: [] };
const MAX_TAKEN = 500;
const BEWAAR_KLAAR_DAGEN = 30;

export class Fout extends Error {
  constructor(boodschap, status = 400) {
    super(boodschap);
    this.status = status;
  }
}

const tekst = (v, max) => String(v ?? '').trim().slice(0, max);
const isDag = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));

function velden(invoer, oud = {}) {
  const uit = { ...oud };
  if ('titel' in invoer) uit.titel = tekst(invoer.titel, 200);
  if ('soort' in invoer) uit.soort = SOORTEN.includes(invoer.soort) ? invoer.soort : 'Overige';
  if ('dringend' in invoer) uit.dringend = Boolean(invoer.dringend);
  if ('tegen' in invoer) uit.tegen = isDag(invoer.tegen) ? invoer.tegen : '';
  if ('wachtOp' in invoer) uit.wachtOp = tekst(invoer.wachtOp, 80);
  if ('notitie' in invoer) uit.notitie = tekst(invoer.notitie, 500);
  return uit;
}

/** Past één handeling toe en geeft de nieuwe staat terug. */
export function pasToe(oud, actie, nu = new Date()) {
  const iso = nu.toISOString();
  // Afgevinkte taken blijven 30 dagen staan en verdwijnen daarna vanzelf.
  const grens = new Date(nu.getTime() - BEWAAR_KLAAR_DAGEN * 86400000).toISOString();
  const staat = { ...oud, taken: (oud.taken || []).filter((t) => !t.klaarOp || t.klaarOp >= grens) };
  const zoek = (id) => {
    const i = staat.taken.findIndex((t) => t.id === id);
    if (i < 0) throw new Fout('Taak niet gevonden', 404);
    return i;
  };
  switch (actie?.op) {
    case 'nieuw': {
      const t = velden({ titel: '', soort: 'Overige', dringend: false, tegen: '', wachtOp: '', notitie: '', ...(actie.taak || {}) });
      if (!t.titel) throw new Fout('Typ eerst wat er moet gebeuren');
      if (staat.taken.length >= MAX_TAKEN) throw new Fout('Het werkbord is vol: wis eerst afgevinkte taken');
      staat.taken.push({ id: 't' + nu.getTime().toString(36) + Math.random().toString(36).slice(2, 6), ...t, gemaaktOp: iso, klaarOp: '' });
      return staat;
    }
    case 'wijzig': {
      const i = zoek(actie.id);
      const t = velden(actie.taak || {}, staat.taken[i]);
      if (!t.titel) throw new Fout('Typ eerst wat er moet gebeuren');
      staat.taken[i] = t;
      return staat;
    }
    case 'klaar': {
      const i = zoek(actie.id);
      staat.taken[i] = { ...staat.taken[i], klaarOp: actie.klaar === false ? '' : iso };
      return staat;
    }
    case 'wis': {
      staat.taken.splice(zoek(actie.id), 1);
      return staat;
    }
    case 'wisKlaar': {
      staat.taken = staat.taken.filter((t) => !t.klaarOp);
      return staat;
    }
    default:
      throw new Fout('Onbekende handeling');
  }
}
