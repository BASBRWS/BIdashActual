/* 2.95 / DVM 168: demo-omgeving. Alleen gesimuleerde gegevens. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {maakDemoWerkruimte,DEMO_VERSIE,DEMO_PLANNING_FTE,demoTaakFte,DEMO_NETWERK,demoTriggers} from '../site/core/demo-omgeving.js';
import {expertReviewCompletion,validateServiceExpertReview} from '../site/core/service-expert-input.js';

const nu=Date.parse('2026-11-24T09:00:00Z');
test('demo is deterministisch en volgt de datum van vandaag',()=>{
  const a=maakDemoWerkruimte(nu),b=maakDemoWerkruimte(nu);
  assert.deepEqual(a.telling,b.telling);
  assert.equal(JSON.stringify(a.dvm.liveStoringen),JSON.stringify(b.dvm.liveStoringen));
  const later=maakDemoWerkruimte(nu+7*864e5);
  assert.equal(later.dvm.liveStoringen[0].peildatum-a.dvm.liveStoringen[0].peildatum,7*864e5);
  assert.equal(DEMO_VERSIE,'2');
});
test('alle onderdelen zijn gevuld',()=>{
  const d=maakDemoWerkruimte(nu),t=d.telling;
  assert.ok(t.msi>2000&&t.lus>1000&&t.cam>300&&t.drip>50,JSON.stringify(t));
  assert.ok(t.open>80&&t.historie>1000&&t.dripOpen>0&&t.dripIncidenten>20);
  assert.equal(new Set(d.dvm.assetregister.rijen.map(r=>r.regio)).size,5);
  assert.ok(d.dvm.assetregister.rijen.every(r=>r.district&&r.aannemer&&r.contract&&r['regionale dienst']));
  assert.equal(d.dvm.netwerkschakels.rijen.length,60);
  assert.ok(d.dvm.werkzaamheden.rijen.length>=10&&d.dvm.uRoutes.rijen.length===10);
  assert.ok(d.dvm.parameters.cfg.liveDekking.MSI&&d.dvm.parameters.kosten.ndw69Snapshot.sites.length>500);
  assert.ok(d.bi.functies.length>=5&&d.bi.assets.length>=16&&d.bi.params.kostenIndex===1);
  assert.match(d.planning.xml,/Contractvoorbereiding/);assert.match(d.planning.xml,/<Milestone>1<\/Milestone>/);
  assert.equal(d.opFormatie.methode,'ingenieursbureau');assert.equal(d.opFormatie.vcs.ZWN.wvl.uitgangspunt,70);
  assert.equal(d.links.length,4);
  assert.equal(d.expertReviews.length,4);assert.deepEqual(d.expertReviews.map(r=>r.status),['vastgesteld','ter_beoordeling','ter_beoordeling','concept']);
  assert.match(d.dripReferentieCsv,/^DRIP,Windwaarschuwing,RIA4\n/);assert.equal(d.dripReferentieCsv.split('\n').length,11);
  assert.deepEqual(Object.keys(DEMO_PLANNING_FTE),['GPO','CIV','VWM','PPO','Regio']);
  assert.ok(demoTaakFte('Contractvoorbereiding: uitvoeren').some(x=>x.dienst==='GPO'));
});
test('signaalgevers in storing staan ook voor afritten en toeritten',()=>{
  const d=maakDemoWerkruimte(nu),ctx=new Set(d.dvm.liveStoringen[0].rijen.filter(r=>r.assetTypeHint==='MSI').map(r=>r.msi_context));
  for(const c of ['voor_afrit','voor_toerit','rijbaanbreed'])assert.ok(ctx.has(c),[...ctx].join(','));
  assert.ok(d.dvm.liveStoringen[0].rijen.every(r=>r._liveOpen&&Date.parse(r.van)<nu));
});
test('werkzaamheden liggen deels vlak na een open signaalgeverstoring (inleidend)',()=>{
  const d=maakDemoWerkruimte(nu),open=d.dvm.liveStoringen[0].rijen.filter(r=>r.assetTypeHint==='MSI');
  const inleidend=d.dvm.werkzaamheden.rijen.filter(w=>open.some(m=>m.weg===w.weg&&(w.richting==='RE'?(Number(w.van_hm)-m.hm>0&&Number(w.van_hm)-m.hm<=3):(m.hm-Number(w.tot_hm)>0&&m.hm-Number(w.tot_hm)<=3))));
  assert.ok(inleidend.length>=5,String(inleidend.length));
});
test('demomodus: eigen opslag in een venster met ?demo=1, ook voor geneste engines',()=>{
  const bron=readFileSync(new URL('../site/core/actual-profile.js',import.meta.url),'utf8');
  const maak=(search,parent)=>{const w={location:{search}};w.parent=parent||w;return w;};
  const run=scope=>{vm.runInNewContext(bron,{globalThis:scope,...scope});return scope.BIDASH_ACTUAL;};
  const echt=maak(''),demo=maak('?demo=1'),engine=maak('?v=1',demo),echtEngine=maak('?v=1',echt);
  for(const w of [echt,demo,engine,echtEngine])w.globalThis=w;
  assert.equal(run(echt).workspace,'bidash-actual');assert.equal(run(demo).workspace,'bidash-demo');
  assert.equal(run(engine).demo,true,'engine in de demo erft de demomodus');assert.equal(run(echtEngine).demo,false);
});
test('expertduidingen zijn volledig en triggers geldig',()=>{
  const d=maakDemoWerkruimte(nu);
  for(const r of d.expertReviews){assert.equal(expertReviewCompletion(r).percentage,100,r.dienstId);assert.deepEqual(validateServiceExpertReview(r).filter(f=>!/subproces|dienstnorm/i.test(f)),[],r.dienstId);}
  assert.ok(d.expertReviews[0].validatie.akkoordNaam&&d.expertReviews[0].validatie.akkoordDatum,'vastgesteld heeft een akkoord');
  const t=demoTriggers(nu).triggers;assert.equal(Object.keys(t).length,4);
  for(const x of Object.values(t)){assert.ok(['rood','oranje'].includes(x.klasse)&&x.naam&&x.oorzaak&&x.besluitopties.length&&x.diensten.length&&x.deadline);}
});
