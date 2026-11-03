import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
const plain=x=>JSON.parse(JSON.stringify(x));
const empty=()=>({open:[],historie:[],laatstePerVc:{},snapshotDekking:{}});
function runtime(){const c=dvmRuntime();c.setTimeout=(fn,ms)=>{const t=setTimeout(fn,ms);if(ms>1000)t.unref();return t;};for(const f of ['dvm-storingsbundelaar.js','dvm-mtm-open-dumps.js'])vm.runInContext(readFileSync(new URL('../site/engines/'+f,import.meta.url),'utf8'),c);return c;}
function file(day,rows,{hour='12:00',vc='nwn',extra=''}={}){
 const [y,m,d]=day.split('-'),name=d+m+y.slice(2)+'_1_openstaandestoringen.txt';
 const line=(id,start)=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|${start||'01-01-2024 00:00'}|`;
 const text=`${d}-${m}-${y} ${hour}\n`+rows.map(r=>Array.isArray(r)?line(...r):line(r)).join('\n')+extra;
 return {name,_pad:`mtm/${vc}/storinglijst/${y}/${m}/${d}/${name}`,arrayBuffer:async()=>new TextEncoder().encode(text).buffer};
}
const run=(c,s,files)=>c.DVM_MTM_OPEN_DUMPS.run(s,files,{vcs:new Set(['nwn']),hervatten:true});
test('17 minuten latere alarmstart behoudt alle meldingen, bronklokken en waarschuwing zonder veilige dekking te claimen',async()=>{
 const c=runtime(),logs=[];c.BIDASH_DIAGNOSTICS={record:(...args)=>logs.push(args)};
 const f=file('2026-07-27',[1,[2,'27-07-2026 00:47']],{hour:'00:30'}),r=(await run(c,empty(),[f])).result;
 assert.equal(r.open.length,2);assert.equal(r.historie.length,2);assert.ok(r.open.every(r=>r.levenscyclus_status==='ONBEKEND_DOOR_BRONGAT'&&r._liveOpen===false&&r.bron_kop_afwijking));
 assert.equal(r.open[1].van,'2026-07-26T22:47:00.000Z');assert.ok(r.open.every(r=>r.eerste_gezien===null&&r.laatste_gezien===null&&r.afwezig_sinds===null));
 const d=r.snapshotDekking.nwn;assert.equal(d.snapshot,'2026-07-26T22:30:00.000Z');assert.equal(r.laatstePerVc.nwn,Date.parse(d.snapshot));assert.equal(d.bronKopdatum,d.snapshot);assert.equal(d.tijdprecisie,'onzeker');assert.equal(d.volledig,false);assert.equal(d.structuurVolledig,true);assert.equal(d.sluitenToegestaan,false);assert.equal(d.alarmNaKop,1);assert.equal(d.laatsteAlarmdatum,'2026-07-26T22:47:00.000Z');assert.equal(d.waarnemingVan,null);assert.equal(d.waarnemingTot,null);assert.equal(r.levenscyclusAudit.snapshotBalans,true);assert.equal(r.levenscyclusAudit.bronDekkingVolledig,false);
 assert.equal(logs.length,1);assert.equal(logs[0][0],'warn');assert.equal(logs[0][1],'mtm.dump.clock-conflict');assert.equal(logs[0][2].differenceMinutes,17);
 const again=(await run(c,r,[f])).result;assert.deepEqual(plain(again.open),plain(r.open));assert.deepEqual(plain(again.historie),plain(r.historie));assert.deepEqual(plain(again.snapshotDekking),plain(r.snapshotDekking));
});
test('een tijdsafwijkende dump sluit geen oude afwezige storing op de 48-uursgrens en reset de wachttijd',async()=>{
 const c=runtime();let r=(await run(c,empty(),[file('2026-07-14',[1,2]),file('2026-07-15',[2]),file('2026-07-16',[2])])).result;
 const known=r.open.find(r=>r.event_id==='2').laatste_gezien,id=r.open.find(r=>r.event_id==='1').incident_id;
 r=(await run(c,r,[file('2026-07-17',[2,[3,'17-07-2026 12:17']])])).result;
 assert.equal(r.open.find(r=>r.event_id==='1').afwezig_sinds,null);assert.equal(r.open.find(r=>r.event_id==='1').ontbrekend_volledige_snapshots,0);assert.equal(r.open.find(r=>r.event_id==='1').levenscyclus_status,'ONBEKEND_DOOR_BRONGAT');assert.equal(r.historie.find(r=>r.event_id==='1').herstel_bevestiging_op,null);assert.equal(r.open.find(r=>r.event_id==='2').laatste_gezien,known);
 // Totaalexport en import bewaren ook de onzekere stand zonder de klok te repareren.
 const b={formaat:'DVM-dienstimpact-totaal',storingshistorie:[{_signaalgeverTotaal:true,rijen:r.historie}],liveStoringen:[{_signaalgeverTotaal:true,rijen:r.open}],bronbeheer:{signaalgeverTotaal:{laatstePerVc:r.laatstePerVc,snapshotDekking:r.snapshotDekking}}};
 r=c.__BIDASH_STORINGSBUNDELAAR__.sbSignaalgeverBasis(plain(c.DVM_COMPACT.packDvm(b)));
 for(const d of [18,19,20]){
  r=(await run(c,r,[file('2026-07-'+d,[2,[3,'17-07-2026 12:17']])])).result;
  if(d<20){assert.equal(r.open.find(r=>r.event_id==='1').afwezig_sinds,'2026-07-18T10:00:00.000Z');assert.equal(r.open.find(r=>r.event_id==='1').bron_kop_afwijking,false);}
 }
 const closed=r.historie.find(r=>r.event_id==='1');assert.equal(closed.incident_id,id);assert.equal(closed.levenscyclus_status,'HERSTELD_AFGELEID');assert.equal(closed.herstel_bevestiging_op,'2026-07-20T10:00:00.000Z');assert.equal(closed.hersteld_op,null);assert.equal(r.open.find(r=>r.event_id==='2').laatste_gezien,'2026-07-20T10:00:00.000Z');assert.equal(r.open.find(r=>r.event_id==='3').levenscyclus_status,'OPEN_BEVESTIGD');
});
test('een later correct dumpblok bevestigt aanwezigheid en begint pas zelf een nieuwe afwezigheidsmeting',async()=>{
 const c=runtime(),first=(await run(c,empty(),[file('2026-07-26',[1])])).result;
 const extra='\n27-07-2026 23:30\n|2|1003|1003 Fatale fout bij MSI 2|A77 R 12,000|27-07-2026 00:47|';
 const r=(await run(c,first,[file('2026-07-27',[[2,'27-07-2026 00:47']],{hour:'00:30',extra})])).result;
 assert.equal(r.snapshotDekking.nwn.kopAfwijkendeSnapshots,1);assert.equal(r.snapshotDekking.nwn.kopAfwijking,false);assert.equal(r.snapshotDekking.nwn.volledig,true);assert.equal(r.open.find(r=>r.event_id==='1').afwezig_sinds,'2026-07-27T21:30:00.000Z');assert.equal(r.open.find(r=>r.event_id==='2').eerste_gezien,'2026-07-27T21:30:00.000Z');assert.equal(r.open.find(r=>r.event_id==='2').bron_kop_afwijking,false);
});
test('volgende-dag alarmen, kapotte regels en conflicterende gelijke koppen blijven fouten vóór wijziging',async()=>{
 const c=runtime(),basis=(await run(c,empty(),[file('2026-07-26',[1])])).result,before=plain(basis);
 await assert.rejects(run(c,basis,[file('2026-07-27',[[2,'28-07-2026 00:01']],{hour:'00:30'})]),/Ongeldige alarmdatum/);
 await assert.rejects(run(c,basis,[file('2026-07-27',[2],{extra:'\n|kapot'})]),/alarmregel/);
 await assert.rejects(run(c,basis,[file('2026-07-27',[2],{extra:'\n27-07-2026 12:00\n|3|1003|1003 Fatale fout bij MSI 3|A77 R 12,000|01-01-2024 00:00|'})]),/Tegenstrijdige/);
 assert.deepEqual(plain(basis),before);
});
test('een niet geselecteerde verkeerscentrale verandert niet bij een klokafwijking in NWN',async()=>{
 const c=runtime(),other=(await c.DVM_MTM_OPEN_DUMPS.run(empty(),[file('2026-07-27',[9],{vc:'mn'})],{vcs:new Set(['mn'])})).result;
 const r=(await run(c,other,[file('2026-07-27',[[1,'27-07-2026 00:47']],{hour:'00:30'})])).result;
 assert.deepEqual(plain(r.open.filter(x=>x.vc==='mn')),plain(other.open));assert.deepEqual(plain(r.snapshotDekking.mn),plain(other.snapshotDekking.mn));assert.equal(r.laatstePerVc.mn,other.laatstePerVc.mn);
});
