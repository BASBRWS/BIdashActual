/* 2.93 / DVM 166: rekenmethode ingenieursbureau. De referentiewaarden komen uit de
   rekenfunctie compute() van het aangeleverde dashboard (A12-voorbeelddata, reductie 0,
   schuifregelaars neutraal). De bron-HTML zelf staat niet in de repository. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {berekenIngenieur,standaardIngenieur,normaliseerIngenieur,formatieFactor,MSI_CONTEXTEN} from '../site/core/ingenieursmodel.js';
import {standaardOpFormatie,berekenOpFormatie,opGevolgenHtml,opFormatieInstellingenHtml} from '../site/core/operationele-formatie.js';

const t=(totaal,beschikbaar,kritiek,ctx)=>({totaal,uitvalA:totaal-beschikbaar,uitvalP:0,kritiek,storingen:totaal-beschikbaar,ctx:ctx||{}});
const gem=MSI_CONTEXTEN.reduce((s,c)=>s+c.fAvail,0)/MSI_CONTEXTEN.length;
const neutraal={msi:MSI_CONTEXTEN.map(c=>({id:c.id,fAvail:gem}))};
const a12={MSI:t(186,162,14,{rijbaanbreed:{n:24,uitvalA:24}}),CAM:t(94,87,4),LUS:t(412,378,22),DRIP:t(28,25,2)};

test('zelfde uitkomst als de rekenfunctie van het ingenieursbureau (A12-voorbeeld, reductie 0)',()=>{
  // Referentie = de eigen basisbeschikbaarheid van het bronmodel, zodat het verlies 0 is.
  const basis=(162/186*1+87/94*.85+378/412*.9+25/28*.7)/(1+.85+.9+.7);
  const r=berekenIngenieur(a12,{norm:basis*100,instelling:neutraal});
  const ref={gemist:0.0149,kruisrisico:0.2339,botsabsorbers:6.2187,blootstelling:1.4210,inspecteursuren:574.7226,geleidingsgat:0.0667,dripwagens:16.6598,imTeams:1.7920,spits:0.8928,bedieningsfactor:1.1715,conservatief:10.2918,kosten:73087.4961};
  for(const [k,v] of Object.entries(ref))assert.ok(Math.abs(r[k]-v)<5e-4*Math.max(1,Math.abs(v)),`${k}: ${r[k]} ≠ ${v}`);
  assert.ok(Math.abs(r.detectMin-2.8351)<1e-3);assert.ok(Math.abs(r.aanrijMin-14.6777)<1e-3);
});
test('afrit telt mee met eigen weging; gewicht is instelbaar en relatief',()=>{
  const opRijbaan=berekenIngenieur({...a12,MSI:t(186,162,14,{rijbaanbreed:{n:24,uitvalA:24}})},{norm:98});
  const opAfrit=berekenIngenieur({...a12,MSI:t(186,162,14,{voor_afrit:{n:24,uitvalA:24}})},{norm:98});
  assert.ok(opAfrit.beschik.MSI>opRijbaan.beschik.MSI,'afrit (1,25) weegt lichter dan rijbaanbreed (1,7)');
  assert.ok(Math.abs((1-opAfrit.beschik.MSI)*186-24*1.25/gem)<1e-9);
  const zwaar=standaardIngenieur();zwaar.msi.find(c=>c.id==='voor_afrit').fAvail=3;
  assert.ok(berekenIngenieur({...a12,MSI:t(186,162,14,{voor_afrit:{n:24,uitvalA:24}})},{norm:98,instelling:zwaar}).beschik.MSI<opAfrit.beschik.MSI);
  assert.equal(opAfrit.ctx[0].label,'Voor afrit');
});
test('formatiefactor per koppeling en normaliseren',()=>{
  const r=berekenIngenieur(a12,{norm:98});
  assert.equal(formatieFactor(r,'bediening'),r.bedieningsfactor);assert.equal(formatieFactor(r,'inspectie'),r.blootstelling);assert.equal(formatieFactor(r,'geen'),1);assert.equal(formatieFactor(null,'bediening'),1);
  const n=normaliseerIngenieur({msi:[{id:'voor_afrit',fAvail:'x'}],typeGewicht:{MSI:50},kosten:{imTeam:-1}});
  assert.equal(n.msi.find(c=>c.id==='voor_afrit').fAvail,1.25);assert.equal(n.typeGewicht.MSI,10);assert.equal(n.kosten.imTeam,0);
  assert.equal(berekenIngenieur({},{norm:98}),null);
});
test('operationele formatie met methode ingenieursbureau',()=>{
  const s=standaardOpFormatie();s.methode='ingenieursbureau';s.vcs.ZWN.wvl.uitgangspunt=70;s.vcs.ZWN.wi.uitgangspunt=20;
  const u=berekenOpFormatie(s,{norm:98,rijen:[]},{gevolgen:{norm:98,perVc:{ZWN:a12}}});
  const v=u.perVc.find(x=>x.vc==='ZWN'),r=berekenIngenieur(a12,{norm:98});
  assert.ok(Math.abs(v.rollen.find(x=>x.id==='wvl').extra-70*(r.bedieningsfactor-1))<1e-9);
  assert.ok(Math.abs(v.rollen.find(x=>x.id==='wi').extra-20*(r.blootstelling-1))<1e-9);
  const h=opGevolgenHtml(u)+opFormatieInstellingenHtml(u);
  assert.match(h,/Gewogen beschikbaarheid signaalgevers/);assert.match(h,/data-ing-msi="voor_afrit"/);assert.match(h,/data-op-rolkop="wi"/);assert.doesNotMatch(h,/style=/);
  s.methode='gevoeligheid';assert.equal(berekenOpFormatie(s,{norm:98,rijen:[]},{gevolgen:{norm:98,perVc:{ZWN:a12}}}).perVc.find(x=>x.vc==='ZWN').rollen[0].extra,0,'gevoeligheid zonder schakels: 0');
});
