import {bindAudioControl} from './audio-controls.js';
import {readTankScores,saveTankScore} from './tanks-scores.js';
import {SoundEffects,bindSounds} from './sound-effects.js';
import {TankMusic} from './tanks-music.js';
import {TankGame,W,H,LEVELS,traceShot,BLAST_RADIUS} from './tanks-physics.js';
const $=id=>document.getElementById(id),canvas=$('field'),ctx=canvas.getContext('2d'),game=new TankGame();
let scoreSaved=false,scoreStorage;try{scoreStorage=localStorage;}catch{}
const viewHeight=()=>game.levels[game.level].playHeight||H;
const music=new TankMusic();
const effects=new SoundEffects();bindSounds($('effects-button'),effects);
bindAudioControl($('music'),music);
addEventListener('pagehide',()=>music.stop());
const ink='#232421',red='#c73136',muted='#d9d9d2';
const keys=new Set();let pointer={x:700,y:320},fire=false,queuedShot=false,last=performance.now(),acc=0,shown='',touchMove={x:0,y:0},touchAim=null;
const input=()=>{const shot=queuedShot;queuedShot=false;return {x:touchMove.x+(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),y:touchMove.y+(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),aim:touchAim??Math.atan2(pointer.y-game.player.y,pointer.x-game.player.x),fire:shot||fire};};
function resetInput(){keys.clear();fire=false;queuedShot=false;touchMove={x:0,y:0};touchAim=null;document.querySelectorAll('.pad i').forEach(e=>e.style.transform='');}
function pause(){if(game.state==='playing'){game.state='paused';resetInput();}else if(game.state==='paused')game.state='playing';sync();}
addEventListener('keydown',e=>{if($('tank-scores-dialog').open)return;if(e.target.matches('button,a,input'))return;if(['KeyW','KeyA','KeyS','KeyD','Space','KeyP','Escape'].includes(e.code))e.preventDefault();if(e.code==='KeyP'&&!e.repeat)pause();if(e.code==='Escape'&&!e.repeat&&game.state==='playing')pause();keys.add(e.code);if(e.code==='Space'&&!e.repeat)game.mine();});
addEventListener('keyup',e=>keys.delete(e.code));
addEventListener('blur',()=>{resetInput();if(game.state==='playing'){game.state='paused';sync();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(game.state==='playing'){game.state='paused';sync();}}});
function updatePointer(e){const b=canvas.getBoundingClientRect();pointer={x:(e.clientX-b.left)*W/b.width,y:(e.clientY-b.top)*viewHeight()/b.height};}
canvas.addEventListener('pointermove',updatePointer);canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;updatePointer(e);if(game.state==='playing'){queuedShot=true;canvas.setPointerCapture(e.pointerId);e.preventDefault();}});
canvas.addEventListener('pointerup',()=>fire=false);canvas.addEventListener('pointercancel',()=>fire=false);canvas.addEventListener('lostpointercapture',()=>fire=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
$('pause').onclick=()=>{pause();$('pause').blur();};$('resume').onclick=()=>{game.state='playing';$('resume').blur();sync();};
$('action').onclick=()=>{resetInput();if(game.state==='won'||(game.state==='dead'&&!game.lives)){scoreSaved=false;$('tank-initials').value='';$('tank-score-status').textContent='';}if(game.state==='clear')game.next();else if(game.state==='dead')game.retry();else if(game.state==='won'){game.newRun();}else game.start();$('action').blur();sync();};
$('mine').onclick=()=>{game.mine();$('mine').blur();};
for(const id of ['drive','aim']){const pad=$(id);let active=null;function move(e){const b=pad.getBoundingClientRect(),x=(e.clientX-b.left-b.width/2)/32,y=(e.clientY-b.top-b.height/2)/32,n=Math.max(1,Math.hypot(x,y));pad.querySelector('i').style.transform=`translate(${x/n*24}px,${y/n*24}px)`;if(id==='drive')touchMove={x:x/n,y:y/n};else{touchAim=Math.atan2(y,x);fire=true;}}pad.addEventListener('pointerdown',e=>{if(active!==null)return;active=e.pointerId;pad.setPointerCapture(active);move(e);});pad.addEventListener('pointermove',e=>{if(e.pointerId===active)move(e);});const release=e=>{if(e.pointerId!==active)return;active=null;pad.querySelector('i').style.transform='';if(id==='drive')touchMove={x:0,y:0};else{fire=false;touchAim=null;}};for(const ev of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(ev,release);}
function sync(){document.documentElement.style.setProperty('--arena-scale',W/viewHeight());music.update(game,document.hidden||$('tank-scores-dialog').open);const level=String(game.level+1).padStart(2,'0');$('level').textContent=`${level} / ${LEVELS.length}`;$('lives').textContent=game.lives>5?`● × ${game.lives}`:'● '.repeat(game.lives)+'○ '.repeat(Math.max(0,3-game.lives));$('lives').setAttribute('aria-label',`${game.lives} tanks remaining`);$('score').textContent=String(game.score).padStart(4,'0');const loaded=5-game.shots.filter(s=>s.owner===0).length;$('ammo').textContent='● '.repeat(loaded)+'○ '.repeat(5-loaded);$('ammo').setAttribute('aria-label',`${loaded} shells available`);canvas.dataset.state=game.state;canvas.dataset.level=game.level+1;
 $('tank-score-form').hidden=scoreSaved||!(game.state==='won'||(game.state==='dead'&&!game.lives));
 if(shown===game.state)return;shown=game.state;$('overlay').hidden=game.state==='playing';$('pause').disabled=!['playing','paused'].includes(game.state);$('pause').textContent=game.state==='paused'?'Resume P':'Pause P';$('resume').hidden=game.state!=='paused';$('action').hidden=game.state==='paused';$('eyebrow').textContent=`${level} / ${LEVELS.length}`;$('eyebrow').hidden=game.state==='ready';$('message').hidden=game.state==='ready';$('overlay').classList.toggle('launch-screen',game.state==='ready');
 const copy={ready:['Tanks','','Play'],paused:['Paused.','Take your time.',''],dead:[game.lives?'Tank lost.':'Run over.',game.lives?`${game.lives} remaining. Try a different angle.`:`${game.score} points · field ${level}` ,game.lives?'Retry field →':'Start again →'],clear:['Field clear.','On to the next.','Continue →'],won:['All clear.',`${game.score} points · ${LEVELS.length} fields cleared.`,'Play again →']}[game.state];if(copy){$('title').textContent=copy[0];$('message').textContent=copy[1];$('action').textContent=copy[2];}if(game.state!=='playing')resetInput();}

function renderTankScores(){const list=$('tank-highscores');list.replaceChildren();const scores=readTankScores(scoreStorage);if(!scores.length){const item=document.createElement('li');item.textContent='NO SCORES YET';list.append(item);}for(const [i,entry] of scores.entries()){const item=document.createElement('li');for(const text of [String(i+1).padStart(2,'0'),entry.initials,entry.score.toLocaleString(),entry.complete?'ALL CLEAR':`FIELD ${String(entry.mission).padStart(2,'0')}`]){const span=document.createElement('span');span.textContent=text;item.append(span);}list.append(item);}}
$('highscores-button').onclick=()=>{resetInput();renderTankScores();$('tank-scores-dialog').showModal();};
$('close-tank-scores').onclick=()=>$('tank-scores-dialog').close();
$('tank-initials').oninput=()=>{$('tank-initials').value=$('tank-initials').value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);};
$('tank-score-form').onsubmit=event=>{event.preventDefault();if(scoreSaved||!(game.state==='won'||(game.state==='dead'&&!game.lives)))return;const initials=$('tank-initials').value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3);if(initials.length!==3){$('tank-score-status').textContent='Enter three letters.';return;}const saved=saveTankScore(scoreStorage,{initials,score:game.score,mission:game.level+1,complete:game.state==='won'});if(!saved.ok){$('tank-score-status').textContent='Browser storage is unavailable. Score could not be saved.';return;}scoreSaved=true;$('tank-score-status').textContent='Score saved on this browser.';sync();renderTankScores();$('tank-scores-dialog').showModal();};

function line(x1,y1,x2,y2,color=ink,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function circle(x,y,r,color=ink,fill='white',width=1.5){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function polygon(points,fill='white',stroke=ink,width=1.2){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
function roundedBox(x,y,w,h,r,stroke=ink,fill='white',width=1.5){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
function drawTank(t){
 const player=t===game.player,c=player?ink:red;
 ctx.save();
 if(t.type==='stealth'&&t.hold<=0&&t.mineCool<2.6)ctx.globalAlpha=.045;
 ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.angle);
 // Soft capsule treads and a compact hull keep the silhouette legible from above.
 for(const y of [-16,7]){
  roundedBox(-21,y,42,9,4.5);
  for(let x=-13;x<=14;x+=7)line(x,y+2,x,y+7,ink,.8);
 }
 roundedBox(-18,-10,36,20,7);
 ctx.restore();
 ctx.save();ctx.translate(t.x,t.y);ctx.rotate(t.aim);
 ctx.lineJoin='round';ctx.lineCap='round';
 roundedBox(5,-4,27,8,3,c);
 line(28,-2,28,2,c,1);
 roundedBox(-12,-11,25,22,8,c);
 if(player){circle(0,0,3,red,red,1);}
 else if(t.type==='miner'||t.type==='sniper'){line(-4,0,4,0,red,1.4);line(0,-4,0,4,red,1.4);}
 else if(['rocket','elite'].includes(t.type)){line(-3,-4,4,0,red);line(4,0,-3,4,red);}
 else if(['hunter','warrior'].includes(t.type)){line(-4,-3,4,-3,red,1.4);line(-4,3,4,3,red,1.4);}
 ctx.restore();ctx.restore();
}
function draw(){const height=viewHeight(),dpr=Math.min(devicePixelRatio||1,2),b=canvas.getBoundingClientRect(),pw=Math.round(b.width*dpr),ph=Math.round(b.height*dpr);if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;}ctx.setTransform(canvas.width/W,0,0,canvas.height/height,0,0);ctx.clearRect(0,0,W,height);ctx.fillStyle='white';ctx.fillRect(0,0,W,height);
 ctx.fillStyle='#deded7';for(let x=40;x<W;x+=40)for(let y=40;y<height;y+=40)ctx.fillRect(x,y,1,1);
 for(const w of game.pits)circle(w.x+w.w/2,w.y+w.h/2,w.w*.32,ink,'#ededE8',1.2);
 for(const w of game.wrecks){line(w.x-7,w.y-7,w.x+7,w.y+7,'#c7c7bf',2);line(w.x-7,w.y+7,w.x+7,w.y-7,'#c7c7bf',2);}
 for(const t of game.tracks){ctx.save();ctx.globalAlpha=Math.min(.24,t.life/20);ctx.translate(t.x,t.y);ctx.rotate(t.a);line(-3,-14,3,-14,ink,2);line(-3,14,3,14,ink,2);ctx.restore();}
 ctx.strokeStyle=ink;ctx.lineWidth=1.5;ctx.strokeRect(12,12,W-24,height-24);ctx.strokeStyle=muted;ctx.strokeRect(5,5,W-10,height-10);
 for(const w of game.walls){
  if(w.y>=height-12)continue;
  ctx.strokeStyle=ink;ctx.lineWidth=1.3;ctx.fillStyle='white';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.strokeRect(w.x,w.y,w.w,w.h);
  if(w.soft){ctx.save();ctx.beginPath();ctx.rect(w.x,w.y,w.w,w.h);ctx.clip();for(let x=w.x-w.h;x<w.x+w.w;x+=12)line(x,w.y+w.h,x+w.h,w.y,'#e5c4c2',.8);ctx.restore();line(w.x+7,w.y+7,w.x+14,w.y+7,red,1.5);}
  else{for(let x=w.x+(W-24)/game.grid.cols;x<w.x+w.w-.1;x+=(W-24)/game.grid.cols)line(x,w.y,x,w.y+w.h,muted,.7);for(let y=w.y+(H-24)/game.grid.rows;y<w.y+w.h-.1;y+=(H-24)/game.grid.rows)line(w.x,y,w.x+w.w,y,muted,.7);}
 }
 for(const m of game.mines){const warning=m.warning!==null,flash=warning&&Math.sin(m.age*28)>0;circle(m.x,m.y,10,red,flash?red:'white',1.5);line(m.x-4,m.y,m.x+4,m.y,flash?'white':red);line(m.x,m.y-4,m.x,m.y+4,flash?'white':red);if(warning){ctx.save();ctx.globalAlpha=.35;ctx.setLineDash([3,7]);circle(m.x,m.y,BLAST_RADIUS,red,null,.8);ctx.restore();}}
 if(game.player.alive){const p=game.player,segments=traceShot(p.x,p.y,p.aim,game.walls,0,Math.min(450,Math.hypot(pointer.x-p.x,pointer.y-p.y)));const end=segments[0];if(end){for(let d=48;d<end.length;d+=24){const x=p.x+Math.cos(p.aim)*d,y=p.y+Math.sin(p.aim)*d;circle(x,y,1.7,'#d9a5a5','#d9a5a5',.5);}}}

 for(const t of game.tanks)if(t.alive)drawTank(t);
 for(const s of game.shots){if(s.rocket){for(let i=0;i<s.trail.length;i+=2){const p=s.trail[i];circle(p.x,p.y,2,'#d9a5a5',null,.7);}}const a=Math.atan2(s.vy,s.vx);ctx.save();ctx.lineCap='round';line(s.x-Math.cos(a)*8,s.y-Math.sin(a)*8,s.x,s.y,s.owner===0?ink:red,8);ctx.restore();}
 for(const e of game.effects){ctx.save();ctx.globalAlpha=1-e.age/.65;const r=e.big?e.age*130:3+e.age*20;circle(e.x,e.y,r,red,null,1.3);for(let i=0;i<8;i++){const a=i*Math.PI/4;line(e.x+Math.cos(a)*r,e.y+Math.sin(a)*r,e.x+Math.cos(a)*(r+8),e.y+Math.sin(a)*(r+8),ink,.8);}ctx.restore();}
 if(game.state==='playing'&&touchAim===null){const {x,y}=pointer;circle(x,y,7,red,null,1);line(x-12,y,x-9,y,red);line(x+9,y,x+12,y,red);line(x,y-12,x,y-9,red);line(x,y+9,x,y+12,red);}
}
function frame(now){acc+=Math.min((now-last)/1000,.1);last=now;while(acc>=1/120){game.step(1/120,input());acc-=1/120;}sync();effects.tanks(game);draw();requestAnimationFrame(frame);}sync();requestAnimationFrame(frame);

const launchParams=new URLSearchParams(location.search);
if(launchParams.get('scores')==='1')$('highscores-button').click();
else if(launchParams.get('play')==='1')$('action').click();
