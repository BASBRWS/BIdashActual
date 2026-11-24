# 2.99 / DVM 172, Inloggen met versleuteling en bijgewerkte Excel-lezer

Deze versie lost de meest kritieke technische bevindingen uit de toetsing aan beheer- en juridische kaders op, zonder functies te veranderen.

- **Inloggen.** Bij het eerste openen stel je een wachtwoord in (minstens 12 tekens). Daarna vraagt het dashboard bij elk bezoek om dat wachtwoord. Dat geldt ook voor de losse planningpagina en de signaalgever-importer. De demo heeft geen wachtwoord, want die gebruikt alleen verzonnen gegevens.
- **Versleuteling.** Het wachtwoord is geen los slot. Je gegevens in de browser worden versleuteld met AES-256. De sleutel is alleen met je wachtwoord te openen (PBKDF2-SHA-256, 600.000 rondes). Wie de computer of de broncode heeft maar het wachtwoord niet, kan de gegevens niet lezen. Een bestaande, onversleutelde werkruimte wordt bij de eerste opslag versleuteld.
- **Geen onversleutelde kopieën meer.** De BI- en planningsmodules bewaarden een eigen kopie in de browseropslag (localStorage). Met een wachtwoord blijft die kopie alleen in het geheugen. Een oude kopie wordt verwijderd. Bij het openen worden de gegevens zoals voorheen hersteld uit de versleutelde werkruimte.
- **Vergrendelen.** Met **🔒 Vergrendelen** bovenin, of automatisch na 30 minuten zonder activiteit, worden openstaande wijzigingen eerst opgeslagen. Daarna is het wachtwoord weer nodig.
- **Wachtwoord wijzigen** kan op de pagina **Data laden**, onder Toegang en versleuteling. Je gegevens hoeven daarvoor niet opnieuw versleuteld te worden.
- **Wachtwoord vergeten.** De gegevens zijn dan niet terug te halen. Na het typen van WISSEN wordt de werkruimte in deze browser gewist. Bewaar daarom regelmatig een export op een beveiligde schijf. **Exportbestanden zijn niet versleuteld.**
- **Excel-lezer.** SheetJS is bijgewerkt van 0.18.5 naar 0.20.3. Daarmee zijn CVE-2023-30533 (prototype pollution) en CVE-2024-22363 (ReDoS) verholpen. Het is de officiële build van cdn.sheetjs.com, met licentie Apache-2.0.

Controles:
- `tests/toegang.test.js`: wachtwoordregels, instellen, ontgrendelen, fout wachtwoord, wijzigen, grote waarden in delen, behoud van Date- en binaire waarden, en een geweigerde opslag als de werkruimte vergrendeld is.
- `tests/toegang-browser.cjs` met het echte inlogscherm: in IndexedDB staat geen leesbare tekst, een oude localStorage-kopie wordt verwijderd, vergrendelen, fout en goed wachtwoord, wijzigen, de planningpagina en wissen.
- De overige browsertests gebruiken `tests/helpers/playwright-met-toegang.cjs`. Die levert een testwachtwoord, zodat ze op versleutelde opslag draaien.
