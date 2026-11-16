import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';

/* DVM 153: het HM-venster, de kolomtabel in normRij en de tekstcaches mogen alleen
   sneller zijn. Deze tests vergelijken de uitkomst met de volledige scan. */
function runtime(rows){
  const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);r.rows=rows;r.eval('analyseerAssetRegister(rows,"synthetic snelheid")');
  return r;
}
// Eén asset zonder bruikbare HM en één met een niet-eindige HM. Na een configwijziging
// bouwt het register zich opnieuw op uit de bron; daarom pas na de correcties zetten.
function zonderHm(r){
  r.eval('for(const [k,v] of [["ID:GEEN-HM",null],["ID:S7",NaN]]){const a=ASSET_REGISTER_STATE.assets.find(a=>a.key===k);a.hm=v;}bouwAssetIndex();');
  assert.equal(r.eval('ASSET_INDEX.byKey.get("ID:GEEN-HM").hm'),null);
}
let zaad=7;const rnd=()=>{zaad=(zaad*1103515245+12345)%2147483648;return zaad/2147483648;};
const wegen=['A15','A16'];
const rows=[];
for(let i=0;i<900;i++){
  const weg=wegen[i%2],hm=(rnd()*40).toFixed(3).replace('.',','),kant=rnd()<.5?'L':'R',lane=1+Math.floor(rnd()*4);
  rows.push({entityid:'S'+i,asset:`MN VKS MSI ${weg}${kant} ${hm} ${lane}`,'ci-type':'VKS signaalgevers',regio:rnd()<.8?'VCMN':'VCZWN',status:'Operationeel'});
}
// Assets zonder bruikbare HM en een DVKA-letter moeten in elk venster blijven meedoen.
rows.push({entityid:'GEEN-HM',asset:'MN VKS MSI A15L 5,000 3','ci-type':'VKS signaalgevers',regio:'VCMN',status:'Operationeel'});
rows.push({entityid:'DVKA',asset:'MN VKS MSI A15n 12,345 3','ci-type':'VKS signaalgevers',regio:'VCMN',status:'Operationeel','bps-locatie':'RW015 12,3 +45 VW n 3 R- L',baanpositie:'L'});
const meldingen=[];
for(let i=0;i<500;i++){
  const weg=wegen[i%3===0?1:0],side=['LI','RE','n',''][i%4],hm=(rnd()*42).toFixed(3),unit=i%5===0?'':String(1+i%4);
  meldingen.push({locatie:`${weg} ${side} HMP ${hm}`,vc:i%7===0?'':'MN',assettype:'MSI',strook:unit,melding:unit?`MSI ${unit} defect`:'Fatale fout',foutcode:'1003',van:'2026-01-01'});
}
meldingen.push({locatie:'A15 LI',vc:'MN',assettype:'MSI',strook:'3',melding:'zonder hm',foutcode:'1003',van:'2026-01-01'});
const beeld=k=>JSON.stringify({asset:k.asset&&k.asset.key,status:k.status,methode:k.methode,afstand:k.afstand,reden:k.reden,redenCode:k.redenCode,suggesties:(k.suggesties||[]).map(a=>a&&a.key),details:k.kandidaatDetails,loc:k.locatieKandidaten});

test('HM-venster geeft exact dezelfde koppeling, suggesties en redenen als een volledige scan',()=>{
  const r=runtime(rows);
  r.eval('assetConfigBasis().overrides["ID:S3"]={locatie:{weg:"A15",hm:39.9,richting:"LI"}};ASSET_CONFIG_VERSIE++;bouwAssetIndex();');zonderHm(r);
  for(const tol of [.35,.01,2]){
    r.eval(`assetConfigBasis().hmTolerantieKm=${tol};`);
    const met=meldingen.map(m=>{r.eval('DVM_KANDIDAAT_VENSTER=true');return beeld(r.koppelMeldingAanAsset(r.normRij(m),'MSI'));});
    const zonder=meldingen.map(m=>{r.eval('DVM_KANDIDAAT_VENSTER=false');return beeld(r.koppelMeldingAanAsset(r.normRij(m),'MSI'));});
    r.eval('DVM_KANDIDAAT_VENSTER=true');
    assert.deepEqual(met,zonder,`tolerantie ${tol}`);
    assert.ok(met.some(x=>JSON.parse(x).asset)&&met.some(x=>!JSON.parse(x).asset),'zowel gekoppelde als open meldingen getoetst');
  }
});

test('het venster bevat assets zonder HM en met locatiecorrectie, in de oorspronkelijke volgorde',()=>{
  const r=runtime(rows);
  r.eval('assetConfigBasis().overrides["ID:S5"]={locatie:{weg:"A16",hm:1,richting:"RE"}};ASSET_CONFIG_VERSIE++;bouwAssetIndex();');zonderHm(r);
  const keys=JSON.parse(r.eval('JSON.stringify(assetKandidatenOpWeg("MSI","A15",20).map(a=>a.key))'));
  const volledig=JSON.parse(r.eval('JSON.stringify((ASSET_INDEX.byTypeRoad.get("MSI|A15")||[]).map(a=>a.key))'));
  assert.ok(keys.includes('ID:GEEN-HM'));
  const s7weg=r.eval('ASSET_INDEX.byKey.get("ID:S7").weg');assert.ok(JSON.parse(r.eval(`JSON.stringify(assetKandidatenOpWeg("MSI","${s7weg}",20).map(a=>a.key))`)).includes('ID:S7'),'niet-eindige HM blijft kandidaat');
  assert.ok(keys.length<volledig.length/3,`${keys.length} van ${volledig.length}`);
  assert.deepEqual(keys,volledig.filter(k=>keys.includes(k)),'volgorde gelijk aan de weglijst');
  const a16=JSON.parse(r.eval('JSON.stringify(assetKandidatenOpWeg("MSI","A16",30).map(a=>a.key))'));
  assert.ok(a16.includes('ID:S5'),'asset met locatiecorrectie blijft kandidaat');
  assert.equal(r.eval('assetKandidatenOpWeg("MSI","A15",null).length'),volledig.length,'zonder HM volledige weglijst');
});

test('normRij: kolomnamen hoofdletterongevoelig, bij dubbele namen wint de eerste',()=>{
  const r=dvmRuntime();
  const m=r.normRij({MSI:'3',msi:'5',Melding:'MSI 3 defect',LOCATIE:'A15 LI HMP 12.345',VC:'MN',Foutcode:'1003'});
  assert.equal(m.strook,'3');assert.equal(m.melding,'MSI 3 defect');assert.equal(m.weg,'A15');assert.equal(m.hm,12.345);assert.equal(m.code,'1003');
  const n=r.normRij({msi:'5',MSI:'3'});assert.equal(n.strook,'5');
});

test('tekstcaches geven dezelfde uitkomst als zonder cache en blijven bereikbaar als functie',()=>{
  const r=dvmRuntime();
  const invoer=['A15',' a015 ','N31','015','0','vcmn','WNN','VC-ZWN','links','Re','é-MSI 3',12,0,null,undefined,'',' ',{},'A15'];
  const verwacht={dvmWeg:{'A15':'A15',' a015 ':'A15','N31':'N31','015':'A15','0':''},normAssetVc:{'vcmn':'MN','WNN':'NWN','VC-ZWN':'ZWN'},normAssetRichting:{'links':'LI','Re':'RE'},normAssetTekst:{'é-MSI 3':'EMSI3'}};
  for(const f of ['normAssetTekst','normAssetVc','normAssetRichting','dvmWeg']){
    assert.equal(typeof r[f],'function');
    const vers=invoer.map(v=>{r[f].cache?.clear();return r[f](v);});
    for(let ronde=0;ronde<2;ronde++)invoer.forEach((v,i)=>assert.equal(r[f](v),vers[i],`${f}(${JSON.stringify(v)})`));
    for(const [v,u] of Object.entries(verwacht[f]))assert.equal(r[f](v),u,`${f}(${JSON.stringify(v)})`);
  }
});

test('meldingStrook-cache volgt wijzigingen in strook, melding en gevolg',()=>{
  const r=dvmRuntime(),m={strook:'',melding:'MSI 2 defect',gevolg:''};
  assert.equal(r.meldingStrook(m),'2');m.melding='MSI 4 defect';assert.equal(r.meldingStrook(m),'4');
  m.strook='1';assert.equal(r.meldingStrook(m),'1');m.strook='';m.gevolg='rijstrook 3';m.melding='';assert.equal(r.meldingStrook(m),'3');
});
