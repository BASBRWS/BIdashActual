import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
function runtime(){const c=dvmRuntime();c.setTimeout=setTimeout;c.clearTimeout=clearTimeout;for(const f of ['dvm-storingsbundelaar.js','dvm-mtm-open-dumps.js'])vm.runInContext(readFileSync(new URL('../site/engines/'+f,import.meta.url),'utf8'),c);return c;}
const empty=()=>({open:[],historie:[],laatstePerVc:{},snapshotDekking:{},histRest:[],liveRest:[]});
const plain=x=>JSON.parse(JSON.stringify(x));
function file(day,ids,{vc='mn',hour='12:00',start='01-01-2024 00:00',sequence=1,text,read}={}){
 const [y,m,d]=day.split('-'),name=d+m+y.slice(2)+'_'+sequence+'_openstaandestoringen.txt';
 const body=text??`${d}-${m}-${y} ${hour}\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|${start}|`).join('\n');
 return {name,_pad:`mtm/${vc}/storinglijst/${y}/${m}/${d}/${name}`,arrayBuffer:async()=>{read?.();return new TextEncoder().encode(body).buffer;}};
}
async function read(c,files,cfg={}){return c.DVM_MTM_OPEN_DUMPS.read(files,{vcs:new Set(['mn']),...cfg});}
test('leest alle kleine dumps op volgorde uit een gemengde map en slaat grote BSS-bestanden over',async()=>{
 const c=runtime();let reads=0;
 const files=[16,14,15].map(d=>file('2026-10-'+d,[d],{read:()=>reads++}));
 files.push(...Array.from({length:4000},(_,i)=>({name:i+'storinglijst.txt',_pad:`mtm/mn/storinglijst/2026/10/16/${i}storinglijst.txt`,arrayBuffer:async()=>{throw Error('BSS gelezen');}})));
 const {snapshots,selected}=await read(c,files),r=c.DVM_MTM_OPEN_DUMPS.process(empty(),snapshots);
 assert.equal(reads,3);assert.equal(selected,3);assert.deepEqual(plain(snapshots.map(s=>s.day)),[14,15,16].map(d=>Date.UTC(2026,9,d)));
 assert.deepEqual(plain(r.open.map(r=>r.event_id).sort()),['14','15','16']);assert.equal(r.levenscyclusAudit.administratiefSluitend,true);
});
test('dag 1 aanwezig, dag 2 afwezig, dag 3 nog open, dag 4 na 48 uur sinds eerste afwezigheid opgelost',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;let r=empty();
 for(const day of [14,15,16,17]){
  r=D.process(r,(await read(c,[file('2026-10-'+day,day===14?[1]:[])])).snapshots);
  assert.equal(r.open.length,day<17?1:0);
  if(day===15||day===16){assert.equal(r.historie[0].levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');assert.equal(r.open[0].afwezig_sinds,'2026-10-15T10:00:00.000Z');}
 }
 assert.equal(r.historie[0].levenscyclus_status,'HERSTELD_AFGELEID');assert.equal(r.historie[0].hersteld_op,null);assert.equal(r.historie[0].herstel_bevestiging_op,'2026-10-17T10:00:00.000Z');
 assert.equal(r.historie[0].herstel_venster_van,'2026-10-14T10:00:00.000Z');assert.equal(r.historie[0].herstel_venster_tot,'2026-10-15T10:00:00.000Z');
});
test('terugkeer op een tussendag behoudt incident en wist de wachttijd, daarna begint een nieuwe termijn',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;let r=empty(),id;
 for(const day of [14,15,16,17,18,19]){
  r=D.process(r,(await read(c,[file('2026-10-'+day,[14,16].includes(day)?[1]:[])])).snapshots);
  id??=r.historie[0].incident_id;assert.equal(r.historie[0].incident_id,id);assert.equal(r.open.length,day<19?1:0);
  if(day===16){assert.equal(r.open[0].afwezig_sinds,null);assert.equal(r.open[0].levenscyclus_status,'OPEN_BEVESTIGD');}
  if(day===18)assert.equal(r.open[0].afwezig_sinds,'2026-10-17T10:00:00.000Z');
 }
 assert.equal(r.historie.length,1);assert.equal(r.historie[0].levenscyclus_status,'HERSTELD_AFGELEID');
});
test('een hele reeks tegelijk geeft dezelfde incidenten en timers als import per dag en JSON hervatten',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS,files=[file('2026-10-14',[1,2]),file('2026-10-15',[2]),file('2026-10-16',[1,3]),file('2026-10-17',[3]),file('2026-10-18',[3]),file('2026-10-19',[3])];
 const batch=D.process(empty(),(await read(c,files)).snapshots);let daily=empty();for(const f of files)daily=D.process(plain(daily),(await read(c,[f])).snapshots);
 assert.deepEqual(plain(batch.open),plain(daily.open));assert.deepEqual(plain(batch.historie),plain(daily.historie));assert.deepEqual(plain(batch.open.map(r=>r.event_id)),['3']);
 const again=D.process(batch,(await read(c,files)).snapshots);assert.deepEqual(plain(again.open),plain(batch.open));assert.deepEqual(plain(again.historie),plain(batch.historie));
});
test('47 uur 59 minuten afwezig blijft open; exact 48 uur sluit, ook bij een jarenoude storing',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;let r=D.process(empty(),(await read(c,[file('2026-10-14',[1]),file('2026-10-15',[]),file('2026-10-16',[]),file('2026-10-17',[],{hour:'11:59'})])).snapshots);
 assert.equal(r.open.length,1);r=D.process(r,(await read(c,[file('2026-10-17',[],{hour:'12:00'})])).snapshots);assert.equal(r.open.length,0);
});
test('ontbrekende brondag levert geen doorlopende afwezigheid op en herstart de termijn',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;
 let r=D.process(empty(),(await read(c,[file('2026-10-14',[1]),file('2026-10-15',[]),file('2026-10-17',[])])).snapshots);
 assert.equal(r.open.length,1);assert.equal(r.open[0].afwezig_sinds,'2026-10-17T10:00:00.000Z');assert.equal(r.snapshotDekking.mn.bronGap,true);
 r=D.process(r,(await read(c,[file('2026-10-18',[]),file('2026-10-19',[])])).snapshots);assert.equal(r.open.length,0);
});
test('hele lege complete dumps sluiten na 48 uur afwezigheid ook een sterke volumedaling',async()=>{
 const c=runtime();const r=c.DVM_MTM_OPEN_DUMPS.process(empty(),(await read(c,[file('2026-10-14',Array.from({length:25},(_,i)=>i+1)),file('2026-10-15',[]),file('2026-10-16',[]),file('2026-10-17',[])])).snapshots);
 assert.equal(r.open.length,0);assert.equal(r.historie.length,25);assert(r.historie.every(r=>r.levenscyclus_status==='HERSTELD_AFGELEID'&&r.hersteld_op===null));assert.equal(r.snapshotDekking.mn.volumeVerdacht,false);
});
test('andere VC en onafhankelijke bronnen blijven behouden, oudere mapsnede wijzigt actuele stand niet',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;
 const nwn=D.process(empty(),(await read(c,[file('2026-10-16',[9],{vc:'nwn'})],{vcs:new Set(['nwn'])})).snapshots);nwn.histRest=[{key:'camera'}];nwn.liveRest=[{key:'drip'}];
 const r=D.process(nwn,(await read(c,[file('2026-10-14',[1,2]),file('2026-10-15',[2]),file('2026-10-16',[2]),file('2026-10-17',[2])])).snapshots);
 assert.deepEqual(plain(r.open.map(r=>r.vc+'|'+r.event_id).sort()),['mn|2','nwn|9']);assert.equal(r.histRest,nwn.histRest);assert.equal(r.liveRest,nwn.liveRest);
 const older=D.process(r,(await read(c,[file('2026-10-13',[3])])).snapshots);assert.deepEqual(plain(older.open),plain(r.open));assert.equal(older.updates.mn.ouder,true);
});
test('herimport van een volledige dagreeks corrigeert herstel dat 2.63 te vroeg had afgeleid',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS,first=(await read(c,[file('2026-10-14',[1])])).snapshots;let old=D.process(empty(),first),row=old.historie[0];
 old={...old,open:[],historie:[{...row,bron_peildatum:'2026-10-16T10:00:00.000Z',levenscyclus_status:'HERSTELD_AFGELEID',status:'gesloten_afgeleid',_liveOpen:false}],laatstePerVc:{mn:Date.parse('2026-10-16T10:00:00.000Z')},snapshotDekking:{mn:{bronType:D.FORMAT}}};
 const r=D.process(old,(await read(c,[file('2026-10-14',[1]),file('2026-10-15',[]),file('2026-10-16',[])])).snapshots);assert.equal(r.open.length,1);assert.equal(r.open[0].incident_id,row.incident_id);assert.equal(r.open[0].levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');
});
test('zelfde bronmoment met andere meldingen wordt niet als nieuwere stand geaccepteerd',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;const r=D.process(empty(),(await read(c,[file('2026-10-16',[1])])).snapshots),before=plain(r);
 const conflict=(await read(c,[file('2026-10-16',[2])])).snapshots;assert.throws(()=>D.process(r,conflict),/Tegenstrijdige/);assert.deepEqual(plain(r),before);
 const changed=(await read(c,[file('2026-10-16',[],{text:'16-10-2026 12:00\n|1|1003|1003 Fatale fout bij MSI 2|A77 R 12,000|01-01-2024 00:00|'})])).snapshots;assert.throws(()=>D.process(r,changed),/Tegenstrijdige/);
});
test('een alarm na zijn eigen dumpkop blijft een bronfout en wordt niet met een verzonnen peiltijd geaccepteerd',async()=>{
 const c=runtime();await assert.rejects(read(c,[file('2025-10-26',[1],{hour:'00:30',start:'26-10-2025 23:29'})]),/eigen dumpkop/);
});
test('Nederlandse zomer/wintertijd wordt onafhankelijk van browsertijdzone gelezen',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;
 const a=await read(c,[file('2025-10-23',[1]),file('2025-10-24',[]),file('2025-10-25',[]),file('2025-10-26',[])]);
 const r=D.process(empty(),a.snapshots);assert.equal(r.snapshotDekking.mn.vergelijkingUren,73);assert.equal(r.historie[0].levenscyclus_status,'HERSTELD_AFGELEID');
});
test('kapotte regel, kop op andere dag, volgende-dag alarm, onbekende afsluittekst en afgebroken bestanden stoppen vóór wijziging',async()=>{
 const c=runtime();
 for(const text of ['','16-10-2026 12:00\n|1|kapot','15-10-2026 12:00','16-10-2026 12:00\nonvolledig','16-10-2026 12:00\n|1|1003|1003 MSI 1|A77 R 1,000|17-10-2026 01:00|','16-10-2026 12:00\n|1|1003|1003 MSI 1|A77 R 1,000|16-10-2026 01:00|\n|afgebroken'])await assert.rejects(read(c,[file('2026-10-16',[],{text})]));
});
test('periodeselectie begrenst bestandsdagen, een oude nog open storing blijft staan',async()=>{
 const c=runtime();const wrongVc=file('2026-10-16',[8],{vc:'nwn'});wrongVc.name='999999_1_openstaandestoringen.txt';const wrongOld=file('2026-10-14',[9]);wrongOld.name='999999_1_openstaandestoringen.txt';const files=[wrongVc,wrongOld,file('2026-10-14',[1]),file('2026-10-16',[2])],r=c.DVM_MTM_OPEN_DUMPS.process(empty(),(await read(c,files,{vanaf:'2026-10-15',tot:'2026-10-16'})).snapshots);
 assert.equal(r.open.length,1);assert.match(r.open[0].van,/2023-12-31/);assert.equal(r.snapshotDekking.mn.vergelijkingBestand,null);
});
test('dubbele bronregels worden eenmaal geteld met behoud van bronbalans en light-historie',async()=>{
 const c=runtime(),basis=empty();basis.historie=[{locatie:'oud',start:'2024-01-01'},{locatie:'oud',start:'2024-01-01'}];
 const r=c.DVM_MTM_OPEN_DUMPS.process(basis,(await read(c,[file('2026-10-16',[1,1])])).snapshots);assert.equal(r.open.length,1);assert.equal(r.historie.length,3);assert.equal(r.snapshotDekking.mn.aantal,2);assert.equal(r.snapshotDekking.mn.dubbeleBronrijen,1);
});
test('moderne mapkiezer neemt iedere dag mee zonder BSS-inhoud en snoeit jaren buiten de periode',async()=>{
 const c=runtime();let fileReads=0;const visited=[];
 const dir=(name,items)=>({name,kind:'directory',async *entries(){visited.push(name);for(const x of items)yield [x.name,x];}}),handle=f=>({name:f.name,kind:'file',getFile:async()=>{fileReads++;return {arrayBuffer:f.arrayBuffer};}});
 const days=[16,15,14,13].map(d=>dir(String(d),[handle(file('2026-10-'+d,[d])),{name:'grootstoringlijst.txt',kind:'file',getFile:async()=>{throw Error('BSS gelezen');}}]));
 const old={name:'2025',kind:'directory',async *entries(){throw Error('oud jaar doorgelopen');}};
 const tree=dir('mtm',[dir('mn',[dir('storinglijst',[old,dir('2026',[dir('10',days)])])]),{name:'nwn',kind:'directory',async *entries(){throw Error('verkeerde VC bezocht');}}]);
 const files=await c.DVM_MTM_OPEN_DUMPS.collect(tree,{vcs:new Set(['mn']),vanaf:'2026-10-13',tot:'2026-10-16'});assert(visited.includes('15'));assert.equal(fileReads,0);
 await read(c,files);assert.equal(fileReads,4);
});

test('alle dumpblokken in een bestand tellen mee, eerste afwezigheid blijft nog open',async()=>{
 const c=runtime();const text='26-10-2025 00:30\n|1|1003|1003 Fatale fout bij MSI 1|A77 R 12,000|25-10-2025 12:00|\n|2|1003|1003 Fatale fout bij MSI 2|A77 R 12,000|25-10-2025 12:00|\n26-10-2025 23:30\n|2|1003|1003 Fatale fout bij MSI 2|A77 R 12,000|25-10-2025 12:00|\n|3|1003|1003 Fatale fout bij MSI 3|A77 R 12,000|26-10-2025 23:29|';
 const {snapshots}=await read(c,[file('2025-10-26',[],{text})]);assert.equal(snapshots[0].deelSnapshots,2);assert.equal(snapshots[0].gelezenBronRijen,4);assert.equal(snapshots[0].precision,'minuut');assert.equal(snapshots[0].headerConflict,false);assert.equal(snapshots.length,2);assert.equal(snapshots[1].snapshot,'2025-10-26T22:30:00.000Z');
 const r=c.DVM_MTM_OPEN_DUMPS.process(empty(),snapshots);assert.deepEqual(plain(r.open.map(r=>r.event_id).sort()),['1','2','3']);assert.equal(r.historie.length,3);assert.equal(r.open.find(r=>r.event_id==='1').afwezig_sinds,'2025-10-26T22:30:00.000Z');
});

test('afzonderlijke alarm-ID’s op hetzelfde asset met dezelfde code en bronstart blijven afzonderlijke meldingen',async()=>{
 const c=runtime(),text='16-10-2026 12:00\n|1|1003|1003 Fatale fout bij MSI 1|A77 R 12,000|01-01-2024 00:00|\n|2|1003|1003 Fatale fout bij MSI 1|A77 R 12,000|01-01-2024 00:00|';
 const r=c.DVM_MTM_OPEN_DUMPS.process(empty(),(await read(c,[file('2026-10-16',[],{text})])).snapshots);assert.equal(r.open.length,2);assert.notEqual(r.open[0]._mtmSleutel,r.open[1]._mtmSleutel);assert.equal(c.DVM_INCIDENT_LIFECYCLE.summary(r.open).geraakteAssets,1);
});

test('overstap vanuit de oude MTM-identiteit behoudt hetzelfde incident zonder dubbel historisch exemplaar',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;const parsed=(await read(c,[file('2026-10-14',[1])])).snapshots[0],raw={...parsed.rows[0]};delete raw._syncKey;
 const old=c.signaalgeverOpenRij({...raw,verkeerscentrale:'mn',laatste_snapshot:parsed.snapshot});old._mtmSleutel=c.__BIDASH_STORINGSBUNDELAAR__.sbSignaalgeverSleutel({...old,_mtmSleutel:''});old.incident_id='bewaard-incident';
 const basis={...empty(),open:[old],historie:[old],laatstePerVc:{mn:Date.parse(parsed.snapshot)}};
 const r=D.process(basis,(await read(c,[file('2026-10-16',[1])])).snapshots);assert.equal(r.open.length,1);assert.equal(r.historie.length,1);assert.equal(r.open[0].incident_id,'bewaard-incident');
});

test('een oude bronpeildatum zonder laatste open waarneming bewijst geen herstel',async()=>{
 const c=runtime(),basis=empty();basis.open=[{vc:'mn',event_id:'1',van:'2024-01-01',foutcode:'1003',MSI:'MSI 1',weg:'A77',richting:'R',hm:12,assetTypeHint:'MSI',bron_peildatum:'2026-01-01T00:00Z',levenscyclus_status:'ONBEKEND_DOOR_BRONGAT',status:'onbekend',_liveOpen:false}];
 const r=c.DVM_MTM_OPEN_DUMPS.process(basis,(await read(c,[file('2026-10-16',[])])).snapshots);assert.equal(r.open.length,1);assert.equal(r.historie[0].levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');assert.equal(r.historie[0].herstel_venster_van,null);
});

test('een terugkeer binnen een bestand onderbreekt de wachttijd en alle exportvolgnummers tellen mee',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;const body=(day,hour,ids)=>`${day}-10-2026 ${hour}\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n');
 const files=[file('2026-10-14',[1]),file('2026-10-15',[]),file('2026-10-16',[],{text:body(16,'00:30',[])+'\n'+body(16,'12:00',[1])}),file('2026-10-16',[],{sequence:2,hour:'23:30'}),file('2026-10-17',[])];
 const result=await read(c,files),r=D.process(empty(),result.snapshots);assert.equal(result.selected,5);assert.equal(r.open.length,1);assert.equal(r.open[0].afwezig_sinds,'2026-10-16T21:30:00.000Z');assert.equal(r.open[0].incident_id,r.historie[0].incident_id);
});
test('een terugkeer na afgeleid herstel wordt weer open en wist herstelvelden',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;const r=D.process(empty(),(await read(c,[file('2026-10-14',[1]),file('2026-10-15',[]),file('2026-10-16',[]),file('2026-10-17',[]),file('2026-10-18',[1])])).snapshots);
 assert.equal(r.open.length,1);assert.equal(r.open[0].levenscyclus_status,'OPEN_BEVESTIGD');assert.equal(r.open[0].afwezig_sinds,null);assert.equal(r.open[0].herstel_bevestiging_op,null);assert.equal(r.open[0].herstel_venster_tot,null);
});
test('zomertijd betekent werkelijk 48 uur afwezig en geen twee kalenderdagen',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS;let r=D.process(empty(),(await read(c,[file('2026-03-26',[1]),file('2026-03-27',[]),file('2026-03-28',[]),file('2026-03-29',[])])).snapshots);
 assert.equal(r.open.length,1);r=D.process(r,(await read(c,[file('2026-03-29',[],{hour:'13:00'})])).snapshots);assert.equal(r.open.length,0);
});
test('conflicterende blokken en geannuleerde lezing wijzigen de basis niet',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS,b=empty(),before=plain(b);
 await assert.rejects(read(c,[file('2026-10-16',[],{text:'16-10-2026 12:00\n16-10-2026 12:00\n|1|1003|1003 Fatale fout bij MSI 1|A77 R 12,000|01-01-2024 00:00|'})]),/Tegenstrijdige/);
 let calls=0;await assert.rejects(D.read([file('2026-10-14',[1]),file('2026-10-15',[])],{vcs:new Set(['mn'])},{checkCancel:()=>{if(++calls>2)throw Error('gestopt');}}),/gestopt/);assert.deepEqual(plain(b),before);
});

test('streamende import geeft dezelfde dagreeks en herimport als verwerking in geheugen',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS,files=[file('2026-10-14',[1,2]),file('2026-10-15',[2]),file('2026-10-16',[1,3]),file('2026-10-17',[3]),file('2026-10-18',[3]),file('2026-10-19',[3])],cfg={vcs:new Set(['mn'])};
 const batch=D.process(empty(),(await D.read(files,cfg)).snapshots),stream=await D.run(empty(),files,cfg);
 assert.deepEqual(plain(stream.result),plain(batch));assert.equal(stream.selected,6);
 const repeated=await D.run(plain(stream.result),files,cfg);assert.deepEqual(plain(repeated.result.open),plain(batch.open));assert.deepEqual(plain(repeated.result.historie),plain(batch.historie));
 const before=plain(stream.result),older=await D.run(stream.result,[file('2026-10-12',[99]),file('2026-10-13',[])],cfg);assert.deepEqual(plain(older.result.historie),before.historie);assert.deepEqual(plain(older.result.open),before.open);
 let calls=0;await assert.rejects(D.run(stream.result,files,cfg,{checkCancel:()=>{if(++calls>5)throw Error('gestopt');}}),/gestopt/);assert.deepEqual(plain(stream.result),before);
});
test('meerdere bestanden van dezelfde dag worden volgens kopklok verwerkt en conflicten over bestanden worden geweigerd',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS,cfg={vcs:new Set(['mn'])},files=[file('2026-10-14',[1],{hour:'23:30'}),file('2026-10-14',[2],{hour:'00:30',sequence:2})];
 const r=(await D.run(empty(),files,cfg)).result;assert.equal(r.open.find(r=>r.event_id==='1').levenscyclus_status,'OPEN_BEVESTIGD');assert.equal(r.open.find(r=>r.event_id==='2').levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');
 await assert.rejects(D.run(empty(),[file('2026-10-14',[1]),file('2026-10-14',[2],{sequence:2})],cfg),/Tegenstrijdige/);
});
test('dezelfde ontbrekende laatste dump herhalen telt niet nogmaals als afwezigheidswaarneming',async()=>{
 const c=runtime(),D=c.DVM_MTM_OPEN_DUMPS,first=(await read(c,[file('2026-10-14',[1]),file('2026-10-15',[])])).snapshots,r=D.process(empty(),first),again=D.process(r,[first[1]]);
 assert.deepEqual(plain(again.open),plain(r.open));assert.deepEqual(plain(again.historie),plain(r.historie));
});
