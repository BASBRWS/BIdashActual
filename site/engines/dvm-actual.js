/* Actuele diensten en regio's gebruiken dezelfde assetbanden als Dienstimpact. */
let ACTUAL_DIENST_VC='';
function actualBronVCs(){
  const uit=new Set();
  for(const [v,t] of Object.entries(globalThis.__BIDASH_SIGNAALGEVER_TOTAAL__?.laatstePerVc||{}))if(DVM_INCIDENT_LIFECYCLE.time(t)!=null)uit.add(normAssetVc(v));
  for(const b of LIVE_STORINGSBRONNEN||[])for(const raw of b.rijen||[]){try{const vc=normAssetVc(normRij(raw).vc);if(vc)uit.add(vc);}catch(error){}}
  return [...uit].filter(Boolean).sort();
}
function actualBronMomentHtml(vcs){
  const stand=globalThis.__BIDASH_SIGNAALGEVER_TOTAAL__?.laatstePerVc||{},rows=Object.entries(stand).filter(([v,t])=>(!vcs||vcs.includes(normAssetVc(v)))&&DVM_INCIDENT_LIFECYCLE.time(t)!=null);
  if(rows.length)return rows.map(([v,t])=>esc(normAssetVc(v))+' '+esc(new Date(t).toLocaleString('nl-NL'))).join(' · ');
  const times=(LIVE_STORINGSBRONNEN||[]).filter(b=>!vcs||(b.rijen||[]).some(raw=>{try{return vcs.includes(normAssetVc(normRij(raw).vc));}catch(error){return false;}})).map(b=>DVM_INCIDENT_LIFECYCLE.time(b.peildatum)).filter(t=>t!=null);
  return times.length?esc(new Date(Math.max(...times)).toLocaleString('nl-NL')):'Geen bronmoment voor deze selectie vastgelegd';
}
function actualDienstScherm(){
  if(ACTUAL_DIENST_VC&&!v68Assets().some(a=>normAssetVc(a.vc)===normAssetVc(ACTUAL_DIENST_VC))&&!actualBronVCs().includes(normAssetVc(ACTUAL_DIENST_VC)))ACTUAL_DIENST_VC='';
  const vc=normAssetVc(ACTUAL_DIENST_VC),scope=vc?m=>normAssetVc(m.vc)===vc:null;
  return {vc,scope,model:v68LandelijkModel(scope),meldingen:(STATE?.meldingen||[]).filter(scope||(()=>true)),niet:(STATE?.nietDoorgerekend||[]).filter(scope||(()=>true))};
}
function wijzigActualDienstVc(vc){ACTUAL_DIENST_VC=normAssetVc(vc)||'';if(STATE)renderOverzicht();}
function actualBandDiagnoseHtml(model){
  const gebruikt=new Set(model.diensten.flatMap(d=>d.detail.flatMap(sp=>sp.bronnen.map(b=>b.tp))));
  const redenen=[];
  for(const tp of V68_TYPES){const b=model.typen[tp];if(!gebruikt.has(tp))continue;
    if(!b.bevestigd)redenen.push(V68_LABEL[tp]+': volledigheid van de bron niet bevestigd');
    if(b.onplaatsbaar)redenen.push(V68_LABEL[tp]+': onbekende impact zonder bruikbare assetkoppeling');
    if(b.onbekendeAssets)redenen.push(V68_LABEL[tp]+': '+b.onbekendeAssets.toLocaleString('nl-NL')+' assets onzeker of zonder volledige VC-dekking');
    if(b.combiOnzeker)redenen.push(V68_LABEL[tp]+': mogelijke combinatie met een onzekere melding');
    if(!b.n)redenen.push(V68_LABEL[tp]+': geen actief areaal in deze selectie');
  }
  return `<details data-band-diagnose><summary>Waarom is de band breed?</summary><p>Een ondergrens van nul betekent dat gegevens ontbreken. Het is geen vastgestelde volledige uitval. De bovengrens houdt de bevestigde uitval wel vast.</p>${redenen.length?'<ul>'+redenen.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':'<p>De benodigde bronnen en assettoestanden zijn volledig bevestigd.</p>'}</details>`;
}
function actualDienstTabelHtml(model){
  return `<div class="tbl-scroll" style="max-height:none"><table class="tbl" data-dienst-banden><thead><tr><th>Dienstverlening</th><th>Beschikbaarheid</th><th>Prestatie</th><th>Norm</th><th>Bekende dekking</th></tr></thead><tbody>${model.diensten.map(r=>`<tr data-dienst="${esc(r.d.id)}"><td><b>${esc(r.d.naam.replace(/&amp;/g,'&'))}</b></td><td>${v68Bereik(r)}</td><td>${r.exact?v68Pct(r.prestatie):fmt(r.loP,2)+' tot '+fmt(r.hiP,2)+'%'}</td><td>${fmt(r.d.norm,1)}%</td><td>${fmt(r.dekking*100,1)}%</td></tr>`).join('')}</tbody></table></div>`;
}
function actualSubprocessenHtml(model){
  return model.diensten.map(r=>`<details data-dienst-subprocessen="${esc(r.d.id)}"><summary>${esc(r.d.naam.replace(/&amp;/g,'&'))}, subprocessen en afhankelijkheden</summary><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Subproces</th><th>Aandeel dienst</th><th>Beschikbaarheid</th><th>Prestatie</th><th>Assetafhankelijkheden</th></tr></thead><tbody>${r.detail.map(sp=>`<tr><td>${esc(sp.naam)}</td><td>${fmt(sp.w*100,1)}%</td><td>${fmt(sp.loB,2)} tot ${fmt(sp.hiB,2)}%</td><td>${fmt(sp.loP,2)} tot ${fmt(sp.hiP,2)}%</td><td>${sp.bronnen.map(b=>esc(V68_LABEL[b.tp]||b.obj)+' '+fmt(b.w*100,1)+'%').join(', ')}</td></tr>`).join('')}</tbody></table></div></details>`).join('');
}
function actualDienstOverzichtHtml(){
  const s=actualDienstScherm(),m=s.model,geladen=actualBronVCs(),vcs=[...new Set(v68Assets().map(a=>normAssetVc(a.vc)).filter(Boolean).concat(geladen))].sort();
  const gekoppeld=s.meldingen.filter(x=>x.assetKey).length;
  return `<div class="card" style="border-left:5px solid var(--rws-blauw)" data-actual-dienst-scope="${esc(s.vc||'landelijk')}"><h3>${s.vc?'Dienstbeschikbaarheid voor VC '+esc(s.vc):'Landelijke beschikbaarheid over het volledige assetregister'}</h3>
    <label>Verkeerscentrale voor dienstimpact <select id="actualDienstVc" onchange="wijzigActualDienstVc(this.value)"><option value="">Landelijk, volledig register</option>${vcs.map(v=>`<option value="${esc(v)}"${v===s.vc?' selected':''}>${esc(v)}${geladen.includes(v)?' · bron aanwezig':' · geen bron voor deze VC'}</option>`).join('')}</select></label>
    <p><b>Berekening uitgevoerd.</b> ${s.meldingen.length.toLocaleString('nl-NL')} meldingen doorgerekend, ${s.niet.length.toLocaleString('nl-NL')} niet doorgerekend. ${m.assets.toLocaleString('nl-NL')} actieve assets in ${s.vc?'VC '+esc(s.vc):'het volledige landelijke register'}. ${gekoppeld.toLocaleString('nl-NL')} doorgerekende meldingen hebben een assetkoppeling.</p>
    <p>Bronmoment: ${actualBronMomentHtml(s.vc?[s.vc]:null)}. ${!s.vc&&geladen.length?'Bronnen aangetroffen voor '+esc(geladen.join(', '))+'. Kies een VC om haar eigen areaal en dienstband te bekijken.':''}</p>
    <div class="grid4">${m.diensten.map(r=>`<div class="kpi"><div class="k-val" style="font-size:${r.exact?'25px':'17px'}">${v68Bereik(r)}</div><div class="k-lab">${esc(r.d.naam.replace(/&amp;/g,'&'))}<br>brondekking ${fmt(r.dekking*100,1)}%</div></div>`).join('')}</div>
    ${actualBandDiagnoseHtml(m)}
    <details><summary>Brondekking bekijken en bevestigen</summary><p>Deze bevestigingen gelden voor de bronnen voor het volledige geladen register. De VC-keuze hierboven verandert alleen de getoonde selectie. Een ontbrekende MTM-centrale blijft onbekend.</p>${v68BronnenHtml(v68LandelijkModel())}</details>
  </div>`;
}
function actualRegioRows(){
  return rapportRegioRows().map(r=>{
    const scope=m=>rapportBestuurKey(m)===r.key,model=v68LandelijkModel(scope),meldingen=(STATE?.meldingen||[]).filter(scope),niet=(STATE?.nietDoorgerekend||[]).filter(scope);
    return {...r,model,meldingen,niet,liveStoringen:meldingen.length+niet.length,liveMin:null,liveZwakste:''};
  });
}
function openActualRegio(key){
  RAPPORT_REGIO_SELECTIE=String(key||'');
  const knop=parent!==window?parent.document.querySelector('#secondaryNav [data-route="region"]'):null;
  if(knop)knop.click();else{renderRapport();toonTab('rapport');}
}
function actualRegioVergelijkingHtml(rows){
  return `<div class="card"><h3>Operationele dagstand per ${esc(rapportModusLabel())}</h3><p>Elke regio gebruikt haar eigen actieve areaal en dezelfde dienstberekening als Dienstimpact. Geen geladen bron betekent onbekend, ook bij nul meldingen.</p><div class="tbl-scroll"><table class="tbl" data-regio-vergelijking><thead><tr><th>Regio</th><th>VC</th><th>Assets</th><th>Doorgerekend</th><th>Niet doorgerekend</th><th>Dienstbanden</th></tr></thead><tbody>${rows.map(r=>`<tr data-regio-key="${esc(r.key)}"><td><button class="linkbtn" data-regio="${esc(r.key)}" onclick="openActualRegio(this.dataset.regio)">${esc(r.scopeLabel)}</button></td><td>${esc(r.vcLabel)}</td><td>${r.assets.toLocaleString('nl-NL')}</td><td>${r.meldingen.length.toLocaleString('nl-NL')}</td><td>${r.niet.length.toLocaleString('nl-NL')}</td><td><ul>${r.model.diensten.map(d=>`<li>${esc(d.d.naam.replace(/&amp;/g,'&'))}: ${v68Bereik(d)}</li>`).join('')}</ul></td></tr>`).join('')}</tbody></table></div></div>`;
}
function actualRegioContextHtml(r){
  const live=rapportRegioLiveWegdelen(r).filter(w=>w.n>0),werk=rapportRegioWerkItems(r),routes=rapportRegioRouteItems(r);
  const lijst=items=>items.length?'<ul class="regio-focus-list">'+items.join('')+'</ul>':'<p>Geen gekoppelde gegevens in deze selectie.</p>';
  const redenen=new Map();for(const m of r.niet){const k=m.rekenStatus||'Onbekende impact';redenen.set(k,(redenen.get(k)||0)+1);}
  return `<div class="regio-focus-grid">
    <div class="regio-focus-blok"><h4>Geraakte netwerkschakels en wegdelen</h4>${lijst(live.map(w=>`<li><button class="linkbtn" onclick="openLiveWegdeelPopup('${encodeURIComponent(w.key)}')">${esc(w.key)}</button>, ${w.n} doorgerekende meldingen</li>`))}<p>De detailberekening toont het effect van berekenbare meldingen. De dienstband hierboven houdt ook ontbrekende dekking vast.</p></div>
    <div class="regio-focus-blok"><h4>Niet doorgerekende meldingen</h4>${lijst([...redenen].map(([s,n])=>`<li>${n.toLocaleString('nl-NL')} · ${esc(s)}</li>`))}</div>
    <div class="regio-focus-blok"><h4>Werkzaamheden</h4>${lijst(werk.map(w=>`<li><b>${esc(w.id||w.weg)}</b>: ${esc(werkLocatieLabel(w))}, ${esc(werkPeriodeLabel(w))}</li>`))}</div>
    <div class="regio-focus-blok"><h4>U-routes</h4>${lijst(routes.map(x=>`<li><b>${esc(routeNaamLabel(x.route))}</b>: ${esc(routeLocatieLabel(x.route))}</li>`))}</div>
  </div>`;
}
function renderActualRegio(){
  const host=document.getElementById('tab-rapport');if(!host)return;
  if(!ASSET_REGISTER_STATE){host.innerHTML=blokkadeHtml('rapport');return;}
  herberekenRegisterDekking();
  const rows=actualRegioRows(),r=rows.find(r=>r.key===RAPPORT_REGIO_SELECTIE)||rows.slice().sort((a,b)=>b.liveStoringen-a.liveStoringen||b.assets-a.assets)[0];
  if(!r){host.innerHTML='<div class="card"><h3>Regiofocus</h3><p>Geen regiogegevens beschikbaar.</p></div>';return;}
  const kaartVc=rapportModus()==='vc'?r.vc:(r.vcSet.size===1?[...r.vcSet][0]:'');
  host.innerHTML=`<div class="card" data-actual-regio="${esc(r.key)}"><h3>Regiofocus per ${esc(rapportModusLabel())}: ${esc(r.scopeLabel)}</h3>
    <div class="regio-keuze"><label>Groepering<select id="actualRegioModus" onchange="wijzigRapportRegioModus(this.value)"><option value="vc"${rapportModus()==='vc'?' selected':''}>Verkeerscentrale</option><option value="rd"${rapportModus()==='rd'?' selected':''}>RD</option></select></label>
    <label>Selectie<select id="actualRegioSelectie" onchange="wijzigRapportRegio(this.value)">${rows.map(x=>`<option value="${esc(x.key)}"${x.key===r.key?' selected':''}>${esc(x.scopeLabel)}</option>`).join('')}</select></label>
    <button class="tb-btn" data-vc="${esc(kaartVc||'')}" onclick="openGebiedVoorRegio(this.dataset.vc)" ${kaartVc&&tabToegestaan('gebied')?'':'disabled'}>Toon VC op gebiedskaart</button></div>
    <p>Bronmoment: ${actualBronMomentHtml([...r.vcSet])}. Ontbrekende bronnen zijn geen bewijs voor een storingsvrije operatie.</p>
    <div class="grid4"><div class="kpi"><div class="k-val">${r.assets.toLocaleString('nl-NL')}</div><div class="k-lab">Actieve assets</div></div><div class="kpi"><div class="k-val">${r.meldingen.length.toLocaleString('nl-NL')}</div><div class="k-lab">Doorgerekende meldingen</div></div><div class="kpi"><div class="k-val">${r.niet.length.toLocaleString('nl-NL')}</div><div class="k-lab">Niet doorgerekend, impact onzeker</div></div><div class="kpi"><div class="k-val">${r.werkIds.size+r.uRouteIds.size}</div><div class="k-lab">Werkzaamheden en U-routes</div></div></div>
    ${actualDienstTabelHtml(r.model)}${actualBandDiagnoseHtml(r.model)}${actualSubprocessenHtml(r.model)}
    <div class="regio-focus-grid"><div class="regio-focus-blok"><h4>Assetverdeling</h4>${rapportTypeVerdelingHtml(r)}</div>
    <div class="regio-focus-blok"><h4>Datakwaliteit</h4><p>Bouwjaar ${fmt(r.bouwjaarPct,0)}%, levensduurmodel ${fmt(r.modelPct,0)}%, expliciete EOL ${fmt(r.eolPct,0)}%. Mediane leeftijd ${r.leeftijdMed==null?'onbekend':fmt(r.leeftijdMed,0)+' jaar'}.</p></div>
    <div class="regio-focus-blok"><h4>Districtduiding</h4><p>${esc(r.districtLabel)}. Bron: ${esc(r.districtBronLabel)}. ${esc(r.scopeDetail)}.</p></div>
    <div class="regio-focus-blok"><h4>Contractcontext</h4><p>Aannemer: ${esc(r.aannemerLabel)}. Contract: ${esc(r.contractLabel)}. Leverancier: ${esc(r.leverancierLabel)}.</p></div></div>
    ${actualRegioContextHtml(r)}</div>${actualRegioVergelijkingHtml(rows)}
    <div class="card"><h3>Datakwaliteit en contracten per ${esc(rapportModusLabel())}</h3><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Regio</th><th>RD</th><th>Districten</th><th>Typeverdeling</th><th>Bouwjaar</th><th>Levensduurmodel</th><th>Expliciete EOL</th><th>Aannemer</th><th>Contract</th><th>Leverancier</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.scopeLabel)}</td><td>${esc(x.rdLabel)}</td><td>${esc(x.districtLabel)}</td><td>${rapportTypeVerdelingHtml(x)}</td><td>${fmt(x.bouwjaarPct,0)}%</td><td>${fmt(x.modelPct,0)}%</td><td>${fmt(x.eolPct,0)}%</td><td>${esc(x.aannemerLabel)}</td><td>${esc(x.contractLabel)}</td><td>${esc(x.leverancierLabel)}</td></tr>`).join('')}</tbody></table></div></div>`;
  nummerGrafiekenEnTabellen(host);
  if(!host.classList.contains('hidden')&&typeof scrollTo==='function')scrollTo(0,0);
}
