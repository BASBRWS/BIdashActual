import {BIDASH_VERSIE} from '../core/versie.js?v=20261105-277';
import {createFileDownload} from '../core/file-download.js';
import {normalizePlanningSnapshot,planningSnapshot,readPlanningWorkspace,writePlanningWorkspace} from '../core/planning-workspace.js';
const $=selector=>document.querySelector(selector),frame=$('#planning');
const downloads=createFileDownload($('#backupDownload'));
let api=null,busy=true,timer=null,saveChain=Promise.resolve(),saveGeneration=0,managedLoads=0;
$('#version').textContent='Versie '+BIDASH_VERSIE;
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function controls(){const loaded=!!api?.summary()?.geladen;$('#import').disabled=busy||!api;$('#save').disabled=busy||!loaded;$('#backup').disabled=busy||!loaded;}
function snapshot(){const planning=api?.exportPlanning();if(!planning)throw Error('Laad eerst een planning.');return planningSnapshot(planning);}
function scheduleSave(){
 if(busy||!api?.summary()?.geladen)return;
 clearTimeout(timer);status('Wijzigingen opslaan…');timer=setTimeout(()=>save().catch(error=>status(error.message,true)),700);
}
function importPlanning(planning){
 managedLoads++;
 try{return api.importPlanning(planning);}
 catch(error){managedLoads--;throw error;}
}
async function save(){
 status('Planning opslaan…');
 const current=snapshot(),generation=saveGeneration;
 const operation=saveChain.catch(()=>{}).then(()=>writePlanningWorkspace(current));saveChain=operation;
 await operation;
 if(generation===saveGeneration)status('Lokaal opgeslagen · '+new Date().toLocaleTimeString('nl-NL')+' · '+api.summary().exportInfo.label);
 controls();return current;
}
function openScreen(screen){
 if(!api)return;api.open(screen);
 document.querySelectorAll('[data-screen]').forEach(button=>button.toggleAttribute('aria-current',false));
 const selected=document.querySelector('[data-screen="'+screen+'"]');if(selected)selected.setAttribute('aria-current','page');
}
function fullscreen(active){document.body.classList.toggle('fullscreen',!!active);api?.fullscreen(!!active);}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
 if(event.data?.type==='hub:planning-loaded'&&managedLoads){managedLoads--;controls();return;}
 if(event.data?.type==='hub:changed'||event.data?.type==='hub:planning-loaded'){controls();scheduleSave();}
 if(event.data?.type==='hub:planning-fullscreen')fullscreen(event.data.active);
 if(event.data?.type==='hub:planning-screen'){
  const screen=event.data.screen==='s20'?'s19':event.data.screen;
  document.querySelectorAll('[data-screen]').forEach(button=>{if(button.dataset.screen===screen)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
 }
});
window.addEventListener('keydown',event=>{if(event.key==='Escape')fullscreen(false);});
$('#fullscreen').onclick=()=>fullscreen(!document.body.classList.contains('fullscreen'));
for(const button of document.querySelectorAll('[data-screen]'))button.onclick=()=>openScreen(button.dataset.screen);
$('#import').onclick=()=>$('#file').click();
$('#file').onchange=async event=>{
 const file=event.target.files[0];event.target.value='';if(!file||busy)return;
 busy=true;saveGeneration++;clearTimeout(timer);controls();status('Planning laden…');downloads.clear();
 try{
  const text=await file.text(),planning=/^\s*</.test(text)?{name:file.name,xml:text,state:null}:normalizePlanningSnapshot(JSON.parse(text));
  importPlanning(planning);openScreen('s16');await save();
 }catch(error){status('Laden mislukt. '+error.message,true);}
 finally{busy=false;controls();}
};
$('#save').onclick=()=>save().catch(error=>status('Opslaan mislukt. '+error.message,true));
$('#backup').onclick=async()=>{
 try{
  clearTimeout(timer);const current=snapshot();
  downloads.prepare({text:JSON.stringify(current),name:'bidash-planning-'+new Date().toISOString().slice(0,10)+'.json',type:'application/json'});
  $('#backupDownload').textContent='Download volledige planningback-up';downloads.attempt();
  status('Volledige back-up staat klaar, inclusief bron-XML, verschuivingen en planningsinstellingen.');
 }catch(error){status(error.message,true);}
};
async function start(){
 try{
  for(let count=0;count<600&&!frame.contentWindow?.HUB;count++)await new Promise(resolve=>setTimeout(resolve,50));
  api=frame.contentWindow?.HUB;if(!api)throw Error('De planning reageert niet. Ververs de pagina.');
  const saved=await readPlanningWorkspace();
  if(saved){importPlanning(normalizePlanningSnapshot(saved));status('Laatst opgeslagen planning hersteld · '+api.summary().naam);}
  else status('Klaar. Laad een planning-XML of een back-up met de planning.');
  openScreen('s16');
 }catch(error){status(error.message,true);}
 finally{busy=false;controls();}
}
start();
