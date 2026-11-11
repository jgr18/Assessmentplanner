/* Assessmentplanner — inhoud van de Excel-export. */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};

  const KOP = { vet: true, vulling: 'E6E6E1', rand: true };
  const kleurVan = (w, drempel) => w === Infinity || w >= 0.5 ? 'EF9F27' : w >= 0.3 ? 'FAC775' : w > drempel ? 'FAEEDA' : null;
  const getal = (v, stijl) => ({ v: v === Infinity ? 'geen ruimte' : v, stijl: Object.assign({ rand: true }, stijl || {}, v === Infinity ? {} : (stijl && stijl.getal ? {} : {})) });
  const pct = (v, extra) => v === Infinity ? { v: 'geen ruimte', stijl: Object.assign({ rand: true, kleur: '9B2C1C' }, extra) } : { v: Math.round(v * 1000) / 1000, stijl: Object.assign({ rand: true, getal: 9 }, extra) };
  const tvLabel = (m, ids) => ids.map(id => (m.tijdvakken.find(t => t.id === id) || { label: id }).label).join(', ');
  const letter = (k, drempel) => { const s = k.gedeeld.filter(g => g.graad > drempel).map(g => g.soort); return (s.includes('docent') ? 'D' : '') + (s.includes('klas') ? 'K' : '') + (s.includes('locatie') ? 'L' : ''); };
  const resNaam = g => (g.soort === 'docent' ? 'docent ' : g.soort === 'klas' ? 'klas ' : 'lokalen ') + g.naam;
  const segTekst = (m, segs) => segs.map(s => (m.tijdvakken.find(t => t.id === s.tv) || { label: s.tv }).label + ' ' + String(s.uren).replace('.', ',') + 'u lokaal ' + s.lokaal).join(' + ');

  function bladen(m, r) {
    const R = AP.rekenen, datum = new Date().toLocaleString('nl-NL');
    const bron = m.naam + ' · invoerversie ' + m.invoerversie + ' · drempel eilanden ' + Math.round(r.drempel * 100) + '% · ' + datum;

    /* 1. Planningsvolgorde */
    const v = [[{ v: 'Planningsvolgorde', stijl: { vet: true } }], [bron], []];
    v.push(['Volg.', 'ID', 'Module', 'Klas/groep', 'Locatie', 'Docent(en)', 'Uren', 'Samen beschikbaar (uur)', 'Krapte', 'Prioriteit', 'Knelpunt', 'Eiland', 'Volgt uit', 'Gepland op (in te vullen)'].map(x => ({ v: x, stijl: KOP })));
    let vorig = null;
    r.volgorde.forEach(it => {
      const s = Object.assign({ rand: true }, vorig !== null && it.eiland !== vorig ? { randBoven: 'dik' } : {});
      const prioVul = kleurVan(it.prio, -1);
      v.push([
        { v: it.volgnummer, stijl: s }, { v: it.id, stijl: Object.assign({ vet: true }, s) }, { v: it.module, stijl: s }, { v: it.klas, stijl: s }, { v: it.locatie, stijl: s },
        { v: it.docenten.join('; '), stijl: s }, { v: it.uren, stijl: s }, { v: it.overlap, stijl: Object.assign({}, s, it.past ? {} : { kleur: '9B2C1C', vet: true }) },
        it.krapte === Infinity ? { v: 'past niet', stijl: Object.assign({ kleur: '9B2C1C', vet: true }, s) } : { v: Math.round(it.krapte * 100) / 100, stijl: Object.assign({ getal: 2 }, s) },
        it.prio === Infinity ? { v: 'geen ruimte', stijl: Object.assign({ kleur: '9B2C1C', vet: true }, s) } : { v: Math.round(it.prio * 100) / 100, stijl: Object.assign({ getal: 2 }, s, prioVul ? { vulling: prioVul } : {}) },
        { v: it.knelpunt, stijl: s }, { v: it.eiland === 'los' ? 'los / vulling' : it.eiland, stijl: s },
        { v: it.volgtUit ? it.volgtUit.id + ' via ' + resNaam(it.volgtUit.via) : '', stijl: s },
        { v: '', stijl: s }
      ]);
      vorig = it.eiland;
    });
    if (r.gepland.length) {
      v.push([], [{ v: 'Al gepland', stijl: { vet: true } }]);
      v.push(['', 'ID', 'Module', 'Klas/groep', 'Locatie', 'Docent(en)', 'Uren', 'Ingepast in'].map(x => ({ v: x, stijl: KOP })));
      r.gepland.forEach(g => v.push([{ v: '', stijl: { rand: true } }, { v: g.id, stijl: { rand: true, vet: true } }, { v: g.module, stijl: { rand: true } }, { v: g.klas, stijl: { rand: true } }, { v: g.locatie, stijl: { rand: true } }, { v: g.docenten.join('; '), stijl: { rand: true } }, { v: g.uren, stijl: { rand: true } }, { v: segTekst(m, g.segmenten), stijl: { rand: true } }]));
    }
    if (r.fouten.length || r.waarschuwingen.length) {
      v.push([], [{ v: 'Meldingen', stijl: { vet: true } }]);
      r.fouten.forEach(f => v.push([{ v: 'Fout', stijl: { kleur: '9B2C1C', vet: true } }, f.bron, '', '', f.melding + ' Herstel: ' + f.herstel]));
      r.waarschuwingen.forEach(f => v.push([{ v: 'Let op', stijl: { kleur: '854F0B', vet: true } }, f.bron, '', '', f.melding + ' ' + f.herstel]));
    }
    v.push([], ['Leeswijzer: krapte = uren ÷ uren waarin klas en alle docenten tegelijk vrij zijn. Prioriteit = hoogste van krapte en bezetting van de betrokken docenten en klas. Lokalen tellen niet mee (bij te vragen); zie het tabblad Lokalen per dagdeel.'],
      ['Plan per eiland van boven naar beneden; "volgt uit" noemt het eerder geplaatste assessment en de gedeelde docent of klas waardoor dit assessment erna komt. "Los / vulling" kan in de overgebleven ruimte.']);

    /* 2. Afhankelijkheden (matrix) */
    const ord = r.volgorde;
    const a = [[{ v: 'Afhankelijkheden', stijl: { vet: true } }], [bron], []];
    a.push([{ v: 'Eiland', stijl: KOP }, { v: 'ID', stijl: KOP }, { v: 'Assessment', stijl: KOP }].concat(ord.map(x => ({ v: x.id, stijl: Object.assign({ midden: true }, KOP) }))));
    vorig = null;
    ord.forEach(x => {
      const top = vorig !== null && x.eiland !== vorig ? { randBoven: 'dik' } : {};
      const rij = [{ v: x.eiland === 'los' ? 'los' : x.eiland, stijl: Object.assign({ rand: true }, top) }, { v: x.id, stijl: Object.assign({ rand: true, vet: true }, top) },
        { v: x.module + ' · ' + x.klas + ' (' + (x.locatie || '?') + ') · ' + x.docenten.join('; '), stijl: Object.assign({ rand: true }, top) }];
      ord.forEach(y => {
        if (x.id === y.id) { rij.push({ v: '', stijl: Object.assign({ rand: true, vulling: '2B2B2B' }, top) }); return; }
        const k = r.kop(x.id, y.id);
        if (!k) { rij.push({ v: '', stijl: Object.assign({ rand: true }, top) }); return; }
        const vul = kleurVan(k.gewicht, r.drempel), alleenLoc = k.gedeeld.every(g => g.soort === 'locatie');
        rij.push({ v: vul ? letter(k, r.drempel) : (alleenLoc ? '' : '·'), stijl: Object.assign({ rand: true, midden: true }, top, vul ? { vulling: vul, kleur: '412402', vet: true } : { kleur: '888780' }) });
      });
      a.push(rij); vorig = x.eiland;
    });
    a.push([], [{ v: 'Legenda', stijl: { vet: true } }],
      [{ v: 'D', stijl: { vulling: 'FAC775', kleur: '412402', vet: true, midden: true, rand: true } }, 'Koppeling via gedeelde docent (K = klas, DK = beide). Lokalen tellen niet mee: die zijn bij te vragen.'],
      [{ v: '', stijl: { vulling: 'EF9F27', rand: true } }, 'Gedeelde docent/klas ≥ 50% bezet'],
      [{ v: '', stijl: { vulling: 'FAC775', rand: true } }, '30–50% bezet'],
      [{ v: '', stijl: { vulling: 'FAEEDA', rand: true } }, 'Boven de drempel (' + Math.round(r.drempel * 100) + '%) tot 30%'],
      [{ v: '·', stijl: { kleur: '888780', midden: true, rand: true } }, 'Zwakke koppeling (onder de drempel): telt niet mee voor eilanden'],
      [{ v: '', stijl: { vulling: '2B2B2B', rand: true } }, 'Diagonaal'],
      ['', 'Dikke lijn = grens tussen planningseilanden. Precieze percentages per koppeling: tabblad Koppelingen.']);

    /* 3. Koppelingen */
    const k = [[{ v: 'Koppelingen', stijl: { vet: true } }], [bron], []];
    k.push(['Assessment', 'Assessment', 'Via', 'Naam', 'Bezetting van wat gedeeld wordt', 'Telt voor eiland'].map(x => ({ v: x, stijl: KOP })));
    const pos = {}; ord.forEach((x, i) => { pos[x.id] = i; });
    Object.keys(r.koppeling).map(s => { const [p, q] = s.split('|'); return pos[p] <= pos[q] ? [p, q, r.koppeling[s]] : [q, p, r.koppeling[s]]; })
      .sort((x, y) => (y[2].gewicht - x[2].gewicht) || (pos[x[0]] - pos[y[0]]))
      .forEach(([p, q, kk]) => kk.gedeeld.forEach((g, gi) => k.push([{ v: p, stijl: { rand: true, vet: gi === 0 } }, { v: q, stijl: { rand: true, vet: gi === 0 } }, { v: g.soort === 'locatie' ? 'lokalen' : g.soort, stijl: { rand: true } }, { v: g.naam, stijl: { rand: true } }, pct(g.graad), { v: kk.gewicht > r.drempel ? 'ja' : 'nee', stijl: { rand: true } }])));

    /* 4. Bezetting: bij invoer (alsof er niets gepland is) en na planning */
    const bezVul = g => g === Infinity || g > 1 ? 'F7C1C1' : g >= 0.5 ? 'EF9F27' : g >= 0.3 ? 'FAC775' : g > 0 ? 'FAEEDA' : null;
    const balk = g => g === Infinity ? '' : '█'.repeat(Math.max(g > 0 ? 1 : 0, Math.min(20, Math.round(g * 20))));
    const bezettingsblad = (res, titel, uitleg, kopNodig) => {
      const b = [[{ v: titel, stijl: { vet: true } }], [bron], [uitleg], []];
      b.push(['Soort', 'Naam', kopNodig, 'Nodig (uur)', 'Vrij (uur)', 'Bezetting', 'Balk', 'Beschikbaar totaal (uur)'].map(x => ({ v: x, stijl: KOP })));
      res.bezetting.forEach(x => b.push([{ v: x.soort === 'docent' ? 'Docent' : x.soort === 'klas' ? 'Klas/groep' : 'Locatie (lokalen)', stijl: { rand: true } }, { v: x.naam, stijl: { rand: true, vet: true } }, { v: x.aantal, stijl: { rand: true } }, { v: x.nodig, stijl: { rand: true } }, { v: x.beschikbaar, stijl: { rand: true } }, pct(x.graad, bezVul(x.graad) ? { vulling: bezVul(x.graad) } : {}), { v: balk(x.graad), stijl: { rand: true, kleur: x.graad > 1 ? 'A32D2D' : 'BA7517' } }, { v: x.totaalBeschikbaar, stijl: { rand: true } }]));
      b.push([], ['Kleur: ≥ 100% rood (meer nodig dan vrij), 50–100% donkeroranje, 30–50% oranje, onder 30% lichtoranje. Balk: 20 blokjes = 100%. Bij een locatie gaat het om lokaaluren (lokalen × lesuren).']);
      return b;
    };
    const r0 = AP.rekenen.analyseerZonderPlanning(m);
    const bInvoer = bezettingsblad(r0, 'Bezetting bij invoer', 'Zoals de invoer is, alsof er nog niets gepland is: nodig = uren van alle assessments, vrij = alle beschikbare uren.', 'Assessments');
    const bNa = bezettingsblad(r, 'Bezetting na planning', r.gepland.length ? 'Na de ' + r.gepland.length + ' al ingeplande assessment(s): nodig = uren van wat nog gepland moet worden, vrij = beschikbare uren min wat al gepland is.' : 'Er is nog niets ingepland; deze bezetting is gelijk aan die bij invoer.', 'Assessments (nog te plannen)');

    /* 5 en 6. Beschikbaarheid docenten en klassen: de basis van de volgorde */
    const beschikbaarheidsblad = soort => {
      const lijst = soort === 'docent' ? m.docenten.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })) : m.klassen.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })), titel = 'Beschikbaarheid ' + (soort === 'docent' ? 'docenten' : 'klassen/groepen');
      const bezet = {};
      m.assessments.filter(x => x.gepland && x.gepland.length).forEach(x => (soort === 'docent' ? x.docenten : [x.klas]).forEach(n => x.gepland.forEach(sg => { const c = ((bezet[n] = bezet[n] || {})[sg.tv] = bezet[n][sg.tv] || { uren: 0, ids: [] }); c.uren += sg.uren; c.ids.push(x.id); })));
      const vrij = {}; r.bezetting.filter(x => x.soort === soort).forEach(x => { vrij[x.naam] = x; });
      const rijen = [[{ v: titel, stijl: { vet: true } }], [bron], ['De beschikbaarheid waarop de planningsvolgorde is gebaseerd. + = beschikbaar; paars = uren al gepland (met assessment-ID); leeg = niet beschikbaar.'], []];
      rijen.push([{ v: soort === 'docent' ? 'Docent' : 'Klas/groep', stijl: KOP }].concat(m.tijdvakken.map(t => ({ v: t.label + ' (' + String(t.uren).replace('.', ',') + 'u)', stijl: Object.assign({ midden: true, terugloop: true }, KOP) })), [{ v: 'Beschikbaar (uur)', stijl: KOP }, { v: 'Vrij na planning (uur)', stijl: KOP }]));
      lijst.forEach(res => rijen.push([{ v: res.naam, stijl: { rand: true, vet: true } }].concat(m.tijdvakken.map(t => {
        const door = bezet[res.naam] && bezet[res.naam][t.id];
        if (door) return { v: String(door.uren).replace('.', ',') + 'u ' + door.ids.join(' '), stijl: { rand: true, midden: true, vulling: 'D3C4F2', kleur: '2A1A57' } };
        return res.beschikbaar.includes(t.id) ? { v: '+', stijl: { rand: true, midden: true, vulling: '1D9E75', kleur: 'FFFFFF', vet: true } } : { v: '', stijl: { rand: true } };
      }), [{ v: vrij[res.naam] ? vrij[res.naam].totaalBeschikbaar : '', stijl: { rand: true } }, { v: vrij[res.naam] ? vrij[res.naam].beschikbaar : '', stijl: { rand: true } }])));
      return { naam: titel.replace('/groepen', ''), rijen, kolommen: [22].concat(m.tijdvakken.map(() => 8), [18, 22]), bevries: { x: 1, y: 5 }, liggend: true };
    };

    /* 7. Lokalen per dagdeel (druk en advies) */
    const ld = [[{ v: 'Lokalen per locatie en dagdeel', stijl: { vet: true } }], [bron],
      ['Per cel: lokalen · druk = (ingepast + verwachte vraag) ÷ lokaaluren · advies extra lokalen. Verwachte vraag is een schatting op basis van wanneer klas en docenten samen vrij zijn.'], []];
    ld.push([{ v: 'Locatie', stijl: KOP }, { v: 'Meting', stijl: KOP }].concat(m.tijdvakken.map(t => ({ v: t.label, stijl: Object.assign({ midden: true }, KOP) })), [{ v: 'Totaal extra', stijl: KOP }]));
    const drukVul = x => x.extra > 0 || x.druk > 1 ? 'F7C1C1' : x.druk >= 0.85 ? 'FAC775' : x.druk >= 0.6 ? 'FAEEDA' : null;
    m.locaties.forEach(l => {
      const cel = l2 => r.lokaaldruk.find(y => y.locatie === l.naam && y.tv === l2.id);
      const tot = r.lokaaldruk.filter(y => y.locatie === l.naam).reduce((s, y) => s + y.extra, 0);
      ld.push([{ v: l.naam, stijl: { rand: true, vet: true, randBoven: 'dik' } }, { v: 'Lokalen', stijl: { rand: true, randBoven: 'dik' } }].concat(m.tijdvakken.map(t => { const x = cel(t); return { v: x.lokalen, stijl: Object.assign({ rand: true, midden: true, randBoven: 'dik' }, x.aangepast ? { kleur: '0C447C', vet: true } : {}) }; }), [{ v: tot, stijl: { rand: true, vet: true, randBoven: 'dik' } }]));
      ld.push([{ v: '', stijl: { rand: true } }, { v: 'Druk', stijl: { rand: true } }].concat(m.tijdvakken.map(t => { const x = cel(t); return x.druk === Infinity ? { v: '∞', stijl: { rand: true, midden: true, vulling: 'F7C1C1' } } : { v: Math.round(x.druk * 100) / 100, stijl: Object.assign({ rand: true, midden: true, getal: 9 }, drukVul(x) ? { vulling: drukVul(x) } : {}) }; }), [{ v: '', stijl: { rand: true } }]));
      ld.push([{ v: '', stijl: { rand: true } }, { v: 'Extra nodig', stijl: { rand: true } }].concat(m.tijdvakken.map(t => { const x = cel(t); return { v: x.extra ? '+' + x.extra : '', stijl: Object.assign({ rand: true, midden: true }, x.extra ? { vet: true, kleur: 'A32D2D' } : {}) }; }), [{ v: '', stijl: { rand: true } }]));
    });
    if (r.lokaalTekort.length) {
      ld.push([], [{ v: 'Geen lokaal vrij voor', stijl: { vet: true } }]);
      r.lokaalTekort.forEach(x => ld.push([{ v: x.id, stijl: { vet: true } }, x.module + ' · ' + x.klas + ' · ' + String(x.uren).replace('.', ',') + 'u op ' + x.locatie + '; klas en docent(en) kunnen in ' + x.tijdvakken.slice(0, 4).map(t => (m.tijdvakken.find(y => y.id === t) || { label: t }).label).join(', ')]));
    }

    /* 8. Lokaalindeling van wat ingepast is */
    const li = [[{ v: 'Lokaalindeling (ingepast)', stijl: { vet: true } }], [bron], ['Per locatie, dagdeel en lokaal welke assessments zijn ingepast. De volgorde binnen een lokaal is niet vastgelegd.'], []];
    li.push(['Locatie', 'Dagdeel', 'Lokaal', 'Assessments', 'Gebruikt (uur)', 'Vrij (uur)'].map(x => ({ v: x, stijl: KOP })));
    Object.keys(r.lokaalRooster).forEach(loc => m.tijdvakken.forEach(t => {
      const p = r.lokaalRooster[loc][t.id]; if (!p) return;
      Object.keys(p).map(Number).sort((x, y) => x - y).forEach(n => {
        const lijst = p[n], geb = lijst.reduce((s, x) => s + x.uren, 0);
        li.push([{ v: loc, stijl: { rand: true, vet: true } }, { v: t.label, stijl: { rand: true } }, { v: n, stijl: { rand: true, midden: true } }, { v: lijst.map(x => x.id + ' (' + String(x.uren).replace('.', ',') + 'u ' + x.module + ' ' + x.klas + ')').join('; '), stijl: { rand: true, vulling: 'EEEDFE' } }, { v: geb, stijl: { rand: true } }, { v: t.uren - geb, stijl: { rand: true } }]);
      });
    }));
    if (li.length === 5) li.push(['Nog niets ingepland.']);

    return [
      { naam: 'Planningsvolgorde', rijen: v, kolommen: [7, 8, 24, 13, 12, 26, 7, 12, 9, 10, 26, 13, 26, 24], bevries: { y: 4 }, liggend: true },
      { naam: 'Afhankelijkheden', rijen: a, kolommen: [8, 8, 42].concat(ord.map(() => 6)), bevries: { x: 3, y: 4 }, liggend: true },
      { naam: 'Koppelingen', rijen: k, kolommen: [12, 12, 9, 18, 14, 14], bevries: { y: 4 } },
      { naam: 'Bezetting bij invoer', rijen: bInvoer, kolommen: [16, 20, 26, 12, 12, 12, 24, 16], bevries: { y: 5 } },
      { naam: 'Bezetting na planning', rijen: bNa, kolommen: [16, 20, 26, 12, 12, 12, 24, 16], bevries: { y: 5 } },
      { naam: 'Lokalen per dagdeel', rijen: ld, kolommen: [14, 12].concat(m.tijdvakken.map(() => 8), [12]), bevries: { x: 2, y: 5 }, liggend: true },
      { naam: 'Lokaalindeling', rijen: li, kolommen: [14, 10, 8, 70, 14, 10], bevries: { y: 5 } },
      beschikbaarheidsblad('docent'),
      beschikbaarheidsblad('klas')
    ];
  }

  AP.export = { bladen };
})(typeof window !== 'undefined' ? window : globalThis);
