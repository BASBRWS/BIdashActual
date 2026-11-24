/* 2.99 / DVM 172: echt inlogscherm gekoppeld aan versleuteling. Synthetische gegevens. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const W='mijn-test-wachtwoord-2026';
(async()=>{
  const root=path.join(__dirname,'../site'),server=http.createServer((req,res)=>{try{let p=path.join(root,new URL(req.url,'http://localhost').pathname);if(p.endsWith('/'))p+='index.html';res.setHeader('Content-Type',p.endsWith('.js')?'text/javascript':p.endsWith('.css')?'text/css':p.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(p));}catch{res.statusCode=404;res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1280,height:900}});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const base='http://127.0.0.1:'+server.address().port;
    // Oude situatie: onversleutelde BI-kopie in localStorage.
    await page.goto(base+'/help.html');await page.evaluate(()=>localStorage.setItem('bidash_integratie_v1','{"oud":"leesbaar"}'));
    // 1. Eerste keer: wachtwoord instellen. Zonder ontgrendelen wordt de werkruimte niet gelezen.
    await page.goto(base+'/index.html');
    await page.locator('.tg-scherm').waitFor();
    assert.match(await page.locator('.tg-kaart').innerText(),/Beveilig je werkruimte/);
    assert.doesNotMatch(await page.locator('#status').innerText(),/Werkruimte gereed/);
    const velden=page.locator('.tg-veld input');
    await velden.nth(0).fill('kort');await velden.nth(1).fill('kort');await page.locator('.tg-knop').click();
    assert.match(await page.locator('.tg-melding').innerText(),/minstens 12/);
    await velden.nth(0).fill(W);await velden.nth(1).fill(W);await page.locator('.tg-knop').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
    assert.equal(await page.locator('.tg-scherm').count(),0);
    assert.equal(await page.locator('#toegangVergrendel').isVisible(),true);
    assert.equal(await page.evaluate(()=>localStorage.getItem('bidash_integratie_v1')),null,'onversleutelde kopie verwijderd');
    // 2. Gegevens opslaan; in IndexedDB staat alleen versleutelde inhoud.
    await page.evaluate(async()=>{const S=await import('/core/storage.js?v=20261124-1700');await S.writeValue('test-geheim',{toelichting:'GEHEIM-MERKTEKEN-123'});});
    const ruw=await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('bidash-actual');r.onsuccess=()=>{const q=r.result.transaction('workspace').objectStore('workspace').getAll();q.onsuccess=()=>{const dec=new TextDecoder('latin1');const tekst=JSON.stringify(q.result,(k,v)=>v instanceof ArrayBuffer?dec.decode(v):v);resolve({tekst,versleuteld:/__bidashVersleuteld/.test(tekst)||q.result.some(x=>x?.entries)});r.result.close();};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));
    assert.ok(!ruw.tekst.includes('GEHEIM-MERKTEKEN-123'),'geen leesbare gegevens in de browseropslag');
    assert.ok(ruw.tekst.includes('__bidashVersleuteld'),'versleutelde vorm opgeslagen');
    // 3. Vergrendelen: na herladen is het wachtwoord nodig; een fout wachtwoord opent niets.
    await page.locator('#toegangVergrendel').click();await page.waitForLoadState('load');
    await page.locator('.tg-scherm').waitFor();assert.match(await page.locator('.tg-kaart').innerText(),/Werkruimte vergrendeld/);
    await page.locator('.tg-veld input').fill('fout-wachtwoord-123');await page.locator('.tg-knop').click();
    await page.waitForFunction(()=>/Onjuist wachtwoord/.test(document.querySelector('.tg-melding')?.textContent||''));
    const vergrendeld=await page.evaluate(()=>import('/core/storage.js?v=20261124-1700').then(m=>m.read()).then(()=>'gelezen',e=>e.message));
    assert.match(vergrendeld,/vergrendeld/,'zonder wachtwoord geen toegang tot de werkruimte');
    await page.locator('.tg-veld input').fill(W);await page.waitForFunction(()=>!document.querySelector('.tg-knop').disabled);await page.locator('.tg-knop').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
    const terug=await page.evaluate(()=>import('/core/storage.js?v=20261124-1700').then(m=>m.readValue('test-geheim')));
    assert.equal(terug?.toelichting,'GEHEIM-MERKTEKEN-123');
    const werkruimte=await page.evaluate(()=>import('/core/storage.js?v=20261124-1700').then(m=>m.read()));assert.ok(werkruimte&&werkruimte.schema,'werkruimte ontsleuteld na ontgrendelen');
    // 4. Wachtwoord wijzigen via de Data-pagina.
    await page.evaluate(()=>{location.hash='#data';});await page.locator('#toegangWijzig').click();
    const w=page.locator('.tg-scherm .tg-veld input');await w.nth(0).fill(W);await w.nth(1).fill(W+'-nieuw');await w.nth(2).fill(W+'-nieuw');await page.locator('.tg-scherm .tg-knop').click();
    await page.locator('.tg-scherm').waitFor({state:'detached'});
    await page.reload();await page.locator('.tg-scherm').waitFor();await page.locator('.tg-veld input').fill(W+'-nieuw');await page.locator('.tg-knop').click();
    await page.waitForFunction(()=>document.getElementById('status').textContent.includes('Werkruimte gereed'),null,{timeout:90000});
    // 5. Losse planningpagina gebruikt hetzelfde wachtwoord.
    const plan=await context.newPage();plan.on('pageerror',e=>errors.push(e.message));await plan.goto(base+'/planning/');
    await plan.locator('.tg-scherm').waitFor({timeout:60000});assert.match(await plan.locator('.tg-kaart').innerText(),/Werkruimte vergrendeld/);
    await plan.locator('.tg-veld input').fill(W+'-nieuw');await plan.locator('.tg-knop').click();await plan.locator('.tg-scherm').waitFor({state:'detached'});
    // 6. Wachtwoord vergeten: wissen na bevestiging, daarna opnieuw instellen.
    await page.reload();await page.locator('.tg-link').click();await page.locator('.tg-veld input').fill('WISSEN');await page.locator('.tg-knop').click();
    await page.waitForFunction(()=>/Beveilig je werkruimte/.test(document.querySelector('.tg-kaart')?.textContent||''),null,{timeout:30000});
    assert.equal(await page.evaluate(()=>localStorage.getItem('bidash-toegang-v1')),null,'toegangsgegevens gewist');
    assert.deepEqual(errors,[]);
    console.log('Toegang: wachtwoord instellen, versleutelde opslag, vergrendelen, fout wachtwoord, ontgrendelen, wijzigen, planningpagina en wissen geslaagd.');
  }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
