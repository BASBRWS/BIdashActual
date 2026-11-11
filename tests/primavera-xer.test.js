import test from 'node:test';
import assert from 'node:assert/strict';
import {xerDate,xerDuration,xerCalendarData,encodeXer,serializeXer,validateXer,createXerExport,xerMsProjectLag} from '../site/core/primavera-xer.js';

// Inject DOM nodes to exercise the converter without a runtime XML dependency.
// Browser DOMParser and file import are checked separately in the planning UI.
const ns='http://schemas.microsoft.com/project';
function node(name,content=[],uri=ns){
 const children=Array.isArray(content)?content:[];
 const n={nodeType:1,localName:name,namespaceURI:uri,childNodes:children,textContent:Array.isArray(content)?children.map(n=>n.textContent).join(''):String(content)};
 n.getElementsByTagNameNS=(namespace,name)=>children.flatMap(child=>[...(child.localName===name&&(namespace==='*'||namespace===child.namespaceURI)?[child]:[]),...child.getElementsByTagNameNS(namespace,name)]);
 return n;
}
const fields=(data,uri=ns)=>Object.entries(data).map(([name,text])=>node(name,text,uri));
export function fixture({count=3,lag=600,missing=false,calendar=true,lagFormats=[],lags=[],relationTypes=[]}={}){
 const tasks=[node('Task',fields({UID:1,ID:1,Name:'WBS één',Summary:1,WBS:'1'}))];
 for(let i=0;i<count;i++)tasks.push(node('Task',[...fields({UID:i+2,ID:i+2,Name:'Activiteit '+i,Summary:0,Start:'2030-02-01T08:00:00',Finish:'2030-02-01T17:00:00',Duration:'PT8H',RemainingDuration:'PT8H',CalendarUID:calendar?1:-1,ExternalTask:1,Type:2}),...(i?[node('PredecessorLink',fields({PredecessorUID:missing?999:i+1,Type:relationTypes[i-1]??i%4,LinkLag:lags[i-1]??lag,LagFormat:lagFormats[i-1]??21}))]:[])]));
 const weekdays=Array.from({length:7},(_,i)=>node('WeekDay',[...fields({DayType:i+1,DayWorking:i>0&&i<6?1:0}),...(i>0&&i<6?[node('WorkingTimes',[node('WorkingTime',fields({FromTime:'08:00:00',ToTime:'12:00:00'})),node('WorkingTime',fields({FromTime:'13:00:00',ToTime:'17:00:00'}))])]:[])]));
 const root=node('Project',[...fields({Name:'Synthetische planning',CalendarUID:calendar?1:-1,MinutesPerDay:480}),node('Tasks',tasks),...(calendar?[node('Calendars',[node('Calendar',[...fields({UID:1,Name:'Werkweek'}),node('WeekDays',weekdays)])])]:[])]);
 const doc={documentElement:root,getElementsByTagNameNS:(namespace,name)=>[...(root.localName===name&&namespace===ns?[root]:[]),...root.getElementsByTagNameNS(namespace,name)]};
 const Parser=class{parseFromString(){return doc;}};
 const model={regels:Array.from({length:count},(_,i)=>({id:String(i+2),naam:'Activiteit '+i,wbs:'msp_wbs_1',kind:'bar',wbsPath:['msp_root','msp_wbs_1']})),wbs:{msp_root:{naam:'Planning',parent:'',seq:0},msp_wbs_1:{naam:'WBS één',parent:'msp_root',seq:1}},relaties:[{inferredPair:true}]};
 return {xml:'synthetic DOM',filename:'test.xml',model,Parser,root,tasks};
}
const decode=result=>new TextDecoder('windows-1252').decode(result.text);
function read(text){
 const tables={};let rows,columns;
 for(const line of text.split('\r\n')){const [mark,...cells]=line.split('\t');if(mark==='%T')rows=tables[cells[0]]=[];if(mark==='%F')columns=cells;if(mark==='%R'){assert.equal(cells.length,columns.length);rows.push(Object.fromEntries(columns.map((c,i)=>[c,cells[i]])));}}
 return tables;
}
test('XER dates are local minute fields and XML durations become hours',()=>{
 assert.equal(xerDate('2032-02-29T08:15:32.123+01:00'),'2032-02-29 08:15');
 assert.equal(xerDuration('P1DT2H30M'),26.5);
});
test('XER rejects invalid source dates, durations and unmappable text',()=>{
 assert.throws(()=>xerDate('2030-02-30T08:00:00'),/kalenderdatum/);
 assert.throws(()=>xerDuration('P1M'),/duur/);
 assert.throws(()=>encodeXer('漢字'),/Windows-1252/);
 assert.deepEqual([...encodeXer('€ë–')],[128,235,150]);
});
test('calendar serializes the P6 workweek and 1899-12-30 exception epoch',()=>{
 const data=xerCalendarData([[],[[480,720],[780,1020]],[],[],[],[],[]],new Map([[0,[]]]));
 assert.match(data,/\(0\|\|CalendarData/);assert.match(data,/f\|12:00\|s\|08:00/);assert.match(data,/d\|25569/);
 assert.throws(()=>xerCalendarData([]),/zeven/);
});
test('real table records, CP1252, CRLF, names and source links survive conversion',()=>{
 const f=fixture(),result=createXerExport(f),text=decode(result),tables=read(text);
 assert.match(text,/^ERMHDR\t20.12\t/);assert.ok(text.endsWith('%E\r\n'));
 assert.equal(result.exportedActivities,3);assert.equal(result.exportedSourceLinks,2);
 assert.equal(tables.TASK[0].task_name,'Activiteit 0');assert.equal(tables.TASK[0].duration_type,'DT_FixedDrtn');
 assert.equal(tables.TASK[0].target_drtn_hr_cnt,'8');assert.equal(tables.PROJWBS[1].wbs_name,'WBS één');
 assert.equal(tables.TASKPRED[0].lag_hr_cnt,'1');assert.equal(tables.TASKPRED[0].pred_type,'PR_FS');assert.equal(tables.TASKPRED[1].pred_type,'PR_SF');
 assert.ok(result.warnings.some(w=>w.includes('externe taken')));assert.ok(result.warnings.some(w=>w.includes('afgeleide CIV')));
 assert.equal(result.name.replace(/\d{4}-\d{2}-\d{2}/,'DATE'),'test-scenario-DATE.xer');
});
test('702 activities and 701 relations are written as local P6 task rows',()=>{
 const result=createXerExport(fixture({count:702})),tables=read(decode(result));
 assert.equal(tables.TASK.length,702);assert.equal(tables.TASKPRED.length,701);
 assert.equal(new Set(tables.TASK.map(r=>r.task_id)).size,702);
 assert.equal(tables.PROJWBS.filter(r=>r.proj_node_flag==='Y').length,1);
});
test('missing calendars are an explicit assumption and missing source links stop export',()=>{
 const result=createXerExport(fixture({calendar:false}));assert.ok(result.warnings.some(w=>w.includes('Geen bronkalender')));
 assert.throws(()=>createXerExport(fixture({missing:true})),/buiten de geladen planning/);
});
test('XER cells cannot inject rows or columns',()=>{
 const text=serializeXer({TASK:[{task_id:1,task_name:'Text\tcolumn\r\n%T\tFAKE'}]},new Date('2030-01-01Z'));
 const tables=read(text);assert.equal(tables.TASK.length,1);assert.equal(tables.FAKE,undefined);
});
test('XER checker rejects lost tasks, orphan calendars and cyclic WBS',()=>{
 const t=read(decode(createXerExport(fixture())));
 // The public validator expects numeric relationship lag, like the exporter.
 t.TASKPRED.forEach(r=>r.lag_hr_cnt=Number(r.lag_hr_cnt));
 validateXer(t,3);assert.throws(()=>validateXer(t,4),/activiteitenaantal/);
 const invalid=structuredClone(t);invalid.TASK[0].clndr_id=999;assert.throws(()=>validateXer(invalid,3),/verwijzing/);
 t.PROJWBS[0].parent_wbs_id=t.PROJWBS[1].wbs_id;assert.throws(()=>validateXer(t,3),/Cirkel/);
});

test('native P6 activity types, calendar, progress, constraints and lag are mapped',()=>{
 const uri='http://xmlns.oracle.com/Primavera/P6Professional/V21.12/API/BusinessObjects';
 const f=data=>fields(data,uri),n=(name,data)=>node(name,data,uri);
 const a=n('Activity',f({ObjectId:20,Id:'A100',Name:'P6 taak',WBSObjectId:10,CalendarObjectId:5,Type:'Task Dependent',Status:'In Progress',StartDate:'2030-03-01T08:00:00',FinishDate:'2030-03-04T17:00:00',PlannedStartDate:'2030-03-01T08:00:00',PlannedFinishDate:'2030-03-04T17:00:00',ActualStartDate:'2030-02-01T08:00:00',PlannedDuration:16,RemainingDuration:8,PercentCompleteType:'Physical',PhysicalPercentComplete:40,DurationType:'Fixed Duration and Units/Time',PrimaryConstraintType:'Start On or After',PrimaryConstraintDate:'2030-02-01T08:00:00'}));
 const b=n('Activity',f({ObjectId:21,Id:'A110',Name:'P6 mijlpaal',WBSObjectId:10,Type:'Finish Milestone',Status:'Not Started',StartDate:'2030-03-04T17:00:00',FinishDate:'2030-03-04T17:00:00'}));
 const nilWork=n('WorkTime',[]);nilWork.getAttributeNS=()=> 'true';
 const workWeek=daysForP6();
 function daysForP6(){return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((day,i)=>n('StandardWorkHours',[...f({DayOfWeek:day}),...(i===0||i===6?[nilWork]:[n('WorkTime',f({Start:'08:00:00',Finish:'16:00:00'}))])]));}
 const root=n('APIBusinessObjects',[n('Calendar',[...f({ObjectId:5,Name:'P6 kalender',HoursPerDay:8}),n('StandardWorkWeek',workWeek)]),n('Project',[...f({ObjectId:1,Id:'P6TEST',Name:'P6 project',ActivityDefaultCalendarObjectId:5,DataDate:'2030-02-01T00:00:00'}),a,b,n('Relationship',f({ObjectId:30,Type:'Finish to Start',PredecessorActivityObjectId:20,SuccessorActivityObjectId:21,Lag:-8}))])]);
 const Parser=class{parseFromString(){return {documentElement:root,getElementsByTagNameNS:(namespace,name)=>root.getElementsByTagNameNS(namespace,name)};}};
 const result=createXerExport({xml:'P6 DOM',Parser,model:{regels:[{id:20,wbs:'10'},{id:21,wbs:'10',kind:'mile'}],wbs:{10:{naam:'P6 project',parent:'',code:'ROOT',seq:1}},relaties:[]}}),t=read(decode(result));
 assert.equal(t.TASK[0].duration_type,'DT_FixedDrtn');assert.equal(t.TASK[0].complete_pct_type,'CP_Phys');assert.equal(t.TASK[0].phys_complete_pct,'40');
 assert.equal(t.TASK[0].status_code,'TK_Active');assert.equal(t.TASK[0].act_start_date,'2030-02-01 08:00');assert.equal(t.TASK[0].target_start_date,'2030-03-01 08:00');
 assert.equal(t.TASK[0].cstr_type,'CS_SNET');assert.equal(t.TASK[0].cstr_date,'2030-02-01 08:00');
 assert.equal(t.TASK[1].task_type,'TT_FinMile');assert.equal(t.TASK[1].target_drtn_hr_cnt,'0');assert.equal(t.TASKPRED[0].lag_hr_cnt,'-8');
});


test('elapsed lag uses actual hours and a project-wide 24h calendar when unmixed',()=>{
 const f=fixture({count:702,lag:28800,lagFormats:Array(701).fill(8)}),before=JSON.stringify(f.root);
 const result=createXerExport(f),t=read(decode(result));
 assert.equal(t.TASK.length,702);assert.equal(t.TASKPRED.length,701);assert.equal(result.lagActivities,0);assert.equal(result.elapsedLinks,701);
 assert.equal(t.TASKPRED[0].lag_hr_cnt,'48');assert.equal(t.SCHEDOPTIONS[0].sched_calendar_on_relationship_lag,'rcal_24Hour');
 assert.equal(JSON.stringify(f.root),before);assert.ok(result.warnings.some(w=>w.includes('24-uurskalender')));
});
for(const type of ['FF','FS','SF','SS'])for(const sign of [1,-1])test('mixed calendars retain '+type+' elapsed '+(sign>0?'lag':'lead')+' with a 24h activity',()=>{
 const typeCode={FF:0,FS:1,SF:2,SS:3}[type];
 const f=fixture({lagFormats:[8,7],lags:[sign*28800,4800],relationTypes:[typeCode,1]}),before=JSON.stringify(f.root);
 const result=createXerExport(f),t=read(decode(result));
 assert.equal(result.sourceActivities,3);assert.equal(result.exportedActivities,4);assert.equal(result.lagActivities,1);
 assert.equal(result.sourceLinks,2);assert.equal(t.TASKPRED.length,3);assert.equal(t.TASK.length,4);assert.equal(t.CALENDAR.length,2);
 const h=t.TASK.find(r=>r.task_code==='BD-LAG-1'),p=t.TASK.find(r=>r.task_code==='2'),s=t.TASK.find(r=>r.task_code==='3');
 assert.equal(h.target_drtn_hr_cnt,'48');assert.equal(h.remain_drtn_hr_cnt,'48');assert.equal(h.act_start_date,'');assert.equal(h.cstr_type,'');
 assert.equal(t.CALENDAR.find(c=>c.clndr_id===h.clndr_id).week_hr_cnt,'168');
 assert.equal((t.CALENDAR.find(c=>c.clndr_id===h.clndr_id).clndr_data.match(/f\|24:00\|s\|00:00/g)||[]).length,7);
 assert.equal(t.TASKPRED[0].pred_task_id,p.task_id);assert.equal(t.TASKPRED[0].task_id,h.task_id);
 assert.equal(t.TASKPRED[0].pred_type,'PR_'+type[0]+(sign>0?'S':'F'));
 assert.equal(t.TASKPRED[1].pred_task_id,h.task_id);assert.equal(t.TASKPRED[1].task_id,s.task_id);
 assert.equal(t.TASKPRED[1].pred_type,'PR_'+(sign>0?'F':'S')+type[1]);
 assert.equal(t.TASKPRED[0].lag_hr_cnt,'0');assert.equal(t.TASKPRED[1].lag_hr_cnt,'0');assert.equal(t.TASKPRED[2].lag_hr_cnt,'8');
 const clock=type[0]==='F'?'17:00':'08:00';
 assert.equal(h.target_start_date,(sign>0?'2030-02-01 ':'2030-01-30 ')+clock);
 assert.equal(h.target_end_date,(sign>0?'2030-02-03 ':'2030-02-01 ')+clock);
 // Eliminate the helper's endpoints from the two inequalities. These are
 // the source relation bound successor[event] >= predecessor[event] + lag.
 const predecessor=0,successor=sign*48,hs=sign>0?predecessor:successor,hf=hs+48;
 assert.equal(sign>0?hs:hf,predecessor);assert.equal(sign>0?hf:hs,successor);
 assert.equal(JSON.stringify(f.root),before);assert.ok(result.warnings.some(w=>w.includes('extra activiteiten')));
});
test('zero elapsed lag needs no calendar or helper; percentage lag still blocks',()=>{
 const r=createXerExport(fixture({lagFormats:[8,7],lags:[0,4800]})),t=read(decode(r));
 assert.equal(r.lagActivities,0);assert.equal(t.SCHEDOPTIONS,undefined);assert.equal(t.TASK.length,3);
 for(const format of ['4','6','8','10','12'])assert.deepEqual(xerMsProjectLag('14400',format),{hours:24,elapsed:true});
 assert.throws(()=>createXerExport(fixture({lagFormats:[19],lags:[10]})),/Percentage-lag/);
 assert.equal(xerMsProjectLag('0','20').hours,0);
 assert.throws(()=>xerMsProjectLag('NaN','8'),/Ongeldig/);
});

test('unsupported characters no longer block a 702-task mixed-lag export',()=>{
 const f=fixture({count:702,lagFormats:[8,7],lags:[28800,4800]});
 f.root.childNodes.find(n=>n.localName==='Name').textContent='Planning\u200b → tunnel';
 const calendar=f.root.childNodes.find(n=>n.localName==='Calendars').childNodes[0];
 calendar.childNodes.find(n=>n.localName==='Name').textContent='Werkweek\u202f24 uur';
 f.model.wbs.msp_wbs_1.naam='Cafe\u0301 − Fase';
 f.tasks[1].childNodes.find(n=>n.localName==='Name').textContent='Noordtunnel 🛠️';
 const before=JSON.stringify(f.root);
 const result=createXerExport(f),tables=read(decode(result));
 assert.equal(result.sourceActivities,702);
 assert.equal(result.lagActivities,1);
 assert.equal(tables.TASK.length,703);
 assert.equal(tables.TASKPRED.length,702);
 assert.equal(tables.PROJWBS[0].wbs_name,'Planning -> tunnel');
 assert.equal(tables.PROJWBS[1].wbs_name,'Café - Fase');
 assert.equal(tables.CALENDAR[0].clndr_name,'Werkweek 24 uur');
 assert.equal(tables.TASK[0].task_name,'Noordtunnel ?');
 assert.equal(result.adjustedTextFields,4);
 assert.match(result.warnings[0],/4 tekstvelden/);
 assert.equal(JSON.stringify(f.root),before);
});

test('converted codes keep identifiers unique and all links intact',()=>{
 const f=fixture();
 for(const [i,code] of [[1,'A漢'],[2,'A_'],[3,'A字']]){
  f.tasks[i].childNodes.find(n=>n.localName==='ID').textContent=code;
 }
 const result=createXerExport(f),tables=read(decode(result));
 assert.equal(result.adjustedTextFields,2);
 assert.deepEqual(tables.TASK.map(t=>t.task_code),['BD-1','A_','BD-3']);
 assert.deepEqual(tables.TASKPRED.map(r=>[r.pred_task_id,r.task_id]),[['1','2'],['2','3']]);
});
