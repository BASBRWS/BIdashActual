/* Ingepakte back-ups in de echte schil: import van .json.gz, export als .json.gz en
   weer terug, keuze voor gewone JSON en weigering van een beschadigd bestand.
   Alleen synthetische rijen; geen operationele bronnen. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');let p=path.join(root,url.pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[],base='http://127.0.0.1:'+server.address().port;
  page.on('pageerror',e=>errors.push(e.message));
  const gereed=()=>page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
  const importKlaar=()=>page.waitForFunction(()=>/Import voltooid|Import gestopt/.test(document.querySelector('#status').textContent),null,{timeout:90000});
  await page.goto(base+'/index.html#data');await gereed();await page.locator('[data-group="data"]').click();
  assert.equal(await page.locator('#exportGzip').isChecked(),true);
  const now=Date.now(),iso=new Date(now-3600000).toISOString();
  const assets=[1,2,3].map(n=>({entityid:'synthetic-'+n,'ci-type':'VKS signaalgevers',asset:'MSI A77 R 11,250 '+n,wegnummer:'77','hm-bord':'11,25',baanpositie:'R',regio:'MN',status:'Operationeel'}));
  const fault=n=>({event_id:String(n),vc:'MN',weg:'A77',richting:'R',hm:11.25,MSI:'MSI '+n,van:iso,tot:iso,foutcode:'1003',melding:'Fatale fout bij MSI '+n,assetTypeHint:'MSI',status:'open',_liveOpen:true,eerste_gezien:iso,laatste_gezien:iso,bron_peildatum:iso,levenscyclus_status:'OPEN_BEVESTIGD'});
  const bundle={formaat:'DVM-dienstimpact-totaal',assetregister:{bestand:'synthetic',rijen:assets},liveStoringen:[{key:'signaalgever-totaal-open',naam:'synthetic-current',_signaalgeverTotaal:true,rijen:[fault(1),fault(2)],peildatum:now-3600000}],storingshistorie:[{key:'signaalgever-totaal-historie',naam:'synthetic-history',_signaalgeverTotaal:true,rijen:[fault(1),fault(2),fault(3)]}],bronbeheer:{signaalgeverTotaal:{laatstePerVc:{mn:now-3600000},snapshotDekking:{mn:{volledig:false}},open:2,historie:3}}};
  // 1. Een ingepakte DVM-totaal-JSON laden.
  await page.locator('#files').setInputFiles({name:'synthetic.json.gz',mimeType:'application/gzip',buffer:zlib.gzipSync(JSON.stringify(bundle))});
  await page.waitForSelector('#applyImport');assert.match(await page.locator('#preview').textContent(),/synthetic\.json\.gz/);
  await page.locator('#applyImport').click();await importKlaar();assert.match(await page.locator('#status').textContent(),/Import voltooid/);
  const tellingen=async()=>{const f=page.frames().find(x=>/engines\/dvm.html/.test(x.url()));return f.evaluate(()=>({assets:HUB.assets().length,faults:HUB.faults().length}));};
  const voor=await tellingen();assert.equal(voor.assets,3);assert.equal(voor.faults,2);
  // 2. Integrale export standaard als .json.gz, met dezelfde JSON-inhoud.
  const exporteer=async knop=>{const [dl]=await Promise.all([page.waitForEvent('download'),page.locator(knop).click()]);const p=await dl.path();return {naam:dl.suggestedFilename(),bytes:fs.readFileSync(p)};};
  const gz=await exporteer('#export');
  assert.match(gz.naam,/^bidash-actual-integraal_\d{4}-\d{2}-\d{2}\.json\.gz$/);
  assert.equal(gz.bytes[0],0x1f);assert.equal(gz.bytes[1],0x8b);
  const inhoud=JSON.parse(zlib.gunzipSync(gz.bytes).toString('utf8'));assert.equal(inhoud.formaat,'BiDash-integraal');
  await page.waitForFunction(()=>/onverpakt/.test(document.querySelector('#status').textContent));
  await page.locator('details:has(#exportDvm) > summary').click();const dvm=await exporteer('#exportDvm');assert.match(dvm.naam,/^dvm-dienstimpact-totaal_\d{4}-\d{2}-\d{2}\.json\.gz$/);
  assert.equal(JSON.parse(zlib.gunzipSync(dvm.bytes).toString('utf8')).formaat,'DVM-dienstimpact-totaal');
  // 3. Gewone JSON blijft kiesbaar en de keuze blijft na herladen staan.
  await page.locator('#exportGzip').uncheck();
  const gewoon=await exporteer('#export');assert.match(gewoon.naam,/\.json$/);assert.equal(JSON.parse(gewoon.bytes.toString('utf8')).formaat,'BiDash-integraal');
  await page.reload();await gereed();await page.locator('[data-group="data"]').click();
  assert.equal(await page.locator('#exportGzip').isChecked(),false);await page.locator('#exportGzip').check();
  // 4. Een beschadigd .json.gz wordt geweigerd vóór er iets wordt vervangen.
  await page.locator('#files').setInputFiles({name:'kapot.json.gz',mimeType:'application/gzip',buffer:gz.bytes.subarray(0,gz.bytes.length-20)});
  await page.waitForFunction(()=>/geen geldig of volledig gzip-bestand/.test(document.querySelector('#status').textContent));
  assert.equal(await page.locator('#applyImport').count(),0);assert.deepEqual(await tellingen(),voor);
  // 5. De eigen ingepakte back-up weer inlezen geeft dezelfde stand.
  await page.locator('#files').setInputFiles({name:gz.naam,mimeType:'application/gzip',buffer:gz.bytes});
  await page.waitForSelector('#applyImport');await page.locator('#applyImport').click();await importKlaar();
  assert.match(await page.locator('#status').textContent(),/Import voltooid/);assert.deepEqual(await tellingen(),voor);
  assert.deepEqual(errors,[]);
  console.log('JSON.GZ browser: import .json.gz, export integraal en DVM als .json.gz, gewone JSON als keuze, onthouden voorkeur, beschadigd bestand geweigerd en eigen back-up teruggelezen geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
