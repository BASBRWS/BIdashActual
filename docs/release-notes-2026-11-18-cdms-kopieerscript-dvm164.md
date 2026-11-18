# DVM 164, kopieerscript voor de CDMS-logmappen

Het lezen van de DRIP-logs van de X-schijf duurt lang, omdat elk bestand apart over het netwerk moet. In de DRIP-dialoog staat nu de link **Download het kopieerscript**.

- **Wat het is.** Een klein Windows-bestand (`bidash-cdms-kopie.cmd`) dat je dubbelklikt. Het gebruikt robocopy, het kopieerprogramma dat in Windows zit.
- **Wat het doet.** Het kopieert de mappen `cdms\<regio>\log` van `X:\cdms` naar `C:\BiDash\cdms`. De eerste keer gaat alles van de laatste 400 dagen mee. Daarna alleen de nieuwe bestanden, en dat duurt meestal maar even.
- **Veilig.** Het script verwijdert nooit iets, niet op de X-schijf en niet lokaal.
- **Daarna.** Kies in BiDash bij DRIP uit map lezen de map `C:\BiDash`, met de knop Vanaf laatst geladen datum. Van je eigen schijf leest BiDash veel sneller.
- **Ander pad.** Staat de cdms-map ergens anders, dan vraagt het script erom. Je kunt het pad ook in het bestand aanpassen met Kladblok (de regels `BRON`, `DOEL` en `DAGEN` bovenaan).

Edge of Windows kan bij het downloaden of openen waarschuwen, omdat het een script is. Kies dan Behouden en Toch uitvoeren. Rekenregels zijn niet gewijzigd.
