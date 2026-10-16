# BIdashActual 2.64 / DVM 143, 16 oktober 2026

De 48 uur begint nu bij de eerste afwezigheid van een unieke melding. In 2.63 vergeleek de importer alleen de nieuwste en een oudere dump, gerekend vanaf de laatste aanwezigheid. Daardoor kon herstel te vroeg worden afgeleid en kon een terugkeer op een tussendag worden gemist.

Alle kleine openstaande dumps en alle blokken binnen een bestand worden nu op volgorde verwerkt, van de eerste tot en met de laatste gekozen importdag. Dag 1 aanwezig, dag 2 afwezig, dag 3 nog afwezig betekent nog open in de wachttijd. Pas dag 4, na 48 werkelijke uren vanaf de eerste afwezigheid, volgt afgeleid herstel. Terugkeer bewaart de incidentidentiteit en wist de timer; een nieuwe verdwijning begint opnieuw. Een ontbrekende brondag herstart de termijn bij de eerstvolgende afwezigheidswaarneming.

Meldingen in de wachttijd blijven in de actuele stand met onzeker herstel en in historie. Timers gaan mee in opslag en JSON; vervolgen na herladen of overdracht geeft dezelfde stand als één doorlopende import. Het exacte herstelmoment blijft onbekend. Het herstelvenster loopt van de laatste aanwezigheid tot de eerste afwezigheid, met de latere bevestigende dump apart vastgelegd. Een import stopt bij zijn laatste bronmoment.

De gedeelde verwerking houdt één brondag tegelijk in geheugen, naast incidentstand en historie. Grote BSS-logs worden niet gelezen. De oude importmethode blijft selecteerbaar. Fouten of annuleren bewaren de vorige stand; oudere import vervangt geen nieuwere gegevens. Andere VC's, camera-/DRIP-bronnen en bestaande impact-/kostenformules blijven behouden.

Importeer de volledige relevante dagreeks opnieuw om een in 2.63 te vroeg afgeleid herstel te corrigeren. Een oude JSON bevat niet de destijds overgeslagen tussendagen en kan dat bewijs niet zelf reconstrueren.

Validatie: unitcontroles voor dagelijkse reeksen, tussentijdse terugkeer, opnieuw verdwijnen, werkelijk 48 uur inclusief zomer-/wintertijd, daggaten, herimport, JSON-hervatten, identiteiten, bronfouten en annuleren. De browsercontrole doorloopt de echte mapdialoog, alle tussendagen/blokken, actuele/onzekere meldingen, overdracht, behoud van andere bronnen en standalone-opslag met herladen en vervolgen. Alle 568 unittests slagen, waaronder 27 controles voor deze dumpmethode. De nieuwe dumpbrowsercontrole en de bestaande map-, BSS- en importerbrowsertests slagen. Geen volledige meerjarige netwerkshare of mobiele hardware als prestatietest doorlopen. Operationele bronbestanden en afgeleide tellingen worden niet gepubliceerd.
