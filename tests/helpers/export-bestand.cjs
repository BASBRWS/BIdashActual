/* Leest een gedownloade BiDash-export. Vanaf 2.86 is die standaard ingepakt
   (.json.gz); de gzip-kop bepaalt of eerst wordt uitgepakt. */
const fs=require('node:fs'),zlib=require('node:zlib');
function leesExport(pad){
  const bytes=fs.readFileSync(pad);
  return (bytes[0]===0x1f&&bytes[1]===0x8b?zlib.gunzipSync(bytes):bytes).toString('utf8');
}
module.exports={leesExport};
