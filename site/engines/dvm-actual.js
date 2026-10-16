/* Alleen actuele regio-uitkomsten. Gebruikt de bestaande DVM-regiogroepering. */
function renderActualRegio(){
  const host=document.getElementById('tab-rapport');if(!host)return;
  if(!ASSET_REGISTER_STATE){host.innerHTML=blokkadeHtml('rapport');return;}
  const rows=rapportRegioRows();
  host.innerHTML=`<div class="card"><h3>Operationele dagstand per ${esc(rapportModusLabel())}</h3><p>Laatste geladen bronnen. Een ontbrekende of verouderde bron bewijst geen storingsvrije operatie.</p><div class="tbl-scroll"><table class="tbl"><thead><tr><th>Regio</th><th>VC</th><th>Assets</th><th>Open en onzekere meldingen</th><th>Live diensten</th><th>Contractcontext</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.scopeLabel)}</td><td>${esc(r.vcLabel)}</td><td>${r.assets.toLocaleString('nl-NL')}</td><td>${r.liveStoringen.toLocaleString('nl-NL')}</td><td>${rapportRegioDienstenHtml(r)}</td><td>${esc(r.aannemerLabel)}<br>${esc(r.contractLabel)}</td></tr>`).join('')}</tbody></table></div></div>`;
}
