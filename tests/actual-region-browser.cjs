/* Werkelijke UI: identieke VC-banden, regiocontext en ontbrekende bronnen. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base='http://127.0.0.1:'+server.address().port;await page.goto(base+'/index.html#data');await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  const now=new Date(Date.now()-3600000).toISOString(),assets=['MN','NWN'].flatMap(vc=>Array.from({length:vc==='MN'?10:5},(_,i)=>({entityid:vc+(i+1),asset:'MSI A4 RE 26.200 '+(i+1),'ci-type':'VKS signaalgevers',regio:vc,status:'Operationeel',aannemer:'Testaannemer',contract:'Contract X',leverancier:'Leverancier X'})));
  const rows=[1,2].map(lane=>({event_id:'f'+lane,locatie:'A4 RE 26.200',MSI:String(lane),vc:'MN',assettype:'MSI',foutcode:'1003',melding:'Fatale fout bij MSI '+lane,van:now,eerste_gezien:now,laatste_gezien:now,bron_peildatum:now,levenscyclus_status:lane===1?'OPEN_BEVESTIGD':'VERDWENEN_UIT_SNAPSHOT',_liveOpen:lane===1}));
  const bundle={formaat:'DVM-dienstimpact-totaal',assetregister:{bestand:'synthetic',rijen:assets},liveStoringen:[{key:'signaalgever-totaal-open',naam:'synthetic',rijen:rows,peildatum:Date.parse(now)}],storingshistorie:[],parameters:{cfg:{liveDekking:{MSI:true}},subprocessen:{vm:[{naam:'Signaleren',gewicht:1,afh:{signalering:1}}]}},bronbeheer:{signaalgeverTotaal:{laatstePerVc:{mn:Date.parse(now)},snapshotDekking:{mn:{volledig:true,snapshot:now}}}}};
  await page.locator('#files').setInputFiles({name:'synthetic-region.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});await page.locator('#applyImport').click();await page.waitForFunction(()=>/Import voltooid|Import gestopt/.test(document.getElementById('status').textContent),null,{timeout:90000});assert.match(await page.locator('#status').textContent(),/Import voltooid/);
  await page.locator('[data-group="services"]').click();const frame=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));await frame.locator('#actualDienstVc').waitFor();
  const before=await frame.evaluate(()=>JSON.stringify([STATE,LIVE_STORINGSBRONNEN,RULES,v68LandelijkModel()]));
  await frame.locator('#actualDienstVc').selectOption('MN');const main=frame.locator('[data-actual-dienst-scope="MN"]');assert.match(await main.textContent(),/Berekening uitgevoerd.*1 meldingen doorgerekend, 1 niet doorgerekend.*10 actieve assets/s);
  await frame.locator('[data-dienst-banden] [data-dienst="vm"]').first().waitFor();assert.match(await frame.locator('[data-dienst-banden] [data-dienst="vm"]').first().textContent(),/80.00 tot 90.00%/);
  await main.locator('[data-band-diagnose] summary').click();assert.match(await main.textContent(),/1 assets onzeker/);
  await frame.locator('[data-dienst-subprocessen="vm"] summary').first().click();assert.match(await frame.locator('[data-dienst-subprocessen="vm"]').first().textContent(),/Signaleren/);
  await page.locator('[data-route="region"]').click();await frame.locator('[data-actual-regio="vc|MN"]').waitFor();
  const focus=frame.locator('[data-actual-regio="vc|MN"]');assert.match(await focus.locator('[data-dienst="vm"]').textContent(),/80.00 tot 90.00%/);
  for(const text of ['Assetverdeling','Datakwaliteit','Districtduiding','Contractcontext','Werkzaamheden','U-routes','Niet doorgerekende meldingen'])assert.ok((await focus.textContent()).includes(text),text);
  assert.match(await focus.textContent(),/Testaannemer/);assert.match(await focus.textContent(),/Contract X/);assert.match(await focus.textContent(),/Leverancier X/);
  await frame.locator('#actualRegioSelectie').selectOption('vc|NWN');const missing=frame.locator('[data-actual-regio="vc|NWN"]');assert.match(await missing.locator('[data-dienst="vm"]').textContent(),/0.00 tot 100.00%/);assert.match(await missing.textContent(),/Geen bronmoment voor deze selectie/);
  await frame.locator('#actualRegioModus').selectOption('rd');await frame.locator('#actualRegioSelectie').selectOption('rd|Midden-Nederland');assert.match(await frame.locator('[data-actual-regio="rd|Midden-Nederland"] [data-dienst="vm"]').textContent(),/80.00 tot 90.00%/);
  assert.doesNotMatch(await frame.locator('#tab-rapport').textContent(),/prognose|Monte Carlo/i);
  const after=await frame.evaluate(()=>JSON.stringify([STATE,LIVE_STORINGSBRONNEN,RULES,v68LandelijkModel()]));assert.equal(after,before);
  await frame.locator('#actualRegioModus').selectOption('vc');await frame.locator('#actualRegioSelectie').selectOption('vc|MN');
  await page.setViewportSize({width:900,height:900});assert.equal(await frame.locator('#actualRegioSelectie').isVisible(),true);
  assert.equal(await frame.locator('[data-actual-regio="vc|MN"] h3').first().evaluate(e=>{const b=e.getBoundingClientRect();return b.top>=0&&b.top<innerHeight;}),true);
  if(process.env.REGION_SCREENSHOT)await page.screenshot({path:process.env.REGION_SCREENSHOT,fullPage:true});
  await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});await page.locator('[data-group="services"]').click();await page.locator('[data-route="region"]').click();const restored=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));await restored.locator('[data-actual-regio="vc|MN"]').waitFor();assert.match(await restored.locator('[data-actual-regio="vc|MN"] [data-dienst="vm"]').textContent(),/80.00 tot 90.00%/);
  assert.deepEqual(errors,[]);console.log('Regio browser: VC- en RD-keuze, gelijke Dienstimpact-banden, subprocessen, context, ontbrekende VC, bronbehoud, herladen en smallere weergave geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
