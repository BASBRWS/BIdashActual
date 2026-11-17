/* Regelgebruik (2.90 / DVM 160): het register in core/regelgebruik.js moet
   bijblijven met de code. Faalt deze test na een wijziging, werk dan de status
   in het register bij in plaats van de controle te verzwakken. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';

const lees=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const REGISTER_BRON=lees('site/core/regelgebruik.js');
function register(){const c={};vm.createContext(c);vm.runInContext(REGISTER_BRON,c);return c.BIDASH_REGELGEBRUIK;}
function siteJs(dir='site'){
  const uit=[];
  for(const naam of readdirSync(new URL('../'+dir,import.meta.url))){
    const p=dir+'/'+naam,st=statSync(new URL('../'+p,import.meta.url));
    if(st.isDirectory()){if(naam!=='vendor')uit.push(...siteJs(p));}
    else if(naam.endsWith('.js')&&p!=='site/core/regelgebruik.js')uit.push([p,lees(p)]);
  }
  return uit;
}
function functieBron(bron,naam){
  const start=bron.indexOf('function '+naam+'(');assert.ok(start>=0,naam+' niet gevonden');
  const volgende=bron.indexOf('\nfunction ',start+10);return bron.slice(start,volgende<0?undefined:volgende);
}
function biCfgDefaults(){
  const regel=lees('site/engines/bi-1.js').split('\n').find(r=>r.startsWith('const CFG_DEFAULTS='));
  return JSON.parse(regel.slice('const CFG_DEFAULTS='.length).replace(/;\s*$/,''));
}

test('register kent alleen geldige statussen en geeft een * met reden',()=>{
  const R=register();
  for(const [domein,regels] of Object.entries(R.REGELS))for(const [id,x] of Object.entries(regels)){
    assert.ok(['gebruikt','beperkt','niet'].includes(x.status),domein+':'+id);
    assert.ok(x.label&&x.reden&&x.bron,'label, reden en bron verplicht voor '+domein+':'+id);
  }
  assert.equal(R.markering('dvm','locatie.MSI_ERNST_01'),'');
  assert.equal(R.markering('dvm','onbekende.regel'),'');
  assert.match(R.markering('dvm','locatie.LOC_004'),/class="rg-mark rg-niet"[^>]*title="Niet gebruikt in BIdashActual: [^"]+"[^>]*>\*<\/sup>/);
  assert.match(R.markering('bi','cfg.atw.max_uren_week'),/rg-beperkt[^>]*>\*</);
  const html=R.overzichtHtml('bi');
  assert.match(html,/data-regelgebruik-rij="cfg.escalatie.niveau3"/);
  assert.doesNotMatch(html,/data-regelgebruik-rij="cfg.personeel.ziekteverzuim"/,'gebruikte regels staan niet in de afwijkingslijst');
});

test('iedere standaard-DVM-regel staat in het register',()=>{
  const R=register(),c=dvmRuntime();
  const RULES=vm.runInContext('RULES_DEFAULT',c),ontbreekt=[];
  const eis=id=>{if(!R.regel('dvm',id))ontbreekt.push(id);};
  Object.keys(RULES.cfg).forEach(k=>eis('cfg.'+k));
  RULES.locatieRegels.forEach(l=>eis('locatie.'+l.id));
  RULES.combiRegels.forEach(x=>eis('combi.'+x.id));
  RULES.foutcodes.forEach(f=>eis('foutcode.'+f.code));
  for(const at of RULES.assetTypen)for(const k of Object.keys(at))if(!['id','functie','areaal'].includes(k))eis('assetTypen.'+k);
  for(const k of Object.keys(RULES.drip))if(k!=='functies')eis('drip.'+k);
  assert.deepEqual([...new Set(ontbreekt)],[],'Voeg deze regels toe aan site/core/regelgebruik.js');
});

test('iedere config.html-parameter van BI staat in het register',()=>{
  const R=register();
  const ontbreekt=Object.keys(biCfgDefaults()).filter(k=>!R.regel('bi','cfg.'+k));
  assert.deepEqual(ontbreekt,[],'Voeg deze parameters toe aan site/core/regelgebruik.js');
});

test('een BI-parameter met controle ongelezen wordt nergens gelezen',()=>{
  const R=register(),bestanden=siteJs();
  const ongelezen=Object.entries(R.REGELS.bi).filter(([,x])=>x.controle==='ongelezen').map(([id])=>id.slice(4));
  assert.ok(ongelezen.length>20);
  for(const key of ongelezen){
    for(const [p,bron] of bestanden){
      // Toegestaan: de weergaverij in renderRules ['key','eenheid','tekst'].
      const treffers=bron.split(`'${key}'`).length-1,weergave=bron.split(`['${key}',`).length-1;
      assert.equal(treffers-weergave,0,`${key} wordt gelezen in ${p}; zet de status in regelgebruik.js op gebruikt of beperkt`);
    }
  }
});

test('iedere door BI gelezen parameter is geregistreerd en niet als ongelezen gemarkeerd',()=>{
  const R=register(),gelezen=new Set();
  for(const [,bron] of siteJs())for(const m of bron.matchAll(/\bcfg\('([a-z_]+(?:\.[a-z0-9_]+)+)'/g))gelezen.add(m[1]);
  assert.ok(gelezen.has('personeel.ziekteverzuim'));
  for(const key of gelezen){
    const x=R.regel('bi','cfg.'+key);
    assert.ok(x,`${key} wordt gelezen maar staat niet in regelgebruik.js`);
    assert.notEqual(x.controle,'ongelezen',`${key} wordt nu gelezen; werk de status in regelgebruik.js bij`);
  }
});

test('de codekenmerken achter de niet-gebruikt-statussen gelden nog',()=>{
  const R=register(),dvm2=lees('site/engines/dvm-2.js'),dvm1=lees('site/engines/dvm-1.js');
  const loc=functieBron(dvm2,'locatieFactor');
  if(R.status('dvm','locatie.LOC_004')==='niet')assert.doesNotMatch(loc,/'CAM'|incidentzicht/,'locatieFactor kent nu een cameracontext: werk LOC_004 bij');
  if(R.status('dvm','locatie.LOC_006')==='niet')assert.doesNotMatch(loc,/hoofdrijbaan_standaard/,'werk LOC_006 bij');
  const door=functieBron(dvm2,'doorrekenen');
  if(R.status('dvm','combi.venMin')==='niet')assert.match(door,/t: actueel\?\(opties\.peildatum/,'werk combi.venMin bij');
  if(R.status('dvm','cfg.hw_mttr')==='niet')assert.match(door,/const duur = actueel \? periodeUren/,'werk cfg.hw_mttr en assetTypen.mttr bij');
  if(R.status('dvm','assetTypen.actief')==='niet')assert.doesNotMatch(door,/at\.actief|assetTypen\.filter/,'doorrekenen gebruikt nu het actief-vinkje');
  if(R.status('dvm','drip.functies.gewicht')==='niet'){
    const aanroepen=siteJs().reduce((n,[,b])=>n+(b.match(/dripBeschikbaarheid\(/g)||[]).length,0);
    assert.equal(aanroepen,1,'dripBeschikbaarheid wordt nu aangeroepen: werk drip.functies.gewicht bij');
    assert.doesNotMatch(functieBron(dvm2,'v68TypeStatus'),/functieGewicht|drip\.functies/);
  }
  const c=dvmRuntime(),subs=vm.runInContext('SUBPROCESSEN_DEFAULT',c),objBron=vm.runInContext('OBJ_BRON',c);
  if(R.status('dvm','subproces.dynamische_strook')==='beperkt')assert.ok(Object.values(subs).flat().every(sp=>!sp.afh.dynamische_strook),'werk subproces.dynamische_strook bij');
  if(R.status('dvm','foutcode.6005')==='beperkt')assert.ok(!Object.values(objBron).includes('WISSELBORD'),'werk foutcode.6005 bij');
  if(R.status('dvm','dienst.afh')==='niet')assert.match(dvm1,/if\(!subs\.length\)return subprocesWaarde\(dienst\.afh/);
  assert.match(lees('site/engines/bi-adapter.js'),/db\.storingsRegels=\{assetTypen:\[\]/);
});

test('Impactregels tonen de * en het overzicht',()=>{
  const c=dvmRuntime();vm.runInContext(REGISTER_BRON,c);
  const host={innerHTML:'',querySelectorAll:()=>[],addEventListener(){}},orig=c.document.getElementById;
  c.document.getElementById=id=>id==='tab-regels'?host:orig(id);
  vm.runInContext('renderRegels()',c);
  const h=host.innerHTML;
  assert.match(h,/data-regelgebruik-overzicht="dvm"/);
  for(const id of ['locatie.LOC_004','locatie.LOC_006','assetTypen.actief','assetTypen.levensduur','foutcode.6005','drip.functies.gewicht','kosten.prijspeil'])
    assert.ok(h.includes(`data-regelgebruik="dvm:${id}"`),id);
  assert.ok(!h.includes('data-regelgebruik="dvm:locatie.MSI_ERNST_01"'),'gebruikte regel krijgt geen *');
});

test('Organisatieregels en beide engines laden het register',()=>{
  const bi2=lees('site/engines/bi-2.js');
  assert.match(bi2,/<span class="k">\$\{k\}\$\{rgm\('cfg\.'\+k\)\}<\/span>/);
  assert.match(bi2,/overzichtHtml\('bi'\)/);
  assert.match(bi2,/rgm\('richtlijn\.'\+r\.id\)/);
  for(const [html,eerste] of [['site/engines/dvm.html','dvm-1.js'],['site/engines/bi.html','bi-1.js']]){
    const s=lees(html);
    assert.ok(s.indexOf('../core/regelgebruik.js')>=0&&s.indexOf('../core/regelgebruik.js')<s.indexOf(eerste),html);
  }
  assert.match(lees('site/engines/component.css'),/\.rg-mark\.rg-niet\{color:#c0121f\}/);
});
