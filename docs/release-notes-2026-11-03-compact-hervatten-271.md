# BIdashActual 2.71 / DVM 149, compacte export en hervatten

Totaalbestanden bewaren storingsregels verliesloos met gedeelde teksten, kolomschema’s en verwijzingen. Een regel die in historie en open storingen staat, wordt niet nogmaals volledig opgeslagen. Verschillen blijven behouden. Oude light-historie krijgt bij export geen extra afgeleide levenscyclusvelden. Alle andere geselecteerde gegevens blijven meegaan. Er wordt geen historie verwijderd.

Een integrale back-up kan later worden ingeladen, waarna de mapimport vanaf het opgeslagen bronmoment per verkeerscentrale verdergaat. Incidentidentiteiten, brondekking en lopende 48-uurswachttijden blijven behouden. Oude bestandsdagen worden inhoudelijk overgeslagen; de laatste dag wordt gecontroleerd op nieuwe dumpblokken. De gebruiker kiest de map opnieuw. Volledige historische herverwerking blijft beschikbaar door hervatten uit te vinken. Dit wist de bestaande basis niet.

Bewuste totaalimport herstelt ook grote registers volledig vanuit Bronbeheer. De beveiliging tegen automatische zware herbouw bij opstart blijft bestaan. Compacte downloads vereisen deze versie of nieuwer; oude JSON blijft leesbaar.

Deze release bevat ook de wijzigingen uit 2.70 / DVM 148 voor herkenbare Dienstimpact-berekeningen, gelijke VC-dienstbanden en uitgebreide regiofocus. Impact, kosten en 48-uursherstel gebruiken hun bestaande rekenregels.

Validatie omvat verliesloze roundtrip, integrale en gedeeltelijke import, nul/null, ongeldige compacte bestanden vóór vervanging, oude light-historie, nieuwe en terugkerende incidenten, andere VC’s, brononderbrekingen en hervatten zonder oude bestandsinhoud opnieuw te lezen. Browsercontrole gebruikt echte downloads, een schone werkruimte en een synthetisch register boven de automatische herstelgrens. De groottewinst hangt af van de gegevens; assetregister en NDW blijven in hun bestaande formaat.
