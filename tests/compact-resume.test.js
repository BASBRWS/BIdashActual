import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
const plain=x=>JSON.parse(JSON.stringify(x));
const empty=()=>({open:[],historie:[],laatstePerVc:{},snapshotDekking:{}});
function runtime(){const c=dvmRuntime();c.setTimeout=setTimeout;for(const f of ['dvm-storingsbundelaar.js','dvm-mtm-open-dumps.js','dvm-source-export-completeness.js'])vm.runInContext(readFileSync(new URL('../site/engines/'+f,import.meta.url),'utf8'),c);c.BIDASH_ACTUAL={};return c;}
function file(day,ids,{vc='mn',hour='12:00',sequence=1,onRead=()=>{},text}={}){
 const name=String(day).padStart(2,'0')+'1026_'+sequence+'_openstaandestoringen.txt';
 return {name,_pad:`mtm/${vc}/storinglijst/2026/10/${day}/${name}`,arrayBuffer:async()=>{onRead();return new TextEncoder().encode(text??String(day).padStart(2,'0')+'-10-2026 '+hour+'\n'+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n')).buffer;}};
}
async function seed(c){
 const d=c.DVM_MTM_OPEN_DUMPS,files=[file(14,[1,2]),file(15,[2]),file(15,[9],{vc:'nwn'})];
 return d.process(empty(),(await d.read(files,{vcs:new Set(['mn','nwn'])})).snapshots);
}
function backup(c,state){
 c.stand=state;vm.runInContext("STORINGSBRONNEN=[{key:'signaalgever-totaal-historie',_signaalgeverTotaal:true,rijen:stand.historie}];LIVE_STORINGSBRONNEN=[{key:'signaalgever-totaal-open',_signaalgeverTotaal:true,rijen:stand.open}];__BIDASH_SIGNAALGEVER_TOTAAL__={laatstePerVc:stand.laatstePerVc,snapshotDekking:stand.snapshotDekking};var total=totaalExportBundle({storingshistorie:true,liveStoringen:true,parameters:false});",c);
 return plain(c.DVM_COMPACT.packDvm(c.total));
}
const sortRows=rows=>plain(rows).sort((a,b)=>a._mtmSleutel.localeCompare(b._mtmSleutel));
test('compacte totaalexport herstelt de lopende 48-uursklok en vervolgt per VC zonder oude bestanden te lezen',async()=>{
 const c=runtime(),s=await seed(c),packed=backup(c,s),loaded=c.__BIDASH_STORINGSBUNDELAAR__.sbSignaalgeverBasis(packed);
 assert.equal(loaded.open.find(r=>r.event_id==='1').afwezig_sinds,'2026-10-15T10:00:00.000Z');
 let oldReads=0;const files=[file(14,[1,2],{onRead:()=>oldReads++}),file(15,[2]),file(16,[2,3]),file(17,[2,3])];
 const result=await c.DVM_MTM_OPEN_DUMPS.run(loaded,files,{vcs:new Set(['mn']),hervatten:true});
 assert.equal(oldReads,0);assert.equal(result.overgeslagenBestanden,1);assert.equal(result.nieuweSnapshots,2);assert.equal(result.result.open.length,3);
 const closed=result.result.historie.find(r=>r.event_id==='1');assert.equal(closed.levenscyclus_status,'HERSTELD_AFGELEID');assert.equal(closed.herstel_bevestiging_op,'2026-10-17T10:00:00.000Z');assert.equal(closed.hersteld_op,null);
 assert.equal(result.result.historie.filter(r=>r.event_id==='2').length,1);assert.equal(result.result.open.find(r=>r.event_id==='2').incident_id,s.open.find(r=>r.event_id==='2').incident_id);
 assert.deepEqual(plain(result.result.open.filter(r=>r.vc==='nwn')),plain(s.open.filter(r=>r.vc==='nwn')));assert.equal(result.result.laatstePerVc.nwn,s.laatstePerVc.nwn);
 const all=c.DVM_MTM_OPEN_DUMPS.process(empty(),(await c.DVM_MTM_OPEN_DUMPS.read([...files,file(15,[9],{vc:'nwn'})],{vcs:new Set(['mn','nwn'])})).snapshots);
 assert.deepEqual(sortRows(result.result.open),sortRows(all.open));assert.deepEqual(sortRows(result.result.historie),sortRows(all.historie));
});
test('nogmaals dezelfde export en map verwerken maakt geen incidenten of afwezigheidswaarnemingen bij',async()=>{
 const c=runtime(),s=await seed(c),restored=c.__BIDASH_STORINGSBUNDELAAR__.sbSignaalgeverBasis(backup(c,s));
 const r=await c.DVM_MTM_OPEN_DUMPS.run(restored,[file(14,[1,2]),file(15,[2])],{vcs:new Set(['mn']),hervatten:true});
 assert.equal(r.nieuweSnapshots,0);assert.deepEqual(sortRows(r.result.open),sortRows(s.open));assert.deepEqual(sortRows(r.result.historie),sortRows(s.historie));
 assert.deepEqual(plain(r.result.snapshotDekking),plain(s.snapshotDekking));
 assert.equal(r.result.open.find(r=>r.event_id==='1').ontbrekend_volledige_snapshots,1);
});
test('ontbrekende dagen na hervatten herstarten de afwezigheidsklok en maken geen vervroegd herstel',async()=>{
 const c=runtime(),s=await seed(c),r=await c.DVM_MTM_OPEN_DUMPS.run(s,[file(17,[2])],{vcs:new Set(['mn']),hervatten:true});
 const pending=r.result.open.find(r=>r.event_id==='1');assert.ok(pending);assert.equal(pending.afwezig_sinds,'2026-10-17T10:00:00.000Z');assert.equal(pending.levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');
});
test('terugkeer na hervatten onderbreekt de bestaande wachttijd',async()=>{
 const c=runtime(),s=await seed(c),r=await c.DVM_MTM_OPEN_DUMPS.run(s,[file(16,[1,2]),file(17,[2])],{vcs:new Set(['mn']),hervatten:true});
 assert.equal(r.result.open.find(r=>r.event_id==='1').afwezig_sinds,'2026-10-17T10:00:00.000Z');assert.equal(r.result.historie.filter(r=>r.event_id==='1').length,1);
});
test('een herhaalde laatste bron met andere inhoud stopt zonder de herstelde stand te wijzigen',async()=>{
 const c=runtime(),s=await seed(c),before=plain(s);await assert.rejects(c.DVM_MTM_OPEN_DUMPS.run(s,[file(15,[99])],{vcs:new Set(['mn']),hervatten:true}),/Tegenstrijdige/);assert.deepEqual(plain(s),before);
});
test('hervatten is uit te zetten voor een volledige historische herverwerking',async()=>{
 const c=runtime(),s=await seed(c);let reads=0;const r=await c.DVM_MTM_OPEN_DUMPS.run(s,[file(14,[1,2],{onRead:()=>reads++}),file(15,[2],{onRead:()=>reads++})],{vcs:new Set(['mn']),hervatten:false});assert.equal(reads,2);assert.equal(r.overgeslagenBestanden,0);assert.deepEqual(sortRows(r.result.open),sortRows(s.open));
});
test('oudere blokken binnen de laatste bestandsdag zetten het hervatpunt niet terug',async()=>{
 const c=runtime(),d=c.DVM_MTM_OPEN_DUMPS;
 const s=d.process(empty(),(await d.read([file(15,[1],{hour:'16:00'})],{vcs:new Set(['mn'])})).snapshots);
 const text='15-10-2026 12:00\n|99|1003|1003 Fatale fout bij MSI 99|A77 R 12,000|01-01-2024 00:00|\n15-10-2026 16:00\n|1|1003|1003 Fatale fout bij MSI 1|A77 R 12,000|01-01-2024 00:00|';
 const r=await d.run(s,[file(15,[],{text}),file(15,[1,2],{hour:'18:00',sequence:2})],{vcs:new Set(['mn']),hervatten:true});
 assert.equal(r.overgeslagenSnapshots,1);assert.equal(r.nieuweSnapshots,1);assert.deepEqual(plain(r.result.open.map(r=>r.event_id).sort()),['1','2']);assert.equal(r.result.historie.some(r=>r.event_id==='99'),false);
});
