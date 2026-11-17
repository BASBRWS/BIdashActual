/* DVM 161: NDW-planningsfeed wegwerkzaamheden. Synthetische DATEX II-situaties, geen
   bronextract. Controleert de selectie (hoofdwegennet, geen evenementen), weg en
   hectometers uit All Assets langs het werkvak, de omleiding die niet als werkvak telt,
   de assetkoppeling, export en herstel, en de knop met de openbare kopie (manifest,
   vingerafdruk, leeftijd). */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),zlib=require('node:zlib'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const site=path.join(__dirname,'../site'),SOURCE='https://opendata.ndw.nu/planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz';

function wgsNaarRd(lat,lon){
  const dN=.36*(lat-52.15517440),dE=.36*(lon-5.38720621);
  const R=[[0,1,190094.945],[1,1,-11832.228],[2,1,-114.221],[0,3,-32.391],[1,0,-.705],[3,1,-2.34],[1,3,-.608],[0,2,-.008],[2,3,.148]];
  const S=[[1,0,309056.544],[0,2,3638.893],[2,0,73.077],[1,2,-157.984],[3,0,59.788],[0,1,.433],[2,2,-6.439],[1,1,-.032],[0,4,.092],[1,4,-.054]];
  let x=155000,y=463000;for(const [p,q,k] of R)x+=k*dN**p*dE**q;for(const [p,q,k] of S)y+=k*dN**p*dE**q;return {x:Math.round(x),y:Math.round(y)};
}
// Werkvak langs een denkbeeldige A12 (zonder wegnummer in de tekst) en een omleiding ver weg.
const lijn=[[52.05,5.10],[52.055,5.11],[52.06,5.12]],omleiding=[[52.30,5.60],[52.31,5.61]];
const pub=new Date(Date.now()-30*60000).toISOString();
const rec=(type,inhoud,id)=>`<sit:situationRecord xsi:type="sit:${type}" id="${id}" version="1"><sit:source><com:sourceName><com:values><com:value lang="nl">${inhoud.bron}</com:value></com:values></com:sourceName></sit:source><sit:validity><com:validityTimeSpecification><com:overallStartTime>${inhoud.start}</com:overallStartTime><com:overallEndTime>${inhoud.eind}</com:overallEndTime></com:validityTimeSpecification></sit:validity>${inhoud.extra||''}<sit:locationReference xsi:type="loc:ItineraryByIndexedLocations"><loc:locationContainedInItinerary index="0"><loc:location xsi:type="loc:LinearLocation"><loc:gmlLineString srsName="WGS 84"><loc:posList>${inhoud.pos}</loc:posList></loc:gmlLineString></loc:location></loc:locationContainedInItinerary></sit:locationReference>${inhoud.na||''}</sit:situationRecord>`;
const pos=l=>l.map(p=>p.join(' ')).join(' ');
const nu=Date.now(),iso=ms=>new Date(ms).toISOString();
const rws={bron:'MN-Z [RWS Midden-Nederland District Zuid]',start:iso(nu-3600e3),eind:iso(nu+5*3600e3),pos:pos(lijn)};
const situaties=[
  // 1. RWS-onderhoud zonder wegnummer, met rijbaanafsluiting en een omleiding elders.
  `<sit:situation id="RWS_TEST_1"><sit:overallSeverity>medium</sit:overallSeverity>${rec('MaintenanceWorks',{...rws,extra:'<sit:impact><sit:delays><sit:delayBand>betweenTenMinutesAndThirtyMinutes</sit:delayBand></sit:delays></sit:impact>',na:'<sit:_roadworksExtension><sit:roadworksExtension><nle:roadworkHindrance><nle:roadworkHindranceClass>hindranceClass3</nle:roadworkHindranceClass></nle:roadworkHindrance><nle:roadworkPlanningStatus><nle:roadworkStatus>final</nle:roadworkStatus></nle:roadworkPlanningStatus></sit:roadworksExtension></sit:_roadworksExtension><sit:roadMaintenanceType>maintenanceWork</sit:roadMaintenanceType>'},'R1')}${rec('RoadOrCarriagewayOrLaneManagement',{...rws,na:'<sit:roadOrCarriagewayOrLaneManagementType>carriagewayClosures</sit:roadOrCarriagewayOrLaneManagementType>'},'R1b')}${rec('ReroutingManagement',{...rws,pos:pos(omleiding),na:'<sit:reroutingItineraryDescription><com:values><com:value lang="nl">Volg U12 &amp; borden</com:value></com:values></sit:reroutingItineraryDescription><sit:alternativeRoute><loc:locationContainedInItinerary index="0"><loc:location><loc:gmlLineString><loc:posList>'+pos(omleiding)+'</loc:posList></loc:gmlLineString></loc:location></loc:locationContainedInItinerary></sit:alternativeRoute>'},'R1c')}</sit:situation>`,
  // 2. Gemeentelijk werk op een gemeenteweg: valt buiten het hoofdwegennet.
  `<sit:situation id="GEM_TEST_2">${rec('MaintenanceWorks',{bron:'Gemeente Utrecht',start:rws.start,eind:rws.eind,pos:pos([[52.09,5.12],[52.091,5.121]]),na:'<sit:generalPublicComment><sit:comment><com:values><com:value lang="nl">Biltstraat afgesloten</com:value></com:values></sit:comment><sit:commentType>warning</sit:commentType></sit:generalPublicComment>'},'G2')}</sit:situation>`,
  // 3. Evenement zonder werkzaamheden: valt weg.
  `<sit:situation id="EVT_TEST_3">${rec('PublicEvent',{bron:'MN [RWS Midden-Nederland]',start:rws.start,eind:rws.eind,pos:pos(lijn)},'E3')}</sit:situation>`,
  // 4. RWS-werk met wegnummer in de opmerking, ver van de assets.
  `<sit:situation id="RWS_TEST_4">${rec('ConstructionWorks',{bron:'ON-Z [RWS Oost-Nederland District Zuid]',start:iso(nu+86400e3),eind:iso(nu+2*86400e3),pos:pos([[51.80,5.90],[51.81,5.91]]),extra:'<sit:cause><sit:causeType>constructionWork</sit:causeType></sit:cause><sit:generalPublicComment><sit:comment><com:values><com:value lang="nl">A73 Nijmegen: nieuwe voegovergang</com:value></com:values></sit:comment><sit:commentType>warning</sit:commentType></sit:generalPublicComment>'},'R4')}</sit:situation>`,
];
const xml=`<?xml version="1.0" encoding="UTF-8"?><mc:messageContainer xmlns:sit="http://datex2.eu/schema/3/situation" xmlns:mc="http://datex2.eu/schema/3/messageContainer" xmlns:nle="http://datex2.eu/schema/3/nlExtensions" xmlns:loc="http://datex2.eu/schema/3/locationReferencing" xmlns:com="http://datex2.eu/schema/3/common" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><mc:payload xsi:type="sit:SituationPublication" lang="nl"><com:publicationTime>${pub}</com:publicationTime>${situaties.join('')}</mc:payload></mc:messageContainer>`;
const bytes=zlib.gzipSync(xml),sha=crypto.createHash('sha256').update(bytes).digest('hex');
let mode='ready';
const manifest=()=>({schema:1,status:'ready',source:SOURCE,file:'werk-'+sha+'.xml.gz',sha256:sha,bytes:bytes.length,publication:mode==='oud'?'2025-01-01T00:00:00Z':pub,downloadedAt:new Date().toISOString(),retained:false});

(async()=>{
  const server=require('node:http').createServer((req,res)=>{
    const uri=new URL(req.url,'http://localhost').pathname;
    if(uri==='/ndw/werk/latest.json'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(manifest()));return;}
    if(uri==='/ndw/werk/werk-'+sha+'.xml.gz'){const b=Buffer.from(bytes);if(mode==='kapot')b[b.length-5]^=1;res.setHeader('Content-Type','application/gzip');res.end(b);return;}
    try{const p=path.join(site,uri);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(p));}
    catch{res.statusCode=404;res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch();
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const dialogen=[];page.on('dialog',d=>{dialogen.push(d.message());d.dismiss();});
    await page.goto(`http://127.0.0.1:${server.address().port}/engines/dvm.html`);
    await page.waitForFunction(()=>window.__BIDASH_NDW_WERK_ACTIVE__&&window.__BIDASH_DVM_SOURCE_MANAGER_ACTIVE__);
    // Assets op en naast het werkvak (A12, hm 30,0 t/m 31,2) en een asset op afstand.
    const punten=lijn.map(([a,b])=>wgsNaarRd(a,b));
    await page.evaluate(punten=>{
      const rij=(id,naam,p)=>({entityid:id,asset:naam,'ci-type':'VKS signaalgevers',regio:'MN',status:'Operationeel','rd-locatie-x':p.x,'rd-locatie-y':p.y});
      const rijen=[rij('S1','MSI A12 RE 30.000 1',{x:punten[0].x+20,y:punten[0].y}),rij('S2','MSI A12 RE 30.600 1',{x:punten[1].x,y:punten[1].y+30}),rij('S3','MSI A12 RE 31.200 1',punten[2]),
        rij('S4','MSI A73 RE 100.000 1',{x:190000,y:420000})];
      analyseerAssetRegister(rijen,'synthetic');
      document.getElementById('loginScherm').style.display='none';document.getElementById('appRoot').style.display='';HUB.open('datasets');
    },punten);

    // 1. Eigen bestand via de gewone uploadknop van Werkzaamheden.
    await page.locator('.dataset-card:has-text("Werkzaamheden") button:has-text("Werkzaamheden laden")').click({trial:true});
    const accept=await page.evaluate(()=>window.DVM_SOURCE_UPLOADS.werkzaamheden.accept);assert.match(accept,/\.gz/);assert.match(accept,/\.xml/);
    const tmp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'ndwwerk-')),bestand=path.join(tmp,'planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz');fs.writeFileSync(bestand,bytes);
    const [kiezer]=await Promise.all([page.waitForEvent('filechooser'),page.evaluate(()=>openDatasetUpload('werkzaamheden'))]);
    await kiezer.setFiles(bestand);
    await page.waitForFunction(()=>WERK_STATE&&WERK_STATE.ndw,null,{timeout:30000});
    const r=await page.evaluate(()=>({totaal:WERK_STATE.totaal,bron:WERK_STATE.bronTotaal,genegeerd:WERK_STATE.genegeerdN,ndw:WERK_STATE.ndw,
      werken:WERK_STATE.werken.map(w=>({id:w.id,weg:w.weg,vanHm:w.vanHm,totHm:w.totHm,hinder:w.hinder,afsluiting:w.afsluiting,omleiding:w.omleiding,status:w.status,omschrijving:w.omschrijving,assets:w.assetKeys.length,bron:w.geometrieBron,maxY:Math.max(...w.rdSegmenten.flat().map(p=>p.y))}))}));
    assert.equal(r.totaal,2,JSON.stringify(r));assert.equal(r.bron,4);assert.equal(r.ndw.geenWerk,1);assert.equal(r.ndw.buitenHwn,1);
    const w1=r.werken.find(w=>w.id==='RWS_TEST_1'),w4=r.werken.find(w=>w.id==='RWS_TEST_4');
    assert.equal(w1.weg,'A12','weg afgeleid uit assets langs het werkvak');assert.equal(w1.vanHm,30);assert.equal(w1.totHm,31.2);
    assert.equal(w1.hinder,'hinderklasse 3, 10–30 min');assert.equal(w1.afsluiting,'rijbaan dicht');assert.equal(w1.omleiding,'Volg U12 & borden');
    assert.equal(w1.status,'definitief','final is definitief gepland, niet afgerond');assert.equal(w1.omschrijving,'onderhoudswerk');
    assert.equal(w1.assets,3);assert.equal(w1.bron,'NDW planningsfeed (WKT)');
    assert.ok(w1.maxY<wgsNaarRd(52.2,5.5).y,'de omleidingsroute telt niet als werkvak');
    assert.equal(w4.weg,'A73','wegnummer uit de opmerking');assert.equal(w4.assets,0);
    assert.match(await page.evaluate(()=>JSON.stringify(IMPORT_PROGRESS)),/2 werkzaamheden op het hoofdwegennet uit 4 NDW-situaties/);

    // 2. Export en herstel houden de werkvakgeometrie en de afgeleide weg.
    const hersteld=await page.evaluate(()=>{
      const rijen=JSON.parse(JSON.stringify(WERK_STATE.ruweRijen));const w=rijen.map(normWerkRij).filter(Boolean);
      return w.map(x=>({id:x.id,weg:x.weg,vanHm:x.vanHm,seg:x.rdSegmenten.length,bron:x.geometrieBron}));
    });
    assert.deepEqual(hersteld.find(x=>x.id==='RWS_TEST_1'),{id:'RWS_TEST_1',weg:'A12',vanHm:30,seg:1,bron:'NDW planningsfeed (WKT)'});

    // 3. Knop met de openbare kopie: geldige kopie, te oude kopie, beschadigde download.
    await page.evaluate(()=>{WERK_STATE=null;HUB.open('datasets');renderDatasetBeheer();});
    const knop=page.locator('button[data-ndw-werk]');await knop.click();
    await page.waitForFunction(()=>WERK_STATE&&WERK_STATE.ndw&&WERK_STATE.ndw.online,null,{timeout:30000});
    assert.equal(await page.evaluate(()=>WERK_STATE.totaal),2);
    assert.match(await page.locator('[data-ndw-werk-status]').first().innerText(),/2 werkzaamheden op het hoofdwegennet/);
    for(const [m,re] of [['oud',/ouder dan 26 uur/],['kapot',/afwijkende vingerafdruk/]]){
      mode=m;dialogen.length=0;await page.evaluate(()=>HUB.open('datasets'));await page.locator('button[data-ndw-werk]').click();
      await page.waitForFunction(()=>document.querySelector('[data-ndw-werk-status]')&&/ouder|vingerafdruk/.test(document.querySelector('[data-ndw-werk-status]').textContent),null,{timeout:30000});
      assert.match(await page.locator('[data-ndw-werk-status]').first().innerText(),re);
      assert.equal(await page.evaluate(()=>WERK_STATE.totaal),2,'vorige werkzaamheden blijven staan');
      await page.waitForFunction(()=>!document.querySelector('button[data-ndw-werk]').disabled);
      await page.evaluate(()=>{document.querySelectorAll('[data-ndw-werk-status]').forEach(e=>e.textContent='');});
    }
    assert.deepEqual(errors,[]);
    console.log('NDW werkzaamheden: selectie hoofdwegennet, weg en hm uit assets, omleiding apart, koppeling, herstel en openbare kopie geslaagd.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
