# BIdashActual 2.74, aparte planningpagina

## Alleen de planning, versie 2.74

Open `planning/` vanaf de website, of klik rechtsboven op Alleen planning. Deze pagina heeft een eigen werkruimte met de tijdlijn, project/budget en dashboards. Laad een planning-XML of jouw integrale back-up met de planning. Alleen het planningdeel wordt overgenomen. De pagina laadt geen storingen of assetregister.

De laatst opgeslagen planning wordt bij terugkeer hersteld. Volledige back-up bewaart de bron-XML met verschuivingen en planningsinstellingen voor overdracht. Een los triggerbestand laad je apart. De opslag staat los van het volledige dashboard; wijzigingen worden niet automatisch tussen beide ingangen gedeeld.

Bij MS Project XML is de P6-export uitgeschakeld en staat de reden bij de knop. Oorspronkelijke planning-XML downloadt de geladen bron zonder jouw scenarioverschuivingen. Gebruik de volledige back-up om die verschuivingen mee te nemen. Met een P6-bron blijft de bestaande P6-scenario-export beschikbaar. Deze pagina converteert MS Project XML niet naar P6 XML.

DVM blijft 151. Alleen de planninginterface, bronlaadroute en standalone opslag veranderen; dienstimpact en storingsimport veranderen niet.

Validatie: 651 unittests geslaagd. De nieuwe planning-only browsercontrole slaagt voor bronformaten, exportknoppen, bron-XML, scenario-back-up, geïsoleerde opslag, herladen, ongeldige bron, integrale deelimport en mobiel. De bestaande Primavera-export-, planningperformance- en formatietests slagen. 76 JavaScriptbestanden en het inline planningscript zijn syntactisch gecontroleerd. Echte P6-import/herberekening is niet getest.
