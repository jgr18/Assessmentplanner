# Assessmentplanner

Webtool die laat zien **in welke volgorde je assessments het best kunt inplannen**: eerst wat het krapst zit, daarna wat daaraan vastzit, en de losse assessments als vulling. De tool is gebaseerd op een afgeleide Design Structure Matrix (DSM). Hij draait volledig in de browser: er is geen server, database of account nodig, en er worden geen gegevens verstuurd.

## Mogelijkheden

**Invoer**
- **Assessments** plakken uit Excel, één per regel: `module ⇥ klas/groep ⇥ docent(en) ⇥ uren`.
  - Meerdere docenten scheid je met een puntkomma. Zij zijn dan **tegelijk** nodig.
  - Groepen die los van elkaar worden afgenomen, zijn aparte regels.
  - Elk assessment krijgt een vaste ID (S001, S002, …). Een verwijderde ID wordt niet opnieuw uitgegeven.
- **Beschikbaarheid** van docenten en van klassen of groepen in een raster per tijdvak.
  - Klik een vakje aan of uit, of plak het raster uit Excel: `naam ⇥ x ⇥ ⇥ x …`. Een kopregel met de tijdvaknamen wordt herkend.
  - Nieuwe docenten en klassen uit de assessmentlijst verschijnen automatisch in het raster.
- **Tijdvakken**: standaard tien dagdelen van 4 uur (ma-o … vr-m). Je kunt ze hernoemen, het aantal uren aanpassen, ze aanvullen of fijner verdelen.

**Analyse**
- **Krapte** per assessment: benodigde uren gedeeld door de uren waarin de klas én alle docenten tegelijk beschikbaar zijn.
- **Bezetting** per docent en per klas: uren die nog nodig zijn gedeeld door de uren die nog vrij zijn.
- **Prioriteit**: de hoogste van de krapte en de bezetting van de betrokken docenten en klas. Het knelpunt wordt erbij genoemd.
- **Koppelingen**: twee assessments die een docent of klas delen, beperken elkaars ruimte. Het gewicht is de bezetting van die gedeelde docent of klas.
- **Planningseilanden**: groepen assessments die via koppelingen boven de drempel samenhangen. De drempel is instelbaar en staat standaard op 20%. Assessments zonder sterke koppeling zijn **los / vulling**.
- **Planningsvolgorde**: de eilanden staan op hoogste prioriteit.
  - Binnen een eiland komt eerst het krapste assessment, en daarna steeds het assessment dat het sterkst vastzit aan wat al in de lijst staat.
  - "Volgt uit" noemt het eerdere assessment en de gedeelde docent of klas.
  - Bij gelijkstand beslist de eigen krapte en daarna de laagste ID.
- **Inplannen**: kies bij een assessment de tijdvakken waarin het wordt afgenomen. Die tijdvakken zijn daarna bezet voor die docenten en klas, en de volgorde wordt opnieuw berekend. Met "Terugzetten" maak je dat ongedaan.
- **Afhankelijkheden**: de matrix in planningsvolgorde.
  - D betekent een gedeelde docent, K een gedeelde klas.
  - De kleur toont hoe druk die docent of klas is.
  - Klik een cel voor de details.
- **Meldingen** noemen de bron en een herstelactie, bijvoorbeeld:
  - een docent of klas zonder ingevulde beschikbaarheid;
  - een assessment waarbij klas en docenten nooit lang genoeg tegelijk kunnen;
  - een docent of klas met meer benodigde dan beschikbare uren.

Krapte en volgorde zijn een vuistregel ("krapste eerst"), geen garantie dat het rooster daarna sluit. Locaties en reistijd zitten nog niet in deze versie.

**Uitvoer**
- **Excel (.xlsx)** met vier tabbladen:
  - *Planningsvolgorde*, met een kolom om de gekozen planning in te vullen;
  - *Afhankelijkheden*, de matrix met kleuren;
  - *Koppelingen*, alle gedeelde docenten en klassen met percentages;
  - *Bezetting*.
- **Afdrukken / PDF**: de planningsvolgorde en de matrix op A4 liggend.
- **Planning opslaan (.json)**: het complete invoerbestand. Met **Openen** laad je het weer in.

## Opslag en privacy

- De tool zelf bevat geen gegevens. Je planning staat alleen in je browser (localStorage) op die ene computer, en in de bestanden die je zelf opslaat.
- Bewaar `.json`- en `.xlsx`-bestanden met echte namen in een beveiligde omgeving, en **zet ze niet in de GitHub-repository**.
- Op een gedeelde computer: begin met **Nieuw** als je klaar bent, zodat de planning uit de browser verdwijnt.

## Installatie

### Online via GitHub Pages
1. Maak op github.com een nieuwe repository aan, bijvoorbeeld `assessmentplanner`, met zichtbaarheid **Public**.
2. Kies **uploading an existing file** en sleep alle bestanden en mappen uit deze map erin (niet de map zelf). Klik op **Commit changes**.
3. Ga naar **Settings → Pages**. Kies bij *Source* voor **Deploy from a branch**, met branch **main** en map **/ (root)**, en klik op **Save**.
4. Na een à twee minuten staat de tool op `https://<jouw-gebruikersnaam>.github.io/assessmentplanner/`.

### Lokaal
Pak de map uit en dubbelklik op `index.html`. De tool werkt in een recente versie van Chrome, Edge, Firefox of Safari, ook zonder internet.

## Bestanden

| Bestand | Inhoud |
|---|---|
| `index.html` | De planner |
| `controle.html` | Controlevoorbeelden van de rekenkern |
| `css/style.css` | Opmaak |
| `js/model.js` | Gegevensmodel, plakken, ID's, validatie en opslag |
| `js/rekenen.js` | Krapte, bezetting, koppelingen, eilanden en volgorde |
| `js/xlsx.js` | Excel-schrijver (zonder externe bibliotheek) |
| `js/export.js` | Inhoud van de Excel-export |
| `js/app.js` | Schermen en bediening |
| `js/controle.js` | Definitie van de controlevoorbeelden |
| `js/voorbeeld.js`, `voorbeelden/voorbeeldplanning.json` | Fictief voorbeeld |
