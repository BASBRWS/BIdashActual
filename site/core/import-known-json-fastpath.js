import {isGzipKop} from './json-gzip.js';
const HEAD_BYTES=256*1024;

export function knownBiDashJsonHead(text){
  const s=String(text||'');
  return /"formaat"\s*:\s*"(?:BiDash-integraal|DVM-dienstimpact-totaal)"/.test(s);
}

/* Bij een ingepakte back-up (.json.gz) wordt alleen het begin uitgepakt. De volledige
   inhoud leest de gewone import daarna één keer. */
async function uitgepaktBegin(file,scope=globalThis){
  if(typeof scope.DecompressionStream!=='function'||typeof file.stream!=='function')return '';
  const reader=file.stream().pipeThrough(new scope.DecompressionStream('gzip')).pipeThrough(new scope.TextDecoderStream()).getReader();
  let tekst='';
  try{while(tekst.length<HEAD_BYTES){const {value,done}=await reader.read();if(done)break;tekst+=value;}}
  catch(_error){return '';}
  finally{reader.cancel().catch(()=>{});}
  return tekst;
}

export async function fileLooksLikeKnownBiDashJson(file,scope=globalThis){
  const naam=String(file?.name||'');
  if(!file||!/\.json(?:\.gz)?$/i.test(naam)||typeof file.slice!=='function')return false;
  if(/\.json$/i.test(naam))return knownBiDashJsonHead(await file.slice(0,HEAD_BYTES).text());
  const kop=new Uint8Array(await file.slice(0,2).arrayBuffer());
  return knownBiDashJsonHead(isGzipKop(kop)?await uitgepaktBegin(file,scope):await file.slice(0,HEAD_BYTES).text());
}

export function installKnownJsonFastPath(scope=globalThis){
  if(!scope?.document)return false;
  const doc=scope.document,input=doc.getElementById('files');
  if(!input)return false;

  let coreHandler=null,tries=0;
  const run=()=>{
    if(input.dataset.bidashKnownJsonFastpath)return true;

    // Deze module wordt vóór universal-importer geladen. De eerste timer draait
    // nadat app.js zijn eigen onchange-handler heeft geplaatst maar vóórdat de
    // universele importer hem omwikkelt. Zo bewaren we de bewezen importroute
    // van vóór PR 22 zonder de brede bronherkenning voor andere bestanden weg
    // te nemen.
    if(!coreHandler&&typeof input.onchange==='function'&&!input.dataset.bidashUniversalImporter){
      coreHandler=input.onchange;
    }

    if(coreHandler&&input.dataset.bidashUniversalImporter&&typeof input.onchange==='function'){
      const universalHandler=input.onchange;
      input.onchange=async event=>{
        const files=[...(event?.target?.files||[])];
        const type=doc.getElementById('importType')?.value||'auto';
        if(files.length&&(type==='auto'||type==='dvm')){
          let bekend=true;
          for(const file of files){
            if(!(await fileLooksLikeKnownBiDashJson(file))){bekend=false;break;}
          }
          if(bekend){
            scope.BIDASH_LOAD_PROGRESS?.show?.({
              name:files.length===1?files[0].name:files.length+' bestanden',
              pct:null,
              fase:'Bekende BiDash-export · één keer lezen en controleren',
              detailText:'Native browserlezer; geen dubbele herkenningsparse.'
            });
            return coreHandler.call(input,event);
          }
        }
        return universalHandler.call(input,event);
      };
      input.dataset.bidashKnownJsonFastpath='1';
      scope.__BIDASH_KNOWN_JSON_FASTPATH__=true;
      return true;
    }

    if(++tries<240)setTimeout(run,25);
    return false;
  };
  setTimeout(run,0);
  return true;
}

if(typeof window!=='undefined'&&typeof document!=='undefined')installKnownJsonFastPath(window);
