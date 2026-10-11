// Wired into the editor, but disabled until the separately approved live setup.
export function trustedMessage(event,popup,origin){return event.source===popup&&event.origin===origin&&event.data&&typeof event.data==='object';}
export function signIn(authOrigin,{host=window,timeoutMs=180000}={}){
 const origin=new URL(authOrigin);if(origin.protocol!=='https:'||origin.origin!==authOrigin)throw Error('Use the exact approved HTTPS authentication origin.');
 const popup=host.open(authOrigin+'/auth','Portfolio sign-in','popup,width=680,height=760');
 if(!popup)return Promise.reject(Error('Allow the sign-in popup, then try again.'));
 return new Promise((resolve,reject)=>{
  let ready=false;let finished=false;
  const cleanup=()=>{host.removeEventListener('message',receive);clearInterval(poll);clearTimeout(timeout);popup.close();};
  const finish=(error,value)=>{if(finished)return;finished=true;cleanup();error?reject(error):resolve(value);};
  const receive=event=>{
   if(!trustedMessage(event,popup,authOrigin))return;
   if(event.data.type==='portfolio:ready'){ready=true;popup.postMessage({type:'portfolio:ack'},authOrigin);return;}
   const d=event.data;
   if(ready&&d.type==='portfolio:authorized'&&d.provider==='github'&&typeof d.token==='string'&&d.token.length<1024&&Number.isFinite(d.expiresAt)&&d.expiresAt>Date.now()&&d.expiresAt<=Date.now()+28800000)finish(null,{token:d.token,provider:d.provider,expiresAt:d.expiresAt});
  };
  host.addEventListener('message',receive);
  const poll=setInterval(()=>{if(popup.closed)finish(Error('Sign-in was cancelled. Your draft is still available.'));},500);
  const timeout=setTimeout(()=>finish(Error('Sign-in timed out. Try again; your draft is still available.')),timeoutMs);
 });
}
