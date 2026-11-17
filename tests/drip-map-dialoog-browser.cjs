/* DRIP uit map lezen (CDMS) via de echte dialoog. DVM 157: de knop "Map kiezen en
   verwerken" deed niets door een verwijzing naar een MTM-veld. Deze test drukt op de
   knop met een nagebootste moderne mapkiezer en via de terugvalroute met een echte
   map, en controleert het hele pad: regio- en periodefilter, inlezen, episodes,
   toevoegen aan DRIP-historie en koppelen aan All Assets. Synthetische logregels. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const regel=(t,asset,loc,toestand,waarde)=>[t,'2','1',asset,loc,toestand,waarde,'x'].join('\t');
const LOGS={
  'cdms/mn/log/2025/01/15/a.txt':[regel('07:00:00','DBD80','A15R_12,300','M','URGENT'),regel('13:00:00','DBD80','A15R_12,300','M','OK')].join('\n'),
  'cdms/mn/log/2025/02/03/b.txt':regel('09:00:00','DBD81','A15R_13,000','M','URGENT'),
  'cdms/mn/log/2024/12/30/buiten.txt':[regel('08:00:00','DBD82','A15R_14,000','M','URGENT'),regel('09:00:00','DBD82','A15R_14,000','M','OK')].join('\n'),
  'cdms/non/log/2025/01/15/andere-vc.txt':[regel('08:00:00','DBD90','A1L_10,000','M','URGENT'),regel('09:00:00','DBD90','A1L_10,000','M','OK')].join('\n')
};
(async()=>{
 const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,tmp;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox']});
  const nieuwePagina=async()=>{
   const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/engines/dvm.html');
   await page.waitForFunction(()=>window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__&&typeof openDripMapDialog==='function');
   await page.evaluate(()=>{
    const drip=(id,naam)=>({entityid:id,asset:naam,'ci-type':'OBJ Bijzondere borden-drips',regio:'MN',status:'Operationeel'});
    // Zelfde stappen als de echte All Assets-import: register, daarna het DRIP-areaal.
    const rijen=[drip('DBD80','MN DRIP A15 RE 12.300 (DBD80)'),drip('DBD81','MN DRIP A15 RE 13.000 (DBD81)'),drip('DBD82','MN DRIP A15 RE 14.000 (DBD82)')];
    analyseerAssetRegister(rijen,'synthetic');DRIP_STATE=verwerkDrips(rijen);dvmPasDripLocatiesToe();
    document.getElementById('loginScherm').style.display='none';document.getElementById('appRoot').style.display='';HUB.open('datasets');
   });
   return {page,errors};
  };
  const kiesEnStart=async(page,{vcs=['mn'],vanaf='2025-01-01',tot='2025-04-01'}={})=>{
   await page.locator('button:has-text("DRIP uit map lezen (CDMS)")').first().click();
   const dlg=page.locator('#dgMapDialog');await dlg.waitFor({state:'visible'});
   for(const v of vcs)await dlg.locator(`.dgVc[value="${v}"]`).check();
   await dlg.locator('#dgVanaf').fill(vanaf);await dlg.locator('#dgTot').fill(tot);
   await dlg.locator('#dgMapVerder').click();
   return dlg;
  };
  const uitkomst=page=>page.evaluate(()=>({incidenten:(DRIP_HIST_STATE?.incidenten||[]).map(x=>[x.code,x.einde?'dicht':'open']).sort(),bronnen:(DRIP_HIST_STATE?.sources||[]).map(s=>s.naam||s.name||s.sourceName||s.bestand||''),bronVelden:Object.keys((DRIP_HIST_STATE?.sources||[])[0]||{}),fase:document.getElementById('dgPFase')?.textContent||''}));

  // 1. Zonder verkeerscentrale: duidelijke melding, geen stille fout.
  {const {page,errors}=await nieuwePagina();
   const dlg=await kiesEnStart(page,{vcs:[]});
   assert.equal(await dlg.locator('#dgMapMelding').innerText(),'Kies minstens één verkeerscentrale.');
   assert.deepEqual(errors,[]);await page.close();}

  // 2. Moderne mapkiezer (nagebootst): de knop leest alleen MN binnen de periode.
  {const {page,errors}=await nieuwePagina();
   await page.evaluate(logs=>{
    const map=(name,kinderen)=>({kind:'directory',name,async *entries(){for(const k of kinderen)yield [k.name,k];}});
    const bestand=(name,tekst)=>({kind:'file',name,async getFile(){return new File([tekst],name);}});
    const boom={};for(const [pad,tekst] of Object.entries(logs)){let node=boom;const delen=pad.split('/');delen.slice(0,-1).forEach(d=>{node=node[d]=node[d]||{};});node[delen.at(-1)]=tekst;}
    const bouw=(name,obj)=>map(name,Object.entries(obj).map(([k,v])=>typeof v==='string'?bestand(k,v):bouw(k,v)));
    window.__gevraagd=[];window.showDirectoryPicker=async opts=>{window.__gevraagd.push(opts);return bouw('X',boom);};
   },LOGS);
   const dlg=await kiesEnStart(page);
   await page.waitForFunction(()=>/Klaar \(MN\)/.test(document.getElementById('dgPFase')?.textContent||''),null,{timeout:60000});
   assert.equal(await dlg.locator('#dgMapMelding').innerText(),'');
   assert.deepEqual(await page.evaluate(()=>window.__gevraagd),[{mode:'read',id:'bidash-cdms'}]);
   const r=await uitkomst(page);
   assert.deepEqual(r.incidenten,[['DBD80','dicht'],['DBD81','open']],'alleen MN binnen de periode: '+JSON.stringify(r));
   assert.match(r.fase,/2 bestanden/);assert.ok(r.bronnen.some(n=>/DRIP uit map \(MN · 2025-01-01 t\/m 2025-04-01\)/.test(n)),JSON.stringify([r.bronnen,r.bronVelden]));
   assert.match(r.fase,/→ 2 unieke incidenten uit deze mapbron; totaal 2 incidenten uit 1 bronnen \(2 gekoppeld\)/,'bron en totaal tellen gelijk: '+r.fase);
   assert.doesNotMatch(r.fase,/geen enkel incident kon aan een DRIP-asset worden gekoppeld/,'incidenten koppelen aan All Assets: '+r.fase);
   // DVM 160: 'Vanaf laatst geladen datum' vult de laatste DRIP-dag van de gekozen regio's in.
   await page.locator('#dgPSluit').click();
   await page.evaluate(()=>HUB.open('datasets'));
   await page.locator('button:has-text("DRIP uit map lezen (CDMS)")').first().click();
   const dlg2=page.locator('#dgMapDialog');await dlg2.waitFor({state:'visible'});
   await dlg2.locator('#dgVanaf').fill('');await dlg2.locator('#dgVanafLaatst').click();
   assert.equal(await dlg2.locator('#dgVanaf').inputValue(),'2025-02-03');
   await dlg2.locator('.dgVc[value="non"]').check();await dlg2.locator('#dgVanafLaatst').click();
   assert.equal(await dlg2.locator('#dgVanaf').inputValue(),'');assert.match(await dlg2.locator('#dgMapMelding').innerText(),/Voor NON is nog niets geladen/);
   await dlg2.locator('#dgMapAnnuleer').click();
   assert.deepEqual(errors,[]);await page.close();}

  // 2b. DVM 159: bestanden die eerst falen worden opnieuw gelezen; blijvende fouten krijgen een reden.
  for(const scenario of ['tijdelijk','blijvend']){
   const {page,errors}=await nieuwePagina();
   await page.evaluate(({logs,scenario})=>{
    const pogingen=new Map();
    const map=(name,kinderen)=>({kind:'directory',name,async *entries(){for(const k of kinderen)yield [k.name,k];}});
    const bestand=(name,tekst)=>({kind:'file',name,async getFile(){
     const n=(pogingen.get(name)||0)+1;pogingen.set(name,n);
     // Het bestand van 15 januari staat 'alleen online': eerst (of altijd) NotReadableError.
     if(name==='a.txt'&&(scenario==='blijvend'||n===1))throw new DOMException('A requested file or directory could not be read','NotReadableError');
     return new File([tekst],name);}});
    const boom={};for(const [pad,tekst] of Object.entries(logs)){let node=boom;const delen=pad.split('/');delen.slice(0,-1).forEach(d=>{node=node[d]=node[d]||{};});node[delen.at(-1)]=tekst;}
    const bouw=(name,obj)=>map(name,Object.entries(obj).map(([k,v])=>typeof v==='string'?bestand(k,v):bouw(k,v)));
    window.showDirectoryPicker=async()=>bouw('X',boom);
   },{logs:LOGS,scenario});
   await kiesEnStart(page);
   if(scenario==='tijdelijk'){
    await page.waitForFunction(()=>/Klaar \(MN\)/.test(document.getElementById('dgPFase')?.textContent||''),null,{timeout:60000});
    const r=await uitkomst(page);
    assert.match(r.fase,/1 pas bij een tweede poging gelezen/);assert.deepEqual(r.incidenten,[['DBD80','dicht'],['DBD81','open']]);
   }else{
    await page.waitForFunction(()=>/Mislukt/.test(document.getElementById('dgPFase')?.textContent||''),null,{timeout:60000});
    const fase=await page.locator('#dgPFase').innerText();
    assert.match(fase,/1 van 2 DRIP-bestanden niet leesbaar, ook niet bij een tweede poging/);
    assert.match(fase,/1× Bestand niet lokaal beschikbaar of vergrendeld \(NotReadableError\)/);
    assert.match(fase,/Datums 15-1-2025 t\/m 15-1-2025/);assert.match(fase,/cdms\/mn\/log\/2025\/0?1\/15\/a\.txt/);
    assert.match(fase,/Altijd op dit apparaat bewaren/);
    assert.equal(await page.evaluate(()=>(DRIP_HIST_STATE?.incidenten||[]).length),0,'vorige stand behouden, niets afgeleid');
   }
   assert.deepEqual(errors,[]);await page.close();
  }

  // 3. Terugvalroute zonder moderne mapkiezer: de mapkeuze via de browser.
  {tmp=fs.mkdtempSync(path.join(os.tmpdir(),'bidash-cdms-'));
   for(const [pad,tekst] of Object.entries(LOGS)){const p=path.join(tmp,'X',pad);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,tekst);}
   const {page,errors}=await nieuwePagina();
   await page.evaluate(()=>{delete window.showDirectoryPicker;Object.defineProperty(window,'showDirectoryPicker',{value:undefined,configurable:true});});
   const kiezer=page.waitForEvent('filechooser');await kiesEnStart(page);
   await (await kiezer).setFiles(path.join(tmp,'X'));
   await page.waitForFunction(()=>/Klaar \(MN\)/.test(document.getElementById('dgPFase')?.textContent||''),null,{timeout:60000});
   const r=await uitkomst(page);assert.deepEqual(r.incidenten,[['DBD80','dicht'],['DBD81','open']],JSON.stringify(r));
   assert.deepEqual(errors,[]);await page.close();}

  console.log('DRIP-map dialoog: melding zonder VC, moderne mapkiezer en terugvalroute lezen alleen de gekozen regio en periode, episodes, toevoegen en koppelen aan All Assets geslaagd.');
 }finally{await browser?.close();await new Promise(r=>server.close(r));if(tmp)fs.rmSync(tmp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1});
