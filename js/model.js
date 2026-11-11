/* Assessmentplanner — gegevensmodel: tijdvakken, locaties met lokalen, docenten, klassen/groepen, assessments, opslag en validatie. */
(function (root) {
  'use strict';
  const AP = root.AP = root.AP || {};
  const OPSLAGSLEUTEL = 'assessmentplanner:model';

  function standaardTijdvakken() {
    const dagen = ['ma', 'di', 'wo', 'do', 'vr'], delen = [['o', 'ochtend'], ['m', 'middag']];
    const t = [];
    /* Standaard: dagdelen van 6 lesuren, vrijdagmiddag 5 — samen 59 lesuren per week. */
    dagen.forEach(d => delen.forEach(([k]) => t.push({ id: d + '-' + k, label: d + '-' + k, uren: d === 'vr' && k === 'm' ? 5 : 6 })));
    return t;
  }

  function standaardLocaties() {
    return [{ naam: 'Enschede', lokalen: 5, perTijdvak: {} }, { naam: 'Deventer', lokalen: 3, perTijdvak: {} }, { naam: 'Apeldoorn', lokalen: 1, perTijdvak: {} }];
  }

  function leegModel() {
    return {
      formaat: 'assessmentplanner', formaatversie: 2, naam: 'Nieuwe planning',
      invoerversie: 0, volgendeNummer: 1, vervallenIds: [], volgendeTv: 11,
      tijdvakken: standaardTijdvakken(),
      locaties: standaardLocaties(), // { naam, lokalen (standaard per dagdeel), perTijdvak: { tijdvak-id: aantal } }
      docenten: [],      // { naam, beschikbaar: [tijdvak-id] }
      klassen: [],       // { naam, beschikbaar: [tijdvak-id], locatie }
      assessments: [],   // { id, module, klas, docenten: [naam], uren, gepland: [{ tv, uren, lokaal }] }
      instellingen: { drempel: 0.2 }
    };
  }

  const maakId = n => 'S' + String(n).padStart(3, '0');
  const idNummer = id => { const r = /^S(\d+)$/.exec(id || ''); return r ? parseInt(r[1], 10) : null; };
  const gewijzigd = m => { m.invoerversie++; };
  const lijst = (m, soort) => soort === 'docent' ? m.docenten : m.klassen;
  const vindRes = (m, soort, naam) => lijst(m, soort).find(r => r.naam.toLowerCase() === String(naam).toLowerCase()) || null;
  const vindAss = (m, id) => m.assessments.find(a => a.id === id) || null;
  const splitsDocenten = s => String(s || '').split(/[;,/+]| en /).map(x => x.trim()).filter(Boolean);

  /* Locatie van een klas uit de eerste letter van de klasnaam: A = Apeldoorn, D = Deventer, E = Enschede.
     Werkt voor elke locatie: de letter moet bij precies één locatienaam de eerste letter zijn. */
  function locatieUitNaam(m, klasNaam) {
    const l = String(klasNaam || '').trim().charAt(0).toLowerCase(); if (!l) return '';
    const kandidaten = m.locaties.filter(x => x.naam.charAt(0).toLowerCase() === l);
    if (kandidaten.length === 1) return kandidaten[0].naam;
    return m.locaties.length === 1 ? m.locaties[0].naam : '';
  }
  function zorgVoorRes(m, soort, naam) {
    let r = vindRes(m, soort, naam);
    if (!r) { r = { naam: naam.trim(), beschikbaar: m.tijdvakken.map(t => t.id) }; if (soort === 'klas') r.locatie = locatieUitNaam(m, naam); lijst(m, soort).push(r); return { r, nieuw: true }; } /* nieuw = standaard volledig beschikbaar */
    return { r, nieuw: false };
  }

  const vindLoc = (m, naam) => m.locaties.find(l => l.naam.toLowerCase() === String(naam || '').trim().toLowerCase()) || null;

  /* Plakken: module ⇥ klas/groep ⇥ docent(en) ⇥ uren [⇥ locatie]. Docenten gescheiden door ; of ,
     Optioneel een ID vooraan (S001). Een kopregel ("module…") wordt overgeslagen.
     Een locatie in de vijfde kolom wordt de locatie van de klas. */
  function plakAssessments(m, tekst) {
    const regels = tekst.split(/\r?\n/), toegevoegd = [], fouten = [], nieuw = { docent: [], klas: [] };
    regels.forEach((ruw, i) => {
      if (!ruw.trim()) return;
      let d = ruw.split('\t').map(s => s.trim());
      if (d.length < 4 && ruw.includes(';') && !ruw.includes('\t')) d = ruw.split(/\s*\|\s*/).map(s => s.trim());
      const bron = 'Assessments plakken, regel ' + (i + 1);
      const fout = f => fouten.push(Object.assign(f, { bron, regel: i }));
      if (i === 0 && /^(id|module)$/i.test(d[0])) return;
      let id = null;
      if (/^S\d+$/i.test(d[0])) { id = maakId(idNummer(d[0].toUpperCase())); d = d.slice(1); }
      const [module, klas, docTekst, urenTekst, locTekst] = d;
      if (!module || !klas || !docTekst || urenTekst === undefined) return fout({ melding: 'Te weinig kolommen gevonden (' + d.length + ').', herstel: 'Gebruik per regel: module ⇥ klas/groep ⇥ docent(en) ⇥ uren, gescheiden door tabs (zoals bij plakken uit Excel).' });
      const uren = parseFloat(String(urenTekst).replace(',', '.'));
      if (!(uren > 0)) return fout({ melding: 'Uren "' + urenTekst + '" is geen positief getal.', herstel: 'Vul het aantal uren in, bijvoorbeeld 3 of 1,5.' });
      const docenten = splitsDocenten(docTekst);
      if (!docenten.length) return fout({ melding: 'Geen docent gevonden.', herstel: 'Vul minstens één docent in; meerdere scheid je met een puntkomma.' });
      const loc = locTekst ? vindLoc(m, locTekst) : null;
      if (locTekst && !loc) return fout({ melding: 'Onbekende locatie "' + locTekst + '".', herstel: 'Gebruik een van de locaties: ' + m.locaties.map(l => l.naam).join(', ') + ', of voeg de locatie toe op het tabblad Locaties.' });
      if (id) {
        if (vindAss(m, id)) return fout({ melding: 'ID ' + id + ' bestaat al.', herstel: 'Laat de ID weg om een nieuw assessment te maken.' });
        if (m.vervallenIds.includes(id)) return fout({ melding: 'ID ' + id + ' is eerder gebruikt en verwijderd.', herstel: 'Laat de ID weg; je krijgt automatisch een nieuwe.' });
        m.volgendeNummer = Math.max(m.volgendeNummer, idNummer(id) + 1);
      } else id = maakId(m.volgendeNummer++);
      const k = zorgVoorRes(m, 'klas', klas); if (k.nieuw) nieuw.klas.push(k.r.naam);
      if (loc) k.r.locatie = loc.naam;
      const docNamen = docenten.map(n => { const x = zorgVoorRes(m, 'docent', n); if (x.nieuw) nieuw.docent.push(x.r.naam); return x.r.naam; });
      m.assessments.push({ id, module, klas: k.r.naam, docenten: Array.from(new Set(docNamen)), uren, gepland: [] });
      toegevoegd.push(id);
    });
    if (toegevoegd.length) gewijzigd(m);
    return { toegevoegd, fouten, nieuw };
  }

  /* Plakken beschikbaarheid: naam ⇥ cel ⇥ cel … in de volgorde van de tijdvakken.
     Een gevulde cel (x, 1, ja, j) = beschikbaar. Kopregel met tijdvaknamen wordt herkend en overgeslagen. */
  function plakBeschikbaarheid(m, soort, tekst) {
    const regels = tekst.split(/\r?\n/), fouten = [], bijgewerkt = [];
    let kolommen = m.tijdvakken.map(t => t.id);
    regels.forEach((ruw, i) => {
      if (!ruw.trim()) return;
      const d = ruw.split('\t');
      const bron = 'Beschikbaarheid ' + (soort === 'docent' ? 'docenten' : 'klassen') + ' plakken, regel ' + (i + 1);
      const labels = d.slice(1).map(s => s.trim().toLowerCase());
      const herkend = labels.filter(l => m.tijdvakken.some(t => t.label.toLowerCase() === l)).length;
      if (i === 0 && herkend >= Math.max(1, labels.filter(Boolean).length - 1)) {
        kolommen = labels.map(l => { const t = m.tijdvakken.find(x => x.label.toLowerCase() === l); return t ? t.id : null; });
        return;
      }
      const naam = (d[0] || '').trim();
      if (!naam) { fouten.push({ bron, regel: i, melding: 'Geen naam in de eerste kolom.', herstel: 'Zet de naam van de ' + (soort === 'docent' ? 'docent' : 'klas/groep') + ' in de eerste kolom.' }); return; }
      if (d.length - 1 > kolommen.length) fouten.push({ bron, regel: i, melding: 'Meer kolommen (' + (d.length - 1) + ') dan tijdvakken (' + kolommen.length + '); de extra kolommen zijn genegeerd.', herstel: 'Controleer of de kolommen in dezelfde volgorde staan als de tijdvakken.' });
      const r = zorgVoorRes(m, soort, naam).r;
      r.beschikbaar = kolommen.filter((tv, j) => tv && /^(x|1|ja|j|v|✓|y|yes)$/i.test((d[j + 1] || '').trim()));
      bijgewerkt.push(r.naam);
    });
    if (bijgewerkt.length) gewijzigd(m);
    return { bijgewerkt, fouten };
  }

  function wisselBeschikbaar(m, soort, naam, tv) {
    const r = vindRes(m, soort, naam); if (!r) return;
    const i = r.beschikbaar.indexOf(tv);
    if (i >= 0) r.beschikbaar.splice(i, 1); else r.beschikbaar.push(tv);
    gewijzigd(m);
  }
  function zetRijBeschikbaar(m, soort, naam, aan) {
    const r = vindRes(m, soort, naam); if (!r) return;
    r.beschikbaar = aan ? m.tijdvakken.map(t => t.id) : [];
    gewijzigd(m);
  }

  /* Snel alles aan/uit: voor een hele lijst, of voor één tijdvak (kolom) bij iedereen. */
  function zetAllesBeschikbaar(m, soort, aan) {
    lijst(m, soort).forEach(r => { r.beschikbaar = aan ? m.tijdvakken.map(t => t.id) : []; });
    gewijzigd(m);
  }
  function zetKolomBeschikbaar(m, soort, tv, aan) {
    lijst(m, soort).forEach(r => {
      const i = r.beschikbaar.indexOf(tv);
      if (aan && i < 0) r.beschikbaar.push(tv);
      if (!aan && i >= 0) r.beschikbaar.splice(i, 1);
    });
    gewijzigd(m);
  }
  function voegResToe(m, soort, naam) { return zorgVoorRes(m, soort, naam); }

  function wijzigAssessment(m, id, veld, waarde) {
    const a = vindAss(m, id); if (!a) return;
    const bron = 'Assessments, ' + id;
    if (veld === 'uren') {
      const u = parseFloat(String(waarde).replace(',', '.'));
      if (!(u > 0)) return { bron, melding: 'Uren moet een positief getal zijn.', herstel: 'Vul bijvoorbeeld 3 of 1,5 in.' };
      a.uren = u;
    } else if (veld === 'docenten') {
      const d = splitsDocenten(waarde);
      if (!d.length) return { bron, melding: 'Een assessment heeft minstens één docent nodig.', herstel: 'Vul een docent in; meerdere scheid je met een puntkomma.' };
      a.docenten = Array.from(new Set(d.map(n => zorgVoorRes(m, 'docent', n).r.naam)));
    } else if (veld === 'klas') {
      if (!String(waarde).trim()) return { bron, melding: 'Een assessment heeft een klas of groep nodig.', herstel: 'Vul de klas of groep in.' };
      a.klas = zorgVoorRes(m, 'klas', String(waarde).trim()).r.naam;
    } else {
      if (!String(waarde).trim()) return { bron, melding: 'De module mag niet leeg zijn.', herstel: 'Vul de modulenaam in.' };
      a.module = String(waarde).trim();
    }
    gewijzigd(m);
  }
  function verwijderAssessment(m, id) {
    const i = m.assessments.findIndex(a => a.id === id); if (i < 0) return;
    m.assessments.splice(i, 1); if (!m.vervallenIds.includes(id)) m.vervallenIds.push(id); gewijzigd(m);
  }
  function gebruikt(m, soort, naam) {
    return m.assessments.filter(a => soort === 'docent' ? a.docenten.includes(naam) : a.klas === naam).map(a => a.id);
  }
  function verwijderRes(m, soort, naam) {
    if (gebruikt(m, soort, naam).length) return false;
    const l = lijst(m, soort), i = l.findIndex(r => r.naam === naam); if (i >= 0) l.splice(i, 1);
    gewijzigd(m); return true;
  }
  function hernoemRes(m, soort, oud, nieuw) {
    nieuw = String(nieuw || '').trim();
    const bron = (soort === 'docent' ? 'Docenten' : 'Klassen') + ', ' + oud;
    if (!nieuw) return { bron, melding: 'De naam mag niet leeg zijn.', herstel: 'Vul een naam in.' };
    if (nieuw.toLowerCase() !== oud.toLowerCase() && vindRes(m, soort, nieuw)) return { bron, melding: '"' + nieuw + '" bestaat al.', herstel: 'Kies een andere naam.' };
    const r = vindRes(m, soort, oud); if (!r || r.naam === nieuw) return;
    r.naam = nieuw;
    m.assessments.forEach(a => { if (soort === 'docent') a.docenten = a.docenten.map(d => d === oud ? nieuw : d); else if (a.klas === oud) a.klas = nieuw; });
    gewijzigd(m);
  }

  /* Inplannen: segmenten [{ tv, uren, lokaal }]. Lokaal = nummer 1..n op de locatie van de klas. */
  function plan(m, id, segmenten) { const a = vindAss(m, id); if (a) { a.gepland = segmenten.map(s => ({ tv: s.tv, uren: s.uren, lokaal: s.lokaal })); gewijzigd(m); } }

  /* Locaties en lokalen */
  function lokalenIn(m, locNaam, tv) {
    const l = vindLoc(m, locNaam); if (!l) return 0;
    return l.perTijdvak && l.perTijdvak[tv] !== undefined ? l.perTijdvak[tv] : l.lokalen;
  }
  function zetLokalen(m, locNaam, tv, aantal) {
    const l = vindLoc(m, locNaam); if (!l) return;
    const n = aantal === '' || aantal === null || aantal === undefined ? null : Math.max(0, Math.round(Number(String(aantal).replace(',', '.'))));
    if (n === null || isNaN(n) || n === l.lokalen) delete l.perTijdvak[tv]; else l.perTijdvak[tv] = n;
    gewijzigd(m);
  }
  function wijzigLocatie(m, oud, veld, waarde) {
    const l = vindLoc(m, oud); if (!l) return;
    const bron = 'Locaties, ' + oud;
    if (veld === 'lokalen') {
      const n = Math.round(Number(String(waarde).replace(',', '.')));
      if (!(n >= 0)) return { bron, melding: 'Het aantal lokalen moet 0 of meer zijn.', herstel: 'Vul een heel getal in, bijvoorbeeld 3.' };
      l.lokalen = n; Object.keys(l.perTijdvak).forEach(t => { if (l.perTijdvak[t] === n) delete l.perTijdvak[t]; });
    } else {
      const nieuw = String(waarde || '').trim();
      if (!nieuw) return { bron, melding: 'De naam mag niet leeg zijn.', herstel: 'Vul een naam in.' };
      if (nieuw.toLowerCase() !== oud.toLowerCase() && vindLoc(m, nieuw)) return { bron, melding: '"' + nieuw + '" bestaat al.', herstel: 'Kies een andere naam.' };
      m.klassen.forEach(k => { if (k.locatie === l.naam) k.locatie = nieuw; });
      l.naam = nieuw;
    }
    gewijzigd(m);
  }
  function voegLocatieToe(m, naam, lokalen) {
    naam = String(naam || '').trim();
    if (!naam) return { bron: 'Locaties', melding: 'Geen naam ingevuld.', herstel: 'Vul de naam van de locatie in.' };
    if (vindLoc(m, naam)) return { bron: 'Locaties', melding: '"' + naam + '" bestaat al.', herstel: 'Kies een andere naam.' };
    const n = Math.round(Number(String(lokalen).replace(',', '.')));
    m.locaties.push({ naam, lokalen: n >= 0 ? n : 1, perTijdvak: {} }); gewijzigd(m);
  }
  function verwijderLocatie(m, naam) {
    if (m.klassen.some(k => k.locatie === naam)) return false;
    m.locaties = m.locaties.filter(l => l.naam !== naam); gewijzigd(m); return true;
  }
  function zetKlasLocatie(m, klas, locNaam) {
    const k = vindRes(m, 'klas', klas); if (!k) return;
    const l = locNaam ? vindLoc(m, locNaam) : null;
    if (k.locatie === (l ? l.naam : '')) return;
    k.locatie = l ? l.naam : '';
    m.assessments.forEach(a => { if (a.klas === k.naam) a.gepland = []; }); /* andere locatie: planning van die klas vervalt */
    gewijzigd(m);
  }
  /* Plakken: klas ⇥ locatie */
  function plakKlasLocaties(m, tekst) {
    const fouten = [], bijgewerkt = [];
    tekst.split(/\r?\n/).forEach((ruw, i) => {
      if (!ruw.trim()) return;
      const [klas, loc] = ruw.split('\t').map(s => (s || '').trim());
      const bron = 'Klassen en locaties plakken, regel ' + (i + 1);
      if (i === 0 && /^klas/i.test(klas) && /^locatie/i.test(loc || '')) return;
      if (!klas || !loc) { fouten.push({ bron, regel: i, melding: 'Verwacht: klas ⇥ locatie.', herstel: 'Zet de klas in de eerste en de locatie in de tweede kolom.' }); return; }
      const l = vindLoc(m, loc);
      if (!l) { fouten.push({ bron, regel: i, melding: 'Onbekende locatie "' + loc + '".', herstel: 'Gebruik een van de locaties: ' + m.locaties.map(x => x.naam).join(', ') + '.' }); return; }
      const k = zorgVoorRes(m, 'klas', klas).r;
      if (k.locatie !== l.naam) { k.locatie = l.naam; m.assessments.forEach(a => { if (a.klas === k.naam) a.gepland = []; }); }
      bijgewerkt.push(k.naam);
    });
    if (bijgewerkt.length) gewijzigd(m);
    return { bijgewerkt, fouten };
  }
  function ontplan(m, id) { const a = vindAss(m, id); if (a) { a.gepland = []; gewijzigd(m); } }

  /* Tijdvakken beheren. Een tijdvak verwijderen haalt het ook uit beschikbaarheid en planning. */
  function voegTijdvakToe(m, label, uren) {
    const id = 'T' + (m.volgendeTv++);
    m.tijdvakken.push({ id, label: label || id, uren: uren > 0 ? uren : 6 });
    m.docenten.concat(m.klassen).forEach(r => r.beschikbaar.push(id)); /* nieuw tijdvak: standaard iedereen beschikbaar */
    gewijzigd(m); return id;
  }
  function wijzigTijdvak(m, id, veld, waarde) {
    const t = m.tijdvakken.find(x => x.id === id); if (!t) return;
    if (veld === 'uren') { const u = parseFloat(String(waarde).replace(',', '.')); if (!(u > 0)) return { bron: 'Tijdvakken, ' + t.label, melding: 'Uren moet een positief getal zijn.', herstel: 'Vul bijvoorbeeld 6 in.' }; t.uren = u; }
    else { if (!String(waarde).trim()) return { bron: 'Tijdvakken', melding: 'De naam van een tijdvak mag niet leeg zijn.', herstel: 'Vul een naam in, bijvoorbeeld ma-o.' }; t.label = String(waarde).trim(); }
    gewijzigd(m);
  }
  /* Zet de uren van de standaard dagdelen terug op 6 (vrijdagmiddag 5); namen, extra tijdvakken, beschikbaarheid en planning blijven. */
  function standaardUren(m) {
    const std = {}; standaardTijdvakken().forEach(t => { std[t.id] = t.uren; });
    let n = 0; m.tijdvakken.forEach(t => { if (std[t.id] !== undefined && t.uren !== std[t.id]) { t.uren = std[t.id]; n++; } });
    if (n) gewijzigd(m); return n;
  }
  function verwijderTijdvak(m, id) {
    m.tijdvakken = m.tijdvakken.filter(t => t.id !== id);
    m.docenten.concat(m.klassen).forEach(r => { r.beschikbaar = r.beschikbaar.filter(x => x !== id); });
    m.assessments.forEach(a => { if (a.gepland.some(s => s.tv === id)) a.gepland = []; }); /* planning in dat tijdvak vervalt in zijn geheel */
    m.locaties.forEach(l => { delete l.perTijdvak[id]; });
    gewijzigd(m);
  }
  function verplaatsTijdvak(m, id, richting) {
    const i = m.tijdvakken.findIndex(t => t.id === id), j = i + richting;
    if (i < 0 || j < 0 || j >= m.tijdvakken.length) return;
    const t = m.tijdvakken[i]; m.tijdvakken[i] = m.tijdvakken[j]; m.tijdvakken[j] = t; gewijzigd(m);
  }

  function valideer(data) {
    const f = [], bron = 'Modelbestand';
    if (!data || data.formaat !== 'assessmentplanner') { f.push({ bron, melding: 'Dit is geen modelbestand van de assessmentplanner.', herstel: 'Open een .json-bestand dat met "Opslaan" uit deze tool is gemaakt.' }); return f; }
    const tv = new Set((data.tijdvakken || []).map(t => t.id)), ids = new Set();
    const doc = new Set((data.docenten || []).map(r => r.naam)), kl = new Set((data.klassen || []).map(r => r.naam));
    (data.assessments || []).forEach((a, i) => {
      const p = bron + ', assessments[' + (i + 1) + ']';
      if (!/^S\d{3,}$/.test(a.id || '')) f.push({ bron: p, melding: 'Ongeldige ID "' + a.id + '".', herstel: 'Gebruik ID\'s in de vorm S001.' });
      else if (ids.has(a.id)) f.push({ bron: p, melding: 'ID ' + a.id + ' komt dubbel voor.', herstel: 'Geef elk assessment een eigen ID.' });
      else ids.add(a.id);
      if (!kl.has(a.klas)) f.push({ bron: p, melding: 'Klas "' + a.klas + '" staat niet in de klassenlijst.', herstel: 'Voeg de klas toe aan "klassen".' });
      (a.docenten || []).forEach(d => { if (!doc.has(d)) f.push({ bron: p, melding: 'Docent "' + d + '" staat niet in de docentenlijst.', herstel: 'Voeg de docent toe aan "docenten".' }); });
      (a.gepland || []).forEach(s => { const t = typeof s === 'string' ? s : s && s.tv; if (!tv.has(t)) f.push({ bron: p, melding: 'Gepland in onbekend tijdvak "' + t + '".', herstel: 'Verwijder de planning of voeg het tijdvak toe.' }); });
    });
    return f;
  }
  function normaliseer(d) {
    const m = Object.assign(leegModel(), d);
    m.instellingen = Object.assign(leegModel().instellingen, d.instellingen || {});
    if (!Array.isArray(d.locaties)) m.locaties = standaardLocaties();
    m.locaties = m.locaties.map(l => Object.assign({ lokalen: 1, perTijdvak: {} }, l));
    m.klassen = m.klassen.map(k => { k = Object.assign({ locatie: '' }, k); if (!k.locatie) k.locatie = locatieUitNaam(m, k.naam); return k; });
    const urenTv = {}; m.tijdvakken.forEach(t => { urenTv[t.id] = t.uren; });
    m.assessments = m.assessments.map(a => {
      a = Object.assign({ gepland: [] }, a);
      if (a.gepland.length && typeof a.gepland[0] === 'string') { /* oude planning (hele tijdvakken): omzetten naar uren in lokaal 1 */
        let rest = a.uren;
        a.gepland = a.gepland.map(tv => { const u = Math.min(rest, urenTv[tv] || 0); rest -= u; return { tv, uren: u, lokaal: 1 }; }).filter(s => s.uren > 0);
      }
      return a;
    });
    m.formaatversie = 2;
    const max = m.assessments.concat((m.vervallenIds || []).map(id => ({ id }))).reduce((x, a) => Math.max(x, idNummer(a.id) || 0), 0);
    m.volgendeNummer = Math.max(m.volgendeNummer || 1, max + 1);
    return m;
  }
  function bewaarLokaal(m) { try { root.localStorage.setItem(OPSLAGSLEUTEL, JSON.stringify(m)); return true; } catch (e) { return false; } }
  function laadLokaal() {
    try { const t = root.localStorage.getItem(OPSLAGSLEUTEL); if (!t) return null; const d = JSON.parse(t); return valideer(d).length ? null : normaliseer(d); }
    catch (e) { return null; }
  }
  function wisLokaal() { try { root.localStorage.removeItem(OPSLAGSLEUTEL); } catch (e) { /* niets */ } }

  AP.model = {
    leegModel, maakId, vindRes, vindAss, plakAssessments, plakBeschikbaarheid, wisselBeschikbaar, zetRijBeschikbaar, zetAllesBeschikbaar, zetKolomBeschikbaar, voegResToe,
    wijzigAssessment, verwijderAssessment, gebruikt, verwijderRes, hernoemRes, plan, ontplan,
    voegTijdvakToe, wijzigTijdvak, standaardUren, verwijderTijdvak, verplaatsTijdvak, valideer, normaliseer, bewaarLokaal, laadLokaal, wisLokaal,
    vindLoc, locatieUitNaam, lokalenIn, zetLokalen, wijzigLocatie, voegLocatieToe, verwijderLocatie, zetKlasLocatie, plakKlasLocaties
  };
})(typeof window !== 'undefined' ? window : globalThis);
