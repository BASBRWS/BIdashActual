# BIdashActual 2.88 / DVM 155, nieuw overzichtsdashboard

Het Overzicht is een dashboard geworden. Elk getal komt uit de geladen bronnen; ontbreekt een bron, dan staat er Onbekend en geen nul.

- **Vier KPI-kaarten**, aanklikbaar:
  - Open storingen, met het verloop van nieuwe storingen per volledige dag;
  - Diensten aantoonbaar binnen norm;
  - Verkeerskosten per brondag;
  - Planning en formatie.
- **Van uitval tot uitvoerbaarheid** in vier stappen. Uitval toont het deel van de open storingen dat aan een asset gekoppeld is. Gevolgen toont de bekende brondekking. Uitvoerbaarheid toont planning en formatie. Actie toont de signalen. Klik op een stap om te verdiepen.
- **Nieuwe storingen per dag** over 14, 30 of 90 dagen, met een tooltip via muis of pijltoetsen en een tabelweergave. De reeks eindigt op de bronpeildatum. De laatste dag loopt tot het peilmoment en is daarom gestippeld. Storingen zonder startmoment worden genoemd, niet getoond.
- **Open storingen per assettype** en **per verkeerscentrale** als meterlijst, met bevestigd open en onzeker of verouderd apart.
- **Dienstverlening** toont per dienst een balk tegen de norm. De volle balk is bewezen beschikbaar, de lichte band is onzeker door brondekking, een streep is de norm. Per dienst staat het oordeel binnen norm, onder norm of onzeker.

Een dienst telt pas als binnen de norm als ook de ondergrens van de band de norm haalt. Het verloop is een telling van startmomenten in de geladen historie en open meldingen; het is geen prognose. De DVM-samenvatting levert hiervoor een nieuw veld `verloop` (DVM 155). Rekenregels zijn niet gewijzigd.
