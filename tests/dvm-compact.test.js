import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import '../site/core/dvm-compact.js';
import {DEFAULT_STATE,makeExport,mergeImport,DVM_PARTS} from '../site/core/model.js';
import {dvmRuntime} from './helpers/dvm-runtime.js';
const C=globalThis.DVM_COMPACT,plain=x=>JSON.parse(JSON.stringify(x)),bytes=x=>Buffer.byteLength(JSON.stringify(x));
const row=(id,extra={})=>({incident_id:'MTM|'+id,_mtmSleutel:'key-'+id,vc:'mn',event_id:String(id),locatie:'A77 R 12,000',weg:'A77',MSI:'MSI 1',foutcode:'1003',melding:'Fatale fout bij MSI 1',van:'2025-01-01T00:00:00Z',eerste_gezien:'2026-10-14T10:00:00Z',laatste_gezien:'2026-10-14T10:00:00Z',bron_peildatum:'2026-10-15T10:00:00Z',levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT',afwezig_sinds:'2026-10-15T10:00:00Z',laatste_afwezig:'2026-10-15T10:00:00Z',ontbrekend_volledige_snapshots:1,hersteld_op:null,_liveOpen:false,...extra});
function bundle(){const r=row(1);return {formaat:'DVM-dienstimpact-totaal',versie:54,exportSelectie:{storingshistorie:true,liveStoringen:true},assetregister:{bestand:'synthetic',rijen:[{id:'asset',nul:0}]},storingshistorie:[{key:'history',rijen:[r,row(2,{status:'gesloten_afgeleid',levenscyclus_status:'HERSTELD_AFGELEID'})]}],liveStoringen:[{key:'live',peildatum:1,rijen:[{...r}]}],bronbeheer:{signaalgeverTotaal:{laatstePerVc:{mn:1,nwn:2},snapshotDekking:{mn:{volledig:true,bronSignatuur:'snapshot-signatuur'}}}},parameters:{kosten:{tarief:0,ndw69Snapshot:{sites:[{q:0,v:null}]}},cfg:{liveDekking:{MSI:true}}},netwerkschakels:{rijen:[{key:'matrix'}]},uRoutes:{rijen:[{id:'U1'}]},werkzaamheden:{rijen:[{id:'W1'}]}};}
test('compacte rijen herstellen alle velden, bronnen, andere datasets en hervatmetadata',()=>{
 const b=bundle(),before=plain(b),packed=C.packDvm(b),restored=C.unpackDvm(plain(packed));
 assert.deepEqual(restored,before);assert.deepEqual(b,before);assert.equal(packed.compacteStoringen.records.length,2);assert.equal(packed.liveStoringen[0].rijen,undefined);assert.deepEqual(packed.liveStoringen[0].rijenRefs,[0]);
 assert.equal(restored.liveStoringen[0].rijen[0].afwezig_sinds,'2026-10-15T10:00:00Z');assert.equal(restored.bronbeheer.signaalgeverTotaal.laatstePerVc.nwn,2);
 restored.liveStoringen[0].rijen[0].melding='veranderd';assert.equal(restored.storingshistorie[0].rijen[0].melding,'Fatale fout bij MSI 1');
});
test('bronverschillen bij hetzelfde incident gebruiken een verliesloze delta in plaats van een tweede volledige regel',()=>{
 const b=bundle();b.liveStoringen[0].rijen[0]={...b.liveStoringen[0].rijen[0],_bronBestand:'nieuwe bron',extra:0};delete b.liveStoringen[0].rijen[0].locatie;
 const p=C.packDvm(b),r=p.compacteStoringen.records.at(-1);assert.equal(r.b,0);assert.equal(r.v.length,2);assert.ok(Object.hasOwn(r,'d'));assert.deepEqual(C.unpackDvm(plain(p)),b);
});
test('null, nul, false, lege waarden, Unicode en oorspronkelijke geneste arrays blijven onderscheiden',()=>{
 const b=bundle();b.storingshistorie[0].rijen=[row(1,{nul:0,nee:false,leeg:'',niets:null,unicode:'é 🔧',array:[0,0],nested:{a:[1,{b:null}]}})];b.liveStoringen=[];
 assert.deepEqual(C.unpackDvm(plain(C.packDvm(b))),b);
});
test('herhaald compacteren en herstellen verandert geen tellers of incidenten',()=>{
 const b=bundle(),one=C.packDvm(b),two=C.packDvm(C.unpackDvm(plain(one)));
 assert.deepEqual(two,one);assert.deepEqual(C.packDvm(one),one);assert.deepEqual(C.unpackDvm(C.unpackDvm(one)),b);
});
test('oude exports en lege bestanden blijven rechtstreeks bruikbaar',()=>{
 const b=bundle();assert.equal(C.unpackDvm(b),b);assert.equal(C.packDvm({formaat:'ander'}).formaat,'ander');
 const empty={formaat:'DVM-dienstimpact-totaal',storingshistorie:[],liveStoringen:[]};assert.deepEqual(C.packDvm(empty),empty);
});
test('integrale en selectieve export behouden onafhankelijke onderdelen en geen weggelaten bronnen',()=>{
 const b=bundle(),s={...DEFAULT_STATE(),dvm:b,bi:{config:{fte:0}},planning:{xml:'<plan/>'},links:[{id:'link'}],expertReviews:[{id:'review'}]};
 const all=makeExport(s,new Set([...DVM_PARTS,'biData','biRules','planning','links','expertReviews'])),p=C.packAny(all),restored=mergeImport(DEFAULT_STATE(),plain(p));
 assert.deepEqual(restored.dvm.liveStoringen,b.liveStoringen);assert.deepEqual(restored.bi,s.bi);assert.deepEqual(restored.planning,s.planning);assert.deepEqual(restored.dvm.bronbeheer,b.bronbeheer);
 const partial=makeExport(s,new Set(['liveStoringen'])),q=C.unpackAny(plain(C.packAny(partial)));assert.equal(q.delen.dvm.storingshistorie,undefined);assert.deepEqual(q.delen.dvm.liveStoringen,b.liveStoringen);
});
test('asynchrone export gebruikt één bevroren stand en levert dezelfde logische gegevens',async()=>{
 const b=bundle();b.storingshistorie[0].rijen=Array.from({length:1200},(_,i)=>row(i));const frozen=plain(b),pending=C.packAnyAsync(b);b.parameters.kosten.tarief=999;b.storingshistorie[0].rijen[0].melding='later gewijzigd';
 const p=await pending;assert.deepEqual(C.unpackAny(plain(p)),frozen);
});
test('grote moderne storingslijst wordt kleiner zonder verlies van incidenten of herstelvelden',()=>{
 const b=bundle();b.storingshistorie[0].rijen=Array.from({length:2000},(_,i)=>row(i));b.liveStoringen[0].rijen=b.storingshistorie[0].rijen.slice(0,1000).map(r=>({...r,_bronBestand:'live'}));
 const p=C.packDvm(b);assert.ok(bytes(p)<bytes(b)*.65,`${bytes(p)} van ${bytes(b)} bytes`);assert.deepEqual(C.unpackDvm(plain(p)),b);
});
test('onbekende versies, kapotte verwijzingen, schemafouten en onveilige kolommen stoppen vóór vervanging',()=>{
 const mutations=[p=>delete p.compacteStoringen,p=>p.compacteStoringen.versie=999,p=>p.liveStoringen[0].rijenRefs=[999],p=>p.compacteStoringen.records[0].b=0,p=>p.compacteStoringen.records[0].v=[],p=>p.compacteStoringen.schemas[0][0]='__proto__',p=>p.compacteStoringen.strings[0]=null,p=>delete p.compacteStoringen.schemas];
 const state={...DEFAULT_STATE(),dvm:bundle()},before=plain(state);
 for(const mutate of mutations){const p=plain(C.packDvm(bundle()));mutate(p);assert.throws(()=>mergeImport(state,p),/compacte storingsopslag/);assert.deepEqual(state,before);}
 assert.equal({}.polluted,undefined);
});
test('Actual maakt oude lichte historie niet zwaarder door afgeleide velden op iedere rij toe te voegen',()=>{
 const c=dvmRuntime();c.BIDASH_ACTUAL={};c.rows=[{locatie:'A77 R 12,000',weg:'A77',start:'2025-01-01'}];
 vm.runInContext("STORINGSBRONNEN=[{key:'legacy',rijen:rows}];var exp=totaalExportBundle({storingshistorie:true,parameters:false})",c);
 assert.deepEqual(plain(c.exp.storingshistorie[0].rijen),c.rows);assert.equal(c.exp.storingshistorie[0].rijen[0].incident_id,undefined);
});
