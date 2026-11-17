/* DVM 161: NDW-planningsfeed wegwerkzaamheden en evenementen (DATEX II v3).

   Bron: planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz van NDW Open Data, dezelfde
   plek als trafficspeed. Het bestand is ruim 15 MB ingepakt en ruim 200 MB XML. Het wordt
   daarom als stroom uitgepakt en per <situation> gelezen, zonder het hele document in het
   geheugen op te bouwen.

   Alleen werkzaamheden op het hoofdwegennet blijven over: een RWS-bron, of een weg die in
   All Assets voorkomt. Evenementen zonder werkzaamheden vallen weg. Elke situatie wordt een
   gewone werkregel (dezelfde kolommen als het werkzaamhedenbestand), zodat export, herstel
   en de assetkoppeling binnen ±2 km ongewijzigd blijven werken. De geometrie gaat als
   RD-WKT mee; de omleidingsroute telt niet als werkvak.

   De knop gebruikt de openbare kopie die de Pages-workflow publiceert (../ndw/werk/), omdat
   opendata.ndw.nu geen CORS toestaat. Een eigen gedownload bestand kan via de gewone
   uploadknop van Werkzaamheden. */
(function(){
  if(window.__BIDASH_NDW_WERK_ACTIVE__)return;
  const NDW_WERK_BRON='https://opendata.ndw.nu/planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz';
  const NDW_WERK_MAX_LEEFTIJD_MS=26*3600e3;
  const NDW_WERK_MAX_BYTES=40*1024*1024;
  const WERK_TYPEN=new Set(['MaintenanceWorks','ConstructionWorks']);
  const WERK_OORZAKEN=new Set(['roadMaintenance','constructionWork','roadworks']);
  const AFSLUITING={carriagewayClosures:'rijbaan dicht',roadClosed:'weg dicht',laneClosures:'rijstrook dicht',lanesClosed:'rijstrook dicht',lanesDeviated:'rijstroken verlegd',narrowLanes:'versmalde rijstroken',
    contraflow:'tegenverkeer op rijbaan',hardShoulderRunning:'vluchtstrook open',useOfSpecifiedLanesOrCarriagewaysAllowed:'aangewezen rijstroken',exitClosed:'afrit dicht',entryClosed:'oprit dicht',
    exitAndEntryClosed:'op- en afrit dicht',rampClosures:'toerit of afrit dicht',intermittentShortTermClosures:'korte afsluitingen',closedPermanentlyForTheWinter:'winterafsluiting'};
  /* roadworkStatus is de planningsstatus: 'final' is definitief gepland, niet afgerond. */
  const STATUS={initial:'voorlopig',published:'gepubliceerd',running:'in uitvoering',final:'definitief',alignmentFinished:'afgestemd'};
  const SOORT={maintenanceWork:'onderhoudswerk',roadworks:'wegwerkzaamheden',resurfacingWork:'asfalteringswerk',repairWork:'reparatiewerk',installationWork:'installatiewerk',
    roadMarkingWork:'markeringswerk',overheadWorks:'werk boven de weg',roadsideWork:'werk naast de weg',treeAndVegetationCuttingWork:'groenonderhoud',grassCuttingWork:'maaiwerk',
    clearanceWork:'opruimwerk',winterServiceActivity:'gladheidsbestrijding',bridgeConstruction:'brugbouw',constructionWork:'bouwwerk',demolitionWork:'sloopwerk',roadImprovement:'wegverbetering',
    roadWideningWork:'wegverbreding',other:'overig werk'};

  function bladen(tekst,naam){
    const re=new RegExp('<(?:[\\w-]+:)?'+naam+'(?:\\s[^>]*)?>([^<]*)<','g'),uit=[];let m;
    while((m=re.exec(tekst)))if(m[1].trim())uit.push(ontsnap(m[1].trim()));
    return uit;
  }
  function blokken(tekst,naam){
    const re=new RegExp('<(?:[\\w-]+:)?'+naam+'[\\s>][\\s\\S]*?<\\/(?:[\\w-]+:)?'+naam+'>','g');return tekst.match(re)||[];
  }
  function zonderBlok(tekst,naam){
    return tekst.replace(new RegExp('<(?:[\\w-]+:)?'+naam+'[\\s>][\\s\\S]*?<\\/(?:[\\w-]+:)?'+naam+'>','g'),'');
  }
  function ontsnap(s){return s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');}
  function ndwWerkWgsNaarRd(lat,lon){
    lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
    const dN=.36*(lat-52.15517440),dE=.36*(lon-5.38720621);
    const R=[[0,1,190094.945],[1,1,-11832.228],[2,1,-114.221],[0,3,-32.391],[1,0,-.705],[3,1,-2.34],[1,3,-.608],[0,2,-.008],[2,3,.148]];
    const S=[[1,0,309056.544],[0,2,3638.893],[2,0,73.077],[1,2,-157.984],[3,0,59.788],[0,1,.433],[2,2,-6.439],[1,1,-.032],[0,4,.092],[1,4,-.054]];
    let x=155000,y=463000;for(const [p,q,k] of R)x+=k*dN**p*dE**q;for(const [p,q,k] of S)y+=k*dN**p*dE**q;
    return x>=0&&x<=300000&&y>=280000&&y<=650000?{x:Math.round(x),y:Math.round(y)}:null;
  }
  function ndwWerkWeg(tekst){
    const m=String(tekst||'').toUpperCase().match(/(?:^|[^A-Z0-9])([AN])\s?0*(\d{1,3})(?![0-9])/);return m?m[1]+String(+m[2]):'';
  }
  /* Eén <situation> naar een werkregel, of null als het geen werkzaamheid is. */
  function ndwWerkSituatieNaarRij(xml,peildatum){
    const id=(xml.match(/<(?:[\w-]+:)?situation\s[^>]*\bid="([^"]+)"/)||[])[1]||'';
    const records=blokken(xml,'situationRecord');if(!id||!records.length)return {rij:null,reden:'leeg'};
    const typen=records.map(r=>(r.match(/xsi:type="(?:[\w-]+:)?(\w+)"/)||[])[1]||'');
    const oorzaken=bladen(xml,'causeType');
    if(!typen.some(t=>WERK_TYPEN.has(t))&&!oorzaken.some(o=>WERK_OORZAKEN.has(o)))return {rij:null,reden:'geen werk'};
    const bron=blokken(xml,'sourceName').flatMap(b=>bladen(b,'value'))[0]||'';
    const starts=[],eindes=[],lijnen=[],punten=[],gezienLijn=new Set();let openEinde=false;
    records.forEach((r,i)=>{
      const s=bladen(r,'overallStartTime')[0],e=bladen(r,'overallEndTime')[0];
      if(s)starts.push(Date.parse(s));if(e)eindes.push(Date.parse(e));else openEinde=true;
      if(typen[i]==='ReroutingManagement')return;
      const plek=zonderBlok(blokken(r,'locationReference').join(''),'alternativeRoute');
      bladen(plek,'posList').forEach(lijst=>{
        const g=lijst.split(/\s+/).map(Number),ps=[];
        for(let k=0;k+1<g.length;k+=2){const p=ndwWerkWgsNaarRd(g[k],g[k+1]);if(!p)continue;const v=ps[ps.length-1];if(!v||Math.hypot(p.x-v.x,p.y-v.y)>=25)ps.push(p);}
        const sleutel=ps.map(p=>p.x+' '+p.y).join(',');
        if(ps.length>=2){if(!gezienLijn.has(sleutel)){gezienLijn.add(sleutel);lijnen.push(ps);}}else if(ps.length===1)punten.push(ps[0]);
      });
      blokken(plek,'pointCoordinates').forEach(b=>{const p=ndwWerkWgsNaarRd(bladen(b,'latitude')[0],bladen(b,'longitude')[0]);if(p)punten.push(p);});
    });
    const opmerkingen=blokken(xml,'generalPublicComment').map(b=>({tekst:bladen(b,'value').join(' '),soort:bladen(b,'commentType')[0]||''}));
    const oorzaak=blokken(xml,'causeDescription').flatMap(b=>bladen(b,'value'));
    const publiek=opmerkingen.filter(o=>o.soort!=='internalNote').map(o=>o.tekst),intern=opmerkingen.filter(o=>o.soort==='internalNote').map(o=>o.tekst);
    const weg=ndwWerkWeg(bladen(xml,'roadOrJunctionNumber')[0])||ndwWerkWeg([...intern,...publiek,...oorzaak].join(' '));
    const klasse=bladen(xml,'roadworkHindranceClass').map(v=>(v.match(/(\d)$/)||[])[1]).filter(Boolean).sort().pop();
    const vertraging=bladen(xml,'delayBand')[0]||'';
    const hinder=[klasse!=null?'hinderklasse '+klasse:'',{negligible:'geen vertraging',upToTenMinutes:'tot 10 min',betweenTenMinutesAndThirtyMinutes:'10–30 min',betweenThirtyMinutesAndOneHour:'30–60 min',longerThanOneHour:'meer dan 1 uur'}[vertraging]||''].filter(Boolean).join(', ');
    const afsluiting=[...new Set(bladen(xml,'roadOrCarriagewayOrLaneManagementType').map(v=>AFSLUITING[v]||v))].join(', ');
    const statusRuw=bladen(xml,'roadworkStatus')[0]||'',status=STATUS[statusRuw]||statusRuw;
    const omleiding=[...new Set(blokken(xml,'reroutingItineraryDescription').flatMap(b=>bladen(b,'value')))].join('; ');
    const iso=ms=>Number.isFinite(ms)?new Date(ms).toISOString():'';
    const rij={werk_id:id,weg,traject:bron,richting:'',start:iso(starts.length?Math.min(...starts):NaN),einde:openEinde?'':iso(eindes.length?Math.max(...eindes):NaN),
      hinder,afsluiting,omleiding,werkzaamheden:([...new Set([...oorzaak,...publiek,...intern])].join(' · ')||[...new Set([...bladen(xml,'roadMaintenanceType'),...bladen(xml,'constructionWorkType')].map(v=>SOORT[v]||v))].join(', ')).slice(0,600),status,
      bron_url:bladen(xml,'urlLinkAddress')[0]||'',peildatum:peildatum||''};
    if(lijnen.length)rij.wkt='MULTILINESTRING('+lijnen.map(l=>'('+l.map(p=>p.x+' '+p.y).join(',')+')').join(',')+')';
    if(punten.length){rij.rd_x=punten[0].x;rij.rd_y=punten[0].y;const z=punten[punten.length-1];if(punten.length>1){rij.rd_x_eind=z.x;rij.rd_y_eind=z.y;}}
    rij._lijnen=lijnen;rij._punten=punten;
    return {rij,bron,weg};
  }
  /* Veel RWS-situaties noemen geen wegnummer, alleen geometrie. Weg en hectometers komen
     dan van assets uit All Assets binnen 150 m van het werkvak (meerderheid per weg). */
  function ndwWerkAssetRaster(){
    const raster=new Map(),maat=500;let assets=[];
    try{assets=(typeof ASSET_REGISTER_STATE!=='undefined'&&ASSET_REGISTER_STATE&&ASSET_REGISTER_STATE.assets)||[];}catch(e){}
    for(const a of assets){const x=Number(a.rdX),y=Number(a.rdY);if(!a.weg||!Number.isFinite(x)||!Number.isFinite(y)||!x||!y)continue;const k=Math.floor(x/maat)+'|'+Math.floor(y/maat);let l=raster.get(k);if(!l)raster.set(k,l=[]);l.push({x,y,weg:String(a.weg).toUpperCase(),hm:Number.isFinite(Number(a.hm))?Number(a.hm):null});}
    return {raster,maat};
  }
  function ndwWerkLocatieUitAssets(rij,r){
    const ps=[...rij._lijnen.flat(),...rij._punten];if(!ps.length||!r.raster.size)return;
    const stemmen=new Map();
    for(const p of ps){
      const kx=Math.floor(p.x/r.maat),ky=Math.floor(p.y/r.maat);let best=null,bd=150;
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const a of r.raster.get((kx+dx)+'|'+(ky+dy))||[]){const d=Math.hypot(a.x-p.x,a.y-p.y);if(d<=bd){bd=d;best=a;}}
      if(best){let s=stemmen.get(best.weg);if(!s)stemmen.set(best.weg,s={n:0,hm:[]});s.n++;if(best.hm!=null)s.hm.push(best.hm);}
    }
    const top=[...stemmen.entries()].sort((a,b)=>b[1].n-a[1].n)[0];if(!top)return;
    if(!rij.weg)rij.weg=top[0];
    if(rij.weg===top[0]&&top[1].hm.length){rij.van_hm=Math.min(...top[1].hm);rij.tot_hm=Math.max(...top[1].hm);}
  }
  function ndwWerkIsHwn(info){
    if(/\bRWS\b|Rijkswaterstaat/i.test(info.bron||''))return true;
    try{return !!(info.weg&&typeof ASSET_INDEX!=='undefined'&&ASSET_INDEX&&ASSET_INDEX.byRoad&&ASSET_INDEX.byRoad.has(info.weg));}catch(e){return false;}
  }
  async function ndwWerkIsGzip(file){
    try{const b=new Uint8Array(await file.slice(0,2).arrayBuffer());return b[0]===0x1f&&b[1]===0x8b;}catch(e){return false;}
  }
  async function ndwWerkIsDatex(file){
    if(/\.xml(\.gz)?$/i.test(file?.name||''))return true;
    return ndwWerkIsGzip(file);
  }
  /* Leest de feed als stroom en levert de werkregels. */
  async function ndwWerkRijenUitBestand(file,voortgang){
    if(typeof DecompressionStream!=='function'||typeof TextDecoderStream!=='function')throw new Error('deze browser kan de NDW-planningsfeed niet als stroom lezen. Gebruik een recente Edge of Chrome.');
    let stroom=file.stream();if(await ndwWerkIsGzip(file))stroom=stroom.pipeThrough(new DecompressionStream('gzip'));
    const lezer=stroom.pipeThrough(new TextDecoderStream()).getReader();
    let buffer='',sluit=null,open=null,peildatum='',gezien=0,bronTotaal=0,geenWerk=0,buitenHwn=0,laatste=0,gelezen=0,isDatex=false;const rijen=[];
    while(true){
      const {value,done}=await lezer.read();
      if(value){buffer+=value;gelezen+=value.length;}
      if(!sluit){
        const m=buffer.match(/<([\w-]+:)?situation[\s>]/);
        if(m){sluit='</'+(m[1]||'')+'situation>';open='<'+(m[1]||'')+'situation';isDatex=true;}
        const p=buffer.match(/<(?:[\w-]+:)?publicationTime>([^<]+)</);if(p)peildatum=p[1].trim();
        if(!m&&buffer.length>2e6&&!/SituationPublication/.test(buffer))throw new Error('dit is geen NDW-planningsfeed (DATEX II SituationPublication).');
      }
      if(sluit){
        let begin=0,eind;
        while((eind=buffer.indexOf(sluit,begin))>=0){
          let start=buffer.indexOf(open,begin);
          while(start>=0&&start<eind&&!/[\s>]/.test(buffer[start+open.length]))start=buffer.indexOf(open,start+1);
          const stuk=buffer.slice(start>=0&&start<eind?start:begin,eind+sluit.length);begin=eind+sluit.length;
          gezien++;bronTotaal++;
          const {rij,reden,bron,weg}=ndwWerkSituatieNaarRij(stuk,peildatum);
          if(!rij){if(reden==='geen werk')geenWerk++;continue;}
          if(!ndwWerkIsHwn({bron,weg})){buitenHwn++;continue;}
          rijen.push(rij);
        }
        buffer=buffer.slice(begin);
      }
      const nu=Date.now();
      if(voortgang&&(done||nu-laatste>250)){laatste=nu;voortgang(gelezen,gezien,rijen.length);await new Promise(r=>setTimeout(r,0));}
      if(done)break;
    }
    if(!isDatex)throw new Error('dit is geen NDW-planningsfeed (DATEX II SituationPublication).');
    return {rijen,peildatum,bronTotaal,geenWerk,buitenHwn};
  }
  async function leesNdwWerkBestand(file,opties){
    opties=opties||{};
    if(!ASSET_REGISTER_STATE){alert('Laad eerst All Assets.');return;}
    const naam=opties.naam||file.name||'NDW planningsfeed';
    zetImportVoortgang(naam,1,'NDW-planningsfeed uitpakken en per situatie lezen',{direct:true});await uiPauze();
    try{
      const uit=await ndwWerkRijenUitBestand(file,(tekens,situaties,hwn)=>zetImportVoortgang(naam,Math.min(70,2+68*tekens/2.1e8),`NDW-planningsfeed lezen: ${situaties.toLocaleString('nl-NL')} situaties · ${hwn.toLocaleString('nl-NL')} werkzaamheden op het hoofdwegennet`,{direct:true}));
      zetImportVoortgang(naam,72,'Weg en hectometers afleiden uit All Assets langs het werkvak',{direct:true});await uiPauze();
      const raster=ndwWerkAssetRaster();
      for(const rij of uit.rijen){ndwWerkLocatieUitAssets(rij,raster);delete rij._lijnen;delete rij._punten;}
      const werken=uit.rijen.map(normWerkRij).filter(Boolean);
      if(!werken.length)throw new Error(`geen werkzaamheden op het hoofdwegennet gevonden (${uit.bronTotaal.toLocaleString('nl-NL')} situaties gelezen).`);
      const peil=Date.parse(uit.peildatum)||null;
      WERK_STATE={bestand:naam,werken,totaal:werken.length,bronTotaal:uit.bronTotaal,genegeerdN:uit.geenWerk+uit.buitenHwn,exactN:0,assetKoppelingenN:0,peildatum:peil||datumUitBestandsnaam(file.name||''),ruweRijen:uit.rijen,
        ndw:{bron:NDW_WERK_BRON,publicatie:uit.peildatum,geenWerk:uit.geenWerk,buitenHwn:uit.buitenHwn,online:opties.online||null}};
      zetImportVoortgang(naam,76,`Assets binnen ±${WERK_BUFFER_KM} km koppelen`,{direct:true});await uiPauze();
      await herkoppelWerkAssetsLicht((f,fa)=>zetImportVoortgang(naam,76+f*22,fa,{direct:true}));
      ANALYSE_SIGNATURE='';probeerAnalyseActiveren(null);
      const tekst=`${werken.length.toLocaleString('nl-NL')} werkzaamheden op het hoofdwegennet uit ${uit.bronTotaal.toLocaleString('nl-NL')} NDW-situaties (${uit.geenWerk.toLocaleString('nl-NL')} evenementen of zonder werk, ${uit.buitenHwn.toLocaleString('nl-NL')} buiten het hoofdwegennet); ${WERK_STATE.exactN.toLocaleString('nl-NL')} met geometrie, ${WERK_STATE.assetKoppelingenN.toLocaleString('nl-NL')} assetkoppelingen. Publicatie ${peil?new Date(peil).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam'}):'onbekend'}.`;
      importKlaar(naam,tekst);
      try{if(typeof renderDatasetBeheer==='function')renderDatasetBeheer();}catch(e){}
      try{if(parent!==window)parent.postMessage({type:'hub:changed',engine:'dvm',sourceSpecific:true,bron:'werkzaamheden'},location.origin);}catch(e){}
      return {werken:werken.length,bronTotaal:uit.bronTotaal,tekst};
    }catch(err){importMislukt(naam,err.message);throw err;}
  }
  async function ndwWerkHash(file){
    const buf=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  let haalBezig=false;
  function zetHaalStatus(tekst){document.querySelectorAll('[data-ndw-werk-status]').forEach(el=>{el.textContent=tekst||'';});}
  async function haalNdwWerkzaamheden(){
    if(haalBezig)throw new Error('De NDW-werkzaamheden worden al opgehaald.');
    if(!ASSET_REGISTER_STATE)throw new Error('Laad eerst All Assets.');
    haalBezig=true;document.querySelectorAll('[data-ndw-werk]').forEach(b=>b.disabled=true);
    const naam='NDW werkzaamheden ophalen',ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),120000);
    const opties={method:'GET',cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',redirect:'error',signal:ctrl.signal};
    try{
      zetHaalStatus('Laatste openbare kopie zoeken…');zetImportVoortgang(naam,1,'Laatste openbare kopie van de NDW-planningsfeed zoeken',{direct:true});
      const meta=await fetch('../ndw/werk/latest.json',opties);
      if(!meta.ok)throw new Error('De openbare kopie van de NDW-werkzaamheden is nog niet beschikbaar. Probeer later opnieuw, of download planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz zelf en laad die via Werkzaamheden laden.');
      const m=await meta.json(),pub=Date.parse(m.publication);
      if(m.schema!==1||m.status!=='ready')throw new Error('NDW-werkzaamheden konden bij de laatste verversing niet worden opgehaald. De geladen werkzaamheden blijven staan.');
      if(m.source!==NDW_WERK_BRON||!/^[a-f0-9]{64}$/.test(m.sha256||'')||m.file!=='werk-'+m.sha256+'.xml.gz'||!Number.isInteger(m.bytes)||m.bytes<1||m.bytes>NDW_WERK_MAX_BYTES)throw new Error('De kopie van de NDW-werkzaamheden heeft een ongeldig bronmanifest.');
      if(!Number.isFinite(pub)||Date.now()-pub>NDW_WERK_MAX_LEEFTIJD_MS||pub-Date.now()>5*60000)throw new Error('De kopie van de NDW-werkzaamheden is ouder dan 26 uur of heeft een ongeldige tijd. De geladen werkzaamheden blijven staan.');
      const antw=await fetch('../ndw/werk/'+m.file,opties);
      if(!antw.ok||!antw.body)throw new Error('De NDW-werkzaamheden konden niet volledig worden opgehaald. Probeer opnieuw.');
      const lezer=antw.body.getReader(),delen=[];let grootte=0;
      while(true){
        const {value,done}=await lezer.read();if(done)break;
        grootte+=value.length;if(grootte>m.bytes){await lezer.cancel();throw new Error('De download wijkt af van het bronmanifest.');}
        delen.push(value);const pct=Math.round(100*grootte/m.bytes);zetHaalStatus('Downloaden: '+pct+' procent');zetImportVoortgang(naam,1+Math.min(19,19*grootte/m.bytes),'NDW-werkzaamheden downloaden, '+pct+' procent',{direct:true});
      }
      clearTimeout(timer);
      if(grootte!==m.bytes)throw new Error('De download is onvolledig. De geladen werkzaamheden blijven staan.');
      const file=new File(delen,'planningsfeed_wegwerkzaamheden_en_evenementen.xml.gz',{type:'application/gzip'});
      if(!globalThis.crypto?.subtle||await ndwWerkHash(file)!==m.sha256)throw new Error('De download heeft een afwijkende vingerafdruk. Probeer opnieuw.');
      zetHaalStatus('Verwerken…');
      const r=await leesNdwWerkBestand(file,{naam:'NDW planningsfeed werkzaamheden',online:{downloadedAt:m.downloadedAt,publication:m.publication,retained:m.retained===true}});
      zetHaalStatus(r?r.tekst+(m.retained?' De laatste verversing mislukte; de vorige geldige kopie is gebruikt.':''):'');
      return r;
    }catch(err){
      const tekst=err.name==='AbortError'?'Ophalen van de NDW-werkzaamheden duurde te lang. Probeer opnieuw.':err.message||String(err);
      zetHaalStatus(tekst);if(typeof importMislukt==='function')importMislukt(naam,tekst);throw new Error(tekst);
    }finally{clearTimeout(timer);haalBezig=false;document.querySelectorAll('[data-ndw-werk]').forEach(b=>b.disabled=false);}
  }

  /* De gewone werkzaamhedenupload herkent de NDW-feed (gzip of XML) en leidt die hierheen.
     Excel en CSV blijven via de bestaande lezer lopen. */
  if(typeof leesWerkBestand==='function'){
    const origineel=leesWerkBestand;
    leesWerkBestand=async function(file){
      if(file&&await ndwWerkIsDatex(file)){try{return await leesNdwWerkBestand(file);}catch(err){alert('Kon de NDW-planningsfeed niet verwerken: '+err.message);return;}}
      return origineel.apply(this,arguments);
    };
  }
  window.ndwWerkSituatieNaarRij=ndwWerkSituatieNaarRij;
  window.ndwWerkRijenUitBestand=ndwWerkRijenUitBestand;
  window.leesNdwWerkBestand=leesNdwWerkBestand;
  window.bidashHaalNdwWerkzaamheden=haalNdwWerkzaamheden;
  window.__BIDASH_NDW_WERK_ACTIVE__=true;
})();
