/* Assessmentplanner — rekenkern.
   Element = één assessment: één klas/groep, één of meer docenten die tegelijk aanwezig zijn, een aantal lesuren,
   afgenomen op de locatie van de klas in één lokaal.

   Capaciteit wordt in uren per tijdvak geteld:
   - een docent of klas heeft per tijdvak (als beschikbaar) het aantal lesuren van dat tijdvak; assessments in hetzelfde
     tijdvak volgen elkaar op (nooit tegelijk);
   - een locatie heeft per tijdvak een aantal lokalen; elk lokaal heeft de lesuren van het tijdvak.
     Drie assessments van 2 uur passen zo in één lokaal van 6 lesuren ("inpassen", zonder exacte lesuren).
   - een assessment past in één tijdvak, of loopt door over aaneengesloten tijdvakken van dezelfde dag
     (bijvoorbeeld 12 uur = ochtend + middag; 3 uur kan 2 uur ochtend + 1 uur middag zijn).
   - een docent hoort op één dag op één locatie te zijn; een plaatsing die dat breekt kan wel, met een waarschuwing.

   Lokalen zijn bij te vragen en tellen daarom niet mee in krapte, prioriteit en afhankelijkheden;
   een tekort aan lokalen wordt apart gemeld (tabblad Lokalen) en bij het inpassen wordt wel een vrij lokaal gezocht.
   Krapte    = benodigde uren ÷ uren waarin docent(en) en klas tegelijk vrij zijn (zonder locatiewissel).
   Bezetting = benodigde uren ÷ vrije uren, per docent en klas; per locatie (lokaaluren) ter informatie.
   Prioriteit= hoogste van krapte en de bezetting van de betrokken docenten en klas.
   Koppeling = gedeelde docent (D) of klas (K); gewicht = hoogste bezetting van wat gedeeld wordt.
   Eilanden en volgorde: zie de toelichting bij "volgorde" hieronder. */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};
  const M = () => AP.model;

  const dagVan = t => (String(t.label).split(/[-\s]/)[0] || '').toLowerCase();

  function analyseer(m) {
    const TV = m.tijdvakken, U = {}, dag = {}, idx = {};
    TV.forEach((t, i) => { U[t.id] = t.uren; dag[t.id] = dagVan(t); idx[t.id] = i; });
    const fouten = [], waarschuwingen = [];
    const geplandeAss = m.assessments.filter(a => a.gepland && a.gepland.length);
    const open = m.assessments.filter(a => !(a.gepland && a.gepland.length));
    const klasVan = {}; m.klassen.forEach(k => { klasVan[k.naam] = k; });
    const locVan = naam => (klasVan[naam] && klasVan[naam].locatie) || '';

    /* --- gebruik door geplande assessments --- */
    const gebruik = { docent: {}, klas: {} }, lokaalGebruik = {}, lokaalRooster = {}, docentDagLoc = {};
    const tel = (soort, naam, tv, u) => { const g = gebruik[soort][naam] = gebruik[soort][naam] || {}; g[tv] = (g[tv] || 0) + u; };
    geplandeAss.forEach(a => {
      const loc = locVan(a.klas);
      a.gepland.forEach(s => {
        if (U[s.tv] === undefined) return;
        a.docenten.forEach(d => { tel('docent', d, s.tv, s.uren); ((docentDagLoc[d] = docentDagLoc[d] || {})[dag[s.tv]] = docentDagLoc[d][dag[s.tv]] || new Set()).add(loc); });
        tel('klas', a.klas, s.tv, s.uren);
        const lg = ((lokaalGebruik[loc] = lokaalGebruik[loc] || {})[s.tv] = lokaalGebruik[loc][s.tv] || {});
        lg[s.lokaal] = (lg[s.lokaal] || 0) + s.uren;
        const lr = ((lokaalRooster[loc] = lokaalRooster[loc] || {})[s.tv] = lokaalRooster[loc][s.tv] || {});
        (lr[s.lokaal] = lr[s.lokaal] || []).push({ id: a.id, uren: s.uren, module: a.module, klas: a.klas });
      });
    });

    const beschikbaar = (soort, naam, tv) => { const r = M().vindRes(m, soort, naam); return !!r && r.beschikbaar.includes(tv); };
    const persRest = (soort, naam, tv) => beschikbaar(soort, naam, tv) ? Math.max(0, U[tv] - ((gebruik[soort][naam] || {})[tv] || 0)) : 0;
    /* Lokalen: nummers boven het aantal lokalen op de locatie zijn extra lokalen (nog aan te vragen).
       Een extra lokaal kan, net als een gewoon lokaal, door meerdere assessments gedeeld worden. */
    const lokaalRests = (loc, tv) => {
      const n = M().lokalenIn(m, loc, tv), g = (lokaalGebruik[loc] || {})[tv] || {}, r = [];
      const hoogste = Object.keys(g).map(Number).filter(x => x > 0).reduce((x, v) => Math.max(x, v), 0);
      for (let i = 1; i <= Math.max(n, hoogste); i++) r.push(Math.max(0, U[tv] - (g[i] || 0)));
      return r;
    };
    const maxLokaalRest = (loc, tv) => lokaalRests(loc, tv).slice(0, M().lokalenIn(m, loc, tv)).reduce((x, v) => Math.max(x, v), 0);
    /* best passende gewone lokaal; anders een al gebruikt extra lokaal; anders een nieuw extra lokaal */
    const besteLokaal = (loc, tv, u) => {
      const n = M().lokalenIn(m, loc, tv), rests = lokaalRests(loc, tv);
      const zoek = (van, tot) => { let best = null, rest = Infinity; for (let i = van; i < tot; i++) if (rests[i] >= u && rests[i] < rest) { rest = rests[i]; best = i + 1; } return best; };
      return zoek(0, n) || zoek(n, rests.length) || rests.length + 1;
    };
    const isExtra = (loc, tv, lokaal) => lokaal > M().lokalenIn(m, loc, tv);
    const restIn = (loc, tv, lokaal) => { const v = lokaalRests(loc, tv)[lokaal - 1]; return v === undefined ? U[tv] : v; };

    /* --- per assessment: capaciteit per tijdvak, plaatsingsopties --- */
    function mensenCap(a, tv) { let c = persRest('klas', a.klas, tv); a.docenten.forEach(d => { c = Math.min(c, persRest('docent', d, tv)); }); return c; }
    function locatieWissel(a, dg) {
      const loc = locVan(a.klas), anders = [];
      a.docenten.forEach(d => { const s = docentDagLoc[d] && docentDagLoc[d][dg]; if (s) s.forEach(l => { if (l !== loc) anders.push(d + ' (' + l + ')'); }); });
      return anders;
    }
    function opties(a) {
      const loc = locVan(a.klas), uit = []; if (!loc) return uit;
      const cap = tv => mensenCap(a, tv); /* lokalen zijn geen grens: zonder vrij lokaal volgt de melding 'extra lokaal nodig' */
      const markeer = segs => { segs.forEach(s => { if (isExtra(loc, s.tv, s.lokaal)) s.extra = true; }); return segs; };
      const waarsch = tv => { const w = locatieWissel(a, dag[tv]); return w.length ? 'Op ' + dag[tv] + ' al op een andere locatie: ' + w.join(', ') : ''; };
      TV.forEach((t, i) => {
        /* in één tijdvak */
        if (cap(t.id) >= a.uren) {
          const lk = besteLokaal(loc, t.id, a.uren);
          const segs = markeer([{ tv: t.id, uren: a.uren, lokaal: lk }]);
          uit.push({ segmenten: segs, span: false, waarschuwing: waarsch(t.id), extraLokaal: segs.some(s => s.extra), restNa: restIn(loc, t.id, lk) - a.uren, start: i });
        }
        /* doorlopend over aaneengesloten tijdvakken van dezelfde dag: eerste deel aan het eind, middelste vol, laatste aan het begin */
        let midden = 0;
        for (let j = i + 1; j < TV.length && dag[TV[j].id] === dag[t.id]; j++) {
          const rest = a.uren - midden, c1 = cap(t.id), c2 = cap(TV[j].id);
          if (rest >= 2 && c1 >= 1 && c2 >= 1 && c1 + c2 >= rest) {
            const u1 = Math.min(c1, rest - 1), u2 = rest - u1;
            if (u2 <= c2) {
              const segs = [{ tv: t.id, uren: u1, lokaal: besteLokaal(loc, t.id, u1) }];
              for (let k = i + 1; k < j; k++) segs.push({ tv: TV[k].id, uren: U[TV[k].id], lokaal: besteLokaal(loc, TV[k].id, U[TV[k].id]) });
              segs.push({ tv: TV[j].id, uren: u2, lokaal: besteLokaal(loc, TV[j].id, u2) });
              /* liefst hetzelfde lokaal voor alle delen */
              const n = Math.min.apply(null, segs.map(s => M().lokalenIn(m, loc, s.tv)));
              for (let l = 1; l <= n; l++) if (segs.every(s => lokaalRests(loc, s.tv)[l - 1] >= s.uren)) { segs.forEach(s => { s.lokaal = l; }); break; }
              markeer(segs);
              uit.push({ segmenten: segs, span: true, waarschuwing: waarsch(t.id), extraLokaal: segs.some(s => s.extra), restNa: 0, start: i });
              break;
            }
          }
          if (cap(TV[j].id) < U[TV[j].id]) break; /* kan geen vol middendeel zijn: verder doorlopen kan niet */
          midden += U[TV[j].id];
          if (midden >= a.uren) break;
        }
      });
      uit.sort((p, q) => (!!p.waarschuwing - !!q.waarschuwing) || (!!p.extraLokaal - !!q.extraLokaal) || (p.span - q.span) || (p.restNa - q.restNa) || (p.start - q.start));
      return uit;
    }

    /* --- bezetting per docent, klas en locatie --- */
    const bezetting = [], graad = { docent: {}, klas: {}, locatie: {} };
    const zet = (soort, naam, nodig, vrij, aantal, totaal) => {
      const g = nodig === 0 ? 0 : (vrij === 0 ? Infinity : nodig / vrij);
      graad[soort][naam] = g; bezetting.push({ soort, naam, nodig, beschikbaar: vrij, graad: g, aantal, totaalBeschikbaar: totaal });
      return g;
    };
    [['docent', m.docenten], ['klas', m.klassen]].forEach(([soort, lijst]) => lijst.forEach(r => {
      const mijn = open.filter(a => soort === 'docent' ? a.docenten.includes(r.naam) : a.klas === r.naam);
      const nodig = mijn.reduce((s, a) => s + a.uren, 0);
      const vrij = TV.reduce((s, t) => s + persRest(soort, r.naam, t.id), 0);
      const totaal = TV.reduce((s, t) => s + (r.beschikbaar.includes(t.id) ? t.uren : 0), 0);
      const g = zet(soort, r.naam, nodig, vrij, mijn.length, totaal);
      const label = (soort === 'docent' ? 'docent ' : 'klas ') + r.naam;
      const betrokken = mijn.length || geplandeAss.some(a => soort === 'docent' ? a.docenten.includes(r.naam) : a.klas === r.naam);
      if (!r.beschikbaar.length && betrokken) fouten.push({ bron: 'Beschikbaarheid, ' + label, melding: 'Er is geen beschikbaarheid ingevuld.', herstel: 'Vul op het tabblad Beschikbaarheid in wanneer ' + label + ' beschikbaar is.' });
      else if (g > 1) waarschuwingen.push({ bron: 'Bezetting, ' + label, melding: 'Nodig ' + fmt(nodig) + ' uur, vrij ' + fmt(vrij) + ' uur' + (geplandeAss.length ? ' (na de al geplande assessments)' : '') + '.', herstel: 'Breid de beschikbaarheid uit, verdeel assessments over meer docenten, of plan een deel in een andere week.' });
      if (soort === 'klas' && betrokken && !r.locatie) fouten.push({ bron: 'Locaties, klas ' + r.naam, melding: 'Deze klas heeft nog geen locatie: de eerste letter past bij geen enkele locatie.', herstel: 'Kies op het tabblad Locaties de locatie van ' + r.naam + ', of laat de klasnaam beginnen met de eerste letter van de locatie (A, D of E).' });
    }));
    m.locaties.forEach(l => {
      const mijn = open.filter(a => locVan(a.klas) === l.naam);
      const nodig = mijn.reduce((s, a) => s + a.uren, 0);
      const vrij = TV.reduce((s, t) => s + lokaalRests(l.naam, t.id).reduce((x, v) => x + v, 0), 0);
      const totaal = TV.reduce((s, t) => s + M().lokalenIn(m, l.naam, t.id) * t.uren, 0);
      const g = zet('locatie', l.naam, nodig, vrij, mijn.length, totaal);
      if (g > 1) waarschuwingen.push({ bron: 'Bezetting, locatie ' + l.naam, melding: 'Nodig ' + fmt(nodig) + ' lokaaluren, vrij ' + fmt(vrij) + ' lokaaluren.', herstel: 'Vraag extra lokalen aan; zie het tabblad Lokalen voor de dagdelen waar het knelt.' });
    });

    /* --- items --- */
    const lokaalTekort = [];
    const items = open.map(a => {
      const loc = locVan(a.klas);
      let overlapRegel = 0, overlapMensen = 0;
      TV.forEach(t => {
        const mc = mensenCap(a, t.id), wissel = locatieWissel(a, dag[t.id]).length > 0;
        if (!wissel) { overlapMensen += mc; overlapRegel += loc ? Math.min(mc, maxLokaalRest(loc, t.id)) : 0; }
      });
      const opt = opties(a), zonderWissel = opt.filter(o => !o.waarschuwing);
      const krapte = overlapMensen === 0 ? Infinity : a.uren / overlapMensen;
      const res = [{ soort: 'klas', naam: a.klas, graad: graad.klas[a.klas] || 0 }]
        .concat(a.docenten.map(d => ({ soort: 'docent', naam: d, graad: graad.docent[d] || 0 })));
      let prio = krapte, knelpunt = 'gezamenlijke beschikbaarheid';
      res.forEach(r => { if (r.graad > prio) { prio = r.graad; knelpunt = (r.soort === 'docent' ? 'docent ' : r.soort === 'klas' ? 'klas ' : 'lokalen ') + r.naam; } });
      const bron = 'Assessment ' + a.id + ' (' + a.module + ', ' + a.klas + ')';
      if (!opt.length && loc) {
        {
          fouten.push({ bron, melding: (a.docenten.length > 1 ? 'Klas en docenten zijn' : 'Klas en docent zijn') + ' samen maar ' + fmt(overlapMensen) + ' uur tegelijk vrij' + (geplandeAss.length ? ' (na de al geplande assessments)' : '') + '; nodig is ' + fmt(a.uren) + ' uur, in één dagdeel of doorlopend op één dag.', herstel: 'Breid de beschikbaarheid van ' + [a.klas].concat(a.docenten).join(', ') + ' uit, of verdeel het assessment.' });
        }
      } else if (opt.length && !zonderWissel.length) {
        waarschuwingen.push({ bron, melding: 'Past alleen als een docent die dag op twee locaties is.', herstel: 'Plan bij voorkeur eerst anders, of accepteer de locatiewissel bij het inplannen.' });
      }
      const capPerTv = {}; TV.forEach(t => { capPerTv[t.id] = locatieWissel(a, dag[t.id]).length ? -mensenCap(a, t.id) : mensenCap(a, t.id); });
      return { id: a.id, module: a.module, klas: a.klas, locatie: loc, docenten: a.docenten.slice(), uren: a.uren, overlap: overlapMensen, overlapMetLokaal: overlapRegel, krapte, prio, knelpunt, past: opt.length > 0, alleenMetWissel: opt.length > 0 && !zonderWissel.length, alleenMetExtraLokaal: opt.length > 0 && opt.every(o => o.extraLokaal), opties: opt, res, capPerTv };
    });

    /* --- koppelingen --- */
    const koppeling = {}, sleutel = (x, y) => x < y ? x + '|' + y : y + '|' + x;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j], gedeeld = [];
      if (a.klas === b.klas) gedeeld.push({ soort: 'klas', naam: a.klas, graad: graad.klas[a.klas] || 0 });
      a.docenten.forEach(d => { if (b.docenten.includes(d)) gedeeld.push({ soort: 'docent', naam: d, graad: graad.docent[d] || 0 }); });
      if (!gedeeld.length) continue;
      gedeeld.sort((p, q) => q.graad - p.graad);
      koppeling[sleutel(a.id, b.id)] = { gewicht: gedeeld[0].graad, via: gedeeld[0], gedeeld };
    }
    const kop = (x, y) => koppeling[sleutel(x, y)] || null;
    const drempel = m.instellingen.drempel;

    /* --- eilanden en volgorde ---
       Eilanden: samenhang via koppelingen boven de drempel. Eilanden op hoogste prioriteit; binnen een eiland eerst het
       krapste, daarna steeds het assessment met de sterkste koppeling aan wat al in de lijst staat
       (gelijkstand: hogere prioriteit, dan eigen krapte, dan laagste ID). */
    const ouder = {}; items.forEach(it => { ouder[it.id] = it.id; });
    const wortel = x => { while (ouder[x] !== x) { ouder[x] = ouder[ouder[x]]; x = ouder[x]; } return x; };
    Object.keys(koppeling).forEach(k => { if (koppeling[k].gewicht > drempel) { const [x, y] = k.split('|'); ouder[wortel(x)] = wortel(y); } });
    const groepen = {}; items.forEach(it => { (groepen[wortel(it.id)] = groepen[wortel(it.id)] || []).push(it); });
    const verschil = (x, y) => (x === y ? 0 : (y > x ? 1 : -1));
    const cmpPrio = (a, b) => verschil(a.prio, b.prio) || verschil(a.krapte, b.krapte) || (a.id < b.id ? -1 : 1);
    const eilanden = Object.values(groepen).map(g => g.sort(cmpPrio)).sort((a, b) => cmpPrio(a[0], b[0]));
    const volgorde = []; let eilandNr = 0;
    eilanden.forEach(g => {
      const naam = g.length > 1 ? 'E' + (++eilandNr) : 'los', rest = g.slice(), geplaatst = [];
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

    /* --- lokaaldruk per locatie en dagdeel (schatting) ---
       Verwachte vraag: elk open assessment verdeelt zijn uren over de dagdelen naar rato van de tijd waarin zijn
       klas en docent(en) samen vrij zijn (zonder locatiewissel). Plus wat al gepland is. Druk = (gepland + verwacht) ÷ lokaaluren. */
    const lokaaldruk = [];
    const verwacht = {};
    open.forEach(a => {
      const loc = locVan(a.klas); if (!loc) return;
      const caps = TV.map(t => locatieWissel(a, dag[t.id]).length ? 0 : mensenCap(a, t.id)), som = caps.reduce((x, v) => x + v, 0);
      if (!som) return;
      TV.forEach((t, i) => { const v = (verwacht[loc] = verwacht[loc] || {}); v[t.id] = (v[t.id] || 0) + a.uren * caps[i] / som; });
    });
    m.locaties.forEach(l => TV.forEach(t => {
      const lokalen = M().lokalenIn(m, l.naam, t.id), capaciteit = lokalen * t.uren;
      const gepland = Object.values((lokaalGebruik[l.naam] || {})[t.id] || {}).reduce((x, v) => x + v, 0);
      const vw = (verwacht[l.naam] || {})[t.id] || 0;
      const totaal = gepland + vw, druk = capaciteit ? totaal / capaciteit : (totaal > 0 ? Infinity : 0);
      const extra = Math.max(0, Math.ceil((totaal - capaciteit) / t.uren - 1e-9));
      lokaaldruk.push({ locatie: l.naam, tv: t.id, lokalen, standaard: l.lokalen, aangepast: l.perTijdvak[t.id] !== undefined, capaciteit, gepland, verwacht: vw, druk, extra });
    }));
    /* ingeplande assessments in een extra lokaal: daar is echt een lokaal extra nodig */
    geplandeAss.forEach(a => {
      const loc = locVan(a.klas);
      a.gepland.forEach(s => { if (U[s.tv] !== undefined && loc && isExtra(loc, s.tv, s.lokaal)) lokaalTekort.push({ id: a.id, module: a.module, klas: a.klas, locatie: loc, uren: s.uren, tv: s.tv, lokaal: s.lokaal }); });
    });
    m.locaties.forEach(l => TV.forEach(t => {
      const n = M().lokalenIn(m, l.naam, t.id), extraLokalen = new Set(lokaalTekort.filter(x => x.locatie === l.naam && x.tv === t.id).map(x => x.lokaal)).size;
      if (!extraLokalen) return;
      const d = lokaaldruk.find(r => r.locatie === l.naam && r.tv === t.id);
      d.extra = Math.max(d.extra, extraLokalen); d.tekort = lokaalTekort.filter(x => x.locatie === l.naam && x.tv === t.id).map(x => x.id);
      waarschuwingen.push({ bron: 'Lokalen, ' + l.naam + ' ' + t.label, melding: 'Er is ' + (extraLokalen > 1 ? extraLokalen + ' lokalen' : 'een lokaal') + ' extra nodig (nu ' + n + '): ' + d.tekort.join(', ') + ' ' + (d.tekort.length > 1 ? 'zijn' : 'is') + ' ingepland zonder vrij lokaal.', herstel: 'Vraag het extra lokaal aan en verhoog daarna het aantal lokalen voor dit dagdeel op het tabblad Lokalen.' });
    }));

    const gepland = geplandeAss.map(a => ({ id: a.id, module: a.module, klas: a.klas, locatie: locVan(a.klas), docenten: a.docenten.slice(), uren: a.uren, segmenten: a.gepland.map(s => Object.assign({}, s, locVan(a.klas) && U[s.tv] !== undefined && isExtra(locVan(a.klas), s.tv, s.lokaal) ? { extra: true } : {})) }));
    /* waarschuwing voor al geplande locatiewissels */
    Object.keys(docentDagLoc).forEach(d => Object.keys(docentDagLoc[d]).forEach(dg => {
      const s = docentDagLoc[d][dg]; if (s.size > 1) waarschuwingen.push({ bron: 'Planning, docent ' + d, melding: 'Op ' + dg + ' ingepland op ' + s.size + ' locaties: ' + Array.from(s).join(', ') + '.', herstel: 'Verplaats bij voorkeur een van deze assessments naar een andere dag.' });
    }));
    bezetting.sort((a, b) => verschil(a.graad, b.graad) || a.naam.localeCompare(b.naam));

    return { volgorde, gepland, bezetting, koppeling, kop, drempel, eilanden: eilandNr, los: volgorde.filter(x => x.eiland === 'los').length, fouten, waarschuwingen, lokaaldruk, lokaalTekort, lokaalRooster, invoerversie: m.invoerversie, tijdstip: new Date().toISOString() };
  }

  function fmt(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }
  function fmtGraad(g) { return g === Infinity ? 'geen ruimte' : (Math.round(g * 100) + '%'); }
  function fmtKrapte(k) { return k === Infinity ? '∞' : (Math.round(k * 100) / 100).toFixed(2).replace('.', ','); }

  /* Analyse alsof er nog niets gepland is (voor "bezetting bij invoer"). */
  function analyseerZonderPlanning(m) {
    const kopie = JSON.parse(JSON.stringify(m));
    kopie.assessments.forEach(a => { a.gepland = []; });
    return analyseer(kopie);
  }

  AP.rekenen = { analyseer, analyseerZonderPlanning, fmt, fmtGraad, fmtKrapte, dagVan };
})(typeof window !== 'undefined' ? window : globalThis);
