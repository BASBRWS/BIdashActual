/* Complete openstaande MTM-dumps. Alleen de nieuwste en een 48-uursvergelijking
   lezen; afgeleid herstel heeft een venster, nooit een verzonnen hersteltijd. */
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
      list.sort((a,b)=>b.info.stamp-a.info.stamp||b.info.sequence-a.info.sequence||path(b.file).localeCompare(path(a.file)));
      // Een onbekende volgorde van twee gelijk benoemde dumps mag geen willekeurige dagstand opleveren.
      if(list[1]&&list[0].info.stamp===list[1].info.stamp&&list[0].info.sequence===list[1].info.sequence&&path(list[0].file)!==path(list[1].file))throw Error('Meerdere gelijk gerangschikte openstaande dumps voor '+vc.toUpperCase()+'. Kies één bronmap.');
      const latest=list[0],previous=list.find(x=>x.info.stamp<=latest.info.stamp-(cfg.lookbackDays||2)*DAY);
      if(previous)selected.push(previous);selected.push(latest);
    }
    return selected.sort((a,b)=>a.info.vc.localeCompare(b.info.vc)||a.info.stamp-b.info.stamp);
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
  function parse(text,file,p){
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
    return {...snapshots.at(-1),deelSnapshots:snapshots.length,gelezenBronRijen:snapshots.reduce((n,s)=>n+s.rows.length,0)};
  }
  function process(basis,snapshots){
    const L=scope.DVM_INCIDENT_LIFECYCLE;if(!L)throw Error('Levenscyclusmodule ontbreekt.');
    const legacy=(basis.historie||[]).filter(r=>!r._mtmSleutel&&!r.incident_id&&!Object.keys(r).some(k=>/^(vc|regio|foutcode|melding|msi|strook|assettypehint)$/i.test(k)));
    const legacySet=new Set(legacy);
    const history=new Map((basis.historie||[]).filter(r=>!legacySet.has(r)).map(r=>[H().sbSignaalgeverSleutel(r),r])),aliases=new Map(),live=[],watermarks={...basis.laatstePerVc},coverage={...basis.snapshotDekking},updates={},groups=new Map();let duplicates=0;
    for(const [key,row] of history){const id=sourceKey(row);if(!aliases.has(id))aliases.set(id,{key,row});else if(aliases.get(id)?.key!==key)aliases.set(id,null);}
    for(const snap of snapshots){if(snap.format!==FORMAT)throw Error('Geen volledige openstaande dump.');if(!groups.has(snap.vc))groups.set(snap.vc,[]);groups.get(snap.vc).push(snap);}
    for(const [vc,list] of groups){
      list.sort((a,b)=>Date.parse(a.snapshot)-Date.parse(b.snapshot));const latest=list.at(-1),t=Date.parse(latest.snapshot),old=Number(watermarks[vc])||0;
      const vcRows=(basis.open||[]).filter(r=>H().sbVcAlias(r.vc||r.verkeerscentrale)===vc);
      if(t<old){live.push(...vcRows);updates[vc]={van:old,tot:old,ouder:true};continue;}
      const previous=list.slice(0,-1).reverse().find(s=>Date.parse(latest.observedFrom)-Date.parse(s.observedTo)>=HOURS*36e5)||list.at(-2),evidence=new Map();
      const mapped=(snap,r)=>scope.signaalgeverOpenRij({...r,verkeerscentrale:vc,laatste_snapshot:snap.snapshot});
      for(const r of vcRows)evidence.set(sourceKey(r,vc),r);
      // Afwezige meldingen van een vorige snelle import staan alleen nog in historie.
      for(const [key,r] of history)if(H().sbVcAlias(r.vc||r.verkeerscentrale)===vc&&r.bron_formaat===FORMAT&&r.levenscyclus_status==='VERDWENEN_UIT_SNAPSHOT')evidence.set(key,r);
      if(previous)for(const r of previous.rows){const row=mapped(previous,r),key=r._syncKey;if(Date.parse(evidence.get(key)?.laatste_gezien)>Date.parse(previous.snapshot))continue;evidence.set(key,L.stamp({...history.get(key),...row},{_mtmSleutel:key,incident_id:history.get(key)?.incident_id||'MTM|'+key,eerste_gezien:history.get(key)?.eerste_gezien||previous.observedFrom,laatste_gezien:previous.snapshot,bron_peildatum:previous.snapshot,bron_waarneming_van:previous.observedFrom,bron_waarneming_tot:previous.observedTo,bron_formaat:FORMAT}));}
      const present=new Map();for(const r of latest.rows){if(present.has(r._syncKey))duplicates++;const row=mapped(latest,r);present.set(r._syncKey,row);}
      if(t===old&&coverage[vc]?.bronType===FORMAT){const signature=rows=>rows.map(r=>JSON.stringify([sourceKey(r,vc),r.locatie,r.MSI,r.foutcode,r.melding])).sort().join('\n');const before=signature(vcRows),after=signature([...present.values()]);if(before!==after)throw Error('Tegenstrijdige openstaande dumps op dezelfde bronpeildag voor '+vc.toUpperCase()+'. Vorige stand behouden.');}
      for(const [key,row] of present){
        const alias=aliases.get(key),prior=history.get(key)||alias?.row||evidence.get(key),next=L.stamp({...prior,...row},{_mtmSleutel:key,incident_id:prior?.incident_id||'MTM|'+key,eerste_gezien:prior?.eerste_gezien||latest.observedFrom,laatste_gezien:latest.snapshot,bron_peildatum:latest.snapshot,bron_waarneming_van:latest.observedFrom,bron_waarneming_tot:latest.observedTo,bron_kopdatum:latest.header,bron_tijdprecisie:latest.precision,bron_kop_afwijking:latest.headerConflict,bron_formaat:FORMAT,levenscyclus_status:'OPEN_BEVESTIGD',status:'open',_liveOpen:true,_mtmKwaliteit:'open_aan_einde',hersteld_op:null,herstel_venster_van:null,herstel_venster_tot:null,ontbrekend_volledige_snapshots:0,_afgeslotenDoorNieuweMomentopname:false,_mtmEindeBovengrens:null,duurBetrouwbaar:false});
        live.push(next);if(alias&&alias.key!==key)history.delete(alias.key);history.set(key,next);
      }
      let resolved=0,pending=0;
      for(const [key,row] of evidence){
        if(present.has(key))continue;
        const observed=row.bron_waarneming_tot||row.laatste_gezien||row.laatste_snapshot||((row._liveOpen===true||/^open$/i.test(row.status||''))?row.tot:null),last=Date.parse(observed),absent=Number.isFinite(last)&&Date.parse(latest.observedFrom)-last>=HOURS*36e5,first=Date.parse(row.bron_waarneming_van||observed);
        const next=L.stamp(row,{_mtmSleutel:key,incident_id:row.incident_id||'MTM|'+key,bron_formaat:FORMAT,bron_peildatum:latest.snapshot,levenscyclus_status:absent?'HERSTELD_AFGELEID':'VERDWENEN_UIT_SNAPSHOT',status:absent?'gesloten_afgeleid':'onbekend',_liveOpen:false,_mtmKwaliteit:absent?'gesloten':'verdwenen_uit_snapshot',hersteld_op:null,herstel_venster_van:Number.isFinite(first)?iso(first):null,herstel_venster_tot:latest.observedTo,herstel_afgeleid_na_uren:HOURS,_mtmEindeBovengrens:latest.observedTo,duurBetrouwbaar:false});
        const alias=aliases.get(key);if(alias&&alias.key!==key)history.delete(alias.key);history.set(key,next);if(absent)resolved++;else pending++;
      }
      const comparison=previous||null;
      coverage[vc]={vc,snapshot:latest.snapshot,bestand:latest.bestand,bronType:FORMAT,volledig:true,structuurVolledig:true,aantal:latest.rows.length,uniekeMeldingen:present.size,dubbeleBronrijen:latest.rows.length-present.size,verantwoordeRijen:latest.rows.length,bronGap:false,volumeVerdacht:false,sluitenToegestaan:!!(comparison&&Date.parse(latest.observedFrom)-Date.parse(comparison.observedTo)>=HOURS*36e5)||resolved>0,vergelijkingBestand:comparison?.bestand||null,vergelijkingPeildatum:comparison?.snapshot||null,vergelijkingUren:comparison?(Date.parse(latest.observedFrom)-Date.parse(comparison.observedTo))/36e5:null,vergelijkingVensterUren:HOURS,hersteldAfgeleid:resolved,verdwenenNogOnbevestigd:pending,kopAfwijking:latest.headerConflict,deelSnapshots:latest.deelSnapshots,gelezenBronRijen:latest.gelezenBronRijen,tijdprecisie:latest.precision,waarnemingVan:latest.observedFrom,waarnemingTot:latest.observedTo,bronKopdatum:latest.header,reden:comparison&&Date.parse(latest.observedFrom)-Date.parse(comparison.observedTo)>=HOURS*36e5?'Complete openstaande dump met 48-uursvergelijking':'Complete openstaande dump; geen vergelijking van minstens 48 uur beschikbaar'};
      watermarks[vc]=t;updates[vc]={van:old||null,tot:t,ouder:false,dekking:coverage[vc]};
    }
    const vcs=new Set(groups.keys());live.push(...(basis.open||[]).filter(r=>!vcs.has(H().sbVcAlias(r.vc||r.verkeerscentrale))));
    const rows=[...legacy,...history.values()],states={},balance=Object.values(coverage).every(d=>d.aantal===d.verantwoordeRijen&&d.uniekeMeldingen+d.dubbeleBronrijen===d.aantal);for(const r of rows)states[r.levenscyclus_status||'LEGACY_ONBEKEND']=(states[r.levenscyclus_status||'LEGACY_ONBEKEND']||0)+1;
    return {...basis,open:live,historie:rows,laatstePerVc:watermarks,snapshotDekking:coverage,updates,dubbel:duplicates,levenscyclusAudit:{actueleZonderHistorie:live.filter(r=>!history.has(H().sbSignaalgeverSleutel(r))).length,snapshotBalans:balance,historischeIncidenten:rows.length,actueleMeldingen:live.length,perToestand:states,administratiefSluitend:balance&&live.every(r=>history.has(H().sbSignaalgeverSleutel(r)))&&rows.every(r=>!!r._mtmSleutel&&!!r.incident_id),bronDekkingVolledig:Object.values(coverage).every(d=>d.volledig&&!d.bronGap&&!d.volumeVerdacht)}};
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
        const years=(await entries(source.handle)).filter(e=>e.handle.kind==='directory'&&/^20\d{2}$/.test(e.name)).sort((a,b)=>+b.name-+a.name);let latestDay=null,previousFound=false;
        for(const year of years){if(previousFound)break;
          if(cfg.tot&&+year.name>+cfg.tot.slice(0,4)||cfg.vanaf&&+year.name<+cfg.vanaf.slice(0,4))continue;
          const months=(await entries(year.handle)).filter(e=>e.handle.kind==='directory'&&/^\d{1,2}$/.test(e.name)&&+e.name>=1&&+e.name<=12).sort((a,b)=>+b.name-+a.name);
          for(const month of months){if(previousFound)break;
            const days=(await entries(month.handle)).filter(e=>e.handle.kind==='directory'&&/^\d{1,2}$/.test(e.name)&&valid(+year.name,+month.name,+e.name)).sort((a,b)=>+b.name-+a.name);
            for(const day of days){
              const stamp=dayKey(+year.name,+month.name,+day.name),dateText=iso(stamp).slice(0,10);
              if(cfg.vanaf&&dateText<cfg.vanaf||cfg.tot&&dateText>cfg.tot||latestDay!=null&&stamp>latestDay-2*DAY)continue;
              const candidates=(await entries(day.handle)).filter(e=>e.handle.kind==='file'&&isDump(e)).map(e=>({name:e.name,_handle:e.handle,_pad:`mtm/${current.vc}/${source.name}/${year.name}/${month.name}/${day.name}/${e.name}`}));
              if(!candidates.length)continue;
              // Volgnummer bepaalt de laatste export binnen één bronkalenderdag.
              const best=select(candidates,{...cfg,vcs:new Set([current.vc])});result.push(...best.map(x=>x.file));
              if(latestDay==null)latestDay=stamp;else if(stamp<=latestDay-3*DAY){previousFound=true;break;}
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
    const snapshots=[],latestByVc=new Map();for(const item of initial)latestByVc.set(item.info.vc,item);
    let count=0;
    const load=async item=>{callbacks.checkCancel?.();callbacks.onProgress?.(count,latestByVc.size*3,path(item.file));await callbacks.pause?.();const text=await H().sbLeesTekst(item.file);const snap=parse(text,item.file,item.info);count++;callbacks.onProgress?.(count,latestByVc.size*3,path(item.file));return snap;};
    for(const [vc,item] of latestByVc){
      const latest=await load(item),used=new Set([path(item.file)]);let comparison=null;
      for(const lookbackDays of [2,3]){
        const candidates=select(files,{...cfg,vcs:new Set([vc]),lookbackDays});const old=candidates.find(x=>x.info.stamp<item.info.stamp);
        if(!old||used.has(path(old.file)))continue;used.add(path(old.file));comparison=await load(old);
        if(Date.parse(latest.observedFrom)-Date.parse(comparison.observedTo)>=HOURS*36e5)break;
      }
      if(comparison)snapshots.push(comparison);snapshots.push(latest);
    }
    return {snapshots,selected:count,missing:[...(cfg.vcs||[])].filter(vc=>!latestByVc.has(vc))};
  }
  scope.DVM_MTM_OPEN_DUMPS=Object.freeze({FORMAT,HOURS,isDump,info,select,parse,process,collect,read});
})(globalThis);
