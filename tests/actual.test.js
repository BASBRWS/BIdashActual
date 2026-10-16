import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {dvmRuntime} from './helpers/dvm-runtime.js';
import {actualStand} from '../site/core/actual-state.js';
const profile=readFileSync(new URL('../site/core/actual-profile.js',import.meta.url),'utf8');
function enable(c){vm.runInContext(profile,c);return c;}
test('actual Storage houdt legacy-gegevens intact, ook bij key, length en clear',()=>{
  const c=vm.createContext({});vm.runInContext(`class Storage{constructor(){this.data=new Map()}getItem(k){return this.data.get(String(k))??null}setItem(k,v){this.data.set(String(k),String(v))}removeItem(k){this.data.delete(String(k))}key(i){return [...this.data.keys()][i]??null}clear(){this.data.clear()}get length(){return this.data.size}}globalThis.Storage=Storage;globalThis.localStorage=new Storage;globalThis.sessionStorage=new Storage;localStorage.setItem('legacy','original');sessionStorage.setItem('legacy','original');`,c);enable(c);
  vm.runInContext(`localStorage.setItem('legacy','actual');sessionStorage.setItem('legacy','actual');`,c);
  assert.equal(vm.runInContext('localStorage.getItem("legacy")',c),'actual');assert.equal(vm.runInContext('localStorage.length',c),1);assert.equal(vm.runInContext('localStorage.key(0)',c),'legacy');
  vm.runInContext('localStorage.clear();sessionStorage.clear()',c);
  assert.equal(vm.runInContext('localStorage.data.get("legacy")',c),'original');assert.equal(vm.runInContext('sessionStorage.data.get("legacy")',c),'original');assert.equal(vm.runInContext('localStorage.length',c),0);assert.equal(vm.runInContext('localStorage.getItem("legacy")',c),null);
});
test('directe DVM-prognose en Monte Carlo falen vóór enige berekening',async()=>{
 const c=enable(dvmRuntime());
 for(const name of ['runMonteCarlo','runDripMonteCarlo','tmc70Open','f71Open','mcNetwerk','mcWegdeel'])assert.throws(()=>c[name](),/operationele dagstand/,name);
 for(const name of ['tmc70Simulate','tmc70Run','f71Simulate','f71Run'])await assert.rejects(c[name](),/operationele dagstand/,name);
 assert.equal(c.zorgHistorieState(),null);assert.equal(c.f71Memo({kostenAan:true}), '');assert.equal(c.tmc70Memo({kostenAan:true}),'');assert.equal(c.tabToegestaan('prognose'),false);
});
test('actual autosave bewaart MTM-mapbronnen zonder importer-vlag',()=>{
 const c=enable(dvmRuntime());vm.runInContext(`STORINGSBRONNEN=[{_signaalgeverTotaal:true,key:'signaalgever-totaal-historie',rijen:[{vc:'mn',van:'2026-10-15',status:'open'}]}];LIVE_STORINGSBRONNEN=[{_signaalgeverTotaal:true,key:'signaalgever-totaal-open',rijen:[{vc:'mn',van:'2026-10-15',status:'open'}]}]`,c);
 const b=c.totaalExportBundle(undefined,{autosaveLean:true});assert.equal(b.storingshistorie[0].rijen.length,1);assert.equal(b.liveStoringen[0].rijen.length,1);
});
test('oude prognoseruns verdwijnen, live-verkeersparameters behouden nul en onbekend',()=>{
 const c=enable(vm.createContext({}));const value={kosten:{trafficMC70:{result:1},forecastMSI71:{result:2},tarief:0,ndw69Snapshot:null,scenario67:{q:0}},cfg:{wisMcRuns:1000}};
 const out=c.BIDASH_ACTUAL.parameters(value);assert.equal(out.kosten.trafficMC70,undefined);assert.equal(out.kosten.forecastMSI71,undefined);assert.equal(out.kosten.tarief,0);assert.equal(out.kosten.ndw69Snapshot,null);assert.equal(out.kosten.scenario67.q,0);assert.ok(value.kosten.forecastMSI71);
});
test('dagstand onderscheidt ontbrekende bron, oude bron, brongat en gesloten meldingen',()=>{
 const now=Date.parse('2026-10-16T07:00Z'),recent=now-36e5,old=now-72*36e5;
 const d={bronbeheer:{signaalgeverTotaal:{laatstePerVc:{mn:recent,nwn:old,zn:recent},snapshotDekking:{mn:{volledig:false},zn:{volledig:true}}}},liveStoringen:[{rijen:[{vc:'MN',levenscyclus_status:'OPEN_BEVESTIGD',laatste_gezien:recent},{vc:'NWN',levenscyclus_status:'OPEN_BEVESTIGD',laatste_gezien:old},{vc:'MN',levenscyclus_status:'ONBEKEND_DOOR_BRONGAT'},{vc:'MN',levenscyclus_status:'HERSTELD_BEVESTIGD'}]}]};
 const a=actualStand(d,{peildatum:old},now),mn=a.rows.find(r=>r.vc==='MN'),non=a.rows.find(r=>r.vc==='NON');assert.equal(a.peildatum,old);assert.equal(mn.meldingen,2);assert.equal(mn.onzeker,1);assert.equal(mn.status,'Brondekking onzeker');assert.equal(non.peildatum,null);assert.equal(non.status,'Peilmoment onbekend');assert.equal(a.rows.find(r=>r.vc==='NWN').status,'Bron ouder dan 48 uur');
});
test('oude prognosehashes vallen terug en daadwerkelijke dagstandroutes blijven',async()=>{
 globalThis.BIDASH_ACTUAL={mode:'actual'};
 try{const {GROUPS,resolveRoute}=await import('../site/ui/routes.js?actual-test');assert.ok(!GROUPS.some(g=>g.id==='scenarios'));for(const id of ['signalForecast','lifecycle','businessMC','scenarios'])assert.equal(resolveRoute(id).id,'overview');for(const id of ['faults','sources','quality','region','planning','expertInput'])assert.equal(resolveRoute(id).id,id);}
 finally{delete globalThis.BIDASH_ACTUAL;}
});

test('actual bronmanifest blijft bij compacte autosave aanwezig',()=>{
 const c=enable(dvmRuntime());vm.runInContext(`STORINGSBRONNEN=[];LIVE_STORINGSBRONNEN=[];window.__BIDASH_SIGNAALGEVER_TOTAAL__={laatstePerVc:{mn:123},snapshotDekking:{mn:{volledig:false}}};`,c);
 vm.runInContext(readFileSync(new URL('../site/engines/dvm-source-export-completeness.js',import.meta.url),'utf8'),c);
 const b=c.totaalExportBundle(undefined,{autosaveLean:true});assert.equal(b.bronbeheer.signaalgeverTotaal.laatstePerVc.mn,123);assert.equal(b.bronbeheer.signaalgeverTotaal.snapshotDekking.mn.volledig,false);
});
