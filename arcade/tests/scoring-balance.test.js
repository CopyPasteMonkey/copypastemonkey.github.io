import test from 'node:test';
import assert from 'node:assert/strict';
import {TankGame,TANK_POINTS,TYPES,LEVELS} from '../tanks-physics.js';
import {Mission,scoreSummary} from '../physics.js';
import {readScores,saveScore} from '../scores.js';
import {readTankScores,saveTankScore} from '../tanks-scores.js';
test('every enemy type has distinct points and destruction cannot pay twice',()=>{
 assert.deepEqual(Object.keys(TANK_POINTS).sort(),Object.keys(TYPES).sort());
 assert.equal(new Set(Object.values(TANK_POINTS)).size,9);
 for(const [type,points] of Object.entries(TANK_POINTS)){const g=new TankGame(42);g.start();const enemy=g.tanks[1];enemy.type=type;g.kill(enemy);g.kill(enemy);assert.equal(g.score,points);g.kill(g.player);assert.equal(g.score,points);g.retry();assert.equal(g.score,0);}
});
test('representative tank and space runs land near ten thousand',()=>{
 const points=levels=>LEVELS.slice(0,levels).flatMap(l=>l.enemies).reduce((sum,e)=>sum+TANK_POINTS[e[2]],0);
 assert.equal(points(8),8900);assert.equal(points(9),11100);
 const m=new Mission(42,'medium');m.start();m.state='won';m.score=15400;m.kills=4;m.time=720;assert.equal(scoreSummary(m).total,10500);
 m.start('easy');m.state='won';m.score=15000;m.time=600;assert.equal(scoreSummary(m).total,10500);
});
test('new score boards preserve old records without mixing scoring scales',()=>{
 const data=new Map([['space-flight-highscores-v1','old space'],['tanks-highscores-v1','old tanks']]);const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.deepEqual(readScores(storage),[]);assert.deepEqual(readTankScores(storage),[]);
 assert(saveScore(storage,{initials:'NEW',score:10500,time:720,pacifist:false,difficulty:'medium'}).ok);
 assert(saveTankScore(storage,{initials:'NEW',score:11100,mission:9,complete:false}).ok);
 assert.equal(readScores(storage)[0].score,10500);assert.equal(readTankScores(storage)[0].score,11100);
 assert.equal(data.get('space-flight-highscores-v1'),'old space');assert.equal(data.get('tanks-highscores-v1'),'old tanks');
});
