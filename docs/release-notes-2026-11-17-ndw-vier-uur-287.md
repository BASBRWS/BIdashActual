# BIdashActual 2.87, openbare NDW-kopie elke vier uur

De geplande workflow ververst alleen de openbare NDW-kopie (meetlocaties, snelheden en intensiteiten). Hij draaide elke vijf minuten, ongeveer 288 keer per dag. Dat is nu elke vier uur: zes keer per dag.

- Het schema is `17 */4 * * *` in UTC. Dat is rond 01:17, 05:17, 09:17, 13:17, 17:17 en 21:17 in Nederlandse wintertijd en een uur later in de zomertijd. GitHub kan geplande runs vertragen.
- **Haal laatste NDW op** accepteert een openbare kopie tot vijf uur oud, in plaats van dertig minuten. Daardoor blijft de knop tussen twee verversingen werken. De meettijd en de ouderdom blijven zichtbaar.
- Een vers opgehaalde NDW-publicatie moet nog steeds hooguit dertig minuten oud zijn. Een bewaarde vorige kopie mag tot vijf uur oud zijn.
- Een publicatie na een samenvoeging naar `main` haalt NDW zoals voorheen meteen opnieuw op.

Gevolg: de verkeerskosten rekenen met een meting van hooguit ongeveer vier uur oud, in plaats van enkele minuten. Wil je een verse meting, laad dan zelf de NDW-bestanden of voer de workflow handmatig uit via GitHub Actions, Run workflow.
