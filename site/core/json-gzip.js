/* Ingepakte JSON (.json.gz) lezen en schrijven met de gzip-ondersteuning van de browser.

   De inhoud blijft exact dezelfde JSON. Alleen de bestandsgrens wordt ingepakt, zodat
   back-ups ongeveer tien keer kleiner worden. De herkenning gebeurt op de gzip-kop
   (1f 8b) en niet op de bestandsnaam. Een hernoemd gewoon JSON-bestand blijft zo
   leesbaar, en een ingepakt bestand zonder .gz-extensie ook. Er is geen externe
   bibliotheek nodig: CompressionStream en DecompressionStream zitten in Chrome en
   Edge, en worden al gebruikt voor NDW en het wegennet. */

export const GZIP_TYPE='application/gzip';
export const JSON_BESTAND=/\.json(?:\.gz)?$/i;
export const GZIP_VOORKEUR_KEY='bidash-export-gzip';

export function isGzipKop(bytes){
  return !!bytes&&bytes.length>=2&&bytes[0]===0x1f&&bytes[1]===0x8b;
}

export function kanGzipSchrijven(scope=globalThis){
  return typeof scope.CompressionStream==='function';
}

export function gzipNaam(name=''){
  const naam=String(name);
  return /\.gz$/i.test(naam)?naam:naam+'.gz';
}

export function zonderGzip(name=''){
  return String(name).replace(/\.gz$/i,'');
}

async function kopVan(file){
  if(typeof file?.slice!=='function')return null;
  const deel=file.slice(0,2);
  if(typeof deel?.arrayBuffer!=='function')return null;
  return new Uint8Array(await deel.arrayBuffer());
}

/* Leest een gekozen bestand als tekst. Een gzip-bestand wordt eerst uitgepakt.
   Bij een beschadigd of afgekapt gzip-bestand volgt een Nederlandse fout met de
   bestandsnaam, vóórdat iets in de werkruimte wordt vervangen. */
export async function leesBestandTekst(file,{scope=globalThis}={}){
  const kop=await kopVan(file);
  if(!isGzipKop(kop))return file.text();
  if(typeof scope.DecompressionStream!=='function')throw Error(`Deze browser kan ${file.name||'het bestand'} niet uitpakken. Gebruik een recente Edge of Chrome, of pak het bestand eerst uit.`);
  try{
    const stroom=(typeof file.stream==='function'?file.stream():new scope.Blob([await file.arrayBuffer()]).stream())
      .pipeThrough(new scope.DecompressionStream('gzip'));
    return await new scope.Response(stroom).text();
  }catch(error){
    throw Error(`${file.name||'Het bestand'} is geen geldig of volledig gzip-bestand. Controleer of de download of synchronisatie is afgerond.`,{cause:error});
  }
}

export async function leesJsonBestand(file,opties){
  return JSON.parse(await leesBestandTekst(file,opties));
}

/* Maakt het bestand voor een JSON-export. Met gzip:true wordt de tekst ingepakt en
   krijgt de naam .json.gz. Zonder CompressionStream valt de export terug op gewone
   JSON en meldt `ingepakt:false`, zodat de aanroeper dat zichtbaar kan maken. */
export async function maakJsonBestand(data,name,{gzip=true,type='application/json',scope=globalThis}={}){
  const tekst=typeof data==='string'?data:JSON.stringify(data);
  const gewoon=zonderGzip(name);
  if(!gzip||!kanGzipSchrijven(scope))return {blob:new scope.Blob([tekst],{type}),name:gewoon,type,ingepakt:false,origineel:tekst.length};
  const stroom=new scope.Blob([tekst],{type}).stream().pipeThrough(new scope.CompressionStream('gzip'));
  const ingepakt=await new scope.Response(stroom).blob();
  return {blob:new scope.Blob([ingepakt],{type:GZIP_TYPE}),name:gzipNaam(gewoon),type:GZIP_TYPE,ingepakt:true,origineel:tekst.length};
}

export function leesGzipVoorkeur(scope=globalThis){
  try{const v=scope.localStorage?.getItem(GZIP_VOORKEUR_KEY);return v===null||v===undefined?true:v!=='0';}catch{return true;}
}

export function bewaarGzipVoorkeur(aan,scope=globalThis){
  try{scope.localStorage?.setItem(GZIP_VOORKEUR_KEY,aan?'1':'0');}catch{}
}
