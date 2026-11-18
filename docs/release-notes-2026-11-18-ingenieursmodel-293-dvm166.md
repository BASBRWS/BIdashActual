# 2.93 / DVM 166, rekenmethode ingenieursbureau op de huidige storingsstand

De rekenmethode uit het dashboard van het ingenieursbureau (A12 · Regio ↔ VWM Impact) zit nu in BiDash. Je vindt hem bij Formatie & contracten, Formatie & functies, onder **Operationele gevolgen van de huidige storingsstand**.

- **Huidige stand in plaats van bezuiniging.** Het bronmodel rekent vanuit een onderhoudsreductie. BiDash past dezelfde keten toe op de open storingen per verkeerscentrale.
- **Afhankelijkheid van signaalgevers.** Een signaalgever in storing telt zwaarder of lichter, afhankelijk van waar hij staat: rijbaanbreed, weefvak of opvolgend 1,7; laatste portaal voor een splitsing 1,35; **voor een afrit 1,25**; voor een toerit 1,0. BiDash kent de plek per storing al. Je kunt de gewichten zelf aanpassen.
- **Per VC zie je:**
  - de gewogen beschikbaarheid van de signaalgevers;
  - de detectietijd, de gemiste incidenten en de aanrijtijd van de weginspectie;
  - het risico op doorrijden van een kruis;
  - de extra inzet van bediening en weginspectie;
  - de extra inspecteursuren, botsabsorbers, DRIP-wagens en IM-teams;
  - de operationele kosten.
- **Formatie.** Kies bij de operationele formatie de rekenmethode Ingenieursbureau. Wegverkeersleiders en coördinerend wegverkeersleiders volgen dan de extra inzet van de bediening. De officier van dienst en de weginspecteurs volgen de blootstelling van de weginspectie. Per rol kun je die koppeling wijzigen.

Controle: BiDash geeft met de voorbeelddata van het ingenieursbureau dezelfde uitkomsten als hun eigen berekening. Voertuigverliesuren blijven uit het eigen verkeerskostenmodel komen. De vertaling naar FTE is een keuze van BiDash; laat die bevestigen voordat je er besluiten op baseert.
