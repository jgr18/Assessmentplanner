# Assessmentplanner

Webtool die laat zien **in welke volgorde je assessments het best kunt inplannen**: eerst wat het krapst zit, daarna wat daaraan vastzit, en de losse assessments als vulling. De tool is gebaseerd op een afgeleide Design Structure Matrix (DSM). Hij draait volledig in de browser: er is geen server, database of account nodig, en er worden geen gegevens verstuurd.

## Mogelijkheden

**Invoer**
- **Assessments** plakken uit Excel, één per regel: `module ⇥ klas/groep ⇥ docent(en) ⇥ uren ⇥ locatie` (locatie optioneel).
  - Meerdere docenten scheid je met een puntkomma. Zij zijn dan **tegelijk** nodig.
  - Groepen die los van elkaar worden afgenomen, zijn aparte regels.
  - Elk assessment krijgt een vaste ID (S001, S002, …). Een verwijderde ID wordt niet opnieuw uitgegeven.
- **Beschikbaarheid** van docenten en van klassen of groepen in een raster per tijdvak.
  - Klik een vakje aan of uit, of plak het raster uit Excel: `naam ⇥ x ⇥ ⇥ x …`. Een kopregel met de tijdvaknamen wordt herkend.
  - Nieuwe docenten en klassen uit de assessmentlijst verschijnen automatisch in het raster.
- **Locaties**: elke klas zit vast aan één locatie, waar haar assessments worden afgenomen. Standaard zijn er drie locaties: Enschede (5 lokalen per dagdeel), Deventer (3) en Apeldoorn (1). Het aantal lokalen pas je per locatie en per dagdeel aan. De locatie van een klas volgt uit de eerste letter van de klasnaam (A, D of E). Wijkt een klas af, dan kies je de locatie op het tabblad Locaties, via plakken (`klas ⇥ locatie`) of via de vijfde kolom bij de assessments.
- **Tijdvakken**: standaard tien dagdelen (ma-o … vr-m) van 6 lesuren, met vrijdagmiddag 5 lesuren: samen 59 lesuren per week. Je kunt ze hernoemen, het aantal uren aanpassen, ze aanvullen of fijner verdelen. Met "Standaarduren toepassen" zet je een eerder gemaakte planning op deze uren, zonder dat beschikbaarheid of planning verloren gaat.

**Analyse**
- **Capaciteit in uren**: elk dagdeel heeft een aantal lesuren. Een docent of klas kan in één dagdeel meerdere assessments na elkaar hebben, en een lokaal ook. Drie assessments van 2 uur passen dus in één lokaal van 6 lesuren. De tool past assessments in lokalen in, zonder exacte lesuren vast te leggen.
- **Doorlopen over dagdelen**: een assessment kan doorlopen over aaneengesloten dagdelen van dezelfde dag. Een assessment van 12 uur vult bijvoorbeeld de ochtend en de middag; een van 3 uur kan 2 uur aan het eind van de ochtend en 1 uur aan het begin van de middag beslaan.
- **Eén locatie per dag**: een docent hoort op één dag op één locatie te zijn. Een plaatsing die dat breekt kan wel, maar krijgt een waarschuwing en komt achteraan in de keuzelijst.
- **Lokalen tellen niet mee in krapte, prioriteit en afhankelijkheden**: lokalen kun je bijvragen, dus ze zijn minder beperkend dan de beschikbaarheid van docenten en klassen. Een tekort aan lokalen zie je op het tabblad Lokalen; bij het inpassen zoekt de tool wel een vrij lokaal.
- **Krapte** per assessment: benodigde uren gedeeld door de uren waarin de klas en alle docenten tegelijk vrij zijn.
- **Bezetting** per docent en klas: uren die nog nodig zijn gedeeld door de uren die nog vrij zijn. Per locatie staat ter informatie ook de bezetting in lokaaluren (lokalen × lesuren).
- **Prioriteit**: de hoogste van de krapte en de bezetting van de betrokken docenten en klas. Het knelpunt wordt erbij genoemd.
- **Koppelingen**: twee assessments die een docent (D) of klas (K) delen, beperken elkaars ruimte. Het gewicht is de bezetting van wat ze delen.
- **Planningseilanden**: groepen assessments die via koppelingen boven de drempel samenhangen. De drempel is instelbaar en staat standaard op 20%. Assessments zonder sterke koppeling zijn **los / vulling**.
- **Planningsvolgorde**: de eilanden staan op hoogste prioriteit.
  - Binnen een eiland komt eerst het krapste assessment, en daarna steeds het assessment dat het sterkst vastzit aan wat al in de lijst staat.
  - "Volgt uit" noemt het eerdere assessment en de gedeelde docent of klas.
  - Bij gelijkstand beslist de eigen krapte en daarna de laagste ID.
- **Inplannen**: de tool toont per assessment de mogelijke plaatsingen (dagdeel, of doorlopend, met een lokaal). De beste staan bovenaan: zonder locatiewissel, in één dagdeel, en een lokaal zo vol mogelijk gemaakt. Na het kiezen zijn die uren bezet voor de docenten, de klas en het lokaal, en wordt de volgorde opnieuw berekend. Met "Terugzetten" maak je dat ongedaan.
- **Lokalen**: per locatie en dagdeel het aantal lokalen en de verwachte druk. Waar meer nodig is dan er is, staat een advies (+n extra lokalen), en je past het aantal daar direct aan. Assessments waarvoor geen lokaal vrij is, worden apart gemeld, met de dagdelen waarin klas en docenten wél kunnen. Daaronder staat de lokaalindeling van wat al is ingepland.
- **Afhankelijkheden**: de matrix in planningsvolgorde.
  - D betekent een gedeelde docent, K een gedeelde klas.
  - De kleur toont hoe druk die docent of klas is.
  - Klik een cel voor de details.
- **Meldingen** noemen de bron en een herstelactie, bijvoorbeeld een klas zonder locatie, geen lokaal vrij, of een docent op twee locaties op één dag. Andere voorbeelden:
  - een docent of klas zonder ingevulde beschikbaarheid;
  - een assessment waarbij klas en docenten nooit lang genoeg tegelijk kunnen;
  - een docent of klas met meer benodigde dan beschikbare uren.

Krapte en volgorde zijn een vuistregel ("krapste eerst"), geen garantie dat het rooster daarna sluit. De lokaaldruk per dagdeel is een schatting. Reistijd tussen locaties en exacte lesuren zitten nog niet in deze versie.

**Uitvoer** (in het werkbestand)
- Tabbladen in Excel:
  - *Planningsvolgorde*, met een kolom om de gekozen planning in te vullen;
  - *Afhankelijkheden*, de matrix met kleuren;
  - *Koppelingen*, alle gedeelde docenten en klassen met percentages;
  - *Bezetting bij invoer* (alsof er nog niets gepland is) en *Bezetting na planning*, beide inclusief locaties;
  - *Lokalen per dagdeel*, met druk en advies voor extra lokalen;
  - *Lokaalindeling* van wat is ingepast;
  - *Beschikbaarheid docenten* en *Beschikbaarheid klassen*.
- **Afdrukken / PDF**: dezelfde onderdelen op A4 liggend.

## Starten, openen en opslaan

- **Starten**: open een Excel-bestand met **Excel openen**. Dat kan het **invoersjabloon** zijn of een eerder opgeslagen **werkbestand**; de app herkent zelf welk van de twee. Een leeg sjabloon download je met de knop **Sjabloon**. In de map `voorbeelden` staan een leeg sjabloon, een ingevuld voorbeeld en een voorbeeldwerkbestand.
- **Invoersjabloon**: de tabbladen Toelichting en Instellingen staan vooraan, daarna de vier invoertabbladen:
  1. **Assessments**: Module · Klas/groep · Docent(en) gescheiden door `;` · Uren. Een ID vul je niet in: de app geeft elk assessment zelf een vaste ID, die in de uitvoer en het werkbestand staat.
  2. **Locaties**: kolommen zijn de dagdelen. De rij *Lesuren per dagdeel* geeft de lengte van elk dagdeel; daaronder per locatie het aantal lokalen per dagdeel waar de app in eerste instantie van uitgaat.
  3. **Docenten**: per dagdeel een **+** als de docent beschikbaar is (de cel wordt groen); leeg = niet beschikbaar.
  4. **Klassen**: per klas/groep per dagdeel een **+** als de klas beschikbaar is. De locatie volgt uit de eerste letter van de klas: **A** = Apeldoorn, **D** = Deventer, **E** = Enschede (bijv. E1A, D2B). In het werkbestand staat de locatie ter controle in een extra kolom; daar mag je hem ook overschrijven.
  Wie niet op het tabblad Docenten of Klassen staat, of een helemaal lege regel heeft, is in alle dagdelen beschikbaar. Kies de + uit het keuzelijstje of typ hem; een x mag ook.
- **Opslaan als Excel** maakt een **werkbestand**: dezelfde invoertabbladen (zo kun je ze in Excel bijwerken en weer openen), het tabblad **Planning** met wat al is ingepast, de **Instellingen**, en alle uitvoer van de analyse. Bij openen leest de app de invoer, de planning en de instellingen en rekent de uitvoer opnieuw uit.
- **Matrix aanwijzen**: met de muis op een S-code (bovenrij) of een assessment (kolom 2) licht die kolom of rij op; op een D, K of DK lichten beide rijen op, met de cel en de gespiegelde cel omkaderd.
- **Kleuren van de tabbladen**: grijs = toelichting en instellingen, blauw = invoer, groen = planning (Planning, Planningsvolgorde, Lokaalindeling), oranje = signaleringen (afhankelijkheden, koppelingen, bezetting, lokalen per dagdeel, beschikbaarheid). De tabbladen staan in die volgorde.
- **Meldingen bij openen** noemen het tabblad, de rij of de cel en een herstelactie. Wat wel klopt, wordt gewoon ingelezen.
- **Tussendoor** bewaart de browser je werk automatisch (localStorage), alleen op die ene computer.

## Privacy

- De tool zelf bevat geen gegevens. Je planning staat alleen in je browser en in de Excel-bestanden die je zelf opslaat.
- Bewaar werkbestanden met echte namen in een beveiligde omgeving, en **zet ze niet in de GitHub-repository**.
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
| `js/xlsxlezen.js` | Excel-lezer (zonder externe bibliotheek) |
| `js/excelio.js` | Opbouw van invoersjabloon en werkbestand |
| `js/exceliolezen.js` | Invoersjabloon of werkbestand inlezen, met meldingen |
| `js/export.js` | Inhoud van de Excel-export |
| `js/app.js` | Schermen en bediening |
| `js/controle.js` | Definitie van de controlevoorbeelden |
| `js/voorbeeld.js` | Fictief voorbeeld (knop Voorbeeld) |
| `voorbeelden/` | Leeg sjabloon, ingevuld voorbeeldsjabloon en voorbeeldwerkbestand |
