# BIdashActual 2.73, DVM 151

## DVKA en niet gekoppelde storingen, versie 2.73

Een DVKA-letter blijft een eigen wegtak. Het dashboard bepaalt per locatie bij welke hoofdrichting die hoort, eerst uit BPS/baanpositie en anders uit een eenduidige nabije hoofdbaan. Een unieke kandidaat met dezelfde eenheid kan vanuit een LI/RE-melding worden gekoppeld. Er geldt geen vaste kant voor een letter in het hele land.

Assetconfiguratie toont waarom meldgroepen niet koppelen, hoeveel bronverwijzingen daarbij horen en hoeveel unieke locaties dit raakt. De telling bevat historie én open lijsten. Eén incident kan in beide staan. Een locatiekandidaat is nog geen bevestigde storing op één asset.

Controleer de getoonde kandidaten. Bevestig DVKA-koppeling bewaart een gecontroleerde relatie naar dezelfde hoofdrichting. Een afwijkende eenheid of een andere DVKA vraagt broncontrole en krijgt geen geforceerde koppeling. De bulkknop slaat deze onbesliste technische groepen over. Bewaar de keuze met jouw totaalexport of assetconfiguratie-export. Na herladen en import blijft de relatie beschikbaar zolang de bronkenmerken passen.

De bestaande importformaten, 48-uursherstelregels en bronbestanden blijven behouden. Afgeleide koppelgegevens blijven lokaal. Het landelijke koppelpercentage op de actuele gebruikersimport is niet gemeten.

Validatie: 647 unittests geslaagd. De DVKA-browsercontrole test bronverwerking, diagnose, eenheidsblokkade, individuele bevestiging, losse configuratie-export/import, totaalexport en herladen. De bestaande assetlocatiecontrole en de responsiviteitscontrole met 50.000 assets en 5.000 meldingen slagen. Alle 74 applicatie-JavaScriptbestanden zijn syntactisch gecontroleerd.
