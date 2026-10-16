# BIdashActual

Operationele dagstand van assets, open en onzekere technische meldingen, dienstimpact,
verkeerskosten, formatie en bronkwaliteit. Zelfstandige overname van BASBRWS/BiDash
op commit 1229af3, inclusief de drie engines, imports, exports, planning,
documentatie, tests en het technische storingslog.

BIdashActual 2.64 / DVM 143 gebruikt geen prognoses, Monte Carlo of BI-simulaties.
BASBRWS/BiDash blijft de aparte analyseomgeving. Beide repositories worden vanaf
hier afzonderlijk beheerd; er is geen automatische broncodesynchronisatie.

## Gebruik

Start met `npm run serve`. Laad je bestaande integrale JSON, DVM-totaalbestand of
afzonderlijke bronnen. Persoonlijke brondata wordt niet naar GitHub gestuurd.
De overname bevat geen browserwerkruimte of gekoppelde bronmap; laad je eigen
export opnieuw en koppel de map in deze applicatie.

De bronpeildatum bepaalt de dagstand. Een oude export wordt niet actueel door
hem vandaag te openen. Bronactualiteit per VC en onzekere meldingen blijven
zichtbaar. Gesloten historie kan als herstelbewijs worden ingelezen en bewaard,
maar wordt niet als huidige storing of prognose gebruikt. Dit is geen
automatische historieopschoning. Planning en contracten blijven plancontext.

## Opslag en publicatie

De browseropslag is gescheiden van BiDash, ook als beide apps onder dezelfde
GitHub Pages-origin draaien. BIdashActual gebruikt IndexedDB `bidash-actual`,
importer-database `bidash-actual-signaalgever-importer` en de localStorage- en
sessionStorage-prefix `bidash-actual:`.

De workflow `.github/workflows/pages.yml` test en publiceert `site/` via GitHub
Pages en haalt openbare NDW-data op. Selecteer GitHub Actions als Pages-bron in
de repository-instellingen. Publicatie bevat code en openbare NDW-data, geen
lokale gebruikersbestanden. `npm test` voert de volledige unitregressie uit.
De aanvullende dagstandtest staat in `tests/actual-browser.cjs`.

## Grenzen

De volledige bronconstructie is overgenomen, de bestaande Git-commitgeschiedenis
niet. Prognosecode blijft als herkomst in de repository maar is in de actual-
ingangen geblokkeerd. De MTM-import verwerkt alle kleine openstaande dumps binnen
de gekozen periode op volgorde, inclusief ieder blok binnen een bestand. Een
verdwenen melding blijft onzeker open totdat zij 48 uur vanaf de eerste
afwezigheid wegblijft. Terugkeer wist de wachttijd. Een ontbrekende brondag
herstart die termijn. Herstel blijft afgeleid, zonder exact herstelmoment.

Grote BSS-bestanden worden overgeslagen; de eerdere BSS-import blijft als aparte
methode beschikbaar. De verwerking bewaart één brondag tegelijk in geheugen,
naast de opgebouwde incidentstand. Om te vroeg afgeleid herstel uit 2.63 te
corrigeren, importeer je de volledige relevante dagelijkse reeks opnieuw.

Zie [Systeemwerking](docs/SYSTEEMWERKING.md), [Gebruikershulp](docs/GEBRUIKERSHULP.md)
en [Release 2.64](docs/release-notes-2026-10-16-open-dumps-264.md).
