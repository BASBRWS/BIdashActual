# BIdashActual 2.83, XER opschoning

De XER-export ruimt witruimte en besturingstekens op en begrenst WBS-namen op 80 tekens, activiteitnamen op 120 en overige tekstnamen op 255. De korte WBS-code blijft maximaal 20 tekens per niveau. De export zet ingekorte namen en bestaande MSP-notities in BiDash onderbouwing in het P6 Notebook. Per notitie geldt maximaal 2.000 bytes inclusief HTML. De exportmelding telt de inkortingen.

De regressietests controleren veldgrenzen, de oorspronkelijke namen, HTML-codering en de koppeling tussen notitie en activiteit of WBS. De import in P6 Professional 21 moet nog worden bevestigd.
