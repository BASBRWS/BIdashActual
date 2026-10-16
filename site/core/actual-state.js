/* Bronactualiteit is een eigenschap van de geladen stand, niet van de klok van de gebruiker. */
const vcs=['MN','NON','NWN','ZWN','ZN'];
const vc=value=>({WNN:'NWN',WNZ:'ZWN'})[String(value||'').toUpperCase()]||String(value||'').toUpperCase();
const time=value=>{if(value==null||value==='')return null;const n=typeof value==='number'?value:Date.parse(value);return Number.isFinite(n)?n:null;};
export function actualStand(dvm,summary,now=Date.now()){
  const source=dvm?.bronbeheer?.signaalgeverTotaal||{},watermarks=new Map();
  for(const [v,t] of Object.entries(source.laatstePerVc||{})){const n=time(t);if(n!=null)watermarks.set(vc(v),n);}
  const counts=new Map(),uncertain=new Map();
  for(const b of dvm?.liveStoringen||[])for(const row of b.rijen||[]){
    if(/^HERSTELD_|^gesloten|^closed/i.test(row.levenscyclus_status||row.status||''))continue;
    const v=vc(row.vc||row.verkeerscentrale)||'ONBEKEND';counts.set(v,(counts.get(v)||0)+1);
    const stamp=time(row.bron_peildatum??b.peildatum),last=time(row.bevestigd_tot??row.laatste_gezien??row.bron_peildatum??b.peildatum);
    if(!source.laatstePerVc&&stamp!=null)watermarks.set(v,Math.max(watermarks.get(v)??-Infinity,stamp));
    if(!['OPEN_BEVESTIGD'].includes(row.levenscyclus_status)||last==null||last>now||now-last>48*36e5)uncertain.set(v,(uncertain.get(v)||0)+1);
  }
  const rows=[...new Set([...vcs,...watermarks.keys(),...counts.keys()])].map(v=>{
    const t=watermarks.get(v)??null,coverage=source.snapshotDekking?.[v.toLowerCase()]||source.snapshotDekking?.[v]||null;
    return {vc:v,peildatum:t,meldingen:counts.get(v)||0,onzeker:uncertain.get(v)||0,status:t==null?'Peilmoment onbekend':t>now?'Bronpeildatum ligt in de toekomst':now-t>48*36e5?'Bron ouder dan 48 uur':coverage&&(!coverage.volledig||coverage.bronGap||coverage.volumeVerdacht)?'Brondekking onzeker':'Laatste geladen bron'};
  });
  return {peildatum:time(summary?.peildatum),rows,hasData:!!dvm};
}
