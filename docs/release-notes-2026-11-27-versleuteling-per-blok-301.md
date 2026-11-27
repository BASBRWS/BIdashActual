# 3.01, Grote bestanden laden met versleuteling

Een groot DVM-bestand laden stopte sinds 2.99 bij **Werkruimte lokaal opslaan** met de melding "Invalid string length". De import werd niet opgeslagen; je vorige werkruimte bleef staan.

- **Oorzaak.** De versleuteling uit 2.99 zette de hele werkruimte eerst om in één tekst. Bij een groot bestand werd die tekst langer dan de browser toestaat.
- **Oplossing.** De werkruimte wordt nu eerst in blokken van hooguit 4 MB verdeeld, zoals vóór 2.99, en daarna wordt elk blok apart versleuteld. De beveiliging blijft gelijk: AES-256 met de sleutel achter je wachtwoord.
- **Bestaande werkruimtes** die met 2.99 of 3.00 zijn opgeslagen, blijven gewoon leesbaar. Bij de eerstvolgende opslag krijgen ze de nieuwe indeling.
- **Wat je moet doen:** laad het bestand opnieuw.

Controles:
- Nieuw: `tests/toegang-grote-werkruimte-browser.cjs` met een synthetische werkruimte van 560 miljoen tekens. De oude route geeft "Invalid string length". De nieuwe route slaat 1.096 blokken op, allemaal versleuteld, en leest alles terug. Een werkruimte in het oude versleutelde formaat blijft leesbaar.
- `npm test` en `tests/toegang-browser.cjs` geslaagd. In `tests/storage-browser.cjs` slaagt het deel over grote werkruimtes; de controle daarna, via de NDW-module, faalde al vóór deze wijziging en is niet aangepast.
