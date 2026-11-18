/* 2.92 / DVM 165: operationele formatie per VC. Synthetische schakels, geen operationele data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {standaardOpFormatie,normaliseerOpFormatie,berekenOpFormatie,opFormatieSamenvatting,opFormatieUitkomstHtml,opFormatieInstellingenHtml} from '../site/core/operationele-formatie.js';
import {DEFAULT_STATE,makeExport,mergeImport} from '../site/core/model.js';

const basis={norm:98,soort:'netwerkschakels',rijen:[{key:'A15 RE',vc:'ZWN',N:40,besch:94,n:3},{key:'A4 LI',vc:'ZWN',N:960,besch:100,n:0},{key:'A2 RE',vc:'ZN',N:100,besch:90,n:5}]};
const zwn=()=>{const s=standaardOpFormatie();s.vcs.ZWN.wvl.uitgangspunt=70;s.vcs.ZWN.wvl.beschikbaar=72;s.vcs.ZWN.wvl.posities=12;return s;};

test('rekenvoorbeeld: 70 FTE × 4% aandeel × 4 pp × 5% = 0,56 FTE extra',()=>{
  const u=berekenOpFormatie(zwn(),basis),v=u.perVc.find(x=>x.vc==='ZWN'),wvl=v.rollen.find(r=>r.id==='wvl');
  assert.equal(u.norm,98);assert.equal(u.normBron,'Regels');
  assert.ok(Math.abs(wvl.extra-0.56)<1e-9);assert.ok(Math.abs(wvl.benodigd-70.56)<1e-9);assert.ok(Math.abs(wvl.ruimte-1.44)<1e-9);
  assert.equal(wvl.bezetting,66);assert.equal(wvl.bezettingOk,true);
  assert.equal(v.drijvers[0].key,'A15 RE');assert.equal(v.tekortRollen,0);
  assert.equal(u.perVc.find(x=>x.vc==='ZN').ingevuld,false,'ZN zonder uitgangspunt telt niet mee');
});
test('norm, verdeling, gevoeligheid en bovengrens zijn instelbaar',()=>{
  const s=zwn();s.norm=95;assert.ok(Math.abs(berekenOpFormatie(s,basis).perVc[0].rollen[0].extra-70*0.04*0.05)<1e-9,'1 pp onder norm 95');
  const g=zwn();g.verdeling='gelijk';assert.ok(Math.abs(berekenOpFormatie(g,basis).perVc[0].rollen[0].extra-70*0.5*0.2)<1e-9,'gelijk: 2 schakels, aandeel 50%');
  const m=zwn();m.maxExtraPct=10;assert.ok(Math.abs(berekenOpFormatie(m,basis).perVc[0].rollen[0].extra-70*0.04*0.1)<1e-9,'bovengrens 10%');
  const r=zwn();r.rollen.find(x=>x.id==='wvl').gevoeligheid=10;assert.ok(Math.abs(berekenOpFormatie(r,basis).perVc[0].rollen[0].extra-70*0.04*0.4)<1e-9);
});
test('tekort door werklast en door minimale bezetting; wat-als zonder opslaan',()=>{
  const s=zwn();s.vcs.ZWN.wvl.beschikbaar=70;let u=berekenOpFormatie(s,basis);
  assert.equal(u.perVc[0].tekortRollen,1);assert.equal(u.tekortVcs,1);assert.match(opFormatieSamenvatting(u).waarde,/Tekort bij 1 VC/);
  const b=zwn();b.vcs.ZWN.wvl.posities=14;u=berekenOpFormatie(b,basis);assert.equal(u.perVc[0].rollen[0].bezettingOk,false,'14 × 5,5 = 77 > 72');
  u=berekenOpFormatie(zwn(),basis,{whatIf:{'A4 LI':90}});assert.ok(u.perVc[0].rollen[0].extra>10,'wat-als op een grote schakel');assert.ok(u.whatIf);
  assert.equal(berekenOpFormatie(zwn(),basis).whatIf,null);
});
test('rollen: wegverkeersleider, coördinerend, officier van dienst en weginspecteur; zonder storingsbron extra 0',()=>{
  const s=standaardOpFormatie();assert.deepEqual(s.rollen.map(r=>r.naam),['Wegverkeersleider','Coördinerend wegverkeersleider','Officier van dienst (weginspectie)','Weginspecteur']);
  s.vcs.MN.wi.uitgangspunt=30;const u=berekenOpFormatie(s,null);assert.equal(u.perVc.find(v=>v.vc==='MN').rollen.find(r=>r.id==='wi').extra,0);assert.equal(u.heeftBasis,false);
});
test('normaliseren weigert rommel en houdt geldige waarden',()=>{
  const n=normaliseerOpFormatie({norm:'abc',ftePerPositie:-3,verdeling:'x',rollen:[{id:'wvl<script>',naam:'X',gevoeligheid:500}],vcs:{'zwn':{'wvl':{uitgangspunt:'70'}}}});
  assert.equal(n.norm,null);assert.equal(n.ftePerPositie,0.1);assert.equal(n.verdeling,'signaalgevers');assert.equal(n.rollen[0].id,'wvlscript');assert.equal(n.rollen[0].gevoeligheid,100);
  assert.equal(n.vcs.ZWN.wvlscript.uitgangspunt,null,'oude rol-id valt weg bij andere rollen');
  assert.equal(normaliseerOpFormatie({vcs:{zwn:{wvl:{uitgangspunt:'70'}}}}).vcs.ZWN.wvl.uitgangspunt,70);
});
test('HTML zonder inline stijl en met alle invoervelden',()=>{
  const u=berekenOpFormatie(zwn(),basis),h=opFormatieUitkomstHtml(u)+opFormatieInstellingenHtml(u,{schakels:basis.rijen});
  assert.doesNotMatch(h,/style=/);assert.match(h,/data-op-vc="ZWN" data-op-veld="uitgangspunt" data-op-rolid="wvl"/);assert.match(h,/data-op-rol="ovd"/);assert.match(h,/data-op-alg="norm"/);
  assert.match(opFormatieUitkomstHtml(berekenOpFormatie(standaardOpFormatie(),basis)),/Nog geen uitgangspunt ingevuld/);
});
test('werkruimte: opFormatie gaat mee in export en import',()=>{
  const state={...DEFAULT_STATE(),opFormatie:zwn()};
  globalThis.DVM_COMPACT??={unpackAny:x=>x};
  const exp=makeExport(state,new Set(['opFormatie']));assert.equal(exp.delen.opFormatie.vcs.ZWN.wvl.uitgangspunt,70);
  const terug=mergeImport(DEFAULT_STATE(),exp);assert.equal(terug.opFormatie.vcs.ZWN.wvl.uitgangspunt,70);
  assert.throws(()=>mergeImport(DEFAULT_STATE(),{formaat:'BiDash-integraal',versie:1,delen:{opFormatie:[1]}}),/object/);
});
