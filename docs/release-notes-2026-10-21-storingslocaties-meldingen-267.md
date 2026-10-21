# BIdashActual 2.67 / DVM 145, storingslocaties en meldingen

De KPI Open storingen telde technische meldingen, terwijl de gebruiker dit vergeleek met unieke storingslocaties uit een MTM-import. Meerdere rijstroken, detectoren en foutcodes op één locatie telden afzonderlijk, evenals onzeker behouden meldingen.

Assetmanagement toont nu afzonderlijk storingslocaties, technische meldingen en MSI-storingslocaties. Een uitsplitsing per type en verkeerscentrale verklaart aanwezige, verdwenen en onbekende meldingen. Open storingen en de memo gebruiken dezelfde locatietelling binnen de gekozen filters. Bronzijde en hectoletter blijven beschikbaar zodat rijbanen en zijbanen geen gedeelde locatie krijgen. Het lokale storingslog bewaart uitsluitend de geaggregeerde telling.

Dit is een correctie van de presentatie en teldefinitie. De import, afzonderlijke incidenten, 48-uurswachttijd, historie, impact en kosten veranderen niet. Het concrete nieuwe operationele importbestand met de gemelde tellingen is niet aangeleverd; de oorzaak van elk van die bronregels is daardoor niet individueel vastgesteld.

Validatie: synthetische combinatie van 1.387 meldingen en 72 locaties; afzonderlijke richtingen, hectoletters, onvolledige locaties, nul-HMP, MSI/detectie, onzekerheid, bronbehoud en bestaande tests voor de MTM-dagreeks. Browsertest controleert de echte import, beide schermen, filtering, memo, storingslog en herimport.
