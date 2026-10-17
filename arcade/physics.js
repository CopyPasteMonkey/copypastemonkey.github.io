import {getDifficulty} from './difficulty.js';
export const TAU=Math.PI*2;
export const LANDING_SPEED=65;
export const RESCUE_SECONDS=30;
export const GRAVITY_POWER=1.6;
export const SUN={x:0,y:0,r:140,mu:24_480_000};
export const PLANETS=[
 {id:'ember',name:'EMBER',orbit:650,r:54,phase:-2.15,tech:'Fusion drive',fleet:'fast',glyph:'↯',crew:3},
 {id:'vesper',name:'VESPER',orbit:1050,r:73,phase:2.2,tech:null,fleet:null,glyph:'○',crew:0},
 {id:'home',name:'HOME',orbit:1450,r:94,phase:1.76,tech:null,fleet:null,glyph:'⌂',crew:0},
 {id:'rust',name:'RUST',orbit:2050,r:83,phase:.25,tech:'Radiation shield',fleet:'shield',glyph:'◇',crew:3},
 {id:'frost',name:'FROST',orbit:2700,r:106,phase:3.05,tech:'Stellar navigation',fleet:'smart',glyph:'⌖',crew:3}
];
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
export function orbitPosition(p,t){const w=Math.sqrt(gravityStrength(SUN,p.orbit)/p.orbit),a=p.phase+w*t;return {x:Math.cos(a)*p.orbit,y:Math.sin(a)*p.orbit,vx:-Math.sin(a)*p.orbit*w,vy:Math.cos(a)*p.orbit*w,angle:a};}
function rng(seed){let a=seed>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};}
// Keep the previous pull at HOME's orbit and at each planet's surface,
// but let it decline as 1/r^1.6 instead of 1/r^2.
export function gravityStrength(body,d){
 const reference=body===SUN?1450:body.r;
 return body.mu/reference**2*(reference/Math.max(d,body.r*.85))**GRAVITY_POWER;
}
export function gravityAt(point,planets,local=true){
 let x=0,y=0;
 const add=(body,scale=1)=>{const dx=body.x-point.x,dy=body.y-point.y,d=Math.hypot(dx,dy),a=gravityStrength(body,d)*scale;x+=dx/Math.max(d,1)*a;y+=dy/Math.max(d,1)*a;};
 add(SUN);
 if(local)for(const p of planets){const altitude=distance(point,p)-p.r;if(altitude<580){const t=clamp((altitude-350)/230,0,1);add(p,1-t*t*(3-2*t));}}
 return {x,y};
}
export function coastStep(s,planets,dt){
 const g=gravityAt(s,planets);s.vx+=g.x*dt;s.vy+=g.y*dt;
}
export function moveShip(s,dt){
 const speed=Math.hypot(s.vx,s.vy);if(speed>620){s.vx*=620/speed;s.vy*=620/speed;}
 s.x+=s.vx*dt;s.y+=s.vy*dt;
}
export function boundaryPull(s,dt){if(Math.hypot(s.x,s.y)>4800){const a=Math.atan2(s.y,s.x);s.vx-=Math.cos(a)*130*dt;s.vy-=Math.sin(a)*130*dt;}}
// Same fixed step, moving planets, gravity, and speed cap as actual coasting.
// Stop at first surface encounter; combat and future player inputs are unknowable.
export function predictTrajectory(mission,seconds=60){
 const s={...mission.ship},points=[{x:s.x,y:s.y,t:mission.time}],planets=mission.planets.map(p=>({...p})),dt=1/120;
 let t=mission.time,impact=null,travel=0,previousAngle=Math.atan2(s.y,s.x);
 for(let i=0;i<Math.round(seconds/dt);i++){
  t+=dt;for(const p of planets)Object.assign(p,orbitPosition(p,t));
  if(s.docked){const p=planets.find(p=>p.id===s.docked);s.x=p.x+Math.cos(s.dockAngle)*(p.r+s.r+1);s.y=p.y+Math.sin(s.dockAngle)*(p.r+s.r+1);}
  else{coastStep(s,planets,dt);moveShip(s,dt);
   const hit=planets.find(p=>distance(s,p)<p.r+s.r);
   if(Math.hypot(s.x,s.y)<SUN.r+s.r)impact='sun';else if(hit)impact=hit.id;else if(Math.hypot(s.x,s.y)>6500)impact='boundary';
   if(impact){points.push({x:s.x,y:s.y,t});break;}
   boundaryPull(s,dt);
  }
  const angle=Math.atan2(s.y,s.x);travel+=angleDelta(angle,previousAngle);previousAngle=angle;
  if(Math.abs(travel)>=TAU){points.push({x:s.x,y:s.y,t});break;}
  if(i%24===23)points.push({x:s.x,y:s.y,t});
 }
 return {points,impact,end:{x:s.x,y:s.y,vx:s.vx,vy:s.vy},time:t};
}
export function shieldBlocks(enemy,point){return enemy.shield&&Math.abs(angleDelta(Math.atan2(point.y-enemy.y,point.x-enemy.x),enemy.a))<=Math.PI/3;}
export const SPACE_POINTS=Object.freeze({pickup:1000,delivery:4000,enemy:100,pacifist:6000,timeScale:600});
export function scoreSummary(mission){
 const pacifist=mission.state==='won'&&mission.kills===0?SPACE_POINTS.pacifist:0;
 const multiplier=1/(1+mission.scoringTime/SPACE_POINTS.timeScale);
 const difficultyMultiplier=mission.difficulty.scoreMultiplier;
 return {points:mission.score,pacifist,multiplier,difficultyMultiplier,total:Math.round((mission.score+pacifist)*multiplier*difficultyMultiplier)};
}
export class Mission{
 constructor(seed=42,difficulty='medium'){this.seed=seed;this.difficulty=getDifficulty(difficulty);this.reset();}
 reset(){
  this.random=rng(this.seed);this.state='ready';this.time=0;this.score=0;this.kills=0;this.rescues=0;this.rescueTime=0;this.events=[];this.particles=[];this.shots=[];this.enemies=[];this.rocks=[];this.target='ember';this.shotId=0;
  this.planets=PLANETS.map(p=>({...p,...orbitPosition(p,0),mu:p.r*p.r*115,flag:p.tech?'available':null,claimed:false,respawn:0}));
  this.ship={x:0,y:0,vx:0,vy:0,a:-Math.PI/2,r:11,hull:3,cargo:null,docked:'home',dockAngle:-Math.PI/2,dockTime:0,launchArmed:true,invulnerable:3,fireCooldown:0,launchGrace:0,engine:false,trail:[],damageFlash:0};
  this.followDock();
  for(let i=0;i<58;i++)this.spawnRock(i);
  for(const p of this.planets.filter(p=>p.fleet))for(let i=0;i<p.crew;i++)this.spawnEnemy(p,i);
 }
 start(difficulty=this.difficulty.id){this.difficulty=getDifficulty(difficulty);this.reset();this.state='playing';}
 get scoringTime(){return this.time+this.rescueTime;}
 get home(){return this.planets.find(p=>p.id==='home');}
 get delivered(){return this.planets.filter(p=>p.flag==='delivered').length;}
 get targetBody(){return this.planets.find(p=>p.id===(this.ship.cargo?'home':this.target))||this.home;}
 nearest(point=this.ship){let best=null,gap=Infinity;for(const p of this.planets){const d=distance(point,p)-p.r;if(d<gap){best=p;gap=d;}}return {planet:best,gap};}
 relativeSpeed(p){return Math.hypot(this.ship.vx-p.vx,this.ship.vy-p.vy);}
 selectTarget(id){if(this.ship.cargo)return;const p=this.planets.find(p=>p.id===id);if(p&&p.flag!=='delivered')this.target=id;}
 cycleTarget(){const options=this.planets.filter(p=>p.tech&&p.flag!=='delivered');if(!options.length||this.ship.cargo)return;const i=options.findIndex(p=>p.id===this.target);this.target=options[(i+1)%options.length].id;}
 emit(message){this.events.push(message);}
 takeEvents(){return this.events.splice(0);}
 gravity(point,local=true){return gravityAt(point,this.planets,local);}
 followDock(){const s=this.ship,p=this.planets.find(p=>p.id===s.docked);if(!p)return;s.x=p.x+Math.cos(s.dockAngle)*(p.r+s.r+1);s.y=p.y+Math.sin(s.dockAngle)*(p.r+s.r+1);s.vx=p.vx;s.vy=p.vy;s.a=s.dockAngle;}
 burst(x,y,count=16,red=false,scale=1){for(let i=0;i<count;i++){const a=this.random()*TAU,v=(20+this.random()*105)*scale;this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:.4+this.random()*.65,max:1,red});}if(this.particles.length>450)this.particles.splice(0,this.particles.length-450);}
 spawnRock(i=0){const bands=[830,1230,1770,2400,3100],radius=bands[i%bands.length]+(this.random()-.5)*200,a=this.random()*TAU,speed=Math.sqrt(gravityStrength(SUN,radius)*radius)*(0.96+this.random()*.08),r=13+this.random()*22;const rock={x:Math.cos(a)*radius,y:Math.sin(a)*radius,vx:-Math.sin(a)*speed,vy:Math.cos(a)*speed,r,a:this.random()*TAU,spin:(this.random()-.5)*.8,points:Array.from({length:9},()=>.65+this.random()*.35),dead:false};if(distance(rock,this.home)<this.home.r+280){rock.x*=-1;rock.y*=-1;rock.vx*=-1;rock.vy*=-1;}this.rocks.push(rock);return rock;}
 spawnEnemy(p,slot){const a=slot*TAU/p.crew+.4,rad=p.r+230;this.enemies.push({x:p.x+Math.cos(a)*rad,y:p.y+Math.sin(a)*rad,vx:p.vx,vy:p.vy,r:p.fleet==='shield'?19:15,a,slot,home:p.id,type:p.fleet,hp:p.fleet==='shield'?3:2,maxHp:p.fleet==='shield'?3:2,cooldown:(2+slot*.9)*this.difficulty.fireInterval,age:slot,shield:p.fleet==='shield',dead:false,alert:false,aim:null,phase:this.random()*TAU});}
 fire(x,y,a,vx,vy,alien=false,smart=false){const speed=alien?(smart?260:200)*this.difficulty.shotSpeed:650;this.shots.push({id:++this.shotId,x:x+Math.cos(a)*17,y:y+Math.sin(a)*17,vx:vx+Math.cos(a)*speed,vy:vy+Math.sin(a)*speed,life:alien?3.6:1.55,alien,dead:false});}
 damage(message,amount=1){const s=this.ship;if(s.invulnerable>0||s.docked)return false;s.hull-=amount;s.invulnerable=this.difficulty.damageProtection;s.damageFlash=.35;this.burst(s.x,s.y,13,true);if(s.hull<=0)this.rescue(message);else this.emit(message+' — '+s.hull+' hull remaining.');return true;}
 rescue(reason){const s=this.ship;if(s.cargo){const p=this.planets.find(p=>p.id===s.cargo);p.flag='available';s.cargo=null;}this.burst(s.x,s.y,32,true,1.8);this.rescues++;this.rescueTime+=RESCUE_SECONDS;s.hull=3;s.docked='home';s.dockAngle=-Math.PI/2;s.dockTime=0;s.launchArmed=false;s.invulnerable=4;s.launchGrace=0;s.trail=[];this.followDock();this.emit(reason+' Rescued home (+30s). Cargo returned to its planet.');}
 land(p){const s=this.ship;s.docked=p.id;s.dockAngle=Math.atan2(s.y-p.y,s.x-p.x);s.dockTime=0;s.launchArmed=false;s.engine=false;s.trail=[];this.followDock();this.burst(s.x,s.y,6);if(p.id==='home'){s.hull=3;if(s.cargo){const source=this.planets.find(x=>x.id===s.cargo);source.flag='delivered';this.score+=SPACE_POINTS.delivery;s.cargo=null;this.emit(source.tech+' delivered. Hull repaired.');if(this.delivered===this.planets.filter(p=>p.tech).length){this.state='won';this.emit('All three technologies delivered. Interstellar systems online.');}else{const next=this.planets.filter(x=>x.flag==='available').sort((a,b)=>distance(a,p)-distance(b,p))[0];if(next)this.target=next.id;}}else this.emit('Home docking confirmed. Hull repaired.');}else if(s.cargo)this.emit('Cargo hold full. Return your technology home.');else if(p.flag==='available')this.emit('Gentle landing confirmed. Securing '+p.tech.toLowerCase()+'…');else this.emit(p.tech?'Technology already delivered. Press ↑ to launch.':'Safe landing. Press ↑ to launch.');}
 updateDock(dt,input){const s=this.ship,p=this.planets.find(p=>p.id===s.docked);s.dockTime+=dt;this.followDock();if(!input.thrust)s.launchArmed=true;if(p.flag==='available'&&!s.cargo&&s.dockTime>.75){s.cargo=p.id;p.flag='carried';if(!p.claimed){p.claimed=true;this.score+=SPACE_POINTS.pickup;}this.emit(p.tech+' secured. Return HOME to bank it.');this.burst(s.x,s.y,15,true,.6);}if(input.thrust&&s.launchArmed&&s.dockTime>.3){const nx=Math.cos(s.dockAngle),ny=Math.sin(s.dockAngle);s.docked=null;s.x+=nx*7;s.y+=ny*7;s.vx=p.vx+nx*18;s.vy=p.vy+ny*18;s.launchGrace=1;s.invulnerable=Math.max(s.invulnerable,this.difficulty.launchProtection);s.engine=true;}}
 updateShip(dt,input){const s=this.ship;s.invulnerable=Math.max(0,s.invulnerable-dt);s.damageFlash=Math.max(0,s.damageFlash-dt);s.fireCooldown=Math.max(0,s.fireCooldown-dt);s.launchGrace=Math.max(0,s.launchGrace-dt);s.engine=false;if(s.docked){this.updateDock(dt,input);return;}s.a+=((input.right?1:0)-(input.left?1:0))*3.25*dt;coastStep(s,this.planets,dt);
  if(input.thrust){s.vx+=Math.cos(s.a)*170*dt;s.vy+=Math.sin(s.a)*170*dt;s.engine=true;}
  if(input.brake){const {planet,gap}=this.nearest(),reference=gap<520?planet:{vx:0,vy:0},drag=Math.exp(-(gap<520?this.difficulty.landingBrake:2.3)*dt);s.vx=reference.vx+(s.vx-reference.vx)*drag;s.vy=reference.vy+(s.vy-reference.vy)*drag;}
  moveShip(s,dt);
  if(input.fire&&s.fireCooldown===0){this.fire(s.x,s.y,s.a,s.vx,s.vy);s.fireCooldown=.18;}
  if(Math.hypot(s.x,s.y)<SUN.r+s.r){this.rescue('Solar collision.');return;}
  for(const p of this.planets){const d=distance(s,p);if(d<p.r+s.r){if(this.relativeSpeed(p)<=this.difficulty.landingSpeed&&s.launchGrace===0){this.land(p);return;}const nx=(s.x-p.x)/Math.max(d,1),ny=(s.y-p.y)/Math.max(d,1);s.x=p.x+nx*(p.r+s.r+2);s.y=p.y+ny*(p.r+s.r+2);const rvx=s.vx-p.vx,rvy=s.vy-p.vy,normal=rvx*nx+rvy*ny;s.vx=p.vx+rvx-1.6*Math.min(0,normal)*nx;s.vy=p.vy+rvy-1.6*Math.min(0,normal)*ny;if(s.launchGrace===0)this.damage('Hard landing. Match the planet’s velocity with ↓');if(s.docked)return;}}
  boundaryPull(s,dt);if(Math.hypot(s.x,s.y)>6500)this.rescue('Beyond recovery range.');
  if(!s.trail.length||distance(s,s.trail.at(-1))>16)s.trail.push({x:s.x,y:s.y});if(s.trail.length>38)s.trail.shift();
 }
 updateEnemies(dt){const s=this.ship;for(const e of this.enemies){if(e.dead)continue;if(Math.hypot(e.x,e.y)<=SUN.r+e.r){e.dead=true;continue;}const p=this.planets.find(p=>p.id===e.home);e.age+=dt;e.cooldown-=dt;e.shield=e.type==='shield';const ds=distance(e,s),nearHome=distance(s,this.home)<this.home.r+340;const homeDistance=distance(e,p);if(homeDistance>p.r+400)e.returning=true;else if(homeDistance<p.r+260)e.returning=false;e.alert=!e.returning&&!s.docked&&!nearHome&&distance(s,p)<p.r+450&&p.flag!=='delivered';
   let tx,ty,baseVx=p.vx,baseVy=p.vy,maxSpeed=e.type==='fast'?205:e.type==='smart'?130:100;
   if(e.alert){if(e.type==='smart'){const look=Math.min(1.7,ds/330),side=(e.slot-1)*140,baseAngle=Math.atan2(s.y-p.y,s.x-p.x);tx=s.x+s.vx*look+Math.cos(baseAngle+Math.PI/2)*side;ty=s.y+s.vy*look+Math.sin(baseAngle+Math.PI/2)*side;}else{tx=s.x;ty=s.y;}if(e.type==='fast')maxSpeed=((e.age+e.phase)%3.7)<1.1?300:150;}
   else {const a=e.phase+this.time*.16+e.slot*TAU/3,rad=p.r+220;tx=p.x+Math.cos(a)*rad;ty=p.y+Math.sin(a)*rad;maxSpeed=85;}
   if(e.alert&&ds<180){const away=Math.atan2(e.y-s.y,e.x-s.x);tx=s.x+Math.cos(away)*180;ty=s.y+Math.sin(away)*180;}const targetDistance=Math.hypot(tx-p.x,ty-p.y),patrolLimit=p.r+300;if(targetDistance>patrolLimit){tx=p.x+(tx-p.x)*patrolLimit/targetDistance;ty=p.y+(ty-p.y)*patrolLimit/targetDistance;}const dx=tx-e.x,dy=ty-e.y,d=Math.hypot(dx,dy),desired=Math.min(maxSpeed,d*1.2),turn=e.type==='fast'?1.2:1.8,g=this.gravity(e);e.vx+=g.x*dt;e.vy+=g.y*dt;const targetVx=baseVx+dx/Math.max(1,d)*desired,targetVy=baseVy+dy/Math.max(1,d)*desired,blend=1-Math.exp(-turn*dt);e.vx+=(targetVx-e.vx)*blend;e.vy+=(targetVy-e.vy)*blend;const heading=e.alert?Math.atan2(s.y-e.y,s.x-e.x):Math.atan2(e.vy-p.vy,e.vx-p.vx);e.a+=clamp(angleDelta(heading,e.a),-1.5*dt,1.5*dt);e.x+=e.vx*dt;e.y+=e.vy*dt;if(Math.hypot(e.x,e.y)<=SUN.r+e.r){e.dead=true;this.burst(e.x,e.y,8,true);continue;}
   const pd=distance(e,p);if(pd>p.r+470){const nx=(e.x-p.x)/pd,ny=(e.y-p.y)/pd;e.x=p.x+nx*(p.r+470);e.y=p.y+ny*(p.r+470);const outward=Math.max(0,(e.vx-p.vx)*nx+(e.vy-p.vy)*ny);e.vx-=outward*nx;e.vy-=outward*ny;e.returning=true;e.alert=false;}if(pd<p.r+42){const a=Math.atan2(e.y-p.y,e.x-p.x);e.x=p.x+Math.cos(a)*(p.r+43);e.y=p.y+Math.sin(a)*(p.r+43);}
   e.aim=null;if(e.alert&&ds<680){const lead=e.type==='smart'?Math.min(1.6,ds/330):0;const aim={x:s.x+(s.vx-e.vx)*lead,y:s.y+(s.vy-e.vy)*lead};if(e.type==='smart'&&e.cooldown<.75)e.aim=aim;if(e.cooldown<=0){const angle=Math.atan2(aim.y-e.y,aim.x-e.x);this.fire(e.x,e.y,angle,e.vx,e.vy,true,e.type==='smart');e.cooldown=((e.type==='smart'?3.6:e.type==='fast'?3.8:4.4)+this.random()*.8)*this.difficulty.fireInterval;}}
   if(e.alert&&distance(e,s)<e.r+s.r){const contact={x:s.x,y:s.y,vx:s.vx,vy:s.vy},a=Math.atan2(e.y-s.y,e.x-s.x),nx=Math.cos(a),ny=Math.sin(a);this.damage('Alien collision');e.x=contact.x+nx*(e.r+s.r+5);e.y=contact.y+ny*(e.r+s.r+5);e.vx=contact.vx+nx*65;e.vy=contact.vy+ny*65;}
  }
  this.enemies=this.enemies.filter(e=>!e.dead);for(const p of this.planets.filter(p=>p.fleet)){if(p.flag==='delivered')continue;if(this.enemies.filter(e=>e.home===p.id).length<p.crew){p.respawn+=dt;if(p.respawn>22){const used=new Set(this.enemies.filter(e=>e.home===p.id).map(e=>e.slot));this.spawnEnemy(p,[0,1,2].find(i=>!used.has(i)));p.respawn=0;}}else p.respawn=0;}
 }
 updateRocks(dt){for(const r of this.rocks){if(r.dead)continue;const g=this.gravity(r,false);r.vx+=g.x*dt;r.vy+=g.y*dt;r.x+=r.vx*dt;r.y+=r.vy*dt;r.a+=r.spin*dt;if(Math.hypot(r.x,r.y)<SUN.r+r.r||this.planets.some(p=>distance(r,p)<p.r+r.r)){r.dead=true;this.burst(r.x,r.y,5);continue;}if(!this.ship.docked&&distance(r,this.ship)<r.r+this.ship.r){if(this.damage('Asteroid impact')){r.dead=true;this.burst(r.x,r.y,14);}}}this.rocks=this.rocks.filter(r=>!r.dead);}
 updateShots(dt){for(const b of this.shots){b.life-=dt;const g=this.gravity(b,false);b.vx+=g.x*dt;b.vy+=g.y*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.life<=0||Math.hypot(b.x,b.y)<SUN.r||this.planets.some(p=>distance(b,p)<p.r)){b.dead=true;continue;}if(b.alien){if(!this.ship.docked&&distance(b,this.ship)<this.ship.r+4){this.damage('Alien fire');b.dead=true;}}
   else{for(const e of this.enemies){const blocked=shieldBlocks(e,b);if(e.dead||distance(b,e)>e.r+(blocked?10:3))continue;b.dead=true;if(blocked){this.burst(b.x,b.y,4,true,.3);}else{e.hp--;this.burst(b.x,b.y,4,true,.4);if(e.hp<=0){e.dead=true;this.kills++;this.score+=SPACE_POINTS.enemy;this.burst(e.x,e.y,20,true);}}break;}
    if(!b.dead)for(const r of this.rocks){if(r.dead||distance(b,r)>r.r)continue;r.dead=true;b.dead=true;this.burst(r.x,r.y,10);if(r.r>25){for(const side of [-1,1]){const a=Math.atan2(r.vy,r.vx)+side*.7;this.rocks.push({...r,dead:false,r:r.r*.5,x:r.x+Math.cos(a)*r.r,y:r.y+Math.sin(a)*r.r,vx:r.vx+Math.cos(a)*45,vy:r.vy+Math.sin(a)*45,points:[...r.points]});}}break;}
   }
  }this.shots=this.shots.filter(b=>!b.dead);if(this.shots.length>180)this.shots.splice(0,this.shots.length-180);
 }
 step(dt,input={}){if(this.state!=='playing')return;dt=clamp(dt,0,.05);this.time+=dt;for(const p of this.planets)Object.assign(p,orbitPosition(p,this.time));this.updateShip(dt,input);if(this.state==='playing'){this.updateEnemies(dt);this.updateRocks(dt);this.updateShots(dt);}for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}this.particles=this.particles.filter(p=>p.life>0);}
}
