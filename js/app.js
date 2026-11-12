/* Assessmentplanner — schermen en bediening. */
(function () {
  'use strict';
  const M = AP.model, R = AP.rekenen;
  const $ = s => document.querySelector(s);
  const inhoud = $('#inhoud');
  let m = M.laadLokaal() || M.leegModel();
  const ui = { tab: 'assessments', soort: 'docent', inplannen: null, optie: 0, matrixSel: null, beschZoek: { docent: '', klas: '' }, matrixModus: 'open',
    afdruk: { resultaat: true, volgorde: true, matrix: true, bezInvoer: true, bezNa: true, lokalen: true, lokaalBezetting: true, indeling: true, beschDoc: true, beschKlas: true, interventies: true } };
  /* Matrix: 'open' = tussen nog te plannen assessments (met de ruimte die over is); 'alle' = alle assessments, vanaf het begin (alsof niets gepland is). */
  const matrixAnalyse = () => ui.matrixModus === 'alle' ? R.analyseerZonderPlanning(m) : analyse();

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tv = id => m.tijdvakken.find(t => t.id === id) || { id, label: id, uren: 0 };
  const dagVan = t => (t.label.split(/[-\s]/)[0] || '').toLowerCase();
  function bewaar() { if (!M.bewaarLokaal(m)) toonFouten([{ bron: 'Browseropslag', melding: 'De planning kon niet in de browser worden bewaard.', herstel: 'Gebruik "Opslaan" om een bestand te maken.' }]); }
  function na() { bewaar(); renderKop(); }
  const analyse = () => R.analyseer(m);
  const segTekst = segs => segs.map(s => tv(s.tv).label + ' ' + R.fmt(s.uren) + 'u · ' + (s.extra ? 'extra lokaal nodig' : 'lokaal ' + s.lokaal)).join(' + ');
  const klasLoc = naam => { const k = M.vindRes(m, 'klas', naam); return (k && k.locatie) || ''; };
  /* Gebruikte uren per docent of klas per tijdvak door geplande assessments. */
  function bezetUren(soort) {
    const uit = {};
    m.assessments.filter(a => a.gepland.length).forEach(a => (soort === 'docent' ? a.docenten : [a.klas]).forEach(n => a.gepland.forEach(s => {
      const x = ((uit[n] = uit[n] || {})[s.tv] = uit[n][s.tv] || { uren: 0, ids: [] }); x.uren += s.uren; x.ids.push(a.id);
    })));
    return uit;
  }

  /* ---------- meldingen ---------- */
  function lijstMeldingen(fouten) { return '<ul>' + fouten.map(f => '<li><b>' + esc(f.bron) + ':</b> ' + esc(f.melding) + (f.herstel ? ' <b>Herstel:</b> ' + esc(f.herstel) : '') + '</li>').join('') + '</ul>'; }
  function toonFouten(fouten, titel) {
    if (!fouten || !fouten.length) return;
    $('#meldingen').innerHTML = '<div class="melding fout" role="alert"><div><strong>' + esc(titel || (fouten.length === 1 ? 'Er ging iets mis' : fouten.length + ' problemen gevonden')) + '</strong>' + lijstMeldingen(fouten) + '</div><button aria-label="Melding sluiten" data-sluit>×</button></div>';
  }
  function toonMeldingen(titel, fouten, waarschuwingen) {
    const f = fouten || [], w = waarschuwingen || [];
    if (!f.length && !w.length) { toonOk(titel); return; }
    $('#meldingen').innerHTML = '<div class="melding ' + (f.length ? 'fout' : 'ok') + '" role="alert"><div><strong>' + esc(titel) + '</strong>' +
      (f.length ? '<p style="margin:6px 0 0"><b>' + f.length + ' regel(s) of cel(len) niet overgenomen:</b></p>' + lijstMeldingen(f) : '') +
      (w.length ? '<p style="margin:6px 0 0"><b>Let op (' + w.length + '):</b></p>' + lijstMeldingen(w) : '') +
      '</div><button aria-label="Melding sluiten" data-sluit>×</button></div>';
  }
  function toonOk(t) { $('#meldingen').innerHTML = '<div class="melding ok" role="status"><div>' + esc(t) + '</div><button aria-label="Melding sluiten" data-sluit>×</button></div>'; }
  const wisMeldingen = () => { $('#meldingen').innerHTML = ''; };
  $('#meldingen').addEventListener('click', e => { if (e.target.hasAttribute('data-sluit')) wisMeldingen(); });

  /* ---------- kop, tabs, bestand ---------- */
  function renderKop() {
    $('#modelnaam').value = m.naam;
    const gepland = m.assessments.filter(a => a.gepland.length).length;
    $('#meta').textContent = 'Invoerversie ' + m.invoerversie + ' · ' + m.assessments.length + ' assessments (' + gepland + ' gepland) · ' + m.docenten.length + ' docenten · ' + m.klassen.length + ' klassen';
    const r = analyse(), el = $('#status');
    if (!m.assessments.length) { el.className = 'status geen'; el.textContent = 'Nog leeg'; }
    else if (r.fouten.length) { el.className = 'status fout'; el.textContent = r.fouten.length + ' fout' + (r.fouten.length > 1 ? 'en' : '') + ' in de invoer'; }
    else if (r.waarschuwingen.length) { el.className = 'status verouderd'; el.textContent = r.waarschuwingen.length + ' waarschuwing' + (r.waarschuwingen.length > 1 ? 'en' : ''); }
    else { el.className = 'status ok'; el.textContent = 'Invoer compleet'; }
  }
  function render() {
    renderKop();
    document.querySelectorAll('.tabs button').forEach(b => { if (b.dataset.tab === ui.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    inhoud.classList.toggle('volle-breedte', ui.tab === 'matrix' || ui.tab === 'export' || ui.tab === 'lokalen');
    ({ assessments: renderAssessments, beschikbaarheid: renderBeschikbaarheid, locaties: renderLocaties, tijdvakken: renderTijdvakken, volgorde: renderVolgorde, matrix: renderMatrix, bezetting: renderBezetting, lokalen: renderLokalen, interventies: renderInterventies, export: renderExport })[ui.tab]();
  }
  document.querySelector('.tabbalk').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { ui.tab = b.dataset.tab; wisMeldingen(); render(); window.scrollTo(0, 0); } });
  $('#modelnaam').addEventListener('change', e => { m.naam = e.target.value.trim() || 'Naamloze planning'; m.invoerversie++; na(); });

  const heeftInhoud = () => m.assessments.length || m.docenten.length || m.klassen.length;
  function laad(nieuw, tekst) { m = nieuw; ui.inplannen = null; ui.matrixSel = null; ui.ivForm = null; ui.ivBewerk = null; bewaar(); ui.tab = 'assessments'; render(); if (tekst) toonOk(tekst); }
  function download(naam, inhoudData, type) {
    const blob = new Blob([inhoudData], { type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = naam; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const bestandsnaam = ext => (m.naam || 'planning').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '_v' + m.invoerversie + ext;
  const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  /* Opslaan = werkbestand: invoer (4 tabbladen) + planning + instellingen + alle uitvoer. */
  function opslaan() {
    const naam = bestandsnaam('.xlsx');
    download(naam, AP.xlsx.maak(AP.excelio.werkbestandBladen(m, analyse())), XLSX_TYPE);
    toonOk('Werkbestand opgeslagen als ' + naam + ': invoer, planning en uitvoer in één Excel-bestand. Je kunt het later weer openen met "Excel openen". Bewaar het op een beveiligde plek.');
  }
  function sjabloonDownloaden() {
    download('Invoersjabloon_assessmentplanner.xlsx', AP.xlsx.maak(AP.excelio.sjabloonBladen(M.leegModel())), XLSX_TYPE);
    toonOk('Leeg invoersjabloon gedownload. Vul de tabbladen Assessments, Locaties, Docenten en Klassen in en open het met "Excel openen".');
  }

  document.querySelector('.bestand').addEventListener('click', e => {
    const b = e.target.closest('[data-actie]'); if (!b) return;
    const a = b.dataset.actie;
    if (a === 'nieuw') { if (heeftInhoud() && !confirm('Een nieuwe, lege planning beginnen? Sla de huidige eerst op als je die wilt bewaren.')) return; laad(M.leegModel(), 'Nieuwe lege planning gestart.'); }
    else if (a === 'voorbeeld') { if (heeftInhoud() && !confirm('Het fictieve voorbeeld laden? De huidige planning wordt vervangen; sla die eerst op als je hem wilt bewaren.')) return; const vb = M.normaliseer(JSON.parse(JSON.stringify(AP.voorbeeld))); laad(vb, 'Fictief voorbeeld geladen: ' + vb.assessments.length + ' assessments, ' + vb.docenten.length + ' docenten, ' + vb.klassen.length + ' klassen op ' + vb.locaties.length + ' locaties.'); }
    else if (a === 'openen') $('#bestandkiezer').click();
    else if (a === 'opslaan') opslaan();
    else if (a === 'sjabloon') sjabloonDownloaden();
  });
  inhoud.addEventListener('click', e => {
    const s = e.target.closest('[data-start]'); if (!s) return;
    const a = s.dataset.start;
    if (a === 'openen') $('#bestandkiezer').click();
    else if (a === 'sjabloon') sjabloonDownloaden();
    else if (a === 'voorbeeld') document.querySelector('[data-actie="voorbeeld"]').click();
  });
  $('#bestandkiezer').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!/\.xlsx$/i.test(f.name)) { toonFouten([{ bron: f.name, melding: 'Dit is geen .xlsx-bestand.', herstel: 'Sla het bestand in Excel op als "Excel-werkmap (.xlsx)" en open het opnieuw.' }]); return; }
    const lezer = new FileReader();
    lezer.onload = async () => {
      const res = await AP.excelio.leesBestand(lezer.result, f.name);
      if (!res.model) { toonFouten(res.fouten, 'Bestand niet geopend'); return; }
      if (heeftInhoud() && !confirm('De huidige planning vervangen door "' + f.name + '"?')) return;
      const nm = res.model, gepland = nm.assessments.filter(a => a.gepland.length).length;
      laad(nm);
      toonMeldingen((res.soort === 'werkbestand' ? 'Werkbestand' : 'Invoer') + ' geopend: ' + f.name + ' — ' + nm.assessments.length + ' assessments, ' + nm.docenten.length + ' docenten, ' + nm.klassen.length + ' klassen, ' + nm.locaties.length + ' locaties' + (gepland ? ', ' + gepland + ' al gepland' : '') + '.', res.fouten, res.waarschuwingen);
    };
    lezer.onerror = () => toonFouten([{ bron: f.name, melding: 'Het bestand kon niet worden gelezen.', herstel: 'Sluit het bestand in Excel en probeer het opnieuw.' }]);
    lezer.readAsArrayBuffer(f);
  });

  /* ================= ASSESSMENTS ================= */
  function startscherm() {
    inhoud.innerHTML = '<section class="paneel" style="flex:1 1 100%;max-width:900px;margin:24px auto;padding:32px;gap:18px">' +
      '<h2 style="font-size:20px">Starten met de assessmentplanner</h2>' +
      '<p class="uitleg">Begin met een Excel-bestand. Dat kan het <b>invoersjabloon</b> zijn (vier tabbladen: Assessments, Locaties, Docenten en Klassen) of een eerder opgeslagen <b>werkbestand</b> met je planning. De app herkent zelf welk van de twee het is.</p>' +
      '<div class="startknoppen">' +
      '<button class="startknop primair" data-start="openen"><b>Excel openen</b><span>Invoersjabloon of werkbestand (.xlsx)</span></button>' +
      '<button class="startknop" data-start="sjabloon"><b>Leeg sjabloon downloaden</b><span>Vul het in Excel in en open het daarna hier</span></button>' +
      '<button class="startknop" data-start="voorbeeld"><b>Voorbeeld bekijken</b><span>Een fictieve assessmentweek op drie locaties</span></button></div>' +
      '<p class="klein">In het sjabloon zet je bij Docenten en Klassen een <b>+</b> in de dagdelen waarin iemand beschikbaar is. Wie niet op die tabbladen staat, is overal beschikbaar. Opslaan gaat met <b>Opslaan als Excel</b>: dat bewaart invoer, planning en uitvoer samen in één werkbestand. Tussendoor bewaart de browser je werk automatisch.</p>' +
      '<p class="klein">Liever direct beginnen zonder Excel? Plak je assessments dan hieronder.</p></section>' +
      '<section class="paneel" style="flex:1 1 100%;max-width:900px;margin:0 auto"><h2>Assessments plakken</h2>' +
      '<p class="uitleg mono" style="font-size:12px">module ⇥ klas/groep ⇥ docent(en) ⇥ uren ⇥ locatie</p>' +
      '<label class="veld">Regels<textarea id="plak" rows="5" class="mono"></textarea></label>' +
      '<div class="rij"><button class="knop primair" id="plak-knop">Controleren en toevoegen</button></div></section>';
  }
  function renderAssessments() {
    if (!heeftInhoud()) return startscherm();
    const r = analyse(), status = {};
    r.volgorde.forEach(it => { status[it.id] = it.past ? '' : 'past niet'; });
    const rijen = m.assessments.map(a => '<tr data-zoek="' + esc((a.id + ' ' + a.module + ' ' + a.klas + ' ' + a.docenten.join(' ')).toLowerCase()) + '">' +
      '<td class="mono"><b>' + a.id + '</b></td>' +
      '<td><label class="verborgen" for="mo-' + a.id + '">Module ' + a.id + '</label><input id="mo-' + a.id + '" data-ass="' + a.id + '" data-veld="module" value="' + esc(a.module) + '"></td>' +
      '<td><label class="verborgen" for="kl-' + a.id + '">Klas ' + a.id + '</label><input id="kl-' + a.id + '" data-ass="' + a.id + '" data-veld="klas" value="' + esc(a.klas) + '"></td>' +
      '<td><label class="verborgen" for="do-' + a.id + '">Docenten ' + a.id + '</label><input id="do-' + a.id + '" data-ass="' + a.id + '" data-veld="docenten" value="' + esc(a.docenten.join('; ')) + '"></td>' +
      '<td style="width:80px"><label class="verborgen" for="ur-' + a.id + '">Uren ' + a.id + '</label><input id="ur-' + a.id + '" data-ass="' + a.id + '" data-veld="uren" value="' + esc(String(a.uren).replace('.', ',')) + '"></td>' +
      '<td><label class="verborgen" for="lo-' + a.id + '">Locatie ' + a.id + '</label><select id="lo-' + a.id + '" data-klasloc="' + esc(a.klas) + '"><option value="">— kies —</option>' + m.locaties.map(l => '<option' + (klasLoc(a.klas) === l.naam ? ' selected' : '') + '>' + esc(l.naam) + '</option>').join('') + '</select></td>' +
      '<td class="klein">' + (a.gepland.length ? '<span class="label-ok">gepland: ' + esc(segTekst(a.gepland)) + '</span>' : (status[a.id] ? '<span class="pastniet">past niet</span>' : '')) + '</td>' +
      '<td class="rechts"><button class="knop klein-k gevaar" data-weg="' + a.id + '" aria-label="' + a.id + ' verwijderen">✕</button></td></tr>').join('');
    inhoud.innerHTML =
      '<section class="kolom smal"><div class="paneel"><h2>Assessments plakken</h2>' +
      '<p class="uitleg">Eén assessment per regel, kolommen gescheiden door tabs (zoals bij kopiëren uit Excel):</p>' +
      '<p class="uitleg mono" style="font-size:12px">module ⇥ klas/groep ⇥ docent(en) ⇥ uren ⇥ locatie</p>' +
      '<p class="klein">De locatie is optioneel en wordt de locatie van de klas (' + esc(m.locaties.map(l => l.naam).join(', ')) + '). Je kunt hem ook later per klas kiezen.</p>' +
      '<p class="klein">Meerdere docenten scheid je met een puntkomma; zij zijn dan <b>tegelijk</b> nodig. Groepen die los van elkaar worden afgenomen zijn aparte regels. Een kopregel wordt overgeslagen. Nieuwe docenten en klassen komen automatisch op het tabblad Beschikbaarheid, standaard volledig beschikbaar.</p>' +
      '<label class="veld">Regels<textarea id="plak" rows="9" class="mono" placeholder="Statistiek&#9;1A&#9;Jansen&#9;3&#10;Eindpresentatie&#9;3A&#9;Bakker; Mulder&#9;2"></textarea></label>' +
      '<div class="rij"><button class="knop primair" id="plak-knop">Controleren en toevoegen</button><button class="knop" id="plak-wis">Wissen</button></div></div>' +
      '</section>' +
      '<section class="paneel breed"><div class="rij tussen"><div><h2>Assessments</h2><span class="klein">' + m.assessments.length + ' assessments · elk is één moment in het rooster</span></div>' +
      '<label class="rij klein">Zoeken <input id="zoek" type="search" placeholder="ID, module, klas of docent"></label></div>' +
      '<div class="tabelkader"><table class="lijst"><thead><tr><th>ID</th><th>Module</th><th>Klas/groep</th><th>Docent(en)</th><th>Uren</th><th>Locatie (van klas)</th><th>Status</th><th class="rechts"></th></tr></thead><tbody id="ass-rijen">' +
      (rijen || '<tr><td colspan="8" class="klein">Nog geen assessments.</td></tr>') + '</tbody></table></div></section>';
  }

  /* ================= BESCHIKBAARHEID ================= */
  function renderBeschikbaarheid() {
    const soort = ui.soort, lijst = soort === 'docent' ? m.docenten.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })) : m.klassen.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })); /* docenten en klassen op naam */
    const r = analyse(), bezet = bezetUren(soort);
    const graad = {}; r.bezetting.filter(b => b.soort === soort).forEach(b => { graad[b.naam] = b; });
    let vorigeDag = null;
    const kop = m.tijdvakken.map(t => { const d = dagVan(t), cls = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d; const iedereen = lijst.length && lijst.every(r => r.beschikbaar.includes(t.id)); return '<th' + cls + '><button class="kolomknop" data-kolom="' + t.id + '" data-aan="' + (iedereen ? 0 : 1) + '" title="' + esc(t.label + ' · ' + R.fmt(t.uren) + ' uur — klik: ' + (iedereen ? 'niemand' : 'iedereen') + ' beschikbaar') + '">' + esc(t.label) + '</button></th>'; }).join('');
    const rijen = lijst.map(res => {
      vorigeDag = null;
      const cellen = m.tijdvakken.map(t => {
        const d = dagVan(t), cls = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d;
        const aan = res.beschikbaar.includes(t.id), door = bezet[res.naam] && bezet[res.naam][t.id];
        const vol = door && door.uren >= t.uren;
        return '<td' + cls + '><button class="vak' + (door ? (vol ? ' bezet' : ' deels') : '') + '" data-vak="' + t.id + '" data-naam="' + esc(res.naam) + '" aria-pressed="' + aan + '" aria-label="' + esc(res.naam + ' ' + t.label + (aan ? ' beschikbaar' : ' niet beschikbaar') + (door ? ', ' + R.fmt(door.uren) + ' uur gepland: ' + door.ids.join(', ') : '')) + '" title="' + (door ? esc(R.fmt(door.uren) + ' van ' + R.fmt(t.uren) + ' uur gepland: ' + door.ids.join(', ')) : '') + '">' + (door ? R.fmt(door.uren) + 'u' : '✓') + '</button></td>';
      }).join('');
      const b = graad[res.naam], gekoppeld = m.assessments.filter(a => soort === 'docent' ? a.docenten.includes(res.naam) : a.klas === res.naam), aantal = gekoppeld.length;
      const zoek = [res.naam].concat(gekoppeld.map(a => a.id + ' ' + a.module + ' ' + (soort === 'docent' ? a.klas : a.docenten.join(' ')))).join(' | ').toLowerCase();
      return '<tr data-zoek="' + esc(zoek) + '" data-res="' + esc(res.naam.toLowerCase()) + '"><td class="naam"><label class="verborgen" for="rn-' + esc(res.naam) + '">Naam</label><input id="rn-' + esc(res.naam) + '" data-hernoem="' + esc(res.naam) + '" value="' + esc(res.naam) + '"></td>' + cellen +
        '<td class="klein" style="white-space:nowrap;padding:0 8px">' + (b ? R.fmt(b.beschikbaar) + ' u vrij · ' + aantal + ' ass. · ' + R.fmtGraad(b.graad) : '') + '</td>' +
        '<td style="white-space:nowrap"><button class="knop klein-k" data-rij="' + esc(res.naam) + '" data-aan="1" title="Alles beschikbaar">alles</button> <button class="knop klein-k" data-rij="' + esc(res.naam) + '" data-aan="0" title="Niets beschikbaar">niets</button> ' +
        '<button class="knop klein-k gevaar" data-weg-res="' + esc(res.naam) + '" aria-label="' + esc(res.naam) + ' verwijderen"' + (aantal ? ' disabled title="Nog gekoppeld aan ' + aantal + ' assessment(s)"' : '') + '>✕</button></td></tr>';
    }).join('');
    const wie = soort === 'docent' ? 'docenten' : 'klassen/groepen';
    inhoud.innerHTML =
      '<section class="kolom smal"><div class="paneel"><h2>Beschikbaarheid plakken</h2>' +
      '<div class="segment" role="group" aria-label="Soort"><button data-soort="docent" aria-pressed="' + (soort === 'docent') + '">Docenten</button><button data-soort="klas" aria-pressed="' + (soort === 'klas') + '">Klassen/groepen</button></div>' +
      '<p class="uitleg">Eén regel per naam: <span class="mono" style="font-size:12px">naam ⇥ x ⇥ ⇥ x …</span> in de volgorde van de tijdvakken. Een gevulde cel (x, 1, ja) betekent beschikbaar. Een kopregel met de tijdvaknamen wordt herkend.</p>' +
      '<label class="veld">Regels voor ' + wie + '<textarea id="plak-b" rows="8" class="mono"></textarea></label>' +
      '<div class="rij"><button class="knop primair" id="plak-b-knop">Toevoegen of bijwerken</button></div></div>' +
      '<div class="paneel"><p class="klein">Nieuwe docenten en klassen zijn standaard <b>volledig beschikbaar</b>; zet uit wat niet kan. Snel aanpassen: klik een <b>tijdvak bovenaan</b> om dat tijdvak voor iedereen aan of uit te zetten, gebruik <b>alles / niets</b> per regel, of de knoppen bovenaan voor de hele lijst.</p><p class="klein">Klik een vakje om beschikbaarheid aan of uit te zetten. Een getal in een vakje (bijv. 2u) is het aantal uren dat daar al gepland is; gearceerd = helemaal vol. Wijs met de muis voor de assessments. Tijdvakken pas je aan op het tabblad Tijdvakken.</p></div></section>' +
      '<section class="paneel breed"><div class="rij tussen"><div><h2>Beschikbaarheid ' + wie + '</h2><span class="klein">' + lijst.length + ' ' + wie + '</span></div>' +
      '<div class="rij"><label class="rij klein">Filter <input id="besch-zoek" type="search" value="' + esc(ui.beschZoek[soort]) + '" placeholder="' + (soort === 'docent' ? 'naam, klas, module of ID' : 'naam, docent, module of ID') + '" style="width:220px" title="Meerdere tegelijk: scheid met een komma, bijv. Visser, Bakker"></label><button class="knop" data-alles="1">Iedereen alles beschikbaar</button><button class="knop" data-alles="0">Iedereen niets</button><label class="verborgen" for="nieuwe-res">Nieuwe naam</label><input id="nieuwe-res" placeholder="Nieuwe ' + (soort === 'docent' ? 'docent' : 'klas/groep') + '"><button class="knop" id="voeg-res">Toevoegen</button></div></div>' +
      '<div class="tabelkader" style="max-height:calc(100vh - 280px);overflow:auto"><table class="rooster"><thead><tr><th class="naam">' + (soort === 'docent' ? 'Docent' : 'Klas/groep') + '</th>' + kop + '<th>Vrij · bezetting</th><th></th></tr></thead><tbody id="besch-rijen">' +
      (rijen || '<tr><td class="naam klein" colspan="' + (m.tijdvakken.length + 3) + '">Nog geen ' + wie + '. Ze verschijnen automatisch zodra je assessments toevoegt, of plak ze hiernaast.</td></tr>') + '</tbody>' +
      (lijst.length ? '<tfoot><tr class="samen-beschikbaar"><th class="naam" id="samen-label">Samen vrij</th>' + m.tijdvakken.map(t => '<th data-samen="' + t.id + '"></th>').join('') + '<th colspan="2" class="klein" style="text-align:left;font-weight:400" id="samen-uitleg"></th></tr></tfoot>' : '') +
      '</table></div></section>';
    beschFilter();
  }
  /* Filter op naam, of op wat aan een docent/klas gekoppeld is (klas, docent, module, ID). Meerdere termen met komma's:
     een regel blijft staan als één van de termen past. De onderste rij telt per tijdvak hoeveel van de zichtbare
     regels vrij zijn (beschikbaar en niet helemaal vol gepland); groen = allemaal. */
  function beschFilter() {
    const q = (ui.beschZoek[ui.soort] || '').toLowerCase().split(/[,;]/).map(x => x.trim()).filter(Boolean);
    const rijen = [...document.querySelectorAll('#besch-rijen tr[data-zoek]')];
    let zicht = 0;
    rijen.forEach(tr => { const toon = !q.length || q.some(x => tr.dataset.zoek.includes(x)); tr.style.display = toon ? '' : 'none'; if (toon) zicht++; });
    const zichtbaar = rijen.filter(tr => tr.style.display !== 'none');
    document.querySelectorAll('[data-samen]').forEach(th => {
      const tid = th.dataset.samen, n = zichtbaar.filter(tr => { const b = tr.querySelector('[data-vak="' + tid + '"]'); return b && b.getAttribute('aria-pressed') === 'true' && !b.classList.contains('bezet'); }).length;
      th.textContent = zichtbaar.length ? (n === zichtbaar.length ? '✓' : n + '/' + zichtbaar.length) : '';
      th.className = !zichtbaar.length ? '' : n === zichtbaar.length ? 'allemaal' : n === 0 ? 'niemand' : 'sommigen';
      th.title = n + ' van ' + zichtbaar.length + ' zichtbare regels vrij in ' + tv(th.dataset.samen).label;
    });
    const lab = $('#samen-label'), uit = $('#samen-uitleg');
    if (lab) lab.textContent = 'Samen vrij (' + zicht + (q.length ? ' gefilterd' : '') + ')';
    if (uit) uit.textContent = q.length ? '✓ = alle gefilterde regels vrij' : 'Filter om overlap te zien';
  }

  /* ================= TIJDVAKKEN ================= */
  function renderTijdvakken() {
    const rijen = m.tijdvakken.map((t, i) => '<tr><td class="num klein">' + (i + 1) + '</td>' +
      '<td><label class="verborgen" for="tl-' + t.id + '">Naam</label><input id="tl-' + t.id + '" data-tv="' + t.id + '" data-veld="label" value="' + esc(t.label) + '"></td>' +
      '<td style="width:100px"><label class="verborgen" for="tu-' + t.id + '">Uren</label><input id="tu-' + t.id + '" data-tv="' + t.id + '" data-veld="uren" value="' + esc(String(t.uren).replace('.', ',')) + '"></td>' +
      '<td class="rechts"><button class="knop klein-k" data-tvop="' + t.id + '" aria-label="Omhoog">↑</button> <button class="knop klein-k" data-tvneer="' + t.id + '" aria-label="Omlaag">↓</button> <button class="knop klein-k gevaar" data-tvweg="' + t.id + '" aria-label="Verwijderen">✕</button></td></tr>').join('');
    const totaal = m.tijdvakken.reduce((s, t) => s + t.uren, 0);
    inhoud.innerHTML =
      '<section class="kolom smal"><div class="paneel"><h2>Tijdvakken</h2><p class="uitleg">De week is verdeeld in tijdvakken. Standaard zijn dat tien dagdelen van 6 lesuren, met vrijdagmiddag 5 lesuren: samen 59 lesuren per week (ma-o = maandagochtend). Je kunt ze hernoemen, het aantal uren aanpassen, of fijner verdelen, bijvoorbeeld in lesblokken.</p>' +
      '<p class="klein">Tip: begin een naam met de dag (bijvoorbeeld "di 3-4") zodat het beschikbaarheidsrooster per dag een scheidingslijn toont.</p>' +
      '<p class="klein">Een tijdvak verwijderen haalt het ook uit de beschikbaarheid en de planning.</p><button class="knop" id="tv-standaard">Standaarduren toepassen (6 per dagdeel, vr-m 5)</button><p class="klein">Handig voor een planning die nog met andere uren is gemaakt: beschikbaarheid en planning blijven staan.</p></div>' +
      '<div class="paneel"><h3>Tijdvak toevoegen</h3><div class="raster2"><label class="veld">Naam<input id="tv-naam" placeholder="bijv. za-o"></label><label class="veld">Uren<input id="tv-uren" value="6"></label></div><button class="knop primair" id="tv-voeg">Toevoegen</button></div></section>' +
      '<section class="paneel breed"><div class="rij tussen"><h2>Tijdvakken in volgorde</h2><span class="klein">' + m.tijdvakken.length + ' tijdvakken · ' + R.fmt(totaal) + ' uur per week</span></div>' +
      '<div class="tabelkader"><table class="lijst"><thead><tr><th class="num">#</th><th>Naam</th><th>Uren</th><th class="rechts"></th></tr></thead><tbody>' + rijen + '</tbody></table></div></section>';
  }

  /* ================= PLANNINGSVOLGORDE ================= */
  function meldingenPaneel(r) {
    if (!r.fouten.length && !r.waarschuwingen.length) return '';
    return (r.fouten.length ? '<div class="melding fout" style="margin:0"><div><strong>' + r.fouten.length + ' fout(en) in de invoer</strong>' + lijstMeldingen(r.fouten) + '</div></div>' : '') +
      (r.waarschuwingen.length ? '<div class="balk-let"><strong>Let op</strong>' + lijstMeldingen(r.waarschuwingen) + '</div>' : '');
  }
  function krapCel(it) {
    if (it.prio === Infinity) return '<span class="pastniet">geen ruimte</span>';
    const w = Math.max(2, Math.min(80, Math.round(it.prio * 80)));
    return '<span class="krapbalk" style="width:' + w + 'px"></span>' + R.fmtKrapte(it.prio);
  }
  /* Overzicht per lesuur bij het inplannen: per docent, de klas en de lokalen op de locatie wat beschikbaar (wit),
     niet beschikbaar (grijs) en al gepland (geel) is, plus waar docent(en) en klas samen vrij zijn.
     Binnen een dagdeel liggen de lesuren van geplande assessments niet vast; ze staan vooraan getekend. */
  /* Wie houdt een dagdeel tegen? Per docent en klas: niet beschikbaar, of te weinig uren over door wat al gepland is. */
  function blokkades(r, it, t, nodig) {
    const uit = [];
    const kijk = (soort, naam) => {
      const res = M.vindRes(m, soort, naam), wat = soort === 'docent' ? 'docent ' : 'klas ';
      const gepl = r.gepland.filter(g => soort === 'docent' ? g.docenten.includes(naam) : g.klas === naam).map(g => ({ id: g.id, uren: g.segmenten.filter(s => s.tv === t.id).reduce((x, s) => x + s.uren, 0) })).filter(x => x.uren > 0);
      const gebruikt = gepl.reduce((x, g) => x + g.uren, 0);
      if (!res || !res.beschikbaar.includes(t.id)) uit.push({ naam, soort, kort: naam + ' niet beschikbaar', actie: 'maak ' + wat + naam + ' beschikbaar' });
      else if (t.uren - gebruikt < nodig) uit.push({ naam, soort, kort: naam + ' vol (' + gepl.map(g => g.id).join(', ') + ')', actie: 'verplaats ' + gepl.map(g => g.id).join(', ') + ' van ' + wat + naam });
    };
    it.docenten.forEach(d => kijk('docent', d)); kijk('klas', it.klas);
    return uit;
  }
  /* Suggesties als een assessment niet past: dagdelen (of dagen, bij doorlopen) waar één aanpassing genoeg is. */
  function suggesties(r, it) {
    const TV = m.tijdvakken, uit = [];
    const twee = [];
    TV.forEach(t => { if (it.uren > t.uren) return; const b = blokkades(r, it, t, it.uren); if (b.length === 1) uit.push('<b>' + esc(t.label) + '</b>: alleen ' + esc(b[0].kort) + ' → ' + esc(b[0].actie)); else if (b.length === 2) twee.push('<b>' + esc(t.label) + '</b>: ' + esc(b.map(x => x.kort).join(' en '))); });
    uit.push.apply(uit, twee);
    if (!uit.length) {
      const dagen = {}; TV.forEach(t => { (dagen[dagVan(t)] = dagen[dagVan(t)] || []).push(t); });
      Object.keys(dagen).forEach(d => { const ts = dagen[d]; if (ts.reduce((x, t) => x + t.uren, 0) < it.uren) return; const b = []; ts.forEach(t => blokkades(r, it, t, t.uren).forEach(x => { if (!b.some(y => y.kort === x.kort)) b.push(x); })); if (b.length && b.length <= 2) uit.push('<b>' + esc(d) + '</b> (hele dag, doorlopend): ' + esc(b.map(x => x.kort).join(' en '))); });
    }
    return uit;
  }
  function planRaster(r, it) {
    const TV = m.tijdvakken, loc = it.locatie, o = it.opties[ui.optie || 0];
    const dagen = []; TV.forEach(t => { const d = dagVan(t); if (!dagen.length || dagen[dagen.length - 1].dag !== d) dagen.push({ dag: d, n: 0 }); dagen[dagen.length - 1].n += t.uren; });
    const grens = (i) => i === 0 ? ' dd-grens' : '';
    const blok = (x, cls, tekst, titel) => '<td colspan="' + x + '" class="' + cls + '"' + (titel ? ' title="' + esc(titel) + '"' : '') + '><div class="rblok">' + tekst + '</div></td>';
    /* één rij: per tijdvak een lijst geplande blokken; rest wit als beschikbaar, anders grijs */
    const rij = (label, sub, perTv) => '<tr><th class="rnaam">' + label + (sub ? ' <span class="klein">' + sub + '</span>' : '') + '</th>' + TV.map(t => {
      const x = perTv(t); let h = '', gebruikt = 0;
      x.blokken.forEach((b, k) => { const u = Math.max(1, Math.min(t.uren - gebruikt, Math.round(b.uren))); if (u <= 0) return; h += blok(u, 'gepl' + (b.extra ? ' extra' : '') + (k === 0 ? grens(0) : ''), b.id, b.id + ' ' + R.fmt(b.uren) + 'u · ' + b.titel); gebruikt += u; });
      for (let u = gebruikt; u < t.uren; u++) h += '<td class="' + (x.vrij ? (x.anders ? 'vrij anderloc' : 'vrij') : 'grijs') + (u === 0 ? ' dd-grens' : '') + '"' + (x.vrij && x.anders ? ' title="' + esc(t.label + ': op ' + dagVan(t) + ' al ingepland in ' + x.anders) + '"' : '') + '></td>';
      return h;
    }).join('') + '</tr>';
    const geplandIn = (filter, t) => { const b = []; r.gepland.forEach(g => { if (!filter(g)) return; g.segmenten.forEach(s => { if (s.tv === t.id) b.push({ id: g.id, uren: s.uren, titel: g.module + ' · ' + g.klas + ' · ' + g.docenten.join('; '), extra: s.extra }); }); }); return b; };
    const kopDag = '<tr><th class="rnaam"></th>' + dagen.map(d => '<th colspan="' + d.n + '" class="rdag dd-grens">' + esc(d.dag) + '</th>').join('') + '</tr>';
    const kopTv = '<tr><th class="rnaam klein">dagdeel · lesuur</th>' + TV.map(t => { let h = ''; for (let u = 0; u < t.uren; u++) h += '<th class="ruur' + (u === 0 ? ' dd-grens' : '') + '"' + (u === 0 ? ' title="' + esc(t.label) + '"' : '') + '>' + (u === 0 ? esc(t.label.split(/[-\s]/)[1] || t.label) : u + 1) + '</th>'; return h; }).join('') + '</tr>';
    let h = '<table class="raster"><thead>' + kopDag + kopTv + '</thead><tbody>';
    /* per docent en dag: op welke andere locatie(s) hij al is ingepland */
    const anderLoc = (d, t) => { const dg = dagVan(t), l = new Set(); r.gepland.forEach(g => { if (g.docenten.includes(d) && g.locatie && g.locatie !== loc && g.segmenten.some(s => dagVan(tv(s.tv)) === dg)) l.add(g.locatie + ' (' + g.id + ')'); }); return [...l].join(', '); };
    it.docenten.forEach(d => { const res = M.vindRes(m, 'docent', d); h += rij('Docent <b>' + esc(d) + '</b>', '', t => ({ vrij: !!res && res.beschikbaar.includes(t.id), anders: anderLoc(d, t), blokken: geplandIn(g => g.docenten.includes(d), t) })); });
    const kl = M.vindRes(m, 'klas', it.klas);
    h += rij('Klas <b>' + esc(it.klas) + '</b>', '', t => ({ vrij: !!kl && kl.beschikbaar.includes(t.id), blokken: geplandIn(g => g.klas === it.klas, t) }));
    /* samen vrij + gekozen optie */
    h += '<tr class="samenrij"><th class="rnaam">Samen vrij</th>' + TV.map(t => {
      const c = it.capPerTv[t.id], wissel = c < 0, vrij = Math.abs(c), seg = o && o.segmenten.find(s => s.tv === t.id), kies = it.opties.findIndex(x => x.segmenten.some(s => s.tv === t.id));
      const cls = (seg ? 'gekozen' : vrij > 0 ? (wissel ? 'samen-wissel' : kies < 0 ? 'samen-deels' : it.klasDagTv[t.id] ? 'samen-dag' : 'samen') : 'grijs') + ' dd-grens' + (kies >= 0 ? ' kiesbaar' : '');
      const blok = vrij > 0 ? [] : blokkades(r, it, t, 1);
      const tekst = seg ? '<b>' + it.id + '</b> ' + R.fmt(seg.uren) + 'u' + (seg.extra ? ' · +lokaal' : '') : vrij > 0 ? R.fmt(vrij) + 'u' + (wissel ? ' ⚠' : '') : '<span class="blokker">' + esc(blok.map(b => b.naam).join(', ')) + '</span>';
      return '<td colspan="' + t.uren + '" class="' + cls + '"' + (kies >= 0 ? ' data-kies="' + kies + '"' : '') + ' title="' + esc(t.label + ': ' + (vrij > 0 ? R.fmt(vrij) + ' uur samen vrij' + (kies < 0 && vrij < it.uren ? ' (te weinig voor ' + R.fmt(it.uren) + ' uur)' : '') + (wissel ? ', maar een docent is die dag op een andere locatie' : '') + (it.klasDagTv[t.id] ? ', maar ' + it.klas + ' heeft die dag al een assessment' : '') : 'niet samen vrij: ' + blok.map(b => b.kort).join('; ')) + (kies >= 0 ? ' · klik om hier in te plannen' : '')) + '"><div class="rblok">' + tekst + '</div></td>';
    }).join('') + '</tr>';
    /* lokalen op de locatie */
    if (loc) {
      const rooster = r.lokaalRooster[loc] || {};
      const max = Math.max.apply(null, TV.map(t => Math.max(M.lokalenIn(m, loc, t.id), Math.max.apply(null, Object.keys(rooster[t.id] || {}).map(Number).concat([0])))).concat([0]));
      for (let i = 1; i <= max; i++) {
        h += rij('Lokaal ' + i, i === 1 ? esc(loc) : '', t => {
          const n = M.lokalenIn(m, loc, t.id), lijst = (rooster[t.id] || {})[i] || [];
          return { vrij: i <= n, blokken: lijst.map(x => ({ id: x.id, uren: x.uren, titel: x.module + ' · ' + x.klas, extra: i > n })) };
        }).replace('<tr>', '<tr class="lokaalrij' + (i === 1 ? ' eerste' : '') + '">');
      }
    }
    return '<div class="rasterkader">' + h + '</tbody></table></div><div class="legenda klein"><span><span class="chip" style="background:#FFFFFF;border:1px solid #9DBCE6"></span>beschikbaar</span><span><span class="chip" style="background:#DEDEDE"></span>niet beschikbaar / geen lokaal</span><span><span class="chip" style="background:#FFF59A;border:1px solid #1F2328"></span>al gepland (binnen het dagdeel vooraan getekend)</span><span><span class="chip" style="background:#E24B4A"></span>docent die dag al op een andere locatie</span><span><span class="chip" style="background:#C0DD97"></span>docent(en) en klas samen vrij</span><span><span class="chip" style="background:#FAC775"></span>samen vrij, maar met locatiewissel</span><span><span class="chip" style="background:#CECBF6"></span>samen vrij, maar de klas heeft die dag al een assessment</span><span><span class="chip" style="background:#378ADD"></span>gekozen optie</span><span><span class="chip" style="background:#F7C1C1"></span>extra lokaal nodig</span></div>';
  }
  function renderVolgorde() {
    if (!m.assessments.length) { inhoud.innerHTML = '<section class="paneel breed leeg-staat">Voeg eerst assessments toe op het tabblad <b>Assessments</b>.</section>'; return; }
    const r = analyse();
    let h = '', vorig = null, eilandTeller = {};
    r.volgorde.forEach(it => { eilandTeller[it.eiland] = (eilandTeller[it.eiland] || 0) + 1; });
    r.volgorde.forEach(it => {
      if (it.eiland !== vorig) {
        h += '<tr class="eilandkop' + (vorig !== null ? ' eilandgrens' : '') + '"><td colspan="12">' + (it.eiland === 'los' ? 'Los / vulling — geen sterke koppelingen; plan in de overgebleven ruimte' : 'Planningseiland ' + it.eiland + ' — ' + eilandTeller[it.eiland] + ' assessments die via drukke docenten of klassen samenhangen') + '</td></tr>';
        vorig = it.eiland;
      }
      h += '<tr><td class="num">' + it.volgnummer + '</td><td class="mono"><b>' + it.id + '</b></td><td>' + esc(it.module) + '</td><td>' + esc(it.klas) + '</td><td class="klein">' + esc(it.locatie || '—') + '</td><td>' + esc(it.docenten.join('; ')) + '</td>' +
        '<td class="num">' + R.fmt(it.uren) + '</td><td class="num' + (it.past ? '' : ' pastniet') + '">' + R.fmt(it.overlap) + '</td><td style="white-space:nowrap">' + krapCel(it) + '</td>' +
        '<td class="klein">' + esc(it.knelpunt) + '</td><td class="klein">' + (it.volgtUit ? '<span class="mono">' + it.volgtUit.id + '</span> via ' + esc(it.volgtUit.via.naam) : '—') + '</td>' +
        '<td class="rechts">' + (it.alleenMetExtraLokaal ? '<span class="waarsch" title="Past alleen met een extra lokaal">+lokaal</span> ' : '') + (it.alleenMetWissel ? '<span class="waarsch" title="Past alleen met een locatiewissel van een docent">⚠</span> ' : '') + '<button class="knop klein-k" data-inplan="' + it.id + '"' + (it.past ? '' : ' title="Past nu niet. Klik om het rooster te zien en te bekijken waar je de beschikbaarheid kunt vergroten."') + '>' + (it.past ? 'Inplannen' : 'Bekijken') + '</button></td></tr>';
      if (ui.inplannen === it.id && !it.past) {
        const sg = suggesties(r, it);
        h += '<tr class="inplanrij"><td></td><td colspan="11"><div class="kolom" style="gap:8px;padding:6px 0">' +
          '<div class="melding fout" style="margin:0"><div><strong>' + it.id + ' (' + R.fmt(it.uren) + ' uur) past nu niet.</strong> Docent(en) en klas zijn nergens ' + R.fmt(it.uren) + ' uur samen vrij' + (it.uren > Math.max.apply(null, m.tijdvakken.map(t => t.uren)) ? ' (in één dagdeel of doorlopend op één dag)' : ' in één dagdeel') + '. In de rij <b>Samen vrij</b> staat per dagdeel wie het tegenhoudt; wijs een vak aan voor de details.' +
          (sg.length ? '<br>Hier is weinig voor nodig:<ul>' + sg.slice(0, 8).map(x => '<li>' + x + '</li>').join('') + '</ul>' : '<br>Er is geen dagdeel waar één of twee aanpassingen genoeg zijn; kijk welke beschikbaarheid het makkelijkst te vergroten is, of verdeel het assessment.') +
          ' Pas de beschikbaarheid aan op het tabblad <b>Beschikbaarheid</b>, of zet een gepland assessment terug.</div></div>' +
          planRaster(r, it) + '<div class="rij"><button class="knop" data-annuleer>Sluiten</button></div></div></td></tr>';
      } else if (ui.inplannen === it.id) {
        h += '<tr class="inplanrij"><td></td><td colspan="11"><div class="kolom" style="gap:8px;padding:6px 0">' +
          '<span class="klein">Kies waar <b>' + it.id + '</b> (' + R.fmt(it.uren) + ' uur, ' + esc(it.locatie) + ') wordt ingepast: klik in de rij <b>Samen vrij</b> of kies een optie. Beste opties bovenaan: zonder locatiewissel, niet op een dag waarop de klas al een assessment heeft (paars), met een vrij lokaal, in één dagdeel. Doorlopend = eind ochtend + begin middag. Geen lokaal vrij is geen beletsel: je krijgt dan de melding dat je daar een lokaal extra nodig hebt.</span>' + planRaster(r, it) + '<div class="opties">' +
          it.opties.map((o, k) => '<label class="optie' + (o.waarschuwing || o.extraLokaal ? ' let' : o.zelfdeDag ? ' zelfdedag' : '') + '"><input type="radio" name="optie" data-optie="' + k + '"' + (ui.optie === k ? ' checked' : '') + '><span>' + esc(segTekst(o.segmenten)) + (o.span ? ' <span class="label-info" style="padding:1px 6px">doorlopend</span>' : '') + (o.waarschuwing ? '<br><span class="waarsch">⚠ ' + esc(o.waarschuwing) + '</span>' : '') + (o.zelfdeDag ? '<br><span class="zelfdedag-tekst">' + esc(o.zelfdeDag) + ' (liever niet twee op één dag)</span>' : '') + (o.extraLokaal ? '<br><span class="waarsch">Geen lokaal vrij op ' + esc(it.locatie) + ': hier is een lokaal extra nodig.</span>' : '') + '</span></label>').join('') + '</div>' +
          '<div class="rij"><button class="knop primair" data-bevestig="' + it.id + '">Inplannen bevestigen</button><button class="knop" data-annuleer>Annuleren</button></div></div></td></tr>';
      }
    });
    const gepland = r.gepland.map((g, i) => '<tr' + (i === 0 ? ' class="laatst"' : '') + '><td class="num klein">' + (r.gepland.length - i) + '</td><td class="mono"><b>' + g.id + '</b></td><td>' + esc(g.module) + '</td><td>' + esc(g.klas) + '</td><td>' + esc(g.locatie) + '</td><td>' + esc(g.docenten.join('; ')) + '</td><td class="num">' + R.fmt(g.uren) + '</td><td>' + esc(segTekst(g.segmenten)) + '</td><td class="rechts"><button class="knop klein-k" data-ontplan="' + g.id + '">Terugzetten</button></td></tr>').join('');
    inhoud.innerHTML =
      '<section class="kolom breed">' + meldingenPaneel(r) +
      '<div class="rij tussen"><div class="rij"><span class="maat">Nog te plannen <b>' + r.volgorde.length + '</b></span><span class="maat">Planningseilanden <b>' + r.eilanden + '</b></span><span class="maat">Los / vulling <b>' + r.los + '</b></span><span class="maat">Gepland <b>' + r.gepland.length + '</b></span></div>' +
      '<label class="rij klein">Drempel voor een sterke koppeling <input id="drempel" type="number" min="0" max="100" step="5" value="' + Math.round(m.instellingen.drempel * 100) + '" style="width:80px"> %</label></div>' +
      '<div class="paneel"><h2>Planningsvolgorde</h2><p class="klein">Plan van boven naar beneden. Krapte/prioriteit: hoe hoger, hoe minder speelruimte. "Volgt uit" noemt het eerdere assessment en de gedeelde docent of klas waardoor dit assessment erna komt. Lokalen tellen niet mee in de volgorde en zijn geen beletsel bij het inplannen (die kun je bijvragen); +lokaal = past alleen met een extra lokaal. ⚠ = past alleen als een docent die dag op twee locaties is. Na inplannen rekent de lijst opnieuw met de ruimte die overblijft.</p>' +
      '<div class="tabelkader"><table class="lijst"><thead><tr><th class="num">#</th><th>ID</th><th>Module</th><th>Klas/groep</th><th>Locatie</th><th>Docent(en)</th><th class="num">Uren</th><th class="num">Samen vrij (u)</th><th>Prioriteit</th><th>Knelpunt</th><th>Volgt uit</th><th class="rechts"></th></tr></thead><tbody>' +
      (h || '<tr><td colspan="12" class="klein">Alles is ingepland.</td></tr>') + '</tbody></table></div></div>' +
      (r.gepland.length ? '<div class="paneel"><h2>Al gepland</h2><p class="klein">Laatst ingepland bovenaan; # = volgorde waarin je ze hebt ingepland. Een verkeerde keuze zet je zo snel terug.</p><div class="tabelkader"><table class="lijst"><thead><tr><th class="num">#</th><th>ID</th><th>Module</th><th>Klas/groep</th><th>Locatie</th><th>Docent(en)</th><th class="num">Uren</th><th>Ingepast in</th><th class="rechts"></th></tr></thead><tbody>' + gepland + '</tbody></table></div></div>' : '') +
      '</section>';
  }

  /* ================= AFHANKELIJKHEDEN ================= */
  function gewichtKlasse(w, drempel) { return w === Infinity || w >= 0.5 ? 'w3' : w >= 0.3 ? 'w2' : w > drempel ? 'w1' : 'w0'; }
  /* Letters voor wat gedeeld wordt boven de drempel: D docent, K klas, L locatie (lokalen). */
  function letter(k, drempel) { const s = k.gedeeld.filter(g => g.graad > drempel).map(g => g.soort); return (s.includes('docent') ? 'D' : '') + (s.includes('klas') ? 'K' : '') + (s.includes('locatie') ? 'L' : ''); }
  const resNaam = g => (g.soort === 'docent' ? 'docent ' : g.soort === 'klas' ? 'klas ' : 'locatie ') + g.naam;
  function matrixHtml(r, klikbaar, alle) {
    const o = r.volgorde, geplandId = {}; if (alle) m.assessments.forEach(a => { if (a.gepland.length) geplandId[a.id] = a.gepland.map(s => tv(s.tv).label).join('+'); });
    let h = '<table class="dsm met-blok"><thead><tr><th class="blokkop">Eiland</th><th class="hoek">assessment</th>' + o.map(x => '<th scope="col" title="' + esc(x.id + ' ' + x.module + ' · ' + x.klas) + '">' + x.id + '</th>').join('') + '</tr></thead><tbody>';
    let vorig = null;
    o.forEach((x, i) => {
      const grens = vorig !== null && x.eiland !== vorig; vorig = x.eiland;
      h += '<tr' + (grens ? ' class="eilandgrens"' : '') + '><th class="blokcel">' + (x.eiland === 'los' ? 'los' : x.eiland) + '</th><th scope="row" class="naamcel" title="' + esc(x.module + ' · ' + x.klas + ' · ' + x.docenten.join('; ')) + '"><span class="id">' + x.id + '</span>' + (geplandId[x.id] ? '<span class="gepland-merk" title="Ingepland: ' + esc(geplandId[x.id]) + '">✓ ' + esc(geplandId[x.id]) + '</span> ' : '') + esc(x.module) + ' · <b>' + esc(x.klas) + '</b> <span class="docentnamen">· ' + esc(x.docenten.join('; ')) + '</span></th>';
      o.forEach((y, j) => {
        if (i === j) { h += '<td class="diag"></td>'; return; }
        const k = r.kop(x.id, y.id);
        if (!k) { h += '<td' + (klikbaar ? ' data-i="' + i + '" data-j="' + j + '"' : '') + '></td>'; return; }
        const cls = gewichtKlasse(k.gewicht, r.drempel), lt = letter(k, r.drempel);
        const zwakAlleenLocatie = cls === 'w0' && k.gedeeld.every(g => g.soort === 'locatie');
        h += '<td class="' + cls + '" data-k="1"' + (klikbaar ? ' data-i="' + i + '" data-j="' + j + '"' : '') + ' title="' + esc(k.gedeeld.map(g => resNaam(g) + ' ' + R.fmtGraad(g.graad)).join(', ')) + '">' + (cls === 'w0' ? (zwakAlleenLocatie ? '' : '·') : (lt.length > 1 ? '<span class="dubbel">' + lt + '</span>' : lt)) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }
  function legendaMatrix(r) {
    return '<div class="legenda"><span><span class="chip" style="background:#EF9F27"></span>Gedeelde docent/klas ≥ 50% bezet</span><span><span class="chip" style="background:#FAC775"></span>30–50%</span><span><span class="chip" style="background:#FAEEDA"></span>' + Math.round(r.drempel * 100) + '–30%</span><span>· zwak (telt niet voor eilanden)</span><span>D = via docent · K = via klas · DK = beide</span><span>Dikke lijn = grens planningseiland</span></div>';
  }
  function renderMatrix() {
    if (!m.assessments.length) { inhoud.innerHTML = '<section class="paneel breed leeg-staat">Voeg eerst assessments toe.</section>'; return; }
    const r = matrixAnalyse(), alle = ui.matrixModus === 'alle';
    inhoud.innerHTML = '<section class="paneel" style="flex:1 1 100%"><div class="rij tussen"><h2>Afhankelijkheden tussen ' + (alle ? 'alle assessments (vanaf het begin)' : 'nog te plannen assessments') + '</h2>' +
      '<div class="segment" role="group" aria-label="Welke assessments"><button data-mmodus="open" aria-pressed="' + !alle + '">Nog te plannen</button><button data-mmodus="alle" aria-pressed="' + alle + '">Alle, vanaf het begin</button></div></div>' +
      (alle ? '<p class="klein"><b>Vanaf het begin</b>: alle assessments, gerekend alsof er nog niets gepland is. ✓ = al ingepland (met dagdeel).</p>' : '<p class="klein"><b>Nog te plannen</b>: alleen wat nog open staat, met de ruimte die na de planning over is.</p>') +
      '<p class="klein">Rijen en kolommen staan in planningsvolgorde. Een gevulde cel betekent: deze twee assessments delen een docent (D) of klas (K) en beperken dus elkaars ruimte. De kleur toont hoe druk wat ze delen is. Lokalen tellen hier niet mee: die kun je bijvragen; zie het tabblad Lokalen.</p>' + legendaMatrix(r) +
      '<div id="mpaneel" class="koppelbalk"></div>' +
      '<div class="matrixkader" id="pm">' + (r.volgorde.length ? matrixHtml(r, true, alle) : '<p class="klein" style="padding:12px">Alles is ingepland. Kies <b>Alle, vanaf het begin</b> om de afhankelijkheden te zien.</p>') + '</div></section>';
    renderMatrixPaneel(r);
    matrixOplichten($('#pm table.dsm'));
  }
  /* Oplichten bij aanwijzen: kop → die rij of kolom; cel met afhankelijkheid → beide rijen; lege cel → kruis. */
  function matrixOplichten(tabel) {
    if (!tabel) return;
    let actief = [], vorige = null;
    const wis = () => { actief.forEach(e => e.classList.remove('hl', 'hl-kop', 'hl-cel')); actief = []; };
    const zet = (e, c) => { if (e) { e.classList.add(c); actief.push(e); } };
    const rijen = tabel.tBodies[0].rows, kop = tabel.tHead.rows[0];
    const rijAan = i => { const tr = rijen[i]; if (!tr) return; for (const c of tr.cells) zet(c, 'hl'); zet(tr.cells[1], 'hl-kop'); zet(kop.cells[i + 2], 'hl-kop'); };
    const kolAan = j => { for (const tr of rijen) zet(tr.cells[j + 2], 'hl'); zet(kop.cells[j + 2], 'hl-kop'); zet(rijen[j] && rijen[j].cells[1], 'hl-kop'); };
    tabel.addEventListener('mouseover', ev => {
      const cel = ev.target.closest('td, th');
      if (!cel || cel === vorige || !tabel.contains(cel)) return;
      vorige = cel; wis();
      const tr = cel.parentElement;
      if (tr.parentElement.tagName === 'THEAD') { const j = cel.cellIndex - 2; if (j >= 0) kolAan(j); return; }
      const i = tr.sectionRowIndex, j = cel.cellIndex - 2;
      if (cel.tagName === 'TH') { rijAan(i); return; }
      if (cel.dataset.k) { rijAan(i); rijAan(j); zet(cel, 'hl-cel'); zet(rijen[j].cells[i + 2], 'hl-cel'); return; }
      rijAan(i); kolAan(j);
    });
    tabel.addEventListener('mouseleave', () => { vorige = null; wis(); });
  }
  function renderMatrixPaneel(r) {
    const p = $('#mpaneel'); if (!p) return;
    if (!ui.matrixSel) { p.innerHTML = '<span class="klein">Klik een cel in de matrix om hier te zien wat twee assessments delen.</span>'; return; }
    const [x, y] = ui.matrixSel.map(id => r.volgorde.find(v => v.id === id));
    if (!x || !y) { ui.matrixSel = null; return renderMatrixPaneel(r); }
    const k = r.kop(x.id, y.id);
    p.innerHTML = '<span class="celkop">' + x.id + ' · ' + y.id + '</span>' +
      '<span><b>' + x.id + '</b> ' + esc(x.module + ' · ' + x.klas + ' · ' + x.docenten.join('; ')) + '</span>' +
      '<span><b>' + y.id + '</b> ' + esc(y.module + ' · ' + y.klas + ' · ' + y.docenten.join('; ')) + '</span>' +
      (k ? k.gedeeld.map(g => '<span>Gedeeld: ' + (g.soort === 'docent' ? 'docent ' : g.soort === 'klas' ? 'klas ' : 'lokalen in ') + '<b>' + esc(g.naam) + '</b> · bezetting ' + R.fmtGraad(g.graad) + '</span>').join('') +
        '<span>' + (k.gewicht > r.drempel ? 'Telt mee voor het eiland (boven ' + Math.round(r.drempel * 100) + '%)' : 'Zwakke koppeling: telt niet mee voor eilanden') + '</span>' : '<span>Niets gedeeld: deze twee beïnvloeden elkaar niet</span>');
  }

  /* ================= BEZETTING ================= */
  function bezettingTabel(r) {
    const rij = b => '<tr><td>' + (b.soort === 'docent' ? 'Docent' : b.soort === 'klas' ? 'Klas/groep' : 'Locatie (lokaaluren)') + '</td><td><b>' + esc(b.naam) + '</b></td><td class="num">' + b.aantal + '</td><td class="num">' + R.fmt(b.nodig) + '</td><td class="num">' + R.fmt(b.beschikbaar) + '</td>' +
      '<td style="white-space:nowrap">' + (b.graad === Infinity ? '<span class="pastniet">geen ruimte</span>' : '<span class="krapbalk" style="width:' + Math.max(2, Math.min(100, Math.round(b.graad * 100))) + 'px;background:' + (b.graad > 1 ? '#A32D2D' : '#BA7517') + '"></span>' + R.fmtGraad(b.graad)) + '</td></tr>';
    return '<div class="tabelkader"><table class="lijst"><thead><tr><th>Soort</th><th>Naam</th><th class="num">Assessments</th><th class="num">Nodig (u)</th><th class="num">Vrij (u)</th><th>Bezetting</th></tr></thead><tbody>' +
      (r.bezetting.map(rij).join('') || '<tr><td colspan="6" class="klein">Nog geen docenten of klassen.</td></tr>') + '</tbody></table></div>';
  }
  const BEZETTING_UITLEG = 'Nodig = uren van nog niet geplande assessments. Vrij = beschikbare uren min wat al gepland is; bij een locatie in lokaaluren (lokalen × lesuren). Hoe hoger de bezetting, hoe eerder de assessments van deze docent, klas of locatie aan de beurt zijn.';
  function renderBezetting() {
    const r = analyse();
    inhoud.innerHTML = '<section class="paneel breed"><h2>Bezetting na planning</h2><p class="klein">' + (r.gepland.length ? 'Na de ' + r.gepland.length + ' al ingeplande assessment(s). ' : '') + BEZETTING_UITLEG + '</p>' + bezettingTabel(r) + '</section>' +
      (r.gepland.length ? '<section class="paneel breed"><h2>Bezetting bij invoer</h2><p class="klein">Zoals de invoer is, alsof er nog niets gepland is.</p>' + bezettingTabel(R.analyseerZonderPlanning(m)) + '</section>' : '');
  }
  /* Beschikbaarheid als vaste (niet-klikbare) tabel, voor afdruk en export-voorbeeld. */
  function beschikbaarheidTabel(soort, r) {
    const lijst = soort === 'docent' ? m.docenten.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' })) : m.klassen.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl', { sensitivity: 'base' }));
    if (!lijst.length) return '<p class="klein">Geen ' + (soort === 'docent' ? 'docenten' : 'klassen/groepen') + '.</p>';
    const bezet = bezetUren(soort);
    const vrij = {}; r.bezetting.filter(b => b.soort === soort).forEach(b => { vrij[b.naam] = b; });
    let vorigeDag = null;
    const kop = m.tijdvakken.map(t => { const d = dagVan(t), c = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d; return '<th' + c + '>' + esc(t.label) + '<br><span class="klein">' + R.fmt(t.uren) + ' u</span></th>'; }).join('');
    const rijen = lijst.map(res => {
      vorigeDag = null;
      return '<tr><td class="naam">' + esc(res.naam) + '</td>' + m.tijdvakken.map(t => {
        const d = dagVan(t), c = vorigeDag !== null && d !== vorigeDag ? 'dag-scheiding ' : ''; vorigeDag = d;
        const door = bezet[res.naam] && bezet[res.naam][t.id], aan = res.beschikbaar.includes(t.id);
        return '<td class="' + c + '"><span class="vakje ' + (door ? 'bezet' : aan ? 'aan' : 'uit') + '" title="' + (door ? esc(door.ids.join(', ')) : '') + '">' + (door ? R.fmt(door.uren) + 'u ' + esc(door.ids.map(x => x.replace(/^S0*/, 'S')).join(' ')) : aan ? '✓' : '') + '</span></td>';
      }).join('') + '<td class="num klein" style="padding:0 8px">' + (vrij[res.naam] ? R.fmt(vrij[res.naam].totaalBeschikbaar) + ' / ' + R.fmt(vrij[res.naam].beschikbaar) : '') + '</td></tr>';
    }).join('');
    return '<div class="tabelkader"><table class="rooster afdrukrooster"><thead><tr><th class="naam">' + (soort === 'docent' ? 'Docent' : 'Klas/groep') + '</th>' + kop + '<th>Beschikbaar / vrij (u)</th></tr></thead><tbody>' + rijen + '</tbody></table></div>';
  }
  function legendaBeschikbaarheid() {
    return '<div class="legenda"><span><span class="vakje aan">✓</span>beschikbaar</span><span><span class="vakje uit"></span>niet beschikbaar</span><span><span class="vakje bezet">2u S1</span>uren al gepland (assessment)</span><span>Beschikbaar = totaal ingevuld · vrij = na aftrek van wat al gepland is</span></div>';
  }

  /* ================= LOCATIES ================= */
  function renderLocaties() {
    let vorigeDag = null;
    const kop = m.tijdvakken.map(t => { const d = dagVan(t), c = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d; return '<th' + c + '>' + esc(t.label) + '</th>'; }).join('');
    const locRijen = m.locaties.map(l => {
      const klassen = m.klassen.filter(k => k.locatie === l.naam).length;
      vorigeDag = null;
      return '<tr><td class="naam"><label class="verborgen" for="ln-' + esc(l.naam) + '">Naam</label><input id="ln-' + esc(l.naam) + '" data-locveld="naam" data-loc="' + esc(l.naam) + '" value="' + esc(l.naam) + '"></td>' +
        '<td><label class="verborgen" for="ll-' + esc(l.naam) + '">Standaard lokalen</label><input id="ll-' + esc(l.naam) + '" type="number" min="0" data-locveld="lokalen" data-loc="' + esc(l.naam) + '" value="' + l.lokalen + '" style="width:70px"></td>' +
        m.tijdvakken.map(t => {
          const d = dagVan(t), c = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d; const eigen = l.perTijdvak[t.id] !== undefined;
          return '<td' + c + '><label class="verborgen" for="lt-' + esc(l.naam) + '-' + t.id + '">' + esc(l.naam + ' ' + t.label) + '</label><input id="lt-' + esc(l.naam) + '-' + t.id + '" class="lokaalgetal' + (eigen ? ' eigen' : '') + '" type="number" min="0" data-loktv="' + t.id + '" data-loc="' + esc(l.naam) + '" value="' + M.lokalenIn(m, l.naam, t.id) + '" title="' + (eigen ? 'Aangepast voor dit dagdeel (leegmaken = standaard)' : 'Standaard') + '"></td>';
        }).join('') +
        '<td class="klein" style="white-space:nowrap;padding:0 8px">' + klassen + ' klas(sen)</td>' +
        '<td><button class="knop klein-k gevaar" data-weg-loc="' + esc(l.naam) + '" aria-label="' + esc(l.naam) + ' verwijderen"' + (klassen ? ' disabled title="Nog ' + klassen + ' klas(sen) op deze locatie"' : '') + '>✕</button></td></tr>';
    }).join('');
    const klasRijen = m.klassen.map(k => '<tr><td><b>' + esc(k.naam) + '</b></td><td><label class="verborgen" for="kloc-' + esc(k.naam) + '">Locatie ' + esc(k.naam) + '</label><select id="kloc-' + esc(k.naam) + '" data-klasloc="' + esc(k.naam) + '"><option value="">— kies —</option>' + m.locaties.map(l => '<option' + (k.locatie === l.naam ? ' selected' : '') + '>' + esc(l.naam) + '</option>').join('') + '</select></td><td class="klein">' + M.gebruikt(m, 'klas', k.naam).length + ' assessment(s)' + (k.locatie ? '' : ' · <span class="pastniet">nog geen locatie</span>') + '</td></tr>').join('');
    inhoud.innerHTML =
      '<section class="kolom smal"><div class="paneel"><h2>Klassen en locaties plakken</h2><p class="uitleg">De locatie van een klas volgt uit de eerste letter: <b>A</b> = Apeldoorn, <b>D</b> = Deventer, <b>E</b> = Enschede. Wijkt een klas af, dan kies je de locatie hieronder of plak je <span class="mono" style="font-size:12px">klas ⇥ locatie</span>.</p>' +
      '<label class="veld">Regels<textarea id="plak-kl" rows="6" class="mono" placeholder="1A&#9;Enschede&#10;2B&#9;Deventer"></textarea></label><div class="rij"><button class="knop primair" id="plak-kl-knop">Toevoegen of bijwerken</button></div>' +
      '<p class="klein">Een klas naar een andere locatie verplaatsen haalt de planning van haar assessments weg, omdat de lokalen dan niet meer kloppen.</p></div>' +
      '<div class="paneel"><h3>Locatie toevoegen</h3><div class="raster2"><label class="veld">Naam<input id="loc-naam" placeholder="bijv. Zwolle"></label><label class="veld">Lokalen per dagdeel<input id="loc-lok" type="number" min="0" value="1"></label></div><button class="knop" id="loc-voeg">Toevoegen</button></div></section>' +
      '<section class="kolom breed"><div class="paneel"><h2>Lokalen per locatie en dagdeel</h2><p class="klein">Vul per locatie het standaardaantal lokalen per dagdeel in en pas het per dagdeel aan waar het afwijkt (blauw = aangepast; leegmaken = terug naar standaard). Elk lokaal heeft de lesuren van het dagdeel; zo passen bijvoorbeeld drie assessments van 2 uur in één lokaal van 6 lesuren. Op het tabblad <b>Lokalen</b> zie je waar extra lokalen nodig zijn.</p>' +
      '<div class="tabelkader"><table class="rooster"><thead><tr><th class="naam">Locatie</th><th>Standaard</th>' + kop + '<th></th><th></th></tr></thead><tbody>' + locRijen + '</tbody></table></div></div>' +
      '<div class="paneel"><h2>Klassen en hun locatie</h2><div class="tabelkader"><table class="lijst"><thead><tr><th>Klas/groep</th><th>Locatie</th><th></th></tr></thead><tbody>' + (klasRijen || '<tr><td colspan="3" class="klein">Nog geen klassen.</td></tr>') + '</tbody></table></div></div></section>';
  }

  /* ================= LOKALEN ================= */
  const LOKAALDRUK_UITLEG = 'Per locatie en dagdeel: aantal lokalen, en de druk = (al ingepaste uren + verwachte vraag) ÷ lokaaluren. De verwachte vraag verdeelt elk nog niet gepland assessment over de dagdelen waarin zijn klas en docenten samen vrij zijn. Het is een schatting om te zien waar het gaat knellen; "+n" is het geadviseerde aantal extra lokalen in dat dagdeel.';
  function drukKlasse(x) { return x.extra > 0 || x.druk > 1 ? 'd3' : x.druk >= 0.85 ? 'd2' : x.druk >= 0.6 ? 'd1' : ''; }
  function legendaLokaaldruk() {
    return '<div class="legenda"><span><span class="chip" style="background:#F7C1C1"></span>meer nodig dan er is (+n = extra lokalen)</span><span><span class="chip" style="background:#FAC775"></span>85–100%: krap</span><span><span class="chip" style="background:#FAEEDA"></span>60–85%</span><span>getal = lokalen · % = druk</span></div>';
  }
  function lokaaldrukTabel(r, bewerkbaar) {
    let vorigeDag = null;
    const kop = m.tijdvakken.map(t => { const d = dagVan(t), c = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d; return '<th' + c + '>' + esc(t.label) + '</th>'; }).join('');
    const rijen = m.locaties.map(l => {
      vorigeDag = null;
      const cellen = m.tijdvakken.map(t => {
        const x = r.lokaaldruk.find(y => y.locatie === l.naam && y.tv === t.id), d = dagVan(t), c = vorigeDag !== null && d !== vorigeDag ? 'dag-scheiding ' : ''; vorigeDag = d;
        const getal = bewerkbaar ? '<label class="verborgen" for="ld-' + esc(l.naam) + '-' + t.id + '">Lokalen ' + esc(l.naam + ' ' + t.label) + '</label><input id="ld-' + esc(l.naam) + '-' + t.id + '" class="lokaalgetal' + (x.aangepast ? ' eigen' : '') + '" type="number" min="0" data-loktv="' + t.id + '" data-loc="' + esc(l.naam) + '" value="' + x.lokalen + '">' : '<b>' + x.lokalen + '</b>';
        return '<td class="' + c + 'drukcel ' + drukKlasse(x) + '" title="' + esc(l.naam + ' ' + t.label + ': ' + x.lokalen + ' lokalen = ' + R.fmt(x.capaciteit) + ' lokaaluren; ingepast ' + R.fmt(x.gepland) + ' u, verwacht ' + R.fmt(x.verwacht) + ' u' + (x.tekort ? '; geen plek voor ' + x.tekort.join(', ') : '')) + '">' + getal + '<span class="drukpct">' + (x.druk === Infinity ? '∞' : Math.round(x.druk * 100) + '%') + '</span>' + (x.extra ? '<span class="extra">+' + x.extra + '</span>' : '') + '</td>';
      }).join('');
      const tot = r.lokaaldruk.filter(y => y.locatie === l.naam).reduce((s, y) => s + y.extra, 0);
      return '<tr><td class="naam"><b>' + esc(l.naam) + '</b><br><span class="klein">standaard ' + l.lokalen + '</span></td>' + cellen + '<td class="klein" style="padding:0 8px;white-space:nowrap">' + (tot ? '<b>+' + tot + ' lokaal-dagdelen</b>' : 'geen tekort') + '</td></tr>';
    }).join('');
    return '<div class="tabelkader"><table class="rooster druktabel"><thead><tr><th class="naam">Locatie</th>' + kop + '<th>Advies</th></tr></thead><tbody>' + rijen + '</tbody></table></div>';
  }
  function tekortenHtml(r) {
    if (!r.lokaalTekort.length) return '';
    return '<div class="melding let" style="margin:0"><div><strong>Extra lokaal nodig voor ' + r.lokaalTekort.length + ' ingeplande assessment(s)</strong><ul>' +
      r.lokaalTekort.map(x => '<li><b>' + x.id + '</b> ' + esc(x.module + ' · ' + x.klas + ' · ' + R.fmt(x.uren) + 'u') + ' op ' + esc(x.locatie) + ' in <b>' + esc(tv(x.tv).label) + '</b>: daar is geen lokaal vrij. Vraag een lokaal aan en verhoog daarna het aantal lokalen in de tabel hierboven.</li>').join('') + '</ul></div></div>';
  }
  function lokaalRoosterHtml(r) {
    const locs = Object.keys(r.lokaalRooster);
    if (!locs.length) return '<p class="klein">Nog niets ingepland.</p>';
    return locs.map(loc => {
      const perTv = r.lokaalRooster[loc];
      const tvs = m.tijdvakken.filter(t => perTv[t.id]);
      const n = Math.max.apply(null, tvs.map(t => Math.max(M.lokalenIn(m, loc, t.id), Math.max.apply(null, Object.keys(perTv[t.id]).map(Number).concat([0])))).concat([1]));
      let kop = ''; for (let i = 1; i <= n; i++) kop += '<th>Lokaal ' + i + '</th>';
      const rijen = tvs.map(t => {
        let c = ''; const aantal = M.lokalenIn(m, loc, t.id);
        for (let i = 1; i <= n; i++) {
          const lijst = perTv[t.id][i] || [], gebruikt = lijst.reduce((s, x) => s + x.uren, 0);
          c += i > aantal && !lijst.length ? '<td class="klein" style="color:#888780">—</td>' : '<td' + (i > aantal ? ' class="extralokaal" title="Extra lokaal: nog aan te vragen"' : '') + '>' + (i > aantal ? '<span class="waarsch">extra lokaal nodig</span><br>' : '') + lijst.map(x => '<span class="roosteritem" title="' + esc(x.module + ' · ' + x.klas) + '"><b>' + x.id + '</b> ' + R.fmt(x.uren) + 'u</span>').join(' ') + (lijst.length ? ' <span class="klein">vrij ' + R.fmt(t.uren - gebruikt) + 'u</span>' : '<span class="klein">leeg</span>') + '</td>';
        }
        return '<tr><td><b>' + esc(t.label) + '</b> <span class="klein">' + R.fmt(t.uren) + 'u</span></td>' + c + '</tr>';
      }).join('');
      return '<h3 style="margin:8px 0 4px">' + esc(loc) + '</h3><div class="tabelkader"><table class="lijst"><thead><tr><th>Dagdeel</th>' + kop + '</tr></thead><tbody>' + rijen + '</tbody></table></div>';
    }).join('');
  }
  function renderLokalen() {
    const r = analyse();
    inhoud.innerHTML = '<section class="paneel" style="flex:1 1 100%"><h2>Lokalen per locatie en dagdeel</h2><p class="klein">' + LOKAALDRUK_UITLEG + ' Je kunt het aantal lokalen hier direct aanpassen; de analyse rekent meteen opnieuw.</p>' +
      legendaLokaaldruk() + lokaaldrukTabel(r, true) + tekortenHtml(r) + '</section>' +
      '<section class="paneel" style="flex:1 1 100%"><h2>Lokaalindeling van wat al ingepland is</h2>' + lokaalRoosterHtml(r) + '</section>';
  }

  /* ================= EXPORT ================= */
  /* ================= INTERVENTIES ================= */
  const STATUSKLASSE = { 'Akkoord': 's-ok', 'In afwachting': 's-wacht', 'Niet akkoord': 's-niet', 'Vervallen': 's-verv' };
  const datumNl = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d.slice(8, 10) + '-' + d.slice(5, 7) + '-' + d.slice(0, 4) : (d || '');
  const vandaag = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  /* keuzes voor "Betreft": assessments, docenten en klassen uit de invoer */
  function betreftKeuzes() {
    const k = [];
    m.assessments.forEach(a => k.push({ tekst: a.id + ' · ' + a.module + ' · ' + a.klas, soort: 'ass', naam: a.id }));
    m.docenten.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).forEach(d => k.push({ tekst: 'Docent: ' + d.naam, soort: 'docent', naam: d.naam }));
    m.klassen.slice().sort((a, b) => a.naam.localeCompare(b.naam, 'nl')).forEach(d => k.push({ tekst: 'Klas: ' + d.naam, soort: 'klas', naam: d.naam }));
    return k;
  }
  function chipHtml(b, weg) {
    const ass = b.soort === 'ass' ? m.assessments.find(x => x.id === b.naam) : null;
    const tekst = b.soort === 'ass' ? b.naam + (ass ? ' ' + ass.module + ' · ' + ass.klas : '') : b.naam;
    return '<span class="ivchip c-' + b.soort + '">' + esc(tekst) + (weg !== undefined ? ' <button class="chipweg" data-ivchipweg="' + weg + '" aria-label="' + esc(tekst) + ' weghalen">×</button>' : '') + '</span>';
  }
  function ivFormLeeg() { return { datum: vandaag(), betreft: [], wat: '', reden: '', overlegdMet: '', status: 'Akkoord' }; }
  function ivGevolg(iv) {
    return iv.betreft.filter(b => b.soort === 'ass').map(b => { const a = m.assessments.find(x => x.id === b.naam); return a && a.gepland.length ? '✓ ' + a.id + ' ingepland in ' + a.gepland.map(s => tv(s.tv).label).join('+') : ''; }).filter(Boolean).join(' · ');
  }
  function interventieTabel(lijst, metKnoppen) {
    if (!lijst.length) return '<p class="klein">Nog geen interventies vastgelegd.</p>';
    return '<div class="tabelkader"><table class="lijst ivlijst"><thead><tr><th style="width:95px">Datum</th><th style="width:260px">Betreft</th><th>Wat is aangepast</th><th style="width:200px">Overlegd met</th><th style="width:120px">Status</th>' + (metKnoppen ? '<th style="width:50px"></th>' : '') + '</tr></thead><tbody id="iv-rijen">' +
      lijst.map(iv => {
        const zoek = [datumNl(iv.datum), M.betreftTekst(m, iv.betreft), iv.wat, iv.reden, iv.overlegdMet, iv.status].join(' ').toLowerCase(), gevolg = ivGevolg(iv);
        return '<tr data-zoek="' + esc(zoek) + '"' + (iv.status === 'Vervallen' ? ' class="vervallen"' : '') + '><td>' + esc(datumNl(iv.datum)) + '</td><td>' + iv.betreft.map(b => chipHtml(b)).join(' ') + '</td><td>' + esc(iv.wat) +
          (iv.reden ? '<div class="ivreden"><b>Reden:</b> ' + esc(iv.reden) + '</div>' : '') + (gevolg ? '<div class="ivgevolg">' + esc(gevolg) + '</div>' : '') + '</td><td>' + esc(iv.overlegdMet) + '</td><td><span class="ivstatus ' + STATUSKLASSE[iv.status] + '">' + esc(iv.status) + '</span></td>' +
          (metKnoppen ? '<td><button class="knop klein-k" data-ivbewerk="' + iv.id + '" title="Aanpassen of verwijderen" aria-label="Interventie ' + iv.id + ' aanpassen">✎</button></td>' : '') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  const ivGesorteerd = () => (m.interventies || []).slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || '') || b.id.localeCompare(a.id));
  function renderInterventies() {
    if (!ui.ivForm) ui.ivForm = ivFormLeeg();
    const f = ui.ivForm, bew = ui.ivBewerk, lijst = ivGesorteerd();
    const tel = {}; M.STATUSSEN.forEach(s => { tel[s] = lijst.filter(x => x.status === s).length; });
    inhoud.innerHTML =
      '<section class="paneel" style="flex:1 1 100%"><h2>' + (bew ? 'Interventie ' + bew + ' aanpassen' : 'Interventie vastleggen') + '</h2>' +
      '<p class="klein">Leg vast wat je hebt aangepast of voorgesteld om een knelpunt op te lossen. Kies bij <b>Betreft</b> een of meer assessments, docenten of klassen (typ om te zoeken, Enter of + om toe te voegen). Ook wat <b>niet akkoord</b> of <b>vervallen</b> is, is de moeite waard: dan zie je later welke opties al bekeken zijn.</p>' +
      '<div class="ivform">' +
      '<label>Datum overleg<input type="date" id="iv-datum" value="' + esc(f.datum) + '"></label>' +
      '<label>Betreft (assessment, docent, klas)<div class="ivchips" id="iv-chips">' + f.betreft.map((b, i) => chipHtml(b, i)).join('') + '<span class="ivkies"><input id="iv-betreft" list="iv-keuzes" placeholder="+ toevoegen…" autocomplete="off"><button class="knop klein-k" id="iv-betreft-knop" aria-label="Toevoegen">+</button></span></div>' +
      '<datalist id="iv-keuzes">' + betreftKeuzes().map(k => '<option value="' + esc(k.tekst) + '"></option>').join('') + '</datalist></label>' +
      '<label>Wat is aangepast<textarea id="iv-wat" rows="2">' + esc(f.wat) + '</textarea></label>' +
      '<label>Reden<textarea id="iv-reden" rows="2" placeholder="waarom (niet) akkoord, of waarom nodig">' + esc(f.reden) + '</textarea></label>' +
      '<label>Overlegd met<input id="iv-overleg" value="' + esc(f.overlegdMet) + '" placeholder="namen of rollen"></label>' +
      '<label>Status<select id="iv-status">' + M.STATUSSEN.map(s => '<option' + (f.status === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select></label>' +
      '</div><div class="rij" style="margin-top:10px"><button class="knop primair" id="iv-opslaan">' + (bew ? 'Wijziging opslaan' : 'Toevoegen') + '</button>' +
      (bew ? '<button class="knop" id="iv-annuleer">Annuleren</button><button class="knop gevaar" id="iv-verwijder">Verwijderen</button>' : '') +
      '<span class="klein">Wordt bewaard in de browser en in het werkbestand (tabblad Interventies).</span></div></section>' +
      '<section class="paneel" style="flex:1 1 100%"><div class="rij tussen"><div><h2>Interventies</h2><span class="klein">' + lijst.length + ' interventie(s) · nieuwste bovenaan' + (lijst.length ? ' · ' + M.STATUSSEN.filter(s => tel[s]).map(s => tel[s] + ' ' + s.toLowerCase()).join(', ') : '') + '</span></div>' +
      '<label class="rij klein">Filter <input id="iv-zoek" type="search" value="' + esc(ui.ivZoek || '') + '" placeholder="module, docent, klas, persoon of status" style="width:260px"></label></div>' +
      interventieTabel(lijst, true) + '</section>';
    ivFilter();
  }
  function ivFilter() {
    const q = (ui.ivZoek || '').trim().toLowerCase();
    document.querySelectorAll('#iv-rijen tr').forEach(tr => { tr.style.display = !q || tr.dataset.zoek.includes(q) ? '' : 'none'; });
  }
  function ivLeesForm() {
    const f = ui.ivForm; if (!f) return;
    const v = id => { const e = document.getElementById(id); return e ? e.value : ''; };
    f.datum = v('iv-datum'); f.wat = v('iv-wat').trim(); f.reden = v('iv-reden').trim(); f.overlegdMet = v('iv-overleg').trim(); f.status = v('iv-status') || f.status;
  }
  function ivVoegBetreftToe() {
    const inp = $('#iv-betreft'); if (!inp) return;
    const t = inp.value.trim(); if (!t) return;
    const k = betreftKeuzes().find(x => x.tekst.toLowerCase() === t.toLowerCase()) || betreftKeuzes().find(x => x.naam.toLowerCase() === t.toLowerCase());
    if (!k) { toonFouten([{ bron: 'Interventie, betreft', melding: '"' + t + '" staat niet in de invoer.', herstel: 'Kies een assessment, docent of klas uit de lijst die verschijnt als je typt.' }]); return; }
    ivLeesForm();
    if (!ui.ivForm.betreft.some(b => b.soort === k.soort && b.naam === k.naam)) ui.ivForm.betreft.push({ soort: k.soort, naam: k.naam });
    renderInterventies(); const n = $('#iv-betreft'); if (n) n.focus();
  }

  /* Planningsresultaat: per dagdeel, locatie en lokaal wat waar staat, om over te nemen in het roosterpakket. */
  function resultaatTabel(r) {
    if (!r.gepland.length) return '<p class="klein">Nog niets ingepland.</p>';
    const regels = [];
    r.gepland.forEach(g => g.segmenten.forEach((s, i) => regels.push({ g, s, deel: g.segmenten.length > 1 ? (i + 1) + '/' + g.segmenten.length : '' })));
    const pos = id => m.tijdvakken.findIndex(t => t.id === id);
    regels.sort((x, y) => pos(x.s.tv) - pos(y.s.tv) || x.g.locatie.localeCompare(y.g.locatie) || x.s.lokaal - y.s.lokaal || x.g.id.localeCompare(y.g.id));
    let vorigeDag = null;
    return '<div class="tabelkader"><table class="lijst resultaat"><thead><tr><th>Dagdeel</th><th>Locatie</th><th>Lokaal</th><th>ID</th><th>Module</th><th>Klas/groep</th><th>Docent(en)</th><th class="num">Uren</th><th>Deel</th></tr></thead><tbody>' +
      regels.map(x => {
        const t = tv(x.s.tv), dg = dagVan(t), grens = vorigeDag !== null && dg !== vorigeDag; vorigeDag = dg;
        return '<tr' + (grens ? ' class="eilandgrens"' : '') + '><td><b>' + esc(t.label) + '</b></td><td>' + esc(x.g.locatie) + '</td><td>' + (x.s.extra ? '<span class="waarsch">extra lokaal nodig</span>' : x.s.lokaal) + '</td><td class="mono"><b>' + x.g.id + '</b></td><td>' + esc(x.g.module) + '</td><td>' + esc(x.g.klas) + '</td><td>' + esc(x.g.docenten.join('; ')) + '</td><td class="num">' + R.fmt(x.s.uren) + '</td><td class="klein">' + x.deel + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      (r.volgorde.length ? '<p class="klein">Nog niet ingepland: ' + r.volgorde.map(it => it.id).join(', ') + '.</p>' : '');
  }
  /* Lokaalbezetting per locatie: per lokaal en lesuur welke assessments er staan (zelfde opmaak als bij het inplannen),
     met eronder een lijst zodat ook korte (afgekapte) blokken op papier leesbaar zijn. */
  function lokaalBezettingHtml(r) {
    const TV = m.tijdvakken;
    const dagen = []; TV.forEach(t => { const d = dagVan(t); if (!dagen.length || dagen[dagen.length - 1].dag !== d) dagen.push({ dag: d, n: 0 }); dagen[dagen.length - 1].n += t.uren; });
    const kop = '<thead><tr><th class="rnaam"></th>' + dagen.map(d => '<th colspan="' + d.n + '" class="rdag dd-grens">' + esc(d.dag) + '</th>').join('') + '</tr><tr><th class="rnaam klein">dagdeel · lesuur</th>' +
      TV.map(t => { let h = ''; for (let u = 0; u < t.uren; u++) h += '<th class="ruur' + (u === 0 ? ' dd-grens' : '') + '">' + (u === 0 ? esc(t.label.split(/[-\s]/)[1] || t.label) : u + 1) + '</th>'; return h; }).join('') + '</tr></thead>';
    return m.locaties.map(l => {
      const ro = r.lokaalRooster[l.naam] || {};
      const max = Math.max.apply(null, TV.map(t => Math.max(M.lokalenIn(m, l.naam, t.id), Math.max.apply(null, Object.keys(ro[t.id] || {}).map(Number).concat([0])))).concat([0]));
      const totaal = TV.reduce((s, t) => s + M.lokalenIn(m, l.naam, t.id) * t.uren, 0);
      const lijst = []; let gebruikt = 0;
      let rijen = '';
      for (let i = 1; i <= max; i++) {
        rijen += '<tr><th class="rnaam">Lokaal ' + i + '</th>' + TV.map(t => {
          const n = M.lokalenIn(m, l.naam, t.id), items = (ro[t.id] || {})[i] || []; let h = '', g = 0;
          items.forEach((x, k) => {
            const u = Math.max(1, Math.min(t.uren - g, Math.round(x.uren))); if (u <= 0) return;
            h += '<td colspan="' + u + '" class="gepl' + (i > n ? ' extra' : '') + (k === 0 ? ' dd-grens' : '') + '" title="' + esc(x.id + ' ' + x.module + ' · ' + x.klas + ' · ' + R.fmt(x.uren) + 'u') + '"><div class="rblok"><b>' + x.id + '</b> ' + esc(x.klas) + '</div></td>';
            g += u; gebruikt += x.uren;
            lijst.push({ pos: TV.indexOf(t), t, i, x, extra: i > n });
          });
          for (let u = g; u < t.uren; u++) h += '<td class="' + (i <= n ? 'vrij' : 'grijs') + (u === 0 ? ' dd-grens' : '') + '"></td>';
          return h;
        }).join('') + '</tr>';
      }
      lijst.sort((a, b) => a.pos - b.pos || a.i - b.i);
      const kopje = '<h3 style="margin:14px 0 6px">' + esc(l.naam) + ' <span class="klein" style="font-weight:400">· ' + l.lokalen + (l.lokalen === 1 ? ' lokaal' : ' lokalen') + ' · ' + R.fmt(gebruikt) + ' van ' + R.fmt(totaal) + ' lokaaluren gebruikt</span></h3>';
      if (!max) return kopje + '<p class="klein">Geen lokalen.</p>';
      return '<div class="lokaalblok">' + kopje + '<div class="rasterkader">' + '<table class="raster">' + kop + '<tbody>' + rijen + '</tbody></table></div>' +
        (lijst.length ? '<ul class="lokaallijst">' + lijst.map(y => '<li><b>' + esc(y.t.label) + '</b> lokaal ' + y.i + (y.extra ? ' <span class="waarsch">(extra)</span>' : '') + ': <b>' + y.x.id + '</b> ' + esc(y.x.module) + ' · ' + esc(y.x.klas) + ' (' + R.fmt(y.x.uren) + 'u)</li>').join('') + '</ul>' : '<p class="klein">Nog niets ingepland op deze locatie.</p>') + '</div>';
    }).join('');
  }
  const AFDRUKDELEN = [
    ['resultaat', 'Planningsresultaat (per dagdeel)'], ['volgorde', 'Planningsvolgorde (nog te plannen)'], ['matrix', 'Afhankelijkheden'],
    ['bezInvoer', 'Bezetting bij invoer'], ['bezNa', 'Bezetting na planning'], ['lokalen', 'Lokalen per dagdeel'], ['lokaalBezetting', 'Lokaalbezetting per locatie'], ['indeling', 'Lokaalindeling'],
    ['beschDoc', 'Beschikbaarheid docenten'], ['beschKlas', 'Beschikbaarheid klassen/groepen'], ['interventies', 'Interventies']];
  function renderExport() {
    if (!m.assessments.length) { inhoud.innerHTML = '<section class="paneel breed leeg-staat">Voeg eerst assessments toe.</section>'; return; }
    const r = analyse(), datum = new Date().toLocaleString('nl-NL'), k = ui.afdruk, alle = ui.matrixModus === 'alle';
    let vorig = null, n = 0;
    const kop = (titel, bron) => '<div' + (n++ ? ' class="pagina-breuk"' : '') + '><h2>' + titel + '</h2><div class="bron">' + bron + '</div></div>';
    const rijen = r.volgorde.map(it => {
      const g = vorig !== null && it.eiland !== vorig; vorig = it.eiland;
      return '<tr' + (g ? ' class="eilandgrens"' : '') + '><td class="num">' + it.volgnummer + '</td><td class="mono"><b>' + it.id + '</b></td><td>' + esc(it.module) + '</td><td>' + esc(it.klas) + '</td><td>' + esc(it.locatie) + '</td><td>' + esc(it.docenten.join('; ')) + '</td><td class="num">' + R.fmt(it.uren) + '</td><td class="num">' + R.fmt(it.overlap) + '</td><td>' + (it.prio === Infinity ? 'geen ruimte' : R.fmtKrapte(it.prio)) + '</td><td>' + esc(it.knelpunt) + '</td><td>' + (it.eiland === 'los' ? 'los' : it.eiland) + '</td><td>' + (it.volgtUit ? it.volgtUit.id + ' via ' + esc(it.volgtUit.via.naam) : '') + '</td><td style="min-width:90px"></td></tr>';
    }).join('');
    const rm = alle ? R.analyseerZonderPlanning(m) : r;
    let h = '';
    if (k.resultaat) h += kop('Planningsresultaat — ' + esc(m.naam), r.gepland.length + ' van ' + m.assessments.length + ' assessments ingepland · per dagdeel, locatie en lokaal · ' + datum + '. Binnen een dagdeel liggen de lesuren niet vast.') + resultaatTabel(r);
    if (k.volgorde) h += kop('Planningsvolgorde — ' + esc(m.naam), 'Invoerversie ' + m.invoerversie + ' · drempel eilanden ' + Math.round(r.drempel * 100) + '% · ' + datum + (r.gepland.length ? ' · ' + r.gepland.length + ' assessment(s) al gepland en niet in deze lijst' : '')) +
      (r.volgorde.length ? '<div class="tabelkader"><table class="lijst"><thead><tr><th class="num">#</th><th>ID</th><th>Module</th><th>Klas/groep</th><th>Locatie</th><th>Docent(en)</th><th class="num">Uren</th><th class="num">Samen vrij</th><th>Prioriteit</th><th>Knelpunt</th><th>Eiland</th><th>Volgt uit</th><th>Gepland op</th></tr></thead><tbody>' + rijen + '</tbody></table></div>' : '<p class="klein">Alles is ingepland.</p>');
    if (k.matrix) h += kop('Afhankelijkheden — ' + (alle ? 'alle assessments, vanaf het begin' : 'nog te plannen'), 'In planningsvolgorde. D = gedeelde docent, K = gedeelde klas; kleur = bezetting van wat gedeeld wordt. Lokalen tellen niet mee.' + (alle ? ' ✓ = al ingepland.' : '')) +
      (rm.volgorde.length ? legendaMatrix(rm) + '<div class="matrixkader">' + matrixHtml(rm, false, alle) + '</div>' : '<p class="klein">Alles is ingepland; kies bij Afhankelijkheden "alle, vanaf het begin".</p>');
    if (k.bezInvoer) h += kop('Bezetting bij invoer', 'Zoals de invoer is, alsof er nog niets gepland is.') + bezettingTabel(R.analyseerZonderPlanning(m));
    if (k.bezNa) h += kop('Bezetting na planning', (r.gepland.length ? 'Na de ' + r.gepland.length + ' al ingeplande assessment(s). ' : 'Er is nog niets ingepland; gelijk aan de bezetting bij invoer. ') + BEZETTING_UITLEG) + bezettingTabel(r);
    if (k.lokalen) h += kop('Lokalen per dagdeel', LOKAALDRUK_UITLEG) + legendaLokaaldruk() + lokaaldrukTabel(r, false) + tekortenHtml(r);
    if (k.lokaalBezetting) h += kop('Lokaalbezetting per locatie', 'Per lokaal en lesuur welke assessments zijn ingepland. Binnen een dagdeel liggen de lesuren niet vast; ingeplande assessments staan vooraan in het dagdeel. Wit = vrij, grijs = geen lokaal, rood = extra lokaal nodig.') + lokaalBezettingHtml(r);
    if (k.indeling) h += kop('Lokaalindeling (ingepast)', 'Per locatie en dagdeel welke assessments in welk lokaal zijn ingepast. Volgorde binnen een lokaal is niet vastgelegd.') + lokaalRoosterHtml(r);
    if (k.beschDoc) h += kop('Beschikbaarheid docenten', 'De beschikbaarheid waarop de volgorde is gebaseerd (invoerversie ' + m.invoerversie + ').') + legendaBeschikbaarheid() + beschikbaarheidTabel('docent', r);
    if (k.beschKlas) h += kop('Beschikbaarheid klassen/groepen', 'De beschikbaarheid waarop de volgorde is gebaseerd (invoerversie ' + m.invoerversie + ').') + legendaBeschikbaarheid() + beschikbaarheidTabel('klas', r);
    if (k.interventies) h += kop('Interventies', 'Wat is aangepast om knelpunten op te lossen, met wie overlegd en de status. Nieuwste bovenaan.') + interventieTabel(ivGesorteerd(), false);
    const keuze = '<div class="afdrukkeuze"><span class="klein"><b>Afdrukken:</b></span>' +
      AFDRUKDELEN.map(([sl, naam]) => '<label class="vinkje"><input type="checkbox" data-afdruk="' + sl + '"' + (k[sl] ? ' checked' : '') + '> ' + naam + '</label>').join('') +
      '<span class="rij"><button class="knop klein-k" data-afdrukset="resultaat">Alleen resultaat</button><button class="knop klein-k" data-afdrukset="alles">Alles</button><button class="knop klein-k" data-afdrukset="niets">Niets</button></span>' +
      (k.matrix ? '<label class="klein">Afhankelijkheden: <select data-afdrukmatrix><option value="open"' + (alle ? '' : ' selected') + '>nog te plannen</option><option value="alle"' + (alle ? ' selected' : '') + '>alle, vanaf het begin</option></select></label>' : '') + '</div>';
    inhoud.innerHTML =
      '<section class="paneel breed geen-afdruk" style="flex:1 1 100%"><div class="rij tussen"><div><h2>Export &amp; afdrukken</h2><p class="klein">Het werkbestand bevat de invoer (Assessments, Locaties, Docenten, Klassen), de planning en de instellingen, zodat je het later weer kunt openen, plus alle uitvoer van de analyse. Bij afdrukken kies je hieronder welke onderdelen meegaan; de voorvertoning eronder toont precies wat er wordt afgedrukt. Sla bestanden met echte namen alleen op in een beveiligde omgeving.</p></div>' +
      '<div class="rij"><button class="knop primair" id="exp-xlsx">Werkbestand opslaan (.xlsx)</button><button class="knop" id="exp-print"' + (n ? '' : ' disabled') + '>Afdrukken / PDF</button></div></div>' + keuze + (r.fouten.length ? meldingenPaneel(r) : '') + '</section>' +
      '<section class="paneel breed afdruk" style="flex:1 1 100%">' + (h || '<p class="klein">Kies hierboven minstens één onderdeel om af te drukken.</p>') + '</section>';
  }

  /* ================= gebeurtenissen ================= */
  inhoud.addEventListener('click', e => {
    const t = e.target;
    const d = sel => t.closest(sel);
    if (ui.tab === 'assessments') {
      if (t.id === 'plak-knop') {
        const tekst = $('#plak').value, res = M.plakAssessments(m, tekst), regels = tekst.split(/\r?\n/);
        na(); renderAssessments(); $('#plak').value = res.fouten.map(f => regels[f.regel]).join('\n');
        const extra = (res.nieuw.docent.length ? ' Nieuwe docenten: ' + res.nieuw.docent.join(', ') + '.' : '') + (res.nieuw.klas.length ? ' Nieuwe klassen: ' + res.nieuw.klas.join(', ') + '.' : '') + (res.nieuw.docent.length || res.nieuw.klas.length ? ' Vul hun beschikbaarheid in op het tabblad Beschikbaarheid.' : '');
        if (res.fouten.length) toonFouten(res.fouten, res.toegevoegd.length + ' toegevoegd, ' + res.fouten.length + ' regel(s) niet toegevoegd');
        else if (res.toegevoegd.length) toonOk(res.toegevoegd.length + ' assessment(s) toegevoegd.' + extra);
        return;
      }
      if (t.id === 'plak-wis') { $('#plak').value = ''; return; }
      const w = d('[data-weg]');
      if (w) { const id = w.dataset.weg; if (!confirm('Assessment ' + id + ' verwijderen? De ID wordt niet opnieuw uitgegeven.')) return; M.verwijderAssessment(m, id); na(); renderAssessments(); toonOk('Assessment ' + id + ' verwijderd.'); }
      return;
    }
    if (ui.tab === 'beschikbaarheid') {
      const s = d('[data-soort]'); if (s) { ui.soort = s.dataset.soort; renderBeschikbaarheid(); return; }
      const v = d('[data-vak]');
      if (v) { const kader = inhoud.querySelector('.breed .tabelkader'), st = kader ? [kader.scrollTop, kader.scrollLeft] : [0, 0]; M.wisselBeschikbaar(m, ui.soort, v.dataset.naam, v.dataset.vak); na(); renderBeschikbaarheid(); const k2 = inhoud.querySelector('.breed .tabelkader'); if (k2) { k2.scrollTop = st[0]; k2.scrollLeft = st[1]; } const nv = inhoud.querySelector('[data-vak="' + v.dataset.vak + '"][data-naam="' + CSS.escape(v.dataset.naam) + '"]'); if (nv) nv.focus(); return; }
      const rij = d('[data-rij]'); if (rij) { M.zetRijBeschikbaar(m, ui.soort, rij.dataset.rij, rij.dataset.aan === '1'); na(); renderBeschikbaarheid(); return; }
      const weg = d('[data-weg-res]'); if (weg) { if (!confirm('"' + weg.dataset.wegRes + '" verwijderen?')) return; M.verwijderRes(m, ui.soort, weg.dataset.wegRes); na(); renderBeschikbaarheid(); return; }
      if (t.id === 'voeg-res') { const n = $('#nieuwe-res').value.trim(); if (!n) return; if (M.vindRes(m, ui.soort, n)) { toonFouten([{ bron: 'Beschikbaarheid', melding: '"' + n + '" bestaat al.', herstel: 'Kies een andere naam.' }]); return; } M.voegResToe(m, ui.soort, n); m.invoerversie++; na(); renderBeschikbaarheid(); return; }
      const al = d('[data-alles]'); if (al) { const aan = al.dataset.alles === '1'; if (!aan && !confirm('Bij alle ' + (ui.soort === 'docent' ? 'docenten' : 'klassen/groepen') + ' alle beschikbaarheid uitzetten?')) return; M.zetAllesBeschikbaar(m, ui.soort, aan); na(); renderBeschikbaarheid(); return; }
      const ko = d('[data-kolom]'); if (ko) { M.zetKolomBeschikbaar(m, ui.soort, ko.dataset.kolom, ko.dataset.aan === '1'); na(); renderBeschikbaarheid(); return; }
      if (t.id === 'plak-b-knop') {
        const tekst = $('#plak-b').value, res = M.plakBeschikbaarheid(m, ui.soort, tekst); na(); renderBeschikbaarheid();
        if (res.fouten.length) toonFouten(res.fouten, res.bijgewerkt.length + ' bijgewerkt, ' + res.fouten.length + ' melding(en)');
        else if (res.bijgewerkt.length) toonOk('Beschikbaarheid bijgewerkt voor ' + res.bijgewerkt.join(', ') + '.');
      }
      return;
    }
    if (ui.tab === 'tijdvakken') {
      const op = d('[data-tvop]'), neer = d('[data-tvneer]'), weg = d('[data-tvweg]');
      if (op) { M.verplaatsTijdvak(m, op.dataset.tvop, -1); na(); renderTijdvakken(); return; }
      if (neer) { M.verplaatsTijdvak(m, neer.dataset.tvneer, 1); na(); renderTijdvakken(); return; }
      if (weg) { if (!confirm('Tijdvak "' + tv(weg.dataset.tvweg).label + '" verwijderen? Het verdwijnt ook uit beschikbaarheid en planning.')) return; M.verwijderTijdvak(m, weg.dataset.tvweg); na(); renderTijdvakken(); return; }
      if (t.id === 'tv-standaard') { const n = M.standaardUren(m); na(); renderTijdvakken(); toonOk(n ? n + ' tijdvak(ken) aangepast naar de standaarduren.' : 'De tijdvakken hadden de standaarduren al.'); return; }
      if (t.id === 'tv-voeg') { const naam = $('#tv-naam').value.trim(), u = parseFloat($('#tv-uren').value.replace(',', '.')); if (!naam) { toonFouten([{ bron: 'Tijdvakken', melding: 'Geen naam ingevuld.', herstel: 'Vul een naam in, bijvoorbeeld za-o.' }]); return; } if (!(u > 0)) { toonFouten([{ bron: 'Tijdvakken', melding: 'Uren moet een positief getal zijn.', herstel: 'Vul bijvoorbeeld 6 in.' }]); return; } M.voegTijdvakToe(m, naam, u); na(); renderTijdvakken(); }
      return;
    }
    if (ui.tab === 'volgorde') {
      const ks = d('[data-kies]'); if (ks) { ui.optie = +ks.dataset.kies; const y = window.scrollY; renderVolgorde(); window.scrollTo(0, y); return; }
      const ip = d('[data-inplan]'); if (ip) { ui.inplannen = ip.dataset.inplan; ui.optie = 0; renderVolgorde(); return; }
      if (d('[data-annuleer]')) { ui.inplannen = null; renderVolgorde(); return; }
      const bv = d('[data-bevestig]');
      if (bv) {
        const id = bv.dataset.bevestig, it = analyse().volgorde.find(x => x.id === id), o = it && it.opties[ui.optie || 0];
        if (!o) { toonFouten([{ bron: 'Inplannen ' + id, melding: 'Deze plaatsing is niet meer mogelijk.', herstel: 'Open "Inplannen" opnieuw en kies een andere optie.' }]); ui.inplannen = null; renderVolgorde(); return; }
        M.plan(m, id, o.segmenten); ui.inplannen = null; na(); renderVolgorde();
        toonOk(id + ' ingepast in ' + segTekst(o.segmenten) + (o.waarschuwing ? '. Let op: ' + o.waarschuwing : '') + '. De volgorde is opnieuw berekend.'); return;
      }
      const on = d('[data-ontplan]'); if (on) { M.ontplan(m, on.dataset.ontplan); na(); renderVolgorde(); toonOk(on.dataset.ontplan + ' staat weer bij de nog te plannen assessments.'); }
      return;
    }
    if (ui.tab === 'interventies') {
      if (t.id === 'iv-betreft-knop') { ivVoegBetreftToe(); return; }
      const cw = d('[data-ivchipweg]'); if (cw) { ivLeesForm(); ui.ivForm.betreft.splice(+cw.dataset.ivchipweg, 1); renderInterventies(); return; }
      const bw = d('[data-ivbewerk]');
      if (bw) { const iv = (m.interventies || []).find(x => x.id === bw.dataset.ivbewerk); if (iv) { ui.ivBewerk = iv.id; ui.ivForm = JSON.parse(JSON.stringify(iv)); renderInterventies(); window.scrollTo(0, 0); } return; }
      if (t.id === 'iv-annuleer') { ui.ivBewerk = null; ui.ivForm = null; renderInterventies(); return; }
      if (t.id === 'iv-verwijder') { if (window.confirm('Interventie ' + ui.ivBewerk + ' verwijderen?')) { M.verwijderInterventie(m, ui.ivBewerk); ui.ivBewerk = null; ui.ivForm = null; bewaar(); renderInterventies(); toonOk('Interventie verwijderd.'); } return; }
      if (t.id === 'iv-opslaan') {
        ivLeesForm(); const f = ui.ivForm;
        if ($('#iv-betreft') && $('#iv-betreft').value.trim()) { ivVoegBetreftToe(); return; }
        const fout = [];
        if (!f.datum) fout.push({ bron: 'Interventie', melding: 'Er is geen datum ingevuld.', herstel: 'Vul de datum van het overleg in.' });
        if (!f.wat) fout.push({ bron: 'Interventie', melding: '"Wat is aangepast" is leeg.', herstel: 'Beschrijf kort wat je hebt aangepast of voorgesteld.' });
        if (fout.length) { toonFouten(fout); return; }
        if (ui.ivBewerk) { M.wijzigInterventie(m, ui.ivBewerk, f); toonOk('Interventie ' + ui.ivBewerk + ' aangepast.'); }
        else { const n = M.voegInterventieToe(m, f); toonOk('Interventie ' + n.id + ' vastgelegd.'); }
        ui.ivBewerk = null; ui.ivForm = null; bewaar(); renderInterventies(); return;
      }
      return;
    }
    if (ui.tab === 'matrix') {
      const td = d('#pm td[data-i]');
      const mm = d('[data-mmodus]'); if (mm) { ui.matrixModus = mm.dataset.mmodus; ui.matrixSel = null; renderMatrix(); return; }
      if (td) { const r = matrixAnalyse(); ui.matrixSel = [r.volgorde[+td.dataset.i].id, r.volgorde[+td.dataset.j].id]; document.querySelectorAll('#pm .gekozen').forEach(x => x.classList.remove('gekozen')); td.classList.add('gekozen'); renderMatrixPaneel(r); }
      return;
    }
    if (ui.tab === 'locaties') {
      if (t.id === 'plak-kl-knop') {
        const tekst = $('#plak-kl').value, res = M.plakKlasLocaties(m, tekst), regels = tekst.split(/\r?\n/); na(); renderLocaties();
        $('#plak-kl').value = res.fouten.map(f => regels[f.regel]).join('\n');
        if (res.fouten.length) toonFouten(res.fouten, res.bijgewerkt.length + ' bijgewerkt, ' + res.fouten.length + ' regel(s) niet verwerkt');
        else if (res.bijgewerkt.length) toonOk('Locatie vastgelegd voor ' + res.bijgewerkt.join(', ') + '.');
        return;
      }
      if (t.id === 'loc-voeg') { const f = M.voegLocatieToe(m, $('#loc-naam').value, $('#loc-lok').value); if (f) { toonFouten([f]); return; } na(); renderLocaties(); return; }
      const wl = d('[data-weg-loc]'); if (wl) { if (!confirm('Locatie "' + wl.dataset.wegLoc + '" verwijderen?')) return; M.verwijderLocatie(m, wl.dataset.wegLoc); na(); renderLocaties(); return; }
      return;
    }
    if (ui.tab === 'export') {
      const ad = d('[data-afdrukset]');
      if (ad) { const set = ad.dataset.afdrukset; Object.keys(ui.afdruk).forEach(x => { ui.afdruk[x] = set === 'alles' || (set === 'resultaat' && (x === 'resultaat' || x === 'indeling' || x === 'lokaalBezetting')); }); renderExport(); return; }
      if (t.dataset.afdruk) { ui.afdruk[t.dataset.afdruk] = t.checked; renderExport(); return; }
      if (t.id === 'exp-xlsx') opslaan();
      else if (t.id === 'exp-print') window.print();
    }
  });
  inhoud.addEventListener('change', e => {
    if (e.target.dataset && e.target.dataset.afdrukmatrix !== undefined) { ui.matrixModus = e.target.value; renderExport(); return; }
    const t = e.target;
    if (t.dataset.ass) { const f = M.wijzigAssessment(m, t.dataset.ass, t.dataset.veld, t.value); if (f) { toonFouten([f]); renderAssessments(); return; } na(); if (t.dataset.veld !== 'module') renderAssessments(); return; }
    if (t.dataset.hernoem) { const f = M.hernoemRes(m, ui.soort, t.dataset.hernoem, t.value); if (f) toonFouten([f]); else na(); renderBeschikbaarheid(); return; }
    if (t.dataset.tv) { const f = M.wijzigTijdvak(m, t.dataset.tv, t.dataset.veld, t.value); if (f) { toonFouten([f]); renderTijdvakken(); return; } na(); renderTijdvakken(); return; }
    if (t.dataset.optie !== undefined) { ui.optie = +t.dataset.optie; if (ui.tab === 'volgorde') { const y = window.scrollY; renderVolgorde(); window.scrollTo(0, y); } return; }
    if (t.dataset.klasloc !== undefined) {
      const heeftPlanning = m.assessments.some(a => a.klas === t.dataset.klasloc && a.gepland.length);
      if (heeftPlanning && !confirm('Klas ' + t.dataset.klasloc + ' naar een andere locatie verplaatsen? De planning van haar assessments vervalt dan.')) { render(); return; }
      M.zetKlasLocatie(m, t.dataset.klasloc, t.value); na(); render(); return;
    }
    if (t.dataset.locveld) { const f = M.wijzigLocatie(m, t.dataset.loc, t.dataset.locveld, t.value); if (f) toonFouten([f]); else na(); render(); return; }
    if (t.dataset.loktv) {
      const pos = window.scrollY, id = t.id; M.zetLokalen(m, t.dataset.loc, t.dataset.loktv, t.value); na(); render(); window.scrollTo(0, pos);
      const n = document.getElementById(id); if (n) n.focus(); return;
    }
    if (t.id === 'drempel') { const v = Math.max(0, Math.min(100, parseFloat(t.value) || 0)) / 100; m.instellingen.drempel = v; m.invoerversie++; na(); renderVolgorde(); }
  });
  inhoud.addEventListener('input', e => {
    if (e.target.id === 'iv-zoek') { ui.ivZoek = e.target.value; ivFilter(); return; }
    if (e.target.id === 'besch-zoek') { ui.beschZoek[ui.soort] = e.target.value; beschFilter(); return; }
    if (e.target.id === 'zoek') { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll('#ass-rijen tr').forEach(tr => { tr.style.display = !q || (tr.dataset.zoek || '').includes(q) ? '' : 'none'; }); }
  });
  inhoud.addEventListener('keydown', e => {
    if (e.target.id === 'iv-betreft' && e.key === 'Enter') { e.preventDefault(); ivVoegBetreftToe(); return; }
    if (e.target.id === 'nieuwe-res' && e.key === 'Enter') { e.preventDefault(); $('#voeg-res').click(); }
  });

  render();

})();
