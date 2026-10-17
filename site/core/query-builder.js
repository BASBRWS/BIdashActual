import {operatorsFor} from './query-filter.js?v=20261017-0820';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fold=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const collator=new Intl.Collator('nl',{numeric:true,sensitivity:'base'});
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const copy=v=>structuredClone(v);
export function checkedQuery(query,fields){
 if(!Array.isArray(query?.rules))throw Error('De opgeslagen query heeft geen geldige voorwaarden.');
 const rules=query.rules.map(rule=>{
  const field=fields.find(f=>f.key===rule.field);
  if(!field||!operatorsFor(field.type).some(([op])=>op===rule.operator))throw Error('Deze query bevat een veld of vergelijking die niet beschikbaar is.');
  return {...(rule.join?{join:rule.join==='or'?'or':'and'}:{}),field:field.key,operator:rule.operator,value:String(rule.value??'')};
 });
 return {mode:query.mode==='any'?'any':'all',rules};
}
export function createQueryPresetStore({read,write,newId=()=>crypto.randomUUID()}){
 let value={version:1,assets:[],faults:[]},queue=Promise.resolve();const listeners=new Set();
 const ready=Promise.resolve().then(read).then(saved=>{
  if(saved==null)return;
  if(saved.version!==1||!['assets','faults'].every(t=>Array.isArray(saved[t])))throw Error('De opgeslagen querylijst kon niet worden gelezen.');
  for(const type of ['assets','faults'])for(const p of saved[type])if(!p||typeof p.id!=='string'||typeof p.name!=='string'||!Array.isArray(p.query?.rules))throw Error('De opgeslagen querylijst is beschadigd.');
  value=copy(saved);
 });
 function mutate(fn){const task=queue.then(async()=>{await ready;const next=copy(value),result=fn(next);await write(next);value=next;for(const f of listeners)f();return result;});queue=task.catch(()=>{});return task;}
 return {ready,list:type=>copy(value[type]||[]),subscribe:f=>(listeners.add(f),()=>listeners.delete(f)),
  save(type,name,query){return mutate(next=>{name=String(name).trim();if(!name)throw Error('Geef jouw query een naam.');if(!['assets','faults'].includes(type))throw Error('Onbekend querytype.');const found=next[type].find(p=>fold(p.name)===fold(name)),entry={id:found?.id||newId(),name,query:copy(query)};next[type]=next[type].filter(p=>p.id!==entry.id);next[type].push(entry);next[type].sort((a,b)=>collator.compare(a.name,b.name));return entry.id;});},
  remove(type,id){return mutate(next=>{next[type]=next[type].filter(p=>p.id!==id);});}
 };
}
export function createQueryValueIndex({yieldControl=pause}={}){
 const cache=new WeakMap();
 return async(rows,field)=>{
  let map=cache.get(rows);if(!map){map=new Map();cache.set(rows,map);}
  if(!map.has(field.key))map.set(field.key,(async()=>{
   const seen=new Map();
   for(let i=0;i<rows.length;i++){
    const value=typeof field.value==='function'?field.value(rows[i]):rows[i]?.[field.key];
    for(const item of Array.isArray(value)?value:[value]){
     if(item==null||String(item).trim()===''||field.type==='number'&&!Number.isFinite(Number(item)))continue;
     const text=String(item).trim();if(!seen.has(fold(text)))seen.set(fold(text),text);
    }
    if((i+1)%512===0)await yieldControl();
   }
   const values=[...seen.values()];
   // Sorteer kleine keuzelijsten. Unieke namen/IDs van een groot register blijven
   // in bronvolgorde, zodat één sortering de hoofdthread niet lang blokkeert.
   return field.type==='number'?values.sort((a,b)=>Number(a)-Number(b)):values.length<=2000?values.sort(collator.compare):values;
  })());
  return map.get(field.key);
 };
}
export function suggestedValues(values,search='',limit=100){const out=[],q=fold(search);for(const v of values)if(!q||fold(v).includes(q)){out.push(v);if(out.length===limit)break;}return out;}
export function createQueryEditor({host,type,fields,getQuery,setQuery,getRows,onChange,store}){
 if(!host||host.dataset.ready)return null;host.dataset.ready='1';
 const index=createQueryValueIndex();let selected='',name='',message='',generation=0,loading=false;
 const presets=()=>store.list(type);
 const report=(text,error=false)=>{message=text;const el=host.querySelector('[data-query-message]');if(el){el.textContent=text;el.classList.toggle('error',error);}};
 function renderSaved(){
  const list=host.querySelector('[data-query-saved]');if(!list)return;
  list.innerHTML='<option value="">Kies een opgeslagen query</option>'+presets().map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');list.value=selected;
  host.querySelector('[data-query-delete]').disabled=!selected||loading;
 }
 async function choices(){
  const ticket=++generation,inputs=[...host.querySelectorAll('[data-query-value]:not(:disabled)')];if(!inputs.length||!host.closest('details')?.open||host.closest('main')?.hidden)return;
  try{
   const rows=await getRows();if(ticket!==generation||!rows)return;
   await Promise.all(inputs.map(async input=>{
    const rule=getQuery().rules[Number(input.closest('[data-query-rule]').dataset.queryRule)],field=fields.find(f=>f.key===rule.field);
    const values=await index(rows,field);if(ticket!==generation||!input.isConnected)return;
    const list=host.ownerDocument.getElementById(input.getAttribute('list'));
    list.innerHTML=suggestedValues(values,input.value).map(v=>`<option value="${esc(v)}"></option>`).join('');
    input.placeholder=values.length?'Kies of typ een waarde':'Geen waarden geladen, typ een waarde';
    input.title=values.length+' waarden in de geladen data. Typ om te zoeken, maximaal 100 suggesties.';
   }));
  }catch(error){if(ticket===generation)report('De datakeuzes konden niet worden opgehaald. Je kunt zelf een waarde invullen.',true);}
 }
 function render(){
  const query=getQuery();
  const rules=query.rules.map((rule,i)=>{
   const field=fields.find(f=>f.key===rule.field)||fields[0],basis=type+'-query-'+i,noValue=['empty','notEmpty'].includes(rule.operator);
   const join=i?`<select name="${basis}-join" data-query-join aria-label="Logische koppeling"><option value="and" ${rule.join!=='or'?'selected':''}>EN</option><option value="or" ${rule.join==='or'?'selected':''}>OF</option></select>`:'<span class="query-where">WAAR</span>';
   return `<div class="query-rule" data-query-rule="${i}">${join}<select name="${basis}-field" data-query-field aria-label="Veld">${fields.map(f=>`<option value="${esc(f.key)}" ${f.key===field.key?'selected':''}>${esc(f.label)}</option>`).join('')}</select><select name="${basis}-operator" data-query-operator aria-label="Vergelijking">${operatorsFor(field.type).map(([v,l])=>`<option value="${v}" ${v===rule.operator?'selected':''}>${l}</option>`).join('')}</select><div class="query-value"><input name="${basis}-value" data-query-value aria-label="Filterwaarde" value="${esc(rule.value??'')}" list="${basis}-options" placeholder="Kies of typ een waarde" autocomplete="off" ${noValue?'disabled':''}><datalist id="${basis}-options"></datalist></div><button data-query-remove="${i}" aria-label="Filterregel verwijderen">Verwijderen</button></div>`;
  }).join('');
  host.innerHTML=`<div class="query-saved"><label>Opgeslagen queries<select name="${type}-saved-query" data-query-saved aria-label="Opgeslagen queries"></select></label><label>Naam query<input name="${type}-query-name" data-query-name aria-label="Naam query" maxlength="100" value="${esc(name)}" placeholder="Bijvoorbeeld MSI met foutcode 1003"></label><button data-query-save ${loading?'disabled':''}>Query opslaan</button><button data-query-delete>Opgeslagen query verwijderen</button></div><p data-query-message role="status">${esc(message)}</p><div class="query-toolbar"><button data-query-add>Voorwaarde toevoegen</button><button data-query-reset ${query.rules.length?'':'disabled'}>Query wissen</button><span>EN gaat vóór OF. Waarden komen uit de geladen data, eigen invoer blijft mogelijk.</span></div>${rules}<div class="query-summary">${query.rules.length?query.rules.length+' voorwaarden. Filters boven deze module blijven ook gelden.':'Nog geen queryvoorwaarden.'}</div>`;
  renderSaved();choices();
 }
 function changed(){message='';render();onChange({debounce:0});}
 host.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-query-save')||b.hasAttribute('data-query-delete')){
   if(loading)return;loading=true;b.disabled=true;
   try{
    if(b.hasAttribute('data-query-save')){
     const query=checkedQuery(getQuery(),fields);if(!query.rules.some(r=>['empty','notEmpty'].includes(r.operator)||r.value.trim()))throw Error('Voeg eerst een queryvoorwaarde met een waarde toe.');
     selected=await store.save(type,name,query);report('Query opgeslagen.');
    }else{await store.remove(type,selected);selected='';name='';host.querySelector('[data-query-name]').value='';report('Opgeslagen query verwijderd. De huidige filter blijft staan.');}
   }catch(error){report(error.message,true);}finally{loading=false;b.disabled=false;renderSaved();}return;
  }
  const query=getQuery();
  if(b.hasAttribute('data-query-add'))query.rules.push({join:'and',field:fields[0].key,operator:operatorsFor(fields[0].type)[0][0],value:''});
  else if(b.hasAttribute('data-query-reset')){setQuery({rules:[]});selected='';name='';}
  else if(b.dataset.queryRemove!==undefined)query.rules.splice(Number(b.dataset.queryRemove),1);
  else return;changed();
 });
 host.addEventListener('change',e=>{
  const el=e.target;
  if(el.matches('[data-query-saved]')){
   const p=presets().find(p=>p.id===el.value);if(!p){selected='';renderSaved();return;}
   try{const query=checkedQuery(p.query,fields);selected=p.id;name=p.name;setQuery(query);changed();}catch(error){renderSaved();report(error.message,true);}return;
  }
  const row=el.closest('[data-query-rule]');if(!row)return;const i=Number(row.dataset.queryRule),query=getQuery();
  if(el.matches('[data-query-field]')){const f=fields.find(f=>f.key===el.value);query.rules[i]={join:query.rules[i].join,field:f.key,operator:operatorsFor(f.type)[0][0],value:''};}
  else if(el.matches('[data-query-operator]'))query.rules[i].operator=el.value;
  else if(el.matches('[data-query-join]'))query.rules[i].join=el.value;
  else return;changed();
 });
 host.addEventListener('input',e=>{
  if(e.target.matches('[data-query-name]')){name=e.target.value;return;}
  if(!e.target.matches('[data-query-value]'))return;
  const i=Number(e.target.closest('[data-query-rule]').dataset.queryRule);getQuery().rules[i].value=e.target.value;onChange({debounce:150});choices();
 });
 host.addEventListener('focusin',e=>{if(e.target.matches('[data-query-value]'))choices();});
 host.closest('details')?.addEventListener('toggle',()=>{if(host.closest('details').open)choices();else generation++;});
 host.ownerDocument.addEventListener('bidash:data-change',()=>{generation++;queueMicrotask(choices);});
 store.subscribe(renderSaved);store.ready.then(renderSaved).catch(error=>report(error.message,true));render();
 return {render,refreshOptions:choices};
}
