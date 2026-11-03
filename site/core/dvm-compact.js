/* Verliesloze JSON-opslag voor storingsregels. Geen impact- of herstelregels. */
(function(scope){
  'use strict';
  const FORMAT='BiDash-storingen-compact',PARTS=['storingshistorie','liveStoringen'];
  const forbidden=new Set(['__proto__','constructor','prototype']);
  const fail=()=>{throw Error('Ongeldige of onvolledige compacte storingsopslag. De vorige werkruimte blijft behouden.');};
  const validIndex=(n,a)=>Number.isSafeInteger(n)&&n>=0&&n<a.length;
  function safe(value,depth=0){
    if(depth>120)fail();
    if(value&&typeof value==='object')for(const k of Object.keys(value)){if(forbidden.has(k))fail();safe(value[k],depth+1);}
    return value;
  }
  function* encode(bundle){
    if(!bundle||bundle.formaat!=='DVM-dienstimpact-totaal')return bundle;
    if(Object.hasOwn(bundle,'compacteStoringen')){unpackDvm(bundle);return bundle;}
    const strings=[],schemas=[],records=[],stringIds=new Map(),schemaIds=new Map(),recordIds=new Map(),identities=new Map();
    const str=s=>{if(!stringIds.has(s)){stringIds.set(s,strings.length);strings.push(s);}return stringIds.get(s);};
    const schema=keys=>{const k=JSON.stringify(keys);if(!schemaIds.has(k)){schemaIds.set(k,schemas.length);schemas.push(keys);}return schemaIds.get(k);};
    const cell=v=>typeof v==='string'?[0,str(v)]:v&&typeof v==='object'?[1,v]:typeof v==='number'&&!Number.isFinite(v)?null:v;
    const out={...bundle};let rowCount=0;
    for(const part of PARTS){
      if(!Array.isArray(bundle[part]))continue;
      out[part]=[];
      for(const source of bundle[part]){
        if(!source||!Array.isArray(source.rijen))fail();
        const {rijen,...meta}=source,refs=[];
        for(const row of rijen){
          if(!row||typeof row!=='object'||Array.isArray(row))fail();
          const keys=Object.keys(row).filter(k=>row[k]!==undefined&&typeof row[k]!=='function'&&typeof row[k]!=='symbol').sort();
          if(keys.some(k=>forbidden.has(k)))fail();
          const canonical=JSON.stringify(keys.map(k=>[k,row[k]]));
          let id=recordIds.get(canonical);
          if(id===undefined){
            const identity=row.incident_id||row._mtmSleutel;
            const ik=identity?JSON.stringify([String(row.vc||row.verkeerscentrale||'').trim().toUpperCase(),String(identity)]):null;
            const base=ik?identities.get(ik):null;
            let selected=keys,removed=[],record={};
            if(base){
              selected=keys.filter(k=>!Object.hasOwn(base.row,k)||JSON.stringify(base.row[k])!==JSON.stringify(row[k]));
              removed=base.keys.filter(k=>!keys.includes(k));record.b=base.id;
              if(removed.length)record.d=schema(removed);
            }
            record.s=schema(selected);record.v=selected.map(k=>cell(row[k]));
            id=records.length;records.push(record);recordIds.set(canonical,id);
            if(ik&&!base)identities.set(ik,{id,row,keys});
          }
          refs.push(id);rowCount++;yield;
        }
        out[part].push({...meta,rijenRefs:refs});
      }
    }
    if(!rowCount)return bundle;
    out.compacteStoringen={formaat:FORMAT,versie:1,strings,schemas,records};
    return out;
  }
  function packDvm(bundle){const g=encode(bundle);let r=g.next();while(!r.done)r=g.next();return r.value;}
  async function drain(g){let r=g.next(),n=0;
    while(!r.done){if(++n%512===0)await new Promise(resolve=>setTimeout(resolve,0));r=g.next();}
    return r.value;
  }
  async function packDvmAsync(bundle){return drain(encode(structuredClone(bundle)));}
  function unpackDvm(bundle){
    if(!bundle||!Object.hasOwn(bundle,'compacteStoringen')){
      if(bundle&&PARTS.some(part=>(bundle[part]||[]).some?.(source=>Object.hasOwn(source||{},'rijenRefs'))))fail();
      return bundle;
    }
    const t=bundle.compacteStoringen;
    if(!t||t.formaat!==FORMAT||t.versie!==1||!Array.isArray(t.strings)||!t.strings.every(s=>typeof s==='string')||!Array.isArray(t.schemas)||!Array.isArray(t.records))fail();
    for(const keys of t.schemas)if(!Array.isArray(keys)||keys.some(k=>typeof k!=='string'||forbidden.has(k))||new Set(keys).size!==keys.length)fail();
    const decoded=[];
    const value=v=>{
      if(Array.isArray(v)){if(v.length!==2)fail();if(v[0]===0){if(!validIndex(v[1],t.strings))fail();return t.strings[v[1]];}if(v[0]===1)return safe(v[1]);fail();}
      if(v!==null&&!['number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v))fail();return v;
    };
    for(const r of t.records){
      if(!r||typeof r!=='object'||!validIndex(r.s,t.schemas)||!Array.isArray(r.v)||r.v.length!==t.schemas[r.s].length)fail();
      if(Object.hasOwn(r,'b')&&!validIndex(r.b,decoded))fail();
      const row=Object.hasOwn(r,'b')?{...decoded[r.b]}:{};
      if(Object.hasOwn(r,'d')){if(!validIndex(r.d,t.schemas))fail();for(const k of t.schemas[r.d])delete row[k];}
      t.schemas[r.s].forEach((k,i)=>{row[k]=value(r.v[i]);});decoded.push(row);
    }
    const {compacteStoringen,...out}=bundle;
    for(const part of PARTS){
      if(bundle[part]==null)continue;
      if(!Array.isArray(bundle[part]))fail();
      out[part]=bundle[part].map(source=>{
        if(!source||!Array.isArray(source.rijenRefs)||Object.hasOwn(source,'rijen'))fail();
        const {rijenRefs,...meta}=source;
        return {...meta,rijen:rijenRefs.map(i=>{if(!validIndex(i,decoded))fail();return structuredClone(decoded[i]);})};
      });
    }
    return out;
  }
  function packAny(value){
    if(value?.formaat==='BiDash-integraal'&&value.delen?.dvm)return {...value,delen:{...value.delen,dvm:packDvm(value.delen.dvm)}};
    return packDvm(value);
  }
  async function packAnyAsync(value){
    value=structuredClone(value);
    if(value?.formaat==='BiDash-integraal'&&value.delen?.dvm)return {...value,delen:{...value.delen,dvm:await drain(encode(value.delen.dvm))}};
    return drain(encode(value));
  }
  function unpackAny(value){
    if(value?.formaat==='BiDash-integraal'&&value.delen?.dvm)return {...value,delen:{...value.delen,dvm:unpackDvm(value.delen.dvm)}};
    return unpackDvm(value);
  }
  scope.DVM_COMPACT=Object.freeze({FORMAT,packDvm,packDvmAsync,unpackDvm,packAny,packAnyAsync,unpackAny});
})(globalThis);
