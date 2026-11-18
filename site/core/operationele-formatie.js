/* Operationele formatie per verkeerscentrale (2.92 / DVM 165).

   Uitgangspunt: per VC en per rol de formatie die nodig is als alle signaalgevers op de
   norm zitten (bijvoorbeeld ZWN, wegverkeersleider, 70 FTE), en de formatie die nu
   beschikbaar is. Storingen verhogen de werklast: per schakel onder de norm komt er per
   procentpunt een instelbaar percentage werk bij, naar rato van het aandeel van die
   schakel in de VC. Alle variabelen staan in de werkruimte en zijn in te stellen.

   Rekenregel per VC, rol r en schakel s:
     aandeel(s)   = gewicht(s) / som gewichten in de VC   (gewicht = signaalgevers of 1)
     tekort(s)    = max(0, norm - beschikbaarheid(s))     (procentpunten)
     factor(s,r)  = min(maxExtraPct, tekort(s) × gevoeligheid(r)) / 100
     extra(r)     = uitgangspunt(r) × som_s aandeel(s) × factor(s,r)
     benodigd(r)  = uitgangspunt(r) + extra(r)
     ruimte(r)    = beschikbaar(r) - benodigd(r)
     bezetting(r) = posities 24/7 × FTE per positie, getoetst aan beschikbaar(r)
   De berekening is een toets. Ze verandert geen dienstwaarden, kosten of normen. */

import {standaardIngenieur,normaliseerIngenieur,berekenIngenieur,formatieFactor,ingenieurVcHtml,ingenieurInstellingenHtml} from './ingenieursmodel.js?v=20261118-1600';

/* 2.93: methode 'ingenieursbureau' gebruikt core/ingenieursmodel.js op de huidige
   storingsstand. Per rol bepaalt 'koppeling' welke factor geldt: bediening
   (bedieningsfactor) of inspectie (blootstelling weginspectie). Extra = uitgangspunt ×
   (factor - 1). De methode 'gevoeligheid' blijft zoals in 2.92. */
export const OP_ROLLEN=[
  {id:'wvl',naam:'Wegverkeersleider',gevoeligheid:5,koppeling:'bediening'},
  {id:'cwvl',naam:'Coördinerend wegverkeersleider',gevoeligheid:2,koppeling:'bediening'},
  {id:'ovd',naam:'Officier van dienst (weginspectie)',gevoeligheid:1,koppeling:'inspectie'},
  {id:'wi',naam:'Weginspecteur',gevoeligheid:3,koppeling:'inspectie'}
];
const KOPPELINGEN={bediening:'Bediening (bedieningsfactor)',inspectie:'Weginspectie (blootstelling)',geen:'Geen'};
export const OP_VCS=['ZWN','ZN','MN','NWN','NON'];

export function standaardOpFormatie(){
  return {schema:1,bijgewerkt:null,methode:'gevoeligheid',ingenieur:standaardIngenieur(),norm:null,verdeling:'signaalgevers',ftePerPositie:5.5,maxExtraPct:100,
    rollen:OP_ROLLEN.map(r=>({...r})),
    vcs:Object.fromEntries(OP_VCS.map(vc=>[vc,Object.fromEntries(OP_ROLLEN.map(r=>[r.id,{uitgangspunt:null,beschikbaar:null,posities:null}]))]))};
}
const getalOfNull=v=>v===''||v==null||!Number.isFinite(Number(v))?null:Number(v);
const begrensd=(v,min,max,fb)=>{const n=getalOfNull(v);return n==null?fb:Math.max(min,Math.min(max,n));};

/* Zet een opgeslagen of geïmporteerde instelling om naar een volledig, veilig object. */
export function normaliseerOpFormatie(x){
  const d=standaardOpFormatie();if(!x||typeof x!=='object')return d;
  const rollen=Array.isArray(x.rollen)&&x.rollen.length?x.rollen:d.rollen;
  const uit={schema:1,bijgewerkt:typeof x.bijgewerkt==='string'&&/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(x.bijgewerkt)?x.bijgewerkt:null,methode:x.methode==='ingenieursbureau'?'ingenieursbureau':'gevoeligheid',ingenieur:normaliseerIngenieur(x.ingenieur),norm:x.norm==null||x.norm===''?null:begrensd(x.norm,0,100,null),verdeling:x.verdeling==='gelijk'?'gelijk':'signaalgevers',
    ftePerPositie:begrensd(x.ftePerPositie,0.1,20,d.ftePerPositie),maxExtraPct:begrensd(x.maxExtraPct,0,1000,d.maxExtraPct),
    rollen:rollen.map((r,i)=>({id:String(r.id||'rol'+i).replace(/[^a-z0-9_-]/gi,'').slice(0,24)||'rol'+i,naam:String(r.naam||'Rol').slice(0,80),gevoeligheid:begrensd(r.gevoeligheid,0,100,0),koppeling:Object.hasOwn(KOPPELINGEN,r.koppeling)?r.koppeling:(OP_ROLLEN.find(o=>o.id===r.id)?.koppeling||'geen')})),vcs:{}};
  const vcs=x.vcs&&typeof x.vcs==='object'?x.vcs:{};
  for(const vc of [...new Set([...OP_VCS,...Object.keys(vcs)])]){
    const naam=String(vc).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,12);if(!naam)continue;
    uit.vcs[naam]=Object.fromEntries(uit.rollen.map(r=>{const v=vcs[vc]?.[r.id]||{};return [r.id,{uitgangspunt:begrensd(v.uitgangspunt,0,10000,null),beschikbaar:begrensd(v.beschikbaar,0,10000,null),posities:begrensd(v.posities,0,1000,null)}];}));
  }
  return uit;
}

/* basis: {norm, soort, rijen:[{key,vc,N,besch,n}]} uit de DVM-samenvatting.
   whatIf: {[schakelKey]: beschikbaarheid} voor een tijdelijke test. */
export function berekenOpFormatie(instelling,basis,{whatIf={},gevolgen=null}={}){
  const s=normaliseerOpFormatie(instelling),norm=s.norm??(Number.isFinite(Number(basis?.norm))?Number(basis.norm):null);
  const rijen=(basis?.rijen||[]).map(r=>({...r,besch:Object.hasOwn(whatIf,r.key)?Number(whatIf[r.key]):Number(r.besch)}));
  const ing=s.methode==='ingenieursbureau';
  const vcs=[...new Set([...Object.keys(s.vcs),...rijen.map(r=>r.vc).filter(Boolean),...Object.keys(gevolgen?.perVc||{}).filter(v=>v!=='onbekend')])];
  const perVc=vcs.map(vc=>{
    const eigen=rijen.filter(r=>r.vc===vc),gewicht=r=>s.verdeling==='gelijk'?1:Math.max(0,Number(r.N)||0),som=eigen.reduce((t,r)=>t+gewicht(r),0);
    const instVc=s.vcs[vc]||{},ingenieur=gevolgen?.perVc?.[vc]?berekenIngenieur(gevolgen.perVc[vc],{norm,instelling:s.ingenieur}):null;
    const schakels=eigen.map(r=>{const aandeel=som>0?gewicht(r)/som:0,tekort=norm==null||!Number.isFinite(r.besch)?0:Math.max(0,norm-r.besch);return {...r,aandeel,tekort};});
    const rollen=s.rollen.map(rol=>{
      const v=instVc[rol.id]||{},basisFte=v.uitgangspunt;
      const extra=basisFte==null?null:ing?basisFte*(formatieFactor(ingenieur,rol.koppeling)-1):schakels.reduce((t,x)=>t+basisFte*x.aandeel*Math.min(s.maxExtraPct,x.tekort*rol.gevoeligheid)/100,0);
      const beschikbaar=v.beschikbaar??basisFte,benodigd=basisFte==null?null:basisFte+extra,bezetting=v.posities==null?null:v.posities*s.ftePerPositie;
      return {id:rol.id,naam:rol.naam,uitgangspunt:basisFte,beschikbaar,extra,benodigd,ruimte:benodigd==null||beschikbaar==null?null:beschikbaar-benodigd,
        bezetting,bezettingOk:bezetting==null||beschikbaar==null?null:beschikbaar>=bezetting,beschikbaarIngevuld:v.beschikbaar!=null};
    });
    const ingevuld=rollen.some(r=>r.uitgangspunt!=null);
    const drijvers=schakels.filter(x=>x.tekort>0).map(x=>({key:x.key,besch:x.besch,tekort:x.tekort,aandeel:x.aandeel,n:x.n,
      extra:s.rollen.reduce((t,rol)=>{const b=instVc[rol.id]?.uitgangspunt;return t+(b==null?0:b*x.aandeel*Math.min(s.maxExtraPct,x.tekort*rol.gevoeligheid)/100);},0)}))
      .sort((a,b)=>b.extra-a.extra||b.tekort-a.tekort);
    const tot=k=>rollen.reduce((t,r)=>t+(r[k]??0),0);
    return {vc,ingevuld,ingenieur,rollen,schakels:schakels.length,onderNorm:drijvers.length,drijvers:drijvers.slice(0,5),
      extra:ingevuld?tot('extra'):null,ruimte:ingevuld?rollen.filter(r=>r.ruimte!=null).reduce((t,r)=>t+r.ruimte,0):null,
      tekortRollen:rollen.filter(r=>r.ruimte!=null&&r.ruimte<-1e-9).length,bezettingTekort:rollen.filter(r=>r.bezettingOk===false).length};
  }).sort((a,b)=>Number(b.ingevuld)-Number(a.ingevuld)||OP_VCS.indexOf(a.vc)-OP_VCS.indexOf(b.vc));
  const ingevuld=perVc.filter(v=>v.ingevuld);
  return {methode:s.methode,heeftGevolgen:!!gevolgen?.perVc,norm,normBron:s.norm!=null?'instelling':norm!=null?'Regels':'onbekend',soort:basis?.soort||null,heeftBasis:!!rijen.length,instelling:s,perVc,
    ingevuld:ingevuld.length,tekortVcs:ingevuld.filter(v=>v.tekortRollen>0||v.bezettingTekort>0).length,extraTotaal:ingevuld.reduce((t,v)=>t+(v.extra||0),0),
    whatIf:Object.keys(whatIf).length?whatIf:null};
}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(n,d=1)=>n==null||!Number.isFinite(n)?'–':new Intl.NumberFormat('nl-NL',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const teken=n=>n==null?'–':(n>0.0005?'+':'')+fmt(n);

/* Uitkomst: per VC een kaart met per rol uitgangspunt, beschikbaar, extra, benodigd en ruimte. */
export function opFormatieUitkomstHtml(u){
  if(!u.ingevuld)return `<div class="empty"><b>Nog geen uitgangspunt ingevuld</b>Vul hieronder bij Instellingen per verkeerscentrale de formatie per rol in, bijvoorbeeld ZWN, wegverkeersleider, 70 FTE.</div>`;
  const kop=`<p class="op-kop">Methode: <b>${u.methode==='ingenieursbureau'?'ingenieursbureau':'gevoeligheid per rol'}</b> · norm ${u.norm==null?'onbekend':fmt(u.norm,1)+'%'} (${esc(u.normBron)}) · ${u.heeftBasis?`${esc(u.soort||'schakels')} uit de geladen storingen`:'nog geen storingsbron: extra werklast is 0'}${u.whatIf&&u.methode!=='ingenieursbureau'?' · <b>wat-als-test actief</b>':''}</p>`;
  const kaart=v=>{
    if(!v.ingevuld)return '';
    const status=v.tekortRollen||v.bezettingTekort?`<span class="op-status op-tekort">Tekort bij ${v.tekortRollen+v.bezettingTekort} ${v.tekortRollen+v.bezettingTekort===1?'rol':'rollen'}</span>`:'<span class="op-status op-ok">Past</span>';
    const rij=r=>r.uitgangspunt==null?'':`<tr><th scope="row">${esc(r.naam)}</th><td>${fmt(r.uitgangspunt)}</td><td>${fmt(r.beschikbaar)}${r.beschikbaarIngevuld?'':' <small>(=uitgangspunt)</small>'}</td><td>${teken(r.extra)}</td><td>${fmt(r.benodigd)}</td><td class="${r.ruimte<-1e-9?'op-neg':'op-pos'}">${teken(r.ruimte)}</td><td>${r.bezetting==null?'–':`${fmt(r.bezetting)} ${r.bezettingOk?'✓':'<b class="op-neg">tekort</b>'}`}</td></tr>`;
    const drijvers=u.methode==='ingenieursbureau'?(v.ingenieur?`<p class="muted">Bediening × ${fmt(v.ingenieur.bedieningsfactor,2)} · weginspectie × ${fmt(v.ingenieur.blootstelling,2)} · ${fmt(v.ingenieur.inspecteursuren,0)} extra inspecteursuren. Zie Operationele gevolgen hieronder.</p>`:'<p class="muted">Nog geen storingsstand voor deze VC.</p>'):v.drijvers.length?`<p class="ov-subkop">Grootste bijdrage aan extra werklast</p><ul class="op-drijvers">${v.drijvers.map(d=>`<li><b>${esc(d.key)}</b> ${fmt(d.besch,2)}% · ${fmt(d.tekort,2)} pp onder norm · aandeel ${fmt(d.aandeel*100,1)}% · ${teken(d.extra)} FTE</li>`).join('')}</ul>`:'<p class="muted">Geen schakels onder de norm in deze VC.</p>';
    return `<article class="op-vc"><header><h3>VC ${esc(v.vc)}</h3>${status}</header><p class="muted">${v.schakels} schakels in beeld · ${v.onderNorm} onder de norm · ${teken(v.extra)} FTE extra door storingen</p><div class="table-scroll"><table class="op-tabel"><thead><tr><th>Rol</th><th>Uitgangspunt</th><th>Beschikbaar</th><th>Extra</th><th>Benodigd</th><th>Ruimte</th><th>Minimale bezetting</th></tr></thead><tbody>${v.rollen.map(rij).join('')}</tbody></table></div>${drijvers}</article>`;
  };
  return kop+`<div class="op-vcs">${u.perVc.map(kaart).join('')}</div>`;
}

/* Operationele gevolgen per VC volgens de rekenmethode van het ingenieursbureau. */
export function opGevolgenHtml(u){
  if(!u.heeftGevolgen)return `<div class="empty"><b>Nog geen storingsstand</b>Laad het assetregister en de open storingen om de operationele gevolgen te zien.</div>`;
  const vcs=u.perVc.filter(v=>v.ingenieur);
  return vcs.length?`<div class="op-vcs">${vcs.map(v=>ingenieurVcHtml(v.vc,v.ingenieur)).join('')}</div>`:'<div class="empty"><b>Geen signaalgevers, camera’s, lussen of DRIP’s in het areaal</b>De rekenmethode heeft een areaal per VC nodig.</div>';
}

/* Instellingen: alle variabelen als invoervelden met data-op-*-attributen. */
export function opFormatieInstellingenHtml(u,{schakels=[],whatIf=null}={}){
  const s=u.instelling,veld=(attr,waarde,{step='0.1',min='0',max='',placeholder='',label=''}={})=>`<input type="number" ${attr} value="${waarde==null?'':esc(waarde)}" step="${step}" min="${min}"${max?` max="${max}"`:''}${placeholder?` placeholder="${esc(placeholder)}"`:''} aria-label="${esc(label)}">`;
  const algemeen=`<div class="op-velden">
    <label>Rekenmethode<select data-op-alg="methode"><option value="gevoeligheid"${s.methode!=='ingenieursbureau'?' selected':''}>Gevoeligheid per rol (per schakel onder de norm)</option><option value="ingenieursbureau"${s.methode==='ingenieursbureau'?' selected':''}>Ingenieursbureau (operationele gevolgen)</option></select><small>Ingenieursbureau: bediening en weginspectie volgen de factoren uit Operationele gevolgen.</small></label>
    <label>Norm signaalgevers (%)${veld('data-op-alg="norm"',s.norm,{step:'0.1',max:'100',placeholder:u.norm!=null&&s.norm==null?fmt(u.norm,1)+' uit Regels':'uit Regels',label:'Norm signaalgevers'})}<small>Leeg = norm uit Regels.</small></label>
    <label>Verdeling werklast over schakels<select data-op-alg="verdeling"><option value="signaalgevers"${s.verdeling==='signaalgevers'?' selected':''}>Naar aantal signaalgevers</option><option value="gelijk"${s.verdeling==='gelijk'?' selected':''}>Gelijk per schakel</option></select></label>
    <label>FTE per 24/7-positie${veld('data-op-alg="ftePerPositie"',s.ftePerPositie,{step:'0.1',min:'0.1',label:'FTE per 24/7-positie'})}<small>Voor de toets op minimale bezetting.</small></label>
    <label>Maximum extra werklast per schakel (%)${veld('data-op-alg="maxExtraPct"',s.maxExtraPct,{step:'5',label:'Maximum extra werklast'})}<small>Bovengrens bij grote uitval.</small></label>
  </div>`;
  const rollen=`<table class="op-tabel op-rollen"><thead><tr><th>Rol</th><th>Gevoeligheid (% extra werk per procentpunt onder de norm)</th><th>Koppeling bij methode ingenieursbureau</th></tr></thead><tbody>${s.rollen.map(r=>`<tr><th scope="row">${esc(r.naam)}</th><td>${veld(`data-op-rol="${esc(r.id)}"`,r.gevoeligheid,{step:'0.5',label:'Gevoeligheid '+r.naam})}</td><td><select data-op-rolkop="${esc(r.id)}" aria-label="Koppeling ${esc(r.naam)}">${Object.entries(KOPPELINGEN).map(([k,l])=>`<option value="${k}"${r.koppeling===k?' selected':''}>${esc(l)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`;
  const vcs=Object.keys(s.vcs);
  const perVc=`<div class="table-scroll"><table class="op-tabel op-invoer"><thead><tr><th rowspan="2">VC</th>${s.rollen.map(r=>`<th colspan="3">${esc(r.naam)}</th>`).join('')}</tr><tr>${s.rollen.map(()=>'<th>Uitgangspunt FTE</th><th>Beschikbaar FTE</th><th>Posities 24/7</th>').join('')}</tr></thead><tbody>${vcs.map(vc=>`<tr><th scope="row">${esc(vc)}</th>${s.rollen.map(r=>{const v=s.vcs[vc][r.id];return `<td>${veld(`data-op-vc="${esc(vc)}" data-op-veld="uitgangspunt" data-op-rolid="${esc(r.id)}"`,v.uitgangspunt,{step:'0.5',label:`${vc} ${r.naam} uitgangspunt`})}</td><td>${veld(`data-op-vc="${esc(vc)}" data-op-veld="beschikbaar" data-op-rolid="${esc(r.id)}"`,v.beschikbaar,{step:'0.5',placeholder:'gelijk',label:`${vc} ${r.naam} beschikbaar`})}</td><td>${veld(`data-op-vc="${esc(vc)}" data-op-veld="posities" data-op-rolid="${esc(r.id)}"`,v.posities,{step:'1',label:`${vc} ${r.naam} posities`})}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
  const opties=schakels.slice(0,400).map(x=>`<option value="${esc(x.key)}"${whatIf&&Object.hasOwn(whatIf,x.key)?' selected':''}>${esc(x.key)} · VC ${esc(x.vc)} · ${fmt(x.besch,2)}%</option>`).join('');
  const watAls=`<div class="op-velden op-watals"><label>Schakel<select data-op-watals-schakel><option value="">Kies een schakel</option>${opties}</select></label><label>Beschikbaarheid (%)<input type="number" data-op-watals-waarde step="0.1" min="0" max="100" value="${whatIf?esc(Object.values(whatIf)[0]):''}" aria-label="Wat-als beschikbaarheid"></label><div class="op-knoppen"><button type="button" data-op-watals-test>Test</button><button type="button" class="text-button" data-op-watals-wis${whatIf?'':' disabled'}>Test wissen</button></div></div>`;
  return `<details class="op-instellingen" open><summary>Instellingen</summary>
    <h3>Uitgangspunt per verkeerscentrale</h3><p class="muted">Uitgangspunt: de formatie die nodig is als alle signaalgevers op de norm zitten. Beschikbaar: wat er nu is (leeg of 'gelijk' = gelijk aan het uitgangspunt). Posities 24/7: optioneel, voor de toets op minimale bezetting.</p>${perVc}
    <h3>Rollen</h3><p class="muted">Hoeveel werk komt er per rol bij als een schakel 1 procentpunt onder de norm zit? Voorbeeld: 5 betekent bij 4 procentpunt tekort 20% extra werk op het aandeel van die schakel.</p>${rollen}
    <h3>Algemeen</h3>${algemeen}
    ${ingenieurInstellingenHtml(s.ingenieur)}
    <h3>Wat-als</h3><p class="muted">Test tijdelijk een andere beschikbaarheid voor één schakel, bij de methode gevoeligheid per rol. Wordt niet opgeslagen.</p>${watAls}
    <div class="op-knoppen"><button type="button" class="text-button" data-op-standaard>Standaardwaarden voor rollen en algemeen</button></div>
  </details>`;
}

/* Korte samenvatting voor de pijplijn op het Overzicht. */
export function opFormatieSamenvatting(u){
  if(!u||!u.ingevuld)return null;
  return {waarde:u.tekortVcs?`Tekort bij ${u.tekortVcs} ${u.tekortVcs===1?'VC':'VC’s'}`:'Formatie past',sub:`Operationeel ${teken(u.extraTotaal)} FTE door storingen · ${u.ingevuld} ${u.ingevuld===1?'VC':'VC’s'} ingevuld · balk = deel zonder tekort`,fractie:(u.ingevuld-u.tekortVcs)/u.ingevuld,tekort:u.tekortVcs>0};
}
