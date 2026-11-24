/* Toegang en versleuteling (2.99 / DVM 172).

   Het dashboard is een statische website zonder server. Een inlogscherm alleen is in de
   browser altijd te omzeilen. Daarom is de login hier gekoppeld aan versleuteling: de
   werkruimte in de browser wordt versleuteld met een gegevenssleutel, en die sleutel is
   alleen bruikbaar met het wachtwoord. Zonder wachtwoord zijn de gegevens onleesbaar, ook
   voor wie de broncode kent of toegang heeft tot de computer.

   Opbouw:
   - Gegevenssleutel (DEK): willekeurige AES-GCM 256-sleutel, versleutelt de werkruimte.
   - Wachtwoordsleutel (KEK): PBKDF2-SHA-256 (600.000 iteraties, eigen zout) uit het
     wachtwoord; verpakt de gegevenssleutel. Wachtwoord wijzigen verpakt alleen opnieuw.
   - In het geheugen staat de gegevenssleutel als niet-exporteerbare CryptoKey. Herladen,
     vergrendelen of 30 minuten geen activiteit wist hem.
   - Gegevens worden per opslagwaarde versleuteld: {__bidashVersleuteld:1, iv, delen:[...]},
     met delen van hooguit 900 kB zodat de bestaande opslagindeling blijft werken.
   - Een vergeten wachtwoord is niet te herstellen. Wel kan de werkruimte worden gewist.
   - De demo (eigen opslag, verzonnen gegevens) gebruikt geen wachtwoord. */

export const TOEGANG_KEY='bidash-toegang-v1';
export const MIN_LENGTE=12;
export const ITERATIES=600000;
export const VERGRENDEL_NA_MS=30*60000;
const DEEL=900*1024;
/* Onversleutelde kopieën die de engines vroeger in localStorage hielden (zie actual-profile.js). */
export const GEVOELIGE_KOPIEEN=['bidash_integratie_v1','rws-integrale-planning-state-v1','bidash-planning:settings-v1'];
const enc=new TextEncoder(),dec=new TextDecoder();
const b64=buf=>{const a=new Uint8Array(buf);let s='';for(let i=0;i<a.length;i+=0x8000)s+=String.fromCharCode(...a.subarray(i,i+0x8000));return btoa(s);};
const unb64=t=>Uint8Array.from(atob(t),c=>c.charCodeAt(0));
const subtle=()=>{const s=globalThis.crypto?.subtle;if(!s)throw Error('Deze browser ondersteunt geen versleuteling. Gebruik een recente Edge of Chrome.');return s;};

/* Gedeelde toestand per venster: de opslaglaag (core/storage.js) leest deze. Engines in
   iframes van dezelfde origin gebruiken de toestand (en de sleutel) van de schil. */
export function gedeeldeToestand(scope=globalThis){
  let w=scope;
  for(let i=0;i<6&&w;i++){try{if(w.__BIDASH_TOEGANG__)return w.__BIDASH_TOEGANG__;}catch{break;}if(!w.parent||w.parent===w)break;w=w.parent;}
  return null;
}
function toestand(){return globalThis.__BIDASH_TOEGANG__||(globalThis.__BIDASH_TOEGANG__={actief:false,sleutel:null,versleutel,ontsleutel,isVersleuteld});}

/* JSON met behoud van de waarden die de werkruimte via structuredClone kan bevatten. */
const T='__bidashT';
function naarTekst(waarde){
  return JSON.stringify(waarde,function(k,v){
    const o=this[k];
    if(o instanceof Date)return {[T]:'d',v:Number.isFinite(o.getTime())?o.toISOString():null};
    if(o instanceof ArrayBuffer)return {[T]:'ab',v:b64(o)};
    if(ArrayBuffer.isView(o))return {[T]:'ta',t:o.constructor.name,v:b64(o.buffer.slice(o.byteOffset,o.byteOffset+o.byteLength))};
    if(o instanceof Map)return {[T]:'m',v:[...o]};
    if(o instanceof Set)return {[T]:'s',v:[...o]};
    if(typeof Blob!=='undefined'&&o instanceof Blob)throw Error('Een bestand in de werkruimte kan niet versleuteld worden opgeslagen.');
    if(typeof o==='number'&&!Number.isFinite(o))return {[T]:'n',v:String(o)};
    if(o===undefined&&Array.isArray(this))return {[T]:'u'};
    return v;
  });
}
const TYPEN={Uint8Array,Int8Array,Uint16Array,Int16Array,Uint32Array,Int32Array,Float32Array,Float64Array,Uint8ClampedArray};
function uitTekst(tekst){
  return JSON.parse(tekst,(k,v)=>{
    if(!v||typeof v!=='object'||!Object.hasOwn(v,T))return v;
    switch(v[T]){
      case 'd':return new Date(v.v??NaN);
      case 'ab':return unb64(v.v).buffer;
      case 'ta':{const C=TYPEN[v.t]||Uint8Array,b=unb64(v.v).buffer;return C===DataView?new DataView(b):new C(b);}
      case 'm':return new Map(v.v);
      case 's':return new Set(v.v);
      case 'n':return Number(v.v);
      case 'u':return undefined;
      default:return v;
    }
  });
}
export {naarTekst as _naarTekst,uitTekst as _uitTekst};

function lees(opslag){try{const t=opslag.getItem(TOEGANG_KEY);return t?JSON.parse(t):null;}catch{return null;}}
export function isIngesteld(opslag=globalThis.localStorage){const c=lees(opslag);return !!(c&&c.versie===1&&c.zout&&c.verpakt);}
export function isOntgrendeld(){return !!toestand().sleutel;}

async function wachtwoordSleutel(wachtwoord,zout,iteraties=ITERATIES){
  const basis=await subtle().importKey('raw',enc.encode(String(wachtwoord)),'PBKDF2',false,['deriveKey']);
  return subtle().deriveKey({name:'PBKDF2',salt:zout,iterations:iteraties,hash:'SHA-256'},basis,{name:'AES-GCM',length:256},false,['wrapKey','unwrapKey']);
}
async function verpak(dek,kek){const iv=crypto.getRandomValues(new Uint8Array(12));const data=await subtle().wrapKey('raw',dek,kek,{name:'AES-GCM',iv});return {iv:b64(iv),data:b64(data)};}
async function pakUit(verpakt,kek,exporteerbaar=false){
  return subtle().unwrapKey('raw',unb64(verpakt.data),kek,{name:'AES-GCM',iv:unb64(verpakt.iv)},{name:'AES-GCM',length:256},exporteerbaar,['encrypt','decrypt']);
}
export function controleerWachtwoord(w,herhaal){
  const t=String(w||'');
  if(t.length<MIN_LENGTE)return `Kies een wachtwoord van minstens ${MIN_LENGTE} tekens.`;
  if(herhaal!=null&&t!==herhaal)return 'De twee wachtwoorden zijn niet gelijk.';
  if(/^(.)\1+$/.test(t))return 'Kies een wachtwoord dat niet uit één herhaald teken bestaat.';
  return '';
}

/* Eerste keer: gegevenssleutel maken en met het wachtwoord verpakken. */
export async function stelIn(wachtwoord,{opslag=globalThis.localStorage}={}){
  const fout=controleerWachtwoord(wachtwoord);if(fout)throw Error(fout);
  const zout=crypto.getRandomValues(new Uint8Array(16)),kek=await wachtwoordSleutel(wachtwoord,zout);
  const dek=await subtle().generateKey({name:'AES-GCM',length:256},true,['encrypt','decrypt']);
  const cfg={versie:1,iteraties:ITERATIES,zout:b64(zout),verpakt:await verpak(dek,kek),ingesteld:new Date().toISOString()};
  opslag.setItem(TOEGANG_KEY,JSON.stringify(cfg));
  for(const k of GEVOELIGE_KOPIEEN)try{opslag.removeItem(k);}catch{}
  const actief=await pakUit(cfg.verpakt,kek,false);
  Object.assign(toestand(),{actief:true,sleutel:actief});
  return true;
}
export async function ontgrendel(wachtwoord,{opslag=globalThis.localStorage}={}){
  const cfg=lees(opslag);if(!cfg)throw Error('Er is nog geen wachtwoord ingesteld.');
  try{
    const kek=await wachtwoordSleutel(wachtwoord,unb64(cfg.zout),cfg.iteraties||ITERATIES);
    const dek=await pakUit(cfg.verpakt,kek,false);
    Object.assign(toestand(),{actief:true,sleutel:dek});return true;
  }catch{throw Error('Onjuist wachtwoord.');}
}
export async function wijzigWachtwoord(oud,nieuw,{opslag=globalThis.localStorage}={}){
  const fout=controleerWachtwoord(nieuw);if(fout)throw Error(fout);
  const cfg=lees(opslag);if(!cfg)throw Error('Er is nog geen wachtwoord ingesteld.');
  let dek;try{dek=await pakUit(cfg.verpakt,await wachtwoordSleutel(oud,unb64(cfg.zout),cfg.iteraties||ITERATIES),true);}catch{throw Error('Het huidige wachtwoord is onjuist.');}
  const zout=crypto.getRandomValues(new Uint8Array(16)),kek=await wachtwoordSleutel(nieuw,zout);
  opslag.setItem(TOEGANG_KEY,JSON.stringify({...cfg,iteraties:ITERATIES,zout:b64(zout),verpakt:await verpak(dek,kek),gewijzigd:new Date().toISOString()}));
  return true;
}
export function vergrendel(){Object.assign(toestand(),{sleutel:null});}

/* Versleutelen en ontsleutelen van een JSON-waarde. */
export function isVersleuteld(v){return !!(v&&typeof v==='object'&&v.__bidashVersleuteld===1&&typeof v.iv==='string'&&Array.isArray(v.delen));}
export async function versleutel(waarde){
  const t=toestand();if(!t.sleutel)throw Error('De werkruimte is vergrendeld. Ontgrendel eerst met je wachtwoord.');
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const data=new Uint8Array(await subtle().encrypt({name:'AES-GCM',iv},t.sleutel,enc.encode(naarTekst(waarde))));
  const delen=[];for(let i=0;i<data.length;i+=DEEL)delen.push(data.slice(i,i+DEEL).buffer);
  return {__bidashVersleuteld:1,iv:b64(iv),delen};
}
export async function ontsleutel(v){
  const t=toestand();if(!t.sleutel)throw Error('De werkruimte is vergrendeld. Ontgrendel eerst met je wachtwoord.');
  const lengte=v.delen.reduce((s,d)=>s+d.byteLength,0),data=new Uint8Array(lengte);let o=0;
  for(const d of v.delen){data.set(new Uint8Array(d),o);o+=d.byteLength;}
  try{return uitTekst(dec.decode(await subtle().decrypt({name:'AES-GCM',iv:unb64(v.iv)},t.sleutel,data)));}
  catch{throw Error('De werkruimte kan niet worden ontsleuteld. Is ze met een ander wachtwoord opgeslagen?');}
}

/* Wissen bij een vergeten wachtwoord: alle versleutelde opslag en de toegangsgegevens. */
export async function wisAlles({databases=[],opslag=globalThis.localStorage}={}){
  for(const naam of databases)await new Promise(r=>{try{const q=indexedDB.deleteDatabase(naam);q.onsuccess=q.onerror=q.onblocked=()=>r();}catch{r();}});
  try{opslag.clear();}catch{}
  vergrendel();
}

/* ---------- inlogscherm ---------- */
function el(tag,cls,tekst){const e=document.createElement(tag);if(cls)e.className=cls;if(tekst!=null)e.textContent=tekst;return e;}
function veld(label,type='password',autocomplete='current-password'){const l=el('label','tg-veld');l.append(el('span',null,label));const i=el('input');i.type=type;i.autocomplete=autocomplete;i.required=true;l.append(i);return {l,i};}

/* Toont het inlogscherm (of het instelscherm) en wacht tot de werkruimte ontgrendeld is.
   databases: welke IndexedDB-databases bij "wissen" horen. */
export async function vraagToegang({titel='Business Intelligence Dashboard',databases=[]}={}){
  if(globalThis.BIDASH_ACTUAL?.demo)return {demo:true};
  if(isOntgrendeld())return {al:true};
  const test=globalThis.__BIDASH_TEST_WACHTWOORD__;
  if(typeof test==='string'&&test){if(isIngesteld())await ontgrendel(test);else await stelIn(test);startAutoVergrendel();return {test:true};}
  return new Promise(resolve=>{
    const scherm=el('div','tg-scherm');scherm.setAttribute('role','dialog');scherm.setAttribute('aria-modal','true');scherm.setAttribute('aria-labelledby','tgTitel');
    const kaart=el('div','tg-kaart');scherm.append(kaart);
    const toon=modus=>{
      kaart.replaceChildren();
      kaart.append(el('div','tg-merk','B'),Object.assign(el('h1',null,titel),{id:'tgTitel'}));
      const form=el('form','tg-form'),melding=el('p','tg-melding');melding.setAttribute('role','alert');
      if(modus==='instellen'){
        kaart.append(el('h2',null,'Beveilig je werkruimte'),el('p','tg-uitleg','Je gegevens blijven in deze browser en worden versleuteld met je wachtwoord. Zonder wachtwoord zijn ze niet te lezen. Een vergeten wachtwoord is niet te herstellen: maak daarom regelmatig een export.'));
        const a=veld('Nieuw wachtwoord (minstens '+MIN_LENGTE+' tekens)','password','new-password'),b=veld('Herhaal het wachtwoord','password','new-password');
        const knop=el('button','tg-knop','Wachtwoord instellen');knop.type='submit';
        form.append(a.l,b.l,melding,knop);kaart.append(form);a.i.focus();
        form.addEventListener('submit',async e=>{e.preventDefault();const f=controleerWachtwoord(a.i.value,b.i.value);if(f){melding.textContent=f;return;}
          knop.disabled=true;melding.textContent='Bezig met beveiligen…';try{await stelIn(a.i.value);scherm.remove();startAutoVergrendel();resolve({ingesteld:true});}catch(err){melding.textContent=err.message;knop.disabled=false;}});
      }else if(modus==='ontgrendelen'){
        kaart.append(el('h2',null,'Werkruimte vergrendeld'),el('p','tg-uitleg','Voer je wachtwoord in om je gegevens te ontgrendelen.'));
        const a=veld('Wachtwoord');const knop=el('button','tg-knop','Ontgrendelen');knop.type='submit';
        const vergeten=el('button','tg-link','Wachtwoord vergeten?');vergeten.type='button';vergeten.addEventListener('click',()=>toon('vergeten'));
        form.append(a.l,melding,knop,vergeten);kaart.append(form);a.i.focus();let pogingen=0;
        form.addEventListener('submit',async e=>{e.preventDefault();knop.disabled=true;melding.textContent='Controleren…';
          try{await ontgrendel(a.i.value);scherm.remove();startAutoVergrendel();resolve({ontgrendeld:true});}
          catch(err){pogingen++;const wacht=pogingen>=5?Math.min(30,2**(pogingen-4))*1000:0;melding.textContent=err.message+(wacht?` Wacht ${wacht/1000} seconden.`:'');a.i.select();setTimeout(()=>{knop.disabled=false;},wacht);}});
      }else{
        kaart.append(el('h2',null,'Wachtwoord vergeten'),el('p','tg-uitleg','Je gegevens zijn versleuteld met je wachtwoord en daarom niet te herstellen. Je kunt de werkruimte in deze browser wissen en opnieuw beginnen. Heb je een export, dan kun je die daarna weer laden.'));
        const a=veld('Typ WISSEN om te bevestigen','text','off');const knop=el('button','tg-knop tg-gevaar','Werkruimte wissen');knop.type='submit';
        const terug=el('button','tg-link','Terug naar ontgrendelen');terug.type='button';terug.addEventListener('click',()=>toon('ontgrendelen'));
        form.append(a.l,melding,knop,terug);kaart.append(form);a.i.focus();
        form.addEventListener('submit',async e=>{e.preventDefault();if(a.i.value.trim()!=='WISSEN'){melding.textContent='Typ WISSEN in hoofdletters.';return;}knop.disabled=true;await wisAlles({databases});location.reload();});
      }
    };
    document.body.append(scherm);toon(isIngesteld()?'ontgrendelen':'instellen');
  });
}

/* Automatisch vergrendelen na een periode zonder activiteit: sleutel wissen en herladen. */
let timer=null;
export function startAutoVergrendel(ms=VERGRENDEL_NA_MS){
  if(globalThis.BIDASH_ACTUAL?.demo||typeof document==='undefined'||startAutoVergrendel.actief)return;startAutoVergrendel.actief=true;
  const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>vergrendelEnHerlaad(),ms);};
  for(const t of ['pointerdown','keydown','wheel','touchstart'])document.addEventListener(t,reset,{passive:true,capture:true});
  reset();
}
/* Eerst openstaande wijzigingen (versleuteld) opslaan; dan de sleutel wissen en herladen. */
export async function vergrendelEnHerlaad(){try{await globalThis.__BIDASH_VOOR_VERGRENDELEN__?.();}catch{}vergrendel();location.reload();}

/* Wachtwoord wijzigen: alleen de verpakking van de gegevenssleutel verandert. */
export function toonWachtwoordWijzigen(){
  return new Promise(resolve=>{
    const scherm=el('div','tg-scherm');scherm.setAttribute('role','dialog');scherm.setAttribute('aria-modal','true');scherm.setAttribute('aria-labelledby','tgWijzigTitel');
    const kaart=el('div','tg-kaart'),h=el('h2',null,'Wachtwoord wijzigen');h.id='tgWijzigTitel';
    const form=el('form','tg-form'),melding=el('p','tg-melding');melding.setAttribute('role','alert');
    const oud=veld('Huidig wachtwoord'),a=veld('Nieuw wachtwoord (minstens '+MIN_LENGTE+' tekens)','password','new-password'),b=veld('Herhaal het nieuwe wachtwoord','password','new-password');
    const knop=el('button','tg-knop','Wijzigen');knop.type='submit';
    const annuleer=el('button','tg-link','Annuleren');annuleer.type='button';
    const sluit=r=>{scherm.remove();resolve(r);};annuleer.addEventListener('click',()=>sluit(false));
    scherm.addEventListener('keydown',e=>{if(e.key==='Escape')sluit(false);});
    form.append(oud.l,a.l,b.l,melding,knop,annuleer);kaart.append(h,form);scherm.append(kaart);document.body.append(scherm);oud.i.focus();
    form.addEventListener('submit',async e=>{e.preventDefault();const f=controleerWachtwoord(a.i.value,b.i.value);if(f){melding.textContent=f;return;}
      knop.disabled=true;melding.textContent='Bezig…';try{await wijzigWachtwoord(oud.i.value,a.i.value);sluit(true);}catch(err){melding.textContent=err.message;knop.disabled=false;}});
  });
}
