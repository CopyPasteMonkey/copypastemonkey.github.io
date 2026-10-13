import {element} from './form.mjs';
const key='portfolio-pending-publication';
export function createPublishProgress({anchor,checkDeployment,interval=10000,maxWait=600000,storage=sessionStorage,activityURL}){
 const title=element('strong'),message=element('p'),steps=element('ol',{'aria-label':'Publishing stages'}),retry=element('button',{text:'Check again',type:'button',hidden:true}),link=element('a',{href:new URL('../',location.href).href,target:'_blank',rel:'noopener',text:'Open live website',hidden:true});
 const activity=element('a',{href:activityURL||'https://github.com/elidoggart/elidoggart.github.io/actions',target:'_blank',rel:'noopener',text:'View deployment in GitHub',hidden:true});
 const labels=['Check draft','Publish draft','Update website','Live'];
 const items=labels.map(text=>element('li',{text}));steps.append(...items);
 const panel=element('section',{class:'publish-progress',hidden:true,'aria-label':'Publication progress'},element('div',{role:'status','aria-live':'polite','aria-atomic':'true'},title,message),steps,element('div',{class:'publish-progress-actions'},retry,link,activity));anchor.after(panel);
 let timer,pending=null,checking=false,generation=0,failed=false;
 function show(stage,heading,detail,error=false){panel.hidden=false;panel.classList.toggle('error',error);title.textContent=heading;message.textContent=detail;items.forEach((item,i)=>{item.classList.toggle('complete',i<stage);item.classList.toggle('current',i===stage);if(i===stage)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});retry.hidden=true;link.hidden=stage!==4;activity.hidden=stage!==2;}
 function remember(){try{if(pending)storage.setItem(key,JSON.stringify(pending));else storage.removeItem(key);}catch{}}
 function stop(){clearTimeout(timer);generation++;}
 async function refresh(){
  if(!pending||checking)return;clearTimeout(timer);checking=true;retry.disabled=true;const run=generation;
  try{const result=await checkDeployment(pending.sha);if(run!==generation)return;
   if(result.state==='success'){show(4,'Your changes are live','The website has finished updating. Open the live website to see your changes.');pending=null;remember();return;}
   if(['failure','error','inactive'].includes(result.state)){failed=true;show(2,'Website update needs attention','Your draft was published, but the website update did not finish successfully. Check the deployment in GitHub, then try Check again.',true);retry.hidden=false;return;}
   const elapsed=Math.floor((Date.now()-pending.started)/1000),time=elapsed<60?elapsed+' seconds':Math.floor(elapsed/60)+' min '+elapsed%60+' sec';
   show(2,'Updating your website…','Your draft is published. GitHub is building and deploying the website. Usually 1–2 minutes · '+time+' elapsed. Checking automatically every 10 seconds.');
   if(Date.now()-pending.started>=maxWait){show(2,'Taking longer than usual','Your draft is published, but the website update is still pending. You can check again; there is no need to publish twice.');retry.hidden=false;return;}
   timer=setTimeout(refresh,interval);
  }catch{if(run!==generation)return;show(2,'Unable to check the website update','Your draft is published. The connection or GitHub status service is unavailable. Check again to see whether it is live.',true);retry.hidden=false;
  }finally{checking=false;retry.disabled=false;}
 }
 retry.onclick=()=>{if(pending){pending.started=Date.now();remember();}return refresh();};
 return {
  review(){stop();pending=null;failed=false;remember();show(0,'Checking your draft…','Waiting for GitHub to validate your saved draft. This usually takes under a minute. Checking automatically; no need to click Publish again.');},
  ready(){show(1,'Ready to publish','Your draft passed validation. Confirm Publish reviewed draft in the review window to continue.');},
  merging(){show(1,'Publishing your draft…','Sending the reviewed draft to GitHub. Please wait; do not click Publish again.');},
  error(detail){show(0,'Publication could not continue',detail,true);},
  start(sha){stop();failed=false;pending={sha,started:Date.now()};remember();show(2,'Updating your website…','Your draft is published. The website normally updates in 1–2 minutes. Checking automatically…');return refresh();},
  resume(){try{const saved=JSON.parse(storage.getItem(key));if(/^[a-f0-9]{40}$/.test(saved?.sha)&&Number.isFinite(saved.started)){pending=saved;show(2,'Checking your website update…','Resuming the status check for your last publication.');return refresh();}}catch{}},
  refresh,
  isPending:()=>!!pending&&!failed,
  destroy(){stop();panel.remove();}
 };
}
