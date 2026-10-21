import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';

function runtime(){
 const c=dvmRuntime();c.now=new Date().toISOString();c.old=new Date(Date.now()-72*36e5).toISOString();
 vm.runInContext(`
  const assets=Array.from({length:10},(_,i)=>({entityid:'S'+(i+1),asset:'MSI A4 RE 26.200 '+(i+1),'ci-type':'VKS signaalgevers',regio:'ZWN',status:'Operationeel'}));
  analyseerAssetRegister(assets,'synthetic');
  const fault=(lane,extra={})=>({event_id:'f'+lane,locatie:'A4 RE 26.200',MSI:String(lane),vc:'ZWN',assettype:'MSI',foutcode:'1003',melding:'Fatale fout bij MSI '+lane,van:old,eerste_gezien:old,laatste_gezien:now,bron_peildatum:now,levenscyclus_status:'OPEN_BEVESTIGD',_liveOpen:true,...extra});
  const raw=[fault(1),fault(2,{levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT',_liveOpen:false})];
  LIVE_STORINGSBRONNEN=[{key:'synthetic',naam:'synthetic',rijen:raw,peildatum:Date.now()}];
  STATE=doorrekenen(raw,{actueel:true,peildatum:Date.now()});RULES.cfg.liveDekking={MSI:true};
 `,c);
 return c;
}
const get=c=>c.v68TypeStatus().MSI;
test('een bevestigde bron met één onzeker asset houdt de acht gezonde en de bevestigde uitval in de band',()=>{
 const c=runtime(),b=get(c);
 assert.equal(b.n,10);assert.equal(b.events,1);assert.equal(b.nietDoorgerekend,1);assert.equal(b.onbekendeAssets,1);assert.equal(b.onplaatsbaar,false);
 assert.equal(b.loB,80);assert.equal(b.hiB,90);assert.equal(b.dekking,.9);assert.equal(b.compleet,false);assert.equal(b.besch,null);
 const r=c.v68Subproces({naam:'proef',gewicht:1,afh:{signalering:.5,drip:.5}},c.v68TypeStatus());
 assert.equal(r.loB,40);assert.equal(r.hiB,95);assert.equal(r.bekend,.45);assert.equal(r.exact,false);
});
test('uitvinken verruimt alleen het onbevestigde deel; bevestigde uitval blijft de bovengrens beperken',()=>{
 const c=runtime();vm.runInContext('RULES.cfg.liveDekking.MSI=false',c);const b=get(c);
 assert.equal(b.loB,0);assert.equal(b.hiB,90);assert.equal(b.dekking,0);assert.equal(b.besch,null);
});
test('beschikbaarheid en prestatie behouden hun eigen verlies en gewogen subprocesband',()=>{
 const c=runtime();vm.runInContext('STATE.meldingen[0].trace.bijdragePerf=12;STATE.meldingen[0].trace.overlapCorrectie.ruwePerf=12',c);
 const b=get(c);assert.equal(b.loB,80);assert.equal(b.hiB,90);assert.equal(b.loP,85);assert.equal(b.hiP,95);
 const r=c.v68Subproces({naam:'proef',afh:{signalering:.5,drip:.5}},c.v68TypeStatus());
 assert.equal(r.loP,42.5);assert.equal(r.hiP,97.5);assert.equal(r.exact,false);
});
test('dienstverlening weegt beide grenzen en de brondekking met de ingestelde subprocesaandelen',()=>{
 const c=runtime();vm.runInContext("SUBPROCESSEN.vm=[{naam:'signaleren',gewicht:.75,afh:{signalering:1}},{naam:'informeren',gewicht:.25,afh:{drip:1}}]",c);
 const r=c.v68LandelijkModel().diensten.find(r=>r.d.id==='vm');
 assert.equal(r.loB,60);assert.equal(r.hiB,92.5);assert.equal(r.dekking,.675);assert.equal(r.besch,null);assert.equal(r.exact,false);
});
test('een ontbrekend positief subprocesaandeel levert geen exact dienstpercentage',()=>{
 const c=runtime();vm.runInContext("SUBPROCESSEN.vm=[{naam:'leeg aandeel',gewicht:0,afh:{signalering:1}}]",c);
 const r=c.v68LandelijkModel().diensten.find(r=>r.d.id==='vm');assert.equal(r.exact,false);assert.equal(r.besch,null);
});
test('meerdere onzekere meldingen op hetzelfde asset maken geen extra onzekere assets',()=>{
 const c=runtime();vm.runInContext("STATE.nietDoorgerekend.push({...STATE.nietDoorgerekend[0],eventId:'extra',code:'1001'})",c);
 const b=get(c);assert.equal(b.onbekendeAssets,1);assert.equal(b.loB,80);assert.equal(b.hiB,90);
});
test('verouderde uitval is geen bewezen actuele uitval en wordt alleen als onzeker asset begrensd',()=>{
 const c=runtime();vm.runInContext('STATE.meldingen[0].laatste_gezien=old',c);const b=get(c);
 assert.equal(b.loB,80);assert.equal(b.hiB,100);assert.equal(b.onbekendeAssets,2);assert.equal(b.bekendAvailLoss,0);
});
test('onbekende locatie of foutregel kan de bevestigde uitval niet wissen of exact maken',()=>{
 const c=runtime();vm.runInContext("STATE.nietDoorgerekend[0].assetKey='';STATE.nietDoorgerekend[0].hm=null",c);const b=get(c);
 assert.equal(b.loB,0);assert.equal(b.hiB,90);assert.equal(b.onplaatsbaar,true);assert.equal(b.besch,null);
});
test('een onzekere melding vóór bevestigde uitval op hetzelfde asset verlaagt de bewezen uitval niet door overlap',()=>{
 const c=runtime();vm.runInContext(`
  STATE=doorrekenen([fault(1,{event_id:'old',laatste_gezien:old}),fault(1,{event_id:'new'})],{actueel:true,peildatum:Date.now()});
 `,c);const b=get(c);
 assert.equal(b.bekendAvailLoss,24);assert.equal(b.loB,90);assert.equal(b.hiB,90);assert.equal(b.compleet,false);
});
test('zonder onzekere of ontbrekende meldingen blijft een volledige bron exact',()=>{
 const c=runtime();vm.runInContext('STATE=doorrekenen([fault(1)],{actueel:true,peildatum:Date.now()});LIVE_STORINGSBRONNEN[0].rijen=[fault(1)]',c);
 const b=get(c);assert.equal(b.loB,90);assert.equal(b.hiB,90);assert.equal(b.besch,90);assert.equal(b.dekking,1);assert.equal(b.compleet,true);
});
test('een MTM-bron voor één VC bewijst geen gezonde assets in een andere VC',()=>{
 const c=runtime();vm.runInContext("ASSET_REGISTER_STATE.assets[9].vc='MN';__BIDASH_SIGNAALGEVER_TOTAAL__={laatstePerVc:{zwn:Date.now()},snapshotDekking:{zwn:{volledig:true}}}",c);const b=get(c);
 assert.equal(b.loB,70);assert.equal(b.hiB,90);assert.equal(b.dekking,.8);assert.equal(b.onbekendeAssets,2);
});
test('onvolledige VC-bron en stapeling krijgen geen verzonnen nauwe ondergrens',()=>{
 const c=runtime();vm.runInContext("__BIDASH_SIGNAALGEVER_TOTAAL__={laatstePerVc:{zwn:Date.now()},snapshotDekking:{zwn:{volledig:false}}}",c);assert.equal(get(c).loB,0);assert.equal(get(c).hiB,90);
 vm.runInContext("__BIDASH_SIGNAALGEVER_TOTAAL__=null;RULES.cfg.impactModel='stapel'",c);assert.equal(get(c).loB,0);assert.equal(get(c).hiB,90);
});
test('lege VC-dekking of een ongeldige bronpeildatum bewijst geen storingsvrij areaal',()=>{
 const c=runtime();vm.runInContext('__BIDASH_SIGNAALGEVER_TOTAAL__={laatstePerVc:{}}',c);assert.equal(get(c).loB,0);assert.equal(get(c).hiB,90);
 vm.runInContext('__BIDASH_SIGNAALGEVER_TOTAAL__={laatstePerVc:{zwn:null}}',c);assert.equal(get(c).loB,0);assert.equal(get(c).dekking,0);
});
test('een opslag door een onzekere combipartner is geen bewezen extra uitval',()=>{
 const c=runtime();vm.runInContext(`
  RULES.combiRegels=[{id:'test',actief:true,type1:'MSI',code1:'1001',type2:'MSI',code2:'1003',maxKm:1,venMin:30,extraAvail:25,extraPerf:25,capAvail:100,capPerf:100}];
  STATE=doorrekenen([fault(1,{foutcode:'1001',melding:'Fout in lampcircuit bij MSI 1'}),fault(2,{laatste_gezien:old})],{actueel:true,peildatum:Date.now()});
 `,c);const b=get(c);
 assert.equal(b.combiOnzeker,true);assert.equal(b.compleet,false);assert.equal(b.loB,80);
 assert.equal(b.hiB,98.5);assert.equal(b.hiP,97);assert.ok(Math.abs(b.bekendAvailLoss-3.6)<1e-9);
});
test('een aangepaste combiregel die impact kan verlagen houdt ook de bovengrens ruim',()=>{
 const c=runtime();vm.runInContext(`
  RULES.combiRegels=[{id:'test',actief:true,type1:'MSI',code1:'1001',type2:'MSI',code2:'1003',maxKm:1,venMin:30,extraAvail:0,extraPerf:0,capAvail:0,capPerf:0}];
  STATE=doorrekenen([fault(1,{foutcode:'1001',melding:'Fout in lampcircuit bij MSI 1'}),fault(2,{laatste_gezien:old})],{actueel:true,peildatum:Date.now()});
 `,c);const b=get(c);assert.equal(b.loB,80);assert.equal(b.hiB,100);assert.equal(b.compleet,false);
});
test('bandberekening verandert geen ruwe incidenten, overlapcorrectie of impactuitkomsten',()=>{
 const c=runtime(),before=vm.runInContext('JSON.stringify([LIVE_STORINGSBRONNEN,STATE])',c);get(c);get(c);
 assert.equal(vm.runInContext('JSON.stringify([LIVE_STORINGSBRONNEN,STATE])',c),before);
});
