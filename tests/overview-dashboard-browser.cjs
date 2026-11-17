/* Overzichtsdashboard (2.88) in de echte schil met synthetische bronnen: getallen
   tegen de DVM-module, periodekeuze en opslag, tooltip met muis en toetsenbord,
   doorklikken en telefoonbreedte zonder horizontaal scrollen. Geen operationele data. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port,gereed=()=>page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
  await page.goto(base+'/index.html');await gereed();
  // Zonder bronnen: Onbekend, geen verzonnen nul.
  assert.match(await page.locator('#cards').innerText(),/Open storingen\s*Onbekend/);
  await page.locator('[data-group="data"]').click();
  const peil=Date.now()-3600000,iso=new Date(peil).toISOString(),vcs=['MN','NWN','ZWN','NON','ZN'],wegen=['A2','A4','A12'];
  const assets=Array.from({length:300},(_,i)=>{const w=wegen[i%3],hm=((i*7)%300)/10,r=i%2?'R':'L';return {entityid:'s'+i,'ci-type':i%3===0?'VKS detectielussen':'VKS signaalgevers',asset:`${i%3===0?'LUS':'MSI'} ${w} ${r} ${hm.toFixed(3).replace('.',',')} ${1+i%4}`,wegnummer:w.slice(1),'hm-bord':hm.toFixed(2).replace('.',','),baanpositie:r,regio:vcs[i%5],status:'Operationeel'};});
  const rij=(i,dagen,open)=>{const a=assets[(i*13)%300],van=new Date(peil-dagen*864e5-3600000).toISOString();return {event_id:'e'+i,vc:a.regio,weg:a.asset.split(' ')[1],richting:a.baanpositie,hm:Number(a['hm-bord'].replace(',','.')),MSI:a.asset,van,tot:open?iso:new Date(Date.parse(van)+36e5).toISOString(),foutcode:'1003',melding:'Fatale fout',assetTypeHint:a.asset.startsWith('LUS')?'LUS':'MSI',status:open?'open':'gesloten',_liveOpen:open,eerste_gezien:van,laatste_gezien:iso,bron_peildatum:iso,levenscyclus_status:open?(i%9===0?'VERDWENEN_UIT_SNAPSHOT':'OPEN_BEVESTIGD'):'HERSTELD_BEVESTIGD'};};
  const hist=Array.from({length:400},(_,i)=>rij(i,i%60,i<40)),live=hist.filter(r=>r._liveOpen);
  const bundle={formaat:'DVM-dienstimpact-totaal',assetregister:{bestand:'synthetic',rijen:assets},liveStoringen:[{key:'signaalgever-totaal-open',naam:'synthetic-open',_signaalgeverTotaal:true,rijen:live,peildatum:peil}],storingshistorie:[{key:'signaalgever-totaal-historie',naam:'synthetic-historie',_signaalgeverTotaal:true,rijen:hist}],bronbeheer:{signaalgeverTotaal:{laatstePerVc:{mn:peil,nwn:peil,zwn:peil,non:peil},snapshotDekking:{},open:live.length,historie:hist.length}}};
  await page.locator('#files').setInputFiles({name:'synthetic-overzicht.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});await page.locator('#applyImport').click();
  await page.waitForFunction(()=>/Import voltooid|Import gestopt/.test(document.getElementById('status').textContent),null,{timeout:90000});assert.match(await page.locator('#status').textContent(),/Import voltooid/);
  await page.locator('[data-group="overview"]').click();
  const dvm=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));
  const bron=await dvm.evaluate(()=>{const s=HUB.summary();return {open:HUB.faults().length,verloop:s.verloop,diensten:s.diensten.length};});
  // 1. Getallen volgen de bron.
  assert.equal(bron.verloop.dagen.length,90);assert.equal(bron.verloop.totaal,400,'elke historierij één keer, open dubbelingen niet dubbel');
  assert.equal(bron.verloop.dagen.reduce((s,d)=>s+d.nieuw,0),400);
  await page.waitForFunction(()=>/\d/.test(document.querySelector('#cards .ov-kpi strong')?.textContent||''));
  assert.equal(await page.locator('#cards .ov-kpi strong').first().innerText(),bron.open.toLocaleString('nl-NL'));
  assert.equal(await page.locator('#services .ov-dienst').count(),bron.diensten);
  assert.equal(await page.locator('#ovVc .ov-meter-rij').count(),5);
  // 2. Periode: standaard 30, 14 kiezen tekent 14 dagen en blijft na herladen.
  assert.equal(await page.locator('#ovTrend .ov-hit').count(),30);
  const som=n=>bron.verloop.dagen.slice(-n).reduce((s,d)=>s+d.nieuw,0);
  assert.match(await page.locator('#ovTrendMeta').innerText(),new RegExp('^'+som(30).toLocaleString('nl-NL')+' storingen gestart in 30 dagen'));
  await page.locator('[data-ov-periode="14"]').click();
  assert.equal(await page.locator('#ovTrend .ov-hit').count(),14);assert.equal(await page.locator('[data-ov-periode="14"]').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#ovTrendMeta').innerText(),new RegExp('^'+som(14).toLocaleString('nl-NL')+' storingen gestart in 14 dagen'));
  await page.reload();await gereed();await page.locator('[data-group="overview"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ovTrend .ov-hit').length===14);
  // 3. Tooltip met muis en toetsenbord; de laatste dag is gemarkeerd als lopend.
  const svg=page.locator('#ovTrend svg');await svg.scrollIntoViewIfNeeded();const box=await svg.boundingBox();
  await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);
  const tip=page.locator('#ovTrend .ov-tooltip');await tip.waitFor({state:'visible'});assert.match(await tip.innerText(),/\d+ nieuw/);
  await page.mouse.move(5,5);await tip.waitFor({state:'hidden'});
  await svg.focus();assert.match(await tip.innerText(),/tot peilmoment/,'focus toont de laatste, lopende dag');
  await page.keyboard.press('ArrowLeft');assert.doesNotMatch(await tip.innerText(),/tot peilmoment/);
  assert.equal(await page.locator('#ovTrend [data-ov-lopend]').count(),1);
  // 4. Doorklikken vanuit de pijplijn.
  await page.locator('#ovPipeline .ov-step').first().click();await page.waitForFunction(()=>location.hash==='#faults');
  // 5. Telefoon: geen horizontaal scrollen.
  await page.setViewportSize({width:390,height:844});await page.locator('[data-group="overview"]').click();await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'geen horizontaal scrollen op 390 px');
  assert.deepEqual(errors,[]);
  console.log('Overzichtsdashboard browser: getallen volgens de bron, periode en opslag, tooltip met muis en toetsenbord, lopende dag gemarkeerd, doorklikken en telefoonbreedte geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
