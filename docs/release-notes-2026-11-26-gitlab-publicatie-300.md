# 3.00, Publicatie via GitLab

BiDash wordt vanaf deze versie ontwikkeld en gepubliceerd vanuit GitLab (`basb_dd-group/BIdashActual`) in plaats van GitHub. De werking van het dashboard verandert niet.

- **Publicatie.** De nieuwe pipeline `.gitlab-ci.yml` doet wat de GitHub-workflow deed: `npm test`, een syntaxiscontrole van alle JavaScript, de openbare NDW-kopie en de NDW-werkzaamheden ophalen en daarna `site/` publiceren op GitLab Pages. De GitHub-workflow `.github/workflows/pages.yml` is verwijderd.
- **Controle bij een merge request.** Een merge request draait dezelfde tests, maar publiceert niets.
- **Verversing elke vier uur.** In GitLab staat het schema niet in het bestand. Je stelt het één keer in bij Build > Pipeline schedules: `17 */4 * * *`, tijdzone UTC, doelbranch `main`. Zonder schema wordt de NDW-kopie alleen bij een publicatie of een handmatige pipeline ververst.
- **Nieuw adres.** De site staat op het adres dat GitLab toont bij Deploy > Pages. Zet bij Settings > General > Visibility de Pages-toegang op Everyone als de site openbaar moet zijn. Anders zien alleen projectleden haar, en kan de pipeline de vorige NDW-kopie niet als terugval gebruiken.
- **Je gegevens verhuizen niet vanzelf.** De browser bewaart de werkruimte per websiteadres. Op het nieuwe adres begin je met een lege werkruimte en stel je opnieuw een wachtwoord in. Maak op de oude GitHub-site eerst een totaalexport en laad die op de nieuwe site. Koppel daarna de storingsmap opnieuw.
- **De oude GitHub-site** blijft staan op de laatste publicatie en wordt niet meer ververst. Zet GitHub Pages uit als je klaar bent met overzetten.
- **Geen GitHub meer in het project.** Ook de startinstructies (`STARTEN.txt`, `INTEGRATIE.txt`), de tekst over opslag op de pagina Data laden, commentaar in de code en de testvoorbeelden verwijzen nu naar GitLab. Alleen oudere release notes noemen GitHub nog, omdat ze beschrijven hoe het toen was.

Controles:
- `npm test`, met `tests/ndw-public-cache.test.js`: de pipeline haalt beide NDW-feeds op met `$CI_PAGES_URL` als vorige kopie, publiceert `site`, schrijft niets naar Git, en de GitHub-workflow bestaat niet meer.
- Niet vooraf getest: de echte pipeline op GitLab, het Pages-adres en het pipelineschema. Die worden pas zichtbaar na de merge naar `main`.
