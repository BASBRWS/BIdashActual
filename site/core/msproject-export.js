/* P6 supports MSP XML through its Microsoft Project import. Keep that schema,
   source identities and relationships; apply the calculated scenario dates. */
import {addPrimaveraMonths,primaveraExportFilename,planningShiftMonths} from './primavera-export.js?v=20261105-1300';
const MSP='http://schemas.microsoft.com/project',XSI='http://www.w3.org/2001/XMLSchema-instance';
const children=el=>Array.from(el?.childNodes||[]).filter(n=>n.nodeType===1&&n.namespaceURI===el.namespaceURI);
const field=(el,name)=>children(el).find(n=>n.localName===name);
const value=(el,name)=>field(el,name)?.textContent.trim()||'';
const present=node=>node&&node.getAttributeNS(XSI,'nil')!=='true'&&node.getAttributeNS(XSI,'nil')!=='1'&&node.textContent.trim()!=='';
const DATES=['Start','Finish','EarlyStart','EarlyFinish','LateStart','LateFinish','ManualStart','ManualFinish','Resume'];
export function createMsProjectExport({xml,filename,regels=[],cascade={},relaties=[],Parser=globalThis.DOMParser,Serializer=globalThis.XMLSerializer}){
  if(!xml||!regels.length)throw Error('Laad eerst een Microsoft Project-planning.');
  const doc=new Parser().parseFromString(xml,'application/xml'),root=doc.documentElement;
  if(doc.getElementsByTagNameNS('*','parsererror').length)throw Error('De planning bevat ongeldige XML.');
  if(root?.localName!=='Project'||root.namespaceURI&&root.namespaceURI!==MSP)throw Error('De bron is geen Microsoft Project XML.');
  const tasks=children(field(root,'Tasks')).filter(n=>n.localName==='Task'),byId=new Map(),shifts=new Map();
  for(const task of tasks){
    const id=value(task,'UID');if(!id||byId.has(id))throw Error('Ontbrekende of dubbele taak-UID in de Microsoft Project-bron.');byId.set(id,task);
  }
  for(const regel of regels){
    const id=String(regel.id),months=planningShiftMonths(cascade[id]??0);
    if(!byId.has(id)||value(byId.get(id),'Summary')==='1')throw Error('De planning en oorspronkelijke XML hebben verschillende taak-ID’s. Laad de planning opnieuw.');
    if(shifts.has(id))throw Error('Dubbele taak-ID in het planningmodel.');shifts.set(id,months);
  }
  let changedActivities=0,changedDates=0,changedSummaries=0,retainedDistributions=0;
  const warnings=[];
  function setDate(node,text){if(present(node)&&node.textContent.trim()!==text){node.textContent=text;changedDates++;return true;}return false;}
  function shiftDates(el,months,names=DATES){
    for(const name of names){const node=field(el,name);if(present(node))setDate(node,addPrimaveraMonths(node.textContent.trim(),months));}
  }
  function shiftDistribution(el,months){
    for(const block of children(el).filter(n=>n.localName==='TimephasedData')){
      // Type 1 is remaining assignment work. Actuals, progress and all baselines
      // are historical records and must not move with a future scenario.
      if(value(block,'Type')==='1')shiftDates(block,months,['Start','Finish']);
      else if(!value(block,'Type'))retainedDistributions++;
    }
  }
  for(const [id,months] of shifts){
    if(!months)continue;
    const task=byId.get(id);
    if(!present(field(task,'Start'))||!present(field(task,'Finish')))throw Error('Een verschoven taak mist Start of Finish in de bron. Corrigeer de bronplanning.');
    shiftDates(task,months);shiftDistribution(task,months);changedActivities++;
  }
  const descendants=new Map(),stack=[];
  for(const task of tasks){
    const id=value(task,'UID'),raw=Number(value(task,'OutlineLevel')),level=id==='0'?0:Number.isInteger(raw)&&raw>0?raw:1;
    while(stack.length&&stack.at(-1).level>=level)stack.pop();
    if(value(task,'Summary')==='1'){
      descendants.set(id,[]);stack.push({id,level});
    }else if(id!=='0')for(const parent of stack)descendants.get(parent.id).push(task);
  }
  function edge(tasks,name,end){
    if(tasks.some(task=>!present(field(task,name))))return null;
    const values=tasks.map(task=>value(task,name)).map(text=>{
      addPrimaveraMonths(text,0);const t=Date.parse(text);if(!Number.isFinite(t))throw Error('Ongeldige datum in de bronplanning.');return {text,t};
    });
    if(!values.length)return null;values.sort((a,b)=>a.t-b.t);return (end?values.at(-1):values[0]).text;
  }
  const pairs=[['Start','Finish'],['EarlyStart','EarlyFinish'],['LateStart','LateFinish'],['ManualStart','ManualFinish']];
  if(changedActivities)for(const [id,leaves] of descendants){
    if(!leaves.length||!leaves.some(task=>shifts.get(value(task,'UID'))))continue;
    const summary=byId.get(id);let changed=false;
    for(const [start,finish] of pairs){
      const first=edge(leaves,start,false),last=edge(leaves,finish,true);
      if(first)changed=setDate(field(summary,start),first)||changed;
      if(last)changed=setDate(field(summary,finish),last)||changed;
    }
    if(changed)changedSummaries++;
  }
  const assignmentShifts=new Map(shifts);
  for(const [id,leaves] of descendants){
    const months=new Set(leaves.map(task=>shifts.get(value(task,'UID'))||0));
    if(months.size===1)assignmentShifts.set(id,[...months][0]);
  }
  for(const assignment of children(field(root,'Assignments')).filter(n=>n.localName==='Assignment')){
    const months=assignmentShifts.get(value(assignment,'TaskUID'));
    if(months){shiftDates(assignment,months);shiftDistribution(assignment,months);}
  }
  if(changedActivities){
    const leaves=tasks.filter(task=>value(task,'Summary')!=='1'&&value(task,'UID')!=='0');
    const first=edge(leaves,'Start',false),last=edge(leaves,'Finish',true);
    if(first)setDate(field(root,'StartDate'),first);if(last)setDate(field(root,'FinishDate'),last);
  }
  const inferred=relaties.filter(r=>r.inferredPair).length;
  if(inferred)warnings.push(inferred+' afgeleide CIV-relaties zijn rekenaannamen. Alleen de oorspronkelijke bronrelaties staan in deze XML.');
  if(retainedDistributions)warnings.push(retainedDistributions+' tijdverdelingen zonder type zijn ongewijzigd behouden.');
  if(changedSummaries)warnings.push('Datums van samenvattingstaken zijn bijgewerkt. Laat Primavera de duur en kalenders opnieuw berekenen.');
  let text=changedDates?new Serializer().serializeToString(doc):xml;
  if(!/^\s*<\?xml\b/.test(text))text='<?xml version="1.0" encoding="UTF-8"?>\n'+text;
  text=text.replace(/(<\?xml\b[^?]*encoding\s*=\s*["'])[^"']+(["'])/i,'$1UTF-8$2');
  return {text,name:primaveraExportFilename(filename),type:'application/xml',changedActivities,changedDates,changedSummaries,format:'msproject',formatLabel:'Microsoft Project XML',
    importInstruction:'In Primavera P6: Bestand > Importeren > Microsoft Project > XML. Controleer de importinstellingen en herbereken de planning.',warnings};
}
