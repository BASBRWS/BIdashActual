/* DVM 154: rekenkeuze voor de dienstband. Meldingen zonder assetkoppeling kunnen buiten
   de band blijven, en een assetbron kan uit de dienstberekening worden gehaald met
   herverdeling van haar gewicht. De standaard (alles telt mee) blijft ongewijzigd. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const bron=read('site/engines/dvm-2.js');
function haalFunctie(tekst,naam){
  const start=tekst.indexOf('function '+naam+'(');
  assert.notEqual(start,-1,'functie '+naam+' niet gevonden');
  let diepte=0;
  for(let j=tekst.indexOf('{',start);j<tekst.length;j++){
    if(tekst[j]==='{')diepte++;
    else if(tekst[j]==='}'&&--diepte===0)return tekst.slice(start,j+1);
  }
  throw new Error('einde van '+naam+' niet gevonden');
}
const haalConst=(tekst,naam)=>{const s=tekst.indexOf('const '+naam+'=');return tekst.slice(s,tekst.indexOf('\n',s));};

function context({liveRijen,meldingen,niet=[],dekking,scope,subprocessen={}}){
  const ctx=vm.createContext({Math,Number,String,Object,Array,Date,Set,Map,JSON,console,
    RULES:{cfg:{liveDekking:{...dekking},...(scope?{dienstScope:scope}:{})}},
    ASSET_REGISTER_STATE:{assets:[
      ...Array.from({length:100},(_,i)=>({key:'msi'+i,tp:'MSI',prognoseActief:true})),
      ...Array.from({length:50},(_,i)=>({key:'drip'+i,tp:'DRIP',prognoseActief:true}))
    ]},
    STATE:{meldingen,nietDoorgerekend:niet,stats:{periodeUren:24}},
    LIVE_STORINGSBRONNEN:[{key:'live',naam:'momentopname.xlsx',rijen:liveRijen}],
    SUBPROCESSEN:subprocessen,
    classificeer:m=>m.typeId||'',normRij:m=>m
  });
  vm.runInContext('gecombineerdeLiveStoringsRijen=function(){return LIVE_STORINGSBRONNEN.flatMap(b=>b.rijen||[]);};',ctx);
  vm.runInContext(haalConst(bron,'V68_TYPES'),ctx);
  vm.runInContext(haalConst(bron,'V68_LABEL'),ctx);
  vm.runInContext(read('site/engines/dvm-1.js').match(/^const OBJ_BRON = \{.*$/m)[0],ctx);
  for(const naam of ['v68DekkingCfg','v68ScopeLees','v68ScopeAangepast','v68Assets','v68LiveBronnenVoorType','v68BronRijenPerType','v68MeldingOnzeker','v68TypeBand','v68TypeStatus','v68ObjType','v68Subproces','v68Dienst'])
    vm.runInContext(haalFunctie(bron,naam),ctx,{filename:naam});
  return ctx;
}
const run=(ctx,code)=>JSON.parse(JSON.stringify(vm.runInContext(code,ctx)));
const msi=(i,extra={})=>({typeId:'MSI',assetKey:'msi'+i,trace:{bijdrageAvail:2,bijdragePerf:1},...extra});
// 8 open MSI-meldingen in de bron: 5 doorgerekend, 3 zonder rij of koppeling.
const basis={liveRijen:Array.from({length:8},()=>({typeId:'MSI'})),meldingen:Array.from({length:5},(_,i)=>msi(i)),dekking:{MSI:true}};

test('standaard en expliciet "alles telt mee" geven exact dezelfde uitkomst als voorheen',()=>{
  const zonder=run(context(basis),'v68TypeStatus()');
  const expliciet=run(context({...basis,scope:{zonderKoppeling:true,uitgesloten:{}}}),'v68TypeStatus()');
  assert.deepEqual(expliciet,zonder);
  assert.equal(zonder.MSI.loB,0,'onbekende koppeling houdt de ondergrens ruim');
  assert.equal(zonder.MSI.besch,null);assert.equal(zonder.MSI.zonderKoppeling,3);
  assert.equal(vm.runInContext('v68ScopeAangepast()',context(basis)),false);
});

test('meldingen zonder assetkoppeling uit: de band sluit op het bekende verlies, telling blijft zichtbaar',()=>{
  const t=run(context({...basis,scope:{zonderKoppeling:false}}),'v68TypeStatus()');
  assert.equal(t.MSI.onplaatsbaar,false);assert.equal(t.MSI.compleet,true);
  // 100 assets x 24 uur; 5 x 2 uur bekend verlies → 99,583%
  assert.ok(t.MSI.besch>99.58&&t.MSI.besch<99.59,String(t.MSI.besch));
  assert.equal(t.MSI.loB,t.MSI.hiB);
  assert.equal(t.MSI.zonderKoppeling,3);assert.equal(t.MSI.inBron,8);assert.equal(t.MSI.nietDoorgerekend,3);
  assert.match(t.MSI.status,/3 meldingen zonder assetkoppeling niet meegerekend/);
});

test('een niet-doorgerekende maar wél gekoppelde melding houdt de band open, ook als het vinkje uit staat',()=>{
  const ctx=context({liveRijen:Array.from({length:6},()=>({typeId:'MSI'})),meldingen:Array.from({length:5},(_,i)=>msi(i)),niet:[{typeId:'MSI',assetKey:'msi42'}],dekking:{MSI:true},scope:{zonderKoppeling:false}});
  const t=run(ctx,'v68TypeStatus()');
  assert.equal(t.MSI.onbekendeAssets,1);assert.equal(t.MSI.compleet,false);assert.ok(t.MSI.loB<t.MSI.hiB);
  assert.equal(t.MSI.zonderKoppeling,0);
});

test('een uitgezette assetbron: gewicht gaat naar de overige bronnen van het subproces',()=>{
  const rijen={liveRijen:[...Array.from({length:5},()=>({typeId:'MSI'})),...Array.from({length:14},()=>({typeId:'DRIP'}))],meldingen:Array.from({length:5},(_,i)=>msi(i)),dekking:{MSI:true,DRIP:true}};
  const metDrip=run(context(rijen),"v68Subproces({naam:'p',gewicht:1,afh:{signalering:0.5,drip:0.5}},v68TypeStatus())");
  assert.equal(metDrip.exact,false,'blinde DRIP houdt de band open');assert.ok(metDrip.loB<metDrip.hiB);
  const ctx=context({...rijen,scope:{uitgesloten:{DRIP:true}}});
  const zonderDrip=run(ctx,"v68Subproces({naam:'p',gewicht:1,afh:{signalering:0.5,drip:0.5}},v68TypeStatus())");
  const alleenMsi=run(context(rijen),"v68Subproces({naam:'p',gewicht:1,afh:{signalering:1}},v68TypeStatus())");
  for(const k of ['loB','hiB','loP','hiP','bekend','exact'])assert.equal(zonderDrip[k],alleenMsi[k],k);
  assert.equal(zonderDrip.exact,true);assert.deepEqual(zonderDrip.uitgeslotenBronnen.map(b=>b.tp),['DRIP']);
  assert.equal(zonderDrip.bronnen.length,1);assert.equal(zonderDrip.bronnen[0].w,1);
  const t=run(ctx,'v68TypeStatus()');assert.equal(t.DRIP.teltMee,false);assert.match(t.DRIP.status,/telt niet mee/);
  assert.equal(vm.runInContext('v68ScopeAangepast()',ctx),true);
});

test('dienst: een subproces zonder meetellende bron valt uit en de rest wordt herwogen',()=>{
  const subprocessen={d1:[{naam:'alleen DRIP',gewicht:3,afh:{drip:1}},{naam:'signalering',gewicht:1,afh:{signalering:1}}]};
  const rijen={liveRijen:Array.from({length:5},()=>({typeId:'MSI'})),meldingen:Array.from({length:5},(_,i)=>msi(i)),dekking:{MSI:true,DRIP:true},subprocessen};
  const ctx=context({...rijen,scope:{uitgesloten:{DRIP:true}}});
  const d=run(ctx,"v68Dienst({id:'d1',naam:'Dienst'},v68TypeStatus())");
  const msiAlleen=run(context(rijen),"v68Subproces({naam:'signalering',gewicht:1,afh:{signalering:1}},v68TypeStatus())");
  assert.equal(d.exact,true);assert.equal(d.uitgesloten,false);
  assert.ok(Math.abs(d.besch-msiAlleen.loB)<1e-9,'alleen het signaleringssubproces telt');
  assert.deepEqual(d.detail.map(r=>[r.naam,r.w,r.uitgesloten]),[['alleen DRIP',0,true],['signalering',1,false]]);
  const alles=run(context({...rijen,scope:{uitgesloten:{DRIP:true,MSI:true}}}),"v68Dienst({id:'d1',naam:'Dienst'},v68TypeStatus())");
  assert.equal(alles.uitgesloten,true);assert.equal(alles.besch,null);assert.equal(alles.exact,false);
});

test('standaardweging van een dienst blijft gelijk zonder uitgezette bronnen',()=>{
  const subprocessen={d1:[{naam:'a',gewicht:3,afh:{drip:1}},{naam:'b',gewicht:1,afh:{signalering:1}}]};
  const rijen={liveRijen:Array.from({length:5},()=>({typeId:'MSI'})),meldingen:Array.from({length:5},(_,i)=>msi(i)),dekking:{MSI:true,DRIP:true},subprocessen};
  const d=run(context(rijen),"v68Dienst({id:'d1',naam:'Dienst'},v68TypeStatus())");
  assert.deepEqual(d.detail.map(r=>r.w),[.75,.25]);assert.equal(d.uitgesloten,false);
});
