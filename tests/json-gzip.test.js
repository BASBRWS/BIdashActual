import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {isGzipKop,gzipNaam,zonderGzip,leesBestandTekst,leesJsonBestand,maakJsonBestand,JSON_BESTAND,leesGzipVoorkeur,bewaarGzipVoorkeur} from '../site/core/json-gzip.js';
import {nieuwsteMomentopnameUitMap,schrijfBestandNaarMap} from '../site/core/latest-snapshot.js';

const bestand=(naam,inhoud,lastModified=0)=>new File([inhoud],naam,{lastModified});
const voorbeeld={formaat:'BiDash-integraal',versie:1,opgeslagen:'2026-11-16T10:00:00Z',delen:{dvm:{nul:0,leeg:null,tekst:'Zuid-Holland – ë',lijst:[1,2,3]}}};

test('herkent gzip aan de kop en niet aan de naam',()=>{
  assert.equal(isGzipKop(new Uint8Array([0x1f,0x8b,8])),true);
  assert.equal(isGzipKop(new Uint8Array([0x7b,0x22])),false);
  assert.equal(isGzipKop(null),false);
  assert.ok(JSON_BESTAND.test('a.json')&&JSON_BESTAND.test('a.JSON.GZ')&&!JSON_BESTAND.test('a.xer')&&!JSON_BESTAND.test('a.gz'));
  assert.equal(gzipNaam('a.json'),'a.json.gz');assert.equal(gzipNaam('a.json.gz'),'a.json.gz');
  assert.equal(zonderGzip('a.json.gz'),'a.json');assert.equal(zonderGzip('a.json'),'a.json');
});

test('ingepakte export pakt verliesloos uit, inclusief null, 0 en niet-ASCII-tekens',async()=>{
  const uit=await maakJsonBestand(voorbeeld,'bidash-integraal_2026-11-16.json');
  assert.equal(uit.name,'bidash-integraal_2026-11-16.json.gz');assert.equal(uit.type,'application/gzip');assert.equal(uit.ingepakt,true);
  const bytes=new Uint8Array(await uit.blob.arrayBuffer());assert.equal(isGzipKop(bytes),true);
  const terug=await leesJsonBestand(bestand(uit.name,bytes));
  assert.deepEqual(terug,voorbeeld);
  assert.equal(await leesBestandTekst(bestand(uit.name,bytes)),JSON.stringify(voorbeeld));
});

test('grote herhalende JSON wordt duidelijk kleiner',async()=>{
  const rijen=Array.from({length:5000},(_,i)=>({entityid:'asset-'+i,'ci-type':'VKS signaalgevers',status:'Operationeel',regio:'MN',wegnummer:'77'}));
  const uit=await maakJsonBestand({rijen},'groot.json');
  assert.ok(uit.blob.size*5<uit.origineel,`${uit.blob.size} tegen ${uit.origineel}`);
});

test('gewone JSON, ook hernoemd tot .json.gz, blijft leesbaar; ingepakt zonder .gz ook',async()=>{
  assert.deepEqual(await leesJsonBestand(bestand('oud.json',JSON.stringify(voorbeeld))),voorbeeld);
  assert.deepEqual(await leesJsonBestand(bestand('hernoemd.json.gz',JSON.stringify(voorbeeld))),voorbeeld);
  assert.deepEqual(await leesJsonBestand(bestand('zonder-extensie.json',gzipSync(JSON.stringify(voorbeeld)))),voorbeeld);
});

test('beschadigd of afgekapt gzip geeft een begrijpelijke fout met bestandsnaam',async()=>{
  const heel=gzipSync(JSON.stringify(voorbeeld));
  await assert.rejects(leesBestandTekst(bestand('afgekapt.json.gz',heel.subarray(0,heel.length-12))),/afgekapt\.json\.gz is geen geldig of volledig gzip-bestand/);
  await assert.rejects(leesBestandTekst(bestand('kapot.json.gz',new Uint8Array([0x1f,0x8b,1,2,3,4,5]))),/kapot\.json\.gz is geen geldig of volledig gzip-bestand/);
});

test('zonder CompressionStream valt de export terug op gewone JSON en meldt dat',async()=>{
  const scope={Blob,Response};
  const uit=await maakJsonBestand(voorbeeld,'a.json.gz',{scope});
  assert.equal(uit.name,'a.json');assert.equal(uit.ingepakt,false);assert.equal(await uit.blob.text(),JSON.stringify(voorbeeld));
  await assert.rejects(leesBestandTekst(bestand('x.json.gz',gzipSync('{}')),{scope:{Blob,Response}}),/kan x\.json\.gz niet uitpakken/);
  const zonder=await maakJsonBestand(voorbeeld,'b.json',{gzip:false});assert.equal(zonder.name,'b.json');assert.equal(zonder.ingepakt,false);
});

test('de inpakvoorkeur staat standaard aan en wordt per browser onthouden',()=>{
  const opslag=new Map(),scope={localStorage:{getItem:k=>opslag.has(k)?opslag.get(k):null,setItem:(k,v)=>opslag.set(k,v)}};
  assert.equal(leesGzipVoorkeur(scope),true);bewaarGzipVoorkeur(false,scope);assert.equal(leesGzipVoorkeur(scope),false);
  bewaarGzipVoorkeur(true,scope);assert.equal(leesGzipVoorkeur(scope),true);
  assert.equal(leesGzipVoorkeur({get localStorage(){throw Error('geblokkeerd')}}),true);
});

test('de gekoppelde map vindt ook de nieuwste .json.gz en schrijft een ingepakte Blob ongewijzigd',async()=>{
  const oud=bestand('bidash-integraal_2026-11-10.json',JSON.stringify({...voorbeeld,opgeslagen:'2026-11-10T10:00:00Z'}));
  const nieuw=bestand('bidash-integraal_2026-11-16.json.gz',gzipSync(JSON.stringify(voorbeeld)));
  const entries=[oud,nieuw,bestand('notitie.gz',gzipSync('x'))].map(f=>({kind:'file',name:f.name,getFile:async()=>f}));
  const gevonden=await nieuwsteMomentopnameUitMap({async *values(){yield* entries;}});
  assert.equal(gevonden.file.name,'bidash-integraal_2026-11-16.json.gz');assert.equal(gevonden.onderzocht,2);
  let geschreven=null;
  const handle={queryPermission:async()=>'granted',getFileHandle:async()=>({createWritable:async()=>({write:async b=>{geschreven=b;},close:async()=>{}})})};
  const uit=await maakJsonBestand(voorbeeld,'x.json');
  const r=await schrijfBestandNaarMap(handle,{name:uit.name,data:uit.blob,type:uit.type});
  assert.equal(geschreven,uit.blob);assert.equal(r.bytes,uit.blob.size);
});
