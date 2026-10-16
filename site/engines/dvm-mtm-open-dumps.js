/* Complete openstaande MTM-dumps op volgorde. De herstelwachttijd begint
   bij de eerste afwezigheid en vervalt zodra dezelfde melding terugkomt. */
(function(scope){
  'use strict';
  const HOURS=48,DAY=86400000,FORMAT='open-dump-48h';
  const path=f=>String(f.webkitRelativePath||f._pad||f.name||'').replace(/\\/g,'/');
  const isDump=f=>/openstaande[\s_-]*storingen\.(txt|log|dat|csv)$/i.test(f.name||path(f));
  const folders=new Set(['storinglijst','openstaandestoringen','openstaande_storingen']);
  const H=()=>scope.__BIDASH_STORINGSBUNDELAAR__;
  const iso=t=>new Date(t).toISOString();
  const dayKey=(y,m,d)=>Date.UTC(y,m-1,d);
  const valid=(y,m,d)=>{const x=new Date(dayKey(y,m,d));return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d;};
  const dutch=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function wall(t){const p=Object.fromEntries(dutch.formatToParts(new Date(t)).map(x=>[x.type,x.value]));return [Number(p.year),Number(p.month),Number(p.day),Number(p.hour),Number(p.minute),Number(p.second)];}
  function nl(y,m,d,h=0,minute=0,second=0,last=false){
    const utc=Date.UTC(y,m-1,d,h,minute,second),expected=[y,m,d,h,minute,second].join(','),candidates=[60,120].map(offset=>utc-offset*60000).filter(t=>wall(t).join(',')===expected);
    if(!candidates.length)throw Error('Niet bestaand Nederlands tijdstip in de dump. Vorige stand behouden.');
    return last?Math.max(...candidates):Math.min(...candidates);
  }
  function date(text){
    const p=String(text).trim().match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if(!p||!valid(+p[3],+p[2],+p[1])||+p[4]>23||+p[5]>59||+(p[6]||0)>59)return null;
    const parts=[+p[3],+p[2],+p[1],+p[4],+p[5],+(p[6]||0)];return {parts,time:nl(...parts),day:dayKey(...parts)};
  }
  function info(file,cfg={}){
    if(!isDump(file))return null;
    const name=String(file.name||path(file).split('/').pop()),match=name.match(/^(\d{2})(\d{2})(\d{2}|\d{4})(?:_(\d+))?_openstaande[\s_-]*storingen\./i);
    const raw=path(file).split('/').filter(Boolean),parts=raw.map(x=>x.toLowerCase());
    let vc='',calendar=null;
    for(let n=0;n<parts.length;n++){
      const v=H().sbVcAlias(parts[n]);if(v&&folders.has(parts[n+1])){vc=v;const [y,m,d]=parts.slice(n+2,n+5).map(Number);if(valid(y,m,d))calendar=[y,m,d];break;}
    }
    if(!vc&&cfg.vcs?.size===1)vc=[...cfg.vcs][0];
    if(vc&&cfg.vcs?.size&&!cfg.vcs.has(vc))return null;
    if(calendar){const day=iso(dayKey(...calendar)).slice(0,10);if(cfg.vanaf&&day<cfg.vanaf||cfg.tot&&day>cfg.tot)return null;}
    if(match){const y=+match[3]+(match[3].length===2?2000:0),m=+match[2],d=+match[1];if(!valid(y,m,d))throw Error('Ongeldige bestandsdatum in '+name);if(calendar&&calendar.join(',')!==[y,m,d].join(','))throw Error('Mapdatum en bestandsdatum spreken elkaar tegen in '+path(file));calendar=[y,m,d];}
    if(!vc||!calendar)return null;
    const [year,month,day]=calendar,stamp=dayKey(year,month,day);
    return {vc,year,month,day,stamp,sequence:Number(match?.[4]||0),name};
  }
  function select(files,cfg={}){
    const groups=new Map(),from=cfg.vanaf?Date.parse(cfg.vanaf+'T00:00:00Z'):-Infinity,to=cfg.tot?Date.parse(cfg.tot+'T23:59:59Z'):Infinity;
    for(const file of files){const p=info(file,cfg);if(!p||p.stamp<from||p.stamp>to||(cfg.vcs?.size&&!cfg.vcs.has(p.vc)))continue;if(!groups.has(p.vc))groups.set(p.vc,[]);groups.get(p.vc).push({file,info:p});}
    const selected=[];
    for(const [vc,list] of groups){
      list.sort((a,b)=>a.info.stamp-b.info.stamp||a.info.sequence-b.info.sequence||path(a.file).localeCompare(path(b.file)));
      for(let i=1;i<list.length;i++)if(list[i].info.stamp===list[i-1].info.stamp&&list[i].info.sequence===list[i-1].info.sequence&&path(list[i].file)!==path(list[i-1].file))throw Error('Meerdere gelijk gerangschikte openstaande dumps voor '+vc.toUpperCase()+'. Kies één bronmap.');
      selected.push(...list);
    }
    return selected.sort((a,b)=>a.info.vc.localeCompare(b.info.vc)||a.info.stamp-b.info.stamp||a.info.sequence-b.info.sequence);
  }
  function sourceKey(row,vc){
    const id=String(row.event_id??''),rawStart=row.start??row.van??row.bron_start,start=typeof rawStart==='number'?rawStart:Date.parse(rawStart),code=String(row.code??row.foutcode??'');
    return /^\d+$/.test(id)&&Number.isFinite(start)?JSON.stringify(['MTM-OPEN',vc||H().sbVcAlias(row.vc||row.verkeerscentrale),id,iso(start),code]):H().sbSignaalgeverSleutel(row);
  }
  function parsePart(text,file,p){
    p=p||info(file);if(!p)throw Error('Geen herkenbare openstaande MTM-dump.');
    const lines=String(text).replace(/^\uFEFF/,'').split(/\r?\n/),header=lines.find(l=>l.trim()),head=date(header);
    if(!head||head.day!==p.stamp)throw Error('Kopdatum ontbreekt of wijkt af van de bestandsdag in '+path(file));
    const nonRows=lines.filter(l=>!l.trim().startsWith('|')).slice(1).join('\n');
    if(/onvolledig|gedeeltelijk|afgebroken|truncated|partial/i.test(nonRows))throw Error('Onvolledige openstaande dump in '+path(file));
    const raw=lines.filter(l=>l.trim().startsWith('|')),rows=H().sbMtmRijenUitTekst(raw.map(l=>l.trim()).join('\n'),p.vc);
    if(rows.length!==raw.length)throw Error('Onvolledige alarmregel in '+path(file));
    const count=nonRows.match(/(?:totaal|aantal)(?:\s+(?:storingen|alarmen|meldingen|regels))?\s*[:=]\s*(\d+)/i);
    if(count&&Number(count[1])!==rows.length)throw Error('Regelaantal klopt niet in '+path(file));
    if(nonRows.trim()&&!/^(?:(?:geen\s+(?:openstaande\s+)?(?:storingen|alarmen|meldingen)|(?:totaal|aantal)(?:\s+(?:storingen|alarmen|meldingen|regels))?\s*[:=]\s*\d+)\s*[.\s]*)+$/i.test(nonRows.trim()))throw Error('Onbekende of afgebroken dumpregels in '+path(file));
    const seen=new Map();
    for(let n=0;n<rows.length;n++){
      const columns=raw[n].trim().replace(/^\||\|$/g,'').split('|'),start=date(columns.at(-1)),r=rows[n];
      if(!start||!r.locatie||!/^\d+$/.test(r.event_id)||start.day>p.stamp)throw Error('Ongeldige alarmdatum of locatie in '+path(file));
      if(start.time>head.time)throw Error('Alarmdatum ligt na de eigen dumpkop in '+path(file));r.start=iso(start.time);
      r._syncKey=sourceKey(r,p.vc);
      const payload=JSON.stringify([r.locatie,r.unit,r.description]);if(seen.has(r._syncKey)&&seen.get(r._syncKey)!==payload)throw Error('Tegenstrijdige alarmidentiteit in '+path(file));seen.set(r._syncKey,payload);
    }
    return {vc:p.vc,rows,snapshot:iso(head.time),bestand:path(file),precision:'minuut',observedFrom:iso(head.time),observedTo:iso(head.time),header:iso(head.time),headerConflict:false,day:p.stamp,format:FORMAT};
  }
  function parseAll(text,file,p){
    p=p||info(file);const parts=[];let current=null;
    for(const line of String(text).replace(/^\uFEFF/,'').split(/\r?\n/)){
      if(date(line)){current=[];parts.push(current);}
      if(!current){if(line.trim())throw Error('Een openstaande dump moet met een datumkop beginnen in '+path(file));continue;}
      current.push(line);
    }
    if(!parts.length)throw Error('Geen dumpkop gevonden in '+path(file));
    const snapshots=parts.map(lines=>parsePart(lines.join('\n'),file,p)),seen=new Map();
    for(const snap of snapshots){const keys=[...new Set(snap.rows.map(r=>JSON.stringify([r._syncKey,r.locatie,r.unit,r.description])))].sort().join('\n');if(seen.has(snap.snapshot)&&seen.get(snap.snapshot)!==keys)throw Error('Tegenstrijdige dumpblokken op hetzelfde tijdstip in '+path(file));seen.set(snap.snapshot,keys);}
    snapshots.sort((a,b)=>Date.parse(a.snapshot)-Date.parse(b.snapshot));
    const total=snapshots.reduce((n,s)=>n+s.rows.length,0);
    return snapshots.map(s=>({...s,deelSnapshots:snapshots.length,gelezenBronRijen:total}));
  }
  // Behoud de parseringang voor callers die alleen de laatste bestandsstand vragen.
  function parse(text,file,p){return parseAll(text,file,p).at(-1);}
  function processor(basis){
    const L=scope.DVM_INCIDENT_LIFECYCLE;if(!L)throw Error('Levenscyclusmodule ontbreekt.');
    const legacy=(basis.historie||[]).filter(r=>!r._mtmSleutel&&!r.incident_id&&!Object.keys(r).some(k=>/^(vc|regio|foutcode|melding|msi|strook|assettypehint)$/i.test(k)));
    const legacySet=new Set(legacy),history=new Map((basis.historie||[]).filter(r=>!legacySet.has(r)).map(r=>[H().sbSignaalgeverSleutel(r),r]));
    const aliases=new Map(),live=[],watermarks={...basis.laatstePerVc},coverage={...basis.snapshotDekking},updates={},groups=new Map();let duplicates=0;
    const rowVc=r=>H().sbVcAlias(r.vc||r.verkeerscentrale),when=v=>v==null?NaN:Date.parse(v);
    const signature=rows=>rows.map(r=>JSON.stringify([sourceKey(r),r.locatie,r.MSI,r.foutcode,r.melding])).sort().join('\n');
    for(const [key,row] of history){const id=sourceKey(row);if(!aliases.has(id))aliases.set(id,{key,row});else if(aliases.get(id)?.key!==key)aliases.set(id,null);}
    const save=(key,row)=>{const alias=aliases.get(key);if(alias&&alias.key!==key)history.delete(alias.key);history.set(key,row);};
    function begin(snap){
      const vc=snap.vc,first=when(snap.snapshot),old=Number(watermarks[vc])||0,vcRows=(basis.open||[]).filter(r=>rowVc(r)===vc);
      const replay=first<old,active=new Map();
      const seed=[...vcRows,...(basis.historie||[]).filter(r=>rowVc(r)===vc&&r.bron_formaat===FORMAT&&r.levenscyclus_status==='VERDWENEN_UIT_SNAPSHOT')];
      if(replay)seed.push(...(basis.historie||[]).filter(r=>rowVc(r)===vc&&r.bron_formaat===FORMAT&&when(r.eerste_gezien)<first&&(!/^HERSTELD_/.test(r.levenscyclus_status)||when(r.herstel_bevestiging_op||r.bron_peildatum)>=first)));
      for(const row of seed){
        const key=sourceKey(row,vc),existing=active.get(key);
        if(existing&&when(existing.bron_peildatum)>when(row.bron_peildatum))continue;
        if(replay&&when(row.eerste_gezien)>=first)continue;
        const reset=replay&&when(row.bron_peildatum)>=first;
        active.set(sourceKey(row,vc),reset?{...row,afwezig_sinds:when(row.afwezig_sinds)<first?row.afwezig_sinds:null,laatste_afwezig:null,laatste_gezien:when(row.laatste_gezien)<first?row.laatste_gezien:null,laatste_snapshot:when(row.laatste_snapshot)<first?row.laatste_snapshot:null}:row);
      }
      return {vc,first,old,vcRows,active,previousTime:replay?NaN:old||NaN,previousDay:!replay&&old?dayKey(...wall(old)):null,previousSignature:null,lastPresent:new Map(),resolved:new Set(),processed:0,gaps:0,latest:snap};
    }
    function add(snap){
      if(snap.format!==FORMAT)throw Error('Geen volledige openstaande dump.');
      if(!groups.has(snap.vc))groups.set(snap.vc,begin(snap));
      const state=groups.get(snap.vc),{vc,active}=state,t=when(snap.snapshot),day=snap.day??dayKey(...wall(t)),present=new Map();
      const mapped=r=>scope.signaalgeverOpenRij({...r,verkeerscentrale:vc,laatste_snapshot:snap.snapshot});
      for(const raw of snap.rows){if(present.has(raw._syncKey))duplicates++;present.set(raw._syncKey,mapped(raw));}
      const currentSignature=signature([...present.values()]);
      if(t===state.previousTime&&state.previousSignature!=null){if(state.previousSignature!==currentSignature)throw Error('Tegenstrijdige dumpblokken op hetzelfde tijdstip voor '+vc.toUpperCase()+'.');return;}
      if(t<state.previousTime)throw Error('Openstaande dumps moeten op tijdsvolgorde worden verwerkt.');
      // Een herhaalde laatste dump is geen extra afwezigheidswaarneming.
      const repeat=t===state.old&&state.first===state.old&&coverage[vc]?.logicaVersie===143;
      if(repeat&&coverage[vc].bronSignatuur!==currentSignature)throw Error('Tegenstrijdige openstaande dumps op dezelfde bronpeildag voor '+vc.toUpperCase()+'. Vorige stand behouden.');
      const gap=state.previousDay!=null&&day-state.previousDay>DAY;
      if(gap)state.gaps++;
      if(!repeat){
        for(const [key,row] of present){
          const prior=active.get(key)||history.get(key)||aliases.get(key)?.row;
          const firstSeen=when(prior?.eerste_gezien)<=t?prior.eerste_gezien:snap.observedFrom;
          const next=L.stamp({...prior,...row},{_mtmSleutel:key,incident_id:prior?.incident_id||'MTM|'+key,eerste_gezien:firstSeen,laatste_gezien:snap.snapshot,bron_peildatum:snap.snapshot,bron_waarneming_van:snap.observedFrom,bron_waarneming_tot:snap.observedTo,bron_kopdatum:snap.header,bron_tijdprecisie:snap.precision,bron_kop_afwijking:false,bron_formaat:FORMAT,levenscyclus_status:'OPEN_BEVESTIGD',status:'open',_liveOpen:true,_mtmKwaliteit:'open_aan_einde',hersteld_op:null,herstel_venster_van:null,herstel_venster_tot:null,herstel_bevestiging_op:null,afwezig_sinds:null,laatste_afwezig:null,ontbrekend_volledige_snapshots:0,_afgeslotenDoorNieuweMomentopname:false,_mtmEindeBovengrens:null,duurBetrouwbaar:false});
          active.set(key,next);save(key,next);state.resolved.delete(key);
        }
        for(const [key,row] of active){
          if(present.has(key))continue;
          // Een ontbrekende kalenderdag bewijst geen doorlopende afwezigheid.
          const since=!gap&&Number.isFinite(when(row.afwezig_sinds))?row.afwezig_sinds:snap.snapshot;
          const closed=t-when(since)>=HOURS*36e5,lastSeen=row.laatste_gezien||row.laatste_snapshot||null;
          const next=L.stamp(row,{_mtmSleutel:key,incident_id:row.incident_id||'MTM|'+key,bron_formaat:FORMAT,bron_peildatum:snap.snapshot,levenscyclus_status:closed?'HERSTELD_AFGELEID':'VERDWENEN_UIT_SNAPSHOT',status:closed?'gesloten_afgeleid':'onbekend',_liveOpen:false,_mtmKwaliteit:closed?'gesloten':'verdwenen_uit_snapshot',afwezig_sinds:since,laatste_afwezig:snap.snapshot,ontbrekend_volledige_snapshots:since===row.afwezig_sinds?(row.ontbrekend_volledige_snapshots||0)+1:1,hersteld_op:null,herstel_venster_van:Number.isFinite(when(lastSeen))?lastSeen:null,herstel_venster_tot:since,herstel_bevestiging_op:closed?snap.snapshot:null,herstel_afgeleid_na_uren:HOURS,_mtmEindeBovengrens:closed?since:null,duurBetrouwbaar:false});
          save(key,next);if(closed){active.delete(key);state.resolved.add(key);}else active.set(key,next);
        }
      }
      Object.assign(state,{previousTime:t,previousDay:day,previousSignature:currentSignature,lastPresent:present,processed:state.processed+1,latest:snap});
    }
    function finish(){
      for(const [vc,state] of groups){
        const {old,first,vcRows,active,lastPresent,resolved,processed,gaps,latest}=state,end=when(latest.snapshot);
        if(end<old){
          // Een oude mapsnede mag ook de bewaarde historie niet terugdraaien.
          for(const [key,row] of history)if(rowVc(row)===vc)history.delete(key);
          for(const row of basis.historie||[])if(!legacySet.has(row)&&rowVc(row)===vc)history.set(H().sbSignaalgeverSleutel(row),row);
          live.push(...vcRows);updates[vc]={van:old,tot:old,ouder:true};continue;
        }
        if(end===old&&coverage[vc]?.bronType===FORMAT){
          const before=coverage[vc].bronSignatuur??signature(vcRows.filter(r=>r._liveOpen!==false));
          if(before!==signature([...lastPresent.values()]))throw Error('Tegenstrijdige openstaande dumps op dezelfde bronpeildag voor '+vc.toUpperCase()+'. Vorige stand behouden.');
        }
        live.push(...active.values());
        const pending=[...active.values()].filter(r=>r.afwezig_sinds).length;
        coverage[vc]={vc,snapshot:latest.snapshot,bestand:latest.bestand,bronType:FORMAT,logicaVersie:143,bronSignatuur:signature([...lastPresent.values()]),volledig:true,structuurVolledig:true,aantal:latest.rows.length,uniekeMeldingen:lastPresent.size,dubbeleBronrijen:latest.rows.length-lastPresent.size,verantwoordeRijen:latest.rows.length,bronGap:gaps>0,bronGaten:gaps,volumeVerdacht:false,sluitenToegestaan:resolved.size>0,vergelijkingBestand:null,vergelijkingPeildatum:iso(first),vergelijkingUren:(end-first)/36e5,vergelijkingVensterUren:HOURS,verwerkteSnapshots:processed,hersteldAfgeleid:resolved.size,verdwenenNogOnbevestigd:pending,kopAfwijking:false,deelSnapshots:latest.deelSnapshots,gelezenBronRijen:latest.gelezenBronRijen,tijdprecisie:latest.precision,waarnemingVan:latest.observedFrom,waarnemingTot:latest.observedTo,bronKopdatum:latest.header,reden:'Alle dumps op volgorde; herstel na 48 uur afwezig sinds de eerste ontbrekende waarneming'+(gaps?'; wachttijd herstart na ontbrekende brondag':'')};
        watermarks[vc]=end;updates[vc]={van:old||null,tot:end,ouder:false,dekking:coverage[vc]};
      }
      const vcs=new Set(groups.keys());live.push(...(basis.open||[]).filter(r=>!vcs.has(rowVc(r))));
      const rows=[...legacy,...history.values()],states={},balance=Object.values(coverage).every(d=>d.aantal===d.verantwoordeRijen&&d.uniekeMeldingen+d.dubbeleBronrijen===d.aantal);for(const r of rows)states[r.levenscyclus_status||'LEGACY_ONBEKEND']=(states[r.levenscyclus_status||'LEGACY_ONBEKEND']||0)+1;
      return {...basis,open:live,historie:rows,laatstePerVc:watermarks,snapshotDekking:coverage,updates,dubbel:duplicates,levenscyclusAudit:{actueleZonderHistorie:live.filter(r=>!history.has(H().sbSignaalgeverSleutel(r))).length,snapshotBalans:balance,historischeIncidenten:rows.length,actueleMeldingen:live.length,perToestand:states,administratiefSluitend:balance&&live.every(r=>history.has(H().sbSignaalgeverSleutel(r)))&&rows.every(r=>!!r._mtmSleutel&&!!r.incident_id),bronDekkingVolledig:Object.values(coverage).every(d=>d.volledig&&!d.bronGap&&!d.volumeVerdacht)}};
    }
    return {add,finish};
  }
  function process(basis,snapshots){
    const state=processor(basis);
    for(const snap of snapshots.slice().sort((a,b)=>a.vc.localeCompare(b.vc)||Date.parse(a.snapshot)-Date.parse(b.snapshot)))state.add(snap);
    return state.finish();
  }
  async function run(basis,files,cfg={},callbacks={}){
    const selected=select(files,cfg);if(!selected.length)throw Error('Geen bestanden *_openstaandestoringen.txt gevonden voor de gekozen VC en periode.');
    const state=processor(basis),seenVcs=new Set();let count=0,index=0;
    while(index<selected.length){
      const day=selected[index].info.stamp,vc=selected[index].info.vc,daySnapshots=[];
      while(index<selected.length&&selected[index].info.stamp===day&&selected[index].info.vc===vc){
        const item=selected[index++];callbacks.checkCancel?.();callbacks.onProgress?.(count,selected.length,path(item.file));await callbacks.pause?.();
        const text=await H().sbLeesTekst(item.file);callbacks.checkCancel?.();daySnapshots.push(...parseAll(text,item.file,item.info));count++;
        callbacks.onProgress?.(count,selected.length,path(item.file));
      }
      // Bestandsvolgnummers hoeven niet dezelfde volgorde als hun datumkoppen te hebben.
      for(const snap of daySnapshots.sort((a,b)=>Date.parse(a.snapshot)-Date.parse(b.snapshot))){callbacks.checkCancel?.();state.add(snap);await callbacks.pause?.();}
      seenVcs.add(vc);await new Promise(r=>setTimeout(r,0));
    }
    callbacks.checkCancel?.();
    return {result:state.finish(),selected:count,missing:[...(cfg.vcs||[])].filter(vc=>!seenVcs.has(vc))};
  }
  async function collect(root,cfg={},onProgress){
    let dirs=0;const result=[],chosen=cfg.vcs||new Set();
    const entries=async h=>{const out=[];for await(const [name,handle] of h.entries())out.push({name,handle});dirs++;onProgress?.(dirs,result.length);return out;};
    const rootName=root.name.toLowerCase();let vcRoots=[];
    if(folders.has(rootName)){if(chosen.size!==1)throw Error('Kies bij een storinglijstmap precies één VC.');vcRoots=[{vc:[...chosen][0],handle:root,direct:true}];}
    else if(H().sbVcAlias(rootName))vcRoots=[{vc:H().sbVcAlias(rootName),handle:root}];
    else {let mtm=root;if(rootName!=='mtm'){const found=(await entries(root)).find(e=>e.handle.kind==='directory'&&e.name.toLowerCase()==='mtm');if(!found)throw Error('Geen mtm-map gevonden.');mtm=found.handle;}vcRoots=(await entries(mtm)).filter(e=>e.handle.kind==='directory'&&H().sbVcAlias(e.name)).map(e=>({vc:H().sbVcAlias(e.name),handle:e.handle}));}
    for(const current of vcRoots){
      if(chosen.size&&!chosen.has(current.vc))continue;
      const sources=current.direct?[{name:rootName,handle:current.handle}]:(await entries(current.handle)).filter(e=>e.handle.kind==='directory'&&folders.has(e.name.toLowerCase()));
      for(const source of sources){
        const years=(await entries(source.handle)).filter(e=>e.handle.kind==='directory'&&/^20\d{2}$/.test(e.name)).sort((a,b)=>+a.name-+b.name);
        for(const year of years){
          if(cfg.tot&&+year.name>+cfg.tot.slice(0,4)||cfg.vanaf&&+year.name<+cfg.vanaf.slice(0,4))continue;
          const months=(await entries(year.handle)).filter(e=>e.handle.kind==='directory'&&/^\d{1,2}$/.test(e.name)&&+e.name>=1&&+e.name<=12).sort((a,b)=>+b.name-+a.name);
          for(const month of months){
            const days=(await entries(month.handle)).filter(e=>e.handle.kind==='directory'&&/^\d{1,2}$/.test(e.name)&&valid(+year.name,+month.name,+e.name)).sort((a,b)=>+b.name-+a.name);
            for(const day of days){
              const stamp=dayKey(+year.name,+month.name,+day.name),dateText=iso(stamp).slice(0,10);
              if(cfg.vanaf&&dateText<cfg.vanaf||cfg.tot&&dateText>cfg.tot)continue;
              const candidates=(await entries(day.handle)).filter(e=>e.handle.kind==='file'&&isDump(e)).map(e=>({name:e.name,_handle:e.handle,_pad:`mtm/${current.vc}/${source.name}/${year.name}/${month.name}/${day.name}/${e.name}`}));
              if(!candidates.length)continue;
              const best=select(candidates,{...cfg,vcs:new Set([current.vc])});result.push(...best.map(x=>x.file));
            }
            await new Promise(r=>setTimeout(r,0));
          }
        }
      }
    }
    return result;
  }
  async function read(files,cfg={},callbacks={}){
    const initial=select(files,cfg);if(!initial.length)throw Error('Geen bestanden *_openstaandestoringen.txt gevonden voor de gekozen VC en periode.');
    const snapshots=[],seenVcs=new Set();let count=0;
    for(const item of initial){
      callbacks.checkCancel?.();callbacks.onProgress?.(count,initial.length,path(item.file));await callbacks.pause?.();
      const text=await H().sbLeesTekst(item.file);callbacks.checkCancel?.();
      snapshots.push(...parseAll(text,item.file,item.info));seenVcs.add(item.info.vc);count++;
      callbacks.onProgress?.(count,initial.length,path(item.file));
      await new Promise(r=>setTimeout(r,0));
    }
    return {snapshots,selected:count,missing:[...(cfg.vcs||[])].filter(vc=>!seenVcs.has(vc))};
  }
  scope.DVM_MTM_OPEN_DUMPS=Object.freeze({FORMAT,HOURS,isDump,info,select,parse,parseAll,process,run,collect,read});
})(globalThis);
