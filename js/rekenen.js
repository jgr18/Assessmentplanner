/* Assessmentplanner — rekenkern.
   Element = één assessment: één moment in het rooster met één klas/groep en één of meer docenten die tegelijk aanwezig zijn.
   Beschikbaar = beschikbaarheid min de tijdvakken die al door geplande assessments bezet zijn.
   Krapte    = benodigde uren ÷ uren waarin klas én alle docenten tegelijk beschikbaar zijn.
   Bezetting = benodigde uren van alle nog niet geplande assessments ÷ beschikbare uren (per docent en per klas).
   Prioriteit= de hoogste van krapte en de bezetting van elke betrokken docent en klas.
   Koppeling = twee assessments delen een docent of klas; gewicht = hoogste bezetting van de gedeelde docent/klas.
   Eilanden  = groepen assessments die via koppelingen boven de drempel samenhangen.
   Volgorde  = eilanden op hoogste prioriteit; binnen een eiland eerst het krapste, daarna steeds het assessment
               met de sterkste koppeling aan wat al in de lijst staat (bij gelijkstand hogere prioriteit, dan eigen krapte, dan laagste ID). */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};

  function analyseer(m) {
    const uur = {}; m.tijdvakken.forEach(t => { uur[t.id] = t.uren; });
    const urenVan = set => Array.from(set).reduce((s, t) => s + (uur[t] || 0), 0);
    const fouten = [], waarschuwingen = [];

    const bezetDoor = { docent: {}, klas: {} };
    const geplandeAss = m.assessments.filter(a => a.gepland && a.gepland.length);
    geplandeAss.forEach(a => {
      a.docenten.forEach(d => { (bezetDoor.docent[d] = bezetDoor.docent[d] || new Set()); a.gepland.forEach(t => bezetDoor.docent[d].add(t)); });
      (bezetDoor.klas[a.klas] = bezetDoor.klas[a.klas] || new Set()); a.gepland.forEach(t => bezetDoor.klas[a.klas].add(t));
    });
    const resterend = (soort, naam) => {
      const r = AP.model.vindRes(m, soort, naam); if (!r) return new Set();
      const bezet = bezetDoor[soort][r.naam] || new Set();
      return new Set(r.beschikbaar.filter(t => uur[t] !== undefined && !bezet.has(t)));
    };

    const open = m.assessments.filter(a => !(a.gepland && a.gepland.length));

    /* Bezetting per docent en klas */
    const bezetting = [];
    const resGraad = { docent: {}, klas: {} };
    [['docent', m.docenten], ['klas', m.klassen]].forEach(([soort, lijst]) => {
      lijst.forEach(r => {
        const mijnOpen = open.filter(a => soort === 'docent' ? a.docenten.includes(r.naam) : a.klas === r.naam);
        const nodig = mijnOpen.reduce((s, a) => s + a.uren, 0);
        const beschikbaar = urenVan(resterend(soort, r.naam));
        const graad = nodig === 0 ? 0 : (beschikbaar === 0 ? Infinity : nodig / beschikbaar);
        resGraad[soort][r.naam] = graad;
        bezetting.push({ soort, naam: r.naam, nodig, beschikbaar, graad, aantal: mijnOpen.length, totaalBeschikbaar: urenVan(new Set(r.beschikbaar.filter(t => uur[t] !== undefined))) });
        const label = (soort === 'docent' ? 'docent ' : 'klas ') + r.naam;
        if (!r.beschikbaar.length && (mijnOpen.length || geplandeAss.some(a => soort === 'docent' ? a.docenten.includes(r.naam) : a.klas === r.naam)))
          fouten.push({ bron: 'Beschikbaarheid, ' + label, melding: 'Er is geen beschikbaarheid ingevuld.', herstel: 'Vul op het tabblad Beschikbaarheid in wanneer ' + label + ' beschikbaar is.' });
        else if (graad > 1) waarschuwingen.push({ bron: 'Bezetting, ' + label, melding: 'Nodig ' + fmt(nodig) + ' uur, beschikbaar ' + fmt(beschikbaar) + ' uur' + (geplandeAss.length ? ' (na de al geplande assessments)' : '') + '.', herstel: 'Breid de beschikbaarheid uit, verdeel assessments over meer docenten, of plan een deel in een andere week.' });
      });
    });

    /* Per open assessment: gezamenlijke beschikbaarheid, krapte en prioriteit */
    const items = open.map(a => {
      let gemeen = resterend('klas', a.klas);
      a.docenten.forEach(d => { const r = resterend('docent', d); gemeen = new Set(Array.from(gemeen).filter(t => r.has(t))); });
      const overlap = urenVan(gemeen);
      const krapte = overlap === 0 ? Infinity : a.uren / overlap;
      const res = [{ soort: 'klas', naam: a.klas, graad: resGraad.klas[a.klas] || 0 }].concat(a.docenten.map(d => ({ soort: 'docent', naam: d, graad: resGraad.docent[d] || 0 })));
      let prio = krapte, knelpunt = 'gezamenlijke beschikbaarheid';
      res.forEach(r => { if (r.graad > prio) { prio = r.graad; knelpunt = (r.soort === 'docent' ? 'docent ' : 'klas ') + r.naam; } });
      if (overlap < a.uren) fouten.push({ bron: 'Assessment ' + a.id + ' (' + a.module + ', ' + a.klas + ')', melding: (a.docenten.length > 1 ? 'Klas en docenten zijn' : 'Klas en docent zijn') + ' samen maar ' + fmt(overlap) + ' uur tegelijk beschikbaar' + (geplandeAss.length ? ' (na de al geplande assessments)' : '') + '; nodig is ' + fmt(a.uren) + ' uur.', herstel: 'Breid de beschikbaarheid van ' + [a.klas].concat(a.docenten).join(', ') + ' uit, of verdeel het assessment.' });
      return { id: a.id, module: a.module, klas: a.klas, docenten: a.docenten.slice(), uren: a.uren, gemeen: m.tijdvakken.filter(t => gemeen.has(t.id)).map(t => t.id), overlap, krapte, prio, knelpunt, past: overlap >= a.uren, res };
    });

    /* Koppelingen */
    const koppeling = {};
    const sleutel = (x, y) => x < y ? x + '|' + y : y + '|' + x;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j], gedeeld = [];
      if (a.klas === b.klas) gedeeld.push({ soort: 'klas', naam: a.klas, graad: resGraad.klas[a.klas] || 0 });
      a.docenten.forEach(d => { if (b.docenten.includes(d)) gedeeld.push({ soort: 'docent', naam: d, graad: resGraad.docent[d] || 0 }); });
      if (!gedeeld.length) continue;
      gedeeld.sort((p, q) => q.graad - p.graad);
      koppeling[sleutel(a.id, b.id)] = { gewicht: gedeeld[0].graad, via: gedeeld[0], gedeeld };
    }
    const kop = (x, y) => koppeling[sleutel(x, y)] || null;
    const drempel = m.instellingen.drempel;

    /* Eilanden: samenhang via koppelingen boven de drempel */
    const ouder = {}; items.forEach(it => { ouder[it.id] = it.id; });
    const wortel = x => { while (ouder[x] !== x) { ouder[x] = ouder[ouder[x]]; x = ouder[x]; } return x; };
    Object.keys(koppeling).forEach(k => { if (koppeling[k].gewicht > drempel) { const [x, y] = k.split('|'); ouder[wortel(x)] = wortel(y); } });
    const groepen = {}; items.forEach(it => { (groepen[wortel(it.id)] = groepen[wortel(it.id)] || []).push(it); });
    const prioVan = {}; items.forEach(it => { prioVan[it.id] = it.prio; });
    const verschil = (x, y) => (x === y ? 0 : (y > x ? 1 : -1));
    const cmpPrio = (a, b) => verschil(a.prio, b.prio) || verschil(a.krapte, b.krapte) || (a.id < b.id ? -1 : 1);
    const eilanden = Object.values(groepen).map(g => g.sort(cmpPrio)).sort((a, b) => cmpPrio(a[0], b[0]));

    const volgorde = [];
    let eilandNr = 0;
    eilanden.forEach(g => {
      const naam = g.length > 1 ? 'E' + (++eilandNr) : 'los';
      const rest = g.slice(), geplaatst = [];
      while (rest.length) {
        let beste = null, besteW = -1, besteVan = null;
        rest.forEach(it => {
          let w = -1, van = null;
          geplaatst.forEach(p => { const k = kop(it.id, p.id); if (k && k.gewicht > drempel && k.gewicht > w) { w = k.gewicht; van = { id: p.id, via: k.via }; } });
          if (!geplaatst.length) w = 0;
          if (!beste || w > besteW || (w === besteW && cmpPrio(it, beste) < 0)) { beste = it; besteW = w; besteVan = van; }
        });
        beste.eiland = naam; beste.volgtUit = besteVan;
        geplaatst.push(beste); volgorde.push(beste); rest.splice(rest.indexOf(beste), 1);
      }
    });
    volgorde.forEach((it, i) => { it.volgnummer = i + 1; });

    const gepland = geplandeAss.map(a => ({ id: a.id, module: a.module, klas: a.klas, docenten: a.docenten.slice(), uren: a.uren, gepland: a.gepland.slice(), geplandeUren: urenVan(new Set(a.gepland)) }));
    bezetting.sort((a, b) => (b.graad - a.graad) || a.naam.localeCompare(b.naam));

    return { volgorde, gepland, bezetting, koppeling, kop, drempel, eilanden: eilandNr, los: volgorde.filter(x => x.eiland === 'los').length, fouten, waarschuwingen, invoerversie: m.invoerversie, tijdstip: new Date().toISOString() };
  }

  function fmt(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }
  function fmtGraad(g) { return g === Infinity ? 'geen ruimte' : (Math.round(g * 100) + '%'); }
  function fmtKrapte(k) { return k === Infinity ? '∞' : (Math.round(k * 100) / 100).toFixed(2).replace('.', ','); }

  AP.rekenen = { analyseer, fmt, fmtGraad, fmtKrapte };
})(typeof window !== 'undefined' ? window : globalThis);
