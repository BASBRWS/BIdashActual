import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
function runtime(){
 const c=dvmRuntime();
 for(const p of ['site/core/actual-profile.js','site/engines/dvm-actual.js'])vm.runInContext(readFileSync(new URL('../'+p,import.meta.url),'utf8'),c);
 c.now=new Date().toISOString();
 vm.runInContext(`
  const assets=['MN','NWN'].flatMap(vc=>Array.from({length:vc==='MN'?10:5},(_,i)=>({entityid:vc+(i+1),asset:'MSI A4 RE 26.200 '+(i+1),'ci-type':'VKS signaalgevers',regio:vc,status:'Operationeel'})));
  analyseerAssetRegister(assets,'synthetic');
  const fault=(lane,extra={})=>({event_id:'f'+lane,locatie:'A4 RE 26.200',MSI:String(lane),vc:'MN',assettype:'MSI',foutcode:'1003',melding:'Fatale fout bij MSI '+lane,van:now,eerste_gezien:now,laatste_gezien:now,bron_peildatum:now,levenscyclus_status:'OPEN_BEVESTIGD',_liveOpen:true,...extra});
  const raw=[fault(1),fault(2,{levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT',_liveOpen:false})];
  LIVE_STORINGSBRONNEN=[{key:'synthetic',naam:'synthetic',rijen:raw,peildatum:Date.now()}];
  STATE=doorrekenen(raw,{actueel:true,peildatum:Date.now()});RULES.cfg.liveDekking={MSI:true};
  __BIDASH_SIGNAALGEVER_TOTAAL__={laatstePerVc:{mn:Date.now()},snapshotDekking:{mn:{volledig:true}}};
  SUBPROCESSEN.vm=[{naam:'Signaleren',gewicht:1,afh:{signalering:1}}];
 `,c);return c;
}
test('regio en gekozen VC bij Dienstimpact gebruiken dezelfde grenswaarden en noemer',()=>{
 const c=runtime(),mn=c.actualRegioRows().find(r=>r.key==='vc|MN');
 assert.equal(mn.model.assets,10);assert.equal(mn.meldingen.length,1);assert.equal(mn.niet.length,1);assert.equal(mn.liveStoringen,2);
 vm.runInContext("ACTUAL_DIENST_VC='MN'",c);const s=c.actualDienstScherm();
 assert.equal(s.model.typen.MSI.loB,80);assert.equal(s.model.typen.MSI.hiB,90);
 assert.equal(JSON.stringify(s.model),JSON.stringify(mn.model));
 assert.equal(c.v68LandelijkModel().assets,15,'de landelijke adapter blijft het volledige register gebruiken');
});
test('een centrale zonder geladen bron krijgt geen exact 100 procent',()=>{
 const c=runtime(),nwn=c.actualRegioRows().find(r=>r.key==='vc|NWN'),vm=nwn.model.diensten.find(r=>r.d.id==='vm');
 assert.equal(nwn.liveStoringen,0);assert.equal(vm.exact,false);assert.equal(vm.besch,null);assert.equal(vm.loB,0);assert.equal(vm.hiB,100);
 const html=c.actualRegioVergelijkingHtml([nwn]);assert.match(html,/0.00 tot 100.00%/);assert.doesNotMatch(html,/>100.00%/);
});
test('RD-groepering houdt hetzelfde actieve areaal en dezelfde scoped meldingen',()=>{
 const c=runtime();vm.runInContext("RAPPORT_REGIO_MODUS='rd'",c);const r=c.actualRegioRows().find(r=>r.key==='rd|Midden-Nederland');
 assert.equal(r.assets,10);assert.equal(r.model.assets,10);assert.equal(r.liveStoringen,2);assert.equal(r.model.typen.MSI.loB,80);
});
test('niet doorgerekende meldingen zonder registerregio blijven in de regionale verantwoording',()=>{
 const c=runtime();vm.runInContext("STATE.nietDoorgerekend.push({typeId:'MSI',vc:'NON',rekenStatus:'Locatie ontbreekt'})",c);
 const non=c.actualRegioRows().find(r=>r.key==='vc|NON');assert.ok(non);assert.equal(non.assets,0);assert.equal(non.niet.length,1);assert.equal(non.liveStoringen,1);
});
test('de regiofocus bewaart gekoppelde werkzaamheden en de reden voor onbekende impact',()=>{
 const c=runtime();vm.runInContext("WERK_STATE={werken:[{id:'Werk MN',weg:'A4',assetKeys:['ID:MN1']}]}",c);
 const r=c.actualRegioRows().find(r=>r.key==='vc|MN');assert.equal(r.werkIds.size,1);
 const html=c.actualRegioContextHtml(r);assert.match(html,/Werk MN/);assert.match(html,/Actuele toestand onbekend/);
});
test('scope en regioweergave veranderen geen bronnen, impact, instellingen of landelijke band',()=>{
 const c=runtime(),before=vm.runInContext('JSON.stringify([STATE,LIVE_STORINGSBRONNEN,RULES,v68LandelijkModel()])',c);
 c.actualRegioRows();vm.runInContext("ACTUAL_DIENST_VC='MN'",c);c.actualDienstScherm();c.actualDienstOverzichtHtml();
 assert.equal(vm.runInContext('JSON.stringify([STATE,LIVE_STORINGSBRONNEN,RULES,v68LandelijkModel()])',c),before);
});
