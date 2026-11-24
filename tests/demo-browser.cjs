/* 2.95 / DVM 168: Demo-knop in de echte schil. De demo opent als pop-up met de app in
   demomodus, bouwt een volledig gesimuleerde werkruimte op en raakt de eigen werkruimte
   niet. Geen operationele data. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch();
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base+'/index.html');
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
    assert.equal(await page.locator('#demoBanner').isHidden(),true);
    // 1. Knop opent de pop-up met de app in demomodus.
    await page.locator('#demoOpen').click();
    await page.locator('#demoDialog').waitFor({state:'visible'});
    assert.match(await page.locator('#demoFrame').getAttribute('src'),/index\.html\?demo=1$/);
    const demoFrame=()=>page.frames().find(f=>/index\.html\?demo=1$/.test(f.url()));
    for(let i=0;i<100&&!demoFrame();i++)await page.waitForTimeout(100);
    const demo=demoFrame();assert.ok(demo,'demo-iframe geladen');
    await demo.waitForFunction(()=>/Demo-omgeving opgebouwd/.test(document.getElementById('status').textContent),null,{timeout:300000});
    assert.equal(await demo.evaluate(()=>BIDASH_ACTUAL.workspace),'bidash-demo');
    assert.equal(await demo.locator('#demoBanner').isVisible(),true);assert.equal(await demo.locator('#demoOpen').isHidden(),true);
    // 2. Alles is ingevuld: storingen, diensten exact, kosten, werkzaamheden, planning, formatie, audit.
    const dvm=page.frames().find(f=>f.parentFrame()===demo&&/engines\/dvm\.html/.test(f.url()));
    const s=await dvm.evaluate(()=>{const s=HUB.summary();return {open:HUB.faults().length,typen:[...new Set(HUB.faults().map(f=>f.typeId))].sort(),onzeker:s.diensten.filter(d=>d.besch==null).length,roads:s.roads.filter(r=>Number.isFinite(r.kosten)).length,werk:s.werkImpact.metInleidend,ws:BIDASH_ACTUAL.workspace};});
    assert.ok(s.open>80,JSON.stringify(s));assert.deepEqual(s.typen,['CAM','DRIP','LUS','MSI']);assert.equal(s.onzeker,0,'bronnen bevestigd: dienstwaarden exact');
    assert.ok(s.roads>20,'verkeerskosten berekenbaar');assert.ok(s.werk>0,'werkzaamheden met inleidende storingen');assert.equal(s.ws,'bidash-demo','engine erft de demo-opslag');
    const cards=await demo.locator('#cards').innerText();assert.match(cards,/Verkeerskosten \/ brondag\s*€/);assert.match(cards,/Eerstvolgende mijlpaal\s*Over \d+ dagen/);
    assert.match(await demo.locator('#ovPipeline').innerText(),/Is er formatie voor de storingen\?/);
    assert.doesNotMatch(await demo.locator('#capacity').innerText(),/standaardwaarden/);
    await demo.evaluate(()=>{location.hash='#organisation';});
    await demo.waitForFunction(()=>/VC ZWN/.test(document.getElementById('opFormatieUitkomst')?.innerText||''));
    assert.match(await demo.locator('#opFormatieUitkomst').innerText(),/Methode: ingenieursbureau/);
    assert.match(await demo.locator('#opGevolgen').innerText(),/Voor afrit/);
    await demo.evaluate(()=>{location.hash='#quality';});
    await demo.waitForFunction(()=>!/Nog geen kwaliteitsaudit/.test(document.getElementById('quality')?.innerText||'Nog geen kwaliteitsaudit'));
    // 2b. Inhoudelijk ingevuld: wind- en RIA4-lijsten, planningtriggers en expertduidingen.
    const special=await dvm.evaluate(()=>{const e=getDripSpecialListsExport();return [e.wind.identifiers.length,e.ria4.identifiers.length,(ASSET_REGISTER_STATE.assets||[]).filter(a=>a.specialWind).length];});
    assert.deepEqual(special,[6,4,6],'referentielijst gekoppeld aan precies de DRIP-codes');
    const plan=page.frames().find(f=>f.parentFrame()===demo&&/engines\/planning\.html/.test(f.url()));
    assert.equal(await plan.evaluate(()=>Object.keys(TRIGGERS).length),4);
    await demo.evaluate(()=>{location.hash='#expertInput';});
    await demo.waitForFunction(()=>/23 van 23 verplichte antwoorden/.test(document.getElementById('expertInput')?.innerText||''));
    // 2c. 2.97: managementrapportage in de demo, met alle hoofdstukken, figuren en tabellen.
    await demo.evaluate(()=>{location.hash='#report';});
    await demo.locator('[data-rap-opstellen]').waitFor();await demo.locator('[data-rap-opstellen]').click();
    await demo.locator('.rap-document').waitFor();
    const rap=await demo.locator('.rap-document').innerText();
    assert.match(rap,/Kernboodschappen/);assert.match(rap,/Van storing tot gevolg/);assert.doesNotMatch(rap,/NaN|undefined/);
    assert.equal(await demo.locator('.rap-hoofdstuk').count(),11);
    assert.ok(await demo.locator('.rap-figuur').count()>=8);assert.ok(await demo.locator('.rap-tabel').count()>=8);
    await demo.locator('[data-rap-veld="scope"]').selectOption('ZWN');
    await demo.waitForFunction(()=>/Verkeerscentrale ZWN/.test(document.querySelector('.rap-meta')?.textContent||''));
    const [download]=await Promise.all([page.waitForEvent('download'),demo.locator('[data-rap-download]').click()]);
    assert.match(download.suggestedFilename(),/managementrapportage.*\.html$/);
    // 3. De eigen werkruimte is niet aangeraakt.
    await page.locator('#demoSluit').click();await page.locator('#demoDialog').waitFor({state:'hidden'});
    assert.match(await page.locator('#cards').innerText(),/Open storingen\s*Onbekend/);
    const eigen=await page.evaluate(()=>import('/core/storage.js').then(m=>m.read()));
    assert.ok(!eigen?.dvm?.assetregister,'eigen werkruimte heeft geen demo-assets');assert.ok(!eigen?.demoVersie);
    // De BI-instellingen van de demo staan onder een eigen voorvoegsel, niet in de eigen opslag.
    const biEigen=await page.evaluate(()=>localStorage.getItem('bidash_integratie_v1'));
    assert.ok(!biEigen||!/"demo":true/.test(biEigen),'eigen BI-model bevat geen demogegevens');
    assert.deepEqual(errors,[]);
    console.log('Demo: knop, pop-up, volledig gesimuleerde werkruimte (storingen, diensten, kosten, werk, planning, formatie, audit) en eigen werkruimte onaangeroerd geslaagd.');
  }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
