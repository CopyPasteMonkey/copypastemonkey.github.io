import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {musicLayers} from '../tanks-music.js';
const reference=JSON.parse(readFileSync(new URL('../research/music-rules.json',import.meta.url)));
const types=['','sentry','patrol','rocket','hunter','miner','warrior','sniper','stealth','elite'];
for(let rank=1;rank<=9;rank++)for(let count=1;count<=8;count++){
 test(`music matches documented rank ${rank}, count ${count}`,()=>{
  const row=reference.rows.filter(r=>r.rank===rank&&parseInt(r.count)<=count).at(-1);
  const expected=['piccolo',...row.instruments.map(i=>reference.columns[i])].sort();
  const tanks=Array.from({length:count},(_,i)=>({id:i+1,alive:true,type:i===0?types[rank]:'sentry'}));
  assert.deepEqual(musicLayers(tanks).sort(),expected);
  assert.deepEqual(musicLayers(tanks.map(t=>({...t,type:types[rank]}))).sort(),expected);
 });
}
test('destroying strongest enemy changes arrangement; corpses and player do not count',()=>{
 const tanks=[{id:0,type:'elite',alive:true},{id:1,type:'stealth',alive:true},{id:2,type:'sniper',alive:true},{id:3,type:'sentry',alive:true}];
 assert(musicLayers(tanks).includes('synth'));assert(!musicLayers(tanks).includes('bells'));
 tanks[1].alive=false;assert(musicLayers(tanks).includes('bells'));assert(!musicLayers(tanks).includes('synth'));
 tanks[2].alive=false;assert.deepEqual(musicLayers(tanks),['piccolo','snare']);
 tanks[3].alive=false;assert.deepEqual(musicLayers(tanks),[]);
});
test('public-domain march has sixteen complete bars and sustained notes',async()=>{
 const {MELODY}=await import('../tanks-music.js');
 assert.equal(MELODY.length,128);
 assert.equal(MELODY.filter(Boolean).reduce((n,[,duration])=>n+duration,0),128);
 assert.deepEqual(MELODY.slice(0,8),[[79,2],null,[74,2],null,[79,2],null,[81,2],null]);
});
