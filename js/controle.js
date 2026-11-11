/* Assessmentplanner — controlevoorbeelden voor de rekenkern. */
(function (root) {
  'use strict';
  const AP = root.AP, M = AP.model, R = AP.rekenen;

  function bouw(assessments, docenten, klassen, tv) {
    const m = M.leegModel();
    if (tv) { m.tijdvakken = tv.map((l, i) => ({ id: 'T' + i, label: l, uren: 4 })); }
    const ids = m.tijdvakken.map(t => t.id);
    M.plakAssessments(m, assessments.map(a => a.join('\t')).join('\n'));
    const zet = (soort, obj) => Object.keys(obj).forEach(n => { const r = M.vindRes(m, soort, n) || (soort === 'docent' ? m.docenten : m.klassen)[(soort === 'docent' ? m.docenten : m.klassen).push({ naam: n, beschikbaar: [] }) - 1]; r.beschikbaar = obj[n] === '*' ? ids.slice() : obj[n].map(i => ids[i]); });
    zet('docent', docenten); zet('klas', klassen);
    return m;
  }
  const ids = r => r.volgorde.map(x => x.id).join(' ');

  const controles = [
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
      const m = M.leegModel(); M.plakAssessments(m, 'Statistiek\t1A\tJansen\t3'); M.zetRijBeschikbaar(m, 'klas', '1A', true);
      const r = R.analyseer(m); return { ok: r.fouten.some(f => /Jansen/.test(f.bron)), detail: r.fouten.map(f => f.bron).join('; ') }; } },
    { naam: 'Inplannen verkleint de ruimte', uitleg: 'Na het inplannen van een assessment zijn die tijdvakken bezet voor dezelfde docent en klas.', test() {
      const m = bouw([['A', '1A', 'Jansen', '4'], ['B', '1A', 'De Vries', '4']], { Jansen: [0, 1], 'De Vries': [0, 1] }, { '1A': [0, 1] });
      const voor = R.analyseer(m).volgorde.find(x => x.id === 'S002').overlap;
      M.plan(m, 'S001', [m.tijdvakken[0].id]);
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
      return { ok: v1 === v2, detail: v1 }; } }
  ];

  function draaiAlle() {
    return controles.map(c => { try { const r = c.test(); return { naam: c.naam, uitleg: c.uitleg, ok: !!r.ok, detail: r.detail }; } catch (e) { return { naam: c.naam, uitleg: c.uitleg, ok: false, detail: 'Fout: ' + e.message }; } });
  }
  AP.controle = { controles, draaiAlle };
})(typeof window !== 'undefined' ? window : globalThis);
