# DVM 153, assetconfiguratie loopt niet meer vast

Bij een groot register liep de browser vast bij **Koppel aan dit asset** of **Locatie opslaan en herberekenen** in de assetconfiguratie. Elke actie rekende alle meldingen opnieuw tegen alle assets van hetzelfde type op dezelfde weg door, en dat twee keer per actie. Met 20.000 assets en 15.000 meldingen bleef de pagina ongeveer 115 seconden onbruikbaar.

- Koppelen bekijkt per melding alleen assets binnen de HM-tolerantie, plus assets zonder bruikbare HM en assets met een handmatige locatiecorrectie. Er kan ook nooit een asset buiten dat venster passen. Koppelingen, suggesties en redenen blijven exact gelijk; een test vergelijkt dat met de volledige scan.
- Het omzetten van een storingsregel zoekt kolomnamen via één opzoektabel per rij, in plaats van per veld alle kolommen af te lopen.
- Veelgebruikte tekstnormalisaties (weg, VC, richting, assettekst) en het eenheidsnummer uit de meldingstekst worden onthouden.
- De knoppen tonen eerst "… herberekenen. Bij een groot register kan dit enkele seconden duren…". Ze zijn uitgeschakeld en de cursor toont dat BiDash bezig is. Daarna verschijnt het resultaat.

Gemeten met synthetische data in een headless browser:

| Register | Actie | Voor | Na |
|---|---|---|---|
| 20.000 assets, 15.000 meldingen | koppelen | ~115 s | ~8 s |
| 60.000 assets, 40.000 meldingen | koppelen | niet afgewacht | ~10 s |
| 60.000 assets, 40.000 meldingen | locatie wijzigen | niet afgewacht | ~14 s |

Op een werklaptop kan dit anders uitvallen. De resterende tijd zit vooral in het opnieuw tekenen van alle DVM-tabbladen en in de leeftijdsverwerking van het register. Die stappen zijn niet gewijzigd.

Rekenregels, koppelregels, opgeslagen assetconfiguratie en exportformaten zijn niet gewijzigd.
