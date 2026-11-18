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
  // 3b. Planning: eerstvolgende mijlpalen (met scenarioverschuiving 0) en formatie.
  const dag=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
  const taak=(uid,naam,start,eind,mijl)=>`<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${naam}</Name><OutlineLevel>2</OutlineLevel><Start>${start}T08:00:00</Start><Finish>${eind}T17:00:00</Finish><Summary>0</Summary><Milestone>${mijl?1:0}</Milestone></Task>`;
  const msp=`<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Title>Synthetische planning</Title><Tasks><Task><UID>1</UID><ID>1</ID><Name>Testproject</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary></Task>${taak(2,'Lopende taak',dag(-10),dag(40),false)}${taak(3,'Oplevering verleden',dag(-20),dag(-20),true)}${taak(4,'Gunning',dag(12),dag(12),true)}${taak(5,'Start uitvoering',dag(45),dag(45),true)}${taak(6,'Ingebruikname',dag(200),dag(200),true)}</Tasks></Project>`;
  await page.locator('[data-group="data"]').click();await page.locator('#importType').selectOption('planning');
  await page.locator('#files').setInputFiles({name:'synthetische-planning.xml',mimeType:'text/xml',buffer:Buffer.from(msp)});await page.locator('#applyImport').click();
  await page.waitForFunction(()=>/Import voltooid|Import gestopt/.test(document.getElementById('status').textContent),null,{timeout:90000});assert.match(await page.locator('#status').textContent(),/Import voltooid/);
  await page.locator('#importType').selectOption('auto');await page.locator('[data-group="overview"]').click();
  await page.waitForFunction(()=>document.querySelectorAll('#ovMijlpalen li').length===3,null,{timeout:30000});
  const mp=await page.locator('#ovMijlpalen li').allInnerTexts();
  assert.match(mp[0],/Gunning[\s\S]*Over 12 dagen/);assert.match(mp[1],/Start uitvoering[\s\S]*Over 45 dagen/);assert.match(mp[2],/Ingebruikname/);
  assert.doesNotMatch(mp.join(' '),/Oplevering verleden/);assert.match(await page.locator('#ovMijlpalen').innerText(),/3 komende en 1 verstreken mijlpalen/);
  assert.match(await page.locator('#cards').innerText(),/Eerstvolgende mijlpaal\s*Over 12 dagen\s*Gunning/);
  assert.match(await page.locator('#cards').innerText(),/1 activiteiten lopen nu/);
  // Beschikbare FTE op standaardwaarden: geen tekort claimen.
  assert.match(await page.locator('#capacity').innerText(),/Beschikbare FTE staan nog op de standaardwaarden/);
  assert.doesNotMatch(await page.locator('#capacity').innerText(),/Tekort in/);
  assert.match(await page.locator('#ovPipeline').innerText(),/standaardwaarden/);
  // Netwerkkaart zonder matrix: wegdelen in beeld, zelfde telling als de DVM-samenvatting.
  const net=await page.frames().find(f=>/engines\/dvm.html/.test(f.url())).evaluate(()=>HUB.summary().netwerk);
  assert.match(await page.locator('#ovNetwerk').innerText(),new RegExp(net.geraakt+'\\s*wegdelen geraakt'));
  assert.equal(await page.locator('#ovNetwerk .ov-net-rij').count(),Math.min(6,net.geraakt));
  assert.match(await page.locator('#ovPipeline').innerText(),new RegExp(net.geraakt+' wegdelen geraakt'));
  // Geen dubbele "x van y binnen norm": alleen in de kaart van de zwakste dienst.
  assert.equal((await page.locator('#overview').innerText()).match(/aantoonbaar binnen norm/g)?.length,1);
  // 3c. 2.91 / DVM 163: storingen bij geplande werkzaamheden. Werk W1 ligt 1 km na een
  // open MSI-storing in rijrichting RE (inleidend), W2 dezelfde plek in LI (storing ligt
  // erachter: niet inleidend), W3 zonder werkzaamheden in de buurt.
  assert.match(await page.locator('#ovWerk').innerText(),/Nog geen werkzaamheden/);
  const dvmF=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));
  const wi=await dvmF.evaluate(()=>{
   const f=(STATE.meldingen||[]).find(m=>m.typeId==='MSI'&&normAssetRichting(m.richting)==='RE'&&m.weg&&Number.isFinite(Number(m.hm))&&m.hm!=null);
   const zelfde=(STATE.meldingen||[]).filter(m=>m.weg===f.weg&&m.typeId==='MSI');
   const nu=Date.now(),iso=ms=>new Date(ms).toISOString(),hm=Number(f.hm);
   // Een werkvak op een plek zonder andere storingen in de aanloop van LI.
   const rijen=[{werk_id:'W1',weg:f.weg,richting:'RE',van_hm:hm+1,tot_hm:hm+1.4,start:iso(nu-36e5),einde:iso(nu+5*36e5),afsluiting:'rijstrook dicht'},
    {werk_id:'W2',weg:f.weg,richting:'LI',van_hm:hm+1,tot_hm:hm+1.4,start:iso(nu+2*864e5),einde:iso(nu+3*864e5)},
    {werk_id:'W3',weg:'A99',richting:'RE',van_hm:1,tot_hm:2,start:iso(nu),einde:iso(nu+36e5)},
    {werk_id:'W4',weg:f.weg,richting:'RE',van_hm:hm+1,tot_hm:hm+1.4,start:iso(nu+30*864e5),einde:iso(nu+31*864e5)}];
   const werken=rijen.map(normWerkRij);
   WERK_STATE={bestand:'synthetisch',werken,totaal:werken.length,bronTotaal:werken.length,genegeerdN:0,exactN:0,assetKoppelingenN:0,ruweRijen:rijen};
   const s=HUB.summary().werkImpact;parent.postMessage({type:'hub:changed',engine:'dvm'},location.origin);
   const verwachtLi=zelfde.filter(m=>normAssetRichting(m.richting)!=='RE'&&Number(m.hm)>hm+1.4&&Number(m.hm)<=hm+4.4).length;
   return {s,fHm:hm,verwachtLi};
  });
  assert.equal(wi.s.geladen,true);assert.equal(wi.s.werken,3,'W4 start na 14 dagen en valt buiten de horizon');
  const w1=wi.s.lijst.find(r=>r.id==='W1');
  assert.ok(w1,'W1 heeft een inleidende storing: '+JSON.stringify(wi.s));
  assert.ok(w1.inleidend.some(x=>x.hm===wi.fHm&&x.afstandKm===1&&x.richting==='RE'),JSON.stringify(w1.inleidend));
  assert.equal(w1.ernst,'hoog','rijstrook dicht met een inleidende storing');
  const w2=wi.s.lijst.find(r=>r.id==='W2');
  if(w2)assert.ok(!w2.inleidend.some(x=>x.hm===wi.fHm),'een storing achter het werkvak (LI) is niet inleidend');
  assert.equal(wi.s.lijst.find(r=>r.id==='W3'),undefined);
  await page.waitForFunction(()=>/Afkruisen onzeker/.test(document.getElementById('ovWerk').innerText),null,{timeout:30000});
  const ovw=await page.locator('#ovWerk').innerText();
  assert.match(ovw,/3\s*werkzaamheden nu of binnen 14 dagen/);assert.match(ovw,/signaalgevers? in storing in de aanloop/);assert.match(ovw,/\d+(,\d)? km ervoor/);
  assert.match(await page.locator('.brand').innerText(),/Business Intelligence Dashboard/);assert.equal(await page.title(),'Business Intelligence Dashboard WVM');
  // 4. Doorklikken vanuit de pijplijn.
  await page.locator('#ovPipeline .ov-step').first().click();await page.waitForFunction(()=>location.hash==='#faults');
  // 5. Telefoon: geen horizontaal scrollen.
  await page.setViewportSize({width:390,height:844});await page.locator('[data-group="overview"]').click();await page.waitForTimeout(300);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'geen horizontaal scrollen op 390 px');
  assert.deepEqual(errors,[]);
  console.log('Overzichtsdashboard browser: getallen volgens de bron, periode en opslag, tooltip met muis en toetsenbord, lopende dag gemarkeerd, doorklikken en telefoonbreedte geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
