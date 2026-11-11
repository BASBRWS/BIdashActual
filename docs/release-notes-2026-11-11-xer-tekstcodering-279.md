# BIdashActual 2.79, XER tekstcodering

Namen en codes met tekens buiten Windows-1252 blokkeren de XER-export niet meer. De export verwijdert onzichtbare opmaaktekens, zet herkenbare tekens om en vervangt tekens zonder equivalent. Bij een botsing tussen activiteitcodes kiest de export een vrije code. Het resultaat meldt hoeveel tekstvelden zijn aangepast. De bronplanning behoudt de originele tekst.

De regressietest gebruikt 702 activiteiten met gemengde wachttijden en Unicode in project-, WBS-, kalender- en activiteitnamen. Een tweede test controleert unieke activiteitcodes en intacte relaties na conversie. De werkelijke gebruikers-XML en import in P6 Professional zijn niet getest. DVM blijft 151.
