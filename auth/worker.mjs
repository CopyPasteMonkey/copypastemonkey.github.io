// UNPROVISIONED review implementation. No account, app, binding or secret is created by this file.
const cookieName='__Host-portfolio_oauth';
const ttl=600;
const encoder=new TextEncoder(),decoder=new TextDecoder();
const headers={'Cache-Control':'no-store','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'};
const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const un64=text=>Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const random=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
const cookie=(value,age=ttl)=>`${cookieName}=${value}; Path=/; Max-Age=${age}; Secure; HttpOnly; SameSite=Lax`;
function configured(env){
 for(const name of ['AUTH_ORIGIN','EDITOR_ORIGIN']){const u=new URL(env[name]);if(u.protocol!=='https:'||u.origin!==env[name])throw Error('configuration');}
 if(!/^\d+$/.test(env.REPOSITORY_ID)||!/^\d+$/.test(env.ALLOWED_USER_ID)||!env.CLIENT_ID||!env.CLIENT_SECRET||!env.COOKIE_KEY||env.COOKIE_KEY.length<32)throw Error('configuration');
}
async function key(env){const digest=await crypto.subtle.digest('SHA-256',encoder.encode(env.COOKIE_KEY));return crypto.subtle.importKey('raw',digest,'AES-GCM',false,['encrypt','decrypt']);}
async function seal(value,env){const iv=crypto.getRandomValues(new Uint8Array(12));const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:encoder.encode(env.AUTH_ORIGIN)},await key(env),encoder.encode(JSON.stringify(value)));return b64(iv)+'.'+b64(new Uint8Array(cipher));}
async function unseal(value,env){const [iv,cipher,...rest]=value.split('.');if(rest.length||!iv||!cipher)throw Error('cookie');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:un64(iv),additionalData:encoder.encode(env.AUTH_ORIGIN)},await key(env),un64(cipher));return JSON.parse(decoder.decode(plain));}
const fixedEqual=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};
function fail(status=400){return new Response('Sign-in was not completed. Close this window and try again from the portfolio editor.',{status,headers:{...headers,'Content-Type':'text/plain; charset=utf-8','Set-Cookie':cookie('',0)}});}
async function githubJSON(fetcher,url,options){const res=await fetcher(url,options);if(!res.ok)throw Error('provider');const text=await res.text();if(text.length>100_000)throw Error('provider');return JSON.parse(text);}
export async function handle(request,env,{fetcher=fetch,now=()=>Date.now()}={}){
 try{configured(env);}catch{return fail(503);}
 const url=new URL(request.url);if(url.origin!==env.AUTH_ORIGIN||request.method!=='GET')return fail(405);
 const origin=request.headers.get('Origin');if(origin&&origin!==env.EDITOR_ORIGIN&&origin!==env.AUTH_ORIGIN)return fail(403);
 if(url.pathname==='/auth'){
  // No caller-chosen callback, repository, user, scope or redirect URI is accepted.
  if([...url.searchParams.keys()].length)return fail();
  const state=random(),verifier=random();const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(verifier))));
  const binding=await seal({state,verifier,issued:now(),expires:now()+ttl*1000},env);
  const target=new URL('https://github.com/login/oauth/authorize');target.search=new URLSearchParams({client_id:env.CLIENT_ID,redirect_uri:env.AUTH_ORIGIN+'/callback',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
  return new Response(null,{status:302,headers:{...headers,Location:target.href,'Set-Cookie':cookie(binding)}});
 }
 if(url.pathname!=='/callback')return fail(404);
 try{
  if(url.searchParams.has('error')||url.searchParams.getAll('state').length!==1||url.searchParams.getAll('code').length!==1)throw Error('cancelled');
  const cookies=(request.headers.get('Cookie')||'').split(';').map(v=>v.trim()).filter(v=>v.startsWith(cookieName+'='));if(cookies.length!==1)throw Error('cookie');
  const binding=await unseal(cookies[0].slice(cookieName.length+1),env);
  if(binding.expires<=now()||binding.issued>now()||binding.expires-binding.issued!==ttl*1000||!fixedEqual(binding.state,url.searchParams.get('state')))throw Error('state');
  const code=url.searchParams.get('code');if(!/^[A-Za-z0-9_-]{1,512}$/.test(code))throw Error('code');
  const token=await githubJSON(fetcher,'https://github.com/login/oauth/access_token',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({client_id:env.CLIENT_ID,client_secret:env.CLIENT_SECRET,code,redirect_uri:env.AUTH_ORIGIN+'/callback',code_verifier:binding.verifier,repository_id:env.REPOSITORY_ID})});
  if(token.error||typeof token.access_token!=='string'||token.access_token.length>1024||/[\s<>]/.test(token.access_token)||!Number.isInteger(token.expires_in)||token.expires_in<=0||token.expires_in>28800)throw Error('token');
  const apiHeaders={Accept:'application/vnd.github+json',Authorization:'Bearer '+token.access_token,'X-GitHub-Api-Version':'2026-03-10','User-Agent':'portfolio-editor-auth'};
  const user=await githubJSON(fetcher,'https://api.github.com/user',{headers:apiHeaders});if(String(user.id)!==env.ALLOWED_USER_ID)throw Error('user');
  const repo=await githubJSON(fetcher,'https://api.github.com/repositories/'+env.REPOSITORY_ID,{headers:apiHeaders});if(String(repo.id)!==env.REPOSITORY_ID||repo.permissions?.push!==true)throw Error('repo');
  const nonce=random();const payload=JSON.stringify({type:'portfolio:authorized',token:token.access_token,provider:'github',expiresAt:now()+token.expires_in*1000}).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026');
  const originJSON=JSON.stringify(env.EDITOR_ORIGIN);
  const html=`<!doctype html><meta charset="utf-8"><title>Finish portfolio sign-in</title><p>Completing sign-in. You can close this window if the editor is no longer open.</p><script nonce="${nonce}">(()=>{const origin=${originJSON};const target=window.opener;if(!target)return;let sent=false;const listener=e=>{if(sent||e.origin!==origin||e.source!==target||e.data?.type!=='portfolio:ack')return;sent=true;window.removeEventListener('message',listener);target.postMessage(${payload},origin);window.close();};window.addEventListener('message',listener);target.postMessage({type:'portfolio:ready'},origin);setTimeout(()=>{window.removeEventListener('message',listener);window.close();},60000);})();</script>`;
  return new Response(html,{headers:{...headers,'Content-Type':'text/html; charset=utf-8','Set-Cookie':cookie('',0),'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`}});
 }catch{return fail();}
}
export default {fetch:(request,env)=>handle(request,env)};
