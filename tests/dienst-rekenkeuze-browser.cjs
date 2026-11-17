/* DVM 154: rekenkeuze in Tabel 1 via de echte schermen. Meldingen zonder koppeling
   uitzetten en een assetbron laten wegvallen veranderen de zichtbare dienstbanden,
   tonen een samenvatting, blijven bewaard na herladen en gaan mee in de export.
   Alles weer aan geeft exact de oorspronkelijke banden. Uitsluitend synthetische data. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const opgeslagen=async test=>{const end=Date.now()+20000;while(Date.now()<end){const s=await page.evaluate(async()=>(await(await import('/core/storage.js')).read())?.dvm?.parameters?.cfg?.dienstScope||null);if(test(s))return s;await new Promise(r=>setTimeout(r,100));}throw Error('Rekenkeuze niet lokaal opgeslagen');};
  const base='http://127.0.0.1:'+server.address().port;await page.goto(base+'/index.html#data');
  await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'));
  const peil=new Date(Date.now()-3600000).toISOString(),start=new Date(Date.now()-7200000).toISOString();
  const assets=[1,2,3,4].map(n=>({entityid:'synthetic-'+n,'ci-type':'VKS signaalgevers',asset:'MSI A77 R 11,250 '+n,wegnummer:'77','hm-bord':'11,25',baanpositie:'R',regio:'MN',status:'Operationeel'}));
  const rij=(n,extra={})=>({event_id:String(n),vc:'MN',weg:'A77',richting:'R',hm:11.25,MSI:'MSI '+n,van:start,tot:peil,foutcode:'1003',melding:'Fatale fout bij MSI '+n,assetTypeHint:'MSI',status:'open',_liveOpen:true,eerste_gezien:peil,laatste_gezien:peil,bron_peildatum:peil,levenscyclus_status:'OPEN_BEVESTIGD',...extra});
  // Eén melding koppelt; één mist haar weg, wordt niet doorgerekend en heeft dus geen assetkoppeling.
  const rows=[rij(1),rij(6,{weg:'',MSI:'MSI 6',melding:'Fatale fout zonder locatie'})];
  const bundle={formaat:'DVM-dienstimpact-totaal',assetregister:{bestand:'synthetic',rijen:assets},liveStoringen:[{key:'signaalgever-totaal-open',naam:'synthetic-current',_signaalgeverTotaal:true,rijen:rows,peildatum:Date.parse(peil)}],storingshistorie:[{key:'signaalgever-totaal-historie',_signaalgeverTotaal:true,rijen:rows}],bronbeheer:{signaalgeverTotaal:{laatstePerVc:{mn:Date.parse(peil)},snapshotDekking:{mn:{volledig:true}},open:2,historie:2}},parameters:{cfg:{liveDekking:{MSI:true}}}};
  await page.locator('#files').setInputFiles({name:'synthetic-rekenkeuze.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});await page.locator('#applyImport').click();
  await page.waitForFunction(()=>/Import voltooid|Import gestopt/.test(document.getElementById('status').textContent),null,{timeout:90000});assert.match(await page.locator('#status').textContent(),/Import voltooid/);
  let frame=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));await page.locator('[data-group="services"]').click();await frame.waitForFunction(()=>!!window.HUB&&typeof v68LandelijkModel==='function');
  const lees=f=>f.evaluate(()=>{const m=v68LandelijkModel();return {msi:{lo:m.typen.MSI.loB,hi:m.typen.MSI.hiB,zonder:m.typen.MSI.zonderKoppeling,compleet:m.typen.MSI.compleet},diensten:m.diensten.map(r=>({lo:r.loB,hi:r.hiB,uit:!!r.uitgesloten,tekst:v68Bereik(r)})),ui:[...document.querySelectorAll('#tab-overzicht .grid4 .k-val')].map(e=>e.textContent),samenvatting:document.querySelector('#tab-overzicht [data-v68-scope]')?.textContent||''};});
  const voor=await lees(frame);
  assert.equal(voor.samenvatting,'','geen samenvatting zolang alles meetelt');
  assert.ok(voor.msi.zonder>=1,'de melding zonder asset telt als zonder koppeling: '+JSON.stringify(voor.msi));
  await frame.locator('#tab-overzicht summary').filter({hasText:'Brondekking bekijken en bevestigen'}).click();
  const vinkje=frame.locator('#tab-overzicht [data-v68-zonder-koppeling]');
  assert.equal(await vinkje.isChecked(),true);assert.match(await frame.locator('#tab-overzicht').textContent(),/Meldingen zonder assetkoppeling meerekenen \(nu \d+\)/);
  // 1. Meldingen zonder koppeling uit.
  await vinkje.uncheck();
  const na1=await lees(frame);
  assert.match(na1.samenvatting,/zonder assetkoppeling niet meegerekend/);
  assert.equal(na1.msi.zonder,voor.msi.zonder,'de telling blijft zichtbaar');
  assert.ok(na1.msi.lo>voor.msi.lo,'de ondergrens gaat omhoog: '+voor.msi.lo+' → '+na1.msi.lo);
  assert.notDeepEqual(na1.ui,voor.ui);for(const r of na1.diensten)assert.ok(na1.ui.includes(r.tekst));
  assert.equal(await frame.locator('#tab-overzicht details').filter({hasText:'Brondekking bekijken en bevestigen'}).getAttribute('open'),'','details blijven open');
  await opgeslagen(s=>s?.zonderKoppeling===false);
  // 2. Signalering telt niet mee: diensten die alleen daarop leunen tonen dat.
  await frame.locator('#tab-overzicht [data-v68-telt-mee="CAM"]').uncheck();
  const na2=await lees(frame);
  assert.match(na2.samenvatting,/Niet meegeteld: Camera/);
  assert.equal(await frame.locator('#tab-overzicht [data-v68-telt-mee="CAM"]').isChecked(),false);
  assert.match(await frame.locator('#tab-overzicht [data-v68-rij="CAM"]').textContent(),/telt niet mee/);
  assert.notDeepEqual(na2.diensten,na1.diensten,'Camera uitzetten verandert de dienstbanden');
  await opgeslagen(s=>s?.uitgesloten?.CAM===true);
  const exp=await frame.evaluate(()=>JSON.parse(JSON.stringify(HUB.export({fullSources:true}))));
  assert.equal(exp.parameters.cfg.dienstScope.zonderKoppeling,false);assert.equal(exp.parameters.cfg.dienstScope.uitgesloten.CAM,true);
  // 3. Na herladen blijven keuze, banden en samenvatting gelijk.
  await page.reload();await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
  await page.locator('[data-group="services"]').click();frame=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));await frame.waitForFunction(()=>window.HUB&&typeof v68LandelijkModel==='function'&&!!document.querySelector('#tab-overzicht [data-v68-scope]'));
  const hersteld=await lees(frame);assert.deepEqual(hersteld.diensten,na2.diensten);assert.equal(hersteld.samenvatting,na2.samenvatting);
  // 4. Alles weer aan geeft exact de oorspronkelijke banden en geen samenvatting.
  await frame.locator('#tab-overzicht summary').filter({hasText:'Brondekking bekijken en bevestigen'}).click();
  await frame.locator('#tab-overzicht [data-v68-telt-mee="CAM"]').check();await frame.locator('#tab-overzicht [data-v68-zonder-koppeling]').check();
  const terug=await lees(frame);assert.deepEqual(terug.diensten,voor.diensten);assert.deepEqual(terug.msi,voor.msi);assert.equal(terug.samenvatting,'');
  assert.deepEqual(errors,[]);
  console.log('Rekenkeuze browser: vinkje meldingen zonder koppeling, assetbron telt niet mee, samenvatting, zichtbare banden, opslag, export, herladen en terugzetten naar de oorspronkelijke banden geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
