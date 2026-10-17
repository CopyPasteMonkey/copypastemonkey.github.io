// Original ambient score: slow suspended chords, soft bell notes, and a quiet echo.
// Synthesized locally; no recordings, downloads, or game-physics dependencies.
const CHORDS=[[48,55,62,64],[45,52,59,60],[41,48,55,57],[43,50,57,60],
 [48,55,59,62],[45,52,60,64],[41,48,55,60],[43,50,57,62]];
export class SpaceMusic{
 constructor(){this.volume=.65;this.enabled=false;this.paused=false;this.active=false;this.context=null;this.voices=new Set();this.step=0;}
 setVolume(value){this.volume=value;if(this.context&&this.active){this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setTargetAtTime(value,this.context.currentTime,.03);}}
 async enable(){
  if(!this.context){const Audio=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Audio)throw Error('Audio unavailable');
   const c=this.context=new Audio();this.master=c.createGain();this.master.gain.value=0;
   const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=2200;
   this.bus=c.createGain();this.bus.connect(filter);filter.connect(this.master);this.master.connect(c.destination);
   this.echo=c.createDelay(3);this.echo.delayTime.value=.83;const feedback=c.createGain();feedback.gain.value=.26;
   const echoTone=c.createBiquadFilter();echoTone.type='lowpass';echoTone.frequency.value=1300;
   this.bus.connect(this.echo);this.echo.connect(echoTone);echoTone.connect(feedback);feedback.connect(this.echo);
   const wet=c.createGain();wet.gain.value=.22;echoTone.connect(wet);wet.connect(this.master);
  }
  await this.context.resume();this.enabled=true;this.update(this.paused);
 }
 mute(){this.enabled=false;this.stop();}
 update(paused){this.paused=paused;if(!this.enabled||!this.context)return;if(paused){if(this.active)this.stop();return;}
  if(!this.active){this.active=true;this.next=this.context.currentTime+.06;this.master.gain.cancelScheduledValues(this.context.currentTime);this.master.gain.setTargetAtTime(this.volume,this.context.currentTime,.35);this.timer=setInterval(()=>this.schedule(),50);this.schedule();}}
 stop(){this.step-=this.step%4;this.active=false;clearInterval(this.timer);this.timer=null;if(!this.context)return;const now=this.context.currentTime;this.master.gain.cancelScheduledValues(now);this.master.gain.setTargetAtTime(0,now,.025);for(const voice of this.voices)voice.stop(now+.08);this.voices.clear();}
 tone(note,time,duration,volume,pad=false,pan=0){
  const c=this.context,o=c.createOscillator(),g=c.createGain(),p=c.createStereoPanner();
  o.type=pad?'triangle':'sine';o.frequency.value=440*2**((note-69)/12);o.detune.value=pad?pan*5:0;p.pan.value=pan;
  const attack=pad?1.8:.025,release=pad?2.8:duration*.8;
  g.gain.setValueAtTime(0,time);g.gain.linearRampToValueAtTime(volume,time+attack);
  g.gain.setValueAtTime(volume,time+duration-release);g.gain.exponentialRampToValueAtTime(.00001,time+duration);
  o.connect(g);g.connect(p);p.connect(this.bus);this.voices.add(o);o.onended=()=>{this.voices.delete(o);o.disconnect();g.disconnect();p.disconnect();};o.start(time);o.stop(time+duration+.02);
 }
 schedule(){if(!this.active||this.context.state!=='running')return;const now=this.context.currentTime;if(this.next<now-.2)this.next=now+.06;
  while(this.next<now+.15){const beat=this.step%4,chord=CHORDS[Math.floor(this.step/4)%CHORDS.length];
   if(beat===0)chord.forEach((n,i)=>this.tone(n,this.next,10,.028,true,(i-1.5)*.35));
   if(beat===1||beat===3){const note=chord[(Math.floor(this.step/4)+beat)%chord.length]+24;this.tone(note,this.next,3.8,.045,false,beat===1?-.3:.3);this.tone(note+12,this.next,2.2,.007,false,0);}
   this.step++;this.next+=2;
  }
 }
}
