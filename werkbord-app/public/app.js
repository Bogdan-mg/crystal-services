// Crystal Werkbord: takenbord van de zaak. Gewone HTML, CSS en JavaScript, geen build nodig.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let pin = '';
  try { pin = localStorage.getItem('werkbord-pin') || ''; } catch {}
  let staat = { taken: [], soorten: [] };
  let filter = '';

  const isoVan = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const vandaagIso = () => isoVan(new Date());
  const mooiDag = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' });

  // ---------- Server ----------
  async function api(methode, body) {
    const res = await fetch('/api/taken', { method: methode, headers: { 'Content-Type': 'application/json', 'x-pin': pin }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) { vergrendel(data.error || 'Verkeerde pincode'); throw new Error('pin'); }
    if (!res.ok) throw new Error(data.error || 'Er ging iets mis');
    return data;
  }
  function vergrendel(fout) {
    $('#app').hidden = true; $('#slot').hidden = false; $('#slot-fout').textContent = fout || '';
    $('#slot-pin').value = ''; $('#slot-pin').focus();
  }
  async function laad() {
    staat = await api('GET');
    $('#slot').hidden = true; $('#app').hidden = false;
    toon();
  }
  async function doe(actie) { staat = await api('POST', actie); toon(); }
  $('#slot-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    pin = $('#slot-pin').value.trim();
    try { await laad(); try { localStorage.setItem('werkbord-pin', pin); } catch {} }
    catch (err) { if (err.message !== 'pin') $('#slot-fout').textContent = err.message; }
  });

  let toastKlok;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.hidden = false; clearTimeout(toastKlok); toastKlok = setTimeout(() => { el.hidden = true; }, 2500); }

  // ---------- Tonen ----------
  const open = (t) => !t.klaarOp;
  const wacht = (t) => open(t) && Boolean(t.wachtOp);
  const zelf = (t) => open(t) && !t.wachtOp;
  const teLaat = (t, v) => open(t) && t.tegen && t.tegen < v;
  const vandaagOfLaat = (t, v) => open(t) && t.tegen && t.tegen <= v;
  // Volgorde: dringend eerst, dan op datum (zonder datum achteraan), dan de oudste.
  const volgorde = (a, b) => Number(b.dringend) - Number(a.dringend) || (a.tegen || '9999').localeCompare(b.tegen || '9999') || a.gemaaktOp.localeCompare(b.gemaaktOp);

  function rij(t, metSoort) {
    const v = vandaagIso();
    const labels = [];
    if (open(t) && t.dringend) labels.push('<span class="label rood">Dringend</span>');
    if (open(t) && t.tegen) labels.push(`<span class="label ${t.tegen < v ? 'rood' : t.tegen === v ? 'oranje' : ''}">${t.tegen < v ? 'Te laat · ' : ''}${t.tegen === v ? 'Vandaag' : esc(mooiDag(t.tegen))}</span>`);
    if (open(t) && t.wachtOp) labels.push(`<span class="label blauw">Wacht op ${esc(t.wachtOp)}</span>`);
    if (metSoort) labels.push(`<span class="label">${esc(t.soort)}</span>`);
    if (t.klaarOp) labels.push(`<span class="label">Afgevinkt ${esc(mooiDag(t.klaarOp.slice(0, 10)))}</span>`);
    return `<li class="taak${t.klaarOp ? ' klaar' : ''}${open(t) && t.dringend ? ' dringend' : ''}">
      <label class="vinkje"><input type="checkbox" data-klaar="${esc(t.id)}"${t.klaarOp ? ' checked' : ''} aria-label="Afvinken"></label>
      <button type="button" class="inhoud" data-open="${esc(t.id)}">
        <span class="naam">${esc(t.titel)}</span>
        ${labels.length ? `<span class="meta">${labels.join('')}</span>` : ''}
        ${t.notitie ? `<span class="noot">${esc(t.notitie)}</span>` : ''}
      </button></li>`;
  }

  function toon() {
    const v = vandaagIso();
    const taken = staat.taken || [];
    const week = new Date(Date.now() - 7 * 86400000).toISOString();
    const tellers = [
      ['dringend', 'rood', taken.filter((t) => open(t) && t.dringend).length, 'Dringend'],
      ['vandaag', 'oranje', taken.filter((t) => vandaagOfLaat(t, v)).length, 'Vandaag of te laat'],
      ['open', '', taken.filter(open).length, 'Open taken'],
      ['wacht', '', taken.filter(wacht).length, 'Wacht op iemand anders'],
      ['klaar', 'groen', taken.filter((t) => t.klaarOp && t.klaarOp >= week).length, 'Afgevinkt (7 dagen)'],
    ];
    $('#tegels').innerHTML = tellers.map(([id, kleur, n, naam]) => `<button type="button" class="tegel ${kleur}" data-filter="${id}" aria-pressed="${filter === id}"><b>${n}</b><span>${naam}</span></button>`).join('');
    $('#vandaag').textContent = mooiDag(v);
    const nu = new Date();
    $('#stand').innerHTML = `Bijgewerkt: <b>${esc(nu.toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' }))}, ${esc(nu.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }))}</b>`;

    // Eerst doen: wat dringend is, vandaag moet of te laat is, en niet op iemand anders wacht.
    const eerst = taken.filter((t) => zelf(t) && (t.dringend || vandaagOfLaat(t, v))).sort(volgorde);
    $('#eerst-lijst').innerHTML = eerst.length ? `<ul class="taken">${eerst.map((t) => rij(t, true)).join('')}</ul>`
      : `<p class="leeg">${taken.some(open) ? 'Niets dringends. Alles is afgevinkt, heeft nog tijd of wacht op iemand anders.' : 'Niets dringends. Alles is afgevinkt.'}</p>`;

    const wachtend = taken.filter(wacht).sort(volgorde);
    $('#wacht-blok').hidden = !wachtend.length;
    $('#wacht-lijst').innerHTML = wachtend.map((t) => rij(t, true)).join('');

    const past = (t) => filter === 'dringend' ? open(t) && t.dringend : filter === 'vandaag' ? vandaagOfLaat(t, v) : filter === 'wacht' ? wacht(t) : true;
    $('#soorten').innerHTML = (staat.soorten || []).map((soort) => {
      const hier = taken.filter((t) => t.soort === soort);
      const op = hier.filter(open).filter(past).sort(volgorde);
      const klaar = hier.filter((t) => t.klaarOp).sort((a, b) => b.klaarOp.localeCompare(a.klaarOp));
      const toonKlaar = filter === 'klaar';
      return `<section class="soort"><div class="soort-kop"><h3>${esc(soort)}</h3><span>${hier.filter(open).length} open</span></div>
        ${toonKlaar ? '' : op.length ? `<ul class="taken">${op.map((t) => rij(t)).join('')}</ul>` : `<p class="leeg">${filter && hier.some(open) ? 'Niets voor deze keuze.' : 'Niets open.'}</p>`}
        ${klaar.length ? `<details${toonKlaar ? ' open' : ''}><summary>${klaar.length} afgevinkt</summary><ul class="taken">${klaar.map((t) => rij(t)).join('')}</ul></details>` : toonKlaar ? '<p class="leeg">Niets afgevinkt.</p>' : ''}</section>`;
    }).join('');
  }

  // ---------- Handelingen ----------
  $('#tegels').addEventListener('click', (e) => {
    const k = e.target.closest('[data-filter]');
    if (!k) return;
    filter = filter === k.dataset.filter || k.dataset.filter === 'open' ? '' : k.dataset.filter;
    toon();
    document.querySelector('.titel:last-of-type')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  document.addEventListener('change', async (e) => {
    const vink = e.target.closest('[data-klaar]');
    if (!vink) return;
    try { await doe({ op: 'klaar', id: vink.dataset.klaar, klaar: vink.checked }); if (vink.checked) toast('Afgevinkt ✓'); }
    catch (err) { if (err.message !== 'pin') { $('#melding').textContent = err.message; toon(); } }
  });
  document.addEventListener('click', (e) => {
    const k = e.target.closest('[data-open]');
    if (k) openFormulier((staat.taken || []).find((t) => t.id === k.dataset.open));
    if (e.target.closest('[data-sluit]')) $('#formulier').close();
  });
  $('#nieuw').addEventListener('click', () => openFormulier(null));

  let bewerk = null;
  function openFormulier(t) {
    bewerk = t || null;
    const f = $('#f');
    f.soort.innerHTML = (staat.soorten || []).map((s) => `<option>${esc(s)}</option>`).join('');
    f.titel.value = t ? t.titel : '';
    f.soort.value = t ? t.soort : (staat.soorten || [])[0] || '';
    f.tegen.value = t ? t.tegen : '';
    f.dringend.checked = Boolean(t && t.dringend);
    f.wachtOp.value = t ? t.wachtOp : '';
    f.notitie.value = t ? t.notitie : '';
    $('#f-titel').textContent = t ? 'Taak aanpassen' : 'Nieuwe taak';
    $('#f-bewaar').textContent = t ? 'Opslaan' : 'Toevoegen';
    $('#f-wis').hidden = !t;
    $('#f-fout').textContent = '';
    $('#formulier').showModal();
    if (!t) f.titel.focus();
  }
  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const taak = { titel: f.titel.value, soort: f.soort.value, tegen: f.tegen.value, dringend: f.dringend.checked, wachtOp: f.wachtOp.value, notitie: f.notitie.value };
    try {
      await doe(bewerk ? { op: 'wijzig', id: bewerk.id, taak } : { op: 'nieuw', taak });
      $('#formulier').close();
      toast(bewerk ? 'Opgeslagen' : 'Taak toegevoegd');
    } catch (err) { if (err.message !== 'pin') $('#f-fout').textContent = err.message; }
  });
  $('#f-wis').addEventListener('click', async () => {
    if (!bewerk || !confirm('Deze taak wissen?')) return;
    try { await doe({ op: 'wis', id: bewerk.id }); $('#formulier').close(); toast('Taak gewist'); }
    catch (err) { if (err.message !== 'pin') $('#f-fout').textContent = err.message; }
  });

  // Bij terugkeren naar de app: de laatste stand ophalen (een ander toestel kan iets gewijzigd hebben).
  document.addEventListener('visibilitychange', () => { if (!document.hidden && pin && !$('#app').hidden && !$('#formulier').open) laad().catch(() => {}); });

  if (pin) laad().catch((err) => { if (err.message !== 'pin') vergrendel(err.message); });
  else vergrendel('');
})();
