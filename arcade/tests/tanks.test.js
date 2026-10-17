import test from 'node:test';
import assert from 'node:assert/strict';
import {TankGame,LEVELS,R,W,H,PLAYER_SPEED,traceShot,SHELL_SPEED,TYPES} from '../tanks-physics.js';
const advance=(g,seconds,input={})=>{for(let i=0;i<seconds*120;i++)g.step(1/120,input);};
test('all 100 missions spawn tanks clear of cover and each other',()=>{const g=new TankGame();for(let i=0;i<LEVELS.length;i++){g.level=i;g.load();for(const t of g.tanks)assert(g.free(t.x,t.y,R,t),`field ${i+1} tank ${t.id}`);}});
test('WASD movement slides along cover and cannot cross arena boundary',()=>{const g=new TankGame();g.tanks=[g.player];g.walls=[{x:200,y:100,w:60,h:440}];g.start();g.tanks.push({id:9,alive:true,x:900,y:500,type:'sentry',cool:100,mineCool:0,aim:0});advance(g,2,{x:1});assert(g.player.x<=183);advance(g,4,{x:-1});assert(g.player.x>=29);});
test('shell bounces once, then is removed at next wall',()=>{const g=new TankGame();g.walls=[];g.start();g.player.cool=0;g.player.aim=-Math.PI/2;assert(g.shoot(g.player));const s=g.shots[0];g.tanks.slice(1).forEach(t=>t.cool=100);advance(g,1.1);assert(s.vy>0);assert.equal(s.bounces,0);advance(g,2.2);assert(!g.shots.includes(s));});
test('mine arms, destroys nearby tanks and marked cover, and costs a life',()=>{const g=new TankGame();g.start();g.walls=[{x:180,y:300,w:25,h:40,soft:true}];assert(g.mine());advance(g,1);assert.equal(g.state,'playing');assert(g.mines[0].warning>0);advance(g,.65);assert.equal(g.state,'dead');assert.equal(g.lives,2);assert.equal(g.walls.length,0);});
test('mines can be escaped and maximum two are active',()=>{const g=new TankGame();g.start();g.tanks.slice(1).forEach(t=>t.cool=100);g.mine();advance(g,.7,{x:1});assert(g.mine());advance(g,.7,{y:-1});assert(!g.mine());assert.equal(g.state,'playing');});
test('clearing a field advances, retry resets partial score, last field wins',()=>{const g=new TankGame();g.start();g.kill(g.tanks[1]);g.kill(g.player);assert.equal(g.score,200);g.retry();assert.equal(g.score,0);for(const t of g.tanks.slice(1))g.kill(t);g.step(1/120);assert.equal(g.state,'clear');g.next();assert.equal(g.level,1);assert.equal(g.state,'playing');g.level=99;g.load();g.start();for(const t of g.tanks.slice(1))g.kill(t);g.step(1/120);assert.equal(g.state,'won');});
test('paused simulation does not advance',()=>{const g=new TankGame();const x=g.player.x;g.state='paused';advance(g,2,{x:1,fire:true});assert.equal(g.player.x,x);assert.equal(g.time,0);assert.equal(g.shots.length,0);});
test('tracks pivot before driving and reverse without spinning around',()=>{const g=new TankGame(),p=g.player,y=p.y;g.move(p,0,-1,1/120);assert.equal(p.y,y);assert(p.angle<0);for(let i=0;i<30;i++)g.move(p,0,-1,1/120);assert(p.y<y);p.angle=0;const x=p.x;g.move(p,-1,0,1/120);assert(Math.abs(p.angle)<1e-8);assert(p.x<x);});
test('a shot briefly stops movement; five live shells exhaust the magazine',()=>{const g=new TankGame(),p=g.player;g.start();const x=p.x;g.step(1/120,{x:1,fire:true,aim:0});assert.equal(p.x,x);assert.equal(g.shots.length,1);g.walls=[];g.shots=[];for(let i=0;i<5;i++){p.cool=0;assert(g.shoot(p));}p.cool=0;assert(!g.shoot(p));g.shots.pop();assert(g.shoot(p));});
test('bank-shot planner reaches a target behind cover using the live projectile geometry',()=>{const g=new TankGame();g.start();const t=g.tanks[1];t.type='sniper';t.x=800;t.y=320;t.cool=100;g.player.x=140;g.player.y=320;assert(!g.clearLine(t,g.player));const plan=g.shotPlan(t);assert(plan);assert(plan.bounce>0);t.aim=plan.angle;t.cool=0;assert(g.shoot(t));t.cool=100;for(let i=0;i<1200&&g.player.alive;i++){g.step(1/120);t.cool=100;}assert(!g.player.alive);});
test('pits stop tracks but allow shells across',()=>{const g=new TankGame();g.start();g.walls=[];g.pits=[{x:190,y:250,w:50,h:140}];g.tanks[1].cool=100;advance(g,1,{x:1});assert(g.player.x<190-R);g.player.aim=0;g.player.cool=0;g.shoot(g.player);const shot=g.shots[0];advance(g,.5);assert(shot.x>240);});
test('rocket shells do not bounce, mine layers deploy mines, snipers use two rebounds',()=>{assert.equal(TYPES.rocket.bounces,0);assert(TYPES.rocket.shot>SHELL_SPEED);assert.equal(TYPES.sniper.bounces,2);const g=new TankGame();g.level=7;g.load();g.start();const miner=g.tanks.find(t=>t.type==='miner');miner.mineCool=0;assert(g.mine(miner));assert.equal(g.mines[0].owner,miner.id);});
test('mine chain reaction breaks nearby marked cover but leaves solid walls',()=>{const g=new TankGame();g.start();g.walls=[{x:700,y:100,w:40,h:40,soft:true},{x:700,y:150,w:40,h:40}];g.mines=[{x:650,y:100,alive:true},{x:730,y:100,alive:true}];g.explode(g.mines[0]);assert(g.mines.every(m=>!m.alive));assert.equal(g.walls.length,1);assert(!g.walls[0].soft);});
test('a bonus tank is awarded after five completed fields',()=>{const g=new TankGame();g.level=4;g.state='clear';g.next();assert.equal(g.level,5);assert.equal(g.lives,4);});
test('shared trajectory keeps reflected angle and ends at the next wall',()=>{const path=traceShot(100,100,-Math.PI/4,[],1);assert.equal(path.length,2);const first=path[0],second=path[1];assert(Math.abs(first.ey-16)<1e-8);assert(second.ex>second.x&&second.ey>second.y);assert(Math.abs((second.ex-second.x)-(second.ey-second.y))<1e-7);});
test('advanced evasive tanks move away from an approaching shell path',()=>{const g=new TankGame();g.walls=[];const t=g.tanks[1];t.type='elite';t.x=500;t.y=300;t.angle=-Math.PI/2;t.cool=100;g.shots=[{x:450,y:320,vx:SHELL_SPEED,vy:0,owner:0,alive:true}];g.enemy(t,1/120);assert(t.y<300);});
test('the full campaign follows the original fixed and randomized mission ranges',async()=>{const {createCampaign,MISSIONS,MAPS}=await import('../tanks-levels.js');assert.equal(MISSIONS.length,100);assert.equal(MAPS.length,30);const counts=[1,1,3,4,2,4,4,5,6,2,6,4,6,6,3,5,6,6,8,2];for(let seed=1;seed<=20;seed++){const g=new TankGame(seed);for(let i=0;i<100;i++){const l=g.levels[i],spec=MISSIONS[i];assert(l.layout>=spec[0]&&l.layout<=spec[1]);assert.equal(l.enemies.length,spec.slice(2).filter(Boolean).length);g.level=i;g.load();for(const t of g.tanks)assert(g.free(t.x,t.y,R,t),`seed ${seed}, mission ${i+1}, tank ${t.id}`);}assert.deepEqual(g.levels.slice(0,20).map(l=>l.enemies.length),counts);}assert.deepEqual(createCampaign(42),createCampaign(42));assert.notDeepEqual(createCampaign(42).slice(20),createCampaign(43).slice(20));});
test('retrying a randomized mission preserves its layout and enemy choices',()=>{const g=new TankGame(99);g.level=34;g.load();const before=JSON.stringify({layout:g.layout,enemies:g.tanks.slice(1).map(t=>[t.x,t.y,t.type])});g.start();g.kill(g.player);g.retry();assert.equal(JSON.stringify({layout:g.layout,enemies:g.tanks.slice(1).map(t=>[t.x,t.y,t.type])}),before);});

test('top-down grid has square tiles and equal travel speed in every direction',()=>{
 assert(Math.abs((W-24)/22-(H-24)/17)<1e-9);
 const travel=[];
 for(const [x,y] of [[1,0],[0,1],[Math.SQRT1_2,Math.SQRT1_2]]){
  const g=new TankGame(7);g.walls=[];g.pits=[];g.enemy=()=>{};g.start();
  Object.assign(g.player,{x:300,y:300,angle:Math.atan2(y,x)});
  advance(g,1.5,{x,y});travel.push(Math.hypot(g.player.x-300,g.player.y-300));
 }
 for(const distance of travel)assert(Math.abs(distance-204)<.01);
 // Reference player: about 220 pixels / 48 pixels per tile over 1.5 s.
 assert(Math.abs(travel[0]/((W-24)/22)-220/48)<.08);
});
test('ordinary shell displacement matches the measured reference interval',()=>{
 const g=new TankGame(7);g.walls=[];g.pits=[];g.enemy=()=>{};g.start();
 // Original footage: shell tip (387,411) -> (443,427) over .25 seconds.
 // Undo the camera projection using 48px columns and ~32px rows.
 const tileX=56/48,tileY=16/32;
 Object.assign(g.player,{x:300,y:300,aim:Math.atan2(tileY,tileX)});
 assert(g.shoot(g.player));const shot=g.shots[0],start={x:shot.x,y:shot.y};advance(g,.25);
 const tile=(W-24)/22;
 assert(Math.abs((shot.x-start.x)/tile-tileX)<.03);
 assert(Math.abs((shot.y-start.y)/tile-tileY)<.03);
});
test('patrol routes are reproducible across retries and do not target the player',()=>{
 const g=new TankGame(42);g.level=1;g.load();g.start();const t=g.tanks[1];
 g.enemy(t,1/120);assert(t.roamGoal);assert(Math.hypot(t.roamGoal.x-g.player.x,t.roamGoal.y-g.player.y)>R);
 const goal={...t.roamGoal};g.retry();g.enemy(g.tanks[1],1/120);assert.deepEqual(g.tanks[1].roamGoal,goal);
});

test('enemies settle on a new shot instead of firing on the acquisition frame',()=>{
 const g=new TankGame(12);g.start();g.walls=[];g.pits=[];
 const t=g.tanks[1];Object.assign(t,{x:800,y:300,type:'sentry',aim:Math.PI,cool:0,plan:null,planTimer:0,aimReady:0});Object.assign(g.player,{x:200,y:300});
 g.enemy(t,1/120);assert.equal(g.shots.length,0);
 for(let i=0;i<10;i++)g.enemy(t,1/120);assert.equal(g.shots.length,0);
 for(let i=0;i<10;i++)g.enemy(t,1/120);assert.equal(g.shots.length,1);
 t.cool=0;t.planTimer=0;g.shots=[];g.shotPlan=()=>null;g.enemy(t,1/120);assert.equal(t.aimReady,0);assert.equal(g.shots.length,0);
});
test('sentry cadence varies within reference-paced bounds and repeats for the same seed',()=>{
 function timeline(seed){
  const g=new TankGame(seed);g.start();g.walls=[];g.pits=[];g.kill=()=>{};Object.assign(g.player,{x:200,y:300});Object.assign(g.tanks[1],{x:800,y:300,aim:Math.PI});
  const times=[],shoot=g.shoot.bind(g);g.shoot=t=>{const fired=shoot(t);if(fired)times.push(g.time);return fired;};
  for(let i=0;i<1800;i++){g.step(1/120);g.shots=[];}return times;
 }
 const times=timeline(16);assert(times[0]>=.35&&times[0]<=1.1);assert(times.length>=5);
 const gaps=times.slice(1).map((t,i)=>t-times[i]);for(const gap of gaps)assert(gap>=2.1&&gap<3.02);
 assert(new Set(gaps.map(x=>x.toFixed(2))).size>2);assert.deepEqual(times,timeline(16));assert.notDeepEqual(times,timeline(17));
});
test('late enemy slots do not receive an artificial multi-second opening delay',()=>{
 const g=new TankGame(22);g.level=99;g.load();assert(g.tanks.length>5);
 for(const t of g.tanks.slice(1))assert(t.cool>=.25&&t.cool<=1.2);
 const before=g.tanks.slice(1).map(t=>[t.cool,t.mineCool,t.planTimer]);g.retry();assert.deepEqual(g.tanks.slice(1).map(t=>[t.cool,t.mineCool,t.planTimer]),before);
});
test('mine layers begin laying mines during the first second or so',()=>{
 const g=new TankGame(19);g.level=7;g.load();g.start();const miner=g.tanks.find(t=>t.type==='miner');assert(miner);
 const first=miner.mineCool;assert(first>=.65&&first<=1.4);
 g.walls=[];g.pits=[];g.kill=()=>{};for(const t of g.tanks)t.cool=100;
 advance(g,first+.02);assert(g.mines.some(m=>m.owner===miner.id));
});
test('gray tanks cannot calculate bank shots around cover, advanced tanks still can',()=>{
 const g=new TankGame(4),t=g.tanks[1];t.type='patrol';assert(!g.clearLine(t,g.player));assert.equal(g.shotPlan(t),null);
 t.type='sniper';assert(g.shotPlan(t)?.bounce>0);
});
test('basic tanks do not track the hidden player through walls',()=>{
 const g=new TankGame(4),t=g.tanks[1];Object.assign(t,{type:'patrol',aim:.7,plan:null,planTimer:0});
 g.enemy(t,1/120);assert.equal(t.plan,null);assert.equal(t.aim,.7);
});
test('basic evasion has a reaction interval and ignores occluded shots',()=>{
 const g=new TankGame(4);g.walls=[];g.pits=[];const t=g.tanks[1];Object.assign(t,{type:'patrol',x:500,y:300,aim:Math.PI,angle:-Math.PI/2,cool:100});
 g.shots=[{x:450,y:320,vx:SHELL_SPEED,vy:0,owner:0,alive:true,age:.5,bounces:1}];
 g.enemy(t,1/120);assert(!t.dodgeVector);
 t.dodgeTimer=0;g.enemy(t,1/120);assert(t.dodgeVector?.y<0);
 g.walls=[{x:465,y:270,w:10,h:80}];assert.equal(g.basicDodge(t),null);
 g.walls=[];t.type='rocket';g.shots[0].bounces=0;assert.equal(g.basicDodge(t),null);
});
test('mission one can be cleared by one genuine bottom-boundary ricochet',()=>{
 const g=new TankGame(1);g.start();g.enemy=()=>{};g.player.y=400;
 const target=g.tanks[1],bottom=g.levels[0].playHeight-16;
 // Reflect the target across the boundary; this is a real player shot, not a kill shortcut.
 g.player.aim=Math.atan2(2*bottom-target.y-g.player.y,target.x-g.player.x);
 assert(g.shoot(g.player));const shell=g.shots[0];advance(g,5);
 assert.equal(shell.bounces,0);assert.equal(target.alive,false);assert.equal(g.state,'clear');
 assert(g.levels[0].playHeight<H);assert.equal(g.levels[99].playHeight,H);
});
