import {bindAudioControl} from './audio-controls.js';
// Quiet, locally synthesized effects shared by both games. No physics changes.
export class SoundEffects{
 constructor(){this.volume=.24;this.enabled=false;this.paused=false;this.context=null;this.voices=new Set();this.last=new Map();this.seen=new WeakSet();this.previous=null;}
 setVolume(value){this.volume=value;if(this.context)this.master.gain.setTargetAtTime(value,this.context.currentTime,.03);}
 async enable(){if(!this.context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');const c=this.context=new Audio();this.master=c.createGain();this.master.gain.value=this.volume;this.master.connect(c.destination);this.noise=c.createBuffer(1,c.sampleRate,c.sampleRate);const data=this.noise.getChannelData(0);let seed=927;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}}await this.context.resume();this.enabled=true;}
 mute(){this.enabled=false;this.stop();}
 stop(){for(const source of this.voices){try{source.stop();}catch{}}this.voices.clear();}
 setPaused(value){if(value&&!this.paused)this.stop();this.paused=value;}
 play(kind,level=1){
  if(!this.enabled||this.paused||!this.context||this.context.state!=='running'||this.voices.size>=8)return;
  const c=this.context,now=c.currentTime,interval=kind==='engine'||kind==='tracks'?.18:.06;
  if(now-(this.last.get(kind)??-100)<interval)return;this.last.set(kind,now);
  const settings={shot:[650,190,.10,.22],laser:[1000,430,.09,.15],bounce:[1400,850,.045,.13],impact:[130,45,.22,.28],mine:[350,230,.09,.16],dock:[440,660,.17,.14],cargo:[660,880,.22,.14],damage:[180,70,.18,.23],engine:[95,75,.23,.035],tracks:[150,100,.12,.035]}[kind];
  if(!settings)return;const [from,to,duration,volume]=settings,g=c.createGain(),filter=c.createBiquadFilter();filter.type=kind==='engine'?'highpass':'lowpass';filter.frequency.value=kind==='engine'?180:kind==='tracks'?700:2400;
  const noisy=['impact','engine','tracks'].includes(kind),source=noisy?c.createBufferSource():c.createOscillator();
  if(noisy)source.buffer=this.noise;else{source.type='sine';source.frequency.setValueAtTime(from,now);source.frequency.exponentialRampToValueAtTime(to,now+duration);}
  g.gain.setValueAtTime(0,now);g.gain.linearRampToValueAtTime(volume*level,now+.008);g.gain.exponentialRampToValueAtTime(.00001,now+duration);
  source.connect(filter);filter.connect(g);g.connect(this.master);this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();filter.disconnect();g.disconnect();};source.start(now);source.stop(now+duration+.01);
 }
 tanks(game){
  this.setPaused(document.hidden||game.state==='paused'||game.state==='ready');
  for(const shot of game.shots)if(!this.seen.has(shot)){this.seen.add(shot);this.play('shot',shot.owner===0?1:.35);}
  for(const effect of game.effects)if(!this.seen.has(effect)){this.seen.add(effect);this.play(effect.big?'impact':'bounce',effect.big?.7:.5);}
  for(const mine of game.mines)if(!this.seen.has(mine)){this.seen.add(mine);this.play('mine',mine.owner===0?1:.3);}
  const p=game.player,prev=this.previous;if(prev&&game.state==='playing'&&prev.player===p&&Math.hypot(p.x-prev.x,p.y-prev.y)>.1)this.play('tracks');
  this.previous={player:p,x:p.x,y:p.y};
 }
 space(mission,blocked=false){
  this.setPaused(document.hidden||blocked||mission.state==='paused'||mission.state==='ready');const s=mission.ship;
  for(const shot of mission.shots)if(!this.seen.has(shot)){this.seen.add(shot);if(!shot.alien||Math.hypot(shot.x-s.x,shot.y-s.y)<700)this.play('laser',shot.alien?.3:1);}
  const p=this.previous;if(p&&p.ship===s){if(s.hull<p.hull||mission.rescues>p.rescues)this.play('damage');else if(!p.docked&&s.docked)this.play('dock');if(s.cargo&&!p.cargo||mission.delivered>p.delivered)this.play('cargo');if(mission.kills>p.kills)this.play('impact',.6);}
  if(s.engine&&!s.docked)this.play('engine');this.previous={ship:s,hull:s.hull,rescues:mission.rescues,docked:s.docked,cargo:s.cargo,delivered:mission.delivered,kills:mission.kills};
 }
}
export function bindSounds(button,effects){bindAudioControl(button,effects,{name:'effects',maxGain:.48});addEventListener('pagehide',()=>effects.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)effects.setPaused(true);});}
