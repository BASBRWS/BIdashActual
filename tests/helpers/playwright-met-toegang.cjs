/* 2.99: sinds de login gekoppeld is aan versleuteling vraagt het dashboard bij het openen om
   een wachtwoord. Deze hulp levert Playwright met een testwachtwoord: elke nieuwe pagina krijgt
   __BIDASH_TEST_WACHTWOORD__, waarmee core/toegang.js het wachtwoord instelt of ontgrendelt.
   De versleuteling zelf wordt niet overgeslagen; de tests draaien dus op versleutelde opslag.
   Zet BIDASH_TEST_ZONDER_WACHTWOORD=1 om het echte inlogscherm te zien. */
const pw=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const WACHTWOORD='testwachtwoord-bidash-2026';
const script=`globalThis.__BIDASH_TEST_WACHTWOORD__=${JSON.stringify(WACHTWOORD)};`;
function metToegang(browser){
  if(process.env.BIDASH_TEST_ZONDER_WACHTWOORD==='1')return browser;
  const newContext=browser.newContext.bind(browser);
  browser.newContext=async(...a)=>{const c=await newContext(...a);await c.addInitScript(script);return c;};
  browser.newPage=async(...a)=>{const c=await browser.newContext(...a);const p=await c.newPage();p.__ownedContext=c;return p;};
  return browser;
}
const chromium=Object.create(pw.chromium);
chromium.launch=async(...a)=>metToegang(await pw.chromium.launch(...a));
module.exports={...pw,chromium,TEST_WACHTWOORD:WACHTWOORD};
