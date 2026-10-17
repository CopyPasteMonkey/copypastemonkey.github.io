import {createCampaign,LEVELS,ARENA_WIDTH,ARENA_HEIGHT} from './tanks-levels.js';
export {LEVELS} from './tanks-levels.js';
export const W=ARENA_WIDTH,H=ARENA_HEIGHT,R=17;
// Frame-measured reference: ~3.06 columns/sec for tracks; ~5.1 columns/sec for shells.
export const PLAYER_SPEED=136, SHELL_SPEED=226, MINE_FUSE=9, MINE_WARNING=.75, BLAST_RADIUS=95;
export const TANK_POINTS=Object.freeze({sentry:200,patrol:300,rocket:450,miner:500,hunter:650,warrior:850,sniper:1000,stealth:1200,elite:1500});
export const TYPES={
 sentry:{speed:0,shot:SHELL_SPEED,bounces:1,ammo:1,bank:true},
 patrol:{speed:136,shot:SHELL_SPEED,bounces:1,ammo:1,dodge:true,roam:true},
 rocket:{speed:121,shot:480,bounces:0,ammo:1,dodge:true,roam:true},
 miner:{speed:182,shot:SHELL_SPEED,bounces:1,ammo:1,mines:4,dodge:true},
 hunter:{speed:136,shot:SHELL_SPEED,bounces:1,ammo:5},
 warrior:{speed:170,shot:SHELL_SPEED,bounces:1,ammo:5,mines:2,bank:true,dodge:true},
 stealth:{speed:136,shot:SHELL_SPEED,bounces:1,ammo:5,mines:2,bank:true},
 elite:{speed:225,shot:480,bounces:0,ammo:3,mines:2,dodge:true},
 sniper:{speed:0,shot:440,bounces:2,ammo:2,bank:true}
};
// Observation-based ranges, not recovered original-game constants. Seconds.
export const AI_TIMING={
 sentry:{open:[.35,.85],shot:[2.1,3],scan:[.45,.65],settle:.16},
 patrol:{open:[.65,1.15],shot:[2.1,3],scan:[.55,.85],settle:.28},
 rocket:{open:[.35,.9],shot:[1.9,2.9],scan:[.45,.7],settle:.22},
 miner:{open:[.6,1.2],shot:[2.5,3.5],scan:[.45,.7],settle:.18,mineOpen:[.65,1.4],mine:[1.8,3.2]},
 hunter:{open:[.35,.8],shot:[.25,.4],scan:[.22,.36],settle:.08},
 warrior:{open:[.3,.75],shot:[.24,.38],scan:[.2,.34],settle:.08,mineOpen:[2,3.5],mine:[3,5]},
 stealth:{open:[.4,.9],shot:[.28,.44],scan:[.24,.4],settle:.10,mineOpen:[2.5,4],mine:[3.5,5.5]},
 elite:{open:[.25,.65],shot:[.32,.5],scan:[.16,.28],settle:.06,mineOpen:[1.8,3],mine:[2.5,4]},
 sniper:{open:[.4,1],shot:[1.2,1.9],scan:[.3,.5],settle:.15}
};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const delta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function circleRect(x,y,r,b){return Math.hypot(x-clamp(x,b.x,b.x+b.w),y-clamp(y,b.y,b.y+b.h))<r;}
function turn(a,b,max){return a+clamp(delta(a,b),-max,max);}
function tank(x,y,type,id){return {x,y,type,id,angle:0,aim:id?Math.PI:0,alive:true,cool:0,mineCool:0,hold:0,track:0,nav:0,way:null,planTimer:0,plan:null,aimReady:0,wander:id*1.7};}
// Swept axis-aligned surfaces are shared by ricochets, aim rays, and enemy planning.
export function wallHit(x,y,dx,dy,walls,limit=3000){
 let best={distance:limit,nx:0,ny:0,hit:false};
 function accept(d,nx,ny){if(d>=-.00001&&d<best.distance){best={distance:Math.max(0,d),nx,ny,hit:true};}}
 if(dx<0)accept((16-x)/dx,1,0);if(dx>0)accept((W-16-x)/dx,-1,0);
 if(dy<0)accept((16-y)/dy,0,1);if(dy>0)accept((H-16-y)/dy,0,-1);
 for(const w of walls){
  let near=-Infinity,far=Infinity,nx=0,ny=0,valid=true;
  for(const [p,v,lo,hi,axis] of [[x,dx,w.x-4,w.x+w.w+4,0],[y,dy,w.y-4,w.y+w.h+4,1]]){
   if(Math.abs(v)<1e-10){if(p<lo||p>hi)valid=false;continue;}
   let a=(lo-p)/v,b=(hi-p)/v;const sign=v>0?-1:1;if(a>b)[a,b]=[b,a];
   if(a>near){near=a;nx=axis===0?sign:0;ny=axis===1?sign:0;}far=Math.min(far,b);
  }
  if(valid&&near<=far&&far>=0&&near>=-.00001)accept(near,nx,ny);
 }
 return best;
}
export function traceShot(x,y,angle,walls,bounces=1,maxDistance=2400){
 let dx=Math.cos(angle),dy=Math.sin(angle),left=maxDistance;const segments=[];
 for(let i=0;i<=bounces&&left>0;i++){
  const hit=wallHit(x,y,dx,dy,walls,left),end={x:x+dx*hit.distance,y:y+dy*hit.distance};
  segments.push({x,y,ex:end.x,ey:end.y,length:hit.distance,bounce:i});left-=hit.distance;
  if(!hit.hit)break;if(hit.nx)dx=-dx;if(hit.ny)dy=-dy;x=end.x+dx*.001;y=end.y+dy*.001;
 }return segments;
}
function targetOnRay(segments,target,r=R){let distance=0;for(const s of segments){const dx=s.ex-s.x,dy=s.ey-s.y,l=s.length;if(l<.001)continue;const along=((target.x-s.x)*dx+(target.y-s.y)*dy)/l;if(along>=0&&along<=l&&Math.abs((target.x-s.x)*dy-(target.y-s.y)*dx)/l<r)return{distance:distance+along,bounce:s.bounce};distance+=l;}return null;}
export class TankGame{
 constructor(seed=Date.now()){this.seed=seed>>>0;this.levels=createCampaign(this.seed);this.level=0;this.lives=3;this.score=0;this.time=0;this.state='ready';this.load();}
 load(){const l=this.levels[this.level];this.layout=l.layout;this.grid={cols:l.cols,rows:l.rows};this.walls=l.walls.map(b=>({...b}));this.pits=(l.pits||[]).map(b=>({...b}));this.player=tank(...l.player,'player',0);this.player.mineCool=0;this.tanks=[this.player,...l.enemies.map(([x,y,type],i)=>tank(x,y,type,i+1))];this.shots=[];this.mines=[];this.effects=[];this.tracks=[];this.wrecks=[];this.levelScore=this.score;this.time=0;this.aiSeed=(this.seed^Math.imul(this.level+1,2654435761))>>>0;
  for(const t of this.tanks.slice(1)){const timing=AI_TIMING[t.type];t.cool=this.interval(timing.open);t.mineCool=timing.mineOpen?this.interval(timing.mineOpen):0;t.planTimer=this.interval([0,.15]);}
 }
 start(){this.state='playing';}
 next(){if(this.level===LEVELS.length-1){this.state='won';return;}this.level++;if(this.level%5===0)this.lives++;this.load();this.start();}
 newRun(){this.seed=(this.seed+1)>>>0;this.levels=createCampaign(this.seed);this.level=0;this.lives=3;this.score=0;this.load();this.start();}
 retry(){if(this.lives<=0){this.newRun();return;}this.score=this.levelScore;this.load();this.start();}
 free(x,y,r=R,ignore){return x>=r+12&&x<=W-r-12&&y>=r+12&&y<=H-r-12&&!this.walls.concat(this.pits).some(b=>circleRect(x,y,r,b))&&!this.tanks.some(t=>t!==ignore&&t.alive&&Math.hypot(t.x-x,t.y-y)<r+R);}
 move(t,dx,dy,dt=1/120){
  if(t.hold>0||(!dx&&!dy))return;
  const wanted=Math.atan2(dy,dx);let facing=wanted,reverse=false;
  if(Math.abs(delta(t.angle,wanted))>Math.PI/2){facing=wanted+Math.PI;reverse=true;}
  t.angle=turn(t.angle,facing,dt*7);
  // Pivot before translating: no sliding sideways while the tracks turn.
  if(Math.abs(delta(t.angle,facing))>.07)return;
  const distance=Math.hypot(dx,dy)*(reverse?-1:1),mx=Math.cos(t.angle)*distance,my=Math.sin(t.angle)*distance,ox=t.x,oy=t.y;
  if(this.free(t.x+mx,t.y+my,R,t)){t.x+=mx;t.y+=my;}
  else if(Math.abs(mx)>Math.abs(my)&&this.free(t.x+mx,t.y,R,t))t.x+=mx;
  else if(this.free(t.x,t.y+my,R,t))t.y+=my;
  const d=Math.hypot(t.x-ox,t.y-oy);if(d){t.track+=d;if(t.track>10){this.tracks.push({x:t.x,y:t.y,a:t.angle,life:90});t.track=0;}}
 }
 clearLine(a,b){const d=dist(a,b);return !d||wallHit(a.x,a.y,(b.x-a.x)/d,(b.y-a.y)/d,this.walls,d).distance>=d-.001;}
 shoot(t){
  if(!t.alive||t.cool>0)return false;const player=t===this.player,kind=TYPES[t.type];if(this.shots.filter(s=>s.alive&&s.owner===t.id).length>=(player?5:kind.ammo))return false;
  const c=Math.cos(t.aim),s=Math.sin(t.aim),muzzle=37,hit=wallHit(t.x,t.y,c,s,this.walls,muzzle);
  if(hit.hit){t.cool=.12;this.spark(t.x+c*hit.distance,t.y+s*hit.distance);return false;}
  t.cool=player?.16:this.interval(AI_TIMING[t.type].shot);t.aimReady=0;t.hold=.10;const speed=player?SHELL_SPEED:kind.shot;
  this.shots.push({x:t.x+c*muzzle,y:t.y+s*muzzle,vx:c*speed,vy:s*speed,owner:t.id,bounces:player?1:kind.bounces,age:0,alive:true,rocket:!player&&kind.shot>SHELL_SPEED,trail:[]});return true;
 }
 mine(t=this.player){
  const max=t===this.player?2:TYPES[t.type].mines||0;
  if(this.state!=='playing'||!t.alive||t.mineCool>0||this.mines.filter(m=>m.alive&&m.owner===t.id).length>=max)return false;
  this.mines.push({x:t.x,y:t.y,age:0,owner:t.id,alive:true,warning:null});t.mineCool=t===this.player?.45:this.interval(AI_TIMING[t.type].mine);t.hold=.16;return true;
 }
 spark(x,y,big=false){this.effects.push({x,y,age:0,big});}
 kill(t){if(!t.alive)return;t.alive=false;this.wrecks.push({x:t.x,y:t.y});this.spark(t.x,t.y,true);if(t===this.player){this.lives--;this.state='dead';}else this.score+=TANK_POINTS[t.type];}
 explode(m){if(!m.alive)return;m.alive=false;this.spark(m.x,m.y,true);for(const t of this.tanks)if(t.alive&&dist(t,m)<BLAST_RADIUS)this.kill(t);this.walls=this.walls.filter(w=>!w.soft||!circleRect(m.x,m.y,BLAST_RADIUS,w));for(const other of this.mines)if(other.alive&&dist(other,m)<BLAST_RADIUS)this.explode(other);for(const s of this.shots)if(dist(s,m)<BLAST_RADIUS)s.alive=false;}
 interval([min,max]){return min+(max-min)*this.random();}
 random(){this.aiSeed=(Math.imul(this.aiSeed,1664525)+1013904223)>>>0;return this.aiSeed/4294967296;}
 waypoint(t,target=this.player){
  const cols=this.grid.cols,rows=this.grid.rows,cw=(W-24)/cols,ch=(H-24)/rows,start=[Math.floor((t.x-12)/cw),Math.floor((t.y-12)/ch)],goal=[Math.floor((target.x-12)/cw),Math.floor((target.y-12)/ch)];
  const key=(x,y)=>y*cols+x,first=key(...start),last=key(...goal),queue=[first],prev=new Map([[first,null]]);
  for(let i=0;i<queue.length;i++){const k=queue[i];if(k===last)break;const x=k%cols,y=Math.floor(k/cols);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=key(nx,ny),cx=12+(nx+.5)*cw,cy=12+(ny+.5)*ch;if(cx<R+12||cy<R+12||cx>W-R-12||cy>H-R-12||prev.has(n)||this.walls.concat(this.pits).some(w=>circleRect(cx,cy,R+1,w)))continue;prev.set(n,k);queue.push(n);}}
  if(!prev.has(last))return null;let k=last;while(prev.get(k)!==first&&prev.get(k)!==null)k=prev.get(k);return{x:12+(k%cols+.5)*cw,y:12+(Math.floor(k/cols)+.5)*ch};
 }
 shotPlan(t){
  // Basic mobile tanks take visible direct shots; they do not solve reflected paths.
  if(TYPES[t.type].roam&&!this.clearLine(t,this.player))return null;
  const p=this.player,kind=TYPES[t.type],angles=[Math.atan2(p.y-t.y,p.x-t.x)],faces=[['x',16],['x',W-16],['y',16],['y',H-16]];
  if(kind.bank){
   for(const w of this.walls)faces.push(['x',w.x-4],['x',w.x+w.w+4],['y',w.y-4],['y',w.y+w.h+4]);
   const mirror=(q,[axis,pos])=>({...q,[axis]:2*pos-q[axis]});
   for(const f of faces){const q=mirror(p,f);angles.push(Math.atan2(q.y-t.y,q.x-t.x));}
   if(kind.bounces>1)for(const f of faces.slice(0,4))for(const g of faces){const q=mirror(mirror(p,g),f);angles.push(Math.atan2(q.y-t.y,q.x-t.x));}
  }
  let best=null;
  for(const angle of angles){const c=Math.cos(angle),s=Math.sin(angle);if(wallHit(t.x,t.y,c,s,this.walls,37).hit)continue;const hit=targetOnRay(traceShot(t.x+c*37,t.y+s*37,angle,this.walls,kind.bounces),p,R*.75);if(!hit)continue;
   const cost=hit.distance+(t.type==='sniper'&&hit.bounce===0?2500:hit.bounce*80);
   if(!best||cost<best.cost)best={angle,cost,bounce:hit.bounce};
  }return best;
 }
 basicDodge(t){
  for(const s of this.shots){
   if(!s.alive||s.owner===t.id||(s.age||0)<.12)continue;
   if(t.type==='rocket'&&s.bounces<1)continue; // Teal reacts to direct, not rebound attacks.
   const speed=Math.hypot(s.vx,s.vy),rx=t.x-s.x,ry=t.y-s.y;
   const toward=(rx*s.vx+ry*s.vy)/speed,cross=(rx*s.vy-ry*s.vx)/speed;
   if(toward<=0||toward>105||Math.abs(cross)>=R+8||!this.clearLine(t,s))continue;
   return{x:s.vy*Math.sign(cross||1),y:-s.vx*Math.sign(cross||1)};
  }
  return null;
 }
 enemy(t,dt){
  const p=this.player,kind=TYPES[t.type],timing=AI_TIMING[t.type],d=dist(t,p),line=this.clearLine(t,p);
  t.planTimer-=dt;if(t.planTimer<=0){
   const next=this.shotPlan(t);
   if(!next||!t.plan||next.bounce!==t.plan.bounce||Math.abs(delta(t.plan.angle,next.angle))>.2)t.aimReady=0;
   t.plan=next;t.planTimer=this.interval(timing.scan);
  }
  const aim=t.plan?.angle??(kind.roam?t.aim:Math.atan2(p.y-t.y,p.x-t.x));t.aim=turn(t.aim,aim,dt*(kind.roam?1.65:2.7));
  if(kind.speed){
   if(kind.roam){
    t.roamTime=(t.roamTime||0)-dt;
    if(t.roamTime<=0||!t.roamGoal||dist(t,t.roamGoal)<25){
     for(let attempt=0;attempt<16;attempt++){
      const x=12+(Math.floor(this.random()*this.grid.cols)+.5)*(W-24)/this.grid.cols,y=12+(Math.floor(this.random()*this.grid.rows)+.5)*(H-24)/this.grid.rows;
      if(this.free(x,y,R+1,t)){const goal={x,y};if(this.waypoint(t,goal)){t.roamGoal=goal;break;}}
     }
     t.roamTime=2+this.random()*3;t.nav=0;
    }
   }
   t.nav-=dt;if(t.nav<=0){t.way=this.waypoint(t,kind.roam?t.roamGoal||t:p);t.nav=.35;}
   let ax=0,ay=0;
   if(t.type==='miner'){t.wander+=dt*.7;ax=Math.cos(t.wander);ay=Math.sin(t.wander);if(!this.free(t.x+ax*45,t.y+ay*45,R,t)){t.wander+=1.1;ax=Math.cos(t.wander);ay=Math.sin(t.wander);}this.mine(t);}
   else if(kind.roam){if(t.way){ax=t.way.x-t.x;ay=t.way.y-t.y;}}
   else if(!line||d>(t.type==='hunter'?120:340)){if(t.way){ax=t.way.x-t.x;ay=t.way.y-t.y;}}
   else if(t.type!=='hunter'){const a=Math.atan2(p.y-t.y,p.x-t.x)+(d<170?Math.PI:Math.PI/2*(t.id%2?1:-1));ax=Math.cos(a);ay=Math.sin(a);}
   if(kind.dodge){
    if(kind.roam){
     // Sample local threats, then commit briefly instead of changing direction at 120 Hz.
     t.dodgeTimer=(t.dodgeTimer??.18)-dt;
     if(t.dodgeTimer<=0){t.dodgeVector=this.basicDodge(t);t.dodgeTimer=this.interval([.18,.28]);}
     if(t.dodgeVector){ax=t.dodgeVector.x;ay=t.dodgeVector.y;}
    }else for(const s of this.shots){const speed=Math.hypot(s.vx,s.vy),rx=t.x-s.x,ry=t.y-s.y,toward=(rx*s.vx+ry*s.vy)/speed,cross=(rx*s.vy-ry*s.vx)/speed;if(toward>0&&toward<115&&Math.abs(cross)<R+10){ax=s.vy*Math.sign(cross||1);ay=-s.vx*Math.sign(cross||1);break;}}
   }
   for(const m of this.mines)if(m.alive&&(!kind.roam||m.owner!==0)&&dist(t,m)<125){ax=t.x-m.x;ay=t.y-m.y;break;}
   if(kind.mines&&t.type!=='miner'&&t.mineCool<=0&&d<330)this.mine(t);
   const n=Math.hypot(ax,ay);if(n)this.move(t,ax/n*kind.speed*dt,ay/n*kind.speed*dt,dt);
  }
  // A newly acquired line needs a short stable aim; small tracking updates keep progress.
  if(t.plan&&Math.abs(delta(t.aim,aim))<.055)t.aimReady+=dt;else t.aimReady=0;
  if(t.aimReady>=timing.settle)this.shoot(t);
 }
 step(dt,input={}){
  if(this.state==='paused'||this.state==='ready')return;
  for(const e of this.effects)e.age+=dt;this.effects=this.effects.filter(e=>e.age<.65);
  if(this.state!=='playing')return;this.time+=dt;
  for(const t of this.tracks)t.life-=dt;this.tracks=this.tracks.filter(t=>t.life>0).slice(-1600);
  for(const t of this.tanks){t.cool=Math.max(0,t.cool-dt);t.mineCool=Math.max(0,t.mineCool-dt);t.hold=Math.max(0,t.hold-dt);}
  const p=this.player;let dx=input.x||0,dy=input.y||0;const norm=Math.hypot(dx,dy);if(norm>1){dx/=norm;dy/=norm;}
  if(Number.isFinite(input.aim))p.aim=turn(p.aim,input.aim,dt*18);
  if(input.fire)this.shoot(p);this.move(p,dx*PLAYER_SPEED*dt,dy*PLAYER_SPEED*dt,dt);
  for(const t of this.tanks)if(t!==p&&t.alive)this.enemy(t,dt);
  for(const s of this.shots){
   if(!s.alive)continue;s.age+=dt;s.trail.push({x:s.x,y:s.y});if(s.trail.length>10)s.trail.shift();
   const speed=Math.hypot(s.vx,s.vy);let remaining=speed*dt;
   for(let j=0;j<4&&remaining>0&&s.alive;j++){
    const dx=s.vx/speed,dy=s.vy/speed,hit=wallHit(s.x,s.y,dx,dy,this.walls,remaining);
    s.x+=dx*hit.distance;s.y+=dy*hit.distance;remaining-=hit.distance;
    if(!hit.hit)break;this.spark(s.x,s.y);if(s.bounces--<=0){s.alive=false;break;}if(hit.nx)s.vx=-s.vx;if(hit.ny)s.vy=-s.vy;s.x+=s.vx/speed*.001;s.y+=s.vy/speed*.001;
   }
   if(!s.alive)continue;
   for(const t of this.tanks)if(t.alive&&(t.id!==s.owner||s.age>.12)&&dist(t,s)<R+3){this.kill(t);s.alive=false;break;}
   if(s.age>12)s.alive=false;
  }
  for(let i=0;i<this.shots.length;i++)for(let j=i+1;j<this.shots.length;j++){const a=this.shots[i],b=this.shots[j];if(a.alive&&b.alive&&dist(a,b)<10){a.alive=b.alive=false;this.spark(a.x,a.y);}}
  for(const m of this.mines){
   if(!m.alive)continue;m.age+=dt;
   if(this.shots.some(s=>s.alive&&dist(s,m)<13)){this.explode(m);continue;}
   if(m.warning===null&&(m.age>MINE_FUSE-MINE_WARNING||(m.age>.8&&this.tanks.some(t=>t.alive&&dist(t,m)<55))))m.warning=MINE_WARNING;
   if(m.warning!==null){m.warning-=dt;if(m.warning<=0)this.explode(m);}
  }
  this.shots=this.shots.filter(s=>s.alive);this.mines=this.mines.filter(m=>m.alive);
  if(this.state==='playing'&&!this.tanks.some(t=>t!==p&&t.alive)){this.state=this.level===LEVELS.length-1?'won':'clear';this.shots=[];this.mines=[];}
 }
}
