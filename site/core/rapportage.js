/* Managementrapportage-builder (2.97 / DVM 170).

   Stelt uit de bestaande samenvattingen een managementrapportage op voor lezers zonder
   technische achtergrond. Elk hoofdstuk heeft dezelfde opbouw:
   kernboodschap -> toelichting in gewone taal -> figuur, tabel of schema -> wat betekent
   dit -> aanbeveling. Er wordt niets nieuws berekend: alle getallen komen uit het
   overzichtsmodel, de operationele formatie, de rekenmethode van het ingenieursbureau,
   de planning, de signalen en de kwaliteitsaudit. Ontbreekt een bron, dan zegt de tekst
   dat eerlijk ("nog niet bekend") in plaats van een nul te tonen.

   Taal: korte zinnen, geen afkortingen zonder uitleg, technische termen vertaald naar
   wat ze voor de weggebruiker en de organisatie betekenen. Grafieken: inline SVG zonder
   inline stijl (CSP), dunne markeringen, directe labels, één as, een tabel ernaast. */

export const RAPPORT_ONDERDELEN=[
  {id:'samenvatting',titel:'Managementsamenvatting',uitleg:'De belangrijkste conclusies op één pagina, met een stoplicht per thema en de keten van storing tot gevolg.',vast:true},
  {id:'storingen',titel:'Storingsbeeld en ontwikkeling',uitleg:'Hoeveel installaties langs de weg zijn verstoord, waar, en hoe dat zich ontwikkelt.'},
  {id:'diensten',titel:'Dienstverlening aan de weggebruiker',uitleg:'Of de vier diensten hun afgesproken niveau halen.'},
  {id:'netwerk',titel:'Netwerk en maatschappelijke kosten',uitleg:'Welke wegvakken het meest geraakt zijn en wat vertraging de samenleving kost.'},
  {id:'werk',titel:'Werkzaamheden en uitvoerbaarheid',uitleg:'Of geplande werkzaamheden veilig kunnen worden uitgevoerd.'},
  {id:'formatie',titel:'Formatie en bezetting',uitleg:'Of er genoeg mensen zijn voor de huidige storingsdruk.'},
  {id:'gevolgen',titel:'Operationele gevolgen',uitleg:'Gevolgen voor incidentafhandeling, weginspectie en kosten (rekenmethode ingenieursbureau).'},
  {id:'planning',titel:'Projecten en mijlpalen',uitleg:'Komende mijlpalen en de capaciteitsvraag uit de projectplanning.'},
  {id:'risicos',titel:'Risico’s en besluitpunten',uitleg:'Wat aandacht of een besluit van het management vraagt.'},
  {id:'betrouwbaarheid',titel:'Betrouwbaarheid van de informatie',uitleg:'Hoe zeker de cijfers zijn en waar de informatie nog tekortschiet.'},
  {id:'begrippen',titel:'Begrippenlijst',uitleg:'Uitleg van de gebruikte begrippen.'}
];

export function standaardRapportInstelling(){
  return {titel:'Managementrapportage verkeersmanagement',ontvanger:'Managementteam',auteur:'Business Intelligence Dashboard',scope:'',
    onderdelen:RAPPORT_ONDERDELEN.map(o=>o.id),grafieken:true,tabellen:true,schemas:true};
}

/* Kleuren: categorisch (gevalideerd, 4 diensten), één reeks, status met label. */
const SERIE=['#2a78d6','#eb6834','#1baf7a','#eda100'];
const EEN='#0f9d78',ZACHT='#bfe3d6';
const STATUS={goed:{kleur:'#0ca30c',icoon:'●',label:'Op orde'},let:{kleur:'#fab219',icoon:'▲',label:'Aandacht'},ernstig:{kleur:'#ec835a',icoon:'◆',label:'Zorgelijk'},kritiek:{kleur:'#d03b3b',icoon:'■',label:'Kritiek'},onbekend:{kleur:'#9aa5ae',icoon:'○',label:'Nog niet bekend'}};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=new Map();
const g=(n,d=0)=>{if(n==null||!Number.isFinite(Number(n)))return '–';if(!nf.has(d))nf.set(d,new Intl.NumberFormat('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d}));return nf.get(d).format(Number(n));};
const pct=(n,d=1)=>n==null||!Number.isFinite(Number(n))?'–':g(n,d)+'%';
const euro=n=>n==null||!Number.isFinite(Number(n))?'nog niet bekend':new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(n);
const datumLang=iso=>{if(!iso)return 'onbekend';const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleDateString('nl-NL',{day:'numeric',month:'long',year:'numeric'}):String(iso);};
const meervoud=(n,een,meer)=>`${g(n)} ${Number(n)===1?een:meer}`;
const TYPE_TAAL={MSI:'signaalgevers boven de weg (matrixborden)',LUS:'detectielussen (verkeersmeting in het wegdek)',CAM:'camera’s',DRIP:'informatiepanelen langs de weg (DRIP’s)',WISSELBORD:'wisselborden',SYSTEEM:'centrale systemen',COMM:'communicatieverbindingen',OVERIG:'overige installaties'};
const DIENST_TAAL={im:'snel en veilig afhandelen van ongevallen en pech',vm:'het verkeer sturen en waarschuwen met de borden boven de weg',rri:'weggebruikers informeren over reistijd en routes',wiu:'werkzaamheden aan de weg veilig mogelijk maken'};

/* ---------- grafieken (SVG) ---------- */
function hbar(rijen,{max,eenheid='',norm=null,labelBreedte=170,kleur=EEN,titel=''}={}){
  if(!rijen.length)return '';
  const W=640,rh=26,h=rijen.length*rh+(norm!=null?22:8),x0=labelBreedte,bw=W-x0-70,m=max??Math.max(1,...rijen.map(r=>r.waarde||0));
  const sx=v=>x0+Math.max(0,Math.min(1,(v||0)/m))*bw;
  const balk=(r,i)=>{const y=i*rh+4,w=Math.max(2,sx(r.waarde)-x0);return `<g><title>${esc(r.label)}: ${esc(r.tekst??g(r.waarde))}${eenheid}</title><text x="${x0-8}" y="${y+13}" text-anchor="end" class="rap-svg-label">${esc(r.label)}</text><rect x="${x0}" y="${y}" width="${bw}" height="16" rx="4" class="rap-svg-track"/><rect x="${x0}" y="${y}" width="${w.toFixed(1)}" height="16" rx="4" fill="${r.kleur||kleur}"/><text x="${(x0+w+6).toFixed(1)}" y="${y+13}" class="rap-svg-waarde">${esc(r.tekst??g(r.waarde))}${esc(eenheid)}</text></g>`;};
  const normLijn=norm!=null?`<line x1="${sx(norm).toFixed(1)}" x2="${sx(norm).toFixed(1)}" y1="0" y2="${rijen.length*rh+4}" class="rap-svg-norm"/><text x="${sx(norm).toFixed(1)}" y="${rijen.length*rh+18}" text-anchor="middle" class="rap-svg-as">norm ${esc(g(norm,1))}${esc(eenheid)}</text>`:'';
  return `<svg viewBox="0 0 ${W} ${h}" class="rap-svg" role="img" aria-label="${esc(titel)}">${rijen.map(balk).join('')}${normLijn}</svg>`;
}
function lijn(punten,{titel='',eenheid=''}={}){
  if(punten.length<2)return '';
  const W=640,H=200,l=44,r=16,t=14,b=28,max=Math.max(1,...punten.map(p=>p.waarde)),stap=Math.pow(10,Math.floor(Math.log10(max))),top=Math.ceil(max/stap)*stap;
  const sx=i=>l+i*(W-l-r)/(punten.length-1),sy=v=>t+(1-v/top)*(H-t-b);
  const d=punten.map((p,i)=>`${i?'L':'M'}${sx(i).toFixed(1)},${sy(p.waarde).toFixed(1)}`).join(''),vlak=`${d}L${sx(punten.length-1).toFixed(1)},${sy(0)}L${sx(0)},${sy(0)}Z`;
  const grid=[0,0.5,1].map(f=>`<line x1="${l}" x2="${W-r}" y1="${sy(top*f).toFixed(1)}" y2="${sy(top*f).toFixed(1)}" class="rap-svg-grid"/><text x="${l-6}" y="${(sy(top*f)+4).toFixed(1)}" text-anchor="end" class="rap-svg-as">${g(top*f)}</text>`).join('');
  const labels=[0,Math.floor((punten.length-1)/2),punten.length-1].map(i=>`<text x="${sx(i).toFixed(1)}" y="${H-8}" text-anchor="${i===0?'start':i===punten.length-1?'end':'middle'}" class="rap-svg-as">${esc(punten[i].label)}</text>`).join('');
  const hits=punten.map((p,i)=>`<circle cx="${sx(i).toFixed(1)}" cy="${sy(p.waarde).toFixed(1)}" r="6" class="rap-svg-hit"><title>${esc(p.label)}: ${g(p.waarde)}${esc(eenheid)}</title></circle>`).join('');
  const laatste=punten[punten.length-1];
  return `<svg viewBox="0 0 ${W} ${H}" class="rap-svg" role="img" aria-label="${esc(titel)}">${grid}<path d="${vlak}" fill="${EEN}" fill-opacity=".12"/><path d="${d}" fill="none" stroke="${EEN}" stroke-width="2"/><circle cx="${sx(punten.length-1).toFixed(1)}" cy="${sy(laatste.waarde).toFixed(1)}" r="4" fill="${EEN}" stroke="#fff" stroke-width="2"/>${labels}${hits}</svg>`;
}
/* Kogelgrafiek per dienst: balk = beschikbaarheid (of onzekerheidsband), streep = norm. */
function kogel(diensten){
  if(!diensten.length)return '';
  const W=640,rh=34,x0=230,bw=W-x0-80,lo=90,sx=v=>x0+Math.max(0,Math.min(1,(v-lo)/(100-lo)))*bw;
  const rij=(d,i)=>{const y=i*rh+6,kleur=SERIE[i%SERIE.length],waarde=d.besch??d.lo,band=d.besch==null&&Number.isFinite(d.lo)&&Number.isFinite(d.hi);
    return `<g><title>${esc(d.naam)}: ${d.besch!=null?pct(d.besch,2):band?`${pct(d.lo,1)} tot ${pct(d.hi,1)}`:'onbekend'}, norm ${pct(d.norm,1)}</title><text x="${x0-8}" y="${y+14}" text-anchor="end" class="rap-svg-label">${esc(d.naam)}</text><rect x="${x0}" y="${y}" width="${bw}" height="18" rx="4" class="rap-svg-track"/>${band?`<rect x="${sx(d.lo).toFixed(1)}" y="${y}" width="${Math.max(2,sx(d.hi)-sx(d.lo)).toFixed(1)}" height="18" rx="4" fill="${kleur}" fill-opacity=".35"/>`:''}${Number.isFinite(waarde)&&!band?`<rect x="${x0}" y="${y}" width="${Math.max(2,sx(waarde)-x0).toFixed(1)}" height="18" rx="4" fill="${kleur}"/>`:''}<line x1="${sx(d.norm).toFixed(1)}" x2="${sx(d.norm).toFixed(1)}" y1="${y-3}" y2="${y+21}" class="rap-svg-normdik"/><text x="${W-74}" y="${y+14}" class="rap-svg-waarde">${d.besch!=null?pct(d.besch,2):band?`${g(d.lo,1)}–${pct(d.hi,1)}`:'onbekend'}</text></g>`;};
  const as=[90,95,100].map(v=>`<text x="${sx(v).toFixed(1)}" y="${diensten.length*rh+20}" text-anchor="middle" class="rap-svg-as">${v}%</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${diensten.length*rh+26}" class="rap-svg" role="img" aria-label="Beschikbaarheid per dienst ten opzichte van de norm">${diensten.map(rij).join('')}${as}</svg>`;
}
/* Gegroepeerde balken: beschikbaar en benodigd per VC (zelfde eenheid, één as). */
function groepBalk(rijen){
  if(!rijen.length)return '';
  const W=640,rh=40,x0=70,bw=W-x0-90,m=Math.max(1,...rijen.flatMap(r=>[r.beschikbaar||0,r.benodigd||0])),sx=v=>Math.max(2,(v||0)/m*bw);
  const rij=(r,i)=>{const y=i*rh+20;return `<g><title>VC ${esc(r.vc)}: beschikbaar ${g(r.beschikbaar,1)} FTE, benodigd ${g(r.benodigd,1)} FTE</title><text x="${x0-8}" y="${y+14}" text-anchor="end" class="rap-svg-label">${esc(r.vc)}</text><rect x="${x0}" y="${y}" width="${sx(r.beschikbaar).toFixed(1)}" height="12" rx="3" fill="${SERIE[0]}"/><rect x="${x0}" y="${y+14}" width="${sx(r.benodigd).toFixed(1)}" height="12" rx="3" fill="${SERIE[1]}"/><text x="${(x0+sx(r.beschikbaar)+6).toFixed(1)}" y="${y+10}" class="rap-svg-waarde">${g(r.beschikbaar,1)}</text><text x="${(x0+sx(r.benodigd)+6).toFixed(1)}" y="${y+24}" class="rap-svg-waarde">${g(r.benodigd,1)}</text></g>`;};
  const legenda=`<g><rect x="${x0}" y="2" width="10" height="10" rx="2" fill="${SERIE[0]}"/><text x="${x0+15}" y="11" class="rap-svg-as">beschikbaar</text><rect x="${x0+100}" y="2" width="10" height="10" rx="2" fill="${SERIE[1]}"/><text x="${x0+115}" y="11" class="rap-svg-as">benodigd bij huidige storingsdruk</text></g>`;
  return `<svg viewBox="0 0 ${W} ${rijen.length*rh+26}" class="rap-svg" role="img" aria-label="Beschikbare en benodigde formatie per verkeerscentrale">${legenda}${rijen.map(rij).join('')}</svg>`;
}
/* Ketenschema: van storing tot gevolg. */
function keten(stappen){
  const W=660,bx=118,gap=17,h=96;
  const vak=(s,i)=>{const x=i*(bx+gap),st=STATUS[s.status]||STATUS.onbekend;return `<g><title>${esc(s.titel)}: ${esc(s.waarde)}</title><rect x="${x}" y="8" width="${bx}" height="${h-16}" rx="10" class="rap-svg-vak"/><rect x="${x}" y="8" width="${bx}" height="5" rx="2" fill="${st.kleur}"/><text x="${x+bx/2}" y="34" text-anchor="middle" class="rap-svg-vaktitel">${esc(s.titel)}</text><text x="${x+bx/2}" y="58" text-anchor="middle" class="rap-svg-vakwaarde">${esc(s.waarde)}</text><text x="${x+bx/2}" y="76" text-anchor="middle" class="rap-svg-as">${esc(s.sub||'')}</text>${i<stappen.length-1?`<path d="M${x+bx+3},${h/2} l${gap-8},0 m-5,-4 l5,4 l-5,4" class="rap-svg-pijl"/>`:''}</g>`;};
  return `<svg viewBox="0 0 ${W} ${h}" class="rap-svg rap-keten" role="img" aria-label="Keten van storing tot gevolg">${stappen.map(vak).join('')}</svg>`;
}
/* Tijdlijn van mijlpalen. */
function tijdlijn(mijlpalen){
  if(!mijlpalen.length)return '';
  const W=640,H=40+mijlpalen.length*24,max=Math.max(30,...mijlpalen.map(m=>m.dagen)),sx=d=>40+d/max*(W-200);
  const as=`<line x1="40" x2="${W-160}" y1="22" y2="22" class="rap-svg-grid"/><text x="40" y="14" class="rap-svg-as">vandaag</text><text x="${W-160}" y="14" text-anchor="end" class="rap-svg-as">over ${g(max)} dagen</text>`;
  const punt=(m,i)=>{const x=sx(m.dagen),y=40+i*24,links=x>W*0.55;return `<g><title>${esc(m.naam)}: ${esc(datumLang(m.datum))}</title><line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="22" y2="${y}" class="rap-svg-grid"/><circle cx="${x.toFixed(1)}" cy="${y}" r="5" fill="${EEN}"/><text x="${(links?x-10:x+10).toFixed(1)}" y="${y+4}" text-anchor="${links?'end':'start'}" class="rap-svg-label">${esc(m.naam)} · ${esc(datumLang(m.datum))}</text></g>`;};
  return `<svg viewBox="0 0 ${W} ${H}" class="rap-svg" role="img" aria-label="Tijdlijn komende mijlpalen">${as}${mijlpalen.map(punt).join('')}</svg>`;
}

/* ---------- bouwstenen ---------- */
const tabel=(koppen,rijen,{rechts=[]}={})=>rijen.length?`<table class="rap-tabel"><thead><tr>${koppen.map((k,i)=>`<th${rechts.includes(i)?' class="rap-r"':''}>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rijen.map(r=>`<tr>${r.map((c,i)=>`<td${rechts.includes(i)?' class="rap-r"':''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`:'';
const status=s=>{const x=STATUS[s]||STATUS.onbekend;return `<span class="rap-status rap-status-${esc(s||'onbekend')}"><span aria-hidden="true">${x.icoon}</span> ${esc(x.label)}</span>`;};
const figuur=(nr,titel,svg,bron)=>svg?`<figure class="rap-figuur"><figcaption><b>Figuur ${nr}.</b> ${esc(titel)}</figcaption>${svg}${bron?`<p class="rap-bron">Bron: ${esc(bron)}</p>`:''}</figure>`:'';
const tabelBlok=(nr,titel,html)=>html?`<div class="rap-tabelblok"><p class="rap-tabeltitel"><b>Tabel ${nr}.</b> ${esc(titel)}</p>${html}</div>`:'';
const p=t=>t?`<p>${t}</p>`:'';
const kader=(soort,titel,tekst)=>tekst?`<div class="rap-kader rap-kader-${soort}"><b>${esc(titel)}</b>${Array.isArray(tekst)?`<ul>${tekst.map(t=>`<li>${t}</li>`).join('')}</ul>`:`<p>${tekst}</p>`}</div>`:'';

/* ---------- model ---------- */
export function rapportModel({overzicht=null,opFormatie=null,meldingen=[],signalen=[],kwaliteit=null,expert=[],dvm=null,nu=Date.now()}={},instelling={}){
  const s={...standaardRapportInstelling(),...instelling},m=overzicht||{},vc=s.scope||'';
  const inScope=x=>!vc||String(x?.vc||'').toUpperCase()===vc;
  const melding=meldingen.filter(inScope);
  const perType=new Map();for(const f of melding){const k=TYPE_TAAL[f.typeId]?f.typeId:'OVERIG';const r=perType.get(k)||{n:0,onzeker:0};r.n++;if(f.levenscyclus_status&&f.levenscyclus_status!=='OPEN_BEVESTIGD')r.onzeker++;perType.set(k,r);}
  const verloop=(m.verloop||[]).map(d=>({label:datumKort(d.dag),waarde:Number(d.nieuw)||0}));
  const week=(a,b)=>verloop.slice(a,b).reduce((t,x)=>t+x.waarde,0);
  const recent=week(-7),vorige=week(-14,-7);
  const diensten=(m.diensten||[]).filter(d=>d.oordeel!=='uitgesloten');
  const net=m.netwerk,laagste=(net?.laagste||[]).filter(inScope);
  const roads=(dvm?.roads||[]).filter(inScope).filter(r=>Number.isFinite(r.kosten)).sort((a,b)=>b.kosten-a.kosten);
  const kosten=vc?roads.reduce((t,r)=>t+r.kosten,0):m.kosten;
  const wi=m.werkImpact;
  const op=opFormatie,vcs=(op?.perVc||[]).filter(v=>v.ingevuld&&(!vc||v.vc===vc));
  const gevolgen=(op?.perVc||[]).filter(v=>v.ingenieur&&(!vc||v.vc===vc));
  const po=m.planOverzicht;
  const sig=signalen.slice().sort((a,b)=>sevRang(a.sev)-sevRang(b.sev));
  return {s,vc,nu,peildatum:m.peildatum,open:melding.length,onzeker:melding.filter(f=>f.levenscyclus_status&&f.levenscyclus_status!=='OPEN_BEVESTIGD').length,
    nietDoorgerekend:vc?melding.filter(f=>(f.rekenStatus||'Doorgerekend')!=='Doorgerekend').length:m.nietDoorgerekend,
    typen:[...perType].map(([k,r])=>({id:k,label:TYPE_TAAL[k],...r})).sort((a,b)=>b.n-a.n),vcsStoring:(m.vcs||[]).filter(x=>!vc||x.vc===vc),
    verloop,recent,vorige,diensten,net,laagste,roads,kosten,kostenBekend:vc?roads.length:m.kostenBekend,kostenTotaal:m.kostenTotaal,
    wi,op,vcs,gevolgen,po,signalen:sig,kwaliteit,expert:expert||[],dekking:m.dekking};
}
/* Signalen komen deels uit regels met technische verwijzingen. Voor het management
   vallen die weg: verwijzingen tussen haakjes met codes, CMDB-labels en wegingen. */
export function schoneTaal(t,max=170){
  let s=String(t||'').replace(/\([^()]*[._=×][^()]*\)/g,'').replace(/\bCMDB\s+[\w/]+\.?/g,'').replace(/\s*·\s*locatie[^·.]*/gi,'').replace(/\(weging[^)]*\)/gi,'').replace(/\s+([.,;:])/g,'$1').replace(/(\s*·\s*)+(?=$|[.,;])/g,'').replace(/\s*·\s*·/g,' ·').replace(/\s{2,}/g,' ').trim();
  if(s.length>max)s=s.slice(0,max).replace(/\s+\S*$/,'')+' …';
  return s;
}
const sevRang=s=>({rood:0,r:0,kritiek:0,oranje:1,o:1,hoog:1,geel:2}[String(s||'').toLowerCase()]??3);
function datumKort(dag){const [j,mm,d]=String(dag||'').split('-').map(Number);return d&&mm?`${d} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][mm-1]}`:String(dag||'');}

/* ---------- hoofdstukken ---------- */
function themaStatus(r){
  const d=r.diensten,onder=d.filter(x=>x.oordeel==='onder').length,onzeker=d.filter(x=>x.oordeel==='onzeker'||x.oordeel==='onbekend').length;
  const tekortVc=r.vcs.filter(v=>v.tekortRollen||v.bezettingTekort).length;
  return [
    {thema:'Storingen',status:!r.open&&r.open!==0?'onbekend':r.recent>r.vorige*1.2?'ernstig':r.recent>r.vorige?'let':'goed',duiding:r.verloop.length?`${meervoud(r.open,'installatie','installaties')} verstoord; ${r.recent>r.vorige?'meer':'minder of evenveel'} nieuwe storingen dan een week eerder.`:`${meervoud(r.open,'installatie','installaties')} verstoord.`},
    {thema:'Dienstverlening',status:!d.length?'onbekend':onder>=2?'kritiek':onder===1?'ernstig':onzeker?'let':'goed',duiding:d.length?`${g(d.length-onder-onzeker)} van ${g(d.length)} diensten aantoonbaar op niveau; ${g(onder)} onder de afgesproken norm${onzeker?`, ${g(onzeker)} nog onzeker`:''}.`:'Nog geen storingsbron geladen.'},
    {thema:'Netwerk',status:!r.net?'onbekend':r.net.onderNorm>r.net.geraakt/2?'ernstig':r.net.onderNorm?'let':'goed',duiding:r.net?`${meervoud(r.net.geraakt,'wegvak','wegvakken')} geraakt, waarvan ${g(r.net.onderNorm)} onder de norm. Maatschappelijke kosten ${euro(r.kosten)} per dag.`:'Nog niet bekend.'},
    {thema:'Werkzaamheden',status:!r.wi?.geladen?'onbekend':r.wi.hoog?'kritiek':r.wi.metInleidend?'ernstig':'goed',duiding:r.wi?.geladen?`${meervoud(r.wi.werken,'werk','werken')} gepland; bij ${g(r.wi.metInleidend)} is de beveiliging vooraf onzeker.`:'Geen werkzaamheden geladen.'},
    {thema:'Formatie',status:!r.vcs.length?'onbekend':tekortVc>=3?'kritiek':tekortVc?'ernstig':'goed',duiding:r.vcs.length?`${g(tekortVc)} van ${g(r.vcs.length)} verkeerscentrales ${tekortVc===1?'komt':'komen'} mensen tekort bij de huidige storingsdruk.`:'Nog geen uitgangspunt per verkeerscentrale vastgelegd.'},
    {thema:'Projecten',status:!r.po?'onbekend':r.po.formatie?.perDienst?.some(x=>x.tekortWeken>0)&&!r.po.formatie.beschikbaarStandaard?'let':'goed',duiding:r.po?`${meervoud(r.po.mijlpalenKomend,'mijlpaal','mijlpalen')} in het verschiet; ${r.po.formatie?.perDienst?.filter(x=>x.tekortWeken>0).map(x=>x.dienst).join(', ')||'geen capaciteitstekort'} ${r.po.formatie?.perDienst?.some(x=>x.tekortWeken>0)?'komt het komende jaar capaciteit tekort':''}.`:'Geen planning geladen.'}
  ];
}

function hfdSamenvatting(r,nr){
  const th=themaStatus(r),kern=[];
  const onder=r.diensten.filter(d=>d.oordeel==='onder');
  kern.push(`Op dit moment ${r.open===1?'is':'zijn'} <b>${meervoud(r.open,'installatie','installaties')}</b> langs de weg verstoord${r.vc?` in het gebied van verkeerscentrale ${esc(r.vc)}`:''}. ${r.verloop.length?(r.recent>r.vorige?`Het aantal nieuwe storingen is de afgelopen week gestegen (${g(r.recent)} tegen ${g(r.vorige)} de week ervoor).`:`Het aantal nieuwe storingen is de afgelopen week niet gestegen (${g(r.recent)} tegen ${g(r.vorige)}).`):''}`);
  if(r.diensten.length)kern.push(onder.length?`<b>${onder.map(d=>esc(d.naam)).join(' en ')}</b> ${onder.length===1?'haalt':'halen'} het afgesproken niveau niet. Dat betekent dat weggebruikers daar merkbaar minder ondersteuning krijgen dan we beloven.`:`Alle diensten met een betrouwbare meting halen het afgesproken niveau.`);
  if(r.wi?.geladen&&r.wi.metInleidend)kern.push(`Bij <b>${meervoud(r.wi.metInleidend,'gepland werk','geplande werken')}</b> zijn de borden die het werkvak moeten afschermen deels verstoord. Zonder herstel of aanpassing kan het werk niet veilig worden opgestart.`);
  const tekort=r.vcs.filter(v=>v.tekortRollen||v.bezettingTekort);
  if(r.vcs.length)kern.push(tekort.length?`De storingsdruk vraagt meer mensen dan beschikbaar bij <b>${tekort.map(v=>'VC '+esc(v.vc)).join(', ')}</b>. Samen is circa <b>${g(r.op?.extraTotaal,1)} FTE</b> extra inzet nodig.`:`De bezetting is voldoende voor de huidige storingsdruk.`);
  if(Number.isFinite(r.kosten))kern.push(`De vertraging die storingen veroorzaken kost de samenleving naar schatting <b>${euro(r.kosten)} per dag</b>.`);
  const schema=r.s.schemas?figuur(`${nr}.1`,'Van storing tot gevolg: hoe uitval doorwerkt in dienstverlening, uitvoerbaarheid en kosten',keten([
    {titel:'Storingen',waarde:g(r.open),sub:'installaties verstoord',status:th[0].status},
    {titel:'Wegvakken',waarde:r.net?g(r.net.onderNorm):'–',sub:'onder de norm',status:th[2].status},
    {titel:'Diensten',waarde:r.diensten.length?`${g(onder.length)} van ${g(r.diensten.length)}`:'–',sub:'onder de norm',status:th[1].status},
    {titel:'Werken',waarde:r.wi?.geladen?g(r.wi.metInleidend):'–',sub:'beveiliging onzeker',status:th[3].status},
    {titel:'Formatie',waarde:r.vcs.length?`+${g(r.op?.extraTotaal,1)}`:'–',sub:'FTE extra nodig',status:th[4].status}
  ]),'Business Intelligence Dashboard, dagstand'):'';
  const st=r.s.tabellen?tabelBlok(`${nr}.1`,'Stand per thema',tabel(['Thema','Beoordeling','Toelichting'],th.map(t=>[esc(t.thema),status(t.status),esc(t.duiding)]))):'';
  return `<p class="rap-lead">Deze rapportage geeft het management in één oogopslag zicht op de stand van het wegverkeersmanagement: wat er verstoord is, wat dat betekent voor de weggebruiker en de organisatie, en waar een besluit nodig is.</p>${kader('kern','Kernboodschappen',kern)}${schema}${st}`;
}
function hfdStoringen(r,nr){
  const top=r.typen[0],vcTop=r.vcsStoring.slice().sort((a,b)=>b.n-a.n)[0];
  const tekst=[`Langs de weg staan duizenden installaties die het verkeer meten, waarschuwen en informeren. Valt zo’n installatie uit, dan spreken we van een storing. Op dit moment ${r.open===1?'is':'zijn'} er ${meervoud(r.open,'storing','storingen')} open${top?`; de meeste betreffen ${esc(top.label)} (${g(top.n)})`:''}.`,
    vcTop&&!r.vc?`Verkeerscentrale <b>${esc(vcTop.vc)}</b> heeft de meeste open storingen (${g(vcTop.n)}). Dat zegt nog niet alles over de gevolgen: één storing op een druk knooppunt weegt zwaarder dan meerdere op een rustig traject. De hoofdstukken over dienstverlening en netwerk gaan daarop in.`:'',
    r.onzeker?`Van ${meervoud(r.onzeker,'melding','meldingen')} is niet zeker of ze nog actueel zijn; die tellen we wel mee, maar met een slag om de arm.`:''];
  const fig1=r.s.grafieken?figuur(`${nr}.1`,`Nieuwe storingen per dag (laatste ${g(r.verloop.length)} dagen)`,lijn(r.verloop,{titel:'Nieuwe storingen per dag',eenheid:' storingen'}),'storingshistorie en open meldingen'):'';
  const fig2=r.s.grafieken?figuur(`${nr}.2`,'Open storingen per soort installatie',hbar(r.typen.map(t=>({label:t.label.split(' (')[0],waarde:t.n})),{labelBreedte:230,titel:'Open storingen per soort installatie'}),'open meldingen'):'';
  const tab=r.s.tabellen?tabelBlok(`${nr}.1`,'Open storingen per soort installatie',tabel(['Soort installatie','Open','Waarvan onzeker'],r.typen.map(t=>[esc(t.label),g(t.n),g(t.onzeker)]),{rechts:[1,2]})):'';
  return `${p(tekst.filter(Boolean).join(' '))}${fig1}${fig2}${tab}${kader('betekenis','Wat betekent dit?',r.recent>r.vorige?`De storingsdruk neemt toe. Als dit doorzet, groeit de achterstand in herstel en daarmee de kans dat diensten onder hun norm zakken.`:`De storingsdruk is stabiel of dalend. Het herstel houdt de nieuwe storingen bij.`)}${kader('advies','Aanbeveling',r.recent>r.vorige?`Bespreek met de onderhoudsaannemers of de hersteltijden nog passen bij het toegenomen aantal storingen, en geef voorrang aan installaties op drukke knooppunten.`:`Houd de huidige hersteltempo’s vast en blijf de ontwikkeling wekelijks volgen.`)}`;
}
function hfdDiensten(r,nr){
  if(!r.diensten.length)return p('Er is nog geen storingsbron geladen; de dienstverlening kan daardoor niet worden beoordeeld.');
  const onder=r.diensten.filter(d=>d.oordeel==='onder'),onzeker=r.diensten.filter(d=>d.oordeel==='onzeker'||d.oordeel==='onbekend');
  const uitleg=`Rijkswaterstaat levert de weggebruiker vier diensten: ${r.diensten.map(d=>`<b>${esc(d.naam)}</b> (${esc(DIENST_TAAL[d.id]||'')})`).join(', ')}. Voor elke dienst is afgesproken hoe vaak die minimaal beschikbaar moet zijn: de norm. Storingen aan installaties verlagen die beschikbaarheid, afhankelijk van hoe belangrijk de installatie voor de dienst is.`;
  const oordeel=onder.length?`${onder.map(d=>`<b>${esc(d.naam)}</b> zit met ${d.besch!=null?pct(d.besch,2):`${g(d.lo,1)} tot ${pct(d.hi,1)}`} onder de norm van ${pct(d.norm,1)}`).join('; ')}.`:'Geen enkele dienst zit aantoonbaar onder de norm.';
  const fig=r.s.grafieken?figuur(`${nr}.1`,'Beschikbaarheid per dienst ten opzichte van de norm (streep). Een lichte balk is een bandbreedte: de exacte waarde is nog onzeker.',kogel(r.diensten),'dienstimpactberekening'):'';
  const tab=r.s.tabellen?tabelBlok(`${nr}.1`,'Dienstverlening',tabel(['Dienst','Beschikbaarheid','Norm','Beoordeling'],r.diensten.map(d=>[esc(d.naam),d.besch!=null?pct(d.besch,2):`${g(d.lo,1)}–${pct(d.hi,1)}`,pct(d.norm,1),status(d.oordeel==='binnen'?'goed':d.oordeel==='onder'?'kritiek':'let')]),{rechts:[1,2]})):'';
  return `${p(uitleg)}${p(oordeel+(onzeker.length?` Voor ${onzeker.map(d=>esc(d.naam)).join(' en ')} is de meting nog niet zeker genoeg voor een hard oordeel.`:''))}${fig}${tab}${kader('betekenis','Wat betekent dit?',onder.length?`Waar een dienst onder de norm zit, merkt de weggebruiker dat: minder of later gewaarschuwd, minder actuele informatie of tragere hulp bij een incident. Dit raakt direct de afspraken die we als organisatie hebben gemaakt.`:`De weggebruiker krijgt de beloofde ondersteuning.`)}${kader('advies','Aanbeveling',onder.length?`Stuur het herstel op dienstverlening in plaats van op aantallen: herstel eerst de installaties die het zwaarst bijdragen aan ${onder.map(d=>esc(d.naam)).join(' en ')}.`:`Gebruik de marge om achterstallig onderhoud in te lopen.`)}`;
}
function hfdNetwerk(r,nr){
  if(!r.net)return p('Er zijn nog geen wegvakken met storingen in beeld.');
  const tekst=`Het wegennet is opgedeeld in vakken (${esc(r.net.soort)}). Van de ${meervoud(r.net.totaal,'vak','vakken')} met storingen ${r.net.onderNorm===1?'zit':'zitten'} er <b>${g(r.net.onderNorm)}</b> onder de afgesproken beschikbaarheid van ${pct(r.net.norm,1)}. Op zo’n vak kunnen weggebruikers minder goed worden gewaarschuwd voor files of ongevallen.`;
  const kosten=Number.isFinite(r.kosten)?`Als installaties uitvallen, rijdt het verkeer minder vlot en ontstaan er sneller files. Omgerekend naar verloren reistijd kost dat de samenleving naar schatting <b>${euro(r.kosten)} per dag</b> (${g(r.kostenBekend)} van ${g(r.kostenTotaal)} vakken berekenbaar). Dit zijn maatschappelijke kosten, geen uitgaven van Rijkswaterstaat.`:'De maatschappelijke kosten zijn nog niet te berekenen, omdat verkeersgegevens ontbreken.';
  const fig=r.s.grafieken?figuur(`${nr}.1`,'Wegvakken met de laagste beschikbaarheid (streep = norm)',hbar(r.laagste.map(x=>({label:x.key.length>34?x.key.slice(0,33)+'…':x.key,waarde:x.besch??0,tekst:pct(x.besch,1)})),{max:100,norm:r.net.norm,labelBreedte:250,titel:'Laagste beschikbaarheid per wegvak'}),'netwerkschakels en open meldingen'):'';
  const top=r.roads.slice(0,6);
  const fig2=r.s.grafieken&&top.length?figuur(`${nr}.2`,'Wegvakken met de hoogste maatschappelijke kosten per dag',hbar(top.map(x=>({label:(x.naam||x.id).length>34?(x.naam||x.id).slice(0,33)+'…':(x.naam||x.id),waarde:x.kosten,tekst:euro(x.kosten)})),{labelBreedte:250,titel:'Maatschappelijke kosten per wegvak'}),'verkeerskostenmodel met NDW-verkeersintensiteit'):'';
  const tab=r.s.tabellen?tabelBlok(`${nr}.1`,'Wegvakken die het meest aandacht vragen',tabel(['Wegvak','VC','Beschikbaarheid','Open storingen'],r.laagste.map(x=>[esc(x.key),esc(x.vc),pct(x.besch,2),g(x.n)]),{rechts:[2,3]})):'';
  return `${p(tekst)}${p(kosten)}${fig}${fig2}${tab}${kader('betekenis','Wat betekent dit?','De vakken bovenaan de lijst bepalen het grootste deel van het risico en de kosten. Gericht herstel daar levert per euro het meeste op voor de weggebruiker.')}${kader('advies','Aanbeveling',`Maak de top-${Math.min(6,r.laagste.length)||'5'} wegvakken leidend in de herstelplanning van deze week.`)}`;
}
function hfdWerk(r,nr){
  const w=r.wi;if(!w?.geladen)return p('Er zijn nog geen geplande werkzaamheden geladen. Daardoor is niet te beoordelen of werkzaamheden veilig kunnen worden uitgevoerd.');
  const tekst=`Bij werkzaamheden aan de weg worden rijstroken afgesloten met kruizen en snelheidsbeelden op de borden vóór het werkvak. Zijn die borden verstoord, dan kan het werkvak niet volgens de regels worden afgeschermd. Van de ${meervoud(w.werken,'werk','werken')} dat nu loopt of de komende ${g(w.horizonDagen)} dagen start, is dat bij <b>${g(w.metInleidend)}</b> het geval${w.hoog?`; bij ${g(w.hoog)} gaat het om een afsluiting, waardoor het afkruisen onzeker is`:''}.`;
  const rijen=(w.lijst||[]).slice(0,8).map(x=>[esc(x.label),esc(x.periode),esc(x.afsluiting||'–'),g(x.inleidend.length),status(x.ernst==='hoog'?'kritiek':x.ernst==='midden'?'ernstig':'let')]);
  const tab=r.s.tabellen?tabelBlok(`${nr}.1`,'Werkzaamheden met verstoorde beveiliging vooraf',tabel(['Werk','Periode','Afsluiting','Verstoorde borden','Beoordeling'],rijen,{rechts:[3]})):'';
  const schema=r.s.schemas?figuur(`${nr}.1`,'Hoe een storing een gepland werk raakt',keten([{titel:'Bord vóór werkvak',waarde:'storing',sub:'kruis niet te tonen',status:'ernstig'},{titel:'Afschermen',waarde:'onzeker',sub:'veiligheid werkvak',status:'kritiek'},{titel:'Gevolg',waarde:'uitstel',sub:'of extra afzetting',status:'let'},{titel:'Kosten',waarde:'hoger',sub:'mensen en materieel',status:'let'}]),'werkzaamheden en open meldingen'):'';
  return `${p(tekst)}${schema}${tab}${kader('betekenis','Wat betekent dit?',w.metInleidend?'Zonder ingrijpen moeten werken worden uitgesteld of met extra mensen en materieel worden afgezet. Dat kost geld en vertraagt het onderhoudsprogramma.':'De geplande werkzaamheden kunnen veilig worden uitgevoerd.')}${kader('advies','Aanbeveling',w.metInleidend?'Geef herstel van de borden vóór geplande werkvakken voorrang, of verschuif de betreffende werken in overleg met de aannemer.':'Geen actie nodig.')}`;
}
function hfdFormatie(r,nr){
  if(!r.vcs.length)return p('Er is nog geen uitgangspunt voor de formatie per verkeerscentrale vastgelegd. Leg dat vast bij Formatie & contracten om dit hoofdstuk te vullen.');
  const rijen=r.vcs.map(v=>{const b=v.rollen.reduce((t,x)=>t+(x.beschikbaar||0),0),n=v.rollen.reduce((t,x)=>t+(x.benodigd||0),0);return {vc:v.vc,beschikbaar:b,benodigd:n,ruimte:b-n,v};});
  const tekort=rijen.filter(x=>x.v.tekortRollen||x.v.bezettingTekort);
  const tekst=`Elke verkeerscentrale heeft een vaste bezetting van wegverkeersleiders, coördinatoren, officieren van dienst en weginspecteurs. Die is berekend op een normale situatie. Storingen maken het werk zwaarder: borden moeten handmatig worden bediend, incidenten zijn moeilijker te zien en weginspecteurs moeten vaker de weg op. ${tekort.length?`Bij <b>${tekort.map(x=>'VC '+esc(x.vc)).join(', ')}</b> is de beschikbare bezetting daardoor niet meer voldoende.`:'Bij alle verkeerscentrales is de bezetting voldoende.'}`;
  const fig=r.s.grafieken?figuur(`${nr}.1`,'Beschikbare en benodigde formatie per verkeerscentrale (FTE)',groepBalk(rijen),'operationele formatie, '+(r.op?.methode==='ingenieursbureau'?'rekenmethode ingenieursbureau':'gevoeligheid per rol')):'';
  const tab=r.s.tabellen?tabelBlok(`${nr}.1`,'Formatie per verkeerscentrale',tabel(['VC','Beschikbaar','Benodigd','Ruimte','Beoordeling'],rijen.map(x=>[esc(x.vc),g(x.beschikbaar,1),g(x.benodigd,1),`${x.ruimte>=0?'+':''}${g(x.ruimte,1)}`,status(x.v.tekortRollen||x.v.bezettingTekort?(x.ruimte<-5?'kritiek':'ernstig'):'goed')]),{rechts:[1,2,3]})):'';
  return `${p(tekst)}${fig}${tab}${kader('betekenis','Wat betekent dit?',tekort.length?'Een tekort betekent dat taken blijven liggen of dat mensen langer en vaker worden ingezet. Op termijn raakt dat de veiligheid en het verzuim.':'Er is ruimte om pieken op te vangen.')}${kader('advies','Aanbeveling',tekort.length?`Zet tijdelijk extra capaciteit in bij ${tekort.map(x=>'VC '+esc(x.vc)).join(', ')}, of verlaag de storingsdruk door gericht herstel. Het tweede is structureel goedkoper.`:'Houd de huidige bezetting aan.')}`;
}
function hfdGevolgen(r,nr){
  if(!r.gevolgen.length)return p('De operationele gevolgen kunnen nog niet worden berekend, omdat het assetregister of de open storingen ontbreken.');
  const tot=k=>r.gevolgen.reduce((t,v)=>t+(v.ingenieur[k]||0),0);
  const tekst=`Een extern ingenieursbureau heeft berekend hoe uitval van installaties doorwerkt in de dagelijkse operatie. Toegepast op de huidige storingen levert dat het volgende beeld. Incidenten worden later opgemerkt en weginspecteurs zijn langer onderweg. Er is extra inzet nodig van weginspecteurs, beveiligingswagens (botsabsorbers), tekstwagens en incidentteams. In totaal gaat het om circa <b>${g(tot('inspecteursuren'))} extra inspecteursuren</b> en <b>${euro(tot('kosten'))}</b> aan extra operationele kosten.`;
  const fig=r.s.grafieken?figuur(`${nr}.1`,'Extra operationele kosten per verkeerscentrale',hbar(r.gevolgen.map(v=>({label:'VC '+v.vc,waarde:v.ingenieur.kosten,tekst:euro(v.ingenieur.kosten)})),{labelBreedte:90,titel:'Extra operationele kosten per verkeerscentrale'}),'rekenmethode ingenieursbureau'):'';
  const tab=r.s.tabellen?tabelBlok(`${nr}.1`,'Operationele gevolgen per verkeerscentrale',tabel(['VC','Incident opgemerkt na','Aanrijtijd inspectie','Extra inspecteursuren','Extra kosten'],r.gevolgen.map(v=>[esc(v.vc),g(v.ingenieur.detectMin,1)+' min',g(v.ingenieur.aanrijMin,1)+' min',g(v.ingenieur.inspecteursuren),euro(v.ingenieur.kosten)]),{rechts:[1,2,3,4]})):'';
  return `${p(tekst)}${fig}${tab}${kader('betekenis','Wat betekent dit?','Elke minuut die een incident later wordt opgemerkt, vergroot de kans op een vervolgongeval en op langere files. De extra inzet kost bovendien geld dat niet aan onderhoud kan worden besteed.')}${kader('advies','Aanbeveling','Weeg de extra operationele kosten af tegen de kosten van sneller herstel. Waar de operationele kosten hoger zijn, loont versneld herstel.')}`;
}
function hfdPlanning(r,nr){
  const po=r.po;if(!po)return p('Er is nog geen projectplanning geladen.');
  const ms=po.mijlpalen||[],f=po.formatie;
  const tekst=`De projectplanning telt ${meervoud(po.taken||0,'activiteit','activiteiten')}${Number.isFinite(po.lopend)?`, waarvan er nu ${g(po.lopend)} lopen`:''}. De komende periode ${po.mijlpalenKomend===1?'staat':'staan'} er ${meervoud(po.mijlpalenKomend,'mijlpaal','mijlpalen')} gepland; de eerstvolgende is <b>${esc(ms[0]?.naam||'–')}</b> op ${esc(datumLang(ms[0]?.datum))}.`;
  const tekortD=(f?.perDienst||[]).filter(x=>x.tekortWeken>0);
  const cap=f?(f.beschikbaarStandaard?'De beschikbare capaciteit per dienst is nog niet ingevuld; tekorten kunnen daardoor nog niet worden vastgesteld.':tekortD.length?`De projecten vragen het komende jaar meer capaciteit dan beschikbaar bij <b>${tekortD.map(x=>esc(x.dienst)).join(', ')}</b>${tekortD[0].eersteTekort?`, voor het eerst rond ${esc(datumLang(tekortD[0].eersteTekort))}`:''}.`:'De projecten passen binnen de beschikbare capaciteit.'):'';
  const fig=r.s.schemas?figuur(`${nr}.1`,'Komende mijlpalen',tijdlijn(ms),'projectplanning'):'';
  const tab=r.s.tabellen&&f?tabelBlok(`${nr}.1`,'Capaciteitsvraag uit de projecten (FTE)',tabel(['Dienst','Nu gevraagd','Piek','Beschikbaar','Weken tekort'],f.perDienst.map(x=>[esc(x.dienst),g(x.nu,1),g(x.piek,1),x.beschikbaar==null?'–':g(x.beschikbaar,1),g(x.tekortWeken)]),{rechts:[1,2,3,4]})):'';
  return `${p(tekst)}${p(cap)}${fig}${tab}${kader('advies','Aanbeveling',tekortD.length?`Bepaal nu hoe de capaciteitspiek bij ${tekortD.map(x=>esc(x.dienst)).join(', ')} wordt opgevangen: spreiden van activiteiten, tijdelijke inhuur of herprioritering.`:'Bewaak de eerstvolgende mijlpalen.')}`;
}
function hfdRisicos(r,nr){
  const lijst=r.signalen.slice(0,8);
  if(!lijst.length)return p('Er zijn op dit moment geen signalen die om een besluit vragen.');
  const ernst=s=>sevRang(s)===0?'kritiek':sevRang(s)===1?'ernstig':'let';
  const tab=tabelBlok(`${nr}.1`,'Signalen die aandacht of een besluit vragen',tabel(['Onderwerp','Toelichting','Eigenaar','Ernst'],lijst.map(t=>[esc(schoneTaal(t.titel||t.regel||'Signaal',80)),esc(schoneTaal(t.msg)),esc(t.resp||t.eigenaar||'–'),status(ernst(t.sev))])));
  const rood=lijst.filter(t=>sevRang(t.sev)===0).length;
  return `${p(`Het dashboard combineert signalen uit storingen, dienstverlening, formatie en financiën. ${rood?`<b>${g(rood)} ${rood===1?'signaal vraagt':'signalen vragen'}</b> om een besluit op korte termijn.`:'Geen enkel signaal is kritiek.'} De tabel toont de ${g(lijst.length)} belangrijkste${r.signalen.length>lijst.length?` van de ${g(r.signalen.length)}`:''}, gesorteerd op ernst.`)}${tab}${kader('advies','Gevraagd besluit',rood?'Wijs per kritiek signaal een eigenaar en een termijn aan, en bespreek de voortgang in het volgende overleg.':'Neem de signalen ter kennisname aan.')}`;
}
function hfdBetrouwbaarheid(r,nr){
  const q=r.kwaliteit,rev=r.expert;
  const tekst=`Cijfers zijn zo goed als de bronnen waarop ze zijn gebaseerd. ${q?`De laatste kwaliteitscontrole gaf een score van <b>${g(q.score)} van 100</b> (${esc(q.verdict?.label||'')}).`:'Er is nog geen kwaliteitscontrole uitgevoerd.'} ${r.nietDoorgerekend?`${meervoud(r.nietDoorgerekend,'melding kon','meldingen konden')} niet volledig worden meegerekend, meestal omdat de installatie niet in het register voorkomt.`:''} ${Number.isFinite(r.dekking)?`De bekende brondekking van de dienstberekening is ${pct(r.dekking*100,0)}.`:''}`;
  const tab=r.s.tabellen&&rev.length?tabelBlok(`${nr}.1`,'Inhoudelijke toetsing per dienst door experts',tabel(['Dienst','Expert','Status','Vertrouwen'],rev.map(x=>[esc(x.dienstNaam),esc(x.expert?.naam||'–'),esc({vastgesteld:'Vastgesteld',ter_beoordeling:'Ter beoordeling',concept:'Concept'}[x.status]||x.status),x.validatie?.vertrouwen?`${esc(x.validatie.vertrouwen)} van 5`:'–'])),{rechts:[3]}):'';
  return `${p(tekst)}${tab}${kader('advies','Aanbeveling','Gebruik de cijfers in deze rapportage als stuurinformatie, niet als exacte afrekening. Laad bij voorkeur dagelijks de actuele storingsbronnen en laat de diensten die nog niet zijn vastgesteld door experts toetsen.')}`;
}
function hfdBegrippen(){
  const b=[['Beschikbaarheid','Het deel van de tijd dat een installatie of dienst werkt zoals bedoeld.'],['Norm','Het afgesproken minimale niveau van beschikbaarheid.'],['Dienst','Wat Rijkswaterstaat de weggebruiker levert, zoals incidentafhandeling of reisinformatie.'],['Signaalgever (matrixbord)','Bord boven de rijstrook dat snelheden, kruizen en pijlen toont.'],['DRIP','Groot informatiepaneel langs de weg met reistijden en routeadvies.'],['Detectielus','Meetpunt in het wegdek dat het verkeer telt en snelheden meet.'],['Wegvak (netwerkschakel)','Een stuk snelweg tussen twee knooppunten of aansluitingen.'],['Maatschappelijke kosten','De waarde van verloren reistijd voor weggebruikers en vervoerders.'],['FTE','Een volledige baan (36 uur per week).'],['Afkruisen','Een rijstrook afsluiten door een rood kruis op de borden te tonen.'],['Verkeerscentrale (VC)','Regionale centrale die het verkeer bewaakt en stuurt.']];
  return tabel(['Begrip','Betekenis'],b.map(([a,c])=>[`<b>${esc(a)}</b>`,esc(c)]));
}
const HOOFDSTUK={samenvatting:hfdSamenvatting,storingen:hfdStoringen,diensten:hfdDiensten,netwerk:hfdNetwerk,werk:hfdWerk,formatie:hfdFormatie,gevolgen:hfdGevolgen,planning:hfdPlanning,risicos:hfdRisicos,betrouwbaarheid:hfdBetrouwbaarheid,begrippen:hfdBegrippen};

/* Het volledige rapport als HTML (zonder inline stijl). */
export function rapportHtml(r){
  const s=r.s,gekozen=RAPPORT_ONDERDELEN.filter(o=>o.vast||s.onderdelen.includes(o.id));
  const inhoud=gekozen.map((o,i)=>`<li>${i+1}. ${esc(o.titel)}</li>`).join('');
  const hoofdstukken=gekozen.map((o,i)=>`<div class="rap-hoofdstuk" id="rap-${o.id}"><h2><span class="rap-nr">${i+1}</span>${esc(o.titel)}</h2>${HOOFDSTUK[o.id](r,i+1)}</div>`).join('');
  return `<article class="rap-document"><header class="rap-voorblad"><p class="rap-eyebrow">Managementrapportage</p><h1>${esc(s.titel)}</h1><p class="rap-meta">${r.vc?`Verkeerscentrale ${esc(r.vc)}`:'Landelijk beeld'} · stand ${esc(datumLang(r.peildatum||r.nu))}</p><dl class="rap-colofon"><div><dt>Voor</dt><dd>${esc(s.ontvanger)}</dd></div><div><dt>Opgesteld door</dt><dd>${esc(s.auteur)}</dd></div><div><dt>Datum</dt><dd>${esc(datumLang(r.nu))}</dd></div></dl><div class="rap-inhoud"><p><b>Inhoud</b></p><ol>${inhoud}</ol></div></header>${hoofdstukken}<footer class="rap-voet">Deze rapportage is automatisch samengesteld uit de bronnen in het Business Intelligence Dashboard. Getallen zijn afgerond. Waar een bron ontbreekt, staat dat vermeld.</footer></article>`;
}

export function rapportBuilderHtml(s,{vcs=[]}={}){
  const vink=(id,label,uitleg,aan,vast)=>`<label class="rap-optie"><input type="checkbox" data-rap-onderdeel="${id}"${aan?' checked':''}${vast?' disabled':''}><span><b>${esc(label)}</b><small>${esc(uitleg)}</small></span></label>`;
  return `<div class="rap-velden"><label>Titel<input type="text" data-rap-veld="titel" value="${esc(s.titel)}"></label><label>Voor<input type="text" data-rap-veld="ontvanger" value="${esc(s.ontvanger)}"></label><label>Opgesteld door<input type="text" data-rap-veld="auteur" value="${esc(s.auteur)}"></label>
  <label>Gebied<select data-rap-veld="scope"><option value="">Landelijk</option>${vcs.map(v=>`<option value="${esc(v)}"${s.scope===v?' selected':''}>Verkeerscentrale ${esc(v)}</option>`).join('')}</select></label></div>
  <p class="ov-subkop">Onderwerpen</p><div class="rap-opties">${RAPPORT_ONDERDELEN.map(o=>vink(o.id,o.titel,o.uitleg,o.vast||s.onderdelen.includes(o.id),o.vast)).join('')}</div>
  <p class="ov-subkop">Opmaak</p><div class="rap-opties rap-opties-kort">${[['grafieken','Grafieken'],['tabellen','Tabellen'],['schemas','Schema’s en tijdlijnen']].map(([k,l])=>`<label class="rap-optie"><input type="checkbox" data-rap-opmaak="${k}"${s[k]?' checked':''}><span><b>${l}</b></span></label>`).join('')}</div>
  <div class="rap-knoppen"><button type="button" class="primary" data-rap-opstellen>Rapport opstellen</button><button type="button" data-rap-print>Afdrukken of opslaan als PDF</button><button type="button" data-rap-download>Download als HTML</button></div>`;
}
