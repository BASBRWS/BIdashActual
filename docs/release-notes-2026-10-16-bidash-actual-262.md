# BIdashActual 2.62 / DVM 141

Zelfstandige overname van BiDash 2.61, commit 1229af3. De drie engines, bronimports,
exportcontracten, kaart, planning, expertinvoer en het lokale storingslog blijven.
Het overzicht en de regio zijn op actuele operatie gericht; bronmoment en
onzekerheid blijven zichtbaar. Prognoses en simulaties hebben geen route en zijn
tevens geblokkeerd in de startfuncties en rekenkern. BI gebruikt basisparameters.
Geïmporteerde opgeslagen verkeers-Monte-Carlo en MSI-prognoses worden verwijderd.

Gebruikersdata wordt niet gekopieerd of gepubliceerd. Gebruik eigen JSON-import.
IndexedDB en legacy browseropslag zijn gescheiden van BiDash, ook op dezelfde
origin. De actuele MTM-mapstand blijft in de lokale actual-autosave behouden.
Gesloten historie blijft herstelbewijs en wordt niet als actuele storing geteld.

De oorspronkelijke repository en zijn geschiedenis worden niet gewijzigd. Deze
repository bevat alle bronbestanden en heeft eigen commits en Pages-workflow.
Pages moet door de eigenaar op GitHub Actions staan. De geërfde analysefuncties
blijven in de codebasis om de complete constructie te behouden, maar de actual-
ingangen kunnen ze niet uitvoeren. De fout met tegenstrijdige bronkopdatum is
geen onderdeel van deze splitsing. Een meerjarige operationele dataset is niet
integraal opnieuw doorgerekend.

Validatie: volledige unitregressie, echte browsercontrole van dagstandroutes,
MSI- en BI-prognoseblokkades, actuele/gesloten/onzekere meldingen, import,
opslaan/herladen, brondekking, planning en gescheiden originele opslag.
Een lokaal aangeleverd DVM-totaalbestand is aanvullend via de echte schil
geïmporteerd, opgeslagen en herladen. De operationele bron en afgeleide tellingen
staan niet in de repository.
