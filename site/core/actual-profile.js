/* BIdashActual: vaste dagstand, eigen browseropslag op dezelfde Pages-origin. */
(function(scope){
  'use strict';
  if(scope.BIDASH_ACTUAL)return;
  /* 2.95: demomodus. Een venster (of een omvattend venster) met ?demo=1 in de URL
     krijgt een eigen werkruimte en eigen instellingen. Engines in iframes erven dat
     van hun ouder. De echte werkruimte wordt in demomodus nooit gelezen of geschreven. */
  function demoModus(){
    let w=scope;
    for(let i=0;i<6&&w;i++){
      try{if(/[?&]demo=1(?:&|$)/.test(String(w.location.search||'')))return true;}catch(e){return false;}
      if(!w.parent||w.parent===w)break;w=w.parent;
    }
    return false;
  }
  const demo=demoModus();
  const prefix=demo?'bidash-demo:':'bidash-actual:';
  function parameters(value){
    if(!value||typeof value!=='object')return value;
    const out={...value};
    if(value.kosten){out.kosten={...value.kosten};delete out.kosten.trafficMC70;delete out.kosten.forecastMSI71;}
    return out;
  }
  function noForecast(){throw Error('BIdashActual toont de operationele dagstand. Prognoses en simulaties horen bij BiDash.');}
  scope.BIDASH_ACTUAL=Object.freeze({mode:'actual',workspace:demo?'bidash-demo':'bidash-actual',demo,parameters,noForecast});
  // Storage is origin-breed, ook tussen /BiDash/ en /BIdashActual/.
  // Scope alle bestaande legacy-aanroepen, inclusief clear en key/length.
  if(scope.Storage){
    const p=scope.Storage.prototype,get=p.getItem,set=p.setItem,remove=p.removeItem,key=p.key,length=Object.getOwnPropertyDescriptor(p,'length');
    if(length?.get){
      const keys=storage=>{const out=[];for(let i=0,n=length.get.call(storage);i<n;i++){const k=key.call(storage,i);if(k?.startsWith(prefix))out.push(k);}return out;};
      /* 2.99: met een ingesteld wachtwoord (core/toegang.js) staan de BI- en planningsgegevens
         alleen nog versleuteld in de werkruimte. De engines houden hun kopie dan in het
         geheugen van het venster; de schil herstelt ze bij het laden uit de werkruimte.
         Een oude onversleutelde kopie wordt verwijderd. */
      const GEVOELIG=new Set(['bidash_integratie_v1','rws-integrale-planning-state-v1','bidash-planning:settings-v1']),geheugen=new Map();
      const vergrendeld=storage=>{try{return storage===scope.localStorage&&get.call(storage,prefix+'bidash-toegang-v1')!=null;}catch(e){return false;}};
      const afgeschermd=(storage,k)=>GEVOELIG.has(String(k))&&vergrendeld(storage);
      p.getItem=function(k){if(afgeschermd(this,k))return geheugen.has(String(k))?geheugen.get(String(k)):null;return get.call(this,prefix+String(k));};
      p.setItem=function(k,v){if(afgeschermd(this,k)){geheugen.set(String(k),String(v));remove.call(this,prefix+String(k));return;}return set.call(this,prefix+String(k),v);};
      p.removeItem=function(k){geheugen.delete(String(k));return remove.call(this,prefix+String(k));};
      try{if(vergrendeld(scope.localStorage))for(const k of GEVOELIG)remove.call(scope.localStorage,prefix+k);}catch(e){}
      p.key=function(i){return keys(this)[Number(i)]?.slice(prefix.length)??null;};
      p.clear=function(){for(const k of keys(this))remove.call(this,k);};
      Object.defineProperty(p,'length',{...length,get(){return keys(this).length;}});
    }
  }
})(globalThis);
