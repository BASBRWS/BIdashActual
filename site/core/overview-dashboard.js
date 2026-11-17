/* Overzichtsdashboard (2.88). Bouwt de kaarten, de pijplijn, het verloop en de
   meterlijsten van het Overzicht uit de bestaande samenvattingen. Rekent niets nieuws:
   elk getal komt uit de DVM-, BI- of planningsamenvatting, de open meldingen of de
   dagstand. Ontbreekt een bron, dan staat er Onbekend of een lege toestand, nooit nul.
   De functies geven HTML-tekst terug zonder inline stijl (CSP style-src 'self');
   staafbreedtes staan als SVG-attributen. */

export const OVERZICHT_KLEUR={reeks:'#0f9d78',onzeker:'#df5f26'};
export const PERIODES=[14,30,90];
const TYPE_LABEL={MSI:'Signalering',LUS:'Detectie',CAM:'Camera',DRIP:'DRIP',WISSELBORD:'Wisselbord',SYSTEEM:'Systeem',COMM:'Communicatie'};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formats=new Map();
export function getal(n,d=0){
  if(!Number.isFinite(n))return 'Onbekend';
  if(!formats.has(d))formats.set(d,new Intl.NumberFormat('nl-NL',{maximumFractionDigits:d,minimumFractionDigits:d}));
  return formats.get(d).format(n);
}
const pct=(n,d=1)=>Number.isFinite(n)?getal(n,d)+'%':'Onbekend';
const geld=n=>Number.isFinite(n)?new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format(n):'Onbekend';
const dagLabel=dag=>{const [j,m,d]=String(dag).split('-').map(Number);return d&&m?`${d} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][m-1]}`:String(dag);};
const isOnzeker=f=>!!f.levenscyclus_status&&f.levenscyclus_status!=='OPEN_BEVESTIGD';

/* Kern: één samengesteld beeld waar alle onderdelen uit putten, zodat de getallen
   onderling kloppen. */
export function overzichtModel({dvm,bi,stand,signalen=[],meldingen=[],periode=30,planning=null}={}){
  const p=PERIODES.includes(Number(periode))?Number(periode):30;
  const verloop=dvm?.verloop?.dagen?.length?dvm.verloop.dagen.slice(-p):[];
  const open=meldingen.length,doorgerekend=meldingen.filter(f=>(f.rekenStatus||'Doorgerekend')==='Doorgerekend').length;
  const gekoppeld=meldingen.filter(f=>f.assetKey).length,onzeker=meldingen.filter(isOnzeker).length;
  const perType=new Map();for(const f of meldingen){const k=TYPE_LABEL[f.typeId]?f.typeId:'OVERIG';const r=perType.get(k)||{n:0,onzeker:0};r.n++;if(isOnzeker(f))r.onzeker++;perType.set(k,r);}
  const typen=[...perType].map(([k,r])=>({id:k,label:TYPE_LABEL[k]||'Overig',...r})).sort((a,b)=>b.n-a.n||a.label.localeCompare(b.label,'nl'));
  const diensten=(dvm?.diensten||[]).map(x=>{
    const lo=x.besch??x.lo,hi=x.besch??x.hi,norm=Number(x.norm);
    const oordeel=x.uitgesloten?'uitgesloten':!Number.isFinite(lo)||!Number.isFinite(norm)?'onbekend':lo>=norm?'binnen':hi<norm?'onder':'onzeker';
    return {...x,lo,hi,oordeel};
  });
  const meetbaar=diensten.filter(x=>x.oordeel!=='uitgesloten');
  const dekking=meetbaar.length?meetbaar.reduce((s,x)=>s+(Number(x.dekking)||0),0)/meetbaar.length:null;
  const wegen=dvm?.roads||[],bekend=wegen.filter(r=>Number.isFinite(r.kosten));
  const fte=bi?.functies||[],fteNodig=fte.reduce((s,f)=>s+(Number(f.benodigd)||0),0),fteActueel=fte.reduce((s,f)=>s+(Number(f.actueel)||0),0);
  const vcs=(stand?.rows||[]).map(r=>({vc:r.vc,n:r.meldingen,onzeker:Math.min(r.onzeker,r.meldingen),peildatum:r.peildatum,status:r.status}));
  return {
    periode:p,heeftDvm:!!dvm,peildatum:dvm?.peildatum||null,verloop,verloopTot:dvm?.verloop?.tot||null,verloopZonderStart:dvm?.verloop?.zonderStart||0,
    nieuwInPeriode:verloop.reduce((s,d)=>s+d.nieuw,0),
    open,doorgerekend,nietDoorgerekend:open-doorgerekend,gekoppeld,onzeker,typen,
    diensten,binnen:diensten.filter(x=>x.oordeel==='binnen').length,onder:diensten.filter(x=>x.oordeel==='onder').length,
    onzekerDienst:diensten.filter(x=>x.oordeel==='onzeker'||x.oordeel==='onbekend').length,meetbareDiensten:meetbaar.length,dekking,
    kosten:bekend.length?bekend.reduce((s,r)=>s+r.kosten,0):null,kostenBekend:bekend.length,kostenTotaal:wegen.length,netwerkschakels:!!dvm?.netwerkschakelmatrix,
    planning:bi?.planning||null,fte:fte.length?{nodig:fteNodig,actueel:fteActueel,functies:fte.length,lijst:fte}:null,
    signalen:signalen.length,vcs,
    // 2.89: zwakste dienst (laagste ondergrens), netwerkschakels, planningoverzicht.
    zwaksteDienst:meetbaar.filter(x=>Number.isFinite(x.lo)).slice().sort((a,b)=>a.lo-b.lo||a.hi-b.hi)[0]||null,
    netwerk:dvm?.netwerk||null,
    planOverzicht:planning||null,
    planActiviteiten:planning?.taken??null
  };
}

/* Sparkline: twaalf of meer punten, geen assen, laatste punt gemarkeerd. */
export function sparklineSvg(waarden,{label='Verloop'}={}){
  if(!waarden?.length||waarden.length<2)return '';
  const W=120,H=32,max=Math.max(1,...waarden),stap=W/(waarden.length-1);
  const pts=waarden.map((v,i)=>[i*stap,H-2-(v/max)*(H-6)]);
  const d=pts.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
  const [lx,ly]=pts[pts.length-1];
  return `<svg class="ov-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><path d="${d}" fill="none" stroke="${OVERZICHT_KLEUR.reeks}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.5" fill="${OVERZICHT_KLEUR.reeks}"/></svg>`;
}

/* Horizontale balk 0-100 in een SVG, zodat geen inline stijl nodig is. */
function meterSvg(delen,max,label){
  const totaal=Math.max(1,max);let x=0;
  const rects=delen.filter(d=>d.n>0).map(d=>{const w=Math.max(.8,d.n/totaal*100);const r=`<rect x="${x.toFixed(2)}" y="0" width="${Math.max(0,w-(x+w<100?.6:0)).toFixed(2)}" height="8" rx="2" fill="${d.kleur}"/>`;x+=w;return r;}).join('');
  return `<svg class="ov-meter" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="${esc(label)}"><rect x="0" y="0" width="100" height="8" rx="2" class="ov-track"/>${rects}</svg>`;
}

export function kpiHtml(m){
  // De laatste dag loopt tot het peilmoment en is nog niet compleet; de sparkline toont alleen volledige dagen.
  const volledig=m.verloop.slice(0,-1);
  const spark=volledig.length>1?sparklineSvg(volledig.map(d=>d.nieuw),{label:`Nieuwe storingen per volledige dag, ${volledig.length} dagen`}):'';
  const tegels=[
    {label:'Open storingen',waarde:m.heeftDvm?getal(m.open):'Onbekend',sub:m.heeftDvm?`${getal(m.doorgerekend)} doorgerekend · ${getal(m.nietDoorgerekend)} niet doorgerekend · ${getal(m.onzeker)} onzeker`:'Laad een DVM-totaalbestand met open storingen',extra:spark,route:'faults',
      voet:m.verloop.length?`${getal(m.nieuwInPeriode)} nieuw in de laatste ${m.periode} dagen`:''},
    {label:m.zwaksteDienst?`Zwakste dienst · ${m.zwaksteDienst.naam}`:'Zwakste dienst',waarde:m.zwaksteDienst?dienstWaarde(m.zwaksteDienst):'Onbekend',
      sub:m.diensten.length?`${getal(m.binnen)} van ${getal(m.meetbareDiensten)} aantoonbaar binnen norm · ${getal(m.onder)} zeker onder norm · ${getal(m.onzekerDienst)} onzeker`:'Dienstimpact wacht op brondata',route:'services',
      voet:m.zwaksteDienst?`Norm ${pct(m.zwaksteDienst.norm,1)} · bekende brondekking ${pct((Number(m.zwaksteDienst.dekking)||0)*100,0)}`:''},
    {label:'Verkeerskosten / brondag',waarde:m.kostenBekend?geld(m.kosten):'Onbekend',sub:`${getal(m.kostenBekend)} van ${getal(m.kostenTotaal)} ${m.netwerkschakels?'netwerkschakelrichtingen':'wegdelen'} berekenbaar${m.kostenBekend<m.kostenTotaal?' · bekend subtotaal':''}`,route:'costs',voet:'Som van scenario’s; controleer overlap'},
    (()=>{const po=m.planOverzicht,vm=po?.mijlpalen?.[0];return {label:'Eerstvolgende mijlpaal',waarde:vm?dagenTekst(vm.dagen):po?'Geen komende mijlpaal':m.planning?'Planning niet geopend':'Nog niet geladen',
      sub:vm?`${vm.naam} · ${datumLabel(vm.datum)}`:m.planning?`${getal(m.planning.regels)} activiteiten in ${String(m.planning.naam||'de planning')}`:'Laad je planning-XML',route:'planning',
      voet:po?`${getal(po.lopend)} activiteiten lopen nu · ${getal(po.mijlpalenKomend)} komende mijlpalen`:''};})()
  ];
  return tegels.map(t=>`<button type="button" class="card ov-kpi" data-ov-route="${t.route}"><span class="ov-kpi-label">${esc(t.label)}</span><strong>${esc(t.waarde)}</strong>${t.extra||''}<small>${esc(t.sub)}</small>${t.voet?`<span class="ov-kpi-voet">${esc(t.voet)}</span>`:''}</button>`).join('');
}

export function pijplijnHtml(m){
  const stap=(nr,titel,vraag,waarde,sub,fractie,route)=>`<button type="button" class="ov-step" data-ov-route="${route}"><span class="ov-step-nr">${nr}</span><span class="ov-step-titel">${esc(titel)}</span><span class="ov-step-vraag">${esc(vraag)}</span><strong>${esc(waarde)}</strong>${fractie==null?'<span class="ov-step-geen">Nog niet te bepalen</span>':meterSvg([{n:Math.round(fractie*1000),kleur:OVERZICHT_KLEUR.reeks}],1000,sub)}<small>${esc(sub)}</small></button>`;
  const koppel=m.open?m.gekoppeld/m.open:null;
  const net=m.netwerk,geraaktFractie=net&&net.geraakt?1-net.onderNorm/net.geraakt:null;
  const fo=formatieSamenvatting(m);
  return [
    stap('01','Uitval','Wat is uitgevallen?',m.heeftDvm?`${getal(m.open)} open`:'Onbekend',koppel==null?'Geen open storingen of geen bron':`${pct(koppel*100,0)} aan een asset gekoppeld`,koppel,'faults'),
    stap('02','Gevolgen','Waar raakt het de weg?',net?`${getal(net.geraakt)} ${net.soort} geraakt`:'Onbekend',net?(net.geraakt?`${getal(net.onderNorm)} onder norm ${pct(net.norm,1)} · balk = deel binnen norm`:'Geen geraakte '+net.soort):'Laad open storingen',geraaktFractie,'roads'),
    stap('03','Uitvoerbaarheid','Is er capaciteit en planning?',fo.waarde,fo.sub,fo.fractie,'planning'),
    stap('04','Actie','Wat vraagt een besluit?',`${getal(m.signalen)} ${m.signalen===1?'signaal':'signalen'}`,m.signalen?'Gezamenlijke signalen uit storingen en formatie':'Geen open signalen',null,'signals')
  ].join('<span class="ov-step-pijl" aria-hidden="true">›</span>');
}

function dienstWaarde(x){return x.oordeel==='uitgesloten'?'Geen meetellende assetbron':x.besch!=null?pct(x.besch,2):`${getal(x.lo,1)}–${getal(x.hi,1)}%`;}
function datumLabel(iso){if(!iso)return 'Onbekend';const [j,m,d]=String(iso).split('-').map(Number);return d&&m?`${d} ${['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][m-1]} ${j}`:String(iso);}
function dagenTekst(n){return n===0?'Vandaag':n===1?'Morgen':`Over ${getal(n)} dagen`;}

/* Formatie uit de planning: alleen een tekort tonen als beschikbare FTE zijn ingevuld. */
export function formatieSamenvatting(m){
  const f=m.planOverzicht?.formatie;
  if(!f)return {waarde:m.planning?`${getal(m.planning.regels)} activiteiten`:'Geen planning',sub:m.fte?`BI-formatie ${getal(m.fte.actueel,1)} van ${getal(m.fte.nodig,1)} FTE`:'Formatie onbekend',fractie:m.fte&&m.fte.nodig>0?Math.min(1,m.fte.actueel/m.fte.nodig):null};
  const vraagNu=f.perDienst.reduce((s,d)=>s+d.nu,0),cap=f.perDienst.reduce((s,d)=>s+(d.beschikbaar||0),0);
  const tekort=f.perDienst.filter(d=>d.tekortWeken>0);
  if(f.beschikbaarStandaard)return {waarde:`${getal(vraagNu,1)} FTE gevraagd`,sub:'Beschikbare FTE nog standaardwaarden; vul ze in om tekorten te zien',fractie:null};
  return {waarde:tekort.length?`Tekort bij ${getal(tekort.length)} ${tekort.length===1?'dienst':'diensten'}`:'Geen tekort komend jaar',sub:`Nu ${getal(vraagNu,1)} van ${getal(cap,1)} FTE gevraagd`,fractie:cap>0?Math.min(1,vraagNu/cap):null};
}

export function netwerkHtml(m){
  const n=m.netwerk;
  if(!n)return `<div class="empty"><b>Nog geen netwerkbeeld</b>Laad open storingen; met een netwerkschakelmatrix ziet u de schakels.</div>`;
  const kop=[[`${getal(n.geraakt)}`,`${n.soort} geraakt`],[`${getal(n.onderNorm)}`,`onder norm ${pct(n.norm,1)}`],n.actief?[`${pct(n.totaal?n.gekoppeld/n.totaal*100:0,0)}`,`gekoppeld aan een schakel (${getal(n.gekoppeld)} van ${getal(n.totaal)})`]:[`${getal(n.totaal)}`,'wegdelen in beeld · geen netwerkschakelmatrix']];
  const stat=`<div class="ov-netstat">${kop.map(([w,l])=>`<div><strong>${esc(w)}</strong><span>${esc(l)}</span></div>`).join('')}</div>`;
  if(!n.laagste.length)return stat+`<p class="muted">Geen geraakte ${esc(n.soort)}.</p>`;
  const rij=r=>{const b=r.besch??0;return `<li class="ov-net-rij"><div class="ov-net-kop"><span class="ov-net-naam">${esc(r.key)}</span><b>${r.besch==null?'Onbekend':pct(r.besch,2)}</b></div><svg class="ov-dienstbalk" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${esc(r.key)}: areaalbeschikbaarheid ${r.besch==null?'onbekend':pct(r.besch,2)}, norm ${pct(n.norm,1)}"><rect width="100" height="10" rx="2" class="ov-track"/><rect width="${Math.max(0,Math.min(100,b)).toFixed(2)}" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}"/><line x1="${n.norm}" x2="${n.norm}" y1="0" y2="10" class="ov-norm" vector-effect="non-scaling-stroke"/></svg><small>VC ${esc(r.vc||'onbekend')} · ${getal(r.n)} open · ${getal(r.N)} assets${r.zwakste?` · zwakste dienst ${esc(r.zwakste.naam)} ${pct(r.zwakste.besch,1)}`:''}${r.gekoppeld===false?' · <span class="ov-chip">niet gekoppeld</span>':''}</small></li>`;};
  return stat+`<p class="ov-subkop">Laagste areaalbeschikbaarheid</p><ul class="ov-netlijst">${n.laagste.map(rij).join('')}</ul>`;
}

export function mijlpalenHtml(m){
  const po=m.planOverzicht;
  if(!po)return `<div class="empty"><b>${m.planning?'Planning nog niet geopend':'Nog geen planning'}</b>${m.planning?'Open de planning eenmaal om mijlpalen te tonen.':'Laad je planning-XML.'}</div>`;
  if(!po.mijlpalen.length)return `<div class="empty"><b>Geen komende mijlpalen</b>${getal(po.mijlpalenTotaal)} mijlpalen in de planning, alle vóór ${esc(datumLabel(po.vandaag))}.</div>`;
  return `<ol class="ov-mijlpalen">${po.mijlpalen.map(x=>`<li><span class="ov-mp-dag"><strong>${esc(String(Number(x.datum.slice(8,10))))}</strong>${esc(['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'][Number(x.datum.slice(5,7))-1]||'')}</span><span class="ov-mp-tekst"><b>${esc(x.naam||'Naamloze mijlpaal')}</b><small>${esc(dagenTekst(x.dagen))} · ${esc(datumLabel(x.datum))}${x.project?` · ${esc(x.project)}`:''}</small></span></li>`).join('')}</ol><p class="muted ov-voetnoot">${getal(po.mijlpalenKomend)} komende en ${getal(po.mijlpalenVoorbij)} verstreken mijlpalen · datums inclusief scenarioverschuiving</p>`;
}

export function formatieHtml(m){
  const f=m.planOverzicht?.formatie,delen=[];
  if(f){
    const max=Math.max(1,...f.perDienst.map(d=>Math.max(d.piek,d.beschikbaar||0)));
    delen.push(`<p class="ov-subkop">FTE-vraag uit de planning${f.binnenPlanning?'':' · vandaag valt buiten de planningsperiode'}</p>${f.beschikbaarStandaard?'<p class="ov-let">Beschikbare FTE staan nog op de standaardwaarden. Tekorten worden pas getoond als je ze invult bij Planning, Dashboardbeheer.</p>':''}<ul class="ov-meterlijst">${f.perDienst.map(d=>{
      const tekort=!f.beschikbaarStandaard&&d.tekortWeken>0;
      return `<li class="ov-meter-rij"><span class="ov-meter-naam">${esc(d.dienst)}</span><span class="ov-meter-waarde">${getal(d.nu,1)} nu · piek ${getal(d.piek,1)}${d.beschikbaar!=null?` <small>/ ${getal(d.beschikbaar,1)} beschikbaar</small>`:''}</span><svg class="ov-meter" viewBox="0 0 100 8" preserveAspectRatio="none" role="img" aria-label="${esc(d.dienst)}: nu ${getal(d.nu,1)} FTE, piek ${getal(d.piek,1)}, beschikbaar ${d.beschikbaar==null?'onbekend':getal(d.beschikbaar,1)}"><rect width="100" height="8" rx="2" class="ov-track"/><rect width="${(d.piek/max*100).toFixed(2)}" height="8" rx="2" fill="${OVERZICHT_KLEUR.reeks}" fill-opacity=".28"/><rect width="${(d.nu/max*100).toFixed(2)}" height="8" rx="2" fill="${OVERZICHT_KLEUR.reeks}"/>${d.beschikbaar!=null?`<line x1="${(d.beschikbaar/max*100).toFixed(2)}" x2="${(d.beschikbaar/max*100).toFixed(2)}" y1="0" y2="8" class="ov-norm" vector-effect="non-scaling-stroke"/>`:''}</svg>${tekort?`<small class="ov-meter-meta ov-tekort">Tekort in ${getal(d.tekortWeken)} weken komend jaar, eerste vanaf ${esc(datumLabel(d.eersteTekort))}</small>`:d.piekDatum?`<small class="ov-meter-meta">Piek rond ${esc(datumLabel(d.piekDatum))}</small>`:''}</li>`;}).join('')}</ul><p class="ov-legenda"><span><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}"/></svg>Nu gevraagd</span><span><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}" fill-opacity=".28"/></svg>Piek vanaf nu</span><span><svg viewBox="0 0 10 10" aria-hidden="true"><line x1="5" x2="5" y1="0" y2="10" class="ov-norm"/></svg>Beschikbaar</span></p>`);
  }
  if(m.fte)delen.push(`<p class="ov-subkop">Bedrijfsfuncties (BI)</p><ul class="ov-meterlijst">${m.fte.lijst.map(x=>`<li class="ov-meter-rij"><span class="ov-meter-naam">${esc(x.naam)}</span><span class="ov-meter-waarde">${getal(Number(x.actueel),1)} <small>/ ${getal(Number(x.benodigd),1)} FTE</small></span></li>`).join('')}</ul>`);
  return delen.length?delen.join(''):null;
}

/* Verloop: vlak + lijn, één reeks, recessieve gridlijnen, hover via de schil. */
export function verloopHtml(m){
  if(!m.verloop.length)return {meta:'',html:`<div class="empty"><b>Nog geen verloop</b>Laad storingshistorie of open storingen met een startmoment.</div>`};
  const W=720,H=220,L=36,R=12,T=12,B=28,pw=W-L-R,ph=H-T-B,n=m.verloop.length,max=Math.max(1,...m.verloop.map(d=>d.nieuw));
  const nice=[1,2,5,10,20,25,50,100,200,250,500,1000,2000,5000,10000].find(s=>max/s<=4)||Math.ceil(max/4),top=Math.ceil(max/nice)*nice;
  const x=i=>L+(n===1?pw/2:i*pw/(n-1)),y=v=>T+ph-(v/top)*ph;
  const pad=pts=>pts.map(([i,v],k)=>(k?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join(' ');
  const alle=m.verloop.map((d,i)=>[i,d.nieuw]);
  /* De laatste dag loopt tot het peilmoment en is onvolledig: gestippeld, zonder vlak. */
  const lijn=pad(n>1?alle.slice(0,-1):alle),lopend=n>1?pad(alle.slice(-2)):'';
  const vlakPunten=n>1?alle.slice(0,-1):alle,vlakEind=vlakPunten[vlakPunten.length-1][0];
  const vlak=`${pad(vlakPunten)} L ${x(vlakEind).toFixed(1)} ${T+ph} L ${x(0).toFixed(1)} ${T+ph} Z`;
  const grid=[];for(let v=0;v<=top;v+=nice)grid.push(`<line x1="${L}" x2="${W-R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="ov-grid-lijn"/><text x="${L-6}" y="${(y(v)+3.5).toFixed(1)}" text-anchor="end" class="ov-as">${getal(v)}</text>`);
  const labelStap=Math.max(1,Math.ceil(n/6)),xl=m.verloop.map((d,i)=>i%labelStap===0||i===n-1?`<text x="${x(i).toFixed(1)}" y="${H-8}" text-anchor="middle" class="ov-as">${esc(dagLabel(d.dag))}</text>`:'').join('');
  const hit=m.verloop.map((d,i)=>{const w=pw/Math.max(1,n-1);return `<rect class="ov-hit" x="${(x(i)-w/2).toFixed(1)}" y="${T}" width="${w.toFixed(1)}" height="${ph}" data-ov-i="${i}" data-ov-dag="${esc(dagLabel(d.dag))}${i===n-1&&n>1?' (tot peilmoment)':''}" data-ov-n="${d.nieuw}" data-ov-x="${x(i).toFixed(1)}" data-ov-y="${y(d.nieuw).toFixed(1)}" tabindex="-1"/>`;}).join('');
  const maxDag=m.verloop.reduce((a,d)=>d.nieuw>a.nieuw?d:a,m.verloop[0]);
  const svg=`<div class="ov-chart" data-ov-chart><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Nieuwe storingen per dag, ${m.periode} dagen tot ${esc(dagLabel(m.verloopTot))}. In totaal ${getal(m.nieuwInPeriode)}, hoogste ${getal(maxDag.nieuw)} op ${esc(dagLabel(maxDag.dag))}." tabindex="0" data-ov-svg>${grid.join('')}<path d="${vlak}" fill="${OVERZICHT_KLEUR.reeks}" fill-opacity=".12"/><path d="${lijn}" fill="none" stroke="${OVERZICHT_KLEUR.reeks}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${lopend?`<path d="${lopend}" fill="none" stroke="${OVERZICHT_KLEUR.reeks}" stroke-width="2" stroke-dasharray="4 4" stroke-linecap="round" data-ov-lopend/>`:''}${xl}<line class="ov-crosshair" x1="0" x2="0" y1="${T}" y2="${T+ph}" visibility="hidden"/><circle class="ov-punt" r="4.5" cx="0" cy="0" fill="${OVERZICHT_KLEUR.reeks}" visibility="hidden"/>${hit}</svg><div class="ov-tooltip" role="status" hidden></div></div>`;
  const tabel=`<details class="ov-tabel"><summary>Toon als tabel</summary><div class="table-scroll"><table><thead><tr><th>Dag</th><th>Nieuwe storingen</th></tr></thead><tbody>${m.verloop.slice().reverse().map(d=>`<tr><td>${esc(d.dag)}</td><td>${getal(d.nieuw)}</td></tr>`).join('')}</tbody></table></div></details>`;
  const meta=`${getal(m.nieuwInPeriode)} storingen gestart in ${m.periode} dagen tot en met ${dagLabel(m.verloopTot)} · de laatste dag loopt tot het peilmoment en is gestippeld · bron: storingshistorie en open meldingen${m.verloopZonderStart?` · ${getal(m.verloopZonderStart)} zonder startmoment niet getoond`:''}`;
  return {meta,html:svg+tabel};
}

export function meterlijstHtml(rijen,{leeg,legenda=true}={}){
  if(!rijen.length)return `<div class="empty"><b>${esc(leeg||'Geen gegevens')}</b></div>`;
  const max=Math.max(1,...rijen.map(r=>r.n));
  const lijst=rijen.map(r=>{const zeker=Math.max(0,r.n-(r.onzeker||0));return `<li class="ov-meter-rij"><span class="ov-meter-naam">${esc(r.label)}</span><span class="ov-meter-waarde">${getal(r.n)}${r.onzeker?` <small>${getal(r.onzeker)} onzeker</small>`:''}</span>${meterSvg([{n:zeker,kleur:OVERZICHT_KLEUR.reeks},{n:r.onzeker||0,kleur:OVERZICHT_KLEUR.onzeker}],max,`${r.label}: ${getal(r.n)} open, ${getal(r.onzeker||0)} onzeker`)}${r.meta?`<small class="ov-meter-meta">${esc(r.meta)}</small>`:''}</li>`;}).join('');
  const sleutel=legenda?`<p class="ov-legenda"><span><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}"/></svg>Bevestigd open</span><span><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${OVERZICHT_KLEUR.onzeker}"/></svg>Onzeker of verouderd</span></p>`:'';
  return sleutel+`<ul class="ov-meterlijst">${lijst}</ul>`;
}

export function vcRijen(m){
  return m.vcs.map(r=>({label:r.vc,n:r.n,onzeker:r.onzeker,meta:r.peildatum==null?'Peilmoment onbekend':r.status}));
}

/* Dienstbalk: bereik lo-hi als band, bewezen waarde als volle balk, norm als streep. */
export function dienstenHtml(m){
  if(!m.diensten.length)return null;
  const schaal=v=>Math.max(0,Math.min(100,v));
  return m.diensten.map(x=>{
    const tekst=x.oordeel==='uitgesloten'?'Geen meetellende assetbron':x.besch!=null?pct(x.besch,2):`${getal(x.lo,1)}–${getal(x.hi,1)}%`;
    const oordeel={binnen:'Binnen norm',onder:'Onder norm',onzeker:'Onzeker: band raakt de norm',onbekend:'Onbekend',uitgesloten:'Telt niet mee'}[x.oordeel];
    const balk=x.oordeel==='uitgesloten'?'':`<svg class="ov-dienstbalk" viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label="${esc(x.naam)}: ${esc(tekst)}, norm ${pct(x.norm,1)}"><rect width="100" height="10" rx="2" class="ov-track"/>${x.besch!=null?`<rect width="${schaal(x.besch).toFixed(2)}" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}"/>`:`<rect width="${schaal(x.lo).toFixed(2)}" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}"/><rect x="${schaal(x.lo).toFixed(2)}" width="${Math.max(.6,schaal(x.hi)-schaal(x.lo)).toFixed(2)}" height="10" fill="${OVERZICHT_KLEUR.reeks}" fill-opacity=".28"/>`}<line x1="${schaal(x.norm)}" x2="${schaal(x.norm)}" y1="0" y2="10" class="ov-norm" vector-effect="non-scaling-stroke"/></svg>`;
    return `<div class="service-row ov-dienst" data-oordeel="${x.oordeel}"><div class="service-line"><span>${esc(x.naam)}</span><b>${esc(tekst)}</b></div>${balk}<div class="service-meta-action"><small><span class="ov-oordeel">${esc(oordeel)}</span> · norm ${pct(x.norm,1)} · bekende brondekking ${pct((Number(x.dekking)||0)*100,0)}</small><button type="button" data-expert-service="${esc(x.id)}">Expertinvoer</button></div></div>`;
  }).join('')+`<p class="ov-legenda"><span><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}"/></svg>Bewezen beschikbaar</span><span><svg viewBox="0 0 10 10" aria-hidden="true"><rect width="10" height="10" rx="2" fill="${OVERZICHT_KLEUR.reeks}" fill-opacity=".28"/></svg>Onzeker door brondekking</span><span><svg viewBox="0 0 10 10" aria-hidden="true"><line x1="5" x2="5" y1="0" y2="10" class="ov-norm"/></svg>Norm</span></p>`;
}

/* Hoverlaag voor het verloop: crosshair, punt en tooltip. Labels via textContent. */
export function koppelVerloopHover(host){
  const chart=host?.querySelector('[data-ov-chart]');if(!chart||chart.dataset.ovHover)return;
  chart.dataset.ovHover='1';
  const svg=chart.querySelector('svg'),tip=chart.querySelector('.ov-tooltip'),lijn=svg.querySelector('.ov-crosshair'),punt=svg.querySelector('.ov-punt'),hits=[...svg.querySelectorAll('.ov-hit')];
  let actief=-1;
  const toon=i=>{
    const r=hits[i];if(!r)return;actief=i;
    const x=r.dataset.ovX,y=r.dataset.ovY;
    lijn.setAttribute('x1',x);lijn.setAttribute('x2',x);lijn.setAttribute('visibility','visible');
    punt.setAttribute('cx',x);punt.setAttribute('cy',y);punt.setAttribute('visibility','visible');
    tip.replaceChildren();const v=document.createElement('strong');v.textContent=Number(r.dataset.ovN).toLocaleString('nl-NL')+' nieuw';const d=document.createElement('span');d.textContent=r.dataset.ovDag;tip.append(v,d);
    tip.hidden=false;const box=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal,px=Number(x)/vb.width*box.width,py=Number(y)/vb.height*box.height;
    tip.style.left=Math.min(Math.max(px,60),box.width-60)+'px';tip.style.top=Math.max(py-12,0)+'px';
  };
  const verberg=()=>{actief=-1;tip.hidden=true;lijn.setAttribute('visibility','hidden');punt.setAttribute('visibility','hidden');};
  svg.addEventListener('pointermove',e=>{const r=e.target.closest?.('.ov-hit');if(r)toon(Number(r.dataset.ovI));});
  svg.addEventListener('pointerleave',verberg);
  svg.addEventListener('focus',()=>toon(actief<0?hits.length-1:actief));svg.addEventListener('blur',verberg);
  svg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();toon(Math.max(0,Math.min(hits.length-1,(actief<0?hits.length-1:actief)+(e.key==='ArrowLeft'?-1:1))));}else if(e.key==='Escape')verberg();});
}
