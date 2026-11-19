import test from 'node:test';
import assert from 'node:assert/strict';
import { pasToe, LEEG, SOORTEN } from '../lib/taken.js';

const nu = new Date('2026-11-16T08:00:00Z');

test('taak toevoegen, wijzigen, afvinken en wissen', () => {
  let staat = pasToe(LEEG, { op: 'nieuw', taak: { titel: '  Factuur Seety betalen ', soort: 'Facturen & betalingen', dringend: 1, tegen: '2026-11-18' } }, nu);
  const t = staat.taken[0];
  assert.equal(t.titel, 'Factuur Seety betalen');
  assert.equal(t.dringend, true);
  assert.equal(t.klaarOp, '');
  staat = pasToe(staat, { op: 'wijzig', id: t.id, taak: { wachtOp: 'boekhouder', soort: 'bestaat niet' } }, nu);
  assert.equal(staat.taken[0].wachtOp, 'boekhouder');
  assert.equal(staat.taken[0].soort, 'Overige');
  assert.equal(staat.taken[0].titel, 'Factuur Seety betalen', 'andere velden blijven');
  staat = pasToe(staat, { op: 'klaar', id: t.id }, nu);
  assert.ok(staat.taken[0].klaarOp);
  staat = pasToe(staat, { op: 'klaar', id: t.id, klaar: false }, nu);
  assert.equal(staat.taken[0].klaarOp, '');
  staat = pasToe(staat, { op: 'wis', id: t.id }, nu);
  assert.equal(staat.taken.length, 0);
  assert.throws(() => pasToe(staat, { op: 'nieuw', taak: { titel: ' ' } }, nu));
  assert.throws(() => pasToe(staat, { op: 'klaar', id: 'x' }, nu));
  assert.throws(() => pasToe(staat, { op: 'iets' }, nu));
  assert.ok(SOORTEN.includes('Klanten & ophalingen'));
});

test('afgevinkte taken verdwijnen na 30 dagen; open taken blijven', () => {
  let staat = pasToe(LEEG, { op: 'nieuw', taak: { titel: 'Oud en klaar' } }, nu);
  staat = pasToe(staat, { op: 'nieuw', taak: { titel: 'Oud en open' } }, nu);
  staat = pasToe(staat, { op: 'klaar', id: staat.taken[0].id }, nu);
  const later = new Date(nu.getTime() + 31 * 86400000);
  staat = pasToe(staat, { op: 'nieuw', taak: { titel: 'Nieuw' } }, later);
  assert.deepEqual(staat.taken.map((t) => t.titel), ['Oud en open', 'Nieuw']);
  staat = pasToe(staat, { op: 'klaar', id: staat.taken[1].id }, later);
  staat = pasToe(staat, { op: 'wisKlaar' }, later);
  assert.deepEqual(staat.taken.map((t) => t.titel), ['Oud en open']);
});
