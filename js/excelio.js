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

    /* 1. Assessments (sjabloon zonder ID; het werkbestand toont de ID's die de app heeft gegeven) */
    const metIds = o.metIds !== false;
    const a = [(metIds ? ['ID'] : []).concat(['Module', 'Klas/groep', 'Docent(en)', 'Uren']).map(v => ({ v, stijl: KOP }))];
    m.assessments.forEach(x => a.push((metIds ? [{ v: x.id, stijl: { rand: true, kleur: '5F5E5A' } }] : []).concat([{ v: x.module, stijl: { rand: true } }, { v: x.klas, stijl: { rand: true } }, { v: x.docenten.join('; '), stijl: { rand: true } }, { v: x.uren, stijl: { rand: true } }])));

    /* 2. Locaties: lesuren per dagdeel + lokalen per locatie per dagdeel */
    const l = [[{ v: 'Locatie', stijl: KOP }].concat(dagdelen)];
    l.push([{ v: 'Lesuren per dagdeel', stijl: { rand: true, vet: true, vulling: 'F1EFE8' } }].concat(m.tijdvakken.map(t => ({ v: t.uren, stijl: { rand: true, midden: true, vulling: 'F1EFE8', vet: true } }))));
    m.locaties.forEach(loc => l.push([{ v: loc.naam, stijl: { rand: true, vet: true } }].concat(m.tijdvakken.map(t => ({ v: AP.model.lokalenIn(m, loc.naam, t.id), stijl: { rand: true, midden: true } })))));

    /* 3 en 4. Beschikbaarheid: + = beschikbaar, leeg = niet beschikbaar */
    const rij = (res, extra) => extra.concat(m.tijdvakken.map(t => res.beschikbaar.includes(t.id) ? { v: '+', stijl: PLUS } : { v: '', stijl: LEEG }));
    const lege = (aantal, voor) => { const r = []; for (let i = 0; i < aantal; i++) r.push(voor.map(() => ({ v: '', stijl: { rand: true } })).concat(m.tijdvakken.map(() => ({ v: '', stijl: LEEG })))); return r; };
    const d = [[{ v: 'Docent', stijl: KOP }].concat(dagdelen)];
    m.docenten.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })).forEach(r => d.push(rij(r, [{ v: r.naam, stijl: { rand: true, vet: true } }])));
    /* Klassen: de locatie volgt uit de eerste letter van de klas (A/D/E); het werkbestand toont hem ter controle. */
    const k = [[{ v: 'Klas/groep', stijl: KOP }].concat(metIds ? [{ v: 'Locatie', stijl: KOP }] : [], dagdelen)];
    m.klassen.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })).forEach(r => k.push(rij(r, [{ v: r.naam, stijl: { rand: true, vet: true } }].concat(metIds ? [{ v: r.locatie || '', stijl: { rand: true } }] : []))));

    const extraRijen = o.extraRijen === undefined ? 50 : o.extraRijen;
    d.push(...lege(extraRijen, [0])); k.push(...lege(extraRijen, metIds ? [0, 1] : [0]));
    const locNamen = m.locaties.map(x => x.naam);
    return [
      { naam: 'Assessments', rijen: a, kolommen: (metIds ? [9] : []).concat([28, 14, 36, 8]), bevries: { y: 1 } },
      { naam: 'Locaties', rijen: l, kolommen: [22].concat(m.tijdvakken.map(() => 8)), bevries: { x: 1, y: 2 }, liggend: true },
      { naam: 'Docenten', rijen: d, kolommen: [22].concat(m.tijdvakken.map(() => 8)), bevries: { x: 1, y: 1 }, liggend: true,
        keuzelijsten: [{ bereik: 'B2:' + laatsteKol(1) + d.length, lijst: ['+'] }], groen: [{ bereik: 'B2:' + laatsteKol(1) + d.length, waarden: ['+', 'x'] }] },
      metIds
        ? { naam: 'Klassen', rijen: k, kolommen: [16, 14].concat(m.tijdvakken.map(() => 8)), bevries: { x: 2, y: 1 }, liggend: true,
            keuzelijsten: [{ bereik: 'B2:B' + k.length, lijst: locNamen }, { bereik: 'C2:' + laatsteKol(2) + k.length, lijst: ['+'] }], groen: [{ bereik: 'C2:' + laatsteKol(2) + k.length, waarden: ['+', 'x'] }] }
        : { naam: 'Klassen', rijen: k, kolommen: [16].concat(m.tijdvakken.map(() => 8)), bevries: { x: 1, y: 1 }, liggend: true,
            keuzelijsten: [{ bereik: 'B2:' + laatsteKol(1) + k.length, lijst: ['+'] }], groen: [{ bereik: 'B2:' + laatsteKol(1) + k.length, waarden: ['+', 'x'] }] }
    ];
  }

  /* Tabkleuren per soort tabblad */
  const KLEUR = { toelichting: '888780', invoer: '378ADD', planning: '1D9E75', signalering: 'EF9F27' };
  const GROEP = {
    'Toelichting': 'toelichting', 'Instellingen': 'toelichting',
    'Assessments': 'invoer', 'Locaties': 'invoer', 'Docenten': 'invoer', 'Klassen': 'invoer',
    'Planning': 'planning', 'Interventies': 'planning', 'Planningsvolgorde': 'planning', 'Lokaalindeling': 'planning',
    'Afhankelijkheden': 'signalering', 'Koppelingen': 'signalering', 'Bezetting bij invoer': 'signalering', 'Bezetting na planning': 'signalering',
    'Lokalen per dagdeel': 'signalering', 'Beschikbaarheid docenten': 'signalering', 'Beschikbaarheid klassen': 'signalering'
  };
  const VOLGORDE = ['toelichting', 'invoer', 'planning', 'signalering'];
  function kleurEnOrden(bladen) {
    bladen.forEach(b => { const g = GROEP[b.naam] || 'signalering'; b.tabKleur = KLEUR[g]; b._groep = g; });
    return bladen.map((b, i) => ({ b, i })).sort((x, y) => (VOLGORDE.indexOf(x.b._groep) - VOLGORDE.indexOf(y.b._groep)) || (x.i - y.i)).map(x => { delete x.b._groep; return x.b; });
  }

  function toelichtingBlad(werkbestand) {
    const r = [[{ v: werkbestand ? 'Werkbestand assessmentplanner' : 'Invoersjabloon assessmentplanner', stijl: { vet: true } }], []];
    r.push([{ v: 'Kleuren van de tabbladen', stijl: { vet: true } }]);
    r.push([{ v: 'grijs', stijl: { vulling: KLEUR.toelichting, kleur: 'FFFFFF', vet: true, midden: true } }, 'Toelichting en instellingen']);
    r.push([{ v: 'blauw', stijl: { vulling: KLEUR.invoer, kleur: 'FFFFFF', vet: true, midden: true } }, 'Invoer: Assessments, Locaties, Docenten, Klassen']);
    if (werkbestand) {
      r.push([{ v: 'groen', stijl: { vulling: KLEUR.planning, kleur: 'FFFFFF', vet: true, midden: true } }, 'Planning: wat is ingepast (Planning), de planningsvolgorde en de lokaalindeling']);
      r.push([{ v: 'oranje', stijl: { vulling: KLEUR.signalering, kleur: '412402', vet: true, midden: true } }, 'Signaleringen: afhankelijkheden, koppelingen, bezetting (bij invoer en na planning), lokalen per dagdeel en beschikbaarheid']);
    }
    r.push([]);
    const regel = (t, u) => r.push([{ v: t, stijl: { vet: true } }, { v: u, stijl: { terugloop: true } }]);
    regel('Assessments', 'Eén regel per assessment: module, klas/groep, docent(en) en uren. Meerdere docenten scheid je met een puntkomma; zij zijn dan tegelijk nodig. Groepen die los van elkaar worden afgenomen zijn aparte regels.' + (werkbestand ? ' De ID heeft de app gegeven; laat die staan, de planning verwijst ernaar.' : ' Een ID hoef je niet in te vullen: de app geeft elk assessment zelf een vaste ID.'));
    regel('Locaties', 'Kolommen = dagdelen. De rij "Lesuren per dagdeel" bepaalt hoeveel lesuren elk dagdeel heeft. Daaronder per locatie het aantal lokalen per dagdeel waar de app in eerste instantie van uitgaat.');
    regel('Docenten', 'Per docent per dagdeel: + = beschikbaar (wordt groen), leeg = niet beschikbaar. Kies de + uit het keuzelijstje of typ hem (x mag ook). Een docent die hier niet staat, of met een helemaal lege regel, is in alle dagdelen beschikbaar.');
    regel('Klassen', 'Per klas/groep per dagdeel: + = beschikbaar, leeg = niet beschikbaar. Een klas die hier niet staat, of met een helemaal lege regel, is overal beschikbaar. De locatie volgt uit de eerste letter van de klas: A = Apeldoorn, D = Deventer, E = Enschede.' + (werkbestand ? ' De kolom Locatie toont de locatie ter controle; een ingevulde locatie gaat voor de eerste letter.' : ''));
    regel('Instellingen', 'Naam van de planning en de drempel voor een sterke koppeling (standaard 20%).');
    if (werkbestand) {
      regel('Planning', 'Wat al is ingepast: per assessment het dagdeel, het aantal uren en het lokaalnummer. Een assessment dat doorloopt over meerdere dagdelen staat op één regel: dagdeel "wo-o + wo-m", uren "12 (6 + 6)", lokaal "1" (of per dagdeel "1 + 2"). Module, klas en docent(en) zijn ter informatie.');
      regel('Interventies', 'Logboek van wat je hebt aangepast om knelpunten op te lossen: datum (dd-mm-jjjj), betreft (assessment-ID, "docent: naam" of "klas: naam", gescheiden door ;), wat is aangepast, reden, met wie overlegd en status (Akkoord, In afwachting, Niet akkoord, Vervallen). Wordt bij openen ingelezen.');
      regel('Uitvoer', 'De groene en oranje tabbladen (behalve Planning) zijn uitvoer van de analyse. Bij het openen in de app worden ze genegeerd en opnieuw berekend. Bezetting staat er twee keer in: bij invoer (alsof er niets gepland is) en na planning.');
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
    i.push([{ v: 'Gemaakt met versie', stijl: { rand: true } }, { v: AP.versie || '', stijl: Object.assign({ rand: true }, INFO) }]);
    i.push([{ v: 'Formaat', stijl: { rand: true } }, { v: werkbestand ? 'assessmentplanner-werkbestand 1' : 'assessmentplanner-invoer 1', stijl: { rand: true } }]);
    return { naam: 'Instellingen', rijen: i, kolommen: [30, 40] };
  }

  function sjabloonBladen(m) {
    return kleurEnOrden([toelichtingBlad(false), instellingenBlad(m, false)].concat(invoerBladen(m, { metIds: false })));
  }

  function werkbestandBladen(m, r) {
    const tvLabel = id => (m.tijdvakken.find(t => t.id === id) || { label: id }).label;
    const p = [['ID', 'Module', 'Klas/groep', 'Docent(en)', 'Dagdeel', 'Uren', 'Lokaal'].map(v => ({ v, stijl: KOP }))];
    /* één regel per assessment; loopt het over meerdere dagdelen, dan "wo-o + wo-m", uren "12 (6 + 6)" en lokaal "1" of "1 + 2" */
    const nl = x => String(x).replace('.', ',');
    m.assessments.filter(a => a.gepland.length).sort((x, y) => (x.planVolgorde || 0) - (y.planVolgorde || 0)).forEach(a => {
      const g = a.gepland, meer = g.length > 1, loc = (m.klassen.find(k => k.naam === a.klas) || {}).locatie || '';
      const extra = g.some(s => AP.model.lokalenIn(m, loc, s.tv) < s.lokaal), lokalen = g.map(s => s.lokaal);
      const som = g.reduce((t, s) => t + s.uren, 0);
      p.push([{ v: a.id, stijl: { rand: true, vet: true } }, { v: a.module, stijl: Object.assign({ rand: true }, INFO) }, { v: a.klas, stijl: Object.assign({ rand: true }, INFO) }, { v: a.docenten.join('; '), stijl: Object.assign({ rand: true }, INFO) },
        { v: g.map(s => tvLabel(s.tv)).join(' + '), stijl: { rand: true } },
        { v: meer ? nl(som) + ' (' + g.map(s => nl(s.uren)).join(' + ') + ')' : g[0].uren, stijl: Object.assign({ rand: true }, meer ? { getal: 49 } : {}) },
        { v: lokalen.every(l => l === lokalen[0]) ? lokalen[0] : lokalen.join(' + '), stijl: Object.assign({ rand: true }, extra ? { vulling: 'F7C1C1', vet: true } : {}) }]);
    });
    return kleurEnOrden([toelichtingBlad(true), instellingenBlad(m, true)]
      .concat(invoerBladen(m, { metIds: true, extraRijen: 20 }))
      .concat([{ naam: 'Planning', rijen: p, kolommen: [9, 28, 14, 26, 16, 12, 9], bevries: { y: 1 } }, interventieBlad(m)])
      .concat(AP.export.bladen(m, r)));
  }
  /* Interventies: datum als tekst dd-mm-jjjj, status met keuzelijst. Nieuwste bovenaan. */
  const datumNl = d => /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(8, 10) + '-' + d.slice(5, 7) + '-' + d.slice(0, 4) : d;
  function interventieBlad(m) {
    const KLR = { 'Akkoord': 'E1F5EE', 'In afwachting': 'FAEEDA', 'Niet akkoord': 'FCEBEB', 'Vervallen': 'F1EFE8' };
    const rijen = [['ID', 'Datum', 'Betreft', 'Wat is aangepast', 'Reden', 'Overlegd met', 'Status'].map(v => ({ v, stijl: KOP }))];
    const lijst = (m.interventies || []).slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || b.id.localeCompare(a.id));
    const T = { rand: true, terugloop: true };
    lijst.forEach(iv => rijen.push([{ v: iv.id, stijl: Object.assign({ rand: true }, INFO) }, { v: datumNl(iv.datum), stijl: { rand: true, getal: 49 } }, { v: AP.model.betreftTekst(m, iv.betreft), stijl: T }, { v: iv.wat, stijl: T }, { v: iv.reden, stijl: T }, { v: iv.overlegdMet, stijl: T }, { v: iv.status, stijl: { rand: true, vulling: KLR[iv.status] } }]));
    for (let i = 0; i < 20; i++) rijen.push([{ v: '', stijl: { rand: true } }, { v: '', stijl: { rand: true, getal: 49 } }, { v: '', stijl: T }, { v: '', stijl: T }, { v: '', stijl: T }, { v: '', stijl: T }, { v: '', stijl: { rand: true } }]);
    return { naam: 'Interventies', rijen, kolommen: [7, 12, 34, 44, 34, 26, 14], bevries: { y: 1 }, keuzelijsten: [{ bereik: 'G2:G' + rijen.length, lijst: AP.model.STATUSSEN }] };
  }

  AP.excelio = { invoerBladen, sjabloonBladen, werkbestandBladen, instellingenBlad };
})(typeof window !== 'undefined' ? window : globalThis);
