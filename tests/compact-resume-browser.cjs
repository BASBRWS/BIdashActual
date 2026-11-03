/* Echte downloads, totaalherstel en hervatting. Uitsluitend synthetische data. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site');
 const server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const base='http://127.0.0.1:'+server.address().port,errors=[];
  const context=await browser.newContext({timezoneId:'Europe/Amsterdam'}),seed=await context.newPage();seed.on('pageerror',e=>errors.push(e.message));seed.on('dialog',d=>d.accept());
  await seed.goto(base+'/engines/dvm.html');await seed.waitForFunction(()=>window.DVM_MTM_OPEN_DUMPS&&window.__BIDASH_DVM_SOURCE_EXPORT_COMPLETE__);
  const source=await seed.evaluate(async()=>{
   const assets=[1,2,3,9].map(id=>({entityid:'SEED-'+id,'ci-type':'VKS signaalgevers',asset:'MSI A77 R 12,000 '+id,wegnummer:'77','hm-bord':'12',baanpositie:'R',regio:id===9?'NWN':'MN',status:'Operationeel'}));analyseerAssetRegister(assets,'synthetisch');ASSET_REGISTER_STATE.ruweRegisterRijen=assets;
   const file=(day,ids,vc='mn')=>{const name=day+'1026_1_openstaandestoringen.txt',f=new File([`${day}-10-2026 12:00\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n')],name);Object.defineProperty(f,'webkitRelativePath',{value:`mtm/${vc}/storinglijst/2026/10/${day}/${name}`});return f;};
   await leesSignaalgeverMap([file(14,[1,2]),file(15,[2]),file(15,[9],'nwn')],{vcs:new Set(['mn','nwn']),formaat:'open-dump-48h'});
   const b=totaalExportBundle(undefined,{autosaveLean:false});
   // Meer dan de automatische herstelgrens. Een bewuste import moet alles herstellen.
   b.exportSelectie.assetregister=true;b.assetregister={bestand:'synthetisch',rijen:Array.from({length:20001},(_,i)=>({entityid:'SYN-'+i,'ci-type':'VKS signaalgevers',asset:'MSI A77 R 12,000 '+(i+1),wegnummer:'77','hm-bord':'12',baanpositie:'R',regio:'MN',status:'Operationeel'}))};
   b.parameters.cfg={...b.parameters.cfg,compactProbe:{zero:0,unknown:null,disabled:false}};
   return b;
  });
  assert.equal(source.liveStoringen.flatMap(b=>b.rijen).length,3);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/index.html#data');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  async function upload(p,b,name='totaal.json',fromSources=false){
   if(fromSources){await p.evaluate(()=>location.hash='sources');await p.waitForFunction(()=>!!document.querySelector('#engine-dvm iframe')?.contentWindow.HUB);}
   await p.locator('#files').setInputFiles({name,mimeType:'application/json',buffer:Buffer.from(JSON.stringify(b))});await p.locator('#applyImport').waitFor({state:'attached'});
   if(fromSources)await p.evaluate(()=>document.getElementById('applyImport').click());else await p.locator('#applyImport').click();
   await p.waitForFunction(()=>/Import voltooid|Import gestopt/.test(document.getElementById('status').textContent),null,{timeout:120000});assert.match(await p.locator('#status').textContent(),/Import voltooid/);
  }
  await upload(page,source,'oude-totaal.json',true);
  const frame=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));await frame.waitForFunction(()=>typeof ASSET_REGISTER_STATE!=='undefined'&&ASSET_REGISTER_STATE?.ruweRegisterRijen?.length===20001);assert.equal(await frame.evaluate(()=>ASSET_REGISTER_STATE.ruweRegisterRijen.length),20001);
  await page.evaluate(()=>location.hash='data');await page.locator('#all').click();
  const download=page.waitForEvent('download');await page.locator('#export').click();const first=JSON.parse(fs.readFileSync(await(await download).path(),'utf8'));
  assert.equal(first.formaat,'BiDash-integraal');assert.equal(first.delen.dvm.compacteStoringen.versie,1);assert.ok(first.delen.dvm.liveStoringen.every(b=>Array.isArray(b.rijenRefs)&&!('rijen' in b)));
  const decoded=await page.evaluate(b=>DVM_COMPACT.unpackAny(b),first);assert.equal(decoded.delen.dvm.assetregister.rijen.length,20001);assert.deepEqual(decoded.delen.dvm.parameters.cfg.compactProbe,{zero:0,unknown:null,disabled:false});
  const pending=decoded.delen.dvm.liveStoringen.flatMap(b=>b.rijen).find(r=>r.event_id==='1');assert.equal(pending.afwezig_sinds,'2026-10-15T10:00:00.000Z');
  // Een nieuwe browserwerkruimte kent niets van de vorige lokale opslag.
  const clean=await browser.newContext({timezoneId:'Europe/Amsterdam'}),restored=await clean.newPage();restored.on('pageerror',e=>errors.push(e.message));await restored.goto(base+'/index.html#data');await restored.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  await upload(restored,first,'compact-totaal.json',true);const rf=restored.frames().find(f=>/engines\/dvm.html/.test(f.url()));
  assert.equal(await rf.evaluate(()=>ASSET_REGISTER_STATE.ruweRegisterRijen.length),20001);
  const run=()=>rf.evaluate(async()=>{
   document.getElementById('sgMapProgress')?.close();
   const files=[14,15,16,17].map(day=>{const name=day+'1026_1_openstaandestoringen.txt',f=new File([`${day}-10-2026 12:00\n`+(day===14?[1,2]:day===15?[2]:[2,3]).map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n')],name);Object.defineProperty(f,'webkitRelativePath',{value:`mtm/mn/storinglijst/2026/10/${day}/${name}`});if(day===14)f.arrayBuffer=async()=>{throw Error('Een oude bestandsdag mag niet opnieuw gelezen worden');};return f;});
   await leesSignaalgeverMap(files,{vcs:new Set(['mn']),formaat:'open-dump-48h',hervatten:true});
   return {live:gecombineerdeLiveStoringsRijen(),history:gecombineerdeStoringsRijen(),meta:__BIDASH_SIGNAALGEVER_TOTAAL__};
  });
  const after=await run();assert.deepEqual(after.live.map(r=>r.vc+'|'+r.event_id).sort(),['mn|2','mn|3','nwn|9']);assert.equal(after.history.find(r=>r.event_id==='1').herstel_bevestiging_op,'2026-10-17T10:00:00.000Z');assert.equal(after.history.find(r=>r.event_id==='1').hersteld_op,null);
  assert.equal(after.live.find(r=>r.event_id==='2').incident_id,decoded.delen.dvm.liveStoringen.flatMap(b=>b.rijen).find(r=>r.event_id==='2').incident_id);assert.equal(after.meta.laatstePerVc.nwn,source.bronbeheer.signaalgeverTotaal.laatstePerVc.nwn);
  const repeat=await run();assert.deepEqual(repeat,after);
  await rf.evaluate(()=>document.getElementById('sgMapProgress')?.close());await restored.evaluate(()=>location.hash='data');await restored.locator('#all').click();
  const secondDownload=restored.waitForEvent('download');await restored.locator('#export').click();const second=JSON.parse(fs.readFileSync(await(await secondDownload).path(),'utf8'));
  const unpacked=await restored.evaluate(b=>DVM_COMPACT.unpackAny(b),second);assert.equal(unpacked.delen.dvm.storingshistorie.flatMap(b=>b.rijen).length,4);assert.equal(unpacked.delen.dvm.liveStoringen.flatMap(b=>b.rijen).length,3);assert.deepEqual(unpacked.delen.dvm.parameters.cfg.compactProbe,{zero:0,unknown:null,disabled:false});
  // De afzonderlijke DVM-download gebruikt hetzelfde formaat.
  await restored.locator('#exportDvm').evaluate(e=>e.closest('details').open=true);const nativeDownload=restored.waitForEvent('download');await restored.locator('#exportDvm').click();const native=JSON.parse(fs.readFileSync(await(await nativeDownload).path(),'utf8'));assert.equal(native.compacteStoringen.versie,1);
  const before=await rf.evaluate(()=>JSON.stringify([LIVE_STORINGSBRONNEN,STORINGSBRONNEN,__BIDASH_SIGNAALGEVER_TOTAAL__]));
  const bad=structuredClone(second);delete bad.delen.dvm.compacteStoringen;await restored.locator('#files').setInputFiles({name:'beschadigd.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});await restored.waitForFunction(()=>document.getElementById('status').textContent.includes('Ongeldige of onvolledige compacte storingsopslag'));
  assert.equal(await restored.locator('#applyImport').count(),0);assert.equal(await rf.evaluate(()=>JSON.stringify([LIVE_STORINGSBRONNEN,STORINGSBRONNEN,__BIDASH_SIGNAALGEVER_TOTAAL__])),before);
  assert.deepEqual(errors,[]);console.log('Compact totaal: oude import, 20.001 assets bewust volledig hersteld vanuit bronbeheer, echte integrale/DVM-downloads, schone werkruimte, hervatten per VC, 48 uur, herhaling en beschadigde import geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
