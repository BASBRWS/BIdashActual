const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fixture=`<?xml version="1.0" encoding="UTF-8"?><Project xmlns="http://schemas.microsoft.com/project" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:ext="urn:test"><Name>Test &amp; export</Name><StartDate>2030-01-01T08:00:00</StartDate><FinishDate>2030-03-01T17:00:00</FinishDate><CalendarUID>1</CalendarUID><Calendars><Calendar><UID>1</UID><Name>Testkalender</Name></Calendar></Calendars><Tasks>
<Task><UID>0</UID><Name>Projectsamenvatting</Name><OutlineLevel>0</OutlineLevel><Start>2030-01-01T08:00:00</Start><Finish>2030-03-01T17:00:00</Finish><Summary>1</Summary></Task>
<Task><UID>1</UID><ID>1</ID><Name>Testgroep</Name><WBS>1</WBS><OutlineNumber>1</OutlineNumber><OutlineLevel>1</OutlineLevel><Start>2030-01-01T08:00:00</Start><Finish>2030-03-01T17:00:00</Finish><Summary>1</Summary></Task>
<Task><UID>2</UID><ID>2</ID><Name>Taak een</Name><WBS>1.1</WBS><OutlineNumber>1.1</OutlineNumber><OutlineLevel>2</OutlineLevel><Start>2030-01-31T08:00:00.123+01:00</Start><Finish>2030-02-02T17:00:00</Finish><Duration>PT16H0M0S</Duration><EarlyStart>2030-01-31T08:00:00</EarlyStart><LateFinish>2030-02-03T17:00:00</LateFinish><ActualStart>2030-01-31T08:00:00</ActualStart><ActualFinish xsi:nil="true"/><ConstraintDate>2030-02-01T08:00:00</ConstraintDate><Deadline>2030-02-15T17:00:00</Deadline><Baseline><Number>0</Number><Start>2030-01-01T08:00:00</Start><Finish>2030-02-01T17:00:00</Finish></Baseline><ext:Start>unchanged</ext:Start></Task>
<Task><UID>3</UID><ID>3</ID><Name>Taak twee</Name><WBS>1.2</WBS><OutlineNumber>1.2</OutlineNumber><OutlineLevel>2</OutlineLevel><Start>2030-02-15T08:00:00</Start><Finish>2030-03-01T17:00:00</Finish><Milestone>0</Milestone><PredecessorLink><PredecessorUID>2</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink><Baseline><Start>2030-02-01T08:00:00</Start><Finish>2030-03-01T17:00:00</Finish></Baseline></Task>
<Task><UID>4</UID><ID>4</ID><Name>Mijlpaal</Name><WBS>1.3</WBS><OutlineNumber>1.3</OutlineNumber><OutlineLevel>2</OutlineLevel><Start>2030-03-01T17:00:00</Start><Finish>2030-03-01T17:00:00</Finish><Milestone>1</Milestone></Task>
</Tasks><Resources><Resource><UID>5</UID><Name>Testresource</Name><CalendarUID>1</CalendarUID></Resource></Resources><Assignments><Assignment><UID>6</UID><TaskUID>2</TaskUID><ResourceUID>5</ResourceUID><Start>2030-01-31T08:00:00</Start><Finish>2030-02-02T17:00:00</Finish><ActualStart>2030-01-31T08:00:00</ActualStart><Work>PT16H0M0S</Work><Cost>100</Cost><Baseline><Start>2030-01-01T08:00:00</Start><Finish>2030-02-01T17:00:00</Finish></Baseline><TimephasedData><Type>1</Type><UID>6</UID><Start>2030-02-01T08:00:00</Start><Finish>2030-02-02T17:00:00</Finish><Value>PT8H0M0S</Value></TimephasedData><TimephasedData><Type>2</Type><UID>6</UID><Start>2030-01-31T08:00:00</Start><Finish>2030-01-31T17:00:00</Finish><Value>PT8H0M0S</Value></TimephasedData></Assignment></Assignments></Project>`;
(async()=>{
 const site=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{
  try{const file=path.join(site,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}catch{res.statusCode=404;res.end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/engines/planning.html');
  await page.waitForFunction(()=>window.HUB);const result=await page.evaluate(async xml=>{
   const {createMsProjectExport}=await import('../core/msproject-export.js');const parse=xml=>new DOMParser().parseFromString(xml,'application/xml');
   const original=ipl_parseXML(xml),regels=original.regels;
   const noShift=createMsProjectExport({xml,regels,cascade:{}});if(noShift.text!==xml)throw Error('Nulscenario wijzigt bron');
   const exported=createMsProjectExport({xml,filename:'synthetic.xml',regels,cascade:{2:1/12,3:2/12,4:2/12},relaties:[{inferredPair:true}]}),doc=parse(exported.text),source=parse(xml),changes=[];
   function compare(a,b,path){
    if(!b||a.nodeType!==b.nodeType||a.localName!==b.localName||a.namespaceURI!==b.namespaceURI)throw Error('Structuur gewijzigd '+path);
    if(a.nodeType===1){const attrs=n=>Array.from(n.attributes).map(a=>[a.namespaceURI,a.name,a.value]);if(JSON.stringify(attrs(a))!==JSON.stringify(attrs(b)))throw Error('Attribuut gewijzigd '+path);}
    if(a.childNodes.length!==b.childNodes.length)throw Error('Aantal kinderen gewijzigd '+path);
    if(!a.childNodes.length&&a.nodeValue!==b.nodeValue)changes.push(path);
    Array.from(a.childNodes).forEach((n,i)=>compare(n,b.childNodes[i],path+'/'+(n.localName||n.nodeName)+'['+i+']'));
   }
   compare(source.documentElement,doc.documentElement,'Project');
   const task=id=>Array.from(doc.getElementsByTagName('Task')).find(n=>n.getElementsByTagName('UID')[0]?.textContent===id);
   const text=(node,name)=>Array.from(node.children).find(n=>n.localName===name&&n.namespaceURI===node.namespaceURI)?.textContent;
   const assignment=doc.getElementsByTagName('Assignment')[0],buckets=assignment.getElementsByTagName('TimephasedData');
   const failure=(x,r=regels,cascade={2:1/12})=>{try{createMsProjectExport({xml:x,regels:r,cascade});return '';}catch(e){return e.message;}};
   const prefixed=xml.replace('xmlns="http://schemas.microsoft.com/project"','xmlns:m="http://schemas.microsoft.com/project"').replace(/<(\/?)([A-Z]\w*)(?=[\s/>])/g,'<$1m:$2');
   const prefixedExport=createMsProjectExport({xml:prefixed,regels,cascade:{2:1/12}});
   const imported=ipl_parseXML(exported.text);
   // Reproduce the reported shape: hundreds of represented tasks, only the
   // final task local, plus user fields that can fail P6's UDF mapping.
   const recoverySource=`<Project xmlns="http://schemas.microsoft.com/project"><ExtendedAttributes><ExtendedAttribute><FieldID>2</FieldID><FieldName>Testveld</FieldName></ExtendedAttribute></ExtendedAttributes><Tasks><Task><UID>1</UID><Name>Testgroep</Name><OutlineLevel>1</OutlineLevel><Summary>1</Summary><IsSubproject>1</IsSubproject><SubprojectName>synthetic.mpp</SubprojectName></Task>${Array.from({length:702},(_,i)=>`<Task><UID>${i===701?3480:i+2}</UID><Name>Testtaak ${i}</Name><OutlineLevel>2</OutlineLevel><Summary>0</Summary><Start>2030-01-01T08:00:00</Start><Finish>2030-02-01T17:00:00</Finish><ExternalTask>${i===701?'0':'true'}</ExternalTask><ExternalTaskProject>synthetic.mpp</ExternalTaskProject><ExtendedAttribute><FieldID>2</FieldID><Value>test</Value></ExtendedAttribute>${i?`<PredecessorLink><PredecessorUID>${i+1}</PredecessorUID><Type>1</Type><LinkLag>0</LinkLag></PredecessorLink>`:''}</Task>`).join('')}<Task><UID>9000</UID><Name>Externe verwijzing zonder datums</Name><OutlineLevel>1</OutlineLevel><ExternalTask>1</ExternalTask><ExternalTaskProject>other.mpp</ExternalTaskProject></Task></Tasks></Project>`;
   const recoveryModel=ipl_parseXML(recoverySource),options={xml:recoverySource,filename:'synthetic.xml',regels:recoveryModel.regels,cascade:{2:1/12}};
   const normal=createMsProjectExport(options),recovered=createMsProjectExport({...options,p6Recovery:true}),recoveryDoc=parse(recovered.text);
   const unshiftedRecovery=createMsProjectExport({...options,cascade:{},p6Recovery:true});
   const untouched=parse(normal.text).getElementsByTagName('ExternalTask')[0].textContent;
   const extra=Array.from(recoveryDoc.getElementsByTagName('Task')).find(n=>text(n,'UID')==='9000');
   const embedded=recoverySource.replace('<SubprojectName>','<Project><Tasks/></Project><SubprojectName>');
   const incomplete=recoverySource.replace('<OutlineLevel>2</OutlineLevel><Summary>0</Summary>','<OutlineLevel>2</OutlineLevel><Summary>0</Summary><IsSubproject>1</IsSubproject>');
   const recoveryFailure=x=>{try{createMsProjectExport({...options,xml:x,p6Recovery:true});return '';}catch(e){return e.message;}};
   const recoveryChecks={details:recovered.recovery,activities:recovered.exportedActivities,links:recovered.exportedSourceLinks,name:recovered.name,
    definitions:recoveryDoc.getElementsByTagName('ExtendedAttributes').length,values:recoveryDoc.getElementsByTagName('ExtendedAttribute').length,
    localCount:Array.from(recoveryDoc.getElementsByTagName('ExternalTask')).filter(n=>n.textContent==='0').length,extraExternal:text(extra,'ExternalTask'),extraProject:text(extra,'ExternalTaskProject'),
    imported:ipl_parseXML(recovered.text).regels.length,normalExternal:untouched,normalFields:parse(normal.text).getElementsByTagName('ExtendedAttribute').length,
    unshiftedRemoved:parse(unshiftedRecovery.text).getElementsByTagName('ExtendedAttribute').length,blocked:[recoveryFailure(embedded),recoveryFailure(incomplete)],
    dates:recoveryDoc.getElementsByTagName('Start')[0].textContent,summary:recoveryDoc.getElementsByTagName('IsSubproject')[0].textContent};
   // A broken serializer must never offer a truncated or malformed download.
   const badOutput=transform=>{try{createMsProjectExport({xml,regels,cascade:{2:1/12},Serializer:class{serializeToString(d){return transform(new XMLSerializer().serializeToString(d));}}});return '';}catch(e){return e.message;}};
   const outputFailures=[badOutput(()=>'<bad'),badOutput(s=>s.replace(/<Task><UID>4<\/UID>[\s\S]*?<\/Task>/,'')),badOutput(s=>s.replace(/<PredecessorLink>[\s\S]*?<\/PredecessorLink>/,''))];
   return {exported,changes,task2Start:text(task('2'),'Start'),summaryStart:text(task('1'),'Start'),summaryFinish:text(task('1'),'Finish'),projectFinish:text(doc.documentElement,'FinishDate'),actual:text(task('2'),'ActualStart'),constraint:text(task('2'),'ConstraintDate'),baseline:task('2').getElementsByTagName('Baseline')[0].textContent,
    assignmentStart:text(assignment,'Start'),assignmentActual:text(assignment,'ActualStart'),remainingStart:text(buckets[0],'Start'),actualBucketStart:text(buckets[1],'Start'),cost:text(assignment,'Cost'),duration:text(task('2'),'Duration'),milestoneStart:text(task('4'),'Start'),milestoneFinish:text(task('4'),'Finish'),
    prefixed:prefixedExport.text.includes('<m:Project'),importedTasks:imported.regels.length,importedRelations:imported.relaties.filter(r=>!r.inferredPair).length,
    recoveryChecks,outputFailures,invalid:[failure(xml.replace('<UID>3</UID>','<UID>2</UID>')),failure(xml,regels,{2:.01}),failure(xml,[{id:'missing'}]),failure(xml.replace('<Start>2030-01-31T08:00:00.123+01:00</Start>','<Start/>')),failure(xml.replace('2030-01-31T08:00:00.123+01:00','2030-02-30T08:00:00'))]};
  },fixture);
  assert.equal(result.task2Start,'2030-02-28T08:00:00.123+01:00');assert.equal(result.summaryStart,result.task2Start);assert.equal(result.summaryFinish,'2030-05-01T17:00:00');assert.equal(result.projectFinish,'2030-05-01T17:00:00');
  assert.equal(result.actual,'2030-01-31T08:00:00');assert.equal(result.constraint,'2030-02-01T08:00:00');assert.match(result.baseline,/2030-01-01/);
  assert.equal(result.assignmentStart,'2030-02-28T08:00:00');assert.equal(result.assignmentActual,'2030-01-31T08:00:00');assert.equal(result.remainingStart,'2030-03-01T08:00:00');assert.equal(result.actualBucketStart,'2030-01-31T08:00:00');assert.equal(result.cost,'100');assert.equal(result.duration,'PT16H0M0S');assert.equal(result.milestoneStart,result.milestoneFinish);
  assert.equal(result.importedTasks,3);assert.equal(result.importedRelations,1);assert.equal(result.prefixed,true);assert.ok(result.invalid.every(Boolean));assert.equal(result.exported.changedActivities,3);assert.match(result.exported.importInstruction,/Microsoft Project > XML/);assert.equal(result.exported.warnings.length,2);
  assert.ok(result.changes.every(p=>!p.includes('/Baseline[')&&!p.includes('/ActualStart[')&&!p.includes('/PredecessorLink[')&&!p.includes('/Calendars[')&&!p.includes('/Resources[')));
  const recovery=result.recoveryChecks;
  assert.deepEqual(recovery.details,{removedFieldDefinitions:1,removedFieldValues:702,localizedTasks:701,localizedSubprojects:1});
  assert.equal(recovery.activities,702);assert.equal(recovery.imported,702);assert.equal(recovery.links,701);assert.match(recovery.name,/-p6-herstel\.xml$/);
  assert.equal(recovery.definitions,0);assert.equal(recovery.values,0);assert.equal(recovery.unshiftedRemoved,0);assert.equal(recovery.localCount,702);
  assert.equal(recovery.extraExternal,'1');assert.equal(recovery.extraProject,'other.mpp');assert.equal(recovery.normalExternal,'true');assert.equal(recovery.normalFields,703);
  assert.equal(recovery.dates,'2030-02-01T08:00:00');assert.equal(recovery.summary,'0');assert.ok(recovery.blocked.every(Boolean));
  assert.ok(result.outputFailures.every(Boolean));
  assert.deepEqual(errors,[]);console.log('MS Project scenario-export: structuur/namespaces/UID/WBS/bronrelaties, volledige cascade, samenvattingen, projectdatums, resources, resterend werk, actuals, baselines, mijlpalen, datumranden, fouten en herimport geslaagd.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
