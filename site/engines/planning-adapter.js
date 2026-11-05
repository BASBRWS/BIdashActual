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
 summary(){return {geladen:!!IPL_MODEL,naam:IPL_RAW_FILENAME||'',activiteiten:IPL_MODEL?.regels?.length||0,exportInfo:ipl_exportMogelijkheden()};}
};
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
