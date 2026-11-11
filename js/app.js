/* Assessmentplanner — schermen en bediening. */
(function () {
  'use strict';
  const M = AP.model, R = AP.rekenen;
  const $ = s => document.querySelector(s);
  const inhoud = $('#inhoud');
  let m = M.laadLokaal() || M.leegModel();
  const ui = { tab: 'assessments', soort: 'docent', inplannen: null, keuze: [], matrixSel: null };

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tv = id => m.tijdvakken.find(t => t.id === id) || { id, label: id, uren: 0 };
  const dagVan = t => (t.label.split(/[-\s]/)[0] || '').toLowerCase();
  function bewaar() { if (!M.bewaarLokaal(m)) toonFouten([{ bron: 'Browseropslag', melding: 'De planning kon niet in de browser worden bewaard.', herstel: 'Gebruik "Opslaan" om een bestand te maken.' }]); }
  function na() { bewaar(); renderKop(); }
  const analyse = () => R.analyseer(m);

  /* ---------- meldingen ---------- */
  function lijstMeldingen(fouten) { return '<ul>' + fouten.map(f => '<li><b>' + esc(f.bron) + ':</b> ' + esc(f.melding) + (f.herstel ? ' <b>Herstel:</b> ' + esc(f.herstel) : '') + '</li>').join('') + '</ul>'; }
  function toonFouten(fouten, titel) {
    if (!fouten || !fouten.length) return;
    $('#meldingen').innerHTML = '<div class="melding fout" role="alert"><div><strong>' + esc(titel || (fouten.length === 1 ? 'Er ging iets mis' : fouten.length + ' problemen gevonden')) + '</strong>' + lijstMeldingen(fouten) + '</div><button aria-label="Melding sluiten" data-sluit>×</button></div>';
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
    ({ assessments: renderAssessments, beschikbaarheid: renderBeschikbaarheid, tijdvakken: renderTijdvakken, volgorde: renderVolgorde, matrix: renderMatrix, bezetting: renderBezetting, export: renderExport })[ui.tab]();
  }
  document.querySelector('.tabbalk').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { ui.tab = b.dataset.tab; wisMeldingen(); render(); window.scrollTo(0, 0); } });
  $('#modelnaam').addEventListener('change', e => { m.naam = e.target.value.trim() || 'Naamloze planning'; m.invoerversie++; na(); });

  const heeftInhoud = () => m.assessments.length || m.docenten.length || m.klassen.length;
  function laad(nieuw, tekst) { m = nieuw; ui.inplannen = null; ui.matrixSel = null; bewaar(); ui.tab = 'assessments'; render(); if (tekst) toonOk(tekst); }
  function download(naam, inhoudData, type) {
    const blob = new Blob([inhoudData], { type }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = naam; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }
  const bestandsnaam = ext => (m.naam || 'planning').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_') + '_v' + m.invoerversie + ext;
  function opslaan() { download(bestandsnaam('.json'), JSON.stringify(m, null, 2), 'application/json'); toonOk('Planning opgeslagen als ' + bestandsnaam('.json') + '. Bewaar dit bestand op een beveiligde plek.'); }

  document.querySelector('.bestand').addEventListener('click', e => {
    const b = e.target.closest('[data-actie]'); if (!b) return;
    const a = b.dataset.actie;
    if (a === 'nieuw') { if (heeftInhoud() && !confirm('Een nieuwe, lege planning beginnen? Sla de huidige eerst op als je die wilt bewaren.')) return; laad(M.leegModel(), 'Nieuwe lege planning gestart.'); }
    else if (a === 'voorbeeld') { if (heeftInhoud() && !confirm('Het fictieve voorbeeld laden? De huidige planning wordt vervangen; sla die eerst op als je hem wilt bewaren.')) return; laad(M.normaliseer(JSON.parse(JSON.stringify(AP.voorbeeld))), 'Fictief voorbeeld geladen: 13 assessments, 8 docenten, 6 klassen.'); }
    else if (a === 'openen') $('#bestandkiezer').click();
    else if (a === 'opslaan') opslaan();
  });
  $('#bestandkiezer').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const lezer = new FileReader();
    lezer.onload = () => {
      let d; try { d = JSON.parse(lezer.result); } catch (err) { toonFouten([{ bron: f.name, melding: 'Geen geldige JSON (' + err.message + ').', herstel: 'Open een bestand dat met "Opslaan" is gemaakt.' }]); return; }
      const fouten = M.valideer(d).map(x => Object.assign(x, { bron: x.bron.replace('Modelbestand', f.name) }));
      if (fouten.length) { toonFouten(fouten, 'Planning niet geopend'); return; }
      if (heeftInhoud() && !confirm('De huidige planning vervangen door "' + f.name + '"?')) return;
      laad(M.normaliseer(d), 'Planning geopend: ' + f.name);
    };
    lezer.readAsText(f);
  });

  /* ================= ASSESSMENTS ================= */
  function renderAssessments() {
    const r = analyse(), status = {};
    r.volgorde.forEach(it => { status[it.id] = it.past ? '' : 'past niet'; });
    const rijen = m.assessments.map(a => '<tr data-zoek="' + esc((a.id + ' ' + a.module + ' ' + a.klas + ' ' + a.docenten.join(' ')).toLowerCase()) + '">' +
      '<td class="mono"><b>' + a.id + '</b></td>' +
      '<td><label class="verborgen" for="mo-' + a.id + '">Module ' + a.id + '</label><input id="mo-' + a.id + '" data-ass="' + a.id + '" data-veld="module" value="' + esc(a.module) + '"></td>' +
      '<td><label class="verborgen" for="kl-' + a.id + '">Klas ' + a.id + '</label><input id="kl-' + a.id + '" data-ass="' + a.id + '" data-veld="klas" value="' + esc(a.klas) + '"></td>' +
      '<td><label class="verborgen" for="do-' + a.id + '">Docenten ' + a.id + '</label><input id="do-' + a.id + '" data-ass="' + a.id + '" data-veld="docenten" value="' + esc(a.docenten.join('; ')) + '"></td>' +
      '<td style="width:80px"><label class="verborgen" for="ur-' + a.id + '">Uren ' + a.id + '</label><input id="ur-' + a.id + '" data-ass="' + a.id + '" data-veld="uren" value="' + esc(String(a.uren).replace('.', ',')) + '"></td>' +
      '<td class="klein">' + (a.gepland.length ? '<span class="label-ok">gepland: ' + esc(a.gepland.map(t => tv(t).label).join(', ')) + '</span>' : (status[a.id] ? '<span class="pastniet">past niet</span>' : '')) + '</td>' +
      '<td class="rechts"><button class="knop klein-k gevaar" data-weg="' + a.id + '" aria-label="' + a.id + ' verwijderen">✕</button></td></tr>').join('');
    inhoud.innerHTML =
      '<section class="kolom smal"><div class="paneel"><h2>Assessments plakken</h2>' +
      '<p class="uitleg">Eén assessment per regel, kolommen gescheiden door tabs (zoals bij kopiëren uit Excel):</p>' +
      '<p class="uitleg mono" style="font-size:12px">module ⇥ klas/groep ⇥ docent(en) ⇥ uren</p>' +
      '<p class="klein">Meerdere docenten scheid je met een puntkomma; zij zijn dan <b>tegelijk</b> nodig. Groepen die los van elkaar worden afgenomen zijn aparte regels. Een kopregel wordt overgeslagen. Nieuwe docenten en klassen komen automatisch op het tabblad Beschikbaarheid.</p>' +
      '<label class="veld">Regels<textarea id="plak" rows="9" class="mono" placeholder="Statistiek&#9;1A&#9;Jansen&#9;3&#10;Eindpresentatie&#9;3A&#9;Bakker; Mulder&#9;2"></textarea></label>' +
      '<div class="rij"><button class="knop primair" id="plak-knop">Controleren en toevoegen</button><button class="knop" id="plak-wis">Wissen</button></div></div>' +
      (heeftInhoud() ? '' : '<div class="paneel"><p class="klein">Eerst kijken hoe het werkt? Kies <b>Voorbeeld</b> rechtsboven voor een fictieve assessmentweek.</p></div>') + '</section>' +
      '<section class="paneel breed"><div class="rij tussen"><div><h2>Assessments</h2><span class="klein">' + m.assessments.length + ' assessments · elk is één moment in het rooster</span></div>' +
      '<label class="rij klein">Zoeken <input id="zoek" type="search" placeholder="ID, module, klas of docent"></label></div>' +
      '<div class="tabelkader"><table class="lijst"><thead><tr><th>ID</th><th>Module</th><th>Klas/groep</th><th>Docent(en)</th><th>Uren</th><th>Status</th><th class="rechts"></th></tr></thead><tbody id="ass-rijen">' +
      (rijen || '<tr><td colspan="7" class="klein">Nog geen assessments.</td></tr>') + '</tbody></table></div></section>';
  }

  /* ================= BESCHIKBAARHEID ================= */
  function renderBeschikbaarheid() {
    const soort = ui.soort, lijst = soort === 'docent' ? m.docenten : m.klassen;
    const r = analyse(), bezet = {};
    m.assessments.filter(a => a.gepland.length).forEach(a => {
      const namen = soort === 'docent' ? a.docenten : [a.klas];
      namen.forEach(n => a.gepland.forEach(t => { (bezet[n] = bezet[n] || {})[t] = a.id; }));
    });
    const graad = {}; r.bezetting.filter(b => b.soort === soort).forEach(b => { graad[b.naam] = b; });
    let vorigeDag = null;
    const kop = m.tijdvakken.map(t => { const d = dagVan(t), cls = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d; return '<th' + cls + ' title="' + esc(t.label + ' · ' + R.fmt(t.uren) + ' uur') + '">' + esc(t.label) + '</th>'; }).join('');
    const rijen = lijst.map(res => {
      vorigeDag = null;
      const cellen = m.tijdvakken.map(t => {
        const d = dagVan(t), cls = vorigeDag !== null && d !== vorigeDag ? ' class="dag-scheiding"' : ''; vorigeDag = d;
        const aan = res.beschikbaar.includes(t.id), door = bezet[res.naam] && bezet[res.naam][t.id];
        return '<td' + cls + '><button class="vak' + (door ? ' bezet' : '') + '" data-vak="' + t.id + '" data-naam="' + esc(res.naam) + '" aria-pressed="' + aan + '" aria-label="' + esc(res.naam + ' ' + t.label + (aan ? ' beschikbaar' : ' niet beschikbaar') + (door ? ', bezet door ' + door : '')) + '" title="' + (door ? 'Bezet door ' + door : '') + '">' + (door ? door.replace(/^S0*/, '') : '✓') + '</button></td>';
      }).join('');
      const b = graad[res.naam], aantal = M.gebruikt(m, soort, res.naam).length;
      return '<tr><td class="naam"><label class="verborgen" for="rn-' + esc(res.naam) + '">Naam</label><input id="rn-' + esc(res.naam) + '" data-hernoem="' + esc(res.naam) + '" value="' + esc(res.naam) + '"></td>' + cellen +
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
      '<div class="paneel"><p class="klein">Klik een vakje om beschikbaarheid aan of uit te zetten. Gearceerde vakjes zijn al bezet door een gepland assessment (nummer = assessment). Tijdvakken pas je aan op het tabblad Tijdvakken.</p></div></section>' +
      '<section class="paneel breed"><div class="rij tussen"><div><h2>Beschikbaarheid ' + wie + '</h2><span class="klein">' + lijst.length + ' ' + wie + '</span></div>' +
      '<div class="rij"><label class="verborgen" for="nieuwe-res">Nieuwe naam</label><input id="nieuwe-res" placeholder="Nieuwe ' + (soort === 'docent' ? 'docent' : 'klas/groep') + '"><button class="knop" id="voeg-res">Toevoegen</button></div></div>' +
      '<div class="tabelkader" style="max-height:calc(100vh - 280px);overflow:auto"><table class="rooster"><thead><tr><th class="naam">' + (soort === 'docent' ? 'Docent' : 'Klas/groep') + '</th>' + kop + '<th>Vrij · bezetting</th><th></th></tr></thead><tbody>' +
      (rijen || '<tr><td class="naam klein" colspan="' + (m.tijdvakken.length + 3) + '">Nog geen ' + wie + '. Ze verschijnen automatisch zodra je assessments toevoegt, of plak ze hiernaast.</td></tr>') + '</tbody></table></div></section>';
  }

  /* ================= TIJDVAKKEN ================= */
  function renderTijdvakken() {
    const rijen = m.tijdvakken.map((t, i) => '<tr><td class="num klein">' + (i + 1) + '</td>' +
      '<td><label class="verborgen" for="tl-' + t.id + '">Naam</label><input id="tl-' + t.id + '" data-tv="' + t.id + '" data-veld="label" value="' + esc(t.label) + '"></td>' +
      '<td style="width:100px"><label class="verborgen" for="tu-' + t.id + '">Uren</label><input id="tu-' + t.id + '" data-tv="' + t.id + '" data-veld="uren" value="' + esc(String(t.uren).replace('.', ',')) + '"></td>' +
      '<td class="rechts"><button class="knop klein-k" data-tvop="' + t.id + '" aria-label="Omhoog">↑</button> <button class="knop klein-k" data-tvneer="' + t.id + '" aria-label="Omlaag">↓</button> <button class="knop klein-k gevaar" data-tvweg="' + t.id + '" aria-label="Verwijderen">✕</button></td></tr>').join('');
    const totaal = m.tijdvakken.reduce((s, t) => s + t.uren, 0);
    inhoud.innerHTML =
      '<section class="kolom smal"><div class="paneel"><h2>Tijdvakken</h2><p class="uitleg">De week is verdeeld in tijdvakken. Standaard zijn dat tien dagdelen van 4 uur (ma-o = maandagochtend). Je kunt ze hernoemen, het aantal uren aanpassen, of fijner verdelen, bijvoorbeeld in lesblokken.</p>' +
      '<p class="klein">Tip: begin een naam met de dag (bijvoorbeeld "di 3-4") zodat het beschikbaarheidsrooster per dag een scheidingslijn toont.</p>' +
      '<p class="klein">Een tijdvak verwijderen haalt het ook uit de beschikbaarheid en de planning.</p></div>' +
      '<div class="paneel"><h3>Tijdvak toevoegen</h3><div class="raster2"><label class="veld">Naam<input id="tv-naam" placeholder="bijv. za-o"></label><label class="veld">Uren<input id="tv-uren" value="4"></label></div><button class="knop primair" id="tv-voeg">Toevoegen</button></div></section>' +
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
  function renderVolgorde() {
    if (!m.assessments.length) { inhoud.innerHTML = '<section class="paneel breed leeg-staat">Voeg eerst assessments toe op het tabblad <b>Assessments</b>.</section>'; return; }
    const r = analyse();
    let h = '', vorig = null, eilandTeller = {};
    r.volgorde.forEach(it => { eilandTeller[it.eiland] = (eilandTeller[it.eiland] || 0) + 1; });
    r.volgorde.forEach(it => {
      if (it.eiland !== vorig) {
        h += '<tr class="eilandkop' + (vorig !== null ? ' eilandgrens' : '') + '"><td colspan="11">' + (it.eiland === 'los' ? 'Los / vulling — geen sterke koppelingen; plan in de overgebleven ruimte' : 'Planningseiland ' + it.eiland + ' — ' + eilandTeller[it.eiland] + ' assessments die via drukke docenten of klassen samenhangen') + '</td></tr>';
        vorig = it.eiland;
      }
      h += '<tr><td class="num">' + it.volgnummer + '</td><td class="mono"><b>' + it.id + '</b></td><td>' + esc(it.module) + '</td><td>' + esc(it.klas) + '</td><td>' + esc(it.docenten.join('; ')) + '</td>' +
        '<td class="num">' + R.fmt(it.uren) + '</td><td class="num' + (it.past ? '' : ' pastniet') + '">' + R.fmt(it.overlap) + '</td><td style="white-space:nowrap">' + krapCel(it) + '</td>' +
        '<td class="klein">' + esc(it.knelpunt) + '</td><td class="klein">' + (it.volgtUit ? '<span class="mono">' + it.volgtUit.id + '</span> via ' + esc(it.volgtUit.via.naam) : '—') + '</td>' +
        '<td class="rechts"><button class="knop klein-k" data-inplan="' + it.id + '"' + (it.past ? '' : ' disabled') + '>Inplannen</button></td></tr>';
      if (ui.inplannen === it.id) {
        const gekozen = ui.keuze.reduce((s, t) => s + tv(t).uren, 0);
        h += '<tr class="inplanrij"><td></td><td colspan="10"><div class="kolom" style="gap:8px;padding:6px 0">' +
          '<span class="klein">Kies de tijdvakken waarin <b>' + it.id + '</b> wordt afgenomen. Alleen tijdvakken waarin ' + esc([it.klas].concat(it.docenten).join(', ')) + ' allemaal nog vrij zijn, staan erbij.</span><div>' +
          it.gemeen.map(t => '<label class="tvkeus"><input type="checkbox" data-tvkeus="' + t + '"' + (ui.keuze.includes(t) ? ' checked' : '') + '>' + esc(tv(t).label) + ' <span class="klein">(' + R.fmt(tv(t).uren) + ' u)</span></label>').join('') + '</div>' +
          '<div class="rij"><span class="klein">Gekozen ' + R.fmt(gekozen) + ' van ' + R.fmt(it.uren) + ' uur</span><button class="knop primair" data-bevestig="' + it.id + '"' + (gekozen >= it.uren ? '' : ' disabled') + '>Inplannen bevestigen</button><button class="knop" data-annuleer>Annuleren</button></div></div></td></tr>';
      }
    });
    const gepland = r.gepland.map(g => '<tr><td class="mono"><b>' + g.id + '</b></td><td>' + esc(g.module) + '</td><td>' + esc(g.klas) + '</td><td>' + esc(g.docenten.join('; ')) + '</td><td class="num">' + R.fmt(g.uren) + '</td><td>' + esc(g.gepland.map(t => tv(t).label).join(', ')) + '</td><td class="rechts"><button class="knop klein-k" data-ontplan="' + g.id + '">Terugzetten</button></td></tr>').join('');
    inhoud.innerHTML =
      '<section class="kolom breed">' + meldingenPaneel(r) +
      '<div class="rij tussen"><div class="rij"><span class="maat">Nog te plannen <b>' + r.volgorde.length + '</b></span><span class="maat">Planningseilanden <b>' + r.eilanden + '</b></span><span class="maat">Los / vulling <b>' + r.los + '</b></span><span class="maat">Gepland <b>' + r.gepland.length + '</b></span></div>' +
      '<label class="rij klein">Drempel voor een sterke koppeling <input id="drempel" type="number" min="0" max="100" step="5" value="' + Math.round(m.instellingen.drempel * 100) + '" style="width:80px"> %</label></div>' +
      '<div class="paneel"><h2>Planningsvolgorde</h2><p class="klein">Plan van boven naar beneden. Krapte/prioriteit: hoe hoger, hoe minder speelruimte. "Volgt uit" noemt het eerdere assessment en de gedeelde docent of klas waardoor dit assessment erna komt. Na inplannen rekent de lijst opnieuw met de ruimte die overblijft.</p>' +
      '<div class="tabelkader"><table class="lijst"><thead><tr><th class="num">#</th><th>ID</th><th>Module</th><th>Klas/groep</th><th>Docent(en)</th><th class="num">Uren</th><th class="num">Samen vrij (u)</th><th>Prioriteit</th><th>Knelpunt</th><th>Volgt uit</th><th class="rechts"></th></tr></thead><tbody>' +
      (h || '<tr><td colspan="11" class="klein">Alles is ingepland.</td></tr>') + '</tbody></table></div></div>' +
      (r.gepland.length ? '<div class="paneel"><h2>Al gepland</h2><div class="tabelkader"><table class="lijst"><thead><tr><th>ID</th><th>Module</th><th>Klas/groep</th><th>Docent(en)</th><th class="num">Uren</th><th>Tijdvakken</th><th class="rechts"></th></tr></thead><tbody>' + gepland + '</tbody></table></div></div>' : '') +
      '</section>';
  }

  /* ================= AFHANKELIJKHEDEN ================= */
  function gewichtKlasse(w, drempel) { return w === Infinity || w >= 0.5 ? 'w3' : w >= 0.3 ? 'w2' : w > drempel ? 'w1' : 'w0'; }
  function letter(k) { return k.gedeeld.map(g => g.soort === 'docent' ? 'D' : 'K').filter((x, i, a) => a.indexOf(x) === i).join('+'); }
  function matrixHtml(r, klikbaar) {
    const o = r.volgorde;
    let h = '<table class="dsm met-blok"><thead><tr><th class="blokkop">Eiland</th><th class="hoek">assessment</th>' + o.map(x => '<th scope="col" title="' + esc(x.id + ' ' + x.module + ' · ' + x.klas) + '">' + x.id + '</th>').join('') + '</tr></thead><tbody>';
    let vorig = null;
    o.forEach((x, i) => {
      const grens = vorig !== null && x.eiland !== vorig; vorig = x.eiland;
      h += '<tr' + (grens ? ' class="eilandgrens"' : '') + '><th class="blokcel">' + (x.eiland === 'los' ? 'los' : x.eiland) + '</th><th scope="row" class="naamcel" title="' + esc(x.module + ' · ' + x.klas + ' · ' + x.docenten.join('; ')) + '"><span class="id">' + x.id + '</span>' + esc(x.module) + ' · ' + esc(x.klas) + '</th>';
      o.forEach((y, j) => {
        if (i === j) { h += '<td class="diag"></td>'; return; }
        const k = r.kop(x.id, y.id);
        if (!k) { h += '<td' + (klikbaar ? ' data-i="' + i + '" data-j="' + j + '"' : '') + '></td>'; return; }
        const cls = gewichtKlasse(k.gewicht, r.drempel);
        h += '<td class="' + cls + '"' + (klikbaar ? ' data-i="' + i + '" data-j="' + j + '"' : '') + ' title="' + esc(k.gedeeld.map(g => (g.soort === 'docent' ? 'docent ' : 'klas ') + g.naam + ' ' + R.fmtGraad(g.graad)).join(', ')) + '">' + (cls === 'w0' ? '·' : letter(k)) + '</td>';
      });
      h += '</tr>';
    });
    return h + '</tbody></table>';
  }
  function legendaMatrix(r) {
    return '<div class="legenda"><span><span class="chip" style="background:#EF9F27"></span>Gedeelde docent/klas ≥ 50% bezet</span><span><span class="chip" style="background:#FAC775"></span>30–50%</span><span><span class="chip" style="background:#FAEEDA"></span>' + Math.round(r.drempel * 100) + '–30%</span><span>· zwak (telt niet voor eilanden)</span><span>D = via docent · K = via klas</span><span>Dikke lijn = grens planningseiland</span></div>';
  }
  function renderMatrix() {
    if (!m.assessments.length) { inhoud.innerHTML = '<section class="paneel breed leeg-staat">Voeg eerst assessments toe.</section>'; return; }
    const r = analyse();
    inhoud.innerHTML = '<section class="paneel breed"><h2>Afhankelijkheden tussen nog te plannen assessments</h2>' +
      '<p class="klein">Rijen en kolommen staan in planningsvolgorde. Een gevulde cel betekent: deze twee assessments delen een docent (D) of klas (K) en beperken dus elkaars ruimte. De kleur toont hoe druk die gedeelde docent of klas is.</p>' + legendaMatrix(r) +
      '<div class="matrixkader" id="pm">' + matrixHtml(r, true) + '</div></section>' +
      '<aside class="kolom smal"><div class="paneel" id="mpaneel"></div></aside>';
    renderMatrixPaneel(r);
  }
  function renderMatrixPaneel(r) {
    const p = $('#mpaneel'); if (!p) return;
    if (!ui.matrixSel) { p.innerHTML = '<h2>Koppeling</h2><p class="uitleg">Klik een cel in de matrix om te zien wat twee assessments delen.</p>'; return; }
    const [x, y] = ui.matrixSel.map(id => r.volgorde.find(v => v.id === id));
    if (!x || !y) { ui.matrixSel = null; return renderMatrixPaneel(r); }
    const k = r.kop(x.id, y.id);
    p.innerHTML = '<div class="rij tussen"><h2>Koppeling</h2><span class="celkop">' + x.id + ' · ' + y.id + '</span></div>' +
      '<dl class="gegevens"><dt>' + x.id + '</dt><dd>' + esc(x.module + ' · ' + x.klas + ' · ' + x.docenten.join('; ')) + '</dd><dt>' + y.id + '</dt><dd>' + esc(y.module + ' · ' + y.klas + ' · ' + y.docenten.join('; ')) + '</dd>' +
      (k ? k.gedeeld.map(g => '<dt>Gedeeld</dt><dd>' + (g.soort === 'docent' ? 'docent ' : 'klas ') + '<b>' + esc(g.naam) + '</b> · bezetting ' + R.fmtGraad(g.graad) + '</dd>').join('') +
        '<dt>Telt voor eiland</dt><dd>' + (k.gewicht > r.drempel ? 'ja (boven ' + Math.round(r.drempel * 100) + '%)' : 'nee, zwakke koppeling') + '</dd>' : '<dt>Gedeeld</dt><dd>niets: deze twee beïnvloeden elkaar niet</dd>') + '</dl>';
  }

  /* ================= BEZETTING ================= */
  function renderBezetting() {
    const r = analyse();
    const rij = b => '<tr><td>' + (b.soort === 'docent' ? 'Docent' : 'Klas/groep') + '</td><td><b>' + esc(b.naam) + '</b></td><td class="num">' + b.aantal + '</td><td class="num">' + R.fmt(b.nodig) + '</td><td class="num">' + R.fmt(b.beschikbaar) + '</td>' +
      '<td style="white-space:nowrap">' + (b.graad === Infinity ? '<span class="pastniet">geen ruimte</span>' : '<span class="krapbalk" style="width:' + Math.max(2, Math.min(100, Math.round(b.graad * 100))) + 'px;background:' + (b.graad > 1 ? '#A32D2D' : '#BA7517') + '"></span>' + R.fmtGraad(b.graad)) + '</td></tr>';
    inhoud.innerHTML = '<section class="paneel breed"><h2>Bezetting docenten en klassen</h2><p class="klein">Nodig = uren van nog niet geplande assessments. Vrij = beschikbare uren min wat al gepland is. Hoe hoger de bezetting, hoe eerder de assessments van deze docent of klas aan de beurt zijn.</p>' +
      '<div class="tabelkader"><table class="lijst"><thead><tr><th>Soort</th><th>Naam</th><th class="num">Assessments</th><th class="num">Nodig (u)</th><th class="num">Vrij (u)</th><th>Bezetting</th></tr></thead><tbody>' +
      (r.bezetting.map(rij).join('') || '<tr><td colspan="6" class="klein">Nog geen docenten of klassen.</td></tr>') + '</tbody></table></div></section>';
  }

  /* ================= EXPORT ================= */
  function renderExport() {
    if (!m.assessments.length) { inhoud.innerHTML = '<section class="paneel breed leeg-staat">Voeg eerst assessments toe.</section>'; return; }
    const r = analyse(), datum = new Date().toLocaleString('nl-NL');
    let vorig = null;
    const rijen = r.volgorde.map(it => { const g = vorig !== null && it.eiland !== vorig; vorig = it.eiland;
      return '<tr' + (g ? ' class="eilandgrens"' : '') + '><td class="num">' + it.volgnummer + '</td><td class="mono"><b>' + it.id + '</b></td><td>' + esc(it.module) + '</td><td>' + esc(it.klas) + '</td><td>' + esc(it.docenten.join('; ')) + '</td><td class="num">' + R.fmt(it.uren) + '</td><td class="num">' + R.fmt(it.overlap) + '</td><td>' + (it.prio === Infinity ? 'geen ruimte' : R.fmtKrapte(it.prio)) + '</td><td>' + esc(it.knelpunt) + '</td><td>' + (it.eiland === 'los' ? 'los' : it.eiland) + '</td><td>' + (it.volgtUit ? it.volgtUit.id + ' via ' + esc(it.volgtUit.via.naam) : '') + '</td><td style="min-width:90px"></td></tr>'; }).join('');
    inhoud.innerHTML =
      '<section class="paneel breed geen-afdruk"><div class="rij tussen"><div><h2>Export &amp; afdrukken</h2><p class="klein">De export bevat de planningsvolgorde, de afhankelijkhedenmatrix, alle koppelingen en de bezetting. Sla bestanden met echte namen alleen op in een beveiligde omgeving.</p></div>' +
      '<div class="rij"><button class="knop primair" id="exp-xlsx">Excel (.xlsx)</button><button class="knop" id="exp-print">Afdrukken / PDF</button><button class="knop" id="exp-json">Planning opslaan (.json)</button></div></div>' + (r.fouten.length ? meldingenPaneel(r) : '') + '</section>' +
      '<section class="paneel breed afdruk"><div><h2>Planningsvolgorde — ' + esc(m.naam) + '</h2><div class="bron">Invoerversie ' + m.invoerversie + ' · drempel eilanden ' + Math.round(r.drempel * 100) + '% · ' + datum + (r.gepland.length ? ' · ' + r.gepland.length + ' assessment(s) al gepland en niet in deze lijst' : '') + '</div></div>' +
      '<div class="tabelkader"><table class="lijst"><thead><tr><th class="num">#</th><th>ID</th><th>Module</th><th>Klas/groep</th><th>Docent(en)</th><th class="num">Uren</th><th class="num">Samen vrij</th><th>Prioriteit</th><th>Knelpunt</th><th>Eiland</th><th>Volgt uit</th><th>Gepland op</th></tr></thead><tbody>' + rijen + '</tbody></table></div>' +
      '<div class="pagina-breuk"><h2>Afhankelijkheden</h2><div class="bron">Zelfde volgorde als hierboven. D = gedeelde docent, K = gedeelde klas; kleur = bezetting van die docent/klas.</div></div>' + legendaMatrix(r) +
      '<div class="matrixkader">' + matrixHtml(r, false) + '</div></section>';
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
      if (t.id === 'voeg-res') { const n = $('#nieuwe-res').value.trim(); if (!n) return; if (M.vindRes(m, ui.soort, n)) { toonFouten([{ bron: 'Beschikbaarheid', melding: '"' + n + '" bestaat al.', herstel: 'Kies een andere naam.' }]); return; } (ui.soort === 'docent' ? m.docenten : m.klassen).push({ naam: n, beschikbaar: [] }); m.invoerversie++; na(); renderBeschikbaarheid(); return; }
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
      if (t.id === 'tv-voeg') { const naam = $('#tv-naam').value.trim(), u = parseFloat($('#tv-uren').value.replace(',', '.')); if (!naam) { toonFouten([{ bron: 'Tijdvakken', melding: 'Geen naam ingevuld.', herstel: 'Vul een naam in, bijvoorbeeld za-o.' }]); return; } if (!(u > 0)) { toonFouten([{ bron: 'Tijdvakken', melding: 'Uren moet een positief getal zijn.', herstel: 'Vul bijvoorbeeld 4 in.' }]); return; } M.voegTijdvakToe(m, naam, u); na(); renderTijdvakken(); }
      return;
    }
    if (ui.tab === 'volgorde') {
      const ip = d('[data-inplan]'); if (ip) { ui.inplannen = ip.dataset.inplan; ui.keuze = []; renderVolgorde(); return; }
      if (d('[data-annuleer]')) { ui.inplannen = null; renderVolgorde(); return; }
      const bv = d('[data-bevestig]');
      if (bv) { const id = bv.dataset.bevestig; M.plan(m, id, ui.keuze); ui.inplannen = null; na(); renderVolgorde(); toonOk(id + ' ingepland in ' + ui.keuze.map(x => tv(x).label).join(', ') + '. De volgorde is opnieuw berekend.'); return; }
      const on = d('[data-ontplan]'); if (on) { M.ontplan(m, on.dataset.ontplan); na(); renderVolgorde(); toonOk(on.dataset.ontplan + ' staat weer bij de nog te plannen assessments.'); }
      return;
    }
    if (ui.tab === 'matrix') {
      const td = d('#pm td[data-i]');
      if (td) { const r = analyse(); ui.matrixSel = [r.volgorde[+td.dataset.i].id, r.volgorde[+td.dataset.j].id]; document.querySelectorAll('#pm .gekozen').forEach(x => x.classList.remove('gekozen')); td.classList.add('gekozen'); renderMatrixPaneel(r); }
      return;
    }
    if (ui.tab === 'export') {
      if (t.id === 'exp-xlsx') {
        const r = analyse(), data = AP.xlsx.maak(AP.export.bladen(m, r));
        download(bestandsnaam('.xlsx'), data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        toonOk('Excel-bestand gemaakt: ' + bestandsnaam('.xlsx') + '. Bewaar het op een beveiligde plek.');
      } else if (t.id === 'exp-print') window.print();
      else if (t.id === 'exp-json') opslaan();
    }
  });
  inhoud.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.ass) { const f = M.wijzigAssessment(m, t.dataset.ass, t.dataset.veld, t.value); if (f) { toonFouten([f]); renderAssessments(); return; } na(); if (t.dataset.veld !== 'module') renderAssessments(); return; }
    if (t.dataset.hernoem) { const f = M.hernoemRes(m, ui.soort, t.dataset.hernoem, t.value); if (f) toonFouten([f]); else na(); renderBeschikbaarheid(); return; }
    if (t.dataset.tv) { const f = M.wijzigTijdvak(m, t.dataset.tv, t.dataset.veld, t.value); if (f) { toonFouten([f]); renderTijdvakken(); return; } na(); renderTijdvakken(); return; }
    if (t.dataset.tvkeus) { const id = t.dataset.tvkeus; ui.keuze = t.checked ? ui.keuze.concat(id) : ui.keuze.filter(x => x !== id); renderVolgorde(); return; }
    if (t.id === 'drempel') { const v = Math.max(0, Math.min(100, parseFloat(t.value) || 0)) / 100; m.instellingen.drempel = v; m.invoerversie++; na(); renderVolgorde(); }
  });
  inhoud.addEventListener('input', e => {
    if (e.target.id === 'zoek') { const q = e.target.value.trim().toLowerCase(); document.querySelectorAll('#ass-rijen tr').forEach(tr => { tr.style.display = !q || (tr.dataset.zoek || '').includes(q) ? '' : 'none'; }); }
  });
  inhoud.addEventListener('keydown', e => {
    if (e.target.id === 'nieuwe-res' && e.key === 'Enter') { e.preventDefault(); $('#voeg-res').click(); }
  });

  render();
  if (!heeftInhoud()) toonOk('Welkom. Plak je assessments, of kies "Voorbeeld" rechtsboven voor een fictieve assessmentweek.');
})();
