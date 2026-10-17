import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
const profile=readFileSync(new URL('../site/core/actual-profile.js',import.meta.url),'utf8');
const peil='2026-10-16T00:30:00.000Z';
const asset={entityid:'synthetic-msi','ci-type':'VKS signaalgevers',asset:'MSI A77 R 12,000 1',wegnummer:'77','hm-bord':'12',baanpositie:'R',regio:'MN',status:'Operationeel'};
const fault=(id,type='MSI',extra={})=>({event_id:String(id),vc:'MN',weg:'A77',richting:'R',hm:12,MSI:'MSI 1',foutcode:'1003',melding:'Fatale fout bij MSI 1',assetTypeHint:type,van:'2026-10-15T00:00:00Z',tot:peil,eerste_gezien:peil,laatste_gezien:peil,bron_peildatum:peil,levenscyclus_status:'OPEN_BEVESTIGD',_liveOpen:true,...extra});
function runtime(actual=true){
 const c=dvmRuntime();if(actual)vm.runInContext(profile,c);
 c.renderAlles=()=>{};c.renderDataGereedheid=()=>{};c.toonTab=()=>{};
 c.assets=[asset];vm.runInContext("analyseerAssetRegister(assets,'synthetic')",c);return c;
}
function activate(c,rows,{sources=true}={}){
 c.rows=rows;c.sourceLoaded=sources;
 vm.runInContext(`LIVE_STORINGSBRONNEN=sourceLoaded?[{key:'synthetic',naam:'synthetic',rijen:rows,peildatum:Date.parse('${peil}')}]:[];LIVE_PEILDATUM=sourceLoaded?Date.parse('${peil}'):null;ANALYSE_SIGNATURE='';probeerAnalyseActiveren('overzicht');`,c);
 return vm.runInContext('({state:STATE,ready:berekenGereedheid()})',c);
}
test('een systeemmelding en ontbrekend assettype blokkeren de overige actuele meldingen niet',()=>{
 const c=runtime(),single=activate(c,[fault(1)]).state.meldingen[0];
 const rows=[fault(1),fault(2,'SYSTEEM',{MSI:'SYSTEEM',foutcode:'2001',melding:'Hoofdvoeding'}),fault(3,'ONBEKEND',{MSI:'OVERIG',foutcode:'9999',melding:'Onbekend alarm'}),fault(4,'LUS',{MSI:'DETECTIELUS',foutcode:'5004',melding:'Detectielus alarm'})];
 const {state,ready}=activate(c,rows);assert.equal(ready.regAlg.areaal,false);assert.equal(ready.basisAlgemeen,true);assert.ok(state);assert.equal(state.peildatum,Date.parse(peil));
 const all=[...state.meldingen,...state.nietDoorgerekend];assert.equal(all.length,4);assert.equal(state.meldingen.find(r=>r.eventId==='1').avail,single.avail);
 for(const id of ['2','3']){const r=all.find(r=>r.eventId===id);assert.equal(r.avail,null);assert.match(r.rekenStatus,/zonder bewezen individuele assetimpact/);}
});
test('alleen systeemmeldingen blijven zichtbaar met onbekende individuele impact',()=>{
 const {state,ready}=activate(runtime(),[fault(1,'SYSTEEM',{MSI:'SYSTEEM',foutcode:'2001',melding:'Hoofdvoeding'})]);
 assert.equal(ready.basisAlgemeen,true);assert.equal(state.meldingen.length,0);assert.equal(state.nietDoorgerekend.length,1);assert.equal(state.nietDoorgerekend[0].avail,null);
});
test('locatie ontbreekt of herstel is onzeker blokkeert niet de volledige actuele lijst',()=>{
 const {state}=activate(runtime(),[fault(1,'MSI',{weg:'',hm:null,MSI:'MSI 9',melding:'Fatale fout bij MSI 9'}),fault(2,'MSI',{levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT',_liveOpen:false,status:'onbekend'})]);
 assert.ok(state);assert.equal(state.nietDoorgerekend.length,2);assert(state.nietDoorgerekend.every(r=>r.avail===null));
});
test('een geladen lege bron heeft een rekenpeilmoment, geen bron blijft onbekend',()=>{
 const c=runtime(),empty=activate(c,[]);assert.equal(empty.ready.basisAlgemeen,true);assert.equal(empty.state.peildatum,Date.parse(peil));assert.equal(empty.state.meldingen.length,0);
 const absent=activate(c,[],{sources:false});assert.equal(absent.ready.basisAlgemeen,false);assert.equal(absent.state,null);
});
test('zonder assetregister blijft de actuele doorrekening geblokkeerd',()=>{
 const c=runtime();vm.runInContext('ASSET_REGISTER_STATE=null;ASSET_INDEX=null',c);const {state,ready}=activate(c,[fault(1)]);assert.equal(ready.basisAlgemeen,false);assert.equal(state,null);
});
test('de afzonderlijke analysevariant behoudt haar bestaande gereedheidspoort',()=>{
 const c=runtime(false),{state,ready}=activate(c,[fault(1),fault(2,'SYSTEEM',{foutcode:'2001',melding:'Hoofdvoeding'})]);assert.equal(ready.regAlg.areaal,false);assert.equal(ready.basisAlgemeen,false);assert.equal(state,null);
});
