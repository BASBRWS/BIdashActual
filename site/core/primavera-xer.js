/* Schedule exchange, XER 20.12 (readable by P6 21 and later).
   Oracle field map: docs.oracle.com/cd/G48897_01/English/Mapping_and_Schema/
   xer_import_export_data_map_project/xer_import_export_data_map_project.pdf
   This is a schedule conversion, not a replacement for the source XML/back-up. */
import {addPrimaveraMonths,primaveraExportFilename} from './primavera-export.js';

const kids=el=>Array.from(el?.childNodes||[]).filter(n=>n.nodeType===1&&n.namespaceURI===el.namespaceURI);
const nodes=(el,name)=>kids(el).filter(n=>n.localName===name);
const field=(el,name)=>nodes(el,name)[0];
const val=(el,name)=>field(el,name)?.textContent.trim()||'';
const yes=v=>/^(1|true)$/i.test(v);
const nil=n=>/^(true|1)$/.test(n.getAttributeNS?.('http://www.w3.org/2001/XMLSchema-instance','nil')||'');
const num=(v,fallback=0)=>{if(v==='')return fallback;const n=Number(v);if(!Number.isFinite(n))throw Error('Ongeldig getal in de planning: '+v);return n;};
const clean=v=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ');
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const defaultWeek=()=>days.map((_,i)=>i>0&&i<6?[[480,720],[780,1020]]:[]);
const dayNumber=iso=>Date.parse(addPrimaveraMonths(iso.slice(0,10),0)+'T00:00:00Z')/86400000;
export function xerDate(iso){
  if(!iso)return '';
  addPrimaveraMonths(iso,0);
  // XER stores local wall time, with minute precision and no UTC offset.
  return iso.slice(0,10)+' '+(iso.includes('T')?iso.slice(11,16):'00:00');
}
export function xerDuration(iso){
  if(!iso)return null;
  const m=iso.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if(!m||!m.slice(1).some(x=>x!==undefined))throw Error('Niet ondersteunde XML-duur: '+iso);
  return num(m[1]||'')*24+num(m[2]||'')+num(m[3]||'')/60+num(m[4]||'')/3600;
}
export function xerMsProjectLag(raw,format){
  const hours=num(raw)/600;
  if(hours&&['19','20'].includes(format))throw Error('Percentage-lag kan niet naar XER-uren worden vertaald.');
  return {hours,elapsed:hours!==0&&['4','6','8','10','12'].includes(format)};
}
const minute=t=>{
  const m=String(t).match(/(?:^|T)(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/);
  if(!m||+m[1]>24||+m[2]>59||(+m[1]===24&&+m[2])||num(m[3]||'')!==0)throw Error('Ongeldige of niet op hele minuten afgeronde kalenderwerktijd: '+t);
  return +m[1]*60 + +m[2];
};
function ranges(el,msp){
  const result=nodes(msp?field(el,'WorkingTimes'):el,msp?'WorkingTime':'WorkTime').filter(n=>!nil(n)).map(n=>[minute(val(n,msp?'FromTime':'Start')),minute(val(n,msp?'ToTime':'Finish'))]);
  result.sort((a,b)=>a[0]-b[0]);
  if(result.some((r,i)=>r[1]<=r[0]||(i&&r[0]<result[i-1][1])))throw Error('Overlappende of omgekeerde kalenderwerktijden.');
  return result;
}
const record=(name,attributes='',children='')=>'(0||'+name+'('+attributes+')('+children+'))';
const time=v=>String(Math.floor(v/60)).padStart(2,'0')+':'+String(v%60).padStart(2,'0');
const hours=rs=>rs.map((r,i)=>record(i,'f|'+time(r[1])+'|s|'+time(r[0]))).join('');
export function xerCalendarData(week,exceptions=new Map()){
  if(week.length!==7)throw Error('De XER-kalender moet zeven weekdagen bevatten.');
  return record('CalendarData','',record('DaysOfWeek','',week.map((rs,i)=>record(i+1,'',hours(rs))).join(''))+
    record('Exceptions','',Array.from(exceptions).sort((a,b)=>a[0]-b[0]).map(([day,rs],i)=>record(i,'d|'+(day+25569),hours(rs))).join('')));
}
function calendars(root,project,msp,warnings){
  const source=msp?nodes(field(root,'Calendars'),'Calendar'):[...nodes(root,'Calendar'),...nodes(project,'Calendar')];
  const byId=new Map();
  for(const el of source){const id=val(el,msp?'UID':'ObjectId');if(!id||byId.has(id))throw Error('Ontbrekende of dubbele kalender-ID.');byId.set(id,el);}
  const resolved=new Map(),resolving=new Set();
  const warn=text=>{if(!warnings.includes(text))warnings.push(text);};
  function resolve(id){
    if(resolved.has(id))return resolved.get(id);
    if(resolving.has(id))throw Error('Cirkel in de bronkalenders.');
    const el=byId.get(id);if(!el)throw Error('Een gebruikte bronkalender ontbreekt: '+id);
    resolving.add(id);
    const parentId=val(el,msp?'BaseCalendarUID':'BaseCalendarObjectId');
    const parent=parentId&&parentId!=='-1'&&parentId!=='0'?resolve(parentId):null;
    const week=parent?parent.week.map(rs=>rs.map(r=>[...r])):defaultWeek(),exceptions=new Map(parent?.exceptions||[]);
    const entries=msp?nodes(field(el,'WeekDays'),'WeekDay'):nodes(field(el,'StandardWorkWeek'),'StandardWorkHours');
    if(!parent&&entries.filter(n=>!msp||val(n,'DayType')!=='0').length<7)warn('Een bronkalender heeft geen volledige werkweek. Ontbrekende dagen gebruiken ma-vr 08:00-12:00 en 13:00-17:00, weekend vrij.');
    function exception(from,to,rs){
      if(!from||!to)throw Error('Kalenderuitzondering zonder volledig datumbereik.');
      const a=dayNumber(from),b=dayNumber(to);
      if(b<a||b-a>36600)throw Error('Ongeldig datumbereik in kalenderuitzondering.');
      for(let d=a;d<=b;d++)exceptions.set(d,rs);
    }
    for(const entry of entries){
      const i=msp?num(val(entry,'DayType'),-1)-1:days.indexOf(val(entry,'DayOfWeek'));
      if(msp&&i===-1){const p=field(entry,'TimePeriod');exception(val(p,'FromDate'),val(p,'ToDate'),yes(val(entry,'DayWorking'))?ranges(entry,true):[]);continue;}
      if(i<0||i>6)throw Error('Onbekende weekdag in bronkalender.');
      const working=val(entry,'DayWorking');
      if(msp&&working==='2')continue;
      week[i]=msp&&!yes(working)?[]:ranges(entry,msp);
    }
    if(msp){
      if(nodes(field(el,'WorkWeeks'),'WorkWeek').length)throw Error('Afwijkende MSP-werkweken worden nog niet naar XER vertaald. Gebruik de XML-export.');
      for(const e of nodes(field(el,'Exceptions'),'Exception')){
        const type=val(e,'Type'),period=field(e,'TimePeriod');
        if((type&&!['1','9'].includes(type))||yes(val(e,'EnteredByOccurrences'))||num(val(e,'Period'),1)>1)throw Error('Herhalende kalenderuitzonderingen worden nog niet naar XER vertaald. Gebruik de XML-export.');
        exception(val(period,'FromDate'),val(period,'ToDate'),yes(val(e,'DayWorking'))?ranges(e,true):[]);
      }
    }else for(const e of nodes(field(el,'HolidayOrExceptions'),'HolidayOrException').filter(n=>!nil(n)))exception(val(e,'Date'),val(e,'Date'),ranges(e,false));
    const result={id,el,week,exceptions,dayHours:msp?num(val(root,'MinutesPerDay'),480)/60:num(val(el,'HoursPerDay'),8)};
    if(result.dayHours<=0)throw Error('Uren per werkdag moeten groter dan nul zijn.');
    resolving.delete(id);resolved.set(id,result);return result;
  }
  let defaultId=msp?val(project,'CalendarUID'):val(project,'ActivityDefaultCalendarObjectId')||val(project,'CalendarObjectId');
  if(!defaultId||defaultId==='-1'||defaultId==='0')defaultId=byId.keys().next().value;
  if(!defaultId){
    defaultId='default';resolved.set(defaultId,{id:defaultId,week:defaultWeek(),exceptions:new Map(),dayHours:8});
    warn('Geen bronkalender aanwezig. XER gebruikt ma-vr, 8 uur per dag. Controleer dit vóór herberekenen in P6.');
  }
  resolve(defaultId);
  return {defaultId,resolve,all:resolved};
}
function workingDuration(start,finish,calendar){
  if(!start||!finish)throw Error('Een activiteit mist start of einde.');
  const from=dayNumber(start),to=dayNumber(finish),a=minute(start.includes('T')?start:'00:00'),b=minute(finish.includes('T')?finish:'00:00');
  if(to<from||(to===from&&b<a)||to-from>36600)throw Error('Ongeldig activiteitendatumbereik.');
  let minutes=0;
  for(let d=from;d<=to;d++){
    const rs=calendar.exceptions.get(d)||calendar.week[new Date(d*86400000).getUTCDay()];
    for(const [s,f] of rs)minutes+=Math.max(0,Math.min(f,d===to?b:1440)-Math.max(s,d===from?a:0));
  }
  return minutes/60;
}

const windows1252Extended='€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ';
function windows1252Byte(char){
  const point=char.codePointAt(0);
  if(point<128||point>=160&&point<=255)return point;
  const index=windows1252Extended.indexOf(char);
  return index<0?null:128+index;
}

const xerTextSubstitutions=new Map([
  ['−','-'],['‐','-'],['‑','-'],['‒','-'],['→','->'],['←','<-']
]);
function windows1252Text(value,fallback){
  let result='';
  for(const char of value.normalize('NFC')){
    if(windows1252Byte(char)!==null){result+=char;continue;}
    if(/[\p{Cf}\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u.test(char))continue;
    if(/\s/u.test(char)){result+=' ';continue;}
    const simple=xerTextSubstitutions.get(char)??char.normalize('NFKD').replace(/\p{M}/gu,'');
    result+=simple&&[...simple].every(c=>windows1252Byte(c)!==null)?simple:fallback;
  }
  return result;
}

const XER_WBS_NAME_LIMIT=80;
const XER_TASK_NAME_LIMIT=120;
const XER_TEXT_LIMIT=255;
const XER_NOTE_LIMIT=2000;
const tidyXerText=value=>clean(value).replace(/[\x80-\x9f]/g,' ').replace(/\s+/gu,' ').trim();

function prepareXerText(tables){
  let adjustedFields=0;
  for(const [rows,field,id,limit] of [
    [tables.PROJECT,'proj_short_name','proj_id',20],
    [tables.PROJWBS,'wbs_short_name','wbs_id',20],
    [tables.PROJWBS,'wbs_name','wbs_id'],
    [tables.CALENDAR,'clndr_name','clndr_id'],
    [tables.TASK,'task_code','task_id',40],
    [tables.TASK,'task_name','task_id']
  ]){
    const converted=rows.map(row=>{
      const original=String(row[field]??'');
      const value=windows1252Text(tidyXerText(original),limit?'_':'?').replace(/\s+/gu,' ').trim();
      return {row,original,value};
    });
    // Reserve unchanged codes first so the conversion cannot rename an
    // otherwise valid code just because its row came after a changed one.
    const used=new Set(converted.filter(entry=>entry.value===entry.original).map(entry=>entry.original));
    for(const {row,original,value} of converted){
      if(value===original)continue;
      let safe=value.trim();
      if(limit)safe=safe.slice(0,limit);
      if(!safe||limit&&used.has(safe)){
        const base='BD-'+row[id];
        safe=base;
        for(let suffix=2;used.has(safe);suffix++)safe=base+'-'+suffix;
      }
      used.add(safe);
      row[field]=safe;
      adjustedFields++;
    }
  }
  return adjustedFields;
}

// Keep the writer strict so an unhandled field cannot silently corrupt a record.
export function encodeXer(text){
  const out=[];
  for(const char of text){
    const byte=windows1252Byte(char);
    if(byte===null)throw Error('XER Windows-1252 ondersteunt U+'+char.codePointAt(0).toString(16).toUpperCase()+' niet.');
    out.push(byte);
  }
  return new Uint8Array(out);
}
export function serializeXer(tables,now=new Date()){
  const lines=[['ERMHDR','20.12',now.toISOString().slice(0,10),'Project','BiDash','BiDash','dbxDatabaseNoName','Project Management','EUR'].join('\t')];
  for(const [name,rows] of Object.entries(tables)){
    if(!rows.length)continue;
    const columns=[...new Set(rows.flatMap(Object.keys))];
    lines.push('%T\t'+name,'%F\t'+columns.join('\t'));
    for(const row of rows)lines.push('%R\t'+columns.map(c=>clean(row[c])).join('\t'));
  }
  lines.push('%E');return lines.join('\r\n')+'\r\n';
}
// P6 stores the 16 GUID bytes as base64 without padding in XER.
function newXerGuid(){
  const bytes=globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&15)|64;
  bytes[8]=(bytes[8]&63)|128;
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/,'');
}

function prepareXerWbs(tables,msp){
  // Use distinct activity and WBS identifiers in the file. The P6 importer
  // can then assign its database identifiers without reusing a file key.
  const offset=tables.TASK.length+1;
  const siblingCodes=new Map();
  for(const wbs of tables.PROJWBS){
    if(!siblingCodes.has(wbs.parent_wbs_id))siblingCodes.set(wbs.parent_wbs_id,new Set());
    const used=siblingCodes.get(wbs.parent_wbs_id);
    const segment=msp?wbs.wbs_short_name.replace(/\./g,'_'):wbs.wbs_short_name;
    const base=segment.trim()||'WBS-'+wbs.wbs_id;
    let code=base.slice(0,20);
    for(let i=2;used.has(code.toUpperCase());i++){
      const suffix='-'+i;
      code=base.slice(0,20-suffix.length)+suffix;
    }
    used.add(code.toUpperCase());
    wbs.wbs_short_name=code;
    wbs.wbs_id+=offset;
    if(wbs.parent_wbs_id)wbs.parent_wbs_id+=offset;
  }
  for(const task of tables.TASK)task.wbs_id+=offset;
}

function limitXerNames(tables,originalNames){
  const limitField=(rows,field,limit)=>{
    let count=0;
    for(const row of rows){
      if(row[field].length<=limit)continue;
      if(originalNames.has(row))originalNames.get(row).shortened=true;
      row[field]=row[field].slice(0,limit-3).trimEnd()+'...';
      count++;
    }
    return count;
  };
  return {
    shortenedWbsNames:limitField(tables.PROJWBS,'wbs_name',XER_WBS_NAME_LIMIT),
    shortenedTaskNames:limitField(tables.TASK,'task_name',XER_TASK_NAME_LIMIT),
    shortenedTextFields:limitField(tables.CALENDAR,'clndr_name',XER_TEXT_LIMIT)
  };
}

function xerNotebook(text){
  const open='<HTML><BODY>',close='</BODY></HTML>';
  const entities={'&':'&amp;','<':'&lt;','>':'&gt;'};
  const available=XER_NOTE_LIMIT-open.length-close.length;
  const fragments=[];
  let size=0,shortened=false;
  for(const char of tidyXerText(text)){
    const part=entities[char]??(windows1252Byte(char)===null?'&#'+char.codePointAt(0)+';':char);
    if(size+part.length>available){shortened=true;break;}
    fragments.push(part);
    size+=part.length;
  }
  if(shortened)while(size>available-3)size-=fragments.pop().length;
  return {html:open+fragments.join('')+(shortened?'...':'')+close,shortened};
}

function appendXerNotebooks(tables,sourceNotes,originalNames){
  let shortenedNotes=0;
  for(const [rows,memos,id,memoId,memoText] of [
    [tables.PROJWBS,tables.WBSMEMO,'wbs_id','wbs_memo_id','wbs_memo'],
    [tables.TASK,tables.TASKMEMO,'task_id','memo_id','task_memo']
  ]){
    for(const row of rows){
      const original=originalNames.get(row);
      const note=sourceNotes.get(row);
      const label=id==='task_id'?'Oorspronkelijke taaknaam: ':'Oorspronkelijke WBS-naam: ';
      const content=[original?.shortened?label+original.name:'',note].filter(Boolean).join(' | ');
      if(!tidyXerText(content))continue;
      const {html,shortened}=xerNotebook(content);
      if(shortened)shortenedNotes++;
      memos.push({[memoId]:memos.length+1,[id]:row[id],memo_type_id:1,proj_id:row.proj_id,[memoText]:html});
    }
  }
  if(tables.TASKMEMO.length||tables.WBSMEMO.length){
    tables.MEMOTYPE.push({memo_type_id:1,seq_num:0,eps_flag:'N',proj_flag:'N',wbs_flag:'Y',task_flag:'Y',memo_type:'BiDash onderbouwing'});
  }
  return shortenedNotes;
}

export function validateXer(tables,expected){
  const index=(name,key)=>{
    const rows=tables[name]||[],map=new Map();
    for(const row of rows){const id=String(row[key]);if(!/^[1-9]\d*$/.test(id)||map.has(id))throw Error('Ongeldige of dubbele XER-ID in '+name);map.set(id,row);}return map;
  };
  const obs=index('OBS','obs_id');
  const projects=index('PROJECT','proj_id'),wbs=index('PROJWBS','wbs_id'),tasks=index('TASK','task_id'),cals=index('CALENDAR','clndr_id');index('TASKPRED','task_pred_id');
  if(projects.size!==1||tasks.size!==expected)throw Error('Het XER-activiteitenaantal wijkt af van de planning.');
  const project=[...projects.values()][0];
  if(!project.proj_short_name||project.project_flag!=='Y'||project.export_flag!=='Y'||String(project.loaded_scope_level)!=='7'||!cals.has(String(project.clndr_id)))throw Error('XER mist de projectgegevens voor een volledige P6-import.');
  const codes=new Set();
  for(const cal of cals.values())if(clean(cal.clndr_name).length>XER_TEXT_LIMIT)throw Error('XER-kalendernaam overschrijdt de veldlengte.');
  for(const t of tasks.values()){
    if(!projects.has(String(t.proj_id))||String(wbs.get(String(t.wbs_id))?.proj_id)!==String(t.proj_id)||!cals.has(String(t.clndr_id)))throw Error('Ongeldige project-, WBS- of kalenderverwijzing in XER.');
    if(clean(t.task_name).length>XER_TASK_NAME_LIMIT)throw Error('XER-activiteitnaam overschrijdt de veldlengte.');
    if(wbs.has(String(t.task_id)))throw Error('XER bevat een gedeelde activiteit- en WBS-ID.');
    if(!t.task_code||codes.has(t.task_code))throw Error('Dubbele of ontbrekende XER-activiteitcode.');codes.add(t.task_code);
  }
  const writtenWbs=new Set();
  for(const w of wbs.values()){
    if(!projects.has(String(w.proj_id)))throw Error('WBS verwijst naar ontbrekend project.');
    if(!obs.has(String(w.obs_id)))throw Error('WBS verwijst naar ontbrekende OBS.');
    if(clean(w.wbs_name).length>XER_WBS_NAME_LIMIT)throw Error('XER-WBS-naam overschrijdt de veldlengte van '+XER_WBS_NAME_LIMIT+' tekens.');
    let current=w;const seen=new Set();
    while(current.parent_wbs_id){if(seen.has(current.wbs_id))throw Error('Cirkel in XER-WBS.');seen.add(current.wbs_id);current=wbs.get(String(current.parent_wbs_id));if(!current)throw Error('Ontbrekende bovenliggende XER-WBS.');}
    if(w.parent_wbs_id&&!writtenWbs.has(String(w.parent_wbs_id)))throw Error('Een bovenliggende XER-WBS moet voor haar onderliggende WBS staan.');
    writtenWbs.add(String(w.wbs_id));
  }
  if([...wbs.values()].filter(w=>!w.parent_wbs_id&&w.proj_node_flag==='Y').length!==1)throw Error('XER vereist één project-WBS.');
  for(const r of tables.TASKPRED||[])if(!tasks.has(String(r.task_id))||!tasks.has(String(r.pred_task_id))||r.task_id===r.pred_task_id||!['PR_FS','PR_SS','PR_FF','PR_SF'].includes(r.pred_type)||!Number.isFinite(r.lag_hr_cnt))throw Error('Ongeldige XER-relatie.');
  const memoTypes=index('MEMOTYPE','memo_type_id');
  for(const [table,memoId,id,parents,textField] of [
    ['WBSMEMO','wbs_memo_id','wbs_id',wbs,'wbs_memo'],
    ['TASKMEMO','memo_id','task_id',tasks,'task_memo']
  ]){
    for(const memo of index(table,memoId).values()){
      const parent=parents.get(String(memo[id]));
      if(!parent||String(parent.proj_id)!==String(memo.proj_id)||
        !memoTypes.has(String(memo.memo_type_id))||clean(memo[textField]).length>XER_NOTE_LIMIT){
        throw Error('Ongeldige XER-notitie in '+table+'.');
      }
    }
  }
  if(tables.SCHEDOPTIONS?.length){
    index('SCHEDOPTIONS','schedoptions_id');
    for(const s of tables.SCHEDOPTIONS)if(!projects.has(String(s.proj_id))||!['rcal_Predecessor','rcal_Successor','rcal_ProjDefault','rcal_24Hour'].includes(s.sched_calendar_on_relationship_lag))throw Error('Ongeldige XER-lagkalender.');
  }
}

export function createXerExport({xml,filename,model,Parser=globalThis.DOMParser,now=new Date()}){
  if(!xml||!model?.regels?.length)throw Error('Laad eerst een planning.');
  const doc=new Parser().parseFromString(xml,'application/xml'),root=doc.documentElement;
  if(doc.getElementsByTagNameNS('*','parsererror').length)throw Error('Ongeldige planning-XML.');
  const msp=root.localName==='Project'&&(!root.namespaceURI||root.namespaceURI==='http://schemas.microsoft.com/project');
  if(!msp&&(root.localName!=='APIBusinessObjects'||root.namespaceURI&&!/^http:\/\/xmlns\.oracle\.com\/Primavera\/P6(?:Professional)?\/[^/]+\/API\/BusinessObjects$/.test(root.namespaceURI)))throw Error('XER ondersteunt alleen MS Project XML en Primavera P6 XML.');
  const project=msp?root:nodes(root,'Project').filter(p=>nodes(p,'Activity').length).at(-1);
  if(!project)throw Error('Geen P6-project gevonden.');
  if(msp&&doc.getElementsByTagNameNS(root.namespaceURI||null,'Project').length>1)throw Error('Ingesloten deelprojecten kunnen niet volledig naar XER worden vertaald.');
  const warnings=['XER bevat de planning. Resources, toewijzingen, kosten, baselines, gebruikersvelden en activiteitcodes worden niet overgenomen. Bewaar daarvoor de bron-XML en volledige back-up.','Controleer de import als nieuw project in P6. Acceptatie en herberekening in P6 Professional zijn niet getest.'];
  const source= msp?nodes(field(root,'Tasks'),'Task'):nodes(project,'Activity'),byId=new Map();
  for(const el of source){const id=val(el,msp?'UID':'ObjectId');if(!id||byId.has(id))throw Error('Dubbele of ontbrekende bronactiviteit-ID.');byId.set(id,el);}
  const cals=calendars(root,project,msp,warnings),calIds=new Map(),taskIds=new Map(),wbsIds=new Map(),tables={};
  const name=val(project,'Name')||val(project,'Id')||String(filename||'Planning').replace(/\.xml$/i,'');
  const guid=newXerGuid();
  // Each MSP export is a new P6 project, including retries after a partial import.
  const exportSuffix=[...atob(guid)].slice(0,5).map(c=>c.charCodeAt(0).toString(16).padStart(2,'0')).join('').toUpperCase();
  const projectCode=clean(msp?'BD-'+exportSuffix:val(project,'Id')||'BD-'+exportSuffix).slice(0,20);
  tables.CURRTYPE=[{curr_id:1,decimal_digit_cnt:2,curr_symbol:'€',decimal_symbol:'.',digit_group_symbol:',',pos_curr_fmt_type:'#1.1',neg_curr_fmt_type:'(#1.1)',curr_type:'Euro',curr_short_name:'EUR',group_digit_cnt:3,base_exch_rate:1}];
  tables.MEMOTYPE=[];
  const sourceNotes=new Map();
  const obsId=1;
  tables.OBS=[{obs_id:obsId,parent_obs_id:'',guid:'',seq_num:0,obs_name:'Enterprise',obs_descr:'<HTML><BODY></BODY></HTML>'}];
  tables.PROJECT=[];tables.CALENDAR=[];tables.SCHEDOPTIONS=[];tables.PROJWBS=[];tables.TASK=[];tables.WBSMEMO=[];tables.TASKMEMO=[];tables.TASKPRED=[];
  const sourceWbs=model.wbs||{},top=Object.keys(sourceWbs).filter(id=>!sourceWbs[sourceWbs[id].parent]),rootId=top.length===1?top[0]:'__xer_root';
  const wbs={...sourceWbs};if(top.length!==1)wbs[rootId]={naam:name,parent:'',seq:0};
  wbsIds.set(rootId,1);for(const id of Object.keys(wbs))if(!wbsIds.has(id))wbsIds.set(id,wbsIds.size+1);
  const summary=msp?new Map(source.filter(n=>yes(val(n,'Summary'))).map(n=>['msp_wbs_'+val(n,'UID'),n])):new Map();
  function appendWbs({id,parent,code,name,sequence,isProject=false}){
    tables.PROJWBS.push({
      wbs_id:id,proj_id:1,obs_id:obsId,seq_num:sequence,proj_node_flag:isProject?'Y':'N',
      sum_data_flag:'N',status_code:'WS_Open',wbs_short_name:code,wbs_name:name,phase_id:'',
      parent_wbs_id:parent,ev_user_pct:0,ev_etc_user_value:0.88,orig_cost:0,
      indep_remain_total_cost:0,ann_dscnt_rate_pct:'',dscnt_period_type:'',indep_remain_work_qty:'',
      anticip_start_date:'',anticip_end_date:'',ev_compute_type:'EC_Cmp_pct',
      ev_etc_compute_type:'EE_Rem_hr',guid:newXerGuid(),tmpl_guid:'',plan_open_state:''
    });
  }
  const written=new Set();
  const visit=(id,seen=new Set())=>{
    if(written.has(id))return;
    if(seen.has(id))throw Error('Cirkel in bron-WBS.');
    seen.add(id);
    const item=wbs[id],isProject=id===rootId;
    const parent=isProject?'':wbs[item.parent]?item.parent:rootId;
    if(parent)visit(parent,seen);
    const number=wbsIds.get(id);
    let code=clean(isProject?projectCode:item.code||val(summary.get(id),'WBS')||val(summary.get(id),'OutlineNumber')||number);
    if(msp&&!isProject&&/^\d+(?:\.\d+)+$/.test(code))code=code.split('.').at(-1);
    appendWbs({id:number,parent:parent?wbsIds.get(parent):'',code,name:isProject?name:item.naam||id,sequence:num(String(item.seq??0)),isProject});
    const note=msp?val(isProject?source.find(n=>val(n,'UID')==='0'):summary.get(id),'Notes'):'';
    if(note)sourceNotes.set(tables.PROJWBS.at(-1),note);
    written.add(id);
  };
  for(const id of wbsIds.keys())visit(id);
  function calId(id){
    if(!id||id==='-1'||id==='0')id=cals.defaultId;
    const cal=cals.resolve(id);if(!calIds.has(id)){
      const cid=calIds.size+1;calIds.set(id,cid);
      const weekHours=cal.week.flat().reduce((n,r)=>n+(r[1]-r[0])/60,0);
      tables.CALENDAR.push({clndr_id:cid,default_flag:'N',clndr_name:val(cal.el,'Name')||'BiDash 5 dagen 8 uur',proj_id:1,base_clndr_id:'',last_chng_date:'',clndr_type:'CA_Project',day_hr_cnt:cal.dayHours,week_hr_cnt:weekHours,month_hr_cnt:msp?num(val(root,'MinutesPerMonth'),9600)/60:num(val(cal.el,'HoursPerMonth'),160),year_hr_cnt:msp?cal.dayHours*260:num(val(cal.el,'HoursPerYear'),2080),rsrc_private:'N',clndr_data:xerCalendarData(cal.week,cal.exceptions)});
    }return {id:calIds.get(id),cal};
  }
  calId(cals.defaultId);
  const usedCodes=new Set();let derivedDurations=0,localized=0;
  const p6types={'Task Dependent':'TT_Task','Resource Dependent':'TT_Rsrc','Level of Effort':'TT_LOE','Start Milestone':'TT_Mile','Finish Milestone':'TT_FinMile','WBS Summary':'TT_WBS'};
  const p6constraints={'Start On':'CS_MSO','Finish On':'CS_MEO','Start On or After':'CS_SNET','Start On or Before':'CS_SNLT','Finish On or After':'CS_FNET','Finish On or Before':'CS_FNLT','Mandatory Start':'CS_MSOA','Mandatory Finish':'CS_MEOA','As Late As Possible':'CS_ALAP'};
  const date=(el,...names)=>{for(const n of names){const v=val(el,n);if(v)return xerDate(v);}return '';};
  for(const regel of model.regels){
    const id=String(regel.id),el=byId.get(id);if(!el||taskIds.has(id)||msp&&yes(val(el,'Summary')))throw Error('De bron en planning hebben verschillende of dubbele activiteit-ID’s.');
    const taskId=taskIds.size+1;taskIds.set(id,taskId);
    const activityWbs=regel.wbs||rootId;
    if(!wbsIds.has(activityWbs))throw Error('Een activiteit verwijst naar ontbrekende WBS.');
    if(msp&&yes(val(el,'IsSubproject')))throw Error('Een activiteit verwijst naar een niet ingesloten deelproject.');
    if(msp&&yes(val(el,'ExternalTask')))localized++;
    const calendar=calId(val(el,msp?'CalendarUID':'CalendarObjectId'));
    const start=date(el,msp?'Start':'StartDate',msp?'EarlyStart':'PlannedStartDate'),finish=date(el,msp?'Finish':'FinishDate',msp?'EarlyFinish':'PlannedFinishDate');
    if(!start||!finish||finish<start)throw Error('Een activiteit mist geldige start- of einddatums.');
    let code=val(el,msp?'ID':'Id')||id;
    if(usedCodes.has(clean(code).slice(0,40)))code='BD-'+id;
    code=clean(code).slice(0,40);if(usedCodes.has(code))throw Error('Dubbele activiteitcode na XER-conversie.');usedCodes.add(code);
    const milestone=msp?yes(val(el,'Milestone'))||regel.kind==='mile':/Milestone/.test(val(el,'Type'));
    const actualStart=date(el,msp?'ActualStart':'ActualStartDate'),actualEnd=date(el,msp?'ActualFinish':'ActualFinishDate');
    const pct=msp?num(val(el,'PercentComplete')):num(val(el,'PhysicalPercentComplete'));
    if(pct<0||pct>100)throw Error('Een gereedpercentage valt buiten 0 tot 100.');
    const status=msp?(actualEnd?'TK_Complete':actualStart?'TK_Active':'TK_NotStart'):({'Not Started':'TK_NotStart','In Progress':'TK_Active','Completed':'TK_Complete'}[val(el,'Status')]||(actualEnd?'TK_Complete':actualStart?'TK_Active':'TK_NotStart'));
    let duration=msp?xerDuration(val(el,'Duration')):val(el,'PlannedDuration')===''?null:num(val(el,'PlannedDuration'));
    if(duration===null&&!milestone){duration=workingDuration(start.replace(' ','T')+':00',finish.replace(' ','T')+':00',calendar.cal);derivedDurations++;}
    if(milestone)duration=0;
    let remaining=msp?xerDuration(val(el,'RemainingDuration')):val(el,'RemainingDuration')===''?null:num(val(el,'RemainingDuration'));
    if(remaining===null)remaining=status==='TK_Complete'?0:duration*(1-pct/100);
    if(duration<0||remaining<0)throw Error('Een activiteit heeft een negatieve duur.');
    const constraint=msp?({'0':'','1':'CS_ALAP','2':'CS_MSO','3':'CS_MEO','4':'CS_SNET','5':'CS_SNLT','6':'CS_FNET','7':'CS_FNLT'}[val(el,'ConstraintType')||'0']):p6constraints[val(el,'PrimaryConstraintType')]||'';
    if(constraint===undefined)throw Error('Onbekend MSP-constrainttype.');
    if(!msp&&val(el,'PrimaryConstraintType')&&!p6constraints[val(el,'PrimaryConstraintType')]&&val(el,'PrimaryConstraintType')!=='None')throw Error('Niet ondersteund P6-constrainttype.');
    if(!msp&&val(el,'SecondaryConstraintType')&&!p6constraints[val(el,'SecondaryConstraintType')]&&val(el,'SecondaryConstraintType')!=='None')throw Error('Niet ondersteund tweede P6-constrainttype.');
    const taskType=msp?(milestone?'TT_FinMile':'TT_Task'):p6types[val(el,'Type')||'Task Dependent'];if(!taskType)throw Error('Onbekend P6-activiteitstype.');
    const completeType=msp?'CP_Drtn':({'Duration':'CP_Drtn','Physical':'CP_Phys','Units':'CP_Units'}[val(el,'PercentCompleteType')||'Duration']);
    if(!completeType)throw Error('Onbekend P6-gereedpercentagetype.');
    const durationType=msp?({'0':'DT_FixedRate','1':'DT_FixedQty','2':yes(val(el,'EffortDriven'))?'DT_FixedDUR2':'DT_FixedDrtn'}[val(el,'Type')||'2']):({'Fixed Duration & Units':'DT_FixedDUR2','Fixed Duration and Units':'DT_FixedDUR2','Fixed Duration & Units/Time':'DT_FixedDrtn','Fixed Duration and Units/Time':'DT_FixedDrtn','Fixed Units':'DT_FixedQty','Fixed Units/Time':'DT_FixedRate'}[val(el,'DurationType')||'Fixed Duration & Units/Time']);
    if(!durationType)throw Error('Onbekend P6-duurtype.');
    tables.TASK.push({task_id:taskId,proj_id:1,wbs_id:wbsIds.get(activityWbs),clndr_id:calendar.id,phys_complete_pct:pct,rev_fdbk_flag:'N',est_wt:1,lock_plan_flag:'N',auto_compute_act_flag:'N',complete_pct_type:completeType,task_type:taskType,duration_type:durationType,status_code:status,task_code:code,task_name:val(el,'Name')||regel.naam,
      target_drtn_hr_cnt:duration,remain_drtn_hr_cnt:remaining,act_work_qty:msp?xerDuration(val(el,'ActualWork'))||0:num(val(el,'ActualLaborUnits')),remain_work_qty:msp?xerDuration(val(el,'RemainingWork'))||0:num(val(el,'RemainingLaborUnits')),target_work_qty:msp?xerDuration(val(el,'Work'))||0:num(val(el,'PlannedLaborUnits')),target_equip_qty:msp?0:num(val(el,'PlannedNonLaborUnits')),act_equip_qty:msp?0:num(val(el,'ActualNonLaborUnits')),remain_equip_qty:msp?0:num(val(el,'RemainingNonLaborUnits')),
      target_start_date:date(el,msp?'Start':'PlannedStartDate')||start,target_end_date:date(el,msp?'Finish':'PlannedFinishDate')||finish,
      early_start_date:date(el,msp?'EarlyStart':'EarlyStartDate')||start,early_end_date:date(el,msp?'EarlyFinish':'EarlyFinishDate')||finish,
      late_start_date:date(el,msp?'LateStart':'LateStartDate'),late_end_date:date(el,msp?'LateFinish':'LateFinishDate'),restart_date:status==='TK_Complete'?'':date(el,msp?'Resume':'RemainingEarlyStartDate')||start,reend_date:status==='TK_Complete'?'':date(el,msp?'Finish':'RemainingEarlyFinishDate')||finish,
      act_start_date:actualStart,act_end_date:actualEnd,cstr_type:constraint,cstr_date:constraint&&constraint!=='CS_ALAP'?date(el,msp?'ConstraintDate':'PrimaryConstraintDate'):'',cstr_type2:msp?'':p6constraints[val(el,'SecondaryConstraintType')]||'',cstr_date2:msp?'':date(el,'SecondaryConstraintDate'),priority_type:'PT_Normal',driving_path_flag:'N'});
    const note=msp?val(el,'Notes'):'';
    if(note)sourceNotes.set(tables.TASK.at(-1),note);
  }
  // Source XML, not the inferred CIV relations, is the owner of exported links.
  let sourceLinks=0,summaryLinks=0,elapsedLinks=0,lagActivities=0;
  function link(from,to,type,lag){
    if(!taskIds.has(from)||!taskIds.has(to))throw Error('Een bronrelatie verwijst naar een taak buiten de geladen planning. XER-export gestopt.');
    tables.TASKPRED.push({task_pred_id:tables.TASKPRED.length+1,task_id:taskIds.get(to),pred_task_id:taskIds.get(from),proj_id:1,pred_proj_id:1,pred_type:'PR_'+type,lag_hr_cnt:lag});
  }
  if(msp){
    const links=[];
    const summaries=new Set(source.filter(el=>yes(val(el,'Summary'))).map(el=>val(el,'UID')));
    for(const el of source)for(const rel of nodes(el,'PredecessorLink')){
      sourceLinks++;const from=val(rel,'PredecessorUID'),to=val(el,'UID'),type=({'0':'FF','1':'FS','2':'SF','3':'SS'})[val(rel,'Type')||'1'];
      if(!type)throw Error('Onbekend MSP-relatietype.');
      if(yes(val(rel,'CrossProject'))&&!byId.has(from))throw Error('Een externe projectrelatie is niet in de bron opgenomen.');
      const {hours:lag,elapsed}=xerMsProjectLag(val(rel,'LinkLag'),val(rel,'LagFormat'));
      if(elapsed)elapsedLinks++;
      if(summaries.has(from)||summaries.has(to)){
        const descendants=id=>summaries.has(id)?model.regels.filter(r=>r.wbsPath?.includes('msp_wbs_'+id)):model.regels.filter(r=>String(r.id)===id);
        const boundary=(items,start)=>{const values=items.map(r=>byId.get(String(r.id))).map(n=>val(n,start?'Start':'Finish'));if(!values.length||values.some(v=>!v))throw Error('Samenvattingsrelatie mist gedateerde randactiviteiten.');const edge=values.slice().sort()[start?0:values.length-1];return items.filter((_,i)=>values[i]===edge);};
        const a=boundary(descendants(from),type[0]==='S'),b=boundary(descendants(to),type[1]==='S');
        for(const p of a)for(const s of b)links.push({from:String(p.id),to:String(s.id),type,lag,elapsed});summaryLinks++;
      }else links.push({from,to,type,lag,elapsed});
    }
    // P6's lag calendar is project-wide. A 24h setting is exact when every
    // nonzero lag is elapsed. With mixed lag types, leave ordinary links alone
    // and express each elapsed span as a separate, zero-cost 24h activity.
    // Both zero-lag edges then work independently of the project lag calendar.
    const mixed=elapsedLinks>0&&links.some(r=>!r.elapsed&&r.lag!==0);
    if(elapsedLinks&&!mixed){
      tables.SCHEDOPTIONS.push({schedoptions_id:1,proj_id:1,sched_calendar_on_relationship_lag:'rcal_24Hour'});
      warnings.push(elapsedLinks+' kalenderwachttijden behouden hun uren. P6 gebruikt de 24-uurskalender voor relatiewachttijden.');
    }
    if(mixed)tables.SCHEDOPTIONS.push({schedoptions_id:1,proj_id:1,sched_calendar_on_relationship_lag:'rcal_Predecessor'});
    let lagCalendar,lagWbs;
    function lagActivity(r){
      if(!taskIds.has(r.from)||!taskIds.has(r.to))throw Error('Een bronrelatie verwijst naar een taak buiten de geladen planning. XER-export gestopt.');
      if(!lagCalendar){
        lagCalendar=tables.CALENDAR.length+1;
        tables.CALENDAR.push({clndr_id:lagCalendar,default_flag:'N',clndr_name:'BiDash kalenderwachttijd 24 uur',proj_id:1,base_clndr_id:'',last_chng_date:'',clndr_type:'CA_Project',day_hr_cnt:24,week_hr_cnt:168,month_hr_cnt:730,year_hr_cnt:8760,rsrc_private:'N',clndr_data:xerCalendarData(days.map(()=>[[0,1440]]))});
        lagWbs=tables.PROJWBS.length+1;
        appendWbs({id:lagWbs,parent:wbsIds.get(rootId),code:'BD-LAG-'+lagWbs,name:'Kalenderwachttijden voor relaties',sequence:lagWbs});
      }
      const pred=tables.TASK.find(t=>t.task_id===taskIds.get(r.from));
      const anchor=r.type[0]==='F'?(pred.act_end_date||pred.early_end_date||pred.target_end_date):(pred.act_start_date||pred.early_start_date||pred.target_start_date);
      const stamp=Date.parse(anchor.replace(' ','T')+':00Z'),span=Math.abs(r.lag)*3600000;
      const wall=ms=>{const d=new Date(ms);if(!Number.isFinite(d.getTime())||d.getUTCFullYear()<1||d.getUTCFullYear()>9999)throw Error('Kalenderwachttijd valt buiten het P6-datumbereik.');return d.toISOString().slice(0,16).replace('T',' ');};
      const start=wall(r.lag>0?stamp:stamp-span),finish=wall(r.lag>0?stamp+span:stamp);
      let id='__xer_elapsed_'+(lagActivities+1),code='BD-LAG-'+(lagActivities+1);
      while(taskIds.has(id))id+='_';while(usedCodes.has(code))code+='_';
      const taskId=tables.TASK.length+1;taskIds.set(id,taskId);usedCodes.add(code);lagActivities++;
      tables.TASK.push({...pred,task_id:taskId,wbs_id:lagWbs,clndr_id:lagCalendar,task_code:code,task_name:'Kalenderwachttijd '+pred.task_code+' naar '+tables.TASK.find(t=>t.task_id===taskIds.get(r.to)).task_code,
        task_type:'TT_Task',duration_type:'DT_FixedDrtn',complete_pct_type:'CP_Drtn',phys_complete_pct:0,status_code:'TK_NotStart',
        target_drtn_hr_cnt:Math.abs(r.lag),remain_drtn_hr_cnt:Math.abs(r.lag),act_work_qty:0,remain_work_qty:0,target_work_qty:0,target_equip_qty:0,act_equip_qty:0,remain_equip_qty:0,
        target_start_date:start,target_end_date:finish,early_start_date:start,early_end_date:finish,restart_date:start,reend_date:finish,
        act_start_date:'',act_end_date:'',late_start_date:'',late_end_date:'',cstr_type:'',cstr_date:'',cstr_type2:'',cstr_date2:''});
      // Positive span: predecessor -> helper start, helper finish -> successor.
      // Negative span: predecessor -> helper finish, helper start -> successor.
      link(r.from,id,r.type[0]+(r.lag>0?'S':'F'),0);
      link(id,r.to,(r.lag>0?'F':'S')+r.type[1],0);
    }
    for(const r of links){
      if(mixed&&r.elapsed)lagActivity(r);
      else link(r.from,r.to,r.type,r.lag);
    }
    if(lagActivities)warnings.push(lagActivities+' kalenderwachttijden zijn extra activiteiten met een 24-uurskalender in de WBS Kalenderwachttijden voor relaties. Alle '+model.regels.length+' bronactiviteiten blijven behouden. Gewone werkurenlag blijft ongewijzigd. Controleer de planning na herberekenen in P6.');
  }else for(const rel of nodes(project,'Relationship')){
    sourceLinks++;const type=({'Finish to Start':'FS','Start to Start':'SS','Finish to Finish':'FF','Start to Finish':'SF'})[val(rel,'Type')];
    if(!type)throw Error('Onbekend P6-relatietype.');
    link(val(rel,'PredecessorActivityObjectId'),val(rel,'SuccessorActivityObjectId'),type,num(val(rel,'Lag')));
  }
  const starts=tables.TASK.map(t=>t.target_start_date).sort(),ends=tables.TASK.map(t=>t.target_end_date).sort();
  // Include the project-level fields found in a native P6 project export.
  tables.PROJECT.push({
    proj_id:1,fy_start_month_num:1,rsrc_self_add_flag:'N',allow_complete_flag:'Y',
    rsrc_multi_assign_flag:'Y',checkout_flag:'N',project_flag:'Y',step_complete_flag:'N',
    cost_qty_recalc_flag:'N',batch_sum_flag:'Y',name_sep_char:'.',def_complete_pct_type:'CP_Drtn',
    proj_short_name:projectCode,acct_id:'',orig_proj_id:'',source_proj_id:'',base_type_id:'',
    clndr_id:calIds.get(cals.defaultId),sum_base_proj_id:'',task_code_base:1000,task_code_step:10,
    priority_num:10,wbs_max_sum_level:0,strgy_priority_num:100,last_checksum:'',
    critical_drtn_hr_cnt:0,def_cost_per_qty:0,last_recalc_date:date(project,msp?'StatusDate':'DataDate')||starts[0],
    plan_start_date:starts[0],plan_end_date:date(project,msp?'MustFinishBy':'MustFinishByDate'),
    scd_end_date:ends.at(-1),add_date:now.toISOString().slice(0,16).replace('T',' '),
    last_tasksum_date:'',fcst_start_date:'',def_duration_type:'DT_FixedDrtn',task_code_prefix:'A',
    guid,def_qty_type:'QT_Hour',add_by_name:'BiDash',web_local_root_path:'',proj_url:'',
    def_rate_type:'COST_PER_QTY',add_act_remain_flag:'N',act_this_per_link_flag:'Y',
    def_task_type:'TT_Task',act_pct_link_flag:'Y',critical_path_type:'CT_TotFloat',
    task_code_prefix_flag:'Y',def_rollup_dates_flag:'Y',use_project_baseline_flag:'N',rem_target_link_flag:'Y',
    reset_planned_flag:'N',allow_neg_act_flag:'N',sum_assign_level:'SL_Taskrsrc',
    last_fin_dates_id:'',last_baseline_update_date:'',cr_external_key:'',apply_actuals_date:'',location_id:'',
    loaded_scope_level:7,export_flag:'Y',new_fin_dates_id:'',next_data_date:'',close_period_flag:'',
    sum_refresh_date:'',trsrcsum_loaded:''
  });
  if(derivedDurations)warnings.push(derivedDurations+' duren zijn uit werktijden en bronkalenders berekend omdat een XML-duur ontbreekt.');
  if(localized)warnings.push(localized+' aanwezige externe taken worden lokale P6-activiteiten.');
  if(summaryLinks)warnings.push(summaryLinks+' samenvattingsrelaties zijn naar hun randactiviteiten vertaald.');
  const omitted=source.filter(n=>!taskIds.has(val(n,msp?'UID':'ObjectId'))&&!(msp&&(yes(val(n,'Summary'))||val(n,'UID')==='0'))).length;
  if(omitted)warnings.push(omitted+' bronactiviteiten zonder planningregel staan niet in deze XER.');
  const inferred=(model.relaties||[]).filter(r=>r.inferredPair).length;
  if(inferred)warnings.push(inferred+' afgeleide CIV-relaties worden niet als bronrelaties geëxporteerd.');
  warnings.push('XER bewaart lokale datums op minuten, zonder tijdzone. Scenariodatums volgen de XML-export; werkelijke datums en constraints blijven bronwaarden.');
  const originalNames=new Map();
  for(const row of tables.PROJWBS)originalNames.set(row,{name:row.wbs_name});
  for(const row of tables.TASK)originalNames.set(row,{name:row.task_name});
  const adjustedTextFields=prepareXerText(tables);
  const {shortenedWbsNames,shortenedTaskNames,shortenedTextFields}=limitXerNames(tables,originalNames);
  prepareXerWbs(tables,msp);
  const shortenedNotes=appendXerNotebooks(tables,sourceNotes,originalNames);
  const totalShortened=shortenedWbsNames+shortenedTaskNames+shortenedTextFields+shortenedNotes;
  if(adjustedTextFields)warnings.unshift(adjustedTextFields+' tekstvelden zijn opgeschoond en aangepast voor Windows-1252.');
  if(totalShortened)warnings.unshift(totalShortened+' velden ingekort in de XER: '+shortenedWbsNames+' WBS-namen, '+shortenedTaskNames+' activiteitnamen, '+shortenedTextFields+' overige tekstvelden en '+shortenedNotes+' notities.');
  validateXer(tables,model.regels.length+lagActivities);
  const text=serializeXer(tables,now);
  return {text:encodeXer(text),name:primaveraExportFilename(filename,now).replace(/\.xml$/i,'.xer'),type:'application/octet-stream',formatLabel:'Primavera P6 XER',projectCode:tables.PROJECT[0].proj_short_name,adjustedTextFields,shortenedWbsNames,shortenedTaskNames,shortenedTextFields,shortenedNotes,exportedActivities:tables.TASK.length,sourceActivities:model.regels.length,lagActivities,elapsedLinks,exportedSourceLinks:tables.TASKPRED.length,sourceLinks,wbsCount:tables.PROJWBS.length,calendarCount:tables.CALENDAR.length,warnings,
    importInstruction:'In P6: Bestand > Importeren > Primavera PM (XER). Kies een nieuw project en controleer de planning vóór herberekenen.'};
}
