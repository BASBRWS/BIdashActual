import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overzichtModel,kpiHtml,pijplijnHtml,verloopHtml,meterlijstHtml,vcRijen,dienstenHtml,sparklineSvg} from '../site/core/overview-dashboard.js';

/* 2.88: het overzicht rekent niets nieuws; elk getal komt uit de samenvattingen. */
const dagen=Array.from({length:90},(_,i)=>({dag:new Date(Date.UTC(2026,7,20+i)).toISOString().slice(0,10),nieuw:i%7}));
const dvm={peildatum:Date.UTC(2026,10,17,7),verloop:{dagen,tot:dagen.at(-1).dag,totaal:999,zonderStart:3},
  diensten:[{id:'a',naam:'Incident <b>',norm:99,besch:99.5,lo:99.5,hi:99.5,dekking:1,exact:true},{id:'b',naam:'Verkeer',norm:99,besch:null,lo:0,hi:98,dekking:.4},{id:'c',naam:'Reis',norm:98,besch:null,lo:90,hi:99.9,dekking:.5},{id:'d',naam:'Werk',norm:98,besch:null,lo:0,hi:100,dekking:0,uitgesloten:true}],
  roads:[{kosten:100},{kosten:250.5},{kosten:null}],netwerkschakelmatrix:false};
const meldingen=[
  {typeId:'MSI',assetKey:'a1',rekenStatus:'Doorgerekend',levenscyclus_status:'OPEN_BEVESTIGD'},
  {typeId:'MSI',assetKey:'a2',rekenStatus:'Doorgerekend',levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT'},
  {typeId:'LUS',assetKey:'',rekenStatus:'Locatie ontbreekt',levenscyclus_status:'OPEN_BEVESTIGD'},
  {typeId:'XYZ',assetKey:'',rekenStatus:'Doorgerekend'}];
const stand={rows:[{vc:'MN',meldingen:3,onzeker:1,peildatum:1,status:'Laatste geladen bron'},{vc:'ZN',meldingen:0,onzeker:0,peildatum:null,status:'Peilmoment onbekend'}]};
const bi={functies:[{benodigd:10,actueel:7.5},{benodigd:5,actueel:5}],planning:{regels:702,naam:'plan.xml'}};

test('model: tellingen, dienstoordeel en kosten komen uit de bronnen',()=>{
  const m=overzichtModel({dvm,bi,stand,signalen:[{},{}],meldingen,periode:30});
  assert.equal(m.open,4);assert.equal(m.doorgerekend,3);assert.equal(m.nietDoorgerekend,1);assert.equal(m.gekoppeld,2);assert.equal(m.onzeker,1);
  assert.deepEqual(m.typen.map(t=>[t.label,t.n,t.onzeker]),[['Signalering',2,1],['Detectie',1,0],['Overig',1,0]]);
  assert.deepEqual(m.diensten.map(d=>d.oordeel),['binnen','onder','onzeker','uitgesloten']);
  assert.equal(m.binnen,1);assert.equal(m.onder,1);assert.equal(m.meetbareDiensten,3);
  assert.ok(Math.abs(m.dekking-(1+.4+.5)/3)<1e-12,'uitgesloten dienst telt niet mee in de dekking');
  assert.equal(m.kosten,350.5);assert.equal(m.kostenBekend,2);assert.equal(m.kostenTotaal,3);
  assert.deepEqual(m.fte,{nodig:15,actueel:12.5,functies:2});
  assert.equal(m.verloop.length,30);assert.equal(m.nieuwInPeriode,m.verloop.reduce((s,d)=>s+d.nieuw,0));
  assert.equal(overzichtModel({dvm,periode:14}).verloop.length,14);assert.equal(overzichtModel({dvm,periode:91}).periode,30);
});

test('zonder bronnen staat er Onbekend en geen verzonnen nul',()=>{
  const m=overzichtModel({});
  const html=kpiHtml(m)+pijplijnHtml(m);
  assert.match(html,/Open storingen<\/span><strong>Onbekend/);
  assert.match(html,/Diensten aantoonbaar binnen norm<\/span><strong>Onbekend/);
  assert.match(html,/Verkeerskosten \/ brondag<\/span><strong>Onbekend/);
  assert.match(html,/Nog niet te bepalen/);
  assert.match(verloopHtml(m).html,/Nog geen verloop/);
  assert.equal(dienstenHtml(m),null);
});

test('HTML zonder inline stijl en met ontsnapte namen',()=>{
  const m=overzichtModel({dvm,bi,stand,signalen:[],meldingen,periode:90});
  const v=verloopHtml(m),html=kpiHtml(m)+pijplijnHtml(m)+v.html+meterlijstHtml(m.typen)+meterlijstHtml(vcRijen(m))+dienstenHtml(m);
  assert.doesNotMatch(html,/style=/);
  assert.doesNotMatch(html,/Incident <b>/,'dienstnaam wordt ontsnapt');assert.match(html,/Incident &lt;b&gt;/);
  assert.match(html,/Geen meetellende assetbron/);
  assert.equal((html.match(/data-ov-route="faults"/g)||[]).length,2,'kaart en pijplijnstap verwijzen naar open storingen');
  assert.doesNotMatch(html,/data-route=/,'dashboardknoppen gebruiken data-ov-route; [data-route] blijft voor de vaste navigatie');
  assert.match(v.meta,/3 zonder startmoment niet getoond/);
});

test('verloop: lopende laatste dag gestippeld, tabelweergave en een hitvlak per dag',()=>{
  const m=overzichtModel({dvm,periode:14}),v=verloopHtml(m);
  assert.equal((v.html.match(/class="ov-hit"/g)||[]).length,14);
  assert.match(v.html,/data-ov-lopend/);assert.match(v.html,/\(tot peilmoment\)/);
  assert.equal((v.html.match(/<tr><td>2026-/g)||[]).length,14);
  assert.match(v.html,/role="img" aria-label="Nieuwe storingen per dag, 14 dagen/);
  // De sparkline gebruikt alleen volledige dagen.
  assert.equal((kpiHtml(m).match(/volledige dag, 13 dagen/g)||[]).length,1);
  assert.equal(sparklineSvg([1]),'');
});

test('de pagina laadt de module, zonder dubbele DVM-pijplijnregels',()=>{
  const app=readFileSync(new URL('../site/app.js',import.meta.url),'utf8'),html=readFileSync(new URL('../site/index.html',import.meta.url),'utf8');
  assert.match(app,/from '\.\/core\/overview-dashboard\.js\?v=\d{8}-\d{4}'/);
  for(const id of ['cards','ovPipeline','ovTrend','ovTypes','ovVc','services','prioritySignals','capacity','planningStatus','actualStand'])assert.match(html,new RegExp(`id="${id}"`));
  assert.equal((html.match(/data-ov-periode=/g)||[]).length,3);
});
