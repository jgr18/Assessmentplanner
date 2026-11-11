/* Assessmentplanner — inhoud van de Excel-export. */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};

  const KOP = { vet: true, vulling: 'E6E6E1', rand: true };
  const kleurVan = (w, drempel) => w === Infinity || w >= 0.5 ? 'EF9F27' : w >= 0.3 ? 'FAC775' : w > drempel ? 'FAEEDA' : null;
  const getal = (v, stijl) => ({ v: v === Infinity ? 'geen ruimte' : v, stijl: Object.assign({ rand: true }, stijl || {}, v === Infinity ? {} : (stijl && stijl.getal ? {} : {})) });
  const pct = (v, extra) => v === Infinity ? { v: 'geen ruimte', stijl: Object.assign({ rand: true, kleur: '9B2C1C' }, extra) } : { v: Math.round(v * 1000) / 1000, stijl: Object.assign({ rand: true, getal: 9 }, extra) };
  const tvLabel = (m, ids) => ids.map(id => (m.tijdvakken.find(t => t.id === id) || { label: id }).label).join(', ');
  const letter = k => (k.gedeeld.some(g => g.soort === 'docent') ? 'D' : '') + (k.gedeeld.some(g => g.soort === 'klas') ? 'K' : '');

  function bladen(m, r) {
    const R = AP.rekenen, datum = new Date().toLocaleString('nl-NL');
    const bron = m.naam + ' · invoerversie ' + m.invoerversie + ' · drempel eilanden ' + Math.round(r.drempel * 100) + '% · ' + datum;

    /* 1. Planningsvolgorde */
    const v = [[{ v: 'Planningsvolgorde', stijl: { vet: true } }], [bron], []];
    v.push(['Volg.', 'ID', 'Module', 'Klas/groep', 'Docent(en)', 'Uren', 'Samen beschikbaar (uur)', 'Krapte', 'Prioriteit', 'Knelpunt', 'Eiland', 'Volgt uit', 'Gepland op (in te vullen)'].map(x => ({ v: x, stijl: KOP })));
    let vorig = null;
    r.volgorde.forEach(it => {
      const s = Object.assign({ rand: true }, vorig !== null && it.eiland !== vorig ? { randBoven: 'dik' } : {});
      const prioVul = kleurVan(it.prio, -1);
      v.push([
        { v: it.volgnummer, stijl: s }, { v: it.id, stijl: Object.assign({ vet: true }, s) }, { v: it.module, stijl: s }, { v: it.klas, stijl: s },
        { v: it.docenten.join('; '), stijl: s }, { v: it.uren, stijl: s }, { v: it.overlap, stijl: Object.assign({}, s, it.past ? {} : { kleur: '9B2C1C', vet: true }) },
        it.krapte === Infinity ? { v: 'past niet', stijl: Object.assign({ kleur: '9B2C1C', vet: true }, s) } : { v: Math.round(it.krapte * 100) / 100, stijl: Object.assign({ getal: 2 }, s) },
        it.prio === Infinity ? { v: 'geen ruimte', stijl: Object.assign({ kleur: '9B2C1C', vet: true }, s) } : { v: Math.round(it.prio * 100) / 100, stijl: Object.assign({ getal: 2 }, s, prioVul ? { vulling: prioVul } : {}) },
        { v: it.knelpunt, stijl: s }, { v: it.eiland === 'los' ? 'los / vulling' : it.eiland, stijl: s },
        { v: it.volgtUit ? it.volgtUit.id + ' via ' + (it.volgtUit.via.soort === 'docent' ? 'docent ' : 'klas ') + it.volgtUit.via.naam : '', stijl: s },
        { v: '', stijl: s }
      ]);
      vorig = it.eiland;
    });
    if (r.gepland.length) {
      v.push([], [{ v: 'Al gepland', stijl: { vet: true } }]);
      v.push(['', 'ID', 'Module', 'Klas/groep', 'Docent(en)', 'Uren', 'Gepland in'].map(x => ({ v: x, stijl: KOP })));
      r.gepland.forEach(g => v.push([{ v: '', stijl: { rand: true } }, { v: g.id, stijl: { rand: true, vet: true } }, { v: g.module, stijl: { rand: true } }, { v: g.klas, stijl: { rand: true } }, { v: g.docenten.join('; '), stijl: { rand: true } }, { v: g.uren, stijl: { rand: true } }, { v: tvLabel(m, g.gepland), stijl: { rand: true } }]));
    }
    if (r.fouten.length || r.waarschuwingen.length) {
      v.push([], [{ v: 'Meldingen', stijl: { vet: true } }]);
      r.fouten.forEach(f => v.push([{ v: 'Fout', stijl: { kleur: '9B2C1C', vet: true } }, f.bron, '', '', f.melding + ' Herstel: ' + f.herstel]));
      r.waarschuwingen.forEach(f => v.push([{ v: 'Let op', stijl: { kleur: '854F0B', vet: true } }, f.bron, '', '', f.melding + ' ' + f.herstel]));
    }
    v.push([], ['Leeswijzer: krapte = uren ÷ uren waarin klas en alle docenten tegelijk beschikbaar zijn. Prioriteit = hoogste van krapte en bezetting van de betrokken docenten en klas.'],
      ['Plan per eiland van boven naar beneden; "volgt uit" noemt het eerder geplaatste assessment en de gedeelde docent of klas waardoor dit assessment erna komt. "Los / vulling" kan in de overgebleven ruimte.']);

    /* 2. Afhankelijkheden (matrix) */
    const ord = r.volgorde;
    const a = [[{ v: 'Afhankelijkheden', stijl: { vet: true } }], [bron], []];
    a.push([{ v: 'Eiland', stijl: KOP }, { v: 'ID', stijl: KOP }, { v: 'Assessment', stijl: KOP }].concat(ord.map(x => ({ v: x.id, stijl: Object.assign({ midden: true }, KOP) }))));
    vorig = null;
    ord.forEach(x => {
      const top = vorig !== null && x.eiland !== vorig ? { randBoven: 'dik' } : {};
      const rij = [{ v: x.eiland === 'los' ? 'los' : x.eiland, stijl: Object.assign({ rand: true }, top) }, { v: x.id, stijl: Object.assign({ rand: true, vet: true }, top) },
        { v: x.module + ' · ' + x.klas + ' · ' + x.docenten.join('; '), stijl: Object.assign({ rand: true }, top) }];
      ord.forEach(y => {
        if (x.id === y.id) { rij.push({ v: '', stijl: Object.assign({ rand: true, vulling: '2B2B2B' }, top) }); return; }
        const k = r.kop(x.id, y.id);
        if (!k) { rij.push({ v: '', stijl: Object.assign({ rand: true }, top) }); return; }
        const vul = kleurVan(k.gewicht, r.drempel);
        rij.push({ v: vul ? letter(k) : '·', stijl: Object.assign({ rand: true, midden: true }, top, vul ? { vulling: vul, kleur: '412402', vet: true } : { kleur: '888780' }) });
      });
      a.push(rij); vorig = x.eiland;
    });
    a.push([], [{ v: 'Legenda', stijl: { vet: true } }],
      [{ v: 'D', stijl: { vulling: 'FAC775', kleur: '412402', vet: true, midden: true, rand: true } }, 'Koppeling via gedeelde docent (K = klas, DK = beide)'],
      [{ v: '', stijl: { vulling: 'EF9F27', rand: true } }, 'Gedeelde docent/klas ≥ 50% bezet'],
      [{ v: '', stijl: { vulling: 'FAC775', rand: true } }, '30–50% bezet'],
      [{ v: '', stijl: { vulling: 'FAEEDA', rand: true } }, 'Boven de drempel (' + Math.round(r.drempel * 100) + '%) tot 30%'],
      [{ v: '·', stijl: { kleur: '888780', midden: true, rand: true } }, 'Zwakke koppeling (onder de drempel): telt niet mee voor eilanden'],
      [{ v: '', stijl: { vulling: '2B2B2B', rand: true } }, 'Diagonaal'],
      ['', 'Dikke lijn = grens tussen planningseilanden. Precieze percentages per koppeling: tabblad Koppelingen.']);

    /* 3. Koppelingen */
    const k = [[{ v: 'Koppelingen', stijl: { vet: true } }], [bron], []];
    k.push(['Assessment', 'Assessment', 'Via', 'Naam', 'Bezetting gedeelde docent/klas', 'Telt voor eiland'].map(x => ({ v: x, stijl: KOP })));
    const pos = {}; ord.forEach((x, i) => { pos[x.id] = i; });
    Object.keys(r.koppeling).map(s => { const [p, q] = s.split('|'); return pos[p] <= pos[q] ? [p, q, r.koppeling[s]] : [q, p, r.koppeling[s]]; })
      .sort((x, y) => (y[2].gewicht - x[2].gewicht) || (pos[x[0]] - pos[y[0]]))
      .forEach(([p, q, kk]) => kk.gedeeld.forEach((g, gi) => k.push([{ v: p, stijl: { rand: true, vet: gi === 0 } }, { v: q, stijl: { rand: true, vet: gi === 0 } }, { v: g.soort, stijl: { rand: true } }, { v: g.naam, stijl: { rand: true } }, pct(g.graad), { v: kk.gewicht > r.drempel ? 'ja' : 'nee', stijl: { rand: true } }])));

    /* 4. Bezetting */
    const b = [[{ v: 'Bezetting docenten en klassen', stijl: { vet: true } }], [bron], ['Nodig = uren van nog niet geplande assessments; beschikbaar = beschikbare uren min de al geplande tijdvakken.'], []];
    b.push(['Soort', 'Naam', 'Assessments (open)', 'Nodig (uur)', 'Beschikbaar (uur)', 'Bezetting', 'Beschikbaar totaal (uur)'].map(x => ({ v: x, stijl: KOP })));
    r.bezetting.forEach(x => b.push([{ v: x.soort, stijl: { rand: true } }, { v: x.naam, stijl: { rand: true, vet: true } }, { v: x.aantal, stijl: { rand: true } }, { v: x.nodig, stijl: { rand: true } }, { v: x.beschikbaar, stijl: { rand: true } }, pct(x.graad, kleurVan(x.graad, -1) && x.graad >= 0.3 ? { vulling: kleurVan(x.graad, -1) } : {}), { v: x.totaalBeschikbaar, stijl: { rand: true } }]));

    return [
      { naam: 'Planningsvolgorde', rijen: v, kolommen: [7, 8, 24, 13, 26, 7, 12, 9, 10, 26, 13, 26, 24], bevries: { y: 4 }, liggend: true },
      { naam: 'Afhankelijkheden', rijen: a, kolommen: [8, 8, 42].concat(ord.map(() => 6)), bevries: { x: 3, y: 4 }, liggend: true },
      { naam: 'Koppelingen', rijen: k, kolommen: [12, 12, 9, 18, 14, 14], bevries: { y: 4 } },
      { naam: 'Bezetting', rijen: b, kolommen: [9, 20, 12, 12, 14, 12, 16], bevries: { y: 5 } }
    ];
  }

  AP.export = { bladen };
})(typeof window !== 'undefined' ? window : globalThis);
