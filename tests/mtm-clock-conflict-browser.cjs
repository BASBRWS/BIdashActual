/* Gedeelde parser via beide echte importers. Geen operationele fixture in Git. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),fixture=path.join(__dirname,'../.browser-test/clock-conflict');fs.rmSync(fixture,{recursive:true,force:true});
 const server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});const base='http://127.0.0.1:'+server.address().port,errors=[];
  const synthetic='27-07-2026 00:30\n|1|1003|1003 Fatale fout bij MSI 1|A77 R 12,000|26-07-2026 12:00|\n|2|1003|1003 Fatale fout bij MSI 2|A77 R 12,000|27-07-2026 00:47|';
  const cases=[{name:'synthetic',text:synthetic}];if(process.env.MTM_CLOCK_PRIVATE_FILE)cases.push({name:'private',text:fs.readFileSync(process.env.MTM_CLOCK_PRIVATE_FILE,'utf8')});
  for(const source of cases){
   const context=await browser.newContext({timezoneId:'Europe/Amsterdam'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   const dir=path.join(fixture,source.name,'mtm/nwn/storinglijst/2026/07/27');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'270726_1_openstaandestoringen.txt'),source.text);
   const expected=source.text.split(/\r?\n/).filter(l=>l.trim().startsWith('|')).length;
   await page.goto(base+'/signaalgever-importer.html');await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));
   await page.locator('#vc').selectOption('nwn');await page.locator('#from').fill('2026-07-27');await page.locator('#until').fill('2026-07-27');await page.locator('#folder').setInputFiles(path.join(fixture,source.name));
   await page.waitForFunction(()=>/NWN opgeslagen|geen nieuwe stand opgeslagen/.test(document.getElementById('status').textContent));assert.match(await page.locator('#status').textContent(),/NWN opgeslagen.*tijdsafwijking/i);assert.match(await page.locator('#results').textContent(),/Tijdsafwijking, toestand onzeker/);
   const saved=await page.evaluate(async()=>await(await import('/core/storage.js')).createWorkspaceStorage('bidash-actual-signaalgever-importer').read());
   assert.equal(saved.stands.nwn.open.length,expected);assert.ok(saved.stands.nwn.open.every(r=>r.levenscyclus_status==='ONBEKEND_DOOR_BRONGAT'&&r.hersteld_op===null&&r.afwezig_sinds===null));assert.equal(saved.stands.nwn.snapshotDekking.nwn.volledig,false);assert.equal(saved.stands.nwn.laatstePerVc.nwn,Date.parse('2026-07-26T22:30:00Z'));
   const log=await page.evaluate(()=>BIDASH_DIAGNOSTICS.report().entries.filter(e=>e.event==='mtm.dump.clock-conflict'));assert.equal(log.length,1);assert.equal(log[0].data.differenceMinutes,17);
   const dl=page.waitForEvent('download');await page.locator('#download').click();const encoded=JSON.parse(fs.readFileSync(await(await dl).path(),'utf8')),bundle=await page.evaluate(b=>DVM_COMPACT.unpackDvm(b),encoded);assert.equal(bundle.liveStoringen.flatMap(b=>b.rijen).length,expected);assert.equal(bundle.bronbeheer.signaalgeverTotaal.snapshotDekking.nwn.kopAfwijking,true);
   await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.startsWith('Gereed.'));assert.match(await page.locator('#results').textContent(),/Tijdsafwijking, toestand onzeker/);
   // Het dashboard leest dezelfde ruwe bron zelf en bewaart een andere VC.
   const app=await context.newPage();app.on('pageerror',e=>errors.push(e.message));app.on('dialog',d=>d.accept());await app.goto(base+'/index.html#sources');await app.waitForFunction(()=>!!document.querySelector('#engine-dvm iframe')?.contentWindow.DVM_MTM_OPEN_DUMPS);
   const frame=app.frames().find(f=>/engines\/dvm.html/.test(f.url()));
   const result=await frame.evaluate(async text=>{
    const rows=[{entityid:'TEST-NWN','ci-type':'VKS signaalgevers',asset:'MSI A77 R 12,000 1',wegnummer:'77','hm-bord':'12',baanpositie:'R',regio:'NWN',status:'Operationeel'}];analyseerAssetRegister(rows,'synthetisch');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
    const file=(body,vc,day)=>{const name=day+'0726_1_openstaandestoringen.txt',f=new File([body],name);Object.defineProperty(f,'webkitRelativePath',{value:`mtm/${vc}/storinglijst/2026/07/${day}/${name}`});return f;};
    await leesSignaalgeverMap([file('27-07-2026 12:00\n|9|1003|1003 Fatale fout bij MSI 1|A77 R 12,000|26-07-2026 12:00|','mn',27)],{vcs:new Set(['mn']),formaat:'open-dump-48h'});document.getElementById('sgMapProgress')?.close();
    const logical=rows=>rows.map(({_bronBestand,...r})=>r);const before=JSON.stringify(logical(gecombineerdeLiveStoringsRijen().filter(r=>r.vc==='mn')));
    await leesSignaalgeverMap([file(text,'nwn',27)],{vcs:new Set(['nwn']),formaat:'open-dump-48h'});
    const result={nwn:gecombineerdeLiveStoringsRijen().filter(r=>r.vc==='nwn'),otherPreserved:before===JSON.stringify(logical(gecombineerdeLiveStoringsRijen().filter(r=>r.vc==='mn'))),meta:__BIDASH_SIGNAALGEVER_TOTAAL__.snapshotDekking.nwn,faults:HUB.faults().filter(r=>r.vc==='NWN').length};
    document.getElementById('sgMapProgress')?.close();return result;
   },source.text);
   assert.equal(result.nwn.length,expected);assert.ok(result.nwn.every(r=>r.levenscyclus_status==='ONBEKEND_DOOR_BRONGAT'));assert.equal(result.otherPreserved,true);assert.equal(result.faults,expected);assert.equal(result.meta.alarmNaKop,log[0].data.alarmAfterHeader);assert.equal(result.meta.laatsteAlarmdatum,'2026-07-26T22:47:00.000Z');assert.equal(result.meta.sluitenToegestaan,false);assert.equal(result.meta.volledig,false);
   assert.match(await frame.locator('#sgPFase').textContent(),/tijdswaarschuwing/i);
   // De compacte download uit de losse importer kan ook als update worden geladen.
   await frame.evaluate(async b=>{await leesSignaalgeverTotaalBestand(new File([JSON.stringify(b)],'clock-import.json'));},encoded);
   assert.equal(await frame.evaluate(()=>gecombineerdeLiveStoringsRijen().filter(r=>r.vc==='nwn').length),expected);assert.equal(await frame.evaluate(()=>__BIDASH_SIGNAALGEVER_TOTAAL__.snapshotDekking.nwn.kopAfwijking),true);
   await context.close();console.log(source.name==='private'?'Aangeleverde bron: beide echte importers, alle bronregels behouden, tijdswaarschuwing, opslag/herladen en compacte overdracht geslaagd.':'Synthetische klokafwijking: beide echte importers, meldingen zichtbaar, andere VC behouden, geen herstelbewijs, storingslog, opslag/herladen en compacte overdracht geslaagd.');
  }
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();await new Promise(r=>server.close(r));fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
