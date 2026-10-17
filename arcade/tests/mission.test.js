import test from 'node:test';
import assert from 'node:assert/strict';
import {Mission,scoreSummary} from '../physics.js';
import {pilot} from './helpers/pilot.js';
test('a no-fire mission can retrieve all technologies with ordinary flight inputs',()=>{
 const m=new Mission(42);m.start();const drive=pilot();let held={};
 for(let i=0;i<120*360&&m.state!=='won';i++){const desired=drive(m,false);if(i%12===0)held=desired;m.step(1/120,held);m.takeEvents();}
 assert.equal(m.state,'won');assert.equal(m.delivered,3);assert.equal(m.kills,0);assert.ok(m.rescues<=2);assert.equal(scoreSummary(m).pacifist,6000);
});
