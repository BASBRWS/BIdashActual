/* 3.01: een versleutelde werkruimte groter dan de maximale tekstlengte van de browser.
   In 2.99 en 3.00 ging de hele werkruimte als één JSON-tekst door de versleuteling; bij
   een groot DVM-bestand stopte de import met "Invalid string length". Synthetische gegevens:
   één tekst van 20 miljoen tekens, 28 keer in de werkruimte, samen boven de grens van
   ongeveer 537 miljoen tekens. Vereist Playwright en Chromium. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=path.join(__dirname,'../site'),server=require('node:http').createServer((req,res)=>{if(req.url==='/test.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Grote versleutelde werkruimte</title><body></body>');return;}try{const p=path.join(root,new URL(req.url,'http://localhost').pathname);res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-gpu','--js-flags=--max-old-space-size=8192']});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/test.html');
  const r=await page.evaluate(async()=>{
   const T=await import('/core/toegang.js'),S=await import('/core/storage.js');
   await T.stelIn('synthetisch wachtwoord 2026');
   const tekst='x'.repeat(20_000_000),groot={schema:1,marker:'groot',nil:null,zero:0,blokken:Array(28).fill(tekst)};
   // De oude route: alles in één keer versleutelen loopt tegen de tekstgrens aan.
   let oudeRoute='';try{await T.versleutel(groot);}catch(e){oudeRoute=String(e?.message||e);}
   await S.write(groot);
   const db=await new Promise((res,rej)=>{const q=indexedDB.open('bidash-integraal',1);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
   const alles=await new Promise((res,rej)=>{const q=db.transaction('workspace').objectStore('workspace').getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});
   const manifest=alles.find(v=>v?.storage==='BiDash-workspace-parts'),blokken=alles.filter(v=>v!==manifest);
   const allesVersleuteld=blokken.length>0&&blokken.every(T.isVersleuteld)&&T.isVersleuteld(manifest.root);
   const terug=await S.read();
   const gelezen={marker:terug.marker,nil:terug.nil,zero:terug.zero,aantal:terug.blokken.length,lengtes:[...new Set(terug.blokken.map(t=>t.length))],goed:terug.blokken.every(t=>t[0]==='x'&&t.at(-1)==='x')};
   // Een werkruimte die 2.99/3.00 als één versleuteld geheel opsloeg, blijft leesbaar.
   const klein={schema:1,marker:'oud-formaat',nil:null,zero:0};
   const sleutel=localStorage.getItem(T.TOEGANG_KEY),toestand=globalThis.__BIDASH_TOEGANG__;
   const geheel=await T.versleutel(klein);localStorage.removeItem(T.TOEGANG_KEY);toestand.actief=false;
   await S.write(geheel);localStorage.setItem(T.TOEGANG_KEY,sleutel);toestand.actief=true;
   const oud=await S.read();db.close();
   return {oudeRoute,aantalBlokken:blokken.length,allesVersleuteld,gelezen,oud};
  });
  assert.match(r.oudeRoute,/Invalid string length/,'de oude route moet de tekstgrens raken, anders bewijst de test niets');
  assert.ok(r.aantalBlokken>28,'werkruimte over meerdere blokken verdeeld');
  assert.equal(r.allesVersleuteld,true,'elk opslagblok en de wortel zijn versleuteld');
  assert.deepEqual(r.gelezen,{marker:'groot',nil:null,zero:0,aantal:28,lengtes:[20_000_000],goed:true});
  assert.deepEqual(r.oud,{schema:1,marker:'oud-formaat',nil:null,zero:0});
  console.log(`Grote versleutelde werkruimte (560 miljoen tekens, ${r.aantalBlokken} blokken) opgeslagen en teruggelezen; oud formaat leesbaar.`);
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
