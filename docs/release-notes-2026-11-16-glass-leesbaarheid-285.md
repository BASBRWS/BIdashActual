# BIdashActual 2.85, leesbaarheid glass-dashboard

Na 2.84 bleef de browser de oude DVM-pagina gebruiken. De buildcode in de iframe-adressen was niet verhoogd. De DVM-module toonde daardoor nog het donkere thema: lichte tekst op de nieuwe lichte kaarten, een zwarte rand en versie 2.83 in de zijbalk.

- De buildcode van de schil, de DVM-iframe en de versiemodule is verhoogd. De browser laadt nu de nieuwe stijlen.
- De kopbalk scrolt weer mee. De paginatitel verdwijnt niet meer half onder een vervagende balk.
- Grijze hulpteksten, labels en pagineringstekst in de schil halen minimaal 4,5:1 contrast.
- Dienstnamen in de DVM-tegels worden als tekst donkerder weergegeven. De dienstkleur zelf blijft gelijk voor grafieken.
- KPI-labels en de voettekst van DVM volgen het groene thema.

Rekenregels, routes, opslag, imports en exports zijn niet gewijzigd.
