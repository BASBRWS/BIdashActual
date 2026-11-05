/* Planning-only snapshots have their own database and contain no DVM/BI sources. */
export const PLANNING_WORKSPACE_DB='bidash-planning';
export function normalizePlanningSnapshot(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Geen geldige planningback-up.');
  if(value.formaat==='BIdash-planning'&&value.versie!==1)throw Error('Deze versie van de planningback-up wordt niet ondersteund.');
  const p=value.delen?.planning||value.planning||(typeof value.xml==='string'?value:null);
  if(!p||typeof p.xml!=='string'||!p.xml.trim())throw Error('Dit bestand bevat geen planning-XML. Kies een planningback-up of een integrale back-up met de planning.');
  if(p.state!=null&&(typeof p.state!=='object'||Array.isArray(p.state)))throw Error('De planningsinstellingen zijn ongeldig.');
  if(p.state?.ipl!=null&&(typeof p.state.ipl!=='object'||Array.isArray(p.state.ipl)))throw Error('De scenariogegevens zijn ongeldig.');
  return {name:String(p.name||'planning.xml'),xml:p.xml,state:p.state?structuredClone(p.state):null};
}
export function planningSnapshot(planning,date=new Date()){
  return {formaat:'BIdash-planning',versie:1,opgeslagen:date.toISOString(),planning:normalizePlanningSnapshot({planning})};
}
function db(scope){
  return new Promise((resolve,reject)=>{
    if(!scope.indexedDB){reject(Error('Lokale browseropslag is niet beschikbaar. Maak een back-upbestand.'));return;}
    const request=scope.indexedDB.open(PLANNING_WORKSPACE_DB,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('workspace');
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
export async function readPlanningWorkspace(scope=globalThis){
  const connection=await db(scope);
  try{return await new Promise((resolve,reject)=>{
    const transaction=connection.transaction('workspace','readonly'),request=transaction.objectStore('workspace').get('current');
    let value;request.onsuccess=()=>{value=request.result;};
    transaction.oncomplete=()=>resolve(value||null);transaction.onabort=()=>reject(transaction.error||Error('Planning kon niet worden gelezen.'));
  });}finally{connection.close();}
}
export async function writePlanningWorkspace(value,scope=globalThis){
  const snapshot=planningSnapshot(normalizePlanningSnapshot(value));
  const connection=await db(scope);
  try{await new Promise((resolve,reject)=>{
    const transaction=connection.transaction('workspace','readwrite');transaction.objectStore('workspace').put(snapshot,'current');
    transaction.oncomplete=resolve;transaction.onabort=()=>reject(transaction.error||Error('Planning kon niet worden opgeslagen.'));
  });}finally{connection.close();}
  return snapshot;
}
