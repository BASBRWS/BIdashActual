if(new URLSearchParams(location.search).get('standalone')==='1')IPL_STORAGE_KEY='bidash-planning:settings-v1';
/* Geen tweede planningmodel: deze adapter opent de bestaande schermfuncties. */
document.body.dataset.module='planning';
window.HUB={
 open(screen='s16'){if(!['s16','s11','s17','s18','s19','s20','s15'].includes(screen))throw Error('Onbekend planningscherm');showScreen(screen);},
 fullscreen(active){document.body.classList.toggle('hub-planning-focus',!!active);document.getElementById('main').scrollTop=0;requestAnimationFrame(()=>{renderIPL();});},
 exportPrimavera(){return ipl_createPrimaveraExport();},
 exportScenario(){return ipl_createScenarioExport();},
 scenarioExportBericht(result){return ipl_scenarioExportBericht(result);},
 importPlanning(p){if(!p||typeof p.xml!=='string')throw Error('De planning-XML ontbreekt.');ipl_laadBron(p.xml,p.name||'planning.xml',p.state);return this.summary();},
 exportPlanning(){return IPL_RAW_XML?{name:IPL_RAW_FILENAME,xml:IPL_RAW_XML,state:app_collectState()}:null;},
 summary(){return {geladen:!!IPL_MODEL,naam:IPL_RAW_FILENAME||'',activiteiten:IPL_MODEL?.regels?.length||0,exportInfo:ipl_exportMogelijkheden(),overzicht:planningOverzicht()};}
};
/* Overzicht voor het dashboard (2.89). Geen tweede planningmodel: mijlpalen komen uit
   IPL_MODEL met ipl_eff (dus inclusief scenarioverschuiving), de FTE-vraag uit
   ipl_computeDienstFteReeks (dezelfde reeks als de grafiek alle diensten, inclusief
   het VWM-formatiemodel) en de beschikbare FTE uit IPL_DASHCONFIG.beschikbareFte.
   Staan die nog op de standaardwaarden, dan meldt het overzicht dat in plaats van een
   tekort te claimen. "Vandaag" is de kalenderdag van de gebruiker: planning kijkt vooruit. */
const PLANNING_STANDAARD_FTE={GPO:8,CIV:5,VWM:5,PPO:3,Regio:3};
function planningOverzicht(nu=new Date()){
 if(!IPL_MODEL)return null;
 try{
  const pad=n=>String(n).padStart(2,'0'),dag=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const jaar=d=>{const y=d.getFullYear(),a=new Date(y,0,1),b=new Date(y+1,0,1);return y+(d-a)/(b-a);};
  const vandaag=dag(nu),tNu=jaar(new Date(nu.getFullYear(),nu.getMonth(),nu.getDate())),dagenTot=datum=>Math.round((Date.parse(datum+'T12:00:00Z')-Date.parse(vandaag+'T12:00:00Z'))/864e5);
  const mijlpalen=IPL_MODEL.regels.filter(r=>r.kind==='mile').map(r=>{const e=ipl_eff(r),datum=dag(ipl_yearToDate(e.t0));let project='';try{project=ipl_niveau1ProjectVanRegel(r).naam||'';}catch(_e){}return {id:r.id,naam:String(r.naam||'').trim(),datum,project,dagen:dagenTot(datum)};})
   .sort((a,b)=>a.datum.localeCompare(b.datum)||a.naam.localeCompare(b.naam,'nl'));
  const komend=mijlpalen.filter(m=>m.dagen>=0);
  const taken=IPL_MODEL.regels.filter(r=>r.kind!=='mile'),lopend=taken.filter(r=>{const e=ipl_eff(r);return e.t0<=tNu&&e.t1>tNu;}).length;
  let formatie=null;
  const reeks=ipl_computeDienstFteReeks(),buckets=reeks.buckets||[];
  if(buckets.length){
   const diensten=typeof IPL_DIENSTEN!=='undefined'?IPL_DIENSTEN:Object.keys(PLANNING_STANDAARD_FTE);
   const cap=(typeof IPL_DASHCONFIG!=='undefined'&&IPL_DASHCONFIG.beschikbareFte)||{};
   const standaard=diensten.every(d=>Number(cap[d])===PLANNING_STANDAARD_FTE[d]);
   const iNu=buckets.findIndex((b,i)=>b.t<=tNu&&(buckets[i+1]?.t??Infinity)>tNu),start=iNu<0?(tNu<buckets[0].t?0:buckets.length):iNu;
   const jaarVooruit=buckets.slice(start).filter(b=>b.t<tNu+1);
   const perDienst=diensten.map(d=>{
    let piek=0,piekT=null,tekortWeken=0,eersteTekort=null;const beschikbaar=Number(cap[d]);
    for(const b of buckets.slice(start)){const v=Number(b[d])||0;if(v>piek){piek=v;piekT=b.t;}}
    for(const b of jaarVooruit){const v=Number(b[d])||0;if(Number.isFinite(beschikbaar)&&v>beschikbaar+0.01){tekortWeken++;if(eersteTekort==null)eersteTekort=dag(ipl_yearToDate(b.t));}}
    return {dienst:d,nu:iNu<0?0:Number(buckets[iNu][d])||0,piek,piekDatum:piekT==null?null:dag(ipl_yearToDate(piekT)),beschikbaar:Number.isFinite(beschikbaar)?beschikbaar:null,tekortWeken,eersteTekort};
   });
   formatie={perDienst,beschikbaarStandaard:standaard,binnenPlanning:iNu>=0,bron:'FTE-reeks per week uit de planning (taak-FTE en VWM-formatiemodel)'};
  }
  return {vandaag,mijlpalen:komend.slice(0,5),mijlpalenTotaal:mijlpalen.length,mijlpalenKomend:komend.length,mijlpalenVoorbij:mijlpalen.length-komend.length,lopend,taken:taken.length,formatie};
 }catch(error){console.warn('Planningoverzicht niet beschikbaar',error);return null;}
}
const originalPlanningScreen=showScreen;
window.showScreen=function(id,...args){const r=originalPlanningScreen(id,...args);if(parent!==window)parent.postMessage({type:'hub:planning-screen',screen:id},location.origin);return r;};
document.addEventListener('change',()=>parent.postMessage({type:'hub:changed',engine:'planning'},location.origin));
window.addEventListener('load',()=>HUB.open('s16'));

// De knop in de planning bedient hetzelfde volledige scherm als de hoofdapp.
window.ipl_openLiveFullscreen=()=>parent.postMessage({type:'hub:planning-fullscreen',active:true},location.origin);
window.ipl_closeLiveFullscreen=()=>parent.postMessage({type:'hub:planning-fullscreen',active:false},location.origin);
document.addEventListener('keydown',e=>{if(e.key==='Escape')window.ipl_closeLiveFullscreen();});

const hubShowLoaded=ipl_showLoaded;
window.ipl_showLoaded=function(...args){const r=hubShowLoaded(...args);parent.postMessage({type:'hub:planning-loaded'},location.origin);return r;};

const originalPlanningAutosave=app_autosave;
window.app_autosave=function(...args){const result=originalPlanningAutosave(...args);if(parent!==window)parent.postMessage({type:'hub:changed',engine:'planning'},location.origin);return result;};
