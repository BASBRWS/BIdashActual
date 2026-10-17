# BIdashActual 2.66 / DVM 144, 17 oktober 2026

In Assetmanagement kun je queries onder een naam bewaren en opnieuw kiezen. Assetregister en Open storingen hebben ieder hun eigen lijst. Opslaan onder dezelfde naam werkt die query bij; een nieuwe naam maakt een nieuwe query. Query wissen verwijdert alleen de huidige filter. Verwijderen van een opgeslagen query laat de huidige filter staan. Velden, operatoren, waarden en EN/OF blijven samen bewaard. Het kiezen van een onbruikbare definitie verbreedt de selectie niet stil.

Het derde veld krijgt waarden uit de kolom die je in het eerste veld kiest. Foutcodearrays worden als afzonderlijke codes aangeboden. Lege waarden worden overgeslagen en echte nulwaarden blijven beschikbaar. Je kunt kiezen of vrij typen. Bij veel waarden toont de editor maximaal 100 passende suggesties; zoeken gebruikt alle geïndexeerde waarden. De keuzelijsten volgen nieuwe brongegevens en veranderen de bestaande filterlogica niet.

De queries blijven in deze browser bewaard, ook na een bronimport. Ze zijn browserinstellingen en worden niet toegevoegd aan de bestaande bron- en totaalexports. Bewaren van een query schrijft alleen de kleine querylijst, zonder een volledige bronwerkruimte te klonen of berekeningen te starten. Dataopties hergebruiken de bestaande presentatielijsten, bouwen hun index in korte blokken en worden per bron en veld gecachet. Grote lijsten met unieke namen/IDs blijven in bronvolgorde om een lange sortering te voorkomen.

De correctie uit 2.65 voor systeemmeldingen en VC-filters blijft aanwezig. De 48-uursverwerking, brondata, impactregels en kostenformules veranderen niet.

Validatie omvat benoemen, bijwerken, verwijderen, EN/OF, herladen, beide schermen, datakeuzes per veld, arrays, nul, onleesbare opslag, schrijffouten, bronverversing en behoud van de grote registerweergave. De controles gebruiken synthetische gegevens en zijn geen garantie voor dezelfde snelheid op ieder apparaat.

Alle 582 unittests slagen. De nieuwe querybouwerbrowsercontrole slaagt, net als de bestaande registercontrole met 50.000 synthetische assets en de responsiviteitscontrole met 50.000 assets, 5.000 adaptermeldingen en viermaal vertraagde CPU.

Numerieke queryvergelijkingen onderscheiden lege en onbekende waarden van een echte nul. Alleen de operatoren Is leeg en Is niet leeg behandelen ontbrekende waarden als een aparte toestand.
