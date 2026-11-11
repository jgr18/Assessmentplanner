/* Assessmentplanner — Excel-invoer en -werkbestand (opbouw van de tabbladen).
   Invoer (4 tabbladen, ook het begin van elk werkbestand):
     1 Assessments : ID (optioneel) | Module | Klas/groep | Docent(en) gescheiden door ; | Uren
     2 Locaties    : Locatie | per dagdeel het aantal lokalen; eerste rij onder de kop = lesuren per dagdeel
     3 Docenten    : Docent | per dagdeel "+" (= beschikbaar, groen) of leeg (= niet beschikbaar)
     4 Klassen     : Klas/groep | Locatie | per dagdeel "+" of leeg
   Staat een docent of klas niet op het tabblad, of is de hele regel leeg, dan is die overal beschikbaar.
   Volgorde: Toelichting, Instellingen, de vier invoertabbladen, (werkbestand:) Planning en de uitvoer. */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};

  const KOP = { vet: true, vulling: 'E6E6E1', rand: true };
  const KOP_MIDDEN = Object.assign({ midden: true }, KOP);
  const INFO = { kleur: '5F5E5A' };
  const PLUS = { rand: true, midden: true, vulling: '1D9E75', kleur: 'FFFFFF', vet: true, getal: 49 };
  const LEEG = { rand: true, midden: true, getal: 49 }; /* tekstopmaak: een getypte + blijft tekst en wordt geen formule */
  const getal = v => String(v).replace('.', ',');

  function invoerBladen(m, opties) {
    const o = opties || {}, X = AP.xlsx, n = m.tijdvakken.length;
    const dagdelen = m.tijdvakken.map(t => ({ v: t.label, stijl: KOP_MIDDEN }));
    const laatsteKol = c => X.kolom(c + n - 1);

    /* 1. Assessments */
    const a = [['ID', 'Module', 'Klas/groep', 'Docent(en)', 'Uren'].map(v => ({ v, stijl: KOP }))];
    m.assessments.forEach(x => a.push([{ v: o.metIds === false ? '' : x.id, stijl: { rand: true, kleur: '5F5E5A' } }, { v: x.module, stijl: { rand: true } }, { v: x.klas, stijl: { rand: true } }, { v: x.docenten.join('; '), stijl: { rand: true } }, { v: x.uren, stijl: { rand: true } }]));

    /* 2. Locaties: lesuren per dagdeel + lokalen per locatie per dagdeel */
    const l = [[{ v: 'Locatie', stijl: KOP }].concat(dagdelen)];
    l.push([{ v: 'Lesuren per dagdeel', stijl: { rand: true, vet: true, vulling: 'F1EFE8' } }].concat(m.tijdvakken.map(t => ({ v: t.uren, stijl: { rand: true, midden: true, vulling: 'F1EFE8', vet: true } }))));
    m.locaties.forEach(loc => l.push([{ v: loc.naam, stijl: { rand: true, vet: true } }].concat(m.tijdvakken.map(t => ({ v: AP.model.lokalenIn(m, loc.naam, t.id), stijl: { rand: true, midden: true } })))));

    /* 3 en 4. Beschikbaarheid: + = beschikbaar, leeg = niet beschikbaar */
    const rij = (res, extra) => extra.concat(m.tijdvakken.map(t => res.beschikbaar.includes(t.id) ? { v: '+', stijl: PLUS } : { v: '', stijl: LEEG }));
    const lege = (aantal, voor) => { const r = []; for (let i = 0; i < aantal; i++) r.push(voor.map(() => ({ v: '', stijl: { rand: true } })).concat(m.tijdvakken.map(() => ({ v: '', stijl: LEEG })))); return r; };
    const d = [[{ v: 'Docent', stijl: KOP }].concat(dagdelen)];
    m.docenten.forEach(r => d.push(rij(r, [{ v: r.naam, stijl: { rand: true, vet: true } }])));
    const k = [[{ v: 'Klas/groep', stijl: KOP }, { v: 'Locatie', stijl: KOP }].concat(dagdelen)];
    m.klassen.forEach(r => k.push(rij(r, [{ v: r.naam, stijl: { rand: true, vet: true } }, { v: r.locatie || '', stijl: { rand: true } }])));

    const extraRijen = o.extraRijen === undefined ? 50 : o.extraRijen;
    d.push(...lege(extraRijen, [0])); k.push(...lege(extraRijen, [0, 1]));
    const locNamen = m.locaties.map(x => x.naam);
    return [
      { naam: 'Assessments', rijen: a, kolommen: [9, 28, 14, 36, 8], bevries: { y: 1 } },
      { naam: 'Locaties', rijen: l, kolommen: [22].concat(m.tijdvakken.map(() => 8)), bevries: { x: 1, y: 2 }, liggend: true },
      { naam: 'Docenten', rijen: d, kolommen: [22].concat(m.tijdvakken.map(() => 8)), bevries: { x: 1, y: 1 }, liggend: true,
        keuzelijsten: [{ bereik: 'B2:' + laatsteKol(1) + d.length, lijst: ['+'] }], groen: [{ bereik: 'B2:' + laatsteKol(1) + d.length, waarden: ['+', 'x'] }] },
      { naam: 'Klassen', rijen: k, kolommen: [16, 14].concat(m.tijdvakken.map(() => 8)), bevries: { x: 2, y: 1 }, liggend: true,
        keuzelijsten: [{ bereik: 'B2:B' + k.length, lijst: locNamen }, { bereik: 'C2:' + laatsteKol(2) + k.length, lijst: ['+'] }], groen: [{ bereik: 'C2:' + laatsteKol(2) + k.length, waarden: ['+', 'x'] }] }
    ];
  }

  function toelichtingBlad(werkbestand) {
    const r = [[{ v: werkbestand ? 'Werkbestand assessmentplanner' : 'Invoersjabloon assessmentplanner', stijl: { vet: true } }], []];
    const regel = (t, u) => r.push([{ v: t, stijl: { vet: true } }, { v: u, stijl: { terugloop: true } }]);
    regel('Assessments', 'Eén regel per assessment: module, klas/groep, docent(en) en uren. Meerdere docenten scheid je met een puntkomma; zij zijn dan tegelijk nodig. Groepen die los van elkaar worden afgenomen zijn aparte regels. ID mag leeg blijven: de app geeft dan zelf een vaste ID.');
    regel('Locaties', 'Kolommen = dagdelen. De rij "Lesuren per dagdeel" bepaalt hoeveel lesuren elk dagdeel heeft. Daaronder per locatie het aantal lokalen per dagdeel waar de app in eerste instantie van uitgaat.');
    regel('Docenten', 'Per docent per dagdeel: + = beschikbaar (wordt groen), leeg = niet beschikbaar. Kies de + uit het keuzelijstje of typ hem (x mag ook). Een docent die hier niet staat, of met een helemaal lege regel, is in alle dagdelen beschikbaar.');
    regel('Klassen', 'Per klas/groep de locatie (keuzelijst), en per dagdeel: + = beschikbaar, leeg = niet beschikbaar. Een klas die hier niet staat, of met een helemaal lege regel, is overal beschikbaar; zonder locatie meldt de app dat de locatie nog gekozen moet worden.');
    regel('Instellingen', 'Naam van de planning en de drempel voor een sterke koppeling (standaard 20%).');
    if (werkbestand) {
      regel('Planning', 'Wat al is ingepast: per assessment het dagdeel, het aantal uren en het lokaalnummer. Een assessment dat doorloopt over ochtend en middag staat op twee regels.');
      regel('Uitvoer', 'De overige tabbladen (Planningsvolgorde t/m Beschikbaarheid) zijn uitvoer van de analyse. Bij het openen in de app worden ze genegeerd en opnieuw berekend.');
    }
    regel('Openen', 'In de app: kies "Excel openen" en selecteer dit bestand. De app herkent zelf of het een invoersjabloon of een werkbestand is.');
    return { naam: 'Toelichting', rijen: r, kolommen: [16, 95] };
  }

  function instellingenBlad(m, werkbestand) {
    const i = [['Instelling', 'Waarde'].map(v => ({ v, stijl: KOP })),
      [{ v: 'Naam planning', stijl: { rand: true } }, { v: m.naam, stijl: { rand: true } }],
      [{ v: 'Drempel sterke koppeling (%)', stijl: { rand: true } }, { v: Math.round(m.instellingen.drempel * 100), stijl: { rand: true } }]];
    if (werkbestand) i.push(
      [{ v: 'Invoerversie', stijl: { rand: true } }, { v: m.invoerversie, stijl: { rand: true } }],
      [{ v: 'Opgeslagen op', stijl: { rand: true } }, { v: new Date().toLocaleString('nl-NL'), stijl: { rand: true } }]);
    i.push([{ v: 'Formaat', stijl: { rand: true } }, { v: werkbestand ? 'assessmentplanner-werkbestand 1' : 'assessmentplanner-invoer 1', stijl: { rand: true } }]);
    return { naam: 'Instellingen', rijen: i, kolommen: [30, 40] };
  }

  function sjabloonBladen(m) {
    return [toelichtingBlad(false), instellingenBlad(m, false)].concat(invoerBladen(m, { metIds: false }));
  }

  function werkbestandBladen(m, r) {
    const tvLabel = id => (m.tijdvakken.find(t => t.id === id) || { label: id }).label;
    const p = [['ID', 'Module', 'Klas/groep', 'Dagdeel', 'Uren', 'Lokaal'].map(v => ({ v, stijl: KOP }))];
    m.assessments.filter(a => a.gepland.length).forEach(a => a.gepland.forEach(s => p.push([{ v: a.id, stijl: { rand: true, vet: true } }, { v: a.module, stijl: Object.assign({ rand: true }, INFO) }, { v: a.klas, stijl: Object.assign({ rand: true }, INFO) }, { v: tvLabel(s.tv), stijl: { rand: true } }, { v: s.uren, stijl: { rand: true } }, { v: s.lokaal, stijl: { rand: true } }])));
    return [toelichtingBlad(true), instellingenBlad(m, true)]
      .concat(invoerBladen(m, { metIds: true, extraRijen: 20 }))
      .concat([{ naam: 'Planning', rijen: p, kolommen: [9, 28, 14, 10, 8, 8], bevries: { y: 1 } }])
      .concat(AP.export.bladen(m, r));
  }

  AP.excelio = { invoerBladen, sjabloonBladen, werkbestandBladen, instellingenBlad };
})(typeof window !== 'undefined' ? window : globalThis);
