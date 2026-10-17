// A click toggles audio; a vertical drag adjusts volume without toggling it.
export function bindAudioControl(button,audio,{name='music',maxGain=1}={}){
 let drag=null,suppressClick=false,busy=false,hideTimer;
 const tip=document.createElement('output');tip.className='audio-volume-tip';tip.hidden=true;document.body.append(tip);
 const fraction=()=>Math.max(0,Math.min(1,audio.volume/maxGain));
 function render(){const percent=Math.round(fraction()*100);button.textContent=`${audio.enabled?'Mute':'Unmute'} ${name}`;button.setAttribute('aria-pressed',String(audio.enabled));button.title=`${percent}% volume · Click to mute/unmute · Drag up/down or use arrow keys to adjust`;button.setAttribute('aria-description',`${percent} percent volume. Drag up or down, or use up and down arrow keys to adjust.`);button.dataset.volume=String(percent);tip.textContent=`${percent}%`;}
 function show(){clearTimeout(hideTimer);const b=button.getBoundingClientRect();tip.style.left=`${Math.max(30,Math.min(innerWidth-30,b.left+b.width/2))}px`;tip.style.top=`${Math.max(8,b.top-32)}px`;tip.hidden=false;hideTimer=setTimeout(()=>tip.hidden=true,1100);}
 function set(value){audio.setVolume(Math.max(0,Math.min(1,value))*maxGain);render();show();}
 button.style.touchAction='none';button.style.userSelect='none';
 button.addEventListener('pointerdown',e=>{if(e.button!==0||busy)return;suppressClick=false;drag={id:e.pointerId,y:e.clientY,start:fraction(),moved:false};button.setPointerCapture(e.pointerId);});
 button.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const distance=drag.y-e.clientY;if(Math.abs(distance)>5)drag.moved=true;if(drag.moved){suppressClick=true;e.preventDefault();set(drag.start+distance/150);}});
 const release=e=>{if(!drag||e.pointerId!==drag.id)return;const moved=drag.moved;drag=null;if(moved){suppressClick=true;show();}if(button.hasPointerCapture(e.pointerId))button.releasePointerCapture(e.pointerId);};
 button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
 button.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();set(fraction()+(e.key==='ArrowUp'?.05:-.05));}});
 button.onclick=async e=>{if(suppressClick&&e.detail!==0){suppressClick=false;e.preventDefault();return;}if(busy)return;busy=true;button.disabled=true;try{if(audio.enabled)audio.mute();else await audio.enable();render();}catch{button.textContent=`Retry ${name}`;button.title='Audio could not start. Click to retry.';}finally{busy=false;button.disabled=false;if(e.detail)button.blur();}};
 render();
}
