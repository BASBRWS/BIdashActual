/* 2.99 / DVM 172: login gekoppeld aan versleuteling. Synthetische gegevens. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stelIn,ontgrendel,vergrendel,wijzigWachtwoord,versleutel,ontsleutel,isVersleuteld,isIngesteld,isOntgrendeld,controleerWachtwoord,TOEGANG_KEY,GEVOELIGE_KOPIEEN,_naarTekst,_uitTekst} from '../site/core/toegang.js';
import {versleutelVoorOpslag,ontsleutelUitOpslag} from '../site/core/storage.js';

function geheugenOpslag(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),_m:m};}
const W='correct paard batterij niet';

test('wachtwoordregels: minimaal 12 tekens, gelijk herhaald, geen herhaald teken',()=>{
  assert.match(controleerWachtwoord('kort'),/minstens 12/);
  assert.match(controleerWachtwoord(W,W+'x'),/niet gelijk/);
  assert.match(controleerWachtwoord('aaaaaaaaaaaaaaa'),/herhaald teken/);
  assert.equal(controleerWachtwoord(W,W),'');
});

test('instellen, versleutelen, vergrendelen en ontgrendelen',async()=>{
  const opslag=geheugenOpslag();opslag.setItem('bidash_integratie_v1','{"geheim":1}');
  assert.equal(isIngesteld(opslag),false);
  await stelIn(W,{opslag});
  assert.equal(isIngesteld(opslag),true);assert.equal(isOntgrendeld(),true);
  assert.equal(opslag.getItem('bidash_integratie_v1'),null,'oude onversleutelde kopie verwijderd');
  const cfg=JSON.parse(opslag.getItem(TOEGANG_KEY));
  assert.equal(cfg.iteraties,600000);assert.ok(!JSON.stringify(cfg).includes(W),'wachtwoord niet opgeslagen');
  const waarde={dvm:{storingen:[{id:'MSI-1',tekst:'Gesimuleerde storing'}]},datum:new Date('2026-11-24T10:00:00Z'),buf:new Uint8Array([1,2,3]),kaart:new Map([['a',1]]),set:new Set(['x']),gat:[1,undefined,3]};
  const v=await versleutel(waarde);
  assert.ok(isVersleuteld(v));
  const ruw=Buffer.concat(v.delen.map(d=>Buffer.from(d))).toString('latin1');
  assert.ok(!ruw.includes('Gesimuleerde storing'),'geen leesbare tekst in de versleutelde vorm');
  const terug=await ontsleutel(v);
  assert.equal(terug.dvm.storingen[0].id,'MSI-1');assert.ok(terug.datum instanceof Date);assert.equal(terug.datum.toISOString(),'2026-11-24T10:00:00.000Z');
  assert.deepEqual([...terug.buf],[1,2,3]);assert.equal(terug.kaart.get('a'),1);assert.ok(terug.set.has('x'));assert.equal(terug.gat.length,3);assert.equal(terug.gat[1],undefined);
  vergrendel();assert.equal(isOntgrendeld(),false);
  await assert.rejects(ontsleutel(v),/vergrendeld/);
  await assert.rejects(versleutel({a:1}),/vergrendeld/);
  await assert.rejects(ontgrendel('verkeerd wachtwoord!!',{opslag}),/Onjuist wachtwoord/);
  await ontgrendel(W,{opslag});
  assert.equal((await ontsleutel(v)).dvm.storingen.length,1);
});

test('wachtwoord wijzigen houdt bestaande gegevens leesbaar',async()=>{
  const opslag=geheugenOpslag();await stelIn(W,{opslag});
  const v=await versleutel({x:42});
  await assert.rejects(wijzigWachtwoord('fout fout fout',W+'2',{opslag}),/huidige wachtwoord/);
  await wijzigWachtwoord(W,'nieuw wachtwoord 2026!',{opslag});
  vergrendel();
  await assert.rejects(ontgrendel(W,{opslag}),/Onjuist/);
  await ontgrendel('nieuw wachtwoord 2026!',{opslag});
  assert.deepEqual(await ontsleutel(v),{x:42});
});

test('grote waarden worden in delen van hooguit 900 kB opgeslagen',async()=>{
  const opslag=geheugenOpslag();await stelIn(W,{opslag});
  const v=await versleutel({tekst:'x'.repeat(2_500_000)});
  assert.ok(v.delen.length>=3);assert.ok(v.delen.every(d=>d.byteLength<=900*1024));
  assert.equal((await ontsleutel(v)).tekst.length,2_500_000);
});

test('opslaglaag: zonder wachtwoord onversleuteld, met wachtwoord versleuteld en oude data leesbaar',async()=>{
  const opslag=geheugenOpslag();const oud=globalThis.localStorage;globalThis.localStorage=opslag;
  try{
    delete globalThis.__BIDASH_TOEGANG__;
    assert.deepEqual(await versleutelVoorOpslag({a:1}),{a:1},'geen wachtwoord: ongewijzigd');
    await stelIn(W,{opslag});
    const v=await versleutelVoorOpslag({a:1});assert.ok(isVersleuteld(v));
    assert.deepEqual(await ontsleutelUitOpslag(v),{a:1});
    assert.deepEqual(await ontsleutelUitOpslag({oud:true}),{oud:true},'oude onversleutelde werkruimte blijft leesbaar');
    vergrendel();
    await assert.rejects(versleutelVoorOpslag({a:1}),/vergrendeld/,'vergrendeld schrijven wordt geweigerd');
  }finally{globalThis.localStorage=oud;}
});

test('typed JSON behoudt Date en binaire waarden',()=>{
  const t=_uitTekst(_naarTekst({d:new Date(0),n:Infinity,f:new Float64Array([1.5])}));
  assert.equal(t.d.getTime(),0);assert.equal(t.n,Infinity);assert.equal(t.f[0],1.5);
});

test('integratie: schil, importer en planning vragen eerst toegang; profiel schermt kopieën af',()=>{
  const app=fs.readFileSync('site/app.js','utf8');
  assert.ok(app.indexOf('await vraagToegang(')<app.indexOf("importStap('Werkruimte lezen'"),'eerst ontgrendelen, dan lezen');
  assert.match(fs.readFileSync('site/signaalgever-importer.js','utf8'),/await vraagToegang\(/);
  assert.match(fs.readFileSync('site/planning/app.js','utf8'),/await vraagToegang\(/);
  const profiel=fs.readFileSync('site/core/actual-profile.js','utf8');
  for(const k of GEVOELIGE_KOPIEEN)assert.ok(profiel.includes(`'${k}'`),k);
  for(const f of ['site/index.html','site/signaalgever-importer.html','site/planning/index.html'])assert.match(fs.readFileSync(f,'utf8'),/toegang\.css/);
  assert.match(fs.readFileSync('site/planning/index.html','utf8'),/actual-profile\.js/);
  assert.doesNotMatch(fs.readFileSync('site/core/toegang.js','utf8'),/\.style\.|style=/,'geen inline stijl (CSP)');
});
