# BIdashActual 2.81, Primavera XER WBS

P6 Professional 21 meldde SQL 547 op fk_task_projwbs tijdens import. De export schrijft de WBS nu met de P6-velden en een apart ID-bereik. MSP-padcijfers worden korte codes per WBS-niveau. Bovenliggende WBS-regels staan voor hun kinderen. Een nieuwe MSP-export krijgt een eigen project-ID voor een schone import.

Een regressietest controleert de hiërarchie, lokale codes, activiteitverwijzingen en een nieuw project-ID per export. De productie-import in Primavera moet nog worden bevestigd.
