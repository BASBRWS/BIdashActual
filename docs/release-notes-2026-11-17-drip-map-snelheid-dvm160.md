# DVM 160, DRIP uit map: sneller inlezen en alleen nieuwe dagen lezen

Het inlezen van een grote CDMS-map duurde lang. Deze versie pakt dat op twee manieren aan.

- **Sneller lezen.** Er worden nu 16 bestanden tegelijk gelezen in plaats van 6, en de mappen worden met 12 tegelijk doorzocht. Elk bestand gaat via een lichtere leesroute. Bij een nagebootste vertraging van 100 ms per bestand daalde de leestijd voor 4.380 bestanden van 89,8 naar 36,6 seconden, met precies dezelfde uitkomst. Op de echte X-schijf is dit nog niet gemeten; de winst hangt af van de netwerkschijf.
- **Knop "Vanaf laatst geladen datum".** De knop vult de begindatum met de laatst geladen dag van de gekozen regio's. Daarna worden alleen die dag en de dagen erna gelezen, in plaats van steeds het hele jaar. Dubbele meldingen tellen niet dubbel. Een storing die bij de vorige import nog open stond, wordt afgesloten zodra de nieuwe bestanden het herstel bevatten. Is voor een gekozen regio nog niets geladen, dan zegt de dialoog dat.
- **Waar zit de tijd?** De klaarmelding toont nu hoe lang het doorzoeken van de map, het lezen (ook in milliseconden per bestand) en het verwerken duurden. In een meting met 6,5 miljoen gebeurtenissen kostte het verwerken ongeveer 18 seconden, dus bij een lange import zit de tijd vrijwel altijd in het openen van bestanden op de netwerkschijf.
- **Zelfde veiligheidsregel.** De tweede poging en de uitleg bij onleesbare bestanden uit DVM 159 blijven werken. Uit ongelezen bestanden wordt geen herstel afgeleid.

Rekenregels zijn niet gewijzigd.
