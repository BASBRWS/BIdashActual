/* BIdashActual: vaste dagstand, eigen browseropslag op dezelfde GitHub Pages-origin. */
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
      p.getItem=function(k){return get.call(this,prefix+String(k));};
      p.setItem=function(k,v){return set.call(this,prefix+String(k),v);};
      p.removeItem=function(k){return remove.call(this,prefix+String(k));};
      p.key=function(i){return keys(this)[Number(i)]?.slice(prefix.length)??null;};
      p.clear=function(){for(const k of keys(this))remove.call(this,k);};
      Object.defineProperty(p,'length',{...length,get(){return keys(this).length;}});
    }
  }
})(globalThis);
