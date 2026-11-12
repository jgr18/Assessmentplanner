/* Assessmentplanner — een invoersjabloon of werkbestand (.xlsx) inlezen tot een planning.
   Alles wat klopt wordt ingelezen; wat niet klopt staat in de meldingen met tabblad, rij of cel en een herstelactie. */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};

  const tekst = v => (v === null || v === undefined) ? '' : String(v).trim();
  const getal = v => { if (typeof v === 'number') return v; const t = tekst(v).replace(',', '.'); return t === '' ? NaN : Number(t); };
  const isBeschikbaar = v => /^(\+|x|✓|v|ja|j|1|yes|y)$/i.test(tekst(v));
  const STD_IDS = ['ma-o', 'ma-m', 'di-o', 'di-m', 'wo-o', 'wo-m', 'do-o', 'do-m', 'vr-o', 'vr-m'];
  const celRef = (r, k) => AP.xlsx.kolom(k) + (r + 1);

  /* Zoek de kolom met een van de kopnamen (hoofdletterongevoelig). */
  function kolomVan(kop, namen) { return kop.findIndex(h => namen.some(n => tekst(h).toLowerCase().replace(/[\s()]/g, '') === n)); }

  async function leesBestand(buffer, bestandsnaam) {
    const fouten = [], waarschuwingen = [];
    const fout = (bron, melding, herstel) => fouten.push({ bron, melding, herstel });
    const let_op = (bron, melding, herstel) => waarschuwingen.push({ bron, melding, herstel });
    let wb;
    try { wb = await AP.xlsxLezen.lees(buffer); }
    catch (e) { return { model: null, fouten: [{ bron: bestandsnaam || 'Bestand', melding: e.message, herstel: 'Open een .xlsx-bestand dat in Excel is opgeslagen (geen .xls of .csv).' }], waarschuwingen }; }

    const m = AP.model.leegModel();
    m.locaties = []; m.tijdvakken = [];
    const assessments = await wb.blad('Assessments');
    if (!assessments) return { model: null, fouten: [{ bron: bestandsnaam || 'Bestand', melding: 'Het tabblad "Assessments" ontbreekt. Gevonden tabbladen: ' + wb.bladnamen.join(', ') + '.', herstel: 'Gebruik het invoersjabloon (knop "Sjabloon") of een werkbestand uit deze app.' }], waarschuwingen };
    const isWerkbestand = !!(await wb.blad('Planning'));

    /* --- Instellingen --- */
    const inst = await wb.blad('Instellingen');
    if (inst) inst.forEach((rij, i) => {
      const sleutel = tekst(rij[0]).toLowerCase(), w = rij[1];
      if (sleutel.startsWith('naam')) { if (tekst(w)) m.naam = tekst(w); }
      else if (sleutel.startsWith('drempel')) { const d = getal(w); if (!isNaN(d) && d >= 0 && d <= 100) m.instellingen.drempel = d > 1 ? d / 100 : d; else if (tekst(w)) fout('Tabblad Instellingen, cel B' + (i + 1), 'Drempel "' + tekst(w) + '" is geen percentage tussen 0 en 100.', 'Vul bijvoorbeeld 20 in.'); }
      else if (sleutel.startsWith('invoerversie')) { const v = getal(w); if (v >= 0) m.invoerversie = Math.round(v); }
    });
    if (!inst || m.naam === 'Nieuwe planning') m.naam = (bestandsnaam || 'Planning').replace(/\.xlsx$/i, '').replace(/[_]+/g, ' ');

    /* --- Locaties: kopregel = dagdelen, rij "Lesuren per dagdeel", daarna locaties --- */
    const loc = await wb.blad('Locaties');
    let tvVanKolom = {};
    if (loc && loc[0] && loc[0].length > 1) {
      const kop = loc[0];
      const gebruikt = new Set();
      kop.forEach((h, k) => {
        if (k === 0 || !tekst(h)) return;
        const label = tekst(h), std = label.toLowerCase();
        let id = STD_IDS.includes(std) && !gebruikt.has(std) ? std : 'T' + (m.volgendeTv++);
        gebruikt.add(id);
        m.tijdvakken.push({ id, label, uren: std === 'vr-m' ? 5 : 6 });
        tvVanKolom[k] = id;
      });
      const urenRij = loc.findIndex((r, i) => i > 0 && /^lesuren/i.test(tekst(r[0])));
      if (urenRij > 0) Object.keys(tvVanKolom).forEach(k => {
        const u = getal(loc[urenRij][k]), t = m.tijdvakken.find(x => x.id === tvVanKolom[k]);
        if (u > 0) t.uren = u; else fout('Tabblad Locaties, cel ' + celRef(urenRij, +k), 'Lesuren voor ' + t.label + ' ontbreken of zijn geen positief getal; ' + t.uren + ' aangenomen.', 'Vul het aantal lesuren in, bijvoorbeeld 6.');
      });
      else let_op('Tabblad Locaties', 'De rij "Lesuren per dagdeel" ontbreekt; 6 lesuren per dagdeel aangenomen (vr-m 5).', 'Zet onder de kopregel een rij met in de eerste kolom "Lesuren per dagdeel" en per dagdeel het aantal lesuren.');
      loc.forEach((r, i) => {
        if (i === 0 || i === urenRij) return;
        const naam = tekst(r[0]); if (!naam) return;
        if (m.locaties.some(x => x.naam.toLowerCase() === naam.toLowerCase())) { fout('Tabblad Locaties, rij ' + (i + 1), 'Locatie "' + naam + '" staat dubbel.', 'Laat elke locatie één keer voorkomen.'); return; }
        const aantallen = {};
        Object.keys(tvVanKolom).forEach(k => {
          const v = r[k], n = getal(v);
          if (tekst(v) === '') return;
          if (!(n >= 0) || Math.round(n) !== n) { fout('Tabblad Locaties, cel ' + celRef(i, +k), 'Aantal lokalen "' + tekst(v) + '" is geen heel getal.', 'Vul het aantal lokalen in, bijvoorbeeld 3.'); return; }
          aantallen[tvVanKolom[k]] = n;
        });
        const waarden = Object.values(aantallen), telling = {};
        waarden.forEach(v => { telling[v] = (telling[v] || 0) + 1; });
        const standaard = waarden.length ? Number(Object.keys(telling).sort((a, b) => telling[b] - telling[a] || a - b)[0]) : 1;
        const perTijdvak = {};
        m.tijdvakken.forEach(t => { if (aantallen[t.id] === undefined) aantallen[t.id] = standaard; if (aantallen[t.id] !== standaard) perTijdvak[t.id] = aantallen[t.id]; });
        m.locaties.push({ naam, lokalen: standaard, perTijdvak });
      });
    }
    if (!m.tijdvakken.length) {
      m.tijdvakken = AP.model.leegModel().tijdvakken;
      let_op('Tabblad Locaties', loc ? 'Geen dagdelen in de kopregel gevonden; de standaardweek (ma-o … vr-m) is gebruikt.' : 'Het tabblad ontbreekt; de standaardweek en de standaardlocaties zijn gebruikt.', 'Zet de dagdelen in de kopregel van het tabblad Locaties.');
      m.tijdvakken.forEach((t, k) => { tvVanKolom[k + 1] = t.id; });
    }
    if (!m.locaties.length) { m.locaties = AP.model.leegModel().locaties; if (loc) let_op('Tabblad Locaties', 'Geen locaties gevonden; Enschede (5), Deventer (3) en Apeldoorn (1) zijn gebruikt.', 'Zet onder de lesuren per locatie een regel met het aantal lokalen per dagdeel.'); }
    const alleTv = () => m.tijdvakken.map(t => t.id);
    const tvOpLabel = label => { const l = tekst(label).toLowerCase(); const t = m.tijdvakken.find(x => x.label.toLowerCase() === l || x.id === l); return t ? t.id : null; };

    /* --- Beschikbaarheid docenten en klassen --- */
    async function leesBeschikbaarheid(bladnaam, soort) {
      const b = await wb.blad(bladnaam); if (!b || !b[0]) return;
      const kop = b[0], lijst = soort === 'docent' ? m.docenten : m.klassen;
      const locKol = soort === 'klas' ? kolomVan(kop, ['locatie']) : -1;
      const kolTv = {};
      kop.forEach((h, k) => { if (k === 0 || k === locKol || !tekst(h)) return; const id = tvOpLabel(h); if (id) kolTv[k] = id; else let_op('Tabblad ' + bladnaam + ', cel ' + celRef(0, k), 'Dagdeel "' + tekst(h) + '" staat niet op het tabblad Locaties; deze kolom is overgeslagen.', 'Gebruik dezelfde dagdeelnamen als in de kopregel van het tabblad Locaties.'); });
      b.forEach((r, i) => {
        if (i === 0) return;
        const naam = tekst(r[0]); if (!naam) return;
        if (lijst.some(x => x.naam.toLowerCase() === naam.toLowerCase())) { fout('Tabblad ' + bladnaam + ', rij ' + (i + 1), '"' + naam + '" staat dubbel.', 'Laat elke naam één keer voorkomen; alleen de eerste regel is gebruikt.'); return; }
        const beschikbaar = Object.keys(kolTv).filter(k => isBeschikbaar(r[k])).map(k => kolTv[k]);
        const onbekend = Object.keys(kolTv).filter(k => tekst(r[k]) && !isBeschikbaar(r[k]));
        onbekend.forEach(k => let_op('Tabblad ' + bladnaam + ', cel ' + celRef(i, +k), '"' + tekst(r[k]) + '" is niet herkend als beschikbaar; gelezen als niet beschikbaar.', 'Gebruik + voor beschikbaar en laat de cel leeg voor niet beschikbaar.'));
        const res = { naam, beschikbaar: beschikbaar.length || onbekend.length ? beschikbaar : alleTv() };
        if (soort === 'klas') {
          const l = locKol >= 0 ? tekst(r[locKol]) : '';
          const gevonden = l ? m.locaties.find(x => x.naam.toLowerCase() === l.toLowerCase()) : null;
          if (l && !gevonden) fout('Tabblad Klassen, cel ' + celRef(i, locKol), 'Onbekende locatie "' + l + '" bij klas ' + naam + '.', 'Gebruik een locatie van het tabblad Locaties: ' + m.locaties.map(x => x.naam).join(', ') + '.');
          res.locatie = gevonden ? gevonden.naam : AP.model.locatieUitNaam(m, naam);
          if (!res.locatie) let_op('Tabblad Klassen, rij ' + (i + 1), 'Voor klas ' + naam + ' is geen locatie te bepalen: de eerste letter past niet bij ' + m.locaties.map(x => x.naam).join(', ') + '.', 'Begin de klasnaam met de eerste letter van de locatie (bijv. E voor Enschede), of kies de locatie later op het tabblad Locaties.');
        }
        lijst.push(res);
      });
    }
    await leesBeschikbaarheid('Docenten', 'docent');
    await leesBeschikbaarheid('Klassen', 'klas');

    /* --- Assessments --- */
    const kop = assessments[0] || [];
    const kId = kolomVan(kop, ['id']), kMod = kolomVan(kop, ['module']), kKlas = kolomVan(kop, ['klas/groep', 'klas', 'groep']), kDoc = kolomVan(kop, ['docent(en)', 'docenten', 'docent']), kUren = kolomVan(kop, ['uren', 'lesuren']);
    const ontbreekt = [['Module', kMod], ['Klas/groep', kKlas], ['Docent(en)', kDoc], ['Uren', kUren]].filter(x => x[1] < 0).map(x => x[0]);
    if (ontbreekt.length) fout('Tabblad Assessments, rij 1', 'Kolom(men) ontbreken in de kopregel: ' + ontbreekt.join(', ') + '.', 'Zet in rij 1 de koppen ID, Module, Klas/groep, Docent(en) en Uren.');
    else {
      const zonderId = [];
      assessments.forEach((r, i) => {
        if (i === 0) return;
        const module = tekst(r[kMod]), klas = tekst(r[kKlas]), docTekst = tekst(r[kDoc]), urenRuw = r[kUren];
        if (!module && !klas && !docTekst && tekst(urenRuw) === '') return;
        const bron = 'Tabblad Assessments, rij ' + (i + 1);
        if (!module) return fout(bron, 'Module ontbreekt.', 'Vul de module in (kolom ' + AP.xlsx.kolom(kMod) + ').');
        if (!klas) return fout(bron, 'Klas/groep ontbreekt bij ' + module + '.', 'Vul de klas of groep in (kolom ' + AP.xlsx.kolom(kKlas) + ').');
        const docenten = Array.from(new Set(docTekst.split(/[;,/+]| en /).map(x => x.trim()).filter(Boolean)));
        if (!docenten.length) return fout(bron, 'Docent ontbreekt bij ' + module + ' (' + klas + ').', 'Vul minstens één docent in; meerdere scheid je met een puntkomma.');
        const uren = getal(urenRuw);
        if (!(uren > 0)) return fout(bron + ', cel ' + celRef(i, kUren), 'Uren "' + tekst(urenRuw) + '" is geen positief getal.', 'Vul het aantal uren in, bijvoorbeeld 3 of 1,5.');
        let id = kId >= 0 ? tekst(r[kId]).toUpperCase() : '';
        if (id) {
          const nr = /^S(\d+)$/.exec(id);
          if (!nr) { fout(bron + ', cel ' + celRef(i, kId), 'ID "' + id + '" heeft niet de vorm S001; er is een nieuwe ID gegeven.', 'Laat de ID leeg of gebruik S gevolgd door een nummer.'); id = ''; }
          else { id = AP.model.maakId(parseInt(nr[1], 10)); if (m.assessments.some(a => a.id === id)) { fout(bron, 'ID ' + id + ' komt dubbel voor; er is een nieuwe ID gegeven.', 'Geef elk assessment een eigen ID, of laat de ID leeg.'); id = ''; } else m.volgendeNummer = Math.max(m.volgendeNummer, parseInt(nr[1], 10) + 1); }
        }
        const zoek = (soort, naam) => { const l = soort === 'docent' ? m.docenten : m.klassen; let x = l.find(y => y.naam.toLowerCase() === naam.toLowerCase()); if (!x) { x = { naam, beschikbaar: alleTv() }; if (soort === 'klas') x.locatie = AP.model.locatieUitNaam(m, naam); l.push(x); } return x.naam; };
        const a = { id, module, klas: zoek('klas', klas), docenten: docenten.map(d => zoek('docent', d)), uren, gepland: [] };
        m.assessments.push(a); if (!id) zonderId.push(a);
      });
      zonderId.forEach(a => { a.id = AP.model.maakId(m.volgendeNummer++); });
    }

    /* --- Planning (alleen werkbestand) --- */
    const plan = await wb.blad('Planning');
    if (plan && plan[0]) {
      const pk = plan[0], pId = kolomVan(pk, ['id']), pDag = kolomVan(pk, ['dagdeel', 'tijdvak']), pUren = kolomVan(pk, ['uren']), pLok = kolomVan(pk, ['lokaal']);
      if ([pId, pDag, pUren, pLok].some(x => x < 0)) fout('Tabblad Planning, rij 1', 'Kolommen ID, Dagdeel, Uren en Lokaal zijn nodig.', 'Herstel de kopregel van het tabblad Planning.');
      else {
        const segs = {};
        plan.forEach((r, i) => {
          if (i === 0 || !tekst(r[pId])) return;
          const bron = 'Tabblad Planning, rij ' + (i + 1), id = tekst(r[pId]).toUpperCase(), a = m.assessments.find(x => x.id === id);
          if (!a) return fout(bron, 'Assessment ' + id + ' staat niet op het tabblad Assessments.', 'Verwijder deze regel of voeg het assessment toe.');
          const tv = tvOpLabel(r[pDag]); if (!tv) return fout(bron, 'Onbekend dagdeel "' + tekst(r[pDag]) + '".', 'Gebruik een dagdeel uit de kopregel van het tabblad Locaties.');
          const uren = getal(r[pUren]), lokaal = getal(r[pLok]);
          if (!(uren > 0)) return fout(bron, 'Uren "' + tekst(r[pUren]) + '" is geen positief getal.', 'Vul het aantal uren in.');
          const klas = m.klassen.find(k => k.naam === a.klas), max = klas && klas.locatie ? AP.model.lokalenIn(m, klas.locatie, tv) : 0;
          if (!klas || !klas.locatie) return fout(bron, 'Klas ' + a.klas + ' van ' + id + ' heeft geen (geldige) locatie; de planning is niet overgenomen.', 'Kies de locatie van ' + a.klas + ' op het tabblad Klassen.');
          if (!(lokaal >= 1)) return fout(bron, 'Lokaal "' + tekst(r[pLok]) + '" is geen lokaalnummer.', 'Vul een lokaalnummer in (1, 2, …). Een nummer boven het aantal lokalen betekent: extra lokaal nodig.');
          if (lokaal > max) let_op(bron, id + ' staat in lokaal ' + Math.round(lokaal) + ', maar ' + klas.locatie + ' heeft op ' + tekst(r[pDag]) + ' ' + max + ' lokalen. Dit telt als extra lokaal nodig.', 'Vraag het lokaal aan en verhoog het aantal lokalen op het tabblad Locaties, of plan ' + id + ' anders.');
          (segs[id] = segs[id] || []).push({ tv, uren, lokaal: Math.round(lokaal) });
        });
        Object.keys(segs).forEach(id => {
          const a = m.assessments.find(x => x.id === id), som = segs[id].reduce((s, x) => s + x.uren, 0);
          if (Math.abs(som - a.uren) > 1e-9) { let_op('Tabblad Planning, ' + id, 'Ingepland ' + String(som).replace('.', ',') + ' uur, maar het assessment duurt ' + String(a.uren).replace('.', ',') + ' uur. De planning van ' + id + ' is niet overgenomen.', 'Maak de uren op het tabblad Planning gelijk aan de uren op het tabblad Assessments.'); return; }
          a.gepland = segs[id];
        });
      }
    }

    if (!m.assessments.length && !fouten.length) let_op('Tabblad Assessments', 'Er staan nog geen assessments in het bestand.', 'Vul het tabblad Assessments en open het bestand opnieuw, of voeg ze in de app toe.');
    m.invoerversie = (m.invoerversie || 0) + 1;
    return { model: AP.model.normaliseer(m), fouten, waarschuwingen, soort: isWerkbestand ? 'werkbestand' : 'sjabloon' };
  }

  AP.excelio = AP.excelio || {};
  AP.excelio.leesBestand = leesBestand;
})(typeof window !== 'undefined' ? window : globalThis);
