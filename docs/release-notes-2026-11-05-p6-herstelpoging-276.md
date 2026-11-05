# BIdashActual 2.76, aparte P6 herstelpoging

## P6 herstelpoging, versie 2.76

Bij een Microsoft Project-bron staat naast de gewone export een aparte knop `P6 herstelpoging, zonder gebruikersvelden`. Deze alternatieve scenario-XML laat alle MSP-gebruikersvelddefinities en -waarden weg. De oorspronkelijke XML, opgeslagen bron en gewone scenario-export behouden die velden. Het herstelbestand eindigt op `-p6-herstel.xml`.

De herstelpoging maakt een bestaande externe taakmarkering lokaal voor activiteiten die daadwerkelijk in het planningmodel aanwezig zijn, en voor hun aanwezige samenvattingsgroepen. Een plat deelproject met lokale onderliggende taken wordt een gewone WBS-groep. Externe verwijzingen zonder gemodelleerde taak blijven staan. Bronrelaties worden niet herschreven. Ingesloten deelproject-XML en een geselecteerd deelproject zonder lokale onderliggende taken stoppen de herstelpoging; er wordt geen onvolledige samenvoeging verzonnen.

De export toont aantallen aanwezige planningactiviteiten, bronrelaties, weggelaten velddefinities/waarden en aangepaste markeringen. Iedere MSP-scenario-export controleert na serialisatie leesbare XML, alle oorspronkelijke taak-UID’s en aantallen bronrelaties en planningactiviteiten. Dit bewijst geen acceptatie door P6. Het totale aantal oorspronkelijke taken kan hoger zijn dan het aantal activiteiten doordat ook samenvattingen en verwijzingen behouden blijven.

Deze poging richt zich op de aanname dat P6 taken als externe projectverwijzingen behandelt, naast de gemelde gebruikersveldproblemen. De werkelijke gebruikers-XML is niet beschikbaar en de oorzaak van de ene geïmporteerde activiteit is niet bewezen. Importeer het herstelbestand in P6 via Microsoft Project XML als nieuw testproject. Vergelijk aantallen activiteiten, WBS, datums en relaties met de bron vóór gebruik. Er is geen native MSP-naar-P6-converter toegevoegd en import in P6 Professional 21 is niet getest.

DVM blijft 151. De knop staat in dezelfde planningengine van de aparte planningpagina en het volledige dashboard. De oorspronkelijke download en gewone scenario-export blijven beschikbaar.

Validatie: 653 unittests geslaagd. De MSP-, planning-only- en oorspronkelijke native-P6-browsertests slagen. De controles omvatten synthetische 702 activiteiten met 701 bronrelaties, externe markeringen, weglaten van gebruikersvelden, behoud van niet-gemodelleerde externe verwijzingen, scenario- en nulverschuivingen en blokkeren van onvolledige deelprojecten. De browsercontrole downloadt het herstelbestand via de echte knop. Deze controles vervangen geen import in P6.
