const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ns='http://xmlns.oracle.com/Primavera/P6/V23.12/API/BusinessObjects';
const msp=`<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Title>Synthetische planning</Title><Tasks><Task><UID>1</UID><ID>1</ID><Name>Testproject</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary></Task><Task><UID>2</UID><ID>2</ID><Name>Testtaak</Name><OutlineLevel>2</OutlineLevel><Start>2030-01-15T08:00:00</Start><Finish>2030-02-15T17:00:00</Finish><Summary>0</Summary><Milestone>0</Milestone></Task></Tasks></Project>`;
const p6=`<?xml version="1.0"?><APIBusinessObjects xmlns="${ns}"><Project><ObjectId>1</ObjectId><Name>Synthetisch P6-project</Name><WBS><ObjectId>10</ObjectId><Name>Testgroep</Name></WBS><Activity><ObjectId>2</ObjectId><Id>A2</Id><Name>Testtaak</Name><WBSObjectId>10</WBSObjectId><StartDate>2030-01-15T08:00:00</StartDate><FinishDate>2030-02-15T17:00:00</FinishDate><Type>Task Dependent</Type></Activity></Project></APIBusinessObjects>`;
(async()=>{
 const site=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'),name=url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname;
  try{const file=path.join(site,name);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));page.on('dialog',d=>d.accept());
  const origin='http://127.0.0.1:'+server.address().port;await page.goto(origin+'/planning/');
  await page.waitForFunction(()=>!document.querySelector('#import').disabled);
  assert.equal(page.frames().length,2);assert.equal(requests.some(u=>/\/(?:bi|dvm)\.html(?:\?|$)/.test(u)),false);
  const databaseNames=await page.evaluate(async()=> (await indexedDB.databases()).map(d=>d.name));
  assert.ok(databaseNames.includes('bidash-planning'));assert.equal(databaseNames.includes('bidash-actual'),false);
  await page.evaluate(()=>localStorage.setItem('bidash-actual:rws-integrale-planning-state-v1','full-dashboard-sentinel'));
  const frame=page.frames().find(f=>f.url().includes('/engines/planning.html'));
  async function load(text,name){await page.locator('#file').setInputFiles({name,mimeType:name.endsWith('.xml')?'application/xml':'application/json',buffer:Buffer.from(text)});await page.waitForFunction(()=>!document.querySelector('#import').disabled);}
  await load(msp,'synthetic-msproject.xml');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Lokaal opgeslagen'));
  assert.equal(await frame.evaluate(()=>HUB.summary().exportInfo.formaat),'msproject');
  assert(await frame.locator('#ipl-export-primavera').isEnabled());assert.match(await frame.locator('#ipl-export-info').innerText(),/Microsoft Project/);
  assert.match(await frame.locator('#ipl-export-info').innerText(),/geen scenarioverschuivingen/);
  await frame.evaluate(()=>ipl_slider(2));await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Lokaal opgeslagen'));
  let waiting=page.waitForEvent('download');await frame.locator('#ipl-export-source').click();let downloaded=await waiting;
  assert.equal(fs.readFileSync(await downloaded.path(),'utf8'),msp);
  waiting=page.waitForEvent('download');await frame.locator('#ipl-export-primavera').click();downloaded=await waiting;
  const msScenario=fs.readFileSync(await downloaded.path(),'utf8');assert.match(msScenario,/<Start>2030-03-15T08:00:00<\/Start>/);assert.match(await frame.locator('#ipl-export-status').innerText(),/Microsoft Project > XML/);
  waiting=page.waitForEvent('download');await page.locator('#backup').click();downloaded=await waiting;
  const backup=JSON.parse(fs.readFileSync(await downloaded.path(),'utf8'));assert.equal(backup.planning.xml,msp);assert.equal(backup.planning.state.ipl.shift,2);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('hersteld'));
  let restored=page.frames().find(f=>f.url().includes('/engines/planning.html'));assert.equal(await restored.evaluate(()=>IPL_SHIFT),2);assert.equal(await restored.evaluate(()=>IPL_RAW_XML),msp);
  assert.equal(await page.evaluate(()=>localStorage.getItem('bidash-actual:rws-integrale-planning-state-v1')),'full-dashboard-sentinel');
  await load('<bad','invalid.xml');assert.match(await page.locator('#status').innerText(),/Laden mislukt/);assert.equal(await restored.evaluate(()=>IPL_RAW_XML),msp);assert.equal(await restored.evaluate(()=>IPL_SHIFT),2);
  await load(p6,'synthetic-p6.xml');await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Lokaal opgeslagen'));
  assert(await restored.locator('#ipl-export-primavera').isEnabled());await restored.evaluate(()=>ipl_slider(1));
  waiting=page.waitForEvent('download');await restored.locator('#ipl-export-primavera').click();downloaded=await waiting;
  const exported=fs.readFileSync(await downloaded.path(),'utf8');assert.match(exported,/<StartDate>2030-02-15T08:00:00<\/StartDate>/);
  await load(JSON.stringify({formaat:'BiDash-integraal',delen:{planning:backup.planning,dvm:{ignored:true}}}),'synthetic-integral.json');
  assert.equal(await restored.evaluate(()=>IPL_SHIFT),2);assert.equal(await restored.evaluate(()=>IPL_RAW_XML),msp);assert(await restored.locator('#ipl-export-primavera').isEnabled());
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // Full dashboard uses the same source-format information.
  const full=await browser.newPage();full.on('pageerror',e=>errors.push(e.message));await full.goto(origin);await full.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'));
  await full.locator('#primaryNav [data-route=data]').click();await full.locator('#files').setInputFiles({name:'synthetic-msproject.xml',mimeType:'application/xml',buffer:Buffer.from(msp)});await full.locator('#applyImport').click();
  await full.waitForFunction(()=>document.querySelector('#status').textContent.includes('Import voltooid'));
  assert(await full.locator('#exportPrimavera').isEnabled());assert.match(await full.locator('#planningExportInfo').innerText(),/Microsoft Project/);
  const fullFrame=full.frames().find(f=>f.url().includes('/engines/planning.html'));await fullFrame.evaluate(()=>ipl_slider(1));
  waiting=full.waitForEvent('download');await full.locator('#exportPrimavera').click();downloaded=await waiting;assert.match(fs.readFileSync(await downloaded.path(),'utf8'),/<Start>2030-02-15T08:00:00<\/Start>/);
  assert.deepEqual(errors,[]);console.log('Planning-only Pages: geen BI/DVM-modules, MS/P6-import, formaatgestuurde export, oorspronkelijke XML, bron-plus-scenario back-up, geïsoleerde opslag, herladen, ongeldige bronbehoud, integrale deelimport en mobiel geslaagd.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exit(1);});
