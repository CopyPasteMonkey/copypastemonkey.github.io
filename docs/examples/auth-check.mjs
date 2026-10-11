// Review-only source. Publish only after approval; excluded from the normal build.
import {signIn} from './auth-client.mjs';

const editorOrigin='https://www.elidoggart.com';
const authOrigin='https://portfolio-editor-auth.elidoggart.workers.dev';
const button=document.querySelector('#check');
const status=document.querySelector('#status');
const message=text=>{status.textContent=text;};

if(location.origin!==editorOrigin){
  message('This check must run on the approved portfolio domain. No sign-in was started.');
}else{
  button.disabled=false;
  message('Ready. The check will open GitHub sign-in in a popup.');
}

button.addEventListener('click',async()=>{
  if(location.origin!==editorOrigin)return;
  button.disabled=true;
  message('Complete sign-in in the popup. You can close it to cancel.');
  let session;
  const controller=new AbortController();
  const headers=new Headers({Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'});
  const leave=()=>controller.abort();
  window.addEventListener('pagehide',leave,{once:true});
  try{
    session=await signIn(authOrigin);
    if(controller.signal.aborted||session.expiresAt<=Date.now())throw Error('Session unavailable');
    headers.set('Authorization','Bearer '+session.token);
    const read=async path=>{
      const response=await fetch('https://api.github.com'+path,{method:'GET',headers,cache:'no-store',redirect:'error',signal:controller.signal});
      if(!response.ok)throw Error('Provider request failed');
      return response.json();
    };
    const user=await read('/user');
    if(user.id!==183743177)throw Error('Unexpected identity');
    const repository=await read('/repositories/1412250381');
    if(repository.id!==1412250381||repository.full_name!=='elidoggart/elidoggart.github.io'||repository.private!==false||repository.permissions?.push!==true)throw Error('Unexpected repository');
    message('Sign-in completed. The approved account and repository were verified. No repository writes were made. The temporary session has been discarded.');
  }catch{
    message('The check did not complete. No repository writes were made. Close any sign-in popup and try again.');
  }finally{
    controller.abort();
    headers.delete('Authorization');
    if(session)session.token='';
    session=undefined;
    window.removeEventListener('pagehide',leave);
    button.disabled=false;
  }
});
