/* Echte maproute, overdracht en opslag. Alle bronregels zijn synthetisch. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),fixture=path.join(__dirname,'../.browser-test/open-dumps');fs.rmSync(fixture,{recursive:true,force:true});
 function dump(day,ids,extra=''){
  const d=String(day).padStart(2,'0'),name=d+'1026_1_openstaandestoringen.txt',dir=path.join(fixture,'mtm/mn/storinglijst/2026/10',d);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,name),`\ufeff${d}-10-2026 00:30\n|8|1003|1003 Fatale fout bij MSI 8|A77 R 12,000|01-01-2024 00:00|\n${d}-10-2026 23:30\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n')+extra);
  fs.writeFileSync(path.join(dir,d+'1026storinglijst.txt'),'Registreer BSS, dit grote log mag niet worden gelezen.');
 }
 dump(9,[1,2]);dump(10,[1,2]);dump(11,[99]);dump(12,[2,3]);dump(13,[2,3]);dump(14,[2,3]);
 const server=require('node:http').createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const context=await browser.newContext({timezoneId:'Europe/Amsterdam'}),base='http://127.0.0.1:'+server.address().port,page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto(base+'/index.html#sources');
  await page.waitForFunction(()=>!!document.querySelector('#engine-dvm iframe')?.contentWindow.DVM_MTM_OPEN_DUMPS);
  await page.locator('#engine-dvm').waitFor({state:'visible'});await page.locator('#engine-dvm iframe').scrollIntoViewIfNeeded();
  const frame=page.frames().find(f=>f.url().includes('/engines/dvm.html'));
  await frame.evaluate(async()=>{
   const rows=[1,2,3,8].map(id=>({entityid:'SYNTH-'+id,'ci-type':'VKS signaalgevers',asset:'MSI A77 R 12,000 '+id,wegnummer:'77','hm-bord':'12',baanpositie:'R',regio:'MN',status:'Operationeel'}));analyseerAssetRegister(rows,'synthetisch');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   const config={vcs:new Set(['nwn']),formaat:'open-dump-48h'},file=new File(['14-10-2026 23:30\n|9|1003|1003 Fatale fout bij MSI 1|A9 R 12,000|01-01-2024 00:00|'],'141026_1_openstaandestoringen.txt');Object.defineProperty(file,'webkitRelativePath',{value:'mtm/nwn/storinglijst/2026/10/14/'+file.name});await leesSignaalgeverMap([file],config);document.getElementById('sgMapProgress').close();
   LIVE_STORINGSBRONNEN.push({key:'synthetic-camera',rijen:[{vc:'MN',assetTypeHint:'CAM',melding:'synthetische camera'}]},{key:'synthetic-drip',virtueel:true,afgeleidVan:'dripHistorie',rijen:[{vc:'MN',assetTypeHint:'DRIP',melding:'synthetische drip'}]});
   const H=__BIDASH_STORINGSBUNDELAAR__,read=H.sbLeesTekst;window.__dumpReads=[];H.sbLeesTekst=async f=>{__dumpReads.push(f.name);return read(f);};
   const dir=(name,items)=>({name,kind:'directory',async *entries(){for(const h of items)yield [h.name,h];}});
   const fileHandle=(day,ids)=>{const d=String(day).padStart(2,'0'),name=d+'1026_1_openstaandestoringen.txt';return {name,kind:'file',async getFile(){return new File([`${d}-10-2026 00:30\n|8|1003|1003 Fatale fout bij MSI 8|A77 R 12,000|01-01-2024 00:00|\n${d}-10-2026 23:30\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n')],name);}};};
   const logs={name:'grootstoringlijst.txt',kind:'file',async getFile(){throw Error('BSS mag niet gelezen worden');}};
   window.showDirectoryPicker=async()=>dir('mtm',[dir('mn',[dir('storinglijst',[dir('2026',[dir('10',[dir('09',[fileHandle(9,[1,2]),logs]),dir('10',[fileHandle(10,[1,2]),logs]),dir('11',[fileHandle(11,[99]),logs]),dir('12',[fileHandle(12,[2,3]),logs]),dir('13',[fileHandle(13,[2,3]),logs]),dir('14',[fileHandle(14,[2,3]),logs])])])])])]);
   openSignaalgeverMapDialog();
  });
  assert.equal(await frame.locator('#sgFormaat').inputValue(),'open-dump-48h');await frame.locator('.sgVc[value="mn"]').check();await frame.locator('#sgVanaf').fill('2026-10-01');await frame.locator('#sgTot').fill('2026-10-14');
  await frame.locator('#sgMapVerder').click();await frame.waitForFunction(()=>document.getElementById('sgPFase').textContent.startsWith('Klaar (MN)'));
  const state=await frame.evaluate(()=>({open:LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).map(r=>r.vc+'|'+r.event_id).sort(),history:STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).map(r=>({id:r.event_id,vc:r.vc,status:r.levenscyclus_status,repair:r.hersteld_op,since:r.afwezig_sinds})),reads:__dumpReads,coverage:__BIDASH_SIGNAALGEVER_TOTAAL__.snapshotDekking.mn,rest:LIVE_STORINGSBRONNEN.filter(b=>b.key.startsWith('synthetic-')).map(b=>b.key),faults:HUB.faults().filter(r=>r.typeId==='MSI').map(r=>({status:r.levenscyclus_status,code:r.code}))}));
  assert.deepEqual(state.open,['mn|2','mn|3','mn|8','nwn|9']);assert.equal(state.history.find(r=>r.vc==='mn'&&r.id==='1').status,'HERSTELD_AFGELEID');assert.equal(state.history.find(r=>r.vc==='mn'&&r.id==='1').repair,null);assert.equal(state.history.find(r=>r.id==='8').status,'VERDWENEN_UIT_SNAPSHOT');assert.equal(state.history.find(r=>r.id==='8').since,'2026-10-14T21:30:00.000Z');assert.equal(state.history.find(r=>r.id==='99').status,'HERSTELD_AFGELEID');
  assert.equal(state.reads.length,6);assert(state.reads.every(n=>/openstaandestoringen/.test(n)));assert.equal(state.coverage.deelSnapshots,2);assert.equal(state.coverage.kopAfwijking,false);assert.equal(state.coverage.verwerkteSnapshots,12);assert.deepEqual(state.rest,['synthetic-camera','synthetic-drip']);assert(state.faults.length>=3);assert(state.faults.some(r=>r.status==='VERDWENEN_UIT_SNAPSHOT'));
  const pending=page.waitForEvent('download');await frame.locator('#sgPDownload').click();const dl=await pending,backup=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.equal(backup.liveStoringen.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).length,4);assert.equal(backup.bronbeheer.signaalgeverTotaal.snapshotDekking.mn.deelSnapshots,2);
  await frame.evaluate(async backup=>{await totaalImportJson(new File([JSON.stringify(backup)],'synthetic-backup.json'));},backup);
  assert.equal(await frame.evaluate(()=>LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).length),4);
  assert.equal(backup.liveStoringen.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).find(r=>r.event_id==='8').afwezig_sinds,'2026-10-14T21:30:00.000Z');
  await frame.evaluate(async()=>{
    document.getElementById('sgMapProgress')?.close();
    const files=[15,16].map(day=>new File([`${day}-10-2026 23:30\n`+[2,3].map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n')],day+'1026_1_openstaandestoringen.txt'));
    await leesSignaalgeverMap(files,{vcs:new Set(['mn']),formaat:'open-dump-48h'});
  });
  const continued=await frame.evaluate(()=>({open:LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).map(r=>r.vc+'|'+r.event_id).sort(),closed:STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).find(r=>r.vc==='mn'&&r.event_id==='8')}));
  assert.deepEqual(continued.open,['mn|2','mn|3','nwn|9']);assert.equal(continued.closed.herstel_bevestiging_op,'2026-10-16T21:30:00.000Z');
  const before=await frame.evaluate(()=>JSON.stringify({open:LIVE_STORINGSBRONNEN,history:STORINGSBRONNEN,status:__BIDASH_SIGNAALGEVER_TOTAAL__}));
  assert.match(await frame.evaluate(async()=>{const f=new File(['15-10-2026 23:30\n|kapot'],'151026_1_openstaandestoringen.txt');try{await leesSignaalgeverMap([f],{vcs:new Set(['mn']),formaat:'open-dump-48h'});return 'gelukt';}catch(e){return e.message;}}),/alarmregel/);
  assert.equal(await frame.evaluate(()=>JSON.stringify({open:LIVE_STORINGSBRONNEN,history:STORINGSBRONNEN,status:__BIDASH_SIGNAALGEVER_TOTAAL__})),before);
  // Losse importer gebruikt dezelfde snelle methode, zonder All Assets.
  const importer=await context.newPage();importer.on('pageerror',e=>errors.push(e.message));await importer.goto(base+'/signaalgever-importer.html');await importer.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));
  assert.equal(await importer.locator('#mode').inputValue(),'open-dump-48h');await importer.locator('#until').fill('2026-10-14');await importer.locator('#folder').setInputFiles(fixture);await importer.waitForFunction(()=>document.getElementById('status').textContent.startsWith('MN opgeslagen.'));
  const saved=await importer.evaluate(async()=>await(await import('/core/storage.js?v=20261016-1800')).createWorkspaceStorage('bidash-actual-signaalgever-importer').read());assert.deepEqual(saved.stands.mn.open.map(r=>r.event_id).sort(),['2','3','8']);assert.equal(saved.stands.mn.historie.find(r=>r.event_id==='1').levenscyclus_status,'HERSTELD_AFGELEID');
  await importer.reload();await importer.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));assert.equal(await importer.locator('#results tr').count(),1);
  const exportPromise=importer.waitForEvent('download');await importer.locator('#download').click();const exported=await exportPromise,bundle=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));assert.equal(bundle.bronbeheer.signaalgeverTotaal.snapshotDekking.mn.bronType,'open-dump-48h');
  assert.equal(bundle.liveStoringen.flatMap(b=>b.rijen).find(r=>r.event_id==='8').afwezig_sinds,'2026-10-14T21:30:00.000Z');
  const continuation=path.join(fixture,'next');
  for(const d of ['15','16']){const dir=path.join(continuation,'mtm/mn/storinglijst/2026/10',d);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,d+'1026_1_openstaandestoringen.txt'),`${d}-10-2026 23:30\n`+[2,3].map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n'));}
  await importer.locator('#until').fill('2026-10-16');await importer.locator('#folder').setInputFiles(continuation);await importer.waitForFunction(()=>document.getElementById('status').textContent.startsWith('MN opgeslagen.'));
  const resumed=await importer.evaluate(async()=>await(await import('/core/storage.js?v=20261016-1800')).createWorkspaceStorage('bidash-actual-signaalgever-importer').read());
  assert.deepEqual(resumed.stands.mn.open.map(r=>r.event_id).sort(),['2','3']);assert.equal(resumed.stands.mn.historie.find(r=>r.event_id==='8').herstel_bevestiging_op,'2026-10-16T21:30:00.000Z');
  await frame.evaluate(async()=>{
    document.getElementById('sgMapProgress')?.close();
    const file=new File(['16-10-2026 23:31\n|2|1003|1003 Fatale fout bij MSI 2|A77 R 12,000|01-01-2024 00:00|\n|3|1003|1003 Fatale fout bij MSI 3|A77 R 12,000|01-01-2024 00:00|\n|10|2001|2001 Hoofdvoeding uitgevallen|A77 R 12,000|01-01-2024 00:00|\n|11|9999|9999 Onbekend alarm|A77 R 12,000|01-01-2024 00:00|'],'161026_2_openstaandestoringen.txt');
    await leesSignaalgeverMap([file],{vcs:new Set(['mn']),formaat:'open-dump-48h'});
  });
  const mixed=await frame.evaluate(()=>({faults:HUB.faults().filter(r=>r.vc==='MN'&&['MSI','SYSTEEM','ONBEKEND'].includes(r.typeId)).map(r=>({type:r.typeId,impact:r.impact})),peil:HUB.summary().peildatum,source:LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).filter(r=>r.vc==='mn').length}));
  assert.equal(mixed.source,4);assert.equal(mixed.faults.length,4);assert.equal(mixed.peil,Date.parse('2026-10-16T21:31:00Z'));assert(mixed.faults.some(r=>r.type==='SYSTEEM'&&r.impact===null));assert(mixed.faults.some(r=>r.type==='ONBEKEND'&&r.impact===null));assert.equal(mixed.faults.filter(r=>r.type==='MSI'&&r.impact!==null).length,2);
  if(process.env.MTM_PRIVATE_FILE){
    const source=fs.readFileSync(process.env.MTM_PRIVATE_FILE,'utf8');
    const result=await frame.evaluate(async text=>{
      document.getElementById('sgMapProgress')?.close();
      const file=new File([text],'261025_1_openstaandestoringen.txt');
      const data=await DVM_MTM_OPEN_DUMPS.read([file],{vcs:new Set(['zn'])});
      const expected=DVM_MTM_OPEN_DUMPS.process({open:[],historie:[],laatstePerVc:{},snapshotDekking:{}},data.snapshots).open.length;
      await leesSignaalgeverMap([file],{vcs:new Set(['zn']),formaat:'open-dump-48h'});
      const rows=LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).filter(r=>r.vc==='zn');
      return {expected,visible:HUB.faults().filter(r=>r.vc==='ZN').length,actual:rows.length,unique:new Set(rows.map(r=>r.event_id)).size,blocks:__BIDASH_SIGNAALGEVER_TOTAAL__.snapshotDekking.zn.deelSnapshots};
    },source);
    assert.equal(result.actual,result.expected);assert.equal(result.visible,result.expected);assert.equal(result.unique,result.expected);assert.equal(result.blocks,2);
    console.log('Aanvullende lokale broncontrole geslaagd, geen operationele rijen of tellingen gelogd.');
  }
  assert.deepEqual(errors,[]);console.log('Openstaande dumps browser: echte mapdialoog, alle zes dagen gelezen, alle blokken, terugkeer en 48 uur vanaf eerste afwezigheid, behoud andere VC/CAM/DRIP, actuele impact, JSON, rollback en losse importer/herladen geslaagd.');
 }finally{await browser?.close();server.close();fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
