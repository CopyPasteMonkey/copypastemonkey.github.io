import {bindAudioControl} from './audio-controls.js';
import {SoundEffects,bindSounds} from './sound-effects.js';
import {SpaceMusic} from './space-music.js';
import {DIFFICULTIES} from './difficulty.js';
import {readScores,saveScore} from './scores.js';
import {Mission,PLANETS,SUN,TAU,angleDelta,orbitPosition,predictTrajectory,scoreSummary,distance,clamp} from './physics.js';
const $=id=>document.getElementById(id),canvas=$('space'),ctx=canvas.getContext('2d');
const ink='#232421',red='#c73136',paper='#ffffff',muted='#8c8d86';
const music=new SpaceMusic();
const effects=new SoundEffects();bindSounds($('effects-button'),effects);
bindAudioControl($('music-button'),music);
addEventListener('pagehide',()=>music.stop());
const mission=new Mission(),input={left:false,right:false,thrust:false,brake:false,fire:false};
let width=0,height=0,dpr=1,map=false,camera={x:0,y:0,zoom:.9},last=0,accumulator=0,noticeTimer=0,uiTimer=0,lastState='ready',manualPause=false,readyTime=0;
let trajectory={points:[],impact:null},trajectoryTime=-Infinity,trajectoryDock=null,scoreSaved=false;
let trajectoryWorker=null,forecastPending=false,forecastId=0,forecastRevision=0,renderAlpha=1,radarRange=3000;
try{
 trajectoryWorker=new Worker(new URL('./trajectory-worker.js',import.meta.url),{type:'module'});
 trajectoryWorker.onmessage=({data})=>{forecastPending=false;if(data.revision===forecastRevision&&data.id===forecastId)trajectory=data.result;};
 trajectoryWorker.onerror=()=>{trajectoryWorker?.terminate();trajectoryWorker=null;forecastPending=false;};
}catch{trajectoryWorker=null;}
function resetForecast(){forecastRevision++;trajectory={points:[],impact:null};trajectoryTime=-Infinity;trajectoryDock=null;}
function updateForecast(){
 if(mission.state==='ready'||mission.state==='won')return;
 if(trajectoryDock!==mission.ship.docked||mission.time<trajectoryTime){resetForecast();trajectoryDock=mission.ship.docked;}
 if(forecastPending||mission.time-trajectoryTime<.2)return;
 trajectoryTime=mission.time;
 const s=mission.ship,snapshot={time:mission.time,ship:{x:s.x,y:s.y,vx:s.vx,vy:s.vy,r:s.r,docked:s.docked,dockAngle:s.dockAngle},planets:mission.planets.map(p=>({id:p.id,orbit:p.orbit,r:p.r,phase:p.phase,mu:p.mu}))};
 if(trajectoryWorker){forecastPending=true;trajectoryWorker.postMessage({id:++forecastId,revision:forecastRevision,snapshot});}
 else{trajectory=predictTrajectory(snapshot,8);}
}
function rememberPositions(){for(const b of [mission.ship,...mission.planets,...mission.enemies,...mission.rocks,...mission.shots]){b.previousX=b.x;b.previousY=b.y;b.previousAngle=b.a;}}
function renderPosition(b){
 if(b.previousX===undefined||Math.hypot(b.x-b.previousX,b.y-b.previousY)>200)return {x:b.x,y:b.y};
 return {x:b.previousX+(b.x-b.previousX)*renderAlpha,y:b.previousY+(b.y-b.previousY)*renderAlpha};
}
function bodyPoint(b){const p=renderPosition(b);return worldPoint(p.x,p.y);}

let scoreStorage;try{scoreStorage=window.localStorage;}catch{scoreStorage=null;}
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse=matchMedia('(pointer: coarse)').matches;
const stars=Array.from({length:850},(_,i)=>({x:Math.sin(i*127.1)*5900,y:Math.cos(i*311.7)*5900,size:i%15===0?2:0.8}));
function resize(){const box=canvas.getBoundingClientRect();width=box.width;height=box.height;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}
new ResizeObserver(resize).observe(canvas);resize();
function clearInput(){for(const key in input)input[key]=false;document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('pressed'));}
function toggleMap(){if(mission.state==='ready')return;map=!map;$('map-button').textContent=map?'Close chart  M':'System chart  M';$('map-button').setAttribute('aria-pressed',String(map));canvas.focus({preventScroll:true});}
function setPause(value){if(!['playing','paused'].includes(mission.state))return;mission.state=value?'paused':'playing';clearInput();$('pause-screen').hidden=!value;$('pause-button').textContent=value?'Resume  P':'Pause  P';if(value)$('resume-button').focus();else canvas.focus({preventScroll:true});accumulator=0;}
let selectedDifficulty='medium';
function start(){mission.start(selectedDifficulty);scoreSaved=false;resetForecast();radarRange=3000;$('score-form').hidden=false;$('score-save-status').textContent='';$('initials').value='';map=false;clearInput();camera.x=mission.ship.x;camera.y=mission.ship.y;camera.zoom=width<600?.72:1;$('intro').hidden=true;$('win-screen').hidden=true;$('pause-screen').hidden=true;$('flight-hud').hidden=false;$('target-panel').hidden=false;$('pause-button').disabled=false;$('map-button').disabled=false;$('touch-controls').hidden=!coarse;$('map-button').textContent='System chart  M';$('map-button').setAttribute('aria-pressed','false');$('pause-button').textContent='Pause  P';canvas.focus({preventScroll:true});lastState='playing';updateUI();}
$('again-button').onclick=start;$('restart-button').onclick=start;$('resume-button').onclick=()=>setPause(false);$('pause-button').onclick=()=>setPause(mission.state!=='paused');$('map-button').onclick=toggleMap;
function help(){manualPause=mission.state==='playing';if(manualPause){mission.state='paused';clearInput();}$('manual').showModal();}
$('help-button').onclick=help;$('close-help').onclick=()=>$('manual').close();$('manual-done').onclick=()=>$('manual').close();$('manual').addEventListener('close',()=>{if(manualPause){mission.state='playing';accumulator=0;}manualPause=false;canvas.focus({preventScroll:true});});
const keymap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'thrust',KeyW:'thrust',ArrowDown:'brake',KeyS:'brake',Space:'fire'};
addEventListener('keydown',e=>{if($('manual').open||$('scores-dialog').open)return;if(e.target.matches('input,textarea,select'))return;if(e.code==='Escape'||e.code==='KeyP'){if(!e.repeat){e.preventDefault();setPause(mission.state!=='paused');}return;}if(e.code==='KeyM'){if(!e.repeat){e.preventDefault();toggleMap();}return;}if(e.code==='KeyT'&&mission.state==='playing'){e.preventDefault();if(!e.repeat)mission.cycleTarget();return;}if(keymap[e.code]&&mission.state==='playing'&&!e.target.closest('button')){e.preventDefault();input[keymap[e.code]]=true;}});
addEventListener('keyup',e=>{if(keymap[e.code])input[keymap[e.code]]=false;});
addEventListener('blur',()=>{clearInput();if(mission.state==='playing')setPause(true);});document.addEventListener('visibilitychange',()=>{if(document.hidden){music.update(true);if(mission.state==='playing')setPause(true);}});
for(const button of document.querySelectorAll('[data-control]')){button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);input[button.dataset.control]=true;button.classList.add('pressed');});const release=()=>{input[button.dataset.control]=false;button.classList.remove('pressed');};button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);}
const techOrder=PLANETS.filter(p=>p.tech).map(p=>p.id);
for(const id of techOrder){const p=mission.planets.find(p=>p.id===id),button=document.createElement('button');button.className='tech-button';button.dataset.planet=id;button.innerHTML=`<span class="tech-icon" aria-hidden="true">${p.glyph}</span><span class="tech-state" aria-hidden="true">○</span>`;button.onclick=()=>{mission.selectTarget(id);canvas.focus({preventScroll:true});updateUI();};$('tech-list').append(button);}
function announce(text){$('notice').textContent=text;$('notice').classList.add('show');noticeTimer=3;}
function updateUI(){const s=mission.ship,target=mission.targetBody,nearest=mission.nearest(),p=nearest.planet,rel=mission.relativeSpeed(p);$('hull').textContent=Array.from({length:3},(_,i)=>i<s.hull?'●':'○').join(' ');$('hull').setAttribute('aria-label',`${s.hull} of 3 hull remaining`);canvas.dataset.time=String(mission.time);$('clock').textContent=formatTime(mission.scoringTime);$('clock').title=`Flight ${formatTime(mission.time)} + ${mission.rescueTime}s rescue penalty`;$('points').textContent=String(mission.score).padStart(4,'0');$('points').setAttribute('aria-label',`${mission.score} points`);
 for(const b of $('tech-list').children){const planet=mission.planets.find(p=>p.id===b.dataset.planet);b.classList.toggle('active',!s.cargo&&planet.id===mission.target);b.classList.toggle('delivered',planet.flag==='delivered');b.querySelector('.tech-state').textContent=planet.flag==='delivered'?'✓':planet.flag==='carried'?'↑':'○';b.setAttribute('aria-pressed',String(!s.cargo&&planet.id===mission.target));b.setAttribute('aria-label',`${planet.tech}, ${planet.name}, ${planet.fleet} fleet, ${planet.flag}`);b.title=`${planet.tech} — ${planet.flag==='carried'?'carrying home':planet.flag==='delivered'?'delivered':planet.name}`;}
 const landing=$('landing-readout');landing.style.setProperty('--landing-safe-limit',`${mission.difficulty.landingSpeed/180*100}%`);landing.hidden=mission.state==='ready'||mission.state==='won'||map||nearest.gap>360;landing.classList.toggle('unsafe',rel>mission.difficulty.landingSpeed&&!s.docked);landing.setAttribute('aria-valuenow',String(Math.min(180,Math.round(rel))));landing.setAttribute('aria-valuetext',s.docked?'Docked':rel>mission.difficulty.landingSpeed?'Too fast — brake':'Safe approach speed');$('landing-bar').style.width=Math.min(100,rel/180*100)+'%';canvas.dataset.state=mission.state;canvas.dataset.difficulty=mission.difficulty.id;canvas.dataset.delivered=String(mission.delivered);canvas.dataset.docked=s.docked||'';
}
function line(points,color=ink,weight=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke();}
function circle(x,y,r,color=ink,weight=1,fill){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=weight;ctx.stroke();}
function label(text,x,y,size=10,color=ink,align='center'){ctx.font=`${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;ctx.fillStyle=color;ctx.textAlign=align;ctx.fillText(text,x,y);}
function worldPoint(x,y){return {x:(x-camera.x)*camera.zoom+width/2,y:(y-camera.y)*camera.zoom+height/2};}
function inView(x,y,r=100){const p=worldPoint(x,y);return p.x>-r&&p.x<width+r&&p.y>-r&&p.y<height+r;}
function drawSun(t){const p=worldPoint(0,0),r=SUN.r*camera.zoom;if(!inView(0,0,r+60))return;circle(p.x,p.y,r,ink,1.5,paper);circle(p.x,p.y,r*.82,ink,.6);for(let i=0;i<32;i++){const a=i*TAU/32+(!reduced?t*.025:0),a2=a+.025,inner=r+4,outer=r+8+(i%3)*4;line([[p.x+Math.cos(a)*inner,p.y+Math.sin(a)*inner],[p.x+Math.cos(a2)*outer,p.y+Math.sin(a2)*outer]],i%4===0?red:ink,.8);}if(r>40){ctx.setLineDash([3,7]);circle(p.x,p.y,r+24,red,.65);ctx.setLineDash([]);}}
function drawFlag(x,y,scale,kind){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);line([[0,6],[0,-21]],red,1.3);line([[0,-21],[21,-16],[0,-9]],red,1.3);if(kind==='fast')line([[8,-19],[5,-15],[13,-16],[10,-12]],red,.8);if(kind==='normal'){line([[6,-17],[12,-17]],red,.8);line([[9,-19],[9,-14]],red,.8);}if(kind==='shield')line([[6,-19],[13,-17],[11,-13],[6,-14],[6,-19]],red,.8);if(kind==='smart'){circle(9,-16,2,red,.8);line([[5,-16],[13,-16]],red,.6);}ctx.restore();}
function drawPlanet(p,t,overview){const q=bodyPoint(p),r=p.r*camera.zoom,minR=overview?5:0,rr=Math.max(r,minR);if(!inView(p.x,p.y,rr+100))return;const selected=mission.state!=='ready'&&mission.targetBody.id===p.id;circle(q.x,q.y,rr,ink,1.2,paper);ctx.save();ctx.beginPath();ctx.arc(q.x,q.y,rr,0,TAU);ctx.clip();ctx.strokeStyle='#b6b7af';ctx.lineWidth=.65;for(const f of [-.55,0,.55]){ctx.beginPath();ctx.ellipse(q.x,q.y+f*rr,rr*Math.sqrt(1-f*f),rr*.19,0,0,TAU);ctx.stroke();}ctx.beginPath();ctx.ellipse(q.x,q.y,rr*.4,rr,0,0,TAU);ctx.stroke();ctx.restore();
 if(p.id==='home'){circle(q.x,q.y,rr+4,red,1);}
 if(p.flag==='available')drawFlag(q.x,q.y-rr,overview?.55:1,p.fleet);else if(p.flag==='delivered'){label('✓',q.x,q.y+4,overview?9:16,red);}
 if(selected){ctx.setLineDash([4,5]);circle(q.x,q.y,rr+12,red,.8);ctx.setLineDash([]);}
 label(p.glyph,q.x,q.y+rr+(overview?20:25),overview?16:20,p.id==='home'||selected?red:ink);
}
function drawRock(r){if(!inView(r.x,r.y,60))return;const q=bodyPoint(r),size=r.r*camera.zoom;ctx.save();ctx.translate(q.x,q.y);ctx.rotate(r.a);const points=r.points.map((v,i)=>[Math.cos(i*TAU/r.points.length)*size*v,Math.sin(i*TAU/r.points.length)*size*v]);points.push(points[0]);ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=ink;ctx.lineWidth=.95;ctx.stroke();ctx.restore();}
function drawEnemy(e){
 if(!inView(e.x,e.y,80))return;
 const q=bodyPoint(e),scale=Math.max(.45,camera.zoom),wide=e.type==='shield'?22:e.type==='fast'?20:18;
 ctx.save();ctx.translate(q.x,q.y);ctx.scale(scale,scale);
 // Classic saucer silhouette: a dome, broad rim, and three running lights.
 ctx.fillStyle=paper;ctx.strokeStyle=ink;ctx.lineWidth=1.25/scale;
 ctx.beginPath();ctx.ellipse(0,-5,wide*.48,11,0,Math.PI,TAU);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.beginPath();ctx.ellipse(0,0,wide,7,0,0,TAU);ctx.fill();ctx.stroke();
 line([[-wide,0],[wide,0]],ink,.7/scale);
 for(const x of [-9,0,9])circle(x,2,1.3,e.type==='smart'?red:ink,.6/scale);
 if(e.type==='smart'){line([[0,-16],[0,-21]],ink,.8/scale);circle(0,-23,2,red,.8/scale);}
 if(e.type==='fast'){const back=e.a+Math.PI;for(const d of [-4,4])line([[Math.cos(back)*21,Math.sin(back)*21+d],[Math.cos(back)*32,Math.sin(back)*32+d]],red,.8/scale);}
 if(e.shield){ctx.beginPath();ctx.arc(0,0,e.r+10,e.a-Math.PI/3,e.a+Math.PI/3);ctx.strokeStyle=red;ctx.lineWidth=1.8/scale;ctx.stroke();}
 ctx.restore();
 if(e.aim&&camera.zoom>.25){const a=worldPoint(e.aim.x,e.aim.y);ctx.setLineDash([3,8]);ctx.globalAlpha=.5;line([[q.x,q.y],[a.x,a.y]],red,.7);ctx.setLineDash([]);circle(a.x,a.y,7,red,.7);ctx.globalAlpha=1;}
}

function drawShip(){const s=mission.ship,q=bodyPoint(s),scale=Math.max(.68,camera.zoom);if(s.trail.length>2&&!map){ctx.globalAlpha=.2;line(s.trail.map(p=>{const v=worldPoint(p.x,p.y);return [v.x,v.y];}),ink,.6);ctx.globalAlpha=1;}ctx.save();ctx.translate(q.x,q.y);ctx.rotate(s.previousAngle===undefined?s.a:s.previousAngle+angleDelta(s.a,s.previousAngle)*renderAlpha);ctx.scale(scale,scale);ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(-11,-9);ctx.lineTo(-6,0);ctx.lineTo(-11,9);ctx.closePath();ctx.fillStyle=paper;ctx.fill();ctx.strokeStyle=s.damageFlash>0?red:ink;ctx.lineWidth=1.7/scale;ctx.stroke();if(s.engine){const flame=18+Math.sin(mission.time*53)*5;line([[-9,-5],[-flame,0],[-9,5]],red,1.1/scale);}if(input.brake&&!s.docked){line([[-2,-11],[0,-16],[2,-11]],red,.8/scale);line([[-2,11],[0,16],[2,11]],red,.8/scale);}if(s.cargo)drawFlag(-12,13,.65,mission.planets.find(p=>p.id===s.cargo).fleet);ctx.restore();if(s.invulnerable>0&&!s.docked){ctx.globalAlpha=.45;ctx.setLineDash([3,5]);circle(q.x,q.y,23*scale,red,.8);ctx.setLineDash([]);ctx.globalAlpha=1;}if(map){circle(q.x,q.y,16,red,.8);}}
function drawBeacon(){if(map||mission.state==='ready')return;const p=mission.targetBody,q=worldPoint(p.x,p.y),s=mission.ship;const margin=54,inside=q.x>margin&&q.x<width-margin&&q.y>55&&q.y<height-margin;if(inside)return;const origin={x:width/2,y:height/2},dx=q.x-origin.x,dy=q.y-origin.y,a=Math.atan2(dy,dx),sx=(width/2-margin)/Math.abs(Math.cos(a)),sy=(height/2-margin)/Math.abs(Math.sin(a)),len=Math.min(sx,sy),x=origin.x+Math.cos(a)*len,y=clamp(origin.y+Math.sin(a)*len,55,height-55);ctx.save();ctx.translate(x,y);ctx.rotate(a);line([[-8,-5],[0,0],[-8,5]],red,1.3);ctx.restore();const align=x<width/2?'left':'right',tx=x+(x<width/2?13:-13);label(p.glyph,tx,y+5,20,red,align);}
function drawRadar(){if(map||mission.state==='ready')return;const size=width<600?124:170,x=width-size-18,y=18,cx=x+size/2,cy=y+size/2,sc=(size/2-15)/radarRange;ctx.fillStyle='#ffffffed';ctx.fillRect(x,y,size,size);for(const p of mission.planets)circle(cx,cy,p.orbit*sc,'#deded7',.45);ctx.save();ctx.beginPath();ctx.rect(x,y,size,size);ctx.clip();ctx.setLineDash([3,3]);ctx.strokeStyle=red;ctx.lineWidth=1;ctx.globalAlpha=.7;ctx.beginPath();let drawing=false;const current=renderPosition(mission.ship);const future=trajectory.points.filter(p=>p.t>=mission.time);for(const point of [{...current},...future]){if(!point){drawing=false;continue;}const px=cx+point.x*sc,py=cy+point.y*sc;if(drawing)ctx.lineTo(px,py);else ctx.moveTo(px,py);drawing=true;}ctx.stroke();const end=future.at(-1);if(trajectory.impact&&end){const ex=cx+end.x*sc,ey=cy+end.y*sc;line([[ex-3,ey-3],[ex+3,ey+3]],red,1);line([[ex-3,ey+3],[ex+3,ey-3]],red,1);}ctx.restore();circle(cx,cy,3,red,1);for(const p of mission.planets){const px=cx+p.x*sc,py=cy+p.y*sc;circle(px,py,8,paper,1,paper);label(p.glyph,px,py+4,13,p.id===mission.targetBody.id?red:ink);if(p.flag==='delivered')circle(px,py,9,muted,.6);}const s=mission.ship;const px=cx+current.x*sc,py=cy+current.y*sc;circle(px,py,2,red,1,red);}

function drawIntro(t){camera={x:0,y:0,zoom:Math.min(width*.25,height*.45)/3000};const ox=width/2,oy=height/2;ctx.save();ctx.translate(width*.73-ox,height*.51-oy);if(width<600)ctx.globalAlpha=.22;for(const p of PLANETS){const q=worldPoint(0,0);circle(q.x,q.y,p.orbit*camera.zoom,'#c7c8c0',.65);}drawSun(t);for(const spec of PLANETS){const p={...spec,...orbitPosition(spec,reduced?0:t*.6),flag:spec.tech?'available':null};drawPlanet(p,t,true);}ctx.restore();}
function render(dt,t){updateForecast();radarRange+=(Math.max(3000,Math.hypot(mission.ship.x,mission.ship.y)+350)-radarRange)*(1-Math.exp(-dt*6));ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);if(mission.state==='ready'){drawIntro(readyTime);return;}const s=mission.ship,rendered=renderPosition(s),targetZoom=map?Math.min((width-60)/6100,(height-110)/6100):(width<600?.72:1);const tx=map?0:rendered.x+s.vx*.24,ty=map?0:rendered.y+s.vy*.24;const smoothing=reduced?1:1-Math.exp(-dt*5);camera.x+=(tx-camera.x)*smoothing;camera.y+=(ty-camera.y)*smoothing;camera.zoom+=(targetZoom-camera.zoom)*smoothing;
 ctx.globalAlpha=.35;for(const star of stars){const q=worldPoint(star.x,star.y);if(q.x<0||q.x>width||q.y<0||q.y>height)continue;ctx.fillStyle='#85867e';ctx.fillRect(q.x,q.y,star.size,star.size);}ctx.globalAlpha=1;
 const zero=worldPoint(0,0);ctx.setLineDash(map?[]:[3,7]);for(const p of mission.planets)circle(zero.x,zero.y,p.orbit*camera.zoom,map?'#d8d9d0':'#e1e2da',.7);ctx.setLineDash([]);drawSun(t);for(const r of mission.rocks)drawRock(r);for(const p of mission.planets)drawPlanet(p,t,map);for(const e of mission.enemies)drawEnemy(e);for(const b of mission.shots){const q=bodyPoint(b);const a=Math.atan2(b.vy,b.vx);line([[q.x,q.y],[q.x-Math.cos(a)*5,q.y-Math.sin(a)*5]],b.alien?red:ink,b.alien?1.5:1.2);}for(const p of mission.particles){const q=worldPoint(p.x,p.y);ctx.globalAlpha=clamp(p.life,0,1);line([[q.x,q.y],[q.x-p.vx*.025,q.y-p.vy*.025]],p.red?red:ink,.8);}ctx.globalAlpha=1;drawShip();drawBeacon();drawRadar();if(s.damageFlash>0){ctx.strokeStyle=red;ctx.lineWidth=2;ctx.globalAlpha=s.damageFlash*2;ctx.strokeRect(1,1,width-2,height-2);ctx.globalAlpha=1;}
}
function renderScores(){
 const list=$('highscores');list.replaceChildren();const scores=readScores(scoreStorage);
 if(!scores.length){const li=document.createElement('li');li.textContent='NO SCORES YET';list.append(li);return;}
 for(const [i,entry] of scores.entries()){const li=document.createElement('li');
  for(const value of [String(i+1).padStart(2,'0'),entry.initials,entry.score.toLocaleString(),entry.difficulty==='classic'?'Classic':DIFFICULTIES[entry.difficulty].label,entry.pacifist?'✳':'']){const span=document.createElement('span');span.textContent=value;li.append(span);}
  if(entry.pacifist)li.title='Pacifist finish';list.append(li);
 }
}
function formatTime(seconds){return `${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;}
function showResults(){
 const result=scoreSummary(mission);$('final-score').textContent=result.total.toLocaleString();
 $('results').textContent=`(${mission.score.toLocaleString()} points + ${result.pacifist.toLocaleString()} pacifist bonus) × ${result.multiplier.toFixed(2)} time × ${result.difficultyMultiplier} ${mission.difficulty.label}`;
 $('run-time').textContent=`${formatTime(mission.scoringTime)} scored time (${formatTime(mission.time)} flight + ${mission.rescueTime}s rescue penalty) · ${mission.kills} ships destroyed`;
 $('initials').focus();
}
$('score-form').addEventListener('submit',event=>{
 event.preventDefault();if(scoreSaved||mission.state!=='won')return;
 const initials=$('initials').value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);
 if(initials.length!==3){$('score-save-status').textContent='Enter three letters.';$('initials').focus();return;}
 const result=scoreSummary(mission),saved=saveScore(scoreStorage,{initials,score:result.total,time:mission.scoringTime,pacifist:mission.kills===0,difficulty:mission.difficulty.id});
 if(!saved.ok){$('score-save-status').textContent='Browser storage is unavailable. Your score could not be saved.';return;}
 scoreSaved=true;$('score-form').hidden=true;$('score-save-status').textContent='Score saved on this browser.';renderScores();$('scores-dialog').showModal();
});
$('initials').addEventListener('input',()=>{$('initials').value=$('initials').value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);});
for(const b of document.querySelectorAll('[data-scores]'))b.onclick=()=>{renderScores();$('scores-dialog').showModal();};
$('close-scores').onclick=()=>$('scores-dialog').close();
for(const button of document.querySelectorAll('[data-difficulty]'))button.onclick=()=>{selectedDifficulty=button.dataset.difficulty;start();};
function showSetup(){
 clearInput();mission.state='ready';lastState='ready';accumulator=0;noticeTimer=0;$('notice').classList.remove('show');
 for(const id of ['win-screen','pause-screen','flight-hud','target-panel','landing-readout','touch-controls'])$(id).hidden=true;
 $('intro').hidden=false;$('pause-button').disabled=true;$('map-button').disabled=true;
 document.querySelector(`[data-difficulty="${selectedDifficulty}"]`).focus();
}
for(const b of document.querySelectorAll('[data-setup]'))b.onclick=showSetup;
function frame(timestamp){music.update(document.hidden||mission.state==='paused'||$('manual').open||$('scores-dialog').open);const dt=last?Math.min((timestamp-last)/1000,.12):0;last=timestamp;if(mission.state==='ready')readyTime+=dt;if(mission.state==='playing'){accumulator+=dt;while(accumulator>=1/120){rememberPositions();const rescues=mission.rescues;mission.step(1/120,input);if(mission.rescues!==rescues)resetForecast();accumulator-=1/120;}for(const event of mission.takeEvents())announce(event);}else accumulator=0;if(noticeTimer>0&&mission.state==='playing'){noticeTimer-=dt;if(noticeTimer<=0)$('notice').classList.remove('show');}if(mission.state==='won'&&lastState!=='won'){$('win-screen').hidden=false;$('touch-controls').hidden=true;$('landing-readout').hidden=true;$('pause-button').disabled=true;showResults();clearInput();}lastState=mission.state;uiTimer+=dt;if(uiTimer>.1){updateUI();uiTimer=0;}renderAlpha=mission.state==='playing'?accumulator*120:1;effects.space(mission,$('manual').open||$('scores-dialog').open);render(dt,timestamp/1000);requestAnimationFrame(frame);}
requestAnimationFrame(frame);

const launchParams=new URLSearchParams(location.search);
if(launchParams.get('scores')==='1'){renderScores();$('scores-dialog').showModal();}
else if(launchParams.get('play')==='1'&&['easy','medium','hard'].includes(launchParams.get('difficulty'))){selectedDifficulty=launchParams.get('difficulty');start();}
