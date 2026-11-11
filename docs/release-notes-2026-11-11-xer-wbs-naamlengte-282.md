# BIdashActual 2.82, lengte van WBS-namen in XER

Primavera P6 Professional 21 weigerde een WBS-naam met SQL-fout 2628 op PROJWBS.wbs_name. De XER-export begrenst WBS-namen na tekencodering op 100 tekens. De melding toont hoeveel namen zijn ingekort.

De regressietest controleert de lengte in Windows-1252, een naam van precies 100 tekens en de verwijzingen vanuit activiteiten. Een import in P6 Professional 21 moet nog worden bevestigd.
