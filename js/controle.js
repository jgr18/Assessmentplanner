/* Assessmentplanner — controlevoorbeelden voor de rekenkern. */
(function (root) {
  'use strict';
  const AP = root.AP, M = AP.model, R = AP.rekenen;

  function bouw(assessments, docenten, klassen, tv) {
    const m = M.leegModel();
    if (tv) { m.tijdvakken = tv.map((l, i) => ({ id: 'T' + i, label: l, uren: 4 })); }
    else m.tijdvakken.forEach(t => { t.uren = 4; }); /* controles rekenen met vaste blokken van 4 uur */
    const ids = m.tijdvakken.map(t => t.id);
    M.plakAssessments(m, assessments.map(a => a.join('\t')).join('\n'));
    const zet = (soort, obj) => Object.keys(obj).forEach(n => { const r = M.vindRes(m, soort, n) || (soort === 'docent' ? m.docenten : m.klassen)[(soort === 'docent' ? m.docenten : m.klassen).push({ naam: n, beschikbaar: [] }) - 1]; r.beschikbaar = obj[n] === '*' ? ids.slice() : obj[n].map(i => ids[i]); });
    zet('docent', docenten); zet('klas', klassen);
    m.locaties = [{ naam: 'Enschede', lokalen: 10, perTijdvak: {} }, { naam: 'Deventer', lokalen: 1, perTijdvak: {} }];
    m.klassen.forEach(k => { if (!k.locatie) k.locatie = 'Enschede'; });
    return m;
  }
  const ids = r => r.volgorde.map(x => x.id).join(' ');

  const controles = [
    { naam: 'Nieuwe docent en klas standaard volledig beschikbaar', uitleg: 'Docenten en klassen die via een assessment ontstaan, zijn in elk tijdvak beschikbaar.', test() {
      const m = M.leegModel(); M.plakAssessments(m, 'Statistiek\t1A\tJansen\t3'); const n = m.tijdvakken.length;
      return { ok: M.vindRes(m, 'docent', 'Jansen').beschikbaar.length === n && M.vindRes(m, 'klas', '1A').beschikbaar.length === n, detail: 'Jansen ' + M.vindRes(m, 'docent', 'Jansen').beschikbaar.length + '/' + n + ' tijdvakken' }; } },
    { naam: 'Krapste assessment eerst', uitleg: 'Een docent met één beschikbaar dagdeel komt bovenaan.', test() {
      const m = bouw([['Ruim', '1A', 'Bakker', '2'], ['Krap', '1B', 'Jansen', '3']], { Bakker: '*', Jansen: [2] }, { '1A': '*', '1B': '*' });
      const r = R.analyseer(m); return { ok: r.volgorde[0].module === 'Krap', detail: ids(r) }; } },
    { naam: 'Uitwaaiering via gedeelde klas', uitleg: 'Na het krappe assessment volgt het assessment dat dezelfde (drukke) klas deelt, vóór een los assessment.', test() {
      const m = bouw([['Krap', '1A', 'Jansen', '3'], ['Los', '3B', 'Peters', '1'], ['Zelfde klas', '1A', 'De Vries', '6']], { Jansen: [2], Peters: '*', 'De Vries': '*' }, { '1A': [0, 1, 2, 3, 4], '3B': '*' });
      const r = R.analyseer(m); return { ok: ids(r) === 'S001 S003 S002' && r.volgorde[1].volgtUit && r.volgorde[1].volgtUit.id === 'S001', detail: ids(r) + ' · volgt uit: ' + (r.volgorde[1].volgtUit ? r.volgorde[1].volgtUit.id + ' via ' + r.volgorde[1].volgtUit.via.naam : '—') }; } },
    { naam: 'Meerdere docenten tegelijk', uitleg: 'Bij een assessment met twee docenten telt alleen de tijd waarin beiden én de klas beschikbaar zijn.', test() {
      const m = bouw([['Panel', '2A', 'Visser; Smit', '4']], { Visser: [0, 1, 2], Smit: [2, 3, 4] }, { '2A': '*' });
      const r = R.analyseer(m), it = r.volgorde[0]; return { ok: it.overlap === 4 && it.krapte === 1, detail: 'overlap ' + it.overlap + ' uur, krapte ' + it.krapte }; } },
    { naam: 'Past niet: duidelijke melding', uitleg: 'Als klas en docent nooit tegelijk kunnen, volgt een fout met herstelactie.', test() {
      const m = bouw([['Onmogelijk', '1B', 'Visser', '2']], { Visser: [8, 9] }, { '1B': [0, 1] });
      const r = R.analyseer(m); return { ok: r.fouten.length === 1 && !r.volgorde[0].past, detail: r.fouten[0] ? r.fouten[0].melding : 'geen fout' }; } },
    { naam: 'Ontbrekende beschikbaarheid gemeld', uitleg: 'Een docent zonder ingevulde beschikbaarheid geeft een fout met bron.', test() {
      const m = M.leegModel(); M.plakAssessments(m, 'Statistiek\t1A\tJansen\t3\tEnschede'); M.zetRijBeschikbaar(m, 'docent', 'Jansen', false);
      const r = R.analyseer(m); return { ok: r.fouten.some(f => /Jansen/.test(f.bron)), detail: r.fouten.map(f => f.bron).join('; ') }; } },
    { naam: 'Inplannen verkleint de ruimte', uitleg: 'Na het inplannen van een assessment zijn die tijdvakken bezet voor dezelfde docent en klas.', test() {
      const m = bouw([['A', '1A', 'Jansen', '4'], ['B', '1A', 'De Vries', '4']], { Jansen: [0, 1], 'De Vries': [0, 1] }, { '1A': [0, 1] });
      const voor = R.analyseer(m).volgorde.find(x => x.id === 'S002').overlap;
      M.plan(m, 'S001', [{ tv: m.tijdvakken[0].id, uren: 4, lokaal: 1 }]);
      const r = R.analyseer(m), na = r.volgorde.find(x => x.id === 'S002').overlap;
      return { ok: voor === 8 && na === 4 && r.gepland.length === 1 && r.volgorde.length === 1, detail: 'overlap S002 ' + voor + ' → ' + na + ' uur' }; } },
    { naam: 'Zwakke koppeling maakt geen eiland', uitleg: 'Twee assessments die alleen een ruime docent delen, blijven los.', test() {
      const m = bouw([['A', '1A', 'Bakker', '1'], ['B', '2A', 'Bakker', '1']], { Bakker: '*' }, { '1A': '*', '2A': '*' });
      const r = R.analyseer(m); return { ok: r.eilanden === 0 && r.los === 2 && !!r.kop('S001', 'S002'), detail: r.eilanden + ' eilanden, ' + r.los + ' los' }; } },
    { naam: 'Plakken met fouten per regel', uitleg: 'Een regel met ongeldige uren wordt geweigerd met regelnummer; de rest wordt toegevoegd.', test() {
      const m = M.leegModel(); const res = M.plakAssessments(m, 'Module\tKlas\tDocent\tUren\nStatistiek\t1A\tJansen\t3\nOnderzoek\t1A\tDe Vries\tveel');
      return { ok: res.toegevoegd.length === 1 && res.fouten.length === 1 && /regel 3/.test(res.fouten[0].bron), detail: res.fouten.map(f => f.bron + ': ' + f.melding).join('; ') }; } },
    { naam: 'Volgorde onafhankelijk van invoervolgorde', uitleg: 'Dezelfde gegevens in andere volgorde geven dezelfde planningsvolgorde (alleen bij exacte gelijkstand beslist de ID).', test() {
      const regels = [['Krap', '1A', 'Jansen', '3'], ['Mid', '1A', 'De Vries', '4'], ['Mid2', '1B', 'De Vries', '5'], ['Los', '3B', 'Peters', '1']];
      const d = { Jansen: [2], 'De Vries': [0, 1, 2, 3, 4, 5], Peters: '*' }, k = { '1A': '*', '1B': [0, 1, 2, 3, 4, 5], '3B': '*' };
      const v1 = R.analyseer(bouw(regels, d, k)).volgorde.map(x => x.module).join(' ');
      const v2 = R.analyseer(bouw(regels.slice().reverse(), d, k)).volgorde.map(x => x.module).join(' ');
      return { ok: v1 === v2, detail: v1 }; } },
    { naam: 'Drie assessments van 2 uur in één lokaal', uitleg: 'Een dagdeel van 6 lesuren met 1 lokaal biedt na twee geplande assessments van 2 uur nog ruimte voor een derde, in hetzelfde lokaal.', test() {
      const m = bouw([['A', '1A', 'P', '2'], ['B', '1B', 'Q', '2'], ['C', '1C', 'R', '2']], { P: [0], Q: [0], R: [0] }, { '1A': [0], '1B': [0], '1C': [0] }, ['ma-o']);
      m.tijdvakken[0].uren = 6; m.klassen.forEach(k => { k.locatie = 'Deventer'; });
      M.plan(m, 'S001', [{ tv: 'T0', uren: 2, lokaal: 1 }]); M.plan(m, 'S002', [{ tv: 'T0', uren: 2, lokaal: 1 }]);
      const r = R.analyseer(m), it = r.volgorde[0];
      return { ok: it.past && it.opties[0].segmenten[0].lokaal === 1, detail: 'S003: ' + (it.opties[0] ? 'lokaal ' + it.opties[0].segmenten[0].lokaal + ', ' + it.opties[0].segmenten[0].uren + ' u' : 'past niet') }; } },
    { naam: 'Geen lokaal vrij is geen beletsel, wel een melding', uitleg: 'Bij 1 lokaal van 6 lesuren past na een assessment van 4 uur geen tweede van 4 uur in dat lokaal. Het tweede kan toch worden ingepland, in een extra lokaal; daarna volgt de melding dat er een lokaal extra nodig is.', test() {
      const m = bouw([['A', '1A', 'P', '4'], ['B', '1B', 'Q', '4']], { P: [0], Q: [0] }, { '1A': [0], '1B': [0] }, ['ma-o']);
      m.tijdvakken[0].uren = 6; m.klassen.forEach(k => { k.locatie = 'Deventer'; }); m.locaties.find(l => l.naam === 'Deventer').lokalen = 1;
      M.plan(m, 'S001', [{ tv: 'T0', uren: 4, lokaal: 1 }]);
      const r = R.analyseer(m), it = r.volgorde[0], o = it.opties[0];
      if (!it.past || !o.extraLokaal || o.segmenten[0].lokaal !== 2) return { ok: false, detail: 'optie: ' + JSON.stringify(o) };
      M.plan(m, 'S002', o.segmenten); const r2 = R.analyseer(m);
      return { ok: r2.lokaalTekort.length === 1 && r2.lokaaldruk.find(x => x.locatie === 'Deventer').extra >= 1 && r2.waarschuwingen.some(w => /extra nodig/.test(w.melding)), detail: r2.waarschuwingen.map(w => w.melding).join(' ') }; } },
    { naam: 'Doorlopen over ochtend en middag', uitleg: 'Een assessment van 12 uur vult ochtend (6) en middag (6) van dezelfde dag.', test() {
      const m = bouw([['Groot', '1A', 'P', '12']], { P: '*' }, { '1A': '*' }, ['ma-o', 'ma-m', 'di-o', 'di-m']);
      m.tijdvakken.forEach(t => { t.uren = 6; });
      const r = R.analyseer(m), o = r.volgorde[0].opties[0];
      return { ok: !!o && o.segmenten.length === 2 && o.segmenten.every(s => s.uren === 6) && R.dagVan(m.tijdvakken.find(t => t.id === o.segmenten[0].tv)) === R.dagVan(m.tijdvakken.find(t => t.id === o.segmenten[1].tv)), detail: o ? o.segmenten.map(s => s.tv + ':' + s.uren + 'u').join(' + ') : 'geen optie' }; } },
    { naam: 'Gedeeltelijk ochtend en middag', uitleg: 'Een assessment van 3 uur kan 2 uur aan het eind van de ochtend en 1 uur aan het begin van de middag beslaan als er maar 2 uur vrij is in de ochtend.', test() {
      const m = bouw([['Vol', '1A', 'P', '4'], ['Drie', '1A', 'P', '3']], { P: [0, 1] }, { '1A': [0, 1] }, ['ma-o', 'ma-m']);
      m.tijdvakken.forEach(t => { t.uren = 6; }); M.plan(m, 'S001', [{ tv: 'T0', uren: 4, lokaal: 1 }]); M.plan(m, 'S001', [{ tv: 'T0', uren: 4, lokaal: 1 }]);
      const r = R.analyseer(m), span = r.volgorde[0].opties.find(o => o.span);
      return { ok: !!span && span.segmenten[0].uren === 2 && span.segmenten[1].uren === 1, detail: span ? span.segmenten.map(s => s.tv + ':' + s.uren + 'u').join(' + ') : 'geen doorlopende optie' }; } },
    { naam: 'Waarschuwing bij twee locaties op één dag', uitleg: 'Als een docent die dag al op een andere locatie is, krijgt de plaatsing een waarschuwing en komt ze achteraan.', test() {
      const m = bouw([['A', '1A', 'P', '2'], ['B', '2A', 'P', '2']], { P: [0] }, { '1A': [0], '2A': [0, 1] }, ['ma-o', 'ma-m']);
      m.tijdvakken.forEach(t => { t.uren = 6; }); M.vindRes(m, 'klas', '2A').locatie = 'Deventer'; M.vindRes(m, 'docent', 'P').beschikbaar = ['T0', 'T1'];
      M.plan(m, 'S001', [{ tv: 'T0', uren: 2, lokaal: 1 }]);
      const r = R.analyseer(m), it = r.volgorde[0];
      return { ok: it.opties.length > 0 && it.opties.every(o => !!o.waarschuwing) && it.alleenMetWissel, detail: it.opties[0] ? it.opties[0].waarschuwing : 'geen opties' }; } },
    { naam: 'Lokaaldruk wijst dagdeel aan voor extra lokaal', uitleg: 'Als in een dagdeel meer lokaaluren nodig zijn dan er zijn, adviseert de analyse extra lokalen voor dat dagdeel.', test() {
      const regels = []; for (let i = 0; i < 4; i++) regels.push(['M' + i, 'K' + i, 'D' + i, '6']);
      const d = {}, k = {}; for (let i = 0; i < 4; i++) { d['D' + i] = [0]; k['K' + i] = [0]; }
      const m = bouw(regels, d, k, ['ma-o', 'ma-m']); m.tijdvakken.forEach(t => { t.uren = 6; }); m.klassen.forEach(x => { x.locatie = 'Deventer'; }); m.locaties[1].lokalen = 2;
      const r = R.analyseer(m), x = r.lokaaldruk.find(y => y.locatie === 'Deventer' && y.tv === 'T0');
      return { ok: x.extra === 2, detail: 'Deventer ma-o: ' + x.lokalen + ' lokalen, druk ' + Math.round(x.druk * 100) + '%, advies +' + x.extra }; } },
    { naam: 'Locatie uit eerste letter van de klas', uitleg: 'Klas E1A hoort bij Enschede, D2B bij Deventer en A3A bij Apeldoorn, zonder dat de locatie is ingevuld.', test() {
      const m = M.leegModel(); M.plakAssessments(m, 'Een\tE1A\tP\t2\nTwee\tD2B\tQ\t2\nDrie\tA3A\tR\t2');
      const l = ['E1A', 'D2B', 'A3A'].map(k => M.vindRes(m, 'klas', k).locatie);
      return { ok: l.join(',') === 'Enschede,Deventer,Apeldoorn', detail: l.join(', ') }; } },
    { naam: 'Klas zonder locatie gemeld', uitleg: 'Een klas zonder locatie geeft een fout met herstelactie.', test() {
      const m = M.leegModel(); M.plakAssessments(m, 'Statistiek\t1A\tJansen\t3');
      const r = R.analyseer(m); return { ok: r.fouten.some(f => /locatie/.test(f.melding)), detail: r.fouten.map(f => f.bron).join('; ') }; } }
  ];

  function draaiAlle() {
    return controles.map(c => { try { const r = c.test(); return { naam: c.naam, uitleg: c.uitleg, ok: !!r.ok, detail: r.detail }; } catch (e) { return { naam: c.naam, uitleg: c.uitleg, ok: false, detail: 'Fout: ' + e.message }; } });
  }
  AP.controle = { controles, draaiAlle };
})(typeof window !== 'undefined' ? window : globalThis);
