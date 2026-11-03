const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const site=path.join(__dirname,'../site');
 const server=require('node:http').createServer((req,res)=>{
  const p=path.join(site,new URL(req.url,'http://localhost').pathname);
  try{res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const url='http://127.0.0.1:'+server.address().port+'/engines/dvm.html';
  await page.goto(url);await page.waitForFunction(()=>window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
  await page.evaluate(async()=>{
   const rows=[
    {entityid:'N3',asset:'MN VKS MSI A15n 12,345 3','ci-type':'VKS signaalgevers',regio:'VCMN',status:'Operationeel','bps-locatie':'RW015 12,3 +45 VW n 3 R- L'},
    {entityid:'L1',asset:'MN VKS MSI A15L 12,345 1','ci-type':'VKS signaalgevers',regio:'VCMN',status:'Operationeel'},
    {entityid:'R3',asset:'MN VKS DET A16R 23,456 3','ci-type':'VKS detectoren','nen-bouwdeel':'Detectielus',regio:'VCMN',status:'Operationeel'},
    {entityid:'M2',asset:'MN VKS DET A16m 23,456 2','ci-type':'VKS detectoren','nen-bouwdeel':'Detectielus',regio:'VCMN',status:'Operationeel','bps-locatie':'RW016 23,4 +56 VW m 2 R- R'}];
   analyseerAssetRegister(rows,'synthetic-DVKA');ASSET_REGISTER_STATE.ruweRegisterRijen=rows;
   LIVE_STORINGSBRONNEN=[{key:'test',naam:'synthetic',peildatum:Date.parse('2026-01-02'),rijen:[
    {event_id:'A',locatie:'A15 LI HMP 12.345',vc:'MN',assettype:'MSI',strook:'3',foutcode:'1003',melding:'MSI 3 defect',start:'2026-01-01'},
    {event_id:'B',locatie:'A16 M HMP 23.456',vc:'MN',assettype:'LUS',strook:'3',foutcode:'1006',melding:'Detector 3 defect',start:'2026-01-01'}]}];
   LIVE_PEILDATUM=LIVE_STORINGSBRONNEN[0].peildatum;await datasetNaMutatie('synthetic DVKA');
   HUB.open('regels');ASSET_CFG_UI.subtab='assets';renderRegels();toonRuleSubtab('assets');
  });
  assert.equal(await page.evaluate(()=>STATE.meldingen.find(m=>m.typeId==='MSI').assetKey),'ID:N3');
  assert.equal(await page.evaluate(()=>STATE.meldingen.find(m=>m.typeId==='MSI').assetMatchMethode),'DVKA via hoofdrichting');
  const group=page.locator('.asset-fout').filter({hasText:'LUS MN A16 M HMP 23.456 eenheid 3'});
  await group.waitFor();assert.match(await group.innerText(),/Locatie bekend/);assert.match(await group.innerText(),/eenheidsnummer verschilt/);
  assert.equal(await group.getByRole('button',{name:'Controleer wegtak / eenheid'}).isDisabled(),true);
  assert.equal(await page.locator('[data-asset-match-reasons]').count(),1);
  assert.equal(await page.getByRole('button',{name:/Koppel beste kandidaten/}).count(),0);
  await group.getByRole('button',{name:'Zoeken en configureren'}).click();
  assert.match(await page.locator('#assetConfigListHost').innerText(),/DVKA\/wegtak verschilt/);
  await page.locator('#assetConfigListHost').getByRole('button',{name:'Bevestig DVKA-koppeling'}).click();
  await page.waitForFunction(()=>STATE.meldingen.some(m=>m.typeId==='LUS'&&m.assetKey==='ID:R3'));
  const [configDownload]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>assetConfigExport())]);
  const chunks=[];for await(const chunk of await configDownload.createReadStream())chunks.push(chunk);
  const configBytes=Buffer.concat(chunks),config=JSON.parse(configBytes.toString('utf8'));
  assert.ok(Object.values(config.assetConfig.dvkaBevestigingen).includes('ID:R3'));
  await page.evaluate(()=>{RULES.assetConfig.aliases={};RULES.assetConfig.dvkaBevestigingen={};assetConfigHerbereken();HUB.open('regels');ASSET_CFG_UI.subtab='assets';renderRegels();toonRuleSubtab('assets');});
  await page.locator('#assetConfigImportInput').setInputFiles({name:'synthetic-assetconfiguratie.json',mimeType:'application/json',buffer:configBytes});
  await page.waitForFunction(()=>STATE.meldingen.some(m=>m.typeId==='LUS'&&m.assetKey==='ID:R3'));
  const backup=await page.evaluate(()=>HUB.export({fullSources:true}));
  assert.ok(Object.values(backup.parameters.assetConfig.dvkaBevestigingen).includes('ID:R3'));
  await page.reload();await page.waitForFunction(()=>window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
  await page.evaluate(async b=>{await HUB.import(b);},backup);
  await page.waitForFunction(()=>STATE?.meldingen.some(m=>m.typeId==='LUS'&&m.assetKey==='ID:R3'));
  assert.equal(await page.evaluate(()=>ASSET_INDEX.byKey.get('ID:N3').zijdeBron),'N');
  assert.equal(await page.evaluate(()=>ASSET_REGISTER_STATE.ruweRegisterRijen[0].asset),'MN VKS MSI A15n 12,345 3');
  assert.deepEqual(errors,[]);
  console.log('DVKA browser: echte bronverwerking, unieke hoofdrichting, locatiekandidaten, diagnose, geblokkeerde eenheidsafwijking, individuele bevestiging, totaalexport en herladen geslaagd.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
