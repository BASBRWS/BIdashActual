/* Demo-omgeving (2.95 / DVM 168). Bouwt een volledig gesimuleerde werkruimte op met
   de datum van vandaag: vijf verkeerscentrales, een assetregister met signaalgevers,
   detectielussen, camera's en DRIP's, open storingen en storingshistorie (ook voor
   afritten, toeritten, weefvakken en splitsingen), een netwerkschakelmatrix,
   werkzaamheden, U-routes, het BI-organisatiemodel (bedrijfsfuncties, bedienketen-
   assets, budget), een planning met VWM-fasen en mijlpalen, en de operationele
   formatie per VC met de rekenmethode van het ingenieursbureau.

   Alle gegevens zijn verzonnen. Er zit geen operationele data in. De generator is
   deterministisch (vaste startwaarde), alleen de datums volgen 'nu'. De demo draait in
   een eigen opslag (zie core/actual-profile.js, ?demo=1) en raakt de echte werkruimte niet. */

export const DEMO_VERSIE='1';
/* Beschikbare FTE per dienst voor de planning (Dashboardbeheer); geen standaardwaarden,
   zodat de formatietoets tekorten kan tonen. */
export const DEMO_PLANNING_FTE={GPO:9,CIV:6,VWM:8,PPO:4,Regio:3};
/* FTE per planningstaak (rol, dienst, fte), naar de fase van de taak. */
export function demoTaakFte(naam){
  const n=String(naam||'').toLowerCase(),uit=[{rol:'Projectmanager',dienst:'GPO',fte:0.4}];
  if(/contract|aanbesteding|plan/.test(n))uit.push({rol:'Contractmanager',dienst:'GPO',fte:0.6},{rol:'Omgevingsmanager',dienst:'Regio',fte:0.3});
  if(/ontwerp|fabriek|bouw/.test(n))uit.push({rol:'Technisch manager',dienst:'CIV',fte:1.2},{rol:'Systeemintegrator',dienst:'CIV',fte:0.8});
  if(/installatie|sitetest|openstelling/.test(n))uit.push({rol:'Technisch manager',dienst:'CIV',fte:1},{rol:'Assetmanager',dienst:'PPO',fte:0.5},{rol:'Omgevingsmanager',dienst:'Regio',fte:0.4});
  if(/nazorg/.test(n))uit.push({rol:'Assetmanager',dienst:'PPO',fte:0.6});
  return uit;
}
/* Organisatie per VC: regionale dienst, districten en contracten (verzonnen). */
const ORGANISATIE={ZWN:['West-Nederland Zuid',['Zuid-Holland Noord','Zuid-Holland Zuid'],'Prestatiecontract ZWN-1','Wegbeheer West BV'],NWN:['West-Nederland Noord',['Noord-Holland Noord','Amsterdam'],'Prestatiecontract NWN-2','Noordwest Infra'],
  MN:['Midden-Nederland',['Utrecht Oost','Utrecht West'],'Prestatiecontract MN-3','Centraal Wegonderhoud'],NON:['Oost-Nederland',['Gelderland Noord','Overijssel'],'Prestatiecontract ON-4','Oost Verkeerstechniek'],ZN:['Zuid-Nederland',['Brabant West','Limburg'],'Prestatiecontract ZN-5','Zuid Signalering']};
const LEVERANCIER={MSI:'Signaalbouw NV',LUS:'Detectiesystemen BV',CAM:'Beeldtechniek BV',DRIP:'Paneel & Display BV'};

function rng(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}

/* Vijf VC's met drie wegen. Per weg een RD-beginpunt en een richting, zodat de kaart
   een herkenbaar beeld geeft. Wegen zijn 20 km lang (hm 0,0 t/m 20,0). */
export const DEMO_NETWERK=[
  {vc:'ZWN',wegen:[['A4',84000,440000,0.6,0.8],['A15',90000,432000,1,0.05],['A20',80000,438000,0.9,0.35]]},
  {vc:'NWN',wegen:[['A9',110000,494000,0.3,0.95],['A10',118000,484000,0.95,0.3],['A1',125000,480000,0.9,-0.4]]},
  {vc:'MN',wegen:[['A2',128000,460000,0.25,-0.97],['A12',132000,452000,1,0.1],['A27',138000,446000,0.2,1]]},
  {vc:'NON',wegen:[['A28',186000,460000,0.6,0.8],['A7',210000,560000,1,0.05],['A35',236000,470000,0.85,-0.5]]},
  {vc:'ZN',wegen:[['A58',140000,392000,1,-0.1],['A67',150000,384000,0.95,0.3],['A73',184000,400000,0.15,-0.99]]}
];
const LENGTE=20;
const NAMEN=['Kethelplein','Vaanplein','Ridderkerk','Hoevelaken','Oudenrijn','Lunetten','Holendrecht','Coenplein','Ekkersweijer','Batadorp','De Hogt','Rijkevoort','Waterberg','Velperbroek','Hattemerbroek','Assen-Zuid','Lankhorst','Prins Clausplein','Benelux','Kleinpolderplein'];

function hmTekst(hm,d=3){return hm.toFixed(d).replace('.',',');}
function rd(weg,hm,richting){const [,x0,y0,dx,dy]=weg,n=Math.hypot(dx,dy),z=richting==='L'?18:-18;return {x:Math.round(x0+dx/n*hm*1000-dy/n*z),y:Math.round(y0+dy/n*hm*1000+dx/n*z)};}

/* Wegkenmerken: om de 5 km een aansluiting. De afrit ligt op x,0 (portalen tot 0,6 km
   ervoor zijn 'voor afrit'), de toerit op x,8 (portaal net erna 'voor toerit'). Bij
   hm 10 een knooppunt: splitsing en weefvak. */
function msiContext(hm,richting){
  const pos=richting==='R'?hm:LENGTE-hm,m=pos%5;
  if(pos>9.2&&pos<10)return 'laatste_portaal_voor_splitsing';
  if(pos>=10&&pos<11.2)return 'weefvak';
  if(m>=4.4&&m<5)return 'voor_afrit';
  if(m>=0.8&&m<1.4&&pos>1)return 'voor_toerit';
  return pos%1.8<0.6?'opvolgend':'rijbaanbreed';
}

export function maakDemoWerkruimte(nu=Date.now()){
  const r=rng(20261124),iso=ms=>new Date(ms).toISOString(),dag=864e5,uur=36e5;
  const assets=[],msi=[],lus=[],cam=[],drip=[];let n=0,dripNr=100;
  for(const {vc,wegen} of DEMO_NETWERK)for(const weg of wegen){
    const w=weg[0];
    for(const ri of ['R','L']){
      for(let hm=0.3;hm<LENGTE;hm+=0.6){
        for(let strook=1;strook<=3;strook++){
          const p=rd(weg,hm,ri),bouwjaar=[1997,2009,2011,2016,2021][Math.floor(r()*5)];
          const a={entityid:'S'+(++n),'ci-type':'VKS signaalgevers',asset:`MSI ${w} ${ri} ${hmTekst(hm)} ${strook}`,wegnummer:w.slice(1),'hm-bord':hmTekst(hm,2),baanpositie:ri,regio:vc,status:'Operationeel','rd-locatie-x':p.x,'rd-locatie-y':p.y,bouwjaar};
          assets.push(a);msi.push({a,vc,w,ri,hm,ctx:msiContext(hm,ri)});
        }
      }
      for(let hm=0.5;hm<LENGTE;hm+=1){
        for(let strook=1;strook<=2;strook++){const p=rd(weg,hm,ri),a={entityid:'L'+(++n),'ci-type':'VKS detectielussen',asset:`LUS ${w} ${ri} ${hmTekst(hm)} ${strook}`,wegnummer:w.slice(1),'hm-bord':hmTekst(hm,2),baanpositie:ri,regio:vc,status:'Operationeel','rd-locatie-x':p.x,'rd-locatie-y':p.y,bouwjaar:2012};assets.push(a);lus.push({a,vc,w,ri,hm});}
      }
      for(let hm=1;hm<LENGTE;hm+=1.5){const p=rd(weg,hm,ri),a={entityid:'C'+(++n),'ci-type':'VKS camera',asset:`CAM ${w} ${ri} ${hmTekst(hm)}`,wegnummer:w.slice(1),'hm-bord':hmTekst(hm,2),baanpositie:ri,regio:vc,status:'Operationeel','rd-locatie-x':p.x,'rd-locatie-y':p.y,bouwjaar:2015};assets.push(a);cam.push({a,vc,w,ri,hm});}
      for(const hm of [3.2,9.1,16.4]){const p=rd(weg,hm,ri),code='DBD'+(++dripNr),a={entityid:code,'ci-type':'OBJ Bijzondere borden-drips',asset:`${vc} DRIP ${w} ${ri==='R'?'RE':'LI'} ${hm.toFixed(3)} (${code})`,wegnummer:w.slice(1),'hm-bord':hmTekst(hm,2),baanpositie:ri,regio:vc,status:'Operationeel','rd-locatie-x':p.x,'rd-locatie-y':p.y,bouwjaar:2010};assets.push(a);drip.push({a,vc,w,ri,hm,code});}
    }
  }

  // Bestuurlijke context en contract per asset (regionale dienst, district, aannemer).
  for(const a of assets){const [rdNaam,districten,contract,aannemer]=ORGANISATIE[a.regio],tp=a.asset.slice(0,3)==='MSI'?'MSI':a.asset.slice(0,3)==='LUS'?'LUS':a.asset.slice(0,3)==='CAM'?'CAM':'DRIP';
    a['regionale dienst']=rdNaam;a.district=districten[Number(a.wegnummer)%2];a.contract=contract;a.aannemer=aannemer;a.leverancier=LEVERANCIER[tp];}
  drip.slice(0,6).forEach(x=>{x.a.windwaarschuwing='ja';});drip.slice(6,10).forEach(x=>{x.a.ria4='ja';});
  /* Storingen. Per VC een verschillend beeld: ZWN en NWN zwaar belast (een paar
     schakels ver onder de norm), MN en ZN gemiddeld, NON rustig. Een deel staat
     bewust vóór afritten en toeritten, zodat de locatieweging zichtbaar is. */
  const druk={ZWN:0.05,NWN:0.04,MN:0.025,ZN:0.02,NON:0.01};
  const peil=nu-15*60000,hist=[],live=[];let ev=0;
  const melding=(x,tp,code,tekst,van,open,extra={})=>{
    const id='DEMO-'+(++ev);
    return {event_id:id,vc:x.vc,weg:x.w,richting:x.ri,hm:Math.round(x.hm*1000)/1000,MSI:x.a.asset,asset:x.a.asset,van:iso(van),tot:open?iso(peil):iso(van+(2+r()*40)*uur),foutcode:code,melding:tekst,assetTypeHint:tp,status:open?'open':'gesloten',
      _liveOpen:open,eerste_gezien:iso(van),laatste_gezien:iso(open?peil:van+uur),bron_peildatum:iso(peil),levenscyclus_status:open?'OPEN_BEVESTIGD':'HERSTELD_BEVESTIGD',...extra};
  };
  // Zwakke schakels: de eerste 7 km van de eerste weg in ZWN en NWN, richting R.
  const zwak=x=>(x.vc==='ZWN'&&x.w==='A15'&&x.ri==='R'&&x.hm<7)||(x.vc==='NWN'&&x.w==='A10'&&x.ri==='L'&&x.hm>12);
  /* Open storingen lopen tot 30 dagen terug (meest recent), de historie is een half
     jaar met gemiddeld zo'n tien storingen per dag. */
  const openSinds=max=>peil-(1+Math.pow(r(),2)*max)*uur;
  const historisch=(x,tp,code,tekst,aantal,extra)=>{for(let k=0;k<aantal;k++)hist.push(melding(x,tp,code,tekst,nu-(1+r()*180)*dag,false,extra));};
  const poisson=l=>{let k=0,p=Math.exp(-l),t=r();while(t>p&&k<20){k++;t*=r();}return k;};
  for(const x of msi){
    const kans=druk[x.vc]*(zwak(x)?6:1)*(x.ctx==='voor_afrit'?1.8:1);
    if(r()<kans){const ernstig=r()<0.7;live.push(melding(x,'MSI',ernstig?'1003':'1001',ernstig?'Fatale fout':'Lampcircuit defect',openSinds(30*24),true,{msi_context:x.ctx}));}
    historisch(x,'MSI',r()<0.6?'1003':'1001','Historische storing',poisson(kans*12),{msi_context:x.ctx});
  }
  for(const x of lus){
    if(r()<druk[x.vc]*0.8)live.push(melding(x,'LUS','1006','Lus defect',openSinds(30*24),true));
    historisch(x,'LUS','1006','Historische lusstoring',poisson(druk[x.vc]*8));
  }
  for(const x of cam){
    if(r()<druk[x.vc]*0.9)live.push(melding(x,'CAM','2002','Camerabeeld weg',openSinds(10*24),true));
    historisch(x,'CAM','2002','Historische camerastoring',poisson(druk[x.vc]*14));
  }
  /* DRIP-storingen als DRIP-historie (episodes): enkele open, de rest hersteld. */
  const dripInc=[];
  for(const x of drip){
    const lab=`${x.vc} DRIP ${x.w} ${x.ri==='R'?'RE':'LI'} ${x.hm.toFixed(3)} (${x.code})`;
    const inc=(start,eind)=>({asset:lab,code:x.code,locatie:lab,vc:x.vc,weg:x.w,richting:x.ri==='R'?'RE':'LI',hm:x.hm,start,einde:eind,duurUren:eind==null?null:(eind-start)/uur,incidentvensterUren:null,cycli:1,classificatie:eind==null?'OPEN':'STORING',hardUit:false,censored:false,technischeToestand:eind==null?'open':'hersteld',bron:'Demo CDMS',conditie:eind==null?'URGENT':'URGENT/OK',eerste_gezien:iso(start),laatste_gezien:iso(eind??peil),bron_peildatum:iso(eind??peil),hersteld_op:eind==null?null:iso(eind)});
    if(r()<druk[x.vc]*2.5){const o=inc(openSinds(14*24),null),zwaar=r()<0.6;o.technischeToestand=zwaar?'gestopt':'gestopt in-bedrijf';o.classificatie=zwaar?'OPEN':'LANGDURIG';o.conditie=zwaar?'Contact met display verloren':'Kritische LED-fout';dripInc.push(o);}
    for(let k=poisson(druk[x.vc]*20);k>0;k--){const st=nu-(2+r()*180)*dag;dripInc.push(inc(st,st+(1+r()*30)*uur));}
  }
  const dekkingDatums=Array.from({length:181},(_,i)=>iso(nu-i*dag).slice(0,10)).reverse();
  hist.push(...live);

  // Netwerkschakelmatrix: per weg en richting twee schakels (0-10 en 10-20 km).
  const schakels=[];let ns=0;
  for(const {vc,wegen} of DEMO_NETWERK)for(const weg of wegen)for(const ri of ['R','L'])for(const [van,tot] of [[0,10],[10,LENGTE]]){
    ns++;const a=NAMEN[(ns*3)%NAMEN.length],b=NAMEN[(ns*7+5)%NAMEN.length];
    schakels.push({Code:`${vc}-${weg[0]}${ri}-${van?2:1}`,Verkeerscentrale:vc,Rijksweg:weg[0],Netwerkschakel:`${weg[0]} ${a} – ${b}`,'HMP van':ri==='R'?van:tot,'HMP tot':ri==='R'?tot:van,Zijde:ri,Status:'Gecontroleerd',Van:a,Tot:b});
  }

  /* Werkzaamheden: een deel vlak na open MSI-storingen (inleidend), een deel gepland
     verderop, en een paar elders. */
  const werk=[];let wn=0;
  const openMsi=live.filter(m=>m.assetTypeHint==='MSI');
  for(const m of openMsi.filter((_,i)=>i%9===0).slice(0,8)){
    const ri=m.richting,van=ri==='R'?m.hm+0.8:m.hm-1.6,tot=van+0.8,start=nu+(wn%3===0?-6*uur:(1+wn%6)*dag);
    werk.push({werk_id:'DEMO-W'+(++wn),weg:m.weg,richting:ri==='R'?'RE':'LI',van_hm:Math.max(0,van).toFixed(1),tot_hm:Math.max(0.5,tot).toFixed(1),start:iso(start),einde:iso(start+8*uur),hinder:wn%2?'hinderklasse 3, 10–30 min':'hinderklasse 2, tot 10 min',afsluiting:wn%2?'rijstrook dicht':'rijbaan dicht',werkzaamheden:'Onderhoud aan de verkeerssignalering',status:'definitief',traject:'Demo, '+m.vc});
  }
  for(const {vc,wegen} of DEMO_NETWERK)for(const weg of wegen.slice(1,2)){
    const start=nu+(3+wn)*dag;
    werk.push({werk_id:'DEMO-W'+(++wn),weg:weg[0],richting:'RE',van_hm:'12.0',tot_hm:'13.5',start:iso(start),einde:iso(start+3*dag),hinder:'hinderklasse 1, tot 10 min',afsluiting:'versmalde rijstroken',werkzaamheden:'Asfaltonderhoud',status:'gepubliceerd',traject:'Demo, '+vc});
  }
  const uRoutes=DEMO_NETWERK.flatMap(({vc,wegen},i)=>wegen.slice(0,2).map((weg,j)=>({route_id:`DEMO-U${i}${j}`,u_route:'U'+(10+i*3+j),hoofdweg:weg[0],richting:'RE',van_hm:'4.0',tot_hm:'9.0',route_naam:`Omleiding ${weg[0]} ${NAMEN[(i*5+j)%NAMEN.length]}`,vc,regio:vc,opmerking:'Gesimuleerde omleidingsroute'})));

  const vcs=Object.fromEntries(DEMO_NETWERK.map(({vc})=>[vc.toLowerCase(),peil]));
  /* NDW-meting (gesimuleerd): om de kilometer een meetpunt per weg en richting, zodat
     de verkeerskosten berekenbaar zijn. Zelfde peildag als de storingen. */
  const sites=[];
  for(const {wegen} of DEMO_NETWERK)for(const weg of wegen)for(const ri of ['RE','LI'])for(let hm=0.4;hm<LENGTE;hm+=1){
    const lanes=[0,1,2].map(i=>({q:Math.round((900+r()*700)*(i===0?1.15:1))}));
    sites.push({id:`DEMO_${weg[0]}_${ri}_${hm.toFixed(1)}`,version:'1',name:`${weg[0]} ${ri} hm ${hmTekst(hm,1)}`,time:iso(peil),road:weg[0],direction:ri,hm:Math.round(hm*10)/10,q:lanes.reduce((t,l)=>t+l.q,0),period:60,speed:Math.round(85+r()*25),lanes,issues:[],locationMethod:'Demo'});
  }
  const ndw69Snapshot={schema:1,publication:iso(peil),configurationPublication:iso(peil),files:['demo-ndw-meting.xml'],sha256:[],stats:{sites:sites.length,validSites:sites.length,speedSites:sites.length,locationSites:sites.length},sites};
  const dvm={formaat:'DVM-dienstimpact-totaal',versie:54,
    assetregister:{bestand:'Demo assetregister (gesimuleerd)',rijen:assets},
    netwerkschakels:{bestand:'Demo netwerkschakelmatrix',rijen:schakels},
    liveStoringen:[{key:'signaalgever-totaal-open',naam:'Demo open storingen',_signaalgeverTotaal:true,rijen:live,peildatum:peil}],
    storingshistorie:[{key:'signaalgever-totaal-historie',naam:'Demo storingshistorie',_signaalgeverTotaal:true,rijen:hist}],
    werkzaamheden:{bestand:'Demo werkzaamheden',rijen:werk},
    uRoutes:{bestand:'Demo U-routes',rijen:uRoutes},
    dripHistorie:{incidenten:[],sources:[{key:'demo-drip',name:'Demo DRIP-storingen (gesimuleerd)',incidenten:dripInc,herstelmeldingen:[],dekkingDatums}]},
    /* Bronbevestiging: de gesimuleerde storingsbron is per type volledig, zodat de
       dienstbanden exact worden. Plus de NDW-meting voor de verkeerskosten. */
    parameters:{cfg:{liveDekking:{MSI:true,LUS:true,CAM:true,DRIP:true,WISSELBORD:true,COMM:true}},kosten:{ndw69Snapshot,overlapBevestigd:true}},
    bronbeheer:{signaalgeverTotaal:{laatstePerVc:vcs,snapshotDekking:{},open:live.length,historie:hist.length}}};

  /* BI: bedienketen-assets en bedrijfsfuncties met benodigd en actueel FTE. */
  const biAssets=[
    ['bi-sig','Verkeerssignalering (MSI)','signalering','DVM',4,3,0,99.1,420000],['bi-det','Detectie (lussen en meetvakken)','detectie','DVM',3,3,6,98.6,260000],
    ['bi-cam','Camera’s (CCTV)','camera','DVM',4,2,0,99.3,180000],['bi-drip','DRIP’s','drip','Facilitair',2,4,12,97.9,150000],
    ['bi-bed','Bediensysteem (MTM/FEP)','bediensysteem','Productieplatform',5,2,0,99.7,350000],['bi-com','Communicatienetwerk','communicatie','DVM',4,3,3,99.4,210000],
    ['bi-tti','Tunnelinstallatie Maastunnel','tunnelbuis','Tunnel/TTI',5,3,0,99.6,520000],['bi-vri','VRI’s aansluitingen','vri','DVM',3,4,9,98.2,90000],
    ['bi-dyn','Spitsstroken A12 (dynamisch)','dynamische_strook','DVM',4,3,0,98.9,160000],['bi-tw','Tekstwagens (pool)','tekstwagen','Facilitair',1,3,0,97.5,40000],
    ['bi-slag','Slagbomen spitsstroken','slagboom','DVM',4,3,3,98.8,70000],['bi-brug','Beweegbare brug Hollandse IJssel','brug','DVM',4,3,0,99.2,110000],
    ['bi-trd','Toeritdoseerinstallaties','toeritdosering','DVM',2,4,6,98.1,60000],['bi-cal','Calamiteitenknoppen tunnel','calamiteitenknop','Tunnel/TTI',5,2,0,99.8,30000],
    ['bi-glad','Gladheidsmeldsysteem','gladheidsysteem','DVM',2,3,0,98.7,45000],['bi-trans','Transmissie en koppelvlakken','transmissie','Productieplatform',4,2,0,99.5,95000]
  ].map(([id,naam,type,cmdb,fw,conditie,uitstelMnd,besch,onderhoudEur])=>({id,naam,type,cmdb,fw,conditie,uitstelMnd,besch,onderhoudEur,redundant:type==='bediensysteem',locatie:type==='tunnelbuis'?'Maastunnel':'Landelijk',weging:fw>=5?1.5:fw>=4?1.2:1,storingenJr:Math.round((100-besch)*12),aantal:1}));
  const functies=[
    {id:'f-sturen',naam:'Sturen en geleiden van verkeer',doel:'Vlot en veilig verkeer',systemen:['MTM','FEP'],benodigdFte:62,actueelFte:57.5,assets:['bi-sig','bi-det','bi-bed','bi-com'],onderhoudEur:950000,richtlijnen:['atw','babw']},
    {id:'f-im',naam:'Incidentmanagement',doel:'Snel herstel bij incidenten',systemen:['CCTV','Meldkamer'],benodigdFte:38,actueelFte:36,assets:['bi-cam','bi-sig','bi-com'],onderhoudEur:420000,richtlijnen:['atw']},
    {id:'f-reis',naam:'Reis- en netwerksturing',doel:'Betrouwbare reistijd',systemen:['DRIP','NDW'],benodigdFte:14,actueelFte:12,assets:['bi-drip','bi-det'],onderhoudEur:240000,richtlijnen:['babw']},
    {id:'f-wiu',naam:'Ondersteunen bij werk in uitvoering',doel:'Veilig werkvak',systemen:['MTM','WIU-planning'],benodigdFte:9,actueelFte:9,assets:['bi-sig','bi-cam'],onderhoudEur:120000,richtlijnen:['atw','babw']},
    {id:'f-tunnel',naam:'Tunnelbediening',doel:'Veilige tunnel',systemen:['TTI'],benodigdFte:11,actueelFte:10,assets:['bi-tti','bi-bed'],onderhoudEur:520000,richtlijnen:['warvw']}
  ];
  const bi={meta:{versie:'3.0',peildatum:iso(nu).slice(0,10),demo:true},params:{kostenIndex:1.00},
    richtlijnen:[{id:'atw',naam:'ATW',oms:'Arbeidstijdenwet, diensturen en rusttijden wegverkeersleiders'},{id:'warvw',naam:'Warvw/Rarvw',oms:'Tunnelwetgeving, verplichte bediening en beschikbaarheid TTI'},{id:'babw',naam:'BABW',oms:'Besluit administratieve bepalingen wegverkeer, maatregelen op de weg'}],
    assets:biAssets,functies,financien:{budgetJr:2400000},
    cap:{GPO:8,CIV:5,VWM:25,PPO:4,Regio:3}};

  /* Planning (Microsoft Project XML). Twee projecten met VWM-fasen als samenvattings-
     taken, zodat het VWM-formatiemodel de FTE per fase en rol toepast. */
  const d=n=>new Date(nu+n*dag).toISOString().slice(0,10);
  let uid=0;const T=[];
  const taak=(naam,niveau,start,eind,{samenvatting=false,mijlpaal=false}={})=>{uid++;T.push(`<Task><UID>${uid}</UID><ID>${uid}</ID><Name>${naam}</Name><OutlineLevel>${niveau}</OutlineLevel><Start>${start}T08:00:00</Start><Finish>${eind}T17:00:00</Finish><Summary>${samenvatting?1:0}</Summary><Milestone>${mijlpaal?1:0}</Milestone></Task>`);};
  const project=(naam,fasen,start)=>{
    const eind=start+fasen.reduce((t,f)=>t+f[1],0);taak(naam,1,d(start),d(eind),{samenvatting:true});let t=start;
    for(const [fase,duur,mijl] of fasen){taak(fase,2,d(t),d(t+duur),{samenvatting:true});taak(`${fase}: uitvoeren`,3,d(t),d(t+duur-1));if(mijl)taak(mijl,3,d(t+duur),d(t+duur),{mijlpaal:true});t+=duur;}
  };
  project('A15 Vervanging signalering Vaanplein',[['Contractvoorbereiding',90,'Contract getekend'],['Aanbesteding',60,'Gunning'],['Uitvoeringsontwerp',75,null],['Installatie, Sitetesten en Systeemintegratie',120,'Start sitetesten'],['Openstelling',20,'Ingebruikname signalering'],['Nazorg',60,null]],-70);
  project('A12 Camera-upgrade Oudenrijn',[['Planuitwerking/Planfase',40,null],['Definitief ontwerp',50,'DO vastgesteld'],['Bouw en Fabriekstesten',80,'FAT geslaagd'],['Installatie, Sitetesten en Systeemintegratie',70,null],['Openstelling',15,'Camera’s in gebruik']],-20);
  project('A28 Renovatie DRIP’s Hattemerbroek',[['Contractvoorbereiding',45,null],['Aanbesteding',40,'Opdracht verstrekt'],['Uitvoeringsontwerp',30,null],['Installatie, Sitetesten en Systeemintegratie',35,'DRIP’s vervangen']],25);
  const xml=`<?xml version="1.0"?><Project xmlns="http://schemas.microsoft.com/project"><Title>Demo integrale planning WVM</Title><Tasks>${T.join('')}</Tasks></Project>`;

  /* Operationele formatie per VC: uitgangspunt, beschikbaar en posities per rol. */
  const f=(u,b,p)=>({uitgangspunt:u,beschikbaar:b,posities:p});
  const opFormatie={schema:1,bijgewerkt:iso(nu),methode:'ingenieursbureau',norm:98,verdeling:'signaalgevers',ftePerPositie:5.5,maxExtraPct:100,
    rollen:[{id:'wvl',naam:'Wegverkeersleider',gevoeligheid:4,koppeling:'bediening'},{id:'cwvl',naam:'Coördinerend wegverkeersleider',gevoeligheid:1.5,koppeling:'bediening'},{id:'ovd',naam:'Officier van dienst (weginspectie)',gevoeligheid:1,koppeling:'inspectie'},{id:'wi',naam:'Weginspecteur',gevoeligheid:3,koppeling:'inspectie'}],
    vcs:{ZWN:{wvl:f(70,66,11),cwvl:f(11,11,2),ovd:f(6,5.5,1),wi:f(42,40,null)},NWN:{wvl:f(60,61,10),cwvl:f(10,9,2),ovd:f(6,6,1),wi:f(36,33,null)},MN:{wvl:f(40,44,7),cwvl:f(7,8,1),ovd:f(5,6,1),wi:f(28,31,null)},
      ZN:{wvl:f(40,38,7),cwvl:f(7,7,1),ovd:f(5,5,1),wi:f(26,27,null)},NON:{wvl:f(35,38,6),cwvl:f(6,7,1),ovd:f(5,6,1),wi:f(24,27,null)}}};

  // Dienstkoppelingen: welke DVM-dienst bij welke bedrijfsfunctie hoort, met eigenaar.
  const links=[{dienst:'vm',functie:'f-sturen',eigenaar:'Afdelingshoofd verkeersmanagement'},{dienst:'im',functie:'f-im',eigenaar:'Coördinator incidentmanagement'},{dienst:'rri',functie:'f-reis',eigenaar:'Teamleider reis- en netwerksturing'},{dienst:'wiu',functie:'f-wiu',eigenaar:'Coördinator werk in uitvoering'}];
  return {dvm,bi,links,planning:{name:'demo-planning.xml',xml,state:null},opFormatie,
    telling:{dripIncidenten:dripInc.length,dripOpen:dripInc.filter(x=>x.einde==null).length,assets:assets.length,msi:msi.length,lus:lus.length,cam:cam.length,drip:drip.length,open:live.length,historie:hist.length,schakels:schakels.length,werk:werk.length,uRoutes:uRoutes.length}};
}
