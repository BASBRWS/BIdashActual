import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
function runtime(){
 const c=dvmRuntime();c.setTimeout=setTimeout;c.clearTimeout=clearTimeout;
 vm.runInContext(readFileSync(new URL('../site/core/actual-profile.js',import.meta.url),'utf8'),c);
 const now=new Date().toISOString();c.assets=[{entityid:'synthetic-1','ci-type':'VKS signaalgevers',asset:'MSI A77 R 12,000 1',wegnummer:'77','hm-bord':'12',baanpositie:'R',regio:'MN',status:'Operationeel'}];
 c.rows=[{event_id:'1',vc:'MN',weg:'A77',richting:'R',hm:12,MSI:'MSI 1',foutcode:'1003',melding:'Fatale fout bij MSI 1',assetTypeHint:'MSI',van:now,tot:now,eerste_gezien:now,laatste_gezien:now,bron_peildatum:now,levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT',_liveOpen:false,status:'onbekend'}];
 vm.runInContext("analyseerAssetRegister(assets,'synthetic');LIVE_STORINGSBRONNEN=[{key:'synthetic',naam:'synthetic',rijen:rows,peildatum:Date.now()}];LIVE_PEILDATUM=Date.now();STATE=doorrekenen(rows,{actueel:true,peildatum:LIVE_PEILDATUM});RULES.cfg.liveDekking={};",c);
 c.probeerAnalyseActiveren=()=>{};return c;
}
test('bevestiging blijft aangevinkt bij een verdwenen melding zonder onzekerheid als exact te presenteren',()=>{
 const c=runtime();c.v68DekkingBewaar({dataset:{v68Type:'MSI'},checked:true});const m=c.v68LandelijkModel();
 assert.equal(m.typen.MSI.bevestigd,true);assert.equal(m.typen.MSI.onzeker,true);assert.equal(m.typen.MSI.compleet,false);assert.equal(m.typen.MSI.besch,null);
 assert.match(c.v68BronnenHtml(m),/data-v68-type="MSI" checked/);assert.match(c.v68BronnenHtml(m),/Bevestiging opgeslagen/);
 c.v68DekkingBewaar({dataset:{v68Type:'MSI'},checked:false});assert.equal(c.v68LandelijkModel().typen.MSI.bevestigd,false);assert.doesNotMatch(c.v68BronnenHtml(c.v68LandelijkModel()),/data-v68-type="MSI" checked/);
});
test('bevestiging reist met parameters en totaalexport mee en verandert geen incidenten of impact',()=>{
 const c=runtime(),before=vm.runInContext('JSON.stringify([LIVE_STORINGSBRONNEN,STATE.meldingen,STATE.nietDoorgerekend])',c);
 c.v68DekkingBewaar({dataset:{v68Type:'MSI'},checked:true});const b=JSON.parse(JSON.stringify(c.totaalExportBundle({parameters:true,liveStoringen:true})));
 assert.equal(b.parameters.cfg.liveDekking.MSI,true);assert.equal(b.liveStoringen[0].rijen[0].levenscyclus_status,'VERDWENEN_UIT_SNAPSHOT');
 assert.equal(vm.runInContext('JSON.stringify([LIVE_STORINGSBRONNEN,STATE.meldingen,STATE.nietDoorgerekend])',c),before);
 vm.runInContext('RULES.cfg.liveDekking={}',c);c.saved=structuredClone(b.parameters.cfg);vm.runInContext('RULES.cfg=saved',c);
 assert.equal(c.v68LandelijkModel().typen.MSI.bevestigd,true);assert.equal(c.v68LandelijkModel().typen.MSI.compleet,false);
});
test('een onzekere lege bevestiging aanzetten verandert een blinde bron niet in nul verlies',()=>{
 const c=runtime();c.v68DekkingBewaar({dataset:{v68Type:'MSI'},checked:true});const b=c.v68LandelijkModel().typen.MSI;
 assert.equal(b.blindeMeldingen,true);assert.equal(b.inBron,1);assert.equal(b.events,0);assert.equal(b.besch,null);
});
