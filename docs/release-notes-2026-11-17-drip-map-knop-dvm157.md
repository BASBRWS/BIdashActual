# DVM 157, DRIP uit map lezen werkt weer

- **Map kiezen en verwerken deed niets.** De knop in de dialoog "DRIP-storingen uit map lezen (CDMS)" las een instelling die alleen in de MTM-dialoog bestaat. Dat gaf een stille fout, waardoor er geen mapkiezer verscheen. De knop opent nu weer de mapkiezer. Een onverwachte fout staat voortaan zichtbaar in de dialoog.
- **Eén incident telde dubbel in de eindmelding.** Een storing en de bijbehorende episode verschilden alleen in classificatie (bijvoorbeeld LANGDURIG tegenover STORING). Binnen de mapbron telden ze daardoor als twee. In de DRIP-historie en de berekeningen telde het incident al één keer; nu klopt ook de melding "… unieke incidenten uit deze mapbron".

Het inlezen zelf is gecontroleerd met een synthetische mapboom, via de moderne mapkiezer en via de terugvalroute. BiDash leest alleen `cdms/<vc>/log/<jaar>/<maand>/<dag>` voor de gekozen regio's en periode, bouwt episodes uit de URGENT/OK- en UIT/AAN-regels, en koppelt incidenten aan de DRIP-assets uit All Assets. Dat gebeurt op de CDMS-code tussen haakjes in de assetnaam, bijvoorbeeld `(DBD80)`, en anders op weg, richting en hectometer. Rekenregels zijn niet gewijzigd.
