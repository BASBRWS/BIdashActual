/* Rekenmethode ingenieursbureau: operationele gevolgen van storingen (2.93 / DVM 166).

   Overgenomen uit het dashboard "A12 · Regio ↔ VWM Impact" (impact sliders A12/A6,
   basis v7). Daar rekent het model vanuit een onderhoudsreductie; hier wordt dezelfde
   keten toegepast op de huidige storingsstand per verkeerscentrale:
   - reductie = 0, alle schuifregelaars neutraal (1,0);
   - beschikbaarheid per assettype = 1 - uitval / areaal, uit de open storingen;
   - voor signaalgevers telt de uitval per locatie mee met de beschikbaarheidsweging
     (fAvail) van het ingenieursbureau: rijbaanbreed, weefvak en opvolgend 1,7; laatste
     portaal voor splitsing 1,35; voor afrit 1,25; voor toerit 1,0. Die weging is relatief:
     gedeeld door het gemiddelde gewicht, zodat het totaal vergelijkbaar blijft;
   - het perfgat (fPerf) werkt in het bronmodel alleen via de schuifregelaars; neutraal
     is dat 0,5. Dat wordt hier letterlijk overgenomen;
   - de referentie (basisbeschikbaarheid) is de norm uit Regels of de instelling.

   Formules (zoals in het bronbestand, met reductie 0):
     gemiddelde       = Σ U_t × impactgewicht_t / Σ impactgewicht_t
     verlies          = max(0, norm - gemiddelde)
     detectietijd     = 2,5 × (1 + verlies × 4,5 + (1 - U_cam) × 1,8)            minuten
     gemiste incid.   = min(0,35; verlies × 1,4 + (1 - U_cam) × 0,20)
     kruisrisico      = max(0, (0,95 - U_msi) × 2,2 + perfgat × 0,12)        (perfgat 0,5: regelallocatie neutraal)
     botsabsorbers    = kritiek × 0,12 × (1 + kruisrisico)
     blootstelling    = 1 + kruisrisico × 1,8                                    (weginspectie)
     aanrijtijd       = 14 × (1 + verlies × 2,8 + gemist × 1,5 + (1 - U_cam) × 0,35)
     inspecteursuren  = kritiek × 12 × (1 + kruisrisico × 0,6)
     geleidingsgat    = max(0, (0,92 - U_drip) + (0,95 - U_msi) × 0,5)
     DRIP-wagens      = kritiek × 0,35 × (1 + geleidingsgat × 2)
     IM-teams         = kritiek / 10 × 0,4 × (1 + geleidingsgat)
     spitsbetrouwb.   = min(1, U_msi × 0,6 + U_cam × 0,4)
     bedieningsfactor = 1 + (1 - spitsbetrouwbaarheid) × 1,6                     (extra bezetting)
     conservatief     = 8 × (1 - spitsbetrouwbaarheid) × 12                      maatregelen
     kosten           = uren × 85 + DRIP-wagens × 420 + botsabsorbers × 1.850 + IM-teams × 3.200
   Voertuigverliesuren zitten niet in deze toepassing: die rekent BiDash al met het eigen
   verkeerskostenmodel. */

export const MSI_CONTEXTEN=[
  {id:'rijbaanbreed',label:'Rijbaanbreed',fAvail:1.7},
  {id:'weefvak',label:'Weefvak',fAvail:1.7},
  {id:'opvolgend',label:'Opvolgend',fAvail:1.7},
  {id:'laatste_portaal_voor_splitsing',label:'Laatste portaal voor splitsing',fAvail:1.35},
  {id:'voor_afrit',label:'Voor afrit',fAvail:1.25},
  {id:'voor_toerit',label:'Voor toerit',fAvail:1}
];
export const TYPE_GEWICHT={MSI:1,CAM:0.85,LUS:0.9,DRIP:0.7};
export const KOSTEN={inspecteursuur:85,dripwagen:420,botsabsorber:1850,imTeam:3200};

export function standaardIngenieur(){
  return {msi:MSI_CONTEXTEN.map(c=>({id:c.id,fAvail:c.fAvail})),typeGewicht:{...TYPE_GEWICHT},kosten:{...KOSTEN}};
}
const getal=(v,fb,min=0,max=100)=>{const n=v===''||v==null?NaN:Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fb;};
export function normaliseerIngenieur(x){
  const d=standaardIngenieur();if(!x||typeof x!=='object')return d;
  const msi=Array.isArray(x.msi)?x.msi:[];
  return {msi:d.msi.map(c=>{const v=msi.find(m=>m&&m.id===c.id)||{};return {id:c.id,fAvail:getal(v.fAvail,c.fAvail,0,10)};}),
    typeGewicht:Object.fromEntries(Object.entries(d.typeGewicht).map(([k,v])=>[k,getal(x.typeGewicht?.[k],v,0,10)])),
    kosten:Object.fromEntries(Object.entries(d.kosten).map(([k,v])=>[k,getal(x.kosten?.[k],v,0,1e7)]))};
}
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/* rij: {MSI:{totaal,uitvalA,uitvalP,kritiek,storingen,ctx:{[id]:{n,uitvalA,uitvalP}}},CAM,LUS,DRIP} */
export function berekenIngenieur(rij,{norm,instelling}={}){
  const s=normaliseerIngenieur(instelling),ref=clamp((Number.isFinite(Number(norm))?Number(norm):99.5)/100,0,1);
  const msi=rij?.MSI||{totaal:0,uitvalA:0,uitvalP:0,ctx:{}},gemA=s.msi.reduce((t,c)=>t+c.fAvail,0)/s.msi.length||1;
  const fac=id=>s.msi.find(c=>c.id===id)||s.msi[0];
  const ctxRijen=Object.entries(msi.ctx||{}).map(([id,c])=>({id,label:MSI_CONTEXTEN.find(x=>x.id===id)?.label||id,n:c.n,uitvalA:c.uitvalA,gewogenA:c.uitvalA*fac(id).fAvail/gemA}));
  const U=t=>{const r=rij?.[t];if(!r||!r.totaal)return null;return clamp(1-r.uitvalA/r.totaal,0,1);};
  const msiTot=msi.totaal||0,msiGewogen=ctxRijen.reduce((t,c)=>t+c.gewogenA,0);
  const Umsi=msiTot?clamp(1-msiGewogen/msiTot,0,1):null,Ucam=U('CAM'),Ulus=U('LUS'),Udrip=U('DRIP');
  const beschik={MSI:Umsi,CAM:Ucam,LUS:Ulus,DRIP:Udrip};
  const typen=Object.entries(beschik).filter(([,v])=>v!=null);
  if(!typen.length)return null;
  const gemiddelde=typen.reduce((t,[k,v])=>t+v*s.typeGewicht[k],0)/(typen.reduce((t,[k])=>t+s.typeGewicht[k],0)||1);
  const verlies=Math.max(0,ref-gemiddelde),uMsi=Umsi??1,uCam=Ucam??1,uDrip=Udrip??1;
  const perfgat=.5;
  const kritiek=['MSI','CAM','LUS','DRIP'].reduce((t,k)=>t+(rij?.[k]?.kritiek||0),0);
  const detectMin=2.5*(1+verlies*4.5+(1-uCam)*1.8);
  const gemist=Math.min(.35,verlies*1.4+(1-uCam)*.20);
  const kruisrisico=Math.max(0,(.95-uMsi)*2.2+perfgat*.12);
  const botsabsorbers=kritiek*.12*(1+kruisrisico);
  const blootstelling=1+kruisrisico*1.8;
  const aanrijMin=14*(1+verlies*2.8+gemist*1.5+(1-uCam)*.35);
  const inspecteursuren=kritiek*12*(1+kruisrisico*.6);
  const geleidingsgat=Math.max(0,(.92-uDrip)+(.95-uMsi)*.5);
  const dripwagens=kritiek*.35*(1+geleidingsgat*2);
  const imTeams=kritiek/10*.4*(1+geleidingsgat);
  const spits=Math.min(1,uMsi*.6+uCam*.4);
  const bedieningsfactor=1+(1-spits)*1.6;
  const conservatief=8*(1-spits)*12;
  const kosten=inspecteursuren*s.kosten.inspecteursuur+dripwagens*s.kosten.dripwagen+botsabsorbers*s.kosten.botsabsorber+imTeams*s.kosten.imTeam;
  return {norm:ref,beschik,gemiddelde,verlies,perfgat,kritiek,ctx:ctxRijen.sort((a,b)=>b.gewogenA-a.gewogenA),msiStoringen:msi.storingen||0,
    detectMin,gemist,kruisrisico,botsabsorbers,blootstelling,aanrijMin,inspecteursuren,geleidingsgat,dripwagens,imTeams,spits,bedieningsfactor,conservatief,kosten};
}

/* Factor voor de formatie: bediening (wegverkeersleiders) volgt de bedieningsfactor,
   weginspectie (officier van dienst, weginspecteur) de blootstelling. */
export function formatieFactor(r,koppeling){
  if(!r)return 1;
  if(koppeling==='bediening')return r.bedieningsfactor;
  if(koppeling==='inspectie')return r.blootstelling;
  return 1;
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(n,d=1)=>n==null||!Number.isFinite(n)?'–':new Intl.NumberFormat('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const pct=(n,d=1)=>n==null?'–':f(n*100,d)+'%';
const euro=n=>new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n||0);

export function ingenieurVcHtml(vc,r){
  if(!r)return '';
  const ind=[['Gewogen beschikbaarheid signaalgevers',pct(r.beschik.MSI,2)],['Camera’s',pct(r.beschik.CAM,2)],['Kritieke storingen',f(r.kritiek,0)],['Detectietijd',f(r.detectMin)+' min'],['Gemiste incidenten',pct(r.gemist)],['Aanrijtijd weginspectie',f(r.aanrijMin)+' min'],
    ['Risico doorrijden kruis',pct(r.kruisrisico)],['Blootstelling weginspectie','× '+f(r.blootstelling,2)],['Extra inzet bediening','× '+f(r.bedieningsfactor,2)],['Extra inspecteursuren',f(r.inspecteursuren,0)+' u'],['Extra botsabsorbers',f(r.botsabsorbers)],['Extra DRIP-wagens',f(r.dripwagens)],['Extra IM-teams',f(r.imTeams)],['Conservatieve maatregelen',f(r.conservatief)],['Operationele kosten',euro(r.kosten)]];
  const ctx=r.ctx.length?`<p class="ov-subkop">Signaalgevers in storing per locatie (weging ingenieursbureau)</p><ul class="op-drijvers">${r.ctx.map(c=>`<li><b>${esc(c.label)}</b> ${f(c.n,0)} in storing · gewogen uitval ${f(c.gewogenA,1)}</li>`).join('')}</ul>`:'<p class="muted">Geen signaalgevers in storing.</p>';
  return `<article class="op-vc ing-vc"><header><h3>VC ${esc(vc)}</h3><span class="muted">norm ${pct(r.norm,1)} · verlies ${pct(r.verlies,2)}</span></header><dl class="ing-ind">${ind.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>${ctx}</article>`;
}

export function ingenieurInstellingenHtml(inst){
  const s=normaliseerIngenieur(inst),veld=(attr,v,label,step='0.05')=>`<input type="number" ${attr} value="${esc(v)}" step="${step}" min="0" aria-label="${esc(label)}">`;
  return `<h3>Weging signaalgevers per locatie (ingenieursbureau)</h3><p class="muted">Relatief: een gewicht boven het gemiddelde laat een storing op die plek zwaarder tellen. Voor afrit staat standaard op 1,25.</p>
  <table class="op-tabel op-rollen"><thead><tr><th>Locatie</th><th>Gewicht (fAvail)</th></tr></thead><tbody>${s.msi.map(c=>`<tr><th scope="row">${esc(MSI_CONTEXTEN.find(x=>x.id===c.id).label)}</th><td>${veld(`data-ing-msi="${c.id}" data-ing-veld="fAvail"`,c.fAvail,'Gewicht '+c.id)}</td></tr>`).join('')}</tbody></table>
  <h3>Impactgewicht per assettype en kosten</h3><div class="op-velden">${Object.entries(s.typeGewicht).map(([k,v])=>`<label>Impactgewicht ${esc(k)}${veld(`data-ing-type="${k}"`,v,'Impactgewicht '+k)}</label>`).join('')}${[['inspecteursuur','Kosten per inspecteursuur (€)'],['dripwagen','Kosten per DRIP-wagen (€)'],['botsabsorber','Kosten per botsabsorber (€)'],['imTeam','Kosten per IM-team (€)']].map(([k,l])=>`<label>${esc(l)}${veld(`data-ing-kosten="${k}"`,s.kosten[k],l,'1')}</label>`).join('')}</div>`;
}
