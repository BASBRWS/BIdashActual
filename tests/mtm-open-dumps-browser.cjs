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
 dump(9,[1,2]);dump(10,[1,2]);dump(11,[99]);dump(12,[2,3]);
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
   const config={vcs:new Set(['nwn']),formaat:'open-dump-48h'},file=new File(['12-10-2026 23:30\n|9|1003|1003 Fatale fout bij MSI 1|A9 R 12,000|01-01-2024 00:00|'],'121026_1_openstaandestoringen.txt');Object.defineProperty(file,'webkitRelativePath',{value:'mtm/nwn/storinglijst/2026/10/12/'+file.name});await leesSignaalgeverMap([file],config);document.getElementById('sgMapProgress').close();
   LIVE_STORINGSBRONNEN.push({key:'synthetic-camera',rijen:[{vc:'MN',assetTypeHint:'CAM',melding:'synthetische camera'}]},{key:'synthetic-drip',virtueel:true,afgeleidVan:'dripHistorie',rijen:[{vc:'MN',assetTypeHint:'DRIP',melding:'synthetische drip'}]});
   const H=__BIDASH_STORINGSBUNDELAAR__,read=H.sbLeesTekst;window.__dumpReads=[];H.sbLeesTekst=async f=>{__dumpReads.push(f.name);return read(f);};
   const dir=(name,items)=>({name,kind:'directory',async *entries(){for(const h of items)yield [h.name,h];}});
   const fileHandle=(day,ids)=>{const d=String(day).padStart(2,'0'),name=d+'1026_1_openstaandestoringen.txt';return {name,kind:'file',async getFile(){return new File([`${d}-10-2026 00:30\n|8|1003|1003 Fatale fout bij MSI 8|A77 R 12,000|01-01-2024 00:00|\n${d}-10-2026 23:30\n`+ids.map(id=>`|${id}|1003|1003 Fatale fout bij MSI ${id}|A77 R 12,000|01-01-2024 00:00|`).join('\n')],name);}};};
   const logs={name:'grootstoringlijst.txt',kind:'file',async getFile(){throw Error('BSS mag niet gelezen worden');}};
   window.showDirectoryPicker=async()=>dir('mtm',[dir('mn',[dir('storinglijst',[dir('2026',[dir('10',[dir('09',[fileHandle(9,[1,2]),logs]),dir('10',[fileHandle(10,[1,2]),logs]),dir('11',[fileHandle(11,[99]),logs]),dir('12',[fileHandle(12,[2,3]),logs])])])])])]);
   openSignaalgeverMapDialog();
  });
  assert.equal(await frame.locator('#sgFormaat').inputValue(),'open-dump-48h');await frame.locator('.sgVc[value="mn"]').check();await frame.locator('#sgVanaf').fill('2026-10-01');await frame.locator('#sgTot').fill('2026-10-12');
  await frame.locator('#sgMapVerder').click();await frame.waitForFunction(()=>document.getElementById('sgPFase').textContent.startsWith('Klaar (MN)'));
  const state=await frame.evaluate(()=>({open:LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).map(r=>r.vc+'|'+r.event_id).sort(),history:STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).map(r=>({id:r.event_id,vc:r.vc,status:r.levenscyclus_status,repair:r.hersteld_op})),reads:__dumpReads,coverage:__BIDASH_SIGNAALGEVER_TOTAAL__.snapshotDekking.mn,rest:LIVE_STORINGSBRONNEN.filter(b=>b.key.startsWith('synthetic-')).map(b=>b.key),faults:HUB.faults().filter(r=>r.typeId==='MSI').map(r=>r.code)}));
  assert.deepEqual(state.open,['mn|2','mn|3','nwn|9']);assert.equal(state.history.find(r=>r.vc==='mn'&&r.id==='1').status,'HERSTELD_AFGELEID');assert.equal(state.history.find(r=>r.vc==='mn'&&r.id==='1').repair,null);assert(!state.history.some(r=>r.id==='8'||r.id==='99'));
  assert.equal(state.reads.length,2);assert(state.reads.every(n=>/openstaandestoringen/.test(n)));assert.equal(state.coverage.deelSnapshots,2);assert.equal(state.coverage.kopAfwijking,false);assert.equal(state.coverage.vergelijkingUren,48);assert.deepEqual(state.rest,['synthetic-camera','synthetic-drip']);assert(state.faults.length>=2);
  const pending=page.waitForEvent('download');await frame.locator('#sgPDownload').click();const dl=await pending,backup=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));assert.equal(backup.liveStoringen.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).length,3);assert.equal(backup.bronbeheer.signaalgeverTotaal.snapshotDekking.mn.deelSnapshots,2);
  await frame.evaluate(async backup=>{await totaalImportJson(new File([JSON.stringify(backup)],'synthetic-backup.json'));},backup);
  assert.equal(await frame.evaluate(()=>LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).length),3);
  const before=await frame.evaluate(()=>JSON.stringify({open:LIVE_STORINGSBRONNEN,history:STORINGSBRONNEN,status:__BIDASH_SIGNAALGEVER_TOTAAL__}));
  assert.match(await frame.evaluate(async()=>{const f=new File(['13-10-2026 23:30\n|kapot'],'131026_1_openstaandestoringen.txt');try{await leesSignaalgeverMap([f],{vcs:new Set(['mn']),formaat:'open-dump-48h'});return 'gelukt';}catch(e){return e.message;}}),/alarmregel/);
  assert.equal(await frame.evaluate(()=>JSON.stringify({open:LIVE_STORINGSBRONNEN,history:STORINGSBRONNEN,status:__BIDASH_SIGNAALGEVER_TOTAAL__})),before);
  // Losse importer gebruikt dezelfde snelle methode, zonder All Assets.
  const importer=await context.newPage();importer.on('pageerror',e=>errors.push(e.message));await importer.goto(base+'/signaalgever-importer.html');await importer.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));
  assert.equal(await importer.locator('#mode').inputValue(),'open-dump-48h');await importer.locator('#until').fill('2026-10-12');await importer.locator('#folder').setInputFiles(fixture);await importer.waitForFunction(()=>document.getElementById('status').textContent.startsWith('MN opgeslagen.'));
  const saved=await importer.evaluate(async()=>await(await import('/core/storage.js?v=20261016-0912')).createWorkspaceStorage('bidash-actual-signaalgever-importer').read());assert.deepEqual(saved.stands.mn.open.map(r=>r.event_id).sort(),['2','3']);assert.equal(saved.stands.mn.historie.find(r=>r.event_id==='1').levenscyclus_status,'HERSTELD_AFGELEID');
  await importer.reload();await importer.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));assert.equal(await importer.locator('#results tr').count(),1);
  const exportPromise=importer.waitForEvent('download');await importer.locator('#download').click();const exported=await exportPromise,bundle=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));assert.equal(bundle.bronbeheer.signaalgeverTotaal.snapshotDekking.mn.bronType,'open-dump-48h');
  if(process.env.MTM_PRIVATE_FILE){
    const source=fs.readFileSync(process.env.MTM_PRIVATE_FILE,'utf8');
    const result=await frame.evaluate(async text=>{
      document.getElementById('sgMapProgress')?.close();
      const file=new File([text],'261025_1_openstaandestoringen.txt');
      const data=await DVM_MTM_OPEN_DUMPS.read([file],{vcs:new Set(['zn'])});
      const expected=data.snapshots[0].rows.length;
      await leesSignaalgeverMap([file],{vcs:new Set(['zn']),formaat:'open-dump-48h'});
      const rows=LIVE_STORINGSBRONNEN.filter(b=>b._signaalgeverTotaal).flatMap(b=>b.rijen).filter(r=>r.vc==='zn');
      return {expected,actual:rows.length,unique:new Set(rows.map(r=>r.event_id)).size,blocks:__BIDASH_SIGNAALGEVER_TOTAAL__.snapshotDekking.zn.deelSnapshots};
    },source);
    assert.equal(result.actual,result.expected);assert.equal(result.unique,result.expected);assert.equal(result.blocks,2);
    console.log('Aanvullende lokale broncontrole geslaagd, geen operationele rijen of tellingen gelogd.');
  }
  assert.deepEqual(errors,[]);console.log('Openstaande dumps browser: echte mapdialoog, twee gelezen bestanden, meerdere blokken, 48-uursherstel, behoud andere VC/CAM/DRIP, actuele impact, JSON, rollback en losse importer/herladen geslaagd.');
 }finally{await browser?.close();server.close();fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
