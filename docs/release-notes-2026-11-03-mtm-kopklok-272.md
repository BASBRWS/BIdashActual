# BIdashActual 2.72 / DVM 150, MTM-kopklok met tijdswaarschuwing

Een alarmstart na de eigen dumpkop op dezelfde bestandsdag blokkeerde de volledige regio-import, zowel in de losse importer als in BIdashActual. De gedeelde parser bewaart deze meldingen nu als onzeker en toont een tijdswaarschuwing. Alle bronregels en oorspronkelijke tijden blijven behouden. Het watermerk blijft de kopdatum, er wordt geen nieuw bronmoment verzonnen.

Een tijdsafwijkend blok levert geen herstelbewijs. Eerder ontbrekende meldingen blijven onzeker open en de lopende afwezigheidsklok wordt gewist. Bij een volgende foutvrije dump begint de 48-uurswachttijd opnieuw. Aanwezige meldingen worden dan bevestigd onder dezelfde incidentidentiteit. Bronwaarschuwing en toestand gaan mee in compacte export en import. Het technische storingslog vermeldt bronkop, aantal alarmen na de kop en het grootste tijdverschil.

Kapotte regels, verkeerde kalenderdagen, ontbrekende koppen en conflicterende gelijke bronmomenten blijven importfouten. De opgeslagen stand wordt dan niet vervangen. Impact- en kostenformules veranderen niet.

Controles omvatten gedeelde parser, 17 minuten verschil, behoud van beide bronklokken, alle meldingen, andere VC, geen sluiting op de oude 48-uursgrens, herstart na een correcte dump, meerdere blokken, herhaling en compacte overdracht. Browsercontrole gebruikt beide echte importschermen met synthetische brondata en aanvullend het lokaal aangeleverde bestand. Er worden geen operationele bronregels gecommit. De oorzaak van de afwijkende klok in het genererende systeem is niet uit dit bestand vast te stellen.
