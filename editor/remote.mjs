import {isResumeUpload,isImageUpload,verifyResume,maxResumeBytes} from '../lib/pdf.mjs';
import {assertValid} from '../lib/schema.mjs';
const contentPath='content/portfolio.json';
const decode=content=>new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(content.replace(/\s/g,'')),c=>c.charCodeAt(0)));
const base64=bytes=>{let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
const fingerprint=data=>JSON.stringify(data);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function publishingReady(config,origin){
 return config?.enabled===true&&config.editorOrigin===origin&&/^https:\/\/[^/]+$/.test(config.authOrigin)&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository)&&config.branch==='main'&&Number.isSafeInteger(config.repositoryId)&&Number.isSafeInteger(config.allowedUserId)&&config.requiredCheck==='validate';
}
export function createRemote(config,{apiFactory,fetcher=fetch,now=()=>Date.now(),onExpire=()=>{},pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!publishingReady(config,config.editorOrigin))throw Error('GitHub publishing setup is incomplete.');
 const repo='/repos/'+config.repository,owner=config.repository.split('/')[0];
 let draftBranch='cms/portfolio/portfolio',token='',expires=0,api,expectedHead=null,publishedHead=null,publishedData=null,savedData=null,timer,controller=new AbortController(),busy=false;
 function end(){clearTimeout(timer);token='';expires=0;if(api)api.token='';api=null;controller.abort();}
 function check(){if(!token||expires<=now()){end();onExpire();throw Error('Sign-in expired. Your local draft is safe; sign in again before saving to GitHub.');}}
 async function request(path,options={}){
  check();const method=options.method||'GET';
  if(!path.startsWith(repo+'/')&&path!==repo&&path!=='/user'&&path!=='/repositories/'+config.repositoryId)throw Error('Blocked request outside the approved repository.');
  const suffix=path.slice(repo.length);const body=options.body?JSON.parse(options.body):null;
  if(method!=='GET'){
   const simple=(method==='POST'&&['/git/blobs','/git/trees','/git/commits'].includes(suffix))||(method==='PUT'&&/^\/issues\/\d+\/labels$/.test(suffix));
   const draftRef='/git/refs/heads/'+encodeURIComponent(draftBranch);
   const allowed=simple||(method==='POST'&&suffix==='/git/refs'&&body.ref==='refs/heads/'+draftBranch)||(method==='POST'&&suffix==='/pulls'&&body.head===owner+':'+draftBranch&&body.base===config.branch)||(method==='PATCH'&&suffix===draftRef&&body.force===false)||(method==='PUT'&&/^\/pulls\/\d+\/merge$/.test(suffix)&&sha(body.sha));
   if(!allowed)throw Error('Blocked write outside the portfolio draft workflow.');
   if(suffix==='/git/trees'&&(!Array.isArray(body.tree)||body.tree.some(f=>f.path!==contentPath&&!isImageUpload(f.path)&&!isResumeUpload(f.path))))throw Error('Only portfolio content, optimized images, and validated resume PDFs may be changed.');
  }
  const url=new URL('https://api.github.com'+path);for(const [k,v] of Object.entries(options.params||{}))url.searchParams.set(k,String(v));
  const response=await fetcher(url.href,{method,body:options.body,headers:{Accept:'application/vnd.github+json','Content-Type':'application/json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2026-03-10'},cache:'no-store',redirect:'error',signal:controller.signal});
  if(response.status===401){end();onExpire();throw Error('GitHub sign-in is no longer valid. Your local draft is safe; sign in again.');}
  if(!response.ok){const message=response.status===403?'GitHub denied this operation. Review the approved repository permissions or rate limit; no extra permission was requested.':response.status===409||response.status===422?'The GitHub draft changed or conflicts with another update. Export your local copy, then reload the GitHub draft.':response.status===405?'GitHub blocked the merge. Required checks or branch rules must be satisfied; force merging is disabled.':`GitHub request failed (${response.status}). Your local draft is safe.`;const e=Error(message);e.status=response.status;throw e;}
  if(response.status===204)return null;return response.json();
 }
 async function content(ref){const response=await request(repo+'/contents/'+contentPath,{params:{ref}});if(response.encoding!=='base64'||response.size>2_000_000)throw Error('Unexpected GitHub content format or size.');const wrapper=JSON.parse(decode(response.content));if(Object.keys(wrapper).join()!=='portfolio')throw Error('Unexpected fields in GitHub content.');return assertValid(wrapper.portfolio);}
 async function findDraft(){
  const pulls=await request(repo+'/pulls',{params:{base:config.branch,state:'open',per_page:100}});
  if(pulls.length>=100)throw Error('Too many open pull requests to safely select a portfolio draft. Review them in GitHub.');
  const matches=pulls.filter(p=>/^cms\/portfolio\/portfolio(?:-[a-f0-9]+)?$/.test(p.head?.ref)&&p.head?.repo?.id===config.repositoryId&&p.base?.repo?.id===config.repositoryId&&p.base?.ref===config.branch);
  if(matches.length>1)throw Error('Multiple portfolio draft pull requests exist. Review them in GitHub before continuing.');
  if(!matches.length)return null;const pr=matches[0];if(!Number.isSafeInteger(pr.number)||pr.number<=0||!sha(pr.head.sha))throw Error('GitHub returned an invalid revision.');
  return {pr,branch:pr.head.ref,head:pr.head.sha,data:await content(pr.head.sha)};
 }
 async function snapshot(){const branch=await request(repo+'/branches/'+config.branch);if(!sha(branch.commit?.sha))throw Error('Invalid published revision.');return {publishedHead:branch.commit.sha,published:await content(branch.commit.sha),draft:await findDraft()};}
 function adopt(state){draftBranch=state.draft?.branch||'cms/portfolio/portfolio-'+crypto.randomUUID().replace(/-/g,'').slice(0,12);publishedHead=state.publishedHead;publishedData=fingerprint(state.published);expectedHead=state.draft?.head||null;savedData=state.draft?fingerprint(state.draft.data):null;return state.draft?.data||state.published;}
 async function exclusive(fn){if(busy)throw Error('Wait for the current GitHub operation to finish.');busy=true;try{check();return await fn();}finally{busy=false;}}
 async function connect(credentials){
  end();controller=new AbortController();
  if(typeof credentials.token!=='string'||!credentials.token||credentials.token.length>1024||!Number.isFinite(credentials.expiresAt)||credentials.expiresAt<=now()||credentials.expiresAt>now()+28800000)throw Error('Invalid or expired sign-in result.');
  token=credentials.token;expires=credentials.expiresAt;
  try{
   const user=await request('/user'),repository=await request('/repositories/'+config.repositoryId);
   if(user.id!==config.allowedUserId||repository.id!==config.repositoryId||repository.full_name!==config.repository||repository.permissions?.push!==true||repository.private!==false)throw Error('The signed-in account or repository does not match the approved public portfolio.');
   api=await apiFactory({token,tokenKeyword:'Bearer',repo:config.repository,originRepo:config.repository,branch:config.branch,squashMerges:true,initialWorkflowStatus:'draft',cmsLabelPrefix:'',getUser:async()=>user});
   // All calls from the actual Decap API use this strict transport. Stock auth/storage is absent.
   api.request=request;api.forceMergePR=()=>{throw Error('Force merging is disabled.');};
   timer=setTimeout(()=>{end();onExpire();},Math.max(0,expires-now()));
   return await snapshot();
  }catch(e){end();throw e;}
 }
 async function saveDraft(data,images=new Map()){
  data=structuredClone(data);images=new Map(images);
  return exclusive(async()=>{
   assertValid(data);if(!publishedHead)throw Error('Load or reconcile GitHub content before saving a remote draft.');
   const current=await findDraft();if((current?.head||null)!==expectedHead)throw Error('The GitHub draft changed in another session. Export your copy, then load the GitHub draft.');
   const main=await request(repo+'/branches/'+config.branch);if(main.commit.sha!==publishedHead)throw Error('Published content changed. Export your local copy and reload before saving.');
   const assets=[];const knownMedia=new Set(JSON.parse(publishedData).media.map(m=>m.src));
   for(const m of data.media){if(!images.has(m.src)){if(!knownMedia.has(m.src)&&!current?.data.media.some(x=>x.src===m.src))throw Error('Missing uploaded image: '+m.src);continue;}
    const blob=images.get(m.src),bytes=new Uint8Array(await blob.arrayBuffer());const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
    if(bytes.length>2_000_000||m.src!=='assets/images/upload-'+hash+'.webp'||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')throw Error('Only optimized, hash-verified WebP uploads are accepted.');
    assets.push({path:m.src,toBase64:async()=>base64(bytes)});
   }
   if(images.has(data.site.resume)){
    const blob=images.get(data.site.resume);await verifyResume(data.site.resume,blob);const bytes=new Uint8Array(await blob.arrayBuffer());assets.push({path:data.site.resume,toBase64:async()=>base64(bytes)});
   }else if(data.site.resume!==JSON.parse(publishedData).site.resume&&data.site.resume!==current?.data.site.resume)throw Error('Missing uploaded resume PDF. Upload it or load the complete GitHub draft.');
   const files=[{path:contentPath,slug:draftBranch.split('/').at(-1),raw:JSON.stringify({portfolio:data},null,2)+'\n'}];
   if(current){
    // Append to the checked draft head, without Decap's implicit force-rebase fallback.
    const combined=[...files,...assets];await Promise.all(combined.map(f=>api.uploadBlob(f)));const tree=await api.updateTree(expectedHead,combined,draftBranch,false);const commit=await api.commit('Update portfolio draft',tree);await api.patchBranch(draftBranch,commit.sha,{force:false});
   }else await api.persistFiles(files,assets,{useWorkflow:true,unpublished:false,collectionName:'portfolio',commitMessage:'Update portfolio draft',status:'draft',hasSubfolders:false});
   const saved=await findDraft();if(!saved||fingerprint(saved.data)!==fingerprint(data))throw Error('Could not verify the saved GitHub draft. Reload before retrying.');
   await api.setPullRequestStatus(saved.pr,'draft');expectedHead=saved.head;savedData=fingerprint(data);return saved;
  });
 }
 async function publicJSON(path){const response=await fetcher('https://api.github.com'+repo+path,{headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'},cache:'no-store',redirect:'error'});if(!response.ok)throw Error('Public validation/deployment status is unavailable. Try again later.');return response.json();}
 async function review(data,{wait=false}={}){
  data=structuredClone(data);
  check();if(fingerprint(data)!==savedData)throw Error('Save the current changes to the GitHub draft before publishing.');const draft=await findDraft();if(!draft||draft.head!==expectedHead)throw Error('The GitHub draft changed. Load and review the latest version.');
  const files=await request(repo+'/pulls/'+draft.pr.number+'/files',{params:{per_page:100}});if(files.length>=100||files.some(f=>!['added','modified'].includes(f.status)||(f.filename!==contentPath&&!isResumeUpload(f.filename)&&(!isImageUpload(f.filename)||!data.media.some(m=>m.src===f.filename)))))throw Error('This pull request changes files outside the approved portfolio content. Review it in GitHub.');
  for(let attempt=0;;attempt++){
   const checks=await publicJSON('/commits/'+draft.head+'/check-runs?per_page=100&filter=latest');const required=checks.check_runs?.filter(c=>c.name===config.requiredCheck&&c.app?.slug==='github-actions'&&c.head_sha===draft.head)||[];
   if(required.length===1&&required[0].status==='completed'&&required[0].conclusion==='success')break;
   if(required.length>1)throw Error('GitHub returned conflicting validation results. Review the draft checks in GitHub.');
   if(required.length===1&&required[0].status==='completed')throw Error('The draft validation check did not pass ('+required[0].conclusion+'). Open Review public draft to see the check details. Your changes are saved.');
   if(!wait||attempt>=12)throw Error('GitHub is still validating your saved draft. Nothing has failed or been published. Wait a moment, then click Publish again.');
   await pause(10000);check();
  }
  const pr=await request(repo+'/pulls/'+draft.pr.number);if(pr.head?.sha!==expectedHead||pr.mergeable!==true||pr.mergeable_state!=='clean'||pr.state!=='open')throw Error('GitHub has not marked this draft ready to merge. Review conflicts, checks and branch rules.');
  return {number:pr.number,head:expectedHead,url:'https://github.com/'+config.repository+'/pull/'+pr.number};
 }
 async function publish(data,reviewed){return exclusive(async()=>{const latest=await review(data);if(latest.head!==reviewed.head||latest.number!==reviewed.number)throw Error('Draft changed after review. Review it again.');
  const result=await request(repo+'/pulls/'+latest.number+'/merge',{method:'PUT',body:JSON.stringify({sha:reviewed.head,merge_method:'squash',commit_title:'Publish portfolio content'})});
  if(result.merged!==true||!sha(result.sha))throw Error('GitHub did not confirm a merge. Check the pull request before retrying.');
  expectedHead=null;savedData=null;publishedHead=null;return {sha:result.sha,pullRequest:latest.url};
 });}
 async function deployment(revision){if(!sha(revision))throw Error('Invalid deployment revision.');const deployments=await publicJSON('/deployments?sha='+revision+'&environment=github-pages&per_page=10');const current=deployments.find(d=>d.sha===revision&&d.environment==='github-pages');if(!current)return {state:'pending'};const statuses=await publicJSON('/deployments/'+current.id+'/statuses?per_page=10');const status=statuses[0];return {state:status?.state||'pending',url:status?.environment_url||'',logURL:status?.log_url||''};}
 async function media(data,ref){check();if(!sha(ref))throw Error('Invalid media revision.');const results=new Map();for(const m of data.media.filter(m=>m.id.startsWith('upload-'))){
  const r=await request(repo+'/contents/'+m.src,{params:{ref}});if(r.encoding!=='base64'||r.size>2_000_000||typeof r.content!=='string'||r.content.length>3_000_000)throw Error('Invalid uploaded image response.');
  const bytes=Uint8Array.from(atob(r.content.replace(/\s/g,'')),c=>c.charCodeAt(0));const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
  if(bytes.length>2_000_000||m.id!=='upload-'+hash||m.src!=='assets/images/upload-'+hash+'.webp'||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')throw Error('GitHub image bytes do not match their stable filename.');
  const blob=new Blob([bytes],{type:'image/webp'}),bitmap=await createImageBitmap(blob);const valid=bitmap.width===m.width&&bitmap.height===m.height&&bitmap.width<=2400&&bitmap.height<=2400;bitmap.close();if(!valid)throw Error('GitHub image dimensions do not match the draft.');results.set(m.src,blob);
 }
 if(isResumeUpload(data.site.resume)){
  let r=await request(repo+'/contents/'+data.site.resume,{params:{ref}});
  if(r.size>maxResumeBytes)throw Error('GitHub resume exceeds 5 MB.');
  if(r.encoding==='none'&&sha(r.sha))r=await request(repo+'/git/blobs/'+r.sha);
  if(r.encoding!=='base64'||r.size>maxResumeBytes||typeof r.content!=='string'||r.content.length>7_000_000)throw Error('Invalid resume PDF response.');
  const blob=new Blob([Uint8Array.from(atob(r.content.replace(/\s/g,'')),c=>c.charCodeAt(0))],{type:'application/pdf'});await verifyResume(data.site.resume,blob);results.set(data.site.resume,blob);
 }
 return results;}
 return {connect,adopt,snapshot,saveDraft,review,publish,deployment,media,end,isConnected:()=>!!token&&expires>now()};
}
