# DVM 159, DRIP uit map: tweede poging en een duidelijke reden bij leesfouten

Bij een grote CDMS-map kon de melding "9104 DRIP-bestanden niet leesbaar" verschijnen, zonder te zeggen waarom.

- **Tweede poging.** Bestanden die bij de eerste, parallelle ronde niet te lezen zijn, worden daarna één voor één opnieuw gelezen. Een netwerkschijf weigert soms veel gelijktijdige leesacties. De eindmelding noemt hoeveel bestanden pas bij de tweede poging zijn gelezen.
- **Reden per soort fout.** Blijven bestanden onleesbaar, dan noemt de melding per oorzaak het aantal, het datumbereik en drie voorbeeldpaden:
  - niet lokaal beschikbaar of vergrendeld (vaak OneDrive/SharePoint "alleen online", of een bestand dat CDMS nog schrijft);
  - verdwenen tijdens het lezen;
  - geen leestoestemming meer;
  - te traag.
  
  Bij bestanden die niet lokaal beschikbaar zijn staat de tip erbij om de map op "Altijd op dit apparaat bewaren" te zetten of naar een lokale schijf te kopiëren. De volledige lijst staat in het storingslog.
- **Zelfde veiligheidsregel als voorheen.** Uit ongelezen bestanden wordt geen herstel afgeleid. Blijft een bestand onleesbaar, dan blijft de vorige stand behouden.

De leesfunctie geeft de foutnaam van de browser nu ook door aan de MTM-import. Rekenregels zijn niet gewijzigd.
