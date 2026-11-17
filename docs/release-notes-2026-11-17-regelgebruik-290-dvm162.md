# BIdashActual 2.90 / DVM 162, zichtbaar welke regels worden gebruikt

Op **Impactregels** en **Organisatieregels** staat nu een * achter een regel die BIdashActual niet of slechts beperkt gebruikt.

- **Rode \*: niet gebruikt.** Een wijziging van deze regel verandert de dagstand niet. Voorbeelden: LOC_004 (camera met incidentzicht) en LOC_006, de levensduur, β en MTTR per assettype, het actief-vinkje bij assettypen, het DRIP-functiegewicht, `assets.hw_mttr` en `atw.max_werkdagen_consecutief`.
- **Oranje \*: beperkt gebruikt.** De regel staat alleen in tekst, een label of een filter, of heeft standaard geen effect. Voorbeelden: de ernst van een foutcode, foutcode 6005 (wisselbord), de kolommen Communicatie en Dyn. strook, het prijspeil en de ATW-parameters die alleen in de signaaltekst staan.
- **Geen \*: werkt door** in een getoonde berekening of signaal.
- **Reden.** Beweeg over een * voor de reden. Bovenaan beide schermen staat de uitklapbare kaart **Gebruik van deze regels** met alle afwijkende regels, de reden en de bron in de code. Die kaart toont ook regels die niet op het scherm staan, zoals het tijdvenster van combiregels, de vaste dienstgewichten en de geïmporteerde config.html-parameters die nergens worden gelezen.

De markeringen komen uit één register, `site/core/regelgebruik.js`. `tests/regelgebruik.test.js` faalt wanneer een nieuwe standaardregel niet in het register staat, wanneer een als ongelezen gemarkeerde BI-parameter toch wordt gelezen, of wanneer de code achter een niet-gebruikt-status verandert. Zo blijft het overzicht bij.

Rekenregels, defaults, imports en exports zijn niet gewijzigd. De schilversie is 2.90 en de DVM-engineversie 162.
