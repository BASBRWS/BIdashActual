# DVM 161, NDW-werkzaamheden met één knop

Op de kaart Werkzaamheden staat nu de knop **Haal NDW werkzaamheden op**. Die laadt de NDW-planningsfeed wegwerkzaamheden en evenementen. Dat bestand staat bij NDW Open Data op dezelfde plek als trafficspeed.

- **Openbare kopie.** De browser mag het bestand niet rechtstreeks bij NDW ophalen. Daarom haalt GitHub het elke vier uur op, samen met de NDW-verkeersdata. De site bewaart de kopie met een vingerafdruk. De knop controleert die vingerafdruk en weigert een kopie die ouder is dan 26 uur. De geladen werkzaamheden blijven dan staan.
- **Eigen bestand.** Heb je `planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz` zelf gedownload? Laad het dan via Werkzaamheden laden. Excel en CSV blijven werken zoals voorheen.
- **Alleen het hoofdwegennet.** De feed bevat ruim 14.000 situaties, vooral van gemeenten en provincies. BiDash houdt alleen werkzaamheden van Rijkswaterstaat over, en werk op wegen die in All Assets voorkomen. Evenementen zonder werkzaamheden vallen weg. In de feed van vandaag waren dat ongeveer 1.470 werken.
- **Weg en hectometers.** Veel RWS-meldingen noemen geen wegnummer. BiDash leidt dat af uit de assets van All Assets die langs het werkvak staan. Assets binnen 2 km worden gekoppeld, net als bij het werkzaamhedenbestand. De omleidingsroute telt niet als werkvak.
- **Wat je ziet.** Per werk zie je de periode, de hinderklasse en de verwachte vertraging, de afsluiting (bijvoorbeeld rijbaan dicht), de omleiding en de planningsstatus (definitief, in uitvoering, gepubliceerd).

De feed is ongeveer 200 MB als tekst. BiDash leest hem in stukken en is in ongeveer 5 seconden klaar. De rijrichting staat niet in de feed en blijft daarom leeg. Rekenregels zijn niet gewijzigd.
