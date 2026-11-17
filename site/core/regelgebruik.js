/* Regelgebruik: één register dat per impact- en organisatieregel vastlegt of
   BIdashActual hem werkelijk gebruikt.

   De regelschermen van DVM (Impactregels) en BI (Organisatieregels) zetten met
   `rgMark(domein,id)` een * achter een regel die niet of slechts beperkt wordt
   gebruikt. `overzichtHtml(domein)` toont dezelfde lijst als legenda bovenaan het
   scherm, ook voor regels die het scherm zelf niet toont.

   Status:
   - 'gebruikt' : werkt door in een getoonde berekening of signaal (geen *);
   - 'beperkt'  : alleen tekst, label of filter, of werkt maar heeft standaard
                  geen effect (oranje *);
   - 'niet'     : wordt in BIdashActual niet gebruikt (rode *).

   Bijhouden: wie het gebruik van een regel verandert, past hier de status aan.
   tests/regelgebruik.test.js controleert dat iedere standaardregel in dit
   register staat, dat een BI-parameter met controle 'ongelezen' nergens wordt
   gelezen, en dat de codekenmerken achter de 'niet'-statussen nog gelden. */
(function(scope){
  'use strict';
  const G='gebruikt',B='beperkt',N='niet';
  const PROGNOSE='Alleen voor prognose, Monte Carlo of simulatie; die zijn in BIdashActual uitgeschakeld.';
  const r=(status,label,reden,bron,extra)=>Object.freeze({status,label,reden,bron,...(extra||{})});

  const dvm={
    // 0 · Impactmodel en algemene instellingen (RULES.cfg)
    'cfg.impactModel':r(G,'Impactmodel (afkappen of opstapelen)','Bepaalt de zwaarte in doorrekenen() en de dienstband.','dvm-2.js doorrekenen, v68TypeBand'),
    'cfg.chokeVenster':r(G,'Choke-venster (km)','Clustert storingen in Gebied & knelpunten.','dvm-2.js doorrekenen'),
    'cfg.kpi_msi':r(G,'MSI-norm (cfg.kpi_msi)','Norm en kleur bij netwerkschakels en memo’s. Staat niet als invoerveld op dit scherm.','dvm-3.js, dvm-adapter-original.js'),
    'cfg.hw_mttr':r(N,'Algemene MTTR (cfg.hw_mttr)','De dagstand telt iedere open storing over de volle 24 uur van de peildatum. MTTR telt alleen in historie en prognose.','dvm-2.js doorrekenen (actueel ? periodeUren)'),
    'cfg.mcPriorJaren':r(N,'Prior-jaren Monte Carlo',PROGNOSE,'dvm-2.js Monte Carlo'),
    'cfg.reliabilityLifeCv':r(N,'Spreiding levensduur (CV)',PROGNOSE,'dvm-3.js Monte Carlo'),
    'cfg.reliabilityBetaCv':r(N,'Spreiding β (CV)',PROGNOSE,'dvm-3.js Monte Carlo'),
    'cfg.mttrCv':r(N,'Spreiding MTTR (CV)',PROGNOSE,'dvm-3.js Monte Carlo'),
    'cfg.maxLeeftijdFactor':r(N,'Maximale leeftijdsfactor',PROGNOSE,'dvm-2.js Monte Carlo'),
    // 1 · Assettypen
    'assetTypen.actief':r(N,'Assettype actief (vinkje)','doorrekenen() kijkt niet naar dit vinkje. Het filtert alleen de keuzelijst bij het maken van een eigen foutcode.','dvm-2.js doorrekenen, dvm-fault-rule-manager.js'),
    'assetTypen.wAvail':r(G,'Gewicht beschikbaarheid (w_besch)','Schaalt de basisimpact per assettype.','dvm-2.js doorrekenen'),
    'assetTypen.wPerf':r(G,'Gewicht prestatie (w_prest)','Schaalt de basisimpact per assettype.','dvm-2.js doorrekenen'),
    'assetTypen.levensduur':r(N,'Levensduur per assettype',PROGNOSE+' De EOL in het assetregister komt uit All Assets.','dvm-1.js assetReliability'),
    'assetTypen.beta':r(N,'Weibull β per assettype',PROGNOSE,'dvm-1.js assetReliability'),
    'assetTypen.mttr':r(N,'MTTR per assettype','De dagstand telt iedere open storing over de volle 24 uur; MTTR telt alleen in historie en prognose.','dvm-2.js doorrekenen'),
    // 2 · Foutcodes
    'foutcodes.severity':r(B,'Ernst van een foutcode','Alleen label en prioriteitsfilter in Open storingen; telt niet mee in de berekening.','core/live-overview-filter.js'),
    ...Object.fromEntries(['1003','1001','1002','1061','1005','1004','4021','2001','2002','2003','1006','1007','5004','DBD-DISPLAY','DBD-KRIT','DBD-TEMP','DBD-LED','DBD-RESET'].map(code=>[`foutcode.${code}`,r(G,`Foutcode ${code}`,'Basisimpact bij een passende melding.','dvm-2.js foutregel')])),
    'foutcode.DBD-DEUR':r(G,'Foutcode DBD-DEUR','Wordt gekoppeld met bewust 0% impact: een open kastdeur is geen displaystoring.','dvm-2.js foutregel'),
    'foutcode.6005':r(B,'Foutcode 6005 (wisselbord)','Wordt berekend, maar geen subproces hangt van wisselborden af en netwerkschakels rekenen met MSI. De code verandert dus geen dienstwaarde.','dvm-1.js OBJ_BRON, SUBPROCESSEN'),
    // 3 · MSI-ernst en locatiecontext
    ...Object.fromEntries(['01','02','03','04','05','06'].map(n=>[`locatie.MSI_ERNST_${n}`,r(G,`MSI-ernstregel ${n}`,'Factor voor de herkende MSI-context.','dvm-2.js locatieFactor')])),
    'locatie.LOC_005':r(G,'LOC_005 detectielus in weefvak','Alleen bij een melding met een weefvakvlag.','dvm-2.js locatieFactor'),
    'locatie.LOC_004':r(N,'LOC_004 camera met incidentzicht','locatieFactor() bepaalt nooit een cameracontext, dus deze regel past nooit.','dvm-2.js locatieFactor'),
    'locatie.LOC_006':r(N,'LOC_006 detectielus hoofdrijbaan standaard','Deze context wordt nooit bepaald; de factor is bovendien 1.','dvm-2.js locatieFactor'),
    'locatie.prioriteit':r(B,'Prioriteit van een locatieregel','Beslist alleen tussen regels met dezelfde context. Standaard is er één regel per context.','dvm-2.js locatieFactor'),
    // 4 · Combiregels
    ...Object.fromEntries(['001','002','003','004'].map(n=>[`combi.COMBO_${n}`,r(G,`Combiregel COMBO_${n}`,'Opslag bij samenloop binnen de maximale afstand.','dvm-2.js doorrekenen stap 5')])),
    'combi.venMin':r(N,'Tijdvenster combiregel (venMin)','In de dagstand krijgt iedere open melding de peildatum als tijdstip, dus aan het venster is altijd voldaan. Niet op dit scherm.','dvm-2.js doorrekenen (t: peildatum)'),
    'combi.capAvail':r(G,'Bovengrens beschikbaarheid combiregel','Werkt, maar staat niet als invoerveld op dit scherm.','dvm-2.js doorrekenen stap 5'),
    'combi.capPerf':r(G,'Bovengrens prestatie combiregel','Werkt, maar staat niet als invoerveld op dit scherm.','dvm-2.js doorrekenen stap 5'),
    // 5 · Diensten en subprocessen
    'dienst.norm':r(G,'Norm per dienstverlening','Normkolom en status.','dvm-2.js, dvm-actual.js'),
    'dienst.afh':r(N,'Vaste dienstgewichten (DIENSTEN.afh)','Alleen terugval als een dienst geen subprocessen heeft; dat komt niet voor. De subprocessen bepalen de dienstwaarde. Niet op dit scherm.','dvm-1.js dienstWaardeUitSubprocessen'),
    'dienst.schakels':r(B,'Schakels per dienst','Alleen tekst in verslagen.','dvm-3.js'),
    'subproces.aandeel':r(G,'Aandeel subproces','Weegt de subprocessen tot de dienstwaarde.','dvm-2.js v68Dienst'),
    'subproces.dynamische_strook':r(B,'Afhankelijkheid dynamische strook','Rekent als signalering, maar staat standaard in geen enkel subproces ingevuld.','dvm-1.js SUBPROCESSEN, OBJ_BRON'),
    'subproces.communicatie':r(B,'Afhankelijkheid communicatie','Virtuele bron zonder meldingen; geeft alleen een exacte waarde na bevestigde brondekking.','dvm-2.js v68TypeStatus'),
    // 7 · DRIP
    'drip.functies.gewicht':r(N,'DRIP-functiegewicht',PROGNOSE+' dripBeschikbaarheid() wordt nergens aangeroepen.','dvm-1.js dripBeschikbaarheid, dvm-3.js DRIP-prognose'),
    'drip.levensduurOverride':r(N,'DRIP-levensduur per fabrikant × type',PROGNOSE,'dvm-1.js assetReliability'),
    'drip.standaardLevensduur':r(N,'DRIP-terugvallevensduur',PROGNOSE,'dvm-1.js assetReliability'),
    // Assetconfiguratie
    'assetConfig.levensduur':r(N,'Levensduur per asset',PROGNOSE,'dvm-1.js assetReliability'),
    'assetConfig.beta':r(N,'Weibull β per asset',PROGNOSE,'dvm-1.js assetReliability'),
    'assetConfig.mttr':r(N,'MTTR per asset','Staat alleen in het rekenverslag; de dagstand telt de volle 24 uur.','dvm-2.js doorrekenen'),
    // Kostenmodule
    'kosten.prijspeil':r(B,'Prijspeil tarieven','Alleen label bij de kosten.','dvm-2.js kostenBasis')
  };

  const ongelezen=(label,reden)=>r(N,label,reden||'Wordt uit config.html geïmporteerd, maar nergens gelezen.','bi-1.js CFG_DEFAULTS',{controle:'ongelezen'});
  const bi={
    // Config-parameters uit config.html (CFG_DEFAULTS)
    'cfg.org.naam':ongelezen('org.naam'),
    'cfg.org.regio':ongelezen('org.regio'),
    'cfg.org.dienst':ongelezen('org.dienst'),
    'cfg.contract.vorm':ongelezen('contract.vorm'),
    'cfg.contract.beschikbaarheidseis':r(G,'contract.beschikbaarheidseis','Boeterisico in Signalen en de what-if bij Bedienketens.','bi-1.js evalTriggers'),
    'cfg.contract.boete_actief':r(G,'contract.boete_actief','Zet het boeterisico aan of uit.','bi-1.js evalTriggers'),
    'cfg.contract.boete_per_uur':r(G,'contract.boete_per_uur','Hoogte van het boeterisico.','bi-1.js evalTriggers'),
    'cfg.contract.looptijd':ongelezen('contract.looptijd'),
    'cfg.escalatie.niveau1':r(G,'escalatie.niveau1','Aandachtsgrens in het signaal FTE-tekort.','bi-1.js evalTriggers'),
    'cfg.escalatie.niveau2':r(G,'escalatie.niveau2','Kritieke grens in het signaal FTE-tekort.','bi-1.js evalTriggers'),
    'cfg.escalatie.niveau3':ongelezen('escalatie.niveau3'),
    'cfg.dienst.uren':ongelezen('dienst.uren'),
    'cfg.juridisch.max_snelheid_dag':ongelezen('juridisch.max_snelheid_dag'),
    'cfg.juridisch.max_snelheid_nacht':ongelezen('juridisch.max_snelheid_nacht'),
    'cfg.kpi.beschikbaarheid.groen':ongelezen('kpi.beschikbaarheid.groen'),
    'cfg.kpi.beschikbaarheid.geel':ongelezen('kpi.beschikbaarheid.geel'),
    'cfg.kpi.beschikbaarheid.oranje':ongelezen('kpi.beschikbaarheid.oranje'),
    'cfg.kpi.responstijd.tunnel':ongelezen('kpi.responstijd.tunnel'),
    'cfg.kpi.responstijd.calamiteit':ongelezen('kpi.responstijd.calamiteit'),
    'cfg.kpi.asset_beschikbaarheid.tunnel':r(G,'kpi.asset_beschikbaarheid.tunnel','Norm voor CMDB Tunnel/TTI.','bi-1.js normVoor'),
    'cfg.kpi.asset_beschikbaarheid.msi':r(G,'kpi.asset_beschikbaarheid.msi','Norm voor CMDB DVM.','bi-1.js normVoor'),
    'cfg.kpi.asset_beschikbaarheid.drip':r(G,'kpi.asset_beschikbaarheid.drip','Norm voor CMDB Facilitair.','bi-1.js normVoor'),
    'cfg.kpi.asset_beschikbaarheid.werkplek':r(G,'kpi.asset_beschikbaarheid.werkplek','Norm voor CMDB Productieplatform.','bi-1.js normVoor'),
    'cfg.kpi.planningshorizon_maanden':r(B,'kpi.planningshorizon_maanden','Alleen getoond op dit scherm; de genoemde doorwerking bestaat niet.','bi-2.js renderRules'),
    'cfg.kpi.files_werk_uitvoering':ongelezen('kpi.files_werk_uitvoering'),
    'cfg.vc.aantal_regionaal':ongelezen('vc.aantal_regionaal'),
    'cfg.hinder.max_files_werk':r(G,'hinder.max_files_werk','Drempel voor de gelijktijdigheidspiek in de planning.','bi-1.js planningTriggers'),
    'cfg.hinder.onderhoudsvenster':ongelezen('hinder.onderhoudsvenster'),
    'cfg.atw.rust_dagelijks':r(B,'atw.rust_dagelijks','Alleen genoemd in de tekst van het ATW-signaal; wordt niet getoetst.','bi-1.js evalTriggers'),
    'cfg.atw.rust_na_nacht':ongelezen('atw.rust_na_nacht'),
    'cfg.atw.max_uren_week':r(B,'atw.max_uren_week','Alleen genoemd in de tekst van het ATW-signaal; wordt niet getoetst.','bi-1.js evalTriggers'),
    'cfg.atw.max_nachten_14d':r(B,'atw.max_nachten_14d','Alleen genoemd in de tekst van het ATW-signaal; wordt niet getoetst.','bi-1.js evalTriggers'),
    'cfg.atw.max_nachten_consecutief':ongelezen('atw.max_nachten_consecutief'),
    'cfg.atw.rust_na_nachtreeks':r(B,'atw.rust_na_nachtreeks','Alleen genoemd in de voetnoot van dit scherm.','bi-2.js renderRules'),
    'cfg.atw.max_werkdagen_consecutief':ongelezen('atw.max_werkdagen_consecutief','Staat op dit scherm, maar wordt nergens gelezen of getoetst.'),
    'cfg.atw.maandcap_factor':ongelezen('atw.maandcap_factor'),
    'cfg.personeel.werkdagen_jaar':r(B,'personeel.werkdagen_jaar','Alleen getoond op dit scherm; de genoemde doorwerking bestaat niet.','bi-2.js renderRules'),
    'cfg.personeel.vakantiedagen':ongelezen('personeel.vakantiedagen'),
    'cfg.personeel.ziekteverzuim':r(G,'personeel.ziekteverzuim','Verzuimopslag op benodigde FTE.','bi-1.js basisParams'),
    'cfg.personeel.opleidingsuren':ongelezen('personeel.opleidingsuren'),
    'cfg.personeel.min_bezetting':r(G,'personeel.min_bezetting','Ondergrens in het signaal FTE-tekort.','bi-1.js evalTriggers'),
    'cfg.werklast.grens_hoog':ongelezen('werklast.grens_hoog'),
    'cfg.werklast.grens_kritisch':ongelezen('werklast.grens_kritisch'),
    'cfg.busrules.max_l3_per_desk':ongelezen('busrules.max_l3_per_desk'),
    'cfg.busrules.max_tunnels_per_desk':ongelezen('busrules.max_tunnels_per_desk'),
    'cfg.busrules.max_fte_per_desk':ongelezen('busrules.max_fte_per_desk'),
    'cfg.busrules.enabled':ongelezen('busrules.enabled'),
    'cfg.operator.max_events_uur':ongelezen('operator.max_events_uur'),
    'cfg.assets.hw_mtbf':ongelezen('assets.hw_mtbf'),
    'cfg.assets.hw_mttr':r(N,'assets.hw_mttr',PROGNOSE+' Ook de BI-meldingenimport is uitgeschakeld.','bi-1.js mttrVoor, runMC'),
    'cfg.assets.sw_mtbf':ongelezen('assets.sw_mtbf'),
    'cfg.assets.sw_mttr':r(N,'assets.sw_mttr',PROGNOSE,'bi-1.js mttrVoor, runMC'),
    'cfg.assets.max_beschikbaarheid':ongelezen('assets.max_beschikbaarheid'),
    'cfg.assets.waarschuwing_pct':ongelezen('assets.waarschuwing_pct'),
    'cfg.scenario.naam':r(B,'scenario.naam','Alleen in het bronlabel van de configuratie.','bi-1.js applyScenario'),
    'cfg.scenario.auteur':ongelezen('scenario.auteur'),
    'cfg.sim.personeel_factor':r(N,'sim.personeel_factor',PROGNOSE,'bi-1.js simUitConfig'),
    'cfg.sim.budget_factor':r(N,'sim.budget_factor',PROGNOSE,'bi-1.js simUitConfig'),
    'cfg.sim.asset_factor':r(N,'sim.asset_factor',PROGNOSE,'bi-1.js simUitConfig'),
    'cfg.sim.incident_multiplier':r(N,'sim.incident_multiplier',PROGNOSE,'bi-1.js simUitConfig'),
    // Overige organisatieregels
    'impact.planning':r(G,'Impactregels planningsafwijkingen','Signalen bij conflict, piek, verschuiving en capaciteit; alleen met een geladen planning.','bi-1.js berekenImpact'),
    'capgrens':r(G,'Capaciteitsgrens per programma','Kwartalen boven de grens; alleen met een geladen planning.','bi-1.js bridgeCapaciteit'),
    'amRegels':r(G,'Assetmanagementregels (ISO 55001)','Signalen en Bedienketens.','bi-1.js evalTriggers, ketenBesch'),
    'richtlijn.atw':r(G,'Richtlijn ATW','Een functie met ATW krijgt bij onderbezetting een ATW-signaal.','bi-1.js evalTriggers'),
    'richtlijn.warvw':r(B,'Richtlijn Warvw/Rarvw','Alleen label; er hoort geen toetsing bij.','bi-1.js DEFAULT_DB.richtlijnen'),
    'richtlijn.babw':r(B,'Richtlijn BABW','Alleen label; er hoort geen toetsing bij.','bi-1.js DEFAULT_DB.richtlijnen'),
    'storingsRegels':r(N,'Oude DVM-storingsregels in BI','Worden bij het laden leeggemaakt; alleen de DVM-impactregels gelden. Niet op dit scherm.','bi-adapter.js clean')
  };

  const REGELS=Object.freeze({dvm:Object.freeze(dvm),bi:Object.freeze(bi)});
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const TEKST={niet:'Niet gebruikt in BIdashActual',beperkt:'Beperkt gebruikt'};

  function regel(domein,id){return REGELS[domein]?.[id]||null;}
  function status(domein,id){return regel(domein,id)?.status||G;}
  function markering(domein,id){
    const x=regel(domein,id);if(!x||x.status===G)return '';
    const t=`${TEKST[x.status]}: ${x.reden}`;
    return `<sup class="rg-mark rg-${x.status}" data-regelgebruik="${esc(domein+':'+id)}" title="${esc(t)}" aria-label="${esc(t)}">*</sup>`;
  }
  function afwijkend(domein){return Object.entries(REGELS[domein]||{}).filter(([,x])=>x.status!==G);}
  function overzichtHtml(domein){
    const rijen=afwijkend(domein),niet=rijen.filter(([,x])=>x.status===N).length,beperkt=rijen.length-niet;
    return `<details class="card rg-overzicht" data-regelgebruik-overzicht="${esc(domein)}"><summary><b>Gebruik van deze regels</b> · <span class="rg-mark rg-niet">*</span> ${niet} niet gebruikt · <span class="rg-mark rg-beperkt">*</span> ${beperkt} beperkt gebruikt</summary>
      <p class="muted" style="font-size:12px">Een <span class="rg-mark rg-niet">*</span> betekent dat BIdashActual de regel niet gebruikt. Een <span class="rg-mark rg-beperkt">*</span> betekent alleen tekst, label of filter, of standaard zonder effect. Regels zonder * werken door. Wijzigen van een regel met een rode * verandert de dagstand niet. Beweeg over een * voor de reden; deze lijst bevat ook regels die niet op het scherm staan.</p>
      <div class="tbl-scroll" style="max-height:none"><table class="tbl"><thead><tr><th>Regel</th><th>Gebruik</th><th>Reden</th><th>Bron</th></tr></thead><tbody>${rijen.map(([id,x])=>`<tr data-regelgebruik-rij="${esc(id)}"><td>${esc(x.label)}</td><td><span class="rg-mark rg-${x.status}">*</span> ${x.status===N?'niet':'beperkt'}</td><td>${esc(x.reden)}</td><td class="mono" style="font-size:11px">${esc(x.bron)}</td></tr>`).join('')}</tbody></table></div></details>`;
  }

  const api=Object.freeze({REGELS,regel,status,markering,afwijkend,overzichtHtml});
  scope.BIDASH_REGELGEBRUIK=api;
  scope.rgMark=markering;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
