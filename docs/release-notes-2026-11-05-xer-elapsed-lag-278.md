# BIdashActual 2.78, XER met kalenderwachttijden

De XER-export stopt niet meer op niet-nul elapsed lag. Bij uitsluitend elapsed wachttijden wordt de P6-relatiekalender op 24 uur gezet via SCHEDOPTIONS. Bij een combinatie met werkurenlag worden alleen de elapsed relaties vertaald naar 24-uursactiviteiten onder een aparte WBS, met twee nul-lagrelaties per oorspronkelijke relatie. Positieve en negatieve wachttijden en FS/SS/FF/SF worden ondersteund. De gewone werkurenlag blijft ongewijzigd, met P6-voorgangerkalender. De melding toont de oorspronkelijke aantallen naast extra activiteiten en XER-relaties.

Alle oorspronkelijke activiteiten en de bron-XML blijven behouden. Extra activiteiten bevatten geen resource-uren of kosten. Percentage-lag en niet ondersteunde kalenderpatronen blijven geblokkeerd.

Validatie: 672 unittests slagen, inclusief 19 XER-tests. Een onafhankelijke MPXJ-lezer bevestigt de 24-uursplanningoptie, de extra activiteiten/relaties en 48 uur werktijd op de helperkalender over vrijdag-zondag en bij negatieve lag. JS en inline planningcode syntactisch gecontroleerd; git diff --check geslaagd. Geen nieuwe browserdownloadtest. De echte gebruikersbron en P6 Professional 21-import/herberekening zijn niet getest. DVM blijft 151.

Oracle beschrijft de projectbrede relatiekalender en 24-uursoptie in https://docs.oracle.com/cd/F25600_01/English/Integration/p6_pro_api_reference/com/primavera/integration/client/bo/enm/ScheduleRelationshipLagCalendar.html . LinkLag is in tienden van minuten volgens https://learn.microsoft.com/en-us/office-project/xml-data-interchange/linklag-element .
