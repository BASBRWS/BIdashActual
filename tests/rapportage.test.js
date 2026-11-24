/* 2.97 / DVM 170: managementrapportage. Synthetische modellen, geen operationele data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {RAPPORT_ONDERDELEN,standaardRapportInstelling,rapportModel,rapportHtml,rapportBuilderHtml,schoneTaal} from '../site/core/rapportage.js';

const overzicht={heeftDvm:true,peildatum:Date.parse('2026-11-24T08:00:00Z'),verloop:Array.from({length:30},(_,i)=>({dag:`2026-11-${String(i<6?24-6+i:i-5).padStart(2,'0')}`,nieuw:i<23?5:9})),
  diensten:[{id:'im',naam:'Incidentmanagement',norm:99,besch:98.6,oordeel:'onder'},{id:'vm',naam:'Verkeersmanagement',norm:99,besch:99.3,oordeel:'binnen'},{id:'rri',naam:'Reis- en netwerksturing',norm:98,lo:97,hi:99,oordeel:'onzeker'},{id:'wiu',naam:'Werk in Uitvoering',norm:98,besch:98.4,oordeel:'binnen'}],
  netwerk:{soort:'netwerkschakels',totaal:20,geraakt:12,onderNorm:5,norm:99.5,laagste:[{key:'A15 Vaanplein – Ridderkerk',vc:'ZWN',besch:91.2,n:6},{key:'A12 Oudenrijn – Lunetten',vc:'MN',besch:95,n:3}]},
  kosten:250000,kostenBekend:18,kostenTotaal:20,vcs:[{vc:'ZWN',n:30},{vc:'MN',n:12}],dekking:1,nietDoorgerekend:2,
  werkImpact:{geladen:true,werken:6,metInleidend:2,hoog:1,horizonDagen:14,lijst:[{label:'A15 · RE · hm 2,0-2,8',periode:'24-11-2026',afsluiting:'rijstrook dicht',inleidend:[{}],ernst:'hoog'}]},
  planOverzicht:{taken:12,lopend:3,mijlpalenKomend:4,mijlpalen:[{naam:'Gunning',datum:'2026-12-14',dagen:20},{naam:'Ingebruikname',datum:'2027-04-23',dagen:150}],formatie:{beschikbaarStandaard:false,perDienst:[{dienst:'VWM',nu:2,piek:13,beschikbaar:8,tekortWeken:10,eersteTekort:'2027-04-28'}]}}};
const meldingen=[{typeId:'MSI',vc:'ZWN'},{typeId:'MSI',vc:'ZWN',levenscyclus_status:'VERDWENEN_UIT_SNAPSHOT'},{typeId:'LUS',vc:'MN'},{typeId:'CAM',vc:'MN'}];
const rol=(b,n)=>({beschikbaar:b,benodigd:n,ruimte:b-n});
const opFormatie={methode:'ingenieursbureau',extraTotaal:6.5,perVc:[{vc:'ZWN',ingevuld:true,tekortRollen:2,bezettingTekort:0,rollen:[rol(66,72),rol(40,44)],ingenieur:{detectMin:3,aanrijMin:17,inspecteursuren:320,kosten:41600}},{vc:'MN',ingevuld:true,tekortRollen:0,bezettingTekort:0,rollen:[rol(44,41)],ingenieur:{detectMin:2.6,aanrijMin:14.4,inspecteursuren:170,kosten:21300}}]};
const signalen=[{sev:'r',titel:'Beschikbaarheid onder norm · Detectie',msg:'Norm 99,5% (kpi.asset_beschikbaarheid.msi) · actueel 96,60% · CMDB DVM.',resp:'Assetmanager'},{sev:'o',titel:'Formatie',msg:'Tekort',resp:'Afdelingshoofd'}];

test('volledig rapport: alle hoofdstukken, figuren, tabellen en schema’s, zonder inline stijl',()=>{
  const r=rapportModel({overzicht,opFormatie,meldingen,signalen,kwaliteit:{score:92,verdict:{label:'Op koers'}},expert:[{dienstNaam:'Incidentmanagement',status:'vastgesteld',expert:{naam:'A. de Vries'},validatie:{vertrouwen:'4'}}],dvm:{roads:[{naam:'A15',vc:'ZWN',kosten:120000}]},nu:Date.parse('2026-11-24T09:00:00Z')});
  const h=rapportHtml(r);
  for(const o of RAPPORT_ONDERDELEN)assert.ok(h.includes(o.titel),o.titel);
  assert.ok((h.match(/class="rap-figuur"/g)||[]).length>=9);assert.ok((h.match(/class="rap-tabel"/g)||[]).length>=9);
  assert.doesNotMatch(h,/style=|<script|NaN|undefined|null%/);
  assert.match(h,/Incidentmanagement<\/b> zit met 98,60% onder de norm van 99,0%/);
  assert.match(h,/1 van 2 verkeerscentrales komt mensen tekort/);
  assert.match(h,/€\s250\.000 per dag/);assert.match(h,/gestegen \(63 tegen 35/);
  assert.doesNotMatch(h,/kpi\.asset|CMDB/,'technische verwijzingen vertaald');
  assert.match(h,/Gevraagd besluit/);assert.match(h,/Begrippenlijst/);
});
test('gebied en onderdelen zijn kiesbaar; samenvatting blijft altijd staan',()=>{
  const s={...standaardRapportInstelling(),scope:'MN',onderdelen:['formatie'],grafieken:false};
  const h=rapportHtml(rapportModel({overzicht,opFormatie,meldingen,signalen},s));
  assert.match(h,/Verkeerscentrale MN/);assert.match(h,/Managementsamenvatting/);assert.match(h,/Formatie en bezetting/);
  assert.doesNotMatch(h,/Storingsbeeld en ontwikkeling/);assert.doesNotMatch(h,/<svg[^>]*aria-label="Beschikbare en benodigde/,'grafieken uit');
  assert.match(h,/<b>2 installaties<\/b> langs de weg verstoord in het gebied van verkeerscentrale MN/);
});
test('zonder bronnen: eerlijk "nog niet bekend", geen verzonnen nul',()=>{
  const h=rapportHtml(rapportModel({},standaardRapportInstelling()));
  assert.doesNotMatch(h,/NaN|undefined/);assert.match(h,/Nog niet bekend/);assert.match(h,/nog geen storingsbron geladen/i);
  assert.match(h,/Er zijn nog geen geplande werkzaamheden geladen/);
  assert.doesNotMatch(h,/0 installaties/,'zonder bron geen verzonnen nul');assert.match(h,/Er is nog geen storingsbron geladen/);
});
test('schone taal en builder',()=>{
  assert.equal(schoneTaal('Norm 99,5% (kpi.asset_beschikbaarheid.msi) · actueel 96,60% · locatie Landelijk (weging ×1,0) · CMDB DVM.'),'Norm 99,5% · actueel 96,60%');
  const b=rapportBuilderHtml(standaardRapportInstelling(),{vcs:['MN','ZWN']});
  assert.match(b,/data-rap-onderdeel="samenvatting" checked disabled/);assert.match(b,/Verkeerscentrale ZWN/);assert.doesNotMatch(b,/style=/);
});
