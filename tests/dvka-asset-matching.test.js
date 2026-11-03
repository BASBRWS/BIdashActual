import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {dvmRuntime} from './helpers/dvm-runtime.js';
const asset=(id,side,lane=3,extra={})=>({entityid:id,asset:`MN VKS MSI A15${side} 12,345 ${lane}`,'ci-type':'VKS signaalgevers',regio:'VCMN',status:'Operationeel',...extra});
const fault=(side='LI',unit=3,extra={})=>({locatie:`A15 ${side} HMP 12.345`,vc:'MN',assettype:'MSI',strook:String(unit),melding:`MSI ${unit} defect`,foutcode:'1003',van:'2026-01-01',...extra});
function runtime(rows){const r=dvmRuntime();r.eval=s=>vm.runInContext(s,r);r.rows=rows;r.eval('analyseerAssetRegister(rows,"synthetic DVKA")');r.assetConfigHerbereken=()=>{};return r;}
const match=(r,row,type='MSI')=>r.koppelMeldingAanAsset(r.normRij(row),type);
const bps={'bps-locatie':'RW015 12,3 +45 VW n 3 R- L','baanpositie':'L'};

test('BPS en baanpositie geven een lokale DVKA-hoofdrichting zonder wereldwijde letteraanname',()=>{
 const r=runtime([asset('N','n',3,bps),asset('OTHER','n',3,{'bps-locatie':'RW015 12,3 +45 VW n 3 R- R',regio:'VCNWN'})]);
 assert.equal(r.eval('ASSET_INDEX.byKey.get("ID:N").richting'),'LI');
 assert.equal(r.eval('ASSET_INDEX.byKey.get("ID:N").zijdeBron'),'N');
 assert.equal(r.eval('ASSET_INDEX.byKey.get("ID:OTHER").richting'),'RE');
 assert.match(r.eval('ASSET_INDEX.byKey.get("ID:N").zijdeKoppeling'),/BPS/);
 assert.equal(r.rows[0].asset,'MN VKS MSI A15n 12,345 3');
});

test('unieke MSI-eenheid op afgeleide DVKA koppelt aan een hoofdbaanaanduiding',()=>{
 const r=runtime([asset('L1','L',1),asset('L2','L',2),asset('N3','n',3,bps)]);
 const k=match(r,fault());assert.equal(k.asset.key,'ID:N3');assert.equal(k.methode,'DVKA via hoofdrichting');
 const m=r.normRij(fault());r.pasAssetKoppelingToe(m,k);
 assert.equal(m.assetKey,'ID:N3');assert.equal(m.hm,12.345);assert.equal(m.assetKoppelNiveau,'asset');
});

test('exacte wegtak heeft voorrang; verschillende DVKA-letters worden niet samengevoegd',()=>{
 const r=runtime([asset('L','L'),asset('N','n',3,bps),asset('G','G',3,bps)]);
 assert.equal(match(r,fault()).asset.key,'ID:L');
 assert.equal(match(r,fault('N')).asset.key,'ID:N');
 const other=runtime([asset('G','G',3,bps)]);assert.equal(match(other,fault('N')).asset,null);
});

test('twee DVKA-kandidaten met gelijke primaire kant blijven een expliciete keuze',()=>{
 const r=runtime([asset('N','n',3,bps),asset('G','G',3,bps)]),k=match(r,fault());
 assert.equal(k.asset,null);assert.equal(k.koppelniveau,'locatie');assert.equal(k.suggesties.length,2);
 assert.ok(k.kandidaatDetails.every(d=>d.bevestigbaar));assert.equal(k.bulkToegestaan,false);
});

test('expliciete DVKA naar hoofdbaan is slechts kandidaat tot bevestiging en blijft na export geldig',()=>{
 const r=runtime([asset('L','L')]),row=fault('N'),m=r.normRij(row),k=match(r,row);
 assert.equal(k.asset,null);assert.equal(k.redenCode,'wegtak');assert.equal(k.suggesties[0].key,'ID:L');
 r.group={id:k.logId,typeId:'MSI',melding:m,suggesties:k.suggesties,kandidaatDetails:k.kandidaatDetails,bulkToegestaan:false};
 r.eval('ASSET_MATCH_STATE={groepen:[group]}');
 r.assetConfigKoppel(encodeURIComponent(k.logId),'ID%3AL');
 assert.equal(match(r,row).asset.key,'ID:L');
 const backup=r.totaalExportBundle(),fresh=runtime([asset('L','L')]);
 fresh.config=backup.parameters.assetConfig;fresh.eval('RULES.assetConfig=config');
 assert.equal(match(fresh,row).asset.key,'ID:L');
 fresh.assetConfigVerwijderAlias(encodeURIComponent(k.logKey));assert.equal(match(fresh,row).asset,null);
});

test('oude onbevestigde alias omzeilt een DVKA-verschil niet',()=>{
 const r=runtime([asset('L','L')]),row=fault('N'),k=match(r,row);
 r.key=k.logKey;r.eval('RULES.assetConfig.aliases[key]="ID:L"');
 assert.equal(match(r,row).asset,null);
});

test('afwijkend eenheidsnummer toont locatiekandidaten maar accepteert geen geforceerde alias',()=>{
 const r=runtime([asset('N1','n',1,bps),asset('N2','n',2,bps)]),row=fault('N'),k=match(r,row);
 assert.equal(k.redenCode,'eenheid');assert.equal(k.koppelniveau,'locatie');assert.equal(k.asset,null);
 assert.equal(k.suggesties.length,2);assert.ok(k.kandidaatDetails.every(d=>!d.bevestigbaar));
 r.group={id:k.logId,typeId:'MSI',melding:r.normRij(row)};r.eval('ASSET_MATCH_STATE={groepen:[group]}');
 r.assetConfigKoppel(encodeURIComponent(k.logId),'ID%3AN1');
 assert.equal(r.eval('Object.keys(RULES.assetConfig.aliases).length'),0);
});

test('LUS gebruikt dezelfde DVKA-regels en behoudt haar eigen type',()=>{
 const rows=[asset('DET','m',2,{'ci-type':'VKS detectoren','nen-bouwdeel':'Detectielus',asset:'MN VKS DET A15m 12,345 2','bps-locatie':'RW015 12,3 +45 VW m 2 R- R'})],r=runtime(rows);
 assert.equal(match(r,fault('RE',2,{assettype:'LUS',melding:'Detector 2 defect'}),'LUS').asset.key,'ID:DET');
 assert.equal(match(r,fault('RE',2)).asset,null);
});

test('andere weg, VC, tegengestelde kant en hectoletter blijven geblokkeerd',()=>{
 const r=runtime([asset('N','n',3,{...bps,hectoletter:'A'})]);
 for(const row of [fault('RE'),fault('LI',3,{vc:'NWN'}),fault('LI',3,{locatie:'N15 LI 12.345'}),fault('LI',3,{hectoletter:'B'})])assert.equal(match(r,row).asset,null);
});

test('DVKA zonder expliciete kant en met even nabije hoofdbanen blijft onbekend',()=>{
 const r=runtime([asset('L','L',1),asset('R','R',1),asset('N','n')]);
 assert.equal(r.eval('ASSET_INDEX.byKey.get("ID:N").richting'),'N');
 assert.equal(match(r,fault()).asset,null);
});

test('meldgroepen bewaren reden, locatie en aantallen, bulk slaat onbesliste groepen over',()=>{
 const r=runtime([asset('L','L')]);r.faults=[fault('N',3,{event_id:'one'}),fault('N',3,{event_id:'two'})];
 r.eval('STORINGSBRONNEN=[{rijen:faults}];herbouwAssetMatchBeeld()');
 assert.equal(r.eval('ASSET_MATCH_STATE.groepen[0].n'),2);
 assert.equal(r.eval('ASSET_MATCH_STATE.groepen[0].redenCode'),'wegtak');
 const html=r.renderAssetConfigPane();assert.match(html,/data-asset-match-reasons/);assert.match(html,/Bevestig DVKA-koppeling/);assert.doesNotMatch(html,/Koppel beste kandidaten \(/);
 r.assetConfigKoppelBesteAlle();assert.equal(r.eval('Object.keys(RULES.assetConfig.aliases).length'),0);
});


test('gelijke oorspronkelijke DVKA koppelt ook als alleen de registerbron haar hoofdrichting kent',()=>{
 const r=runtime([asset('L','L',1),asset('R','R',1),asset('N','n',3,bps)]);
 const m=r.normRij(fault('N'));assert.equal(m.richting,'N');
 const k=r.koppelMeldingAanAsset(m,'MSI');assert.equal(k.asset.key,'ID:N');
 assert.equal(k.methode,'locatie + strook');
});
