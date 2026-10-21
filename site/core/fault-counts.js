// Presentatietellingen. Meldingen blijven afzonderlijk; geen impact- of herstelregels.
const text=v=>String(v??'').trim().toUpperCase();
const number=v=>v==null||String(v).trim()===''?null:Number(String(v).replace(',','.'));
const vc=v=>({WNN:'NWN',WNZ:'ZWN',UT:'MN',ON:'NON',ZH:'ZWN'})[text(v).replace(/^VC[\s_-]*/,'')]||text(v).replace(/^VC[\s_-]*/,'');

export function faultLocationKey(row={}){
 const central=vc(row.vc),road=text(row.weg).replace(/^([AN])0+(\d)/,'$1$2'),hm=number(row.hm);
 const rawSide=text(row.zijdeBron||row.richting),side=({R:'RE',RECHTS:'RE',L:'LI',LINKS:'LI'})[rawSide]||rawSide;
 // Een asset, rijstrook, foutcode of incident is geen extra fysieke locatie.
 // Onvolledige posities worden niet bij elkaar gegokt.
 if(!central||!road||!side||!Number.isFinite(hm))return '';
 return JSON.stringify([central,road,side,text(row.hectoletter),hm.toFixed(3)]);
}
const empty=()=>({meldingen:0,locaties:0,bevestigdeLocaties:0,aanwezig:0,verdwenen:0,onbekend:0,hersteld:0,zonderLocatie:0});
function state(row){
 const s=text(row.levenscyclus_status);
 if(/^HERSTELD_/.test(s))return 'hersteld';
 if(s==='VERDWENEN_UIT_SNAPSHOT')return 'verdwenen';
 if(s==='OPEN_BEVESTIGD'||s==='OPEN_VEROUDERD')return 'aanwezig';
 if(s==='ONBEKEND_DOOR_BRONGAT')return 'onbekend';
 return row.liveOpen===true||row._liveOpen===true?'aanwezig':'onbekend';
}
export function createFaultCounter(){
 const total=empty(),locations=new Set(),present=new Set(),types=new Map(),centrals=new Map();
 function add(row){
  const type=text(row.typeId)||'ONBEKEND';
  if(!types.has(type))types.set(type,{...empty(),positions:new Set(),present:new Set()});
  const central=vc(row.vc)||'ONBEKEND';
  if(!centrals.has(central))centrals.set(central,{...empty(),positions:new Set(),present:new Set()});
  const category=types.get(type),region=centrals.get(central),key=faultLocationKey(row),status=state(row);
  for(const x of [total,category,region]){x.meldingen++;x[status]++;if(!key)x.zonderLocatie++;}
  if(key){locations.add(key);category.positions.add(key);region.positions.add(key);if(status==='aanwezig'){present.add(key);category.present.add(key);region.present.add(key);}}
 }
 const counts=map=>Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)).map(([type,{positions,present,...numbers}])=>[type,{...numbers,locaties:positions.size,bevestigdeLocaties:present.size}]));
 function value(){return {...total,locaties:locations.size,bevestigdeLocaties:present.size,
  perType:counts(types),perVc:counts(centrals)};}
 return {add,value};
}
export function countFaults(rows=[]){const counter=createFaultCounter();for(const row of rows)counter.add(row);return counter.value();}
