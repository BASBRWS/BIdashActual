# BIdashActual 2.86, ingepakt opslaan als .json.gz

JSON-exports uit Data & export worden standaard ingepakt opgeslagen als `.json.gz`. De inhoud blijft precies dezelfde JSON. Het bestand is ongeveer tien keer kleiner; een synthetische demoback-up gaat van 6,2 MB naar 0,6 MB.

- Het vinkje **Ingepakt opslaan als .json.gz** staat standaard aan. Zet het uit voor gewone JSON. De browser onthoudt je keuze.
- De keuze geldt voor de integrale back-up, de DVM-totaal-JSON, de BI Dash JSON en de kopie in de gekoppelde map.
- Laden herkent zelf of een bestand ingepakt is, ook via **Laad laatste stand**. Gewone `.json` en oude back-ups blijven werken.
- Een beschadigd of niet volledig gedownload `.json.gz` wordt geweigerd vóór er iets wordt vervangen.
- De statusregel toont na de export de ingepakte en de onverpakte grootte.
- Planning-XML en de Primavera-exports (XML en XER) blijven onverpakt.

Nog niet omgezet: de losse planningpagina, de losse MTM-importer en de eigen knoppen in DVM-bronbeheer. Die gebruiken voorlopig gewone JSON. Rekenregels, formaten en de opslag in de browser zijn niet gewijzigd.
