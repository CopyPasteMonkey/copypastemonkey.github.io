import test from 'node:test';
import assert from 'node:assert/strict';
import {readScores,saveScore,validScores} from '../scores.js';
const entry=(score=1000)=>({initials:'ABC',score,time:180,pacifist:true});
test('scoreboard persists, ranks and limits the top ten',()=>{let data=null;const storage={getItem:()=>data,setItem:(_,value)=>data=value};for(let i=0;i<12;i++)assert.equal(saveScore(storage,entry(i*100)).ok,true);const scores=readScores(storage);assert.equal(scores.length,10);assert.equal(scores[0].score,1100);assert.equal(scores.at(-1).score,200);});
test('invalid stored scores and unavailable storage are safe',()=>{assert.deepEqual(validScores([{...entry(),initials:'<x>'},{...entry(),score:NaN},{...entry(),time:-1}]),[]);assert.deepEqual(readScores({getItem:()=>'{bad'}),[]);assert.equal(saveScore(null,entry()).ok,false);assert.equal(saveScore({getItem:()=>null,setItem:()=>{throw Error('full');}},entry()).ok,false);});

test('scoreboard preserves difficulty and keeps older scores marked classic',()=>{assert.equal(validScores([entry()])[0].difficulty,'classic');assert.equal(validScores([{...entry(),difficulty:'hard'}])[0].difficulty,'hard');assert.deepEqual(validScores([{...entry(),difficulty:'unknown'}]),[]);});
