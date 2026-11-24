/* Assetconfiguratie bij een groot synthetisch register: koppelen en locatie wijzigen
   via de echte knoppen, met zichtbare bezig-melding, binnen een tijdsbudget en met
   exact dezelfde koppeluitkomst als een volledige scan. Geen operationele bronnen. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('./helpers/playwright-met-toegang.cjs');
const N=Number(process.env.ASSETCONFIG_ASSETS||12000),F=Number(process.env.ASSETCONFIG_MELDINGEN||9000);
(async()=>{
 const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');let p=path.join(root,url.pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
  await page.locator('[data-group="data"]').click();
  const now=Date.now(),iso=new Date(now-3600000).toISOString(),oud=new Date(now-86400000*20).toISOString(),dicht=new Date(now-86400000*19).toISOString();
  const vcs=['MN','NWN','ZWN','NON','ZN'],wegen=['A2','A4','A12','A15','A27','A28','A50','A1'];
  const assets=Array.from({length:N},(_,i)=>{const w=wegen[i%8],hm=((i*7)%2500)/10,r=i%2?'R':'L';return {entityid:'s'+i,'ci-type':'VKS signaalgevers',asset:`MSI ${w} ${r} ${hm.toFixed(3).replace('.',',')} ${1+i%4}`,wegnummer:w.slice(1),'hm-bord':hm.toFixed(2).replace('.',','),baanpositie:r,regio:vcs[i%5],status:'Operationeel'};});
  const melding=(i,open)=>{const j=(i*13)%N,a=assets[j],hm=((j*7)%2500)/10,afwijkend=i%25===0;return {event_id:'e'+i,vc:a.regio,weg:wegen[j%8],richting:a.baanpositie,hm:afwijkend?hm+5:hm,MSI:afwijkend?'MSI X'+i:a.asset,van:open?iso:oud,tot:open?iso:dicht,foutcode:'1003',melding:'Fatale fout',assetTypeHint:'MSI',status:open?'open':'gesloten',_liveOpen:open,eerste_gezien:iso,laatste_gezien:iso,bron_peildatum:iso,levenscyclus_status:open?'OPEN_BEVESTIGD':'HERSTELD_BEVESTIGD'};};
  const live=Array.from({length:Math.round(F/8)},(_,i)=>melding(i,true)),historie=Array.from({length:F},(_,i)=>melding(i,i<F/8));
  const bundle={formaat:'DVM-dienstimpact-totaal',assetregister:{bestand:'synthetic',rijen:assets},liveStoringen:[{key:'signaalgever-totaal-open',naam:'synthetic-open',_signaalgeverTotaal:true,rijen:live,peildatum:now-3600000}],storingshistorie:[{key:'signaalgever-totaal-historie',naam:'synthetic-historie',_signaalgeverTotaal:true,rijen:historie}],bronbeheer:{signaalgeverTotaal:{laatstePerVc:Object.fromEntries(vcs.map(v=>[v.toLowerCase(),now-3600000])),snapshotDekking:{},open:live.length,historie:historie.length}}};
  await page.locator('#files').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bundle))});
  await page.locator('#applyImport').click({timeout:120000});
  await page.waitForFunction(()=>/Import voltooid|Import gestopt/.test(document.querySelector('#status').textContent),null,{timeout:600000});
  assert.match(await page.locator('#status').textContent(),/Import voltooid/);
  const dvm=page.frames().find(f=>/engines\/dvm.html/.test(f.url()));dvm.on('pageerror',e=>errors.push(e.message));
  // 1. Het HM-venster geeft op het hele register dezelfde uitkomst als een volledige scan.
  const vergelijking=await dvm.evaluate(()=>{
   const beeld=()=>{const st=herbouwAssetMatchBeeld();return JSON.stringify({...st,bijgewerkt:0,groepen:st.groepen.map(g=>({...g,melding:g.melding.eventId,suggesties:(g.suggesties||[]).map(a=>a&&a.key)}))})+JSON.stringify(inspecteerStoringsRijen(gecombineerdeStoringsRijen()))+JSON.stringify(inspecteerStoringsRijen(gecombineerdeLiveStoringsRijen()));};
   DVM_KANDIDAAT_VENSTER=true;let t=performance.now();const met=beeld(),tMet=performance.now()-t;
   DVM_KANDIDAAT_VENSTER=false;t=performance.now();const zonder=beeld(),tZonder=performance.now()-t;DVM_KANDIDAAT_VENSTER=true;
   return {gelijk:met===zonder,lengte:met.length,tMet:Math.round(tMet),tZonder:Math.round(tZonder),groepen:ASSET_MATCH_STATE.groepen.length};
  });
  assert.equal(vergelijking.gelijk,true);assert.ok(vergelijking.groepen>0);
  assert.ok(vergelijking.tMet*3<vergelijking.tZonder,JSON.stringify(vergelijking));
  // 2. Koppelen via de echte knop: eerst een zichtbare bezig-melding, daarna het resultaat.
  await page.locator('[data-group="rules"]').click();await page.locator('#secondaryNav [data-route="impactRules"]').click();await page.waitForTimeout(500);
  const groep=await dvm.evaluate(()=>{const g=ASSET_MATCH_STATE.groepen.find(g=>g.suggesties&&g.suggesties[0]&&assetMeldingPast(g.melding,g.suggesties[0],g.typeId));openAssetConfigForLog(encodeURIComponent(g.id));return {id:g.id,key:g.suggesties[0].key};});
  await dvm.waitForSelector('#assetConfigFouten');
  await dvm.evaluate(()=>{window.__statussen=[];const el=document.getElementById('assetCfgStatus');new MutationObserver(()=>__statussen.push(el.textContent)).observe(el,{childList:true,characterData:true,subtree:true});});
  const knop=dvm.locator(`.asset-koppel-btn[onclick*="${encodeURIComponent(groep.key)}"]`).first();
  let start=Date.now();await knop.click();
  await dvm.waitForFunction(()=>/is gekoppeld aan/.test(document.getElementById('assetCfgStatus')?.textContent||''),null,{timeout:120000});
  const koppelMs=Date.now()-start;
  assert.ok((await dvm.evaluate(()=>__statussen)).some(t=>/herberekenen/.test(t)),'bezig-melding verscheen vóór het resultaat');
  assert.equal(await dvm.evaluate(id=>assetConfigBasis().aliases[assetLogSleutel(id)],groep.id),groep.key);
  assert.equal(await dvm.evaluate(()=>document.body.classList.contains('dvm-bezig')),false);
  // 3. Locatie wijzigen via de echte knop.
  const rij=dvm.locator('details.asset-config-focus');await rij.waitFor();
  await rij.locator('[data-asset-locatie-field="hm"]').fill('123,456');
  await dvm.evaluate(()=>{__statussen.length=0;const el=document.getElementById('assetCfgStatus');if(el)new MutationObserver(()=>__statussen.push(el.textContent)).observe(el,{childList:true,characterData:true,subtree:true});});
  start=Date.now();await rij.locator('[data-asset-locatie] button').first().click();
  await dvm.waitForFunction(()=>/Locatiecorrectie opgeslagen/.test(document.getElementById('assetCfgStatus')?.textContent||''),null,{timeout:120000});
  const locatieMs=Date.now()-start;
  assert.equal(await dvm.evaluate(k=>ASSET_INDEX.byKey.get(k).hm,groep.key),123.456);
  assert.equal(await dvm.evaluate(k=>assetConfigBasis().overrides[k].locatie.hm,groep.key),123.456);
  const budget=Number(process.env.ASSETCONFIG_BUDGET_MS||25000);
  assert.ok(koppelMs<budget,`koppelen ${koppelMs} ms`);assert.ok(locatieMs<budget,`locatie ${locatieMs} ms`);
  assert.deepEqual(errors,[]);
  console.log(`Assetconfiguratie ${N} assets / ${F} meldingen: koppelen ${koppelMs} ms, locatie ${locatieMs} ms, matchbeeld venster ${vergelijking.tMet} ms tegen volledige scan ${vergelijking.tZonder} ms, uitkomst gelijk, bezig-melding zichtbaar.`);
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
