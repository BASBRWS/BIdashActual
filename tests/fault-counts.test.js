import test from 'node:test';
import assert from 'node:assert/strict';
import {countFaults,faultLocationKey} from '../site/core/fault-counts.js';
import {faultCountBreakdown} from '../site/core/fault-counts-ui.js';
import {createAssetRegisterView} from '../site/core/asset-register-view.js';
const row=(i,extra={})=>({eventId:String(i),vc:'MN',weg:'A77',richting:'RE',hm:10+i%72/1000,strook:String(i%4+1),typeId:i%5?'MSI':'LUS',code:'1003',levenscyclus_status:'OPEN_BEVESTIGD',...extra});
test('1387 aparte meldingen op 72 locaties blijven 1387 meldingen en 72 locaties',async()=>{
 const rows=Array.from({length:1387},(_,i)=>row(i)),before=structuredClone(rows),c=countFaults(rows);
 assert.equal(c.meldingen,1387);assert.equal(c.locaties,72);assert.equal(c.bevestigdeLocaties,72);assert.equal(c.aanwezig,1387);
 assert.equal(c.perVc.MN.locaties,72);assert.equal(c.perVc.MN.meldingen,1387);
 assert.equal(c.perType.MSI.locaties,72);assert.equal(c.perType.LUS.locaties,72);assert.equal(c.perType.MSI.meldingen+c.perType.LUS.meldingen,1387);
 const view=createAssetRegisterView(),data=await view.ensure({assets:()=>[],faults:()=>rows});assert.equal(data.faultCount,1387);assert.deepEqual(data.faultSummary,c);assert.deepEqual(rows,before);
});
test('code, rijstrook en asset tellen geen extra locatie, VC, rijrichting en zijbaan wel',()=>{
 const a=row(0,{vc:'VC WNN',weg:'A077',richting:'R',hm:'0,000'}),same=row(1,{vc:'NWN',weg:'A77',richting:'RE',hm:0,assetKey:'andere-strook',code:'1002'});
 assert.equal(faultLocationKey(a),faultLocationKey(same));
 const different=[{...same,vc:'ZWN'},{...same,richting:'LI'},{...same,hectoletter:'A'},{...same,hm:.001}];
 assert.equal(countFaults([a,same,...different]).locaties,5);
});
test('verdwenen en onbekende meldingen blijven apart, oud bevestigd is aanwezig op de bronstand',()=>{
 const c=countFaults([row(0),row(1,{levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT'}),row(2,{levenscyclus_status:'ONBEKEND_DOOR_BRONGAT'}),row(3,{levenscyclus_status:'OPEN_VEROUDERD'}),row(4,{levenscyclus_status:'HERSTELD_AFGELEID'})]);
 assert.equal(c.meldingen,5);assert.equal(c.locaties,5);assert.equal(c.bevestigdeLocaties,2);assert.equal(c.aanwezig,2);assert.equal(c.verdwenen,1);assert.equal(c.onbekend,1);assert.equal(c.hersteld,1);
});
test('onvolledige of lege posities tellen niet als één verzonnen locatie; hm nul telt wel',()=>{
 const rows=[row(0,{hm:0}),...['',null,undefined,'onbekend',Infinity].map(hm=>row(0,{hm})),row(0,{richting:''}),row(0,{vc:''}),row(0,{weg:''})];
 const c=countFaults(rows);assert.equal(c.meldingen,9);assert.equal(c.locaties,1);assert.equal(c.zonderLocatie,8);
 assert.equal(countFaults([]).meldingen,0);assert.deepEqual(countFaults([]).perType,{});
});
test('uitsplitsing rekent niet op in ruwe bronregels en schermt onbekende typetekst af',()=>{
 const c=countFaults([row(0,{typeId:'<script>alarm</script>'})]),html=faultCountBreakdown(c);
 assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;SCRIPT&gt;/);assert.match(html,/Meerdere rijstroken, detectoren en foutcodes/);
});

test('bijwerken van één VC verbergt aanwezige meldingen uit andere VC’s niet in de landelijke teller',()=>{
 const c=countFaults([row(0,{vc:'mn'}),row(1,{vc:'MN'}),row(2,{vc:'NWN'}),row(3,{vc:'WNN'})]);
 assert.equal(c.meldingen,4);assert.equal(c.perVc.MN.meldingen,2);assert.equal(c.perVc.NWN.meldingen,2);assert.equal(Object.keys(c.perVc).length,2);
});
