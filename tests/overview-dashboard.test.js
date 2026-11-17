import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {overzichtModel,kpiHtml,pijplijnHtml,verloopHtml,meterlijstHtml,vcRijen,dienstenHtml,sparklineSvg,netwerkHtml,mijlpalenHtml,formatieHtml,formatieSamenvatting} from '../site/core/overview-dashboard.js';

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
  assert.deepEqual({...m.fte,lijst:undefined},{nodig:15,actueel:12.5,functies:2,lijst:undefined});assert.equal(m.fte.lijst.length,2);
  assert.equal(m.verloop.length,30);assert.equal(m.nieuwInPeriode,m.verloop.reduce((s,d)=>s+d.nieuw,0));
  assert.equal(overzichtModel({dvm,periode:14}).verloop.length,14);assert.equal(overzichtModel({dvm,periode:91}).periode,30);
});

test('zonder bronnen staat er Onbekend en geen verzonnen nul',()=>{
  const m=overzichtModel({});
  const html=kpiHtml(m)+pijplijnHtml(m);
  assert.match(html,/Open storingen<\/span><strong>Onbekend/);
  assert.match(html,/Zwakste dienst<\/span><strong>Onbekend/);
  assert.match(html,/Eerstvolgende mijlpaal<\/span><strong>Nog niet geladen/);
  assert.match(netwerkHtml(m)+mijlpalenHtml(m),/Nog geen netwerkbeeld[\s\S]*Nog geen planning/);
  assert.equal(formatieHtml(m),null);
  assert.match(html,/Verkeerskosten \/ brondag<\/span><strong>Onbekend/);
  assert.match(html,/Nog niet te bepalen/);
  assert.match(verloopHtml(m).html,/Nog geen verloop/);
  assert.equal(dienstenHtml(m),null);
});

test('HTML zonder inline stijl en met ontsnapte namen',()=>{
  const m=overzichtModel({dvm,bi,stand,signalen:[],meldingen,periode:90});
  const v=verloopHtml(m),html=kpiHtml(m)+pijplijnHtml(m)+v.html+meterlijstHtml(m.typen)+meterlijstHtml(vcRijen(m))+dienstenHtml(m)+netwerkHtml(m)+mijlpalenHtml(m)+(formatieHtml(m)||'');
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

const netwerk={actief:true,soort:'netwerkschakels',totaal:4,gekoppeld:3,geraakt:3,onderNorm:2,norm:99.5,laagste:[{key:'NO04 A1 <x>',vc:'NON',n:14,N:6,besch:83.33,gekoppeld:true,zwakste:{naam:'Verkeer',besch:90.8}},{key:'Niet gekoppeld, A73 V',vc:'NON',n:15,N:1,besch:0,gekoppeld:false,zwakste:null}]};
const planOverzicht=(standaard,perDienst)=>({vandaag:'2026-11-17',mijlpalen:[{naam:'Gunning',datum:'2026-11-29',dagen:12,project:'LTS'},{naam:'Start',datum:'2026-11-17',dagen:0,project:''}],mijlpalenTotaal:5,mijlpalenKomend:2,mijlpalenVoorbij:3,lopend:7,taken:702,
  formatie:{beschikbaarStandaard:standaard,binnenPlanning:true,perDienst}});
const fte=[{dienst:'GPO',nu:6,piek:9,piekDatum:'2027-03-01',beschikbaar:8,tekortWeken:5,eersteTekort:'2027-02-01'},{dienst:'CIV',nu:2,piek:3,piekDatum:'2027-01-01',beschikbaar:5,tekortWeken:0,eersteTekort:null}];

test('2.89: zwakste dienst één keer, netwerkschakels in de pijplijn, mijlpaal in de kaart',()=>{
  const m=overzichtModel({dvm:{...dvm,netwerk},bi,stand,meldingen,planning:planOverzicht(false,fte)});
  const kaarten=kpiHtml(m),stappen=pijplijnHtml(m);
  assert.match(kaarten,/Zwakste dienst · Verkeer<\/span><strong>0,0–98,0%/,'laagste ondergrens, dan laagste bovengrens');
  assert.equal(((kaarten+stappen).match(/aantoonbaar binnen norm/g)||[]).length,1,'het aantal binnen norm staat één keer');
  assert.match(stappen,/3 netwerkschakels geraakt/);assert.match(stappen,/2 onder norm 99,5%/);
  assert.match(kaarten,/Eerstvolgende mijlpaal<\/span><strong>Over 12 dagen<\/strong>[\s\S]*Gunning · 29 nov 2026/);
  assert.match(kaarten,/7 activiteiten lopen nu · 2 komende mijlpalen/);
  const net=netwerkHtml(m);
  assert.match(net,/75%[\s\S]*gekoppeld aan een schakel \(3 van 4\)/);assert.match(net,/NO04 A1 &lt;x&gt;/);assert.match(net,/niet gekoppeld/);
  const mp=mijlpalenHtml(m);assert.match(mp,/Vandaag/);assert.match(mp,/2 komende en 3 verstreken mijlpalen/);
});

test('formatie: tekort alleen bij ingevulde beschikbare FTE, standaardwaarden worden benoemd',()=>{
  const ingevuld=overzichtModel({planning:planOverzicht(false,fte)});
  assert.match(formatieHtml(ingevuld),/Tekort in 5 weken komend jaar, eerste vanaf 1 feb 2027/);
  assert.deepEqual(formatieSamenvatting(ingevuld),{waarde:'Tekort bij 1 dienst',sub:'Nu 8,0 van 13,0 FTE gevraagd',fractie:8/13});
  const standaard=overzichtModel({planning:planOverzicht(true,fte)});
  assert.match(formatieHtml(standaard),/Beschikbare FTE staan nog op de standaardwaarden/);
  assert.doesNotMatch(formatieHtml(standaard),/Tekort in/);
  assert.equal(formatieSamenvatting(standaard).fractie,null);
  // BI-bedrijfsfuncties blijven zichtbaar naast de planning.
  assert.match(formatieHtml(overzichtModel({bi,planning:planOverzicht(false,fte)})),/Bedrijfsfuncties \(BI\)/);
});
