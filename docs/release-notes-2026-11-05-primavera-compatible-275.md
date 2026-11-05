# BIdashActual 2.75, scenario-XML voor Primavera

## Scenario-XML voor Primavera, versie 2.75

De exportknop werkt nu ook bij een Microsoft Project-bron. Exporteer XML voor Primavera maakt een Microsoft Project XML-bestand met de volledige actuele scenarioverschuivingen. Kies in P6 Bestand, Importeren, Microsoft Project en de passende XML-variant. Dit is het Microsoft Project-importformaat van P6; het bestand is geen native P6 APIBusinessObjects XML. Bij een oorspronkelijke P6-bron blijft de bestaande native P6-export beschikbaar.

De oorspronkelijke WBS, taak-ID’s, bronrelaties, kalenders en resources blijven behouden. Ingeklapte of gefilterde taken worden ook verwerkt. Taak- en toewijzingsdatums volgen het scenario; bestaande samenvattingsdatums en projectgrenzen worden waar volledig onderbouwd bijgewerkt. Werkelijke datums en baselines blijven historische bronwaarden. Laat P6 na import de planning en kalenders herberekenen. Een import in een echte P6-omgeving is nog niet getest.

De exportmelding benoemt afgeleide CIV-relaties. Die zijn rekenaannamen en worden niet automatisch als nieuwe bronrelaties weggeschreven. De oorspronkelijke XML-export blijft daarnaast beschikbaar, zonder scenarioverschuivingen.

DVM blijft 151. Zowel de aparte planningpagina als het volledige dashboard gebruikt de nieuwe scenario-export.

Validatie: 653 unittests geslaagd. De nieuwe MSPDI-exportbrowsercontrole vergelijkt de volledige XML-structuur en attributen en test onder andere bronrelaties, datums, resources, samenvattingen, baselines/actuals, namespaces en herimport. De planning-only browsercontrole test de echte scenario-download in beide ingangen. De bestaande native P6-exportcontrole slaagt. 77 JavaScriptbestanden en het inline planningscript syntactisch gecontroleerd.
