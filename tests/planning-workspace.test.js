import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlanningSnapshot,planningSnapshot,PLANNING_WORKSPACE_DB} from '../site/core/planning-workspace.js';
const planning={name:'test.xml',xml:'<Project>synthetic</Project>',state:{ipl:{shift:0,mshift:{a:2},config:{budget:null}},opgeslagen:'2030-01-01'}};
test('planningback-up bewaart bron, nul, onbekend en verschuivingen zonder gedeelde mutable instellingen',()=>{
 const b=planningSnapshot(planning,new Date('2030-01-01'));assert.equal(b.formaat,'BIdash-planning');
 assert.equal(b.planning.xml,planning.xml);assert.equal(b.planning.state.ipl.shift,0);assert.equal(b.planning.state.ipl.config.budget,null);
 b.planning.state.ipl.mshift.a=3;assert.equal(planning.state.ipl.mshift.a,2);
 assert.equal(normalizePlanningSnapshot(b).state.ipl.mshift.a,3);
});
test('integrale back-up neemt uitsluitend de planning over',()=>{
 const restored=normalizePlanningSnapshot({formaat:'BiDash-integraal',delen:{planning,dvm:{privateSource:'unrelated'},biData:{privateSource:'unrelated'}}});
 assert.deepEqual(Object.keys(restored).sort(),['name','state','xml']);assert.equal(restored.xml,planning.xml);
 assert.equal(JSON.stringify(restored).includes('unrelated'),false);
});
test('ongeldige of onvolledige back-ups worden afgewezen',()=>{
 for(const b of [null,[],{}, {planning:{xml:''}},{planning:{xml:'<Project/>',state:[]}},{planning:{xml:'<Project/>',state:{ipl:[]}}},{formaat:'BIdash-planning',versie:2,planning}])assert.throws(()=>normalizePlanningSnapshot(b));
});
test('planning gebruikt een eigen database en ondersteunt losse planningdelen',()=>{
 assert.equal(PLANNING_WORKSPACE_DB,'bidash-planning');assert.notEqual(PLANNING_WORKSPACE_DB,'bidash-actual');
 assert.equal(normalizePlanningSnapshot(planning).name,'test.xml');
});
