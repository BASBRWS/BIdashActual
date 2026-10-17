import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedQuery,createQueryPresetStore,createQueryValueIndex,suggestedValues} from '../site/core/query-builder.js';
import {applyQuery} from '../site/core/query-filter.js';
const fields=[{key:'tp'},{key:'codes'},{key:'n',type:'number'}];
const query={rules:[{field:'codes',operator:'equals',value:'1001'},{join:'and',field:'codes',operator:'equals',value:'1003'},{join:'or',field:'tp',operator:'equals',value:'CAM'}]};
test('opgeslagen EN/OF-query blijft na herladen gelijk en staat los van de bewerkbare query',async()=>{
 let saved,ids=0;const config={read:async()=>saved,write:async v=>saved=structuredClone(v),newId:()=>String(++ids)},s=createQueryPresetStore(config);await s.ready;
 const id=await s.save('assets','MSI en camera',checkedQuery(query,fields));const rows=[{tp:'MSI',codes:['1001','1003']},{tp:'MSI',codes:['1001']},{tp:'CAM',codes:[]}];
 const reopened=createQueryPresetStore(config);await reopened.ready;const p=reopened.list('assets')[0];assert.equal(p.id,id);assert.deepEqual(applyQuery(rows,p.query,fields),[rows[0],rows[2]]);
 p.query.rules[0].value='veranderd';assert.equal(reopened.list('assets')[0].query.rules[0].value,'1001');assert.deepEqual(reopened.list('faults'),[]);
});
test('een bestaande naam bijwerken maakt geen duplicaat, verwijderen wijzigt de andere lijst niet',async()=>{
 const s=createQueryPresetStore({read:async()=>null,write:async()=>{},newId:()=>Math.random().toString()});await s.ready;
 const id=await s.save('assets','Noord',query);await s.save('assets','noord',{rules:[]});await s.save('faults','Noord',query);
 assert.equal(s.list('assets').length,1);assert.equal(s.list('assets')[0].id,id);await s.remove('assets',id);assert.equal(s.list('assets').length,0);assert.equal(s.list('faults').length,1);
});
test('mislukte opslag behoudt de vorige query en een latere schrijfactie kan herstellen',async()=>{
 let fail=false;const s=createQueryPresetStore({read:async()=>null,write:async()=>{if(fail)throw Error('vol');},newId:()=> 'a'});await s.ready;await s.save('assets','Mijn query',query);fail=true;
 await assert.rejects(s.save('assets','Mijn query',{rules:[]}),/vol/);assert.equal(s.list('assets')[0].query.rules.length,3);fail=false;await s.remove('assets','a');assert.deepEqual(s.list('assets'),[]);
});
test('een onleesbare opgeslagen lijst wordt niet overschreven',async()=>{
 let writes=0;const s=createQueryPresetStore({read:async()=>({version:2}),write:async()=>writes++});await assert.rejects(s.ready,/niet worden gelezen/);await assert.rejects(s.save('assets','Naam',query));assert.equal(writes,0);
});
test('veldkeuzes gebruiken unieke waarden, losse foutcodes en behouden echte nulwaarden',async()=>{
 const values=createQueryValueIndex(),rows=[{tp:'MSI',codes:['1003','1001'],n:0},{tp:'msi',codes:['1001'],n:10},{tp:'CAM',codes:[],n:null},{tp:'',n:2}];
 assert.deepEqual(await values(rows,fields[0]),['CAM','MSI']);assert.deepEqual(await values(rows,fields[1]),['1001','1003']);assert.deepEqual(await values(rows,fields[2]),['0','2','10']);
 assert.deepEqual(suggestedValues(['Cámera Noord','MSI Zuid'],'camera'),['Cámera Noord']);
});
test('index bouwt per veld in blokken, wordt hergebruikt en vernieuwt bij een nieuwe bronlijst',async()=>{
 let pauses=0,reads=0;const index=createQueryValueIndex({yieldControl:async()=>pauses++}),field={key:'tp',value:r=>(reads++,r.tp)},rows=Array.from({length:5000},(_,i)=>({tp:'Type '+i}));
 await index(rows,field);assert(pauses>=9);assert.equal(reads,5000);await index(rows,field);assert.equal(reads,5000);assert.equal(suggestedValues(await index(rows,field)).length,100);
 const next=[{tp:'Nieuw'}];assert.deepEqual(await index(next,field),['Nieuw']);
});
test('een opgeslagen query met een onbekend veld of operator wordt niet als brede filter geladen',()=>{
 assert.throws(()=>checkedQuery({rules:[{field:'verwijderd',operator:'equals',value:'x'}]},fields),/niet beschikbaar/);
 assert.throws(()=>checkedQuery({rules:[{field:'n',operator:'contains',value:'1'}]},fields),/niet beschikbaar/);
});
