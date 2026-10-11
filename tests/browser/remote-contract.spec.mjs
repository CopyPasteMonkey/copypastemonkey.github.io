import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const portfolio=JSON.parse(fs.readFileSync('content/portfolio.json')).portfolio;
test('actual Decap API supports guarded draft/upload/reload/publish/expiry with mocked GitHub',async({page})=>{
 await page.goto('/editor/');
 const result=await page.evaluate(async(initial)=>{
  const {DecapAPI}=await import('/editor/vendor/decap-api.mjs');const {createRemote}=await import('/editor/remote.mjs');
  const cfg={enabled:true,repository:'elidoggart/elidoggart.github.io',branch:'main',repositoryId:1412250381,allowedUserId:183743177,editorOrigin:location.origin,authOrigin:'https://auth.example.test',requiredCheck:'validate'};
  const root='/repos/'+cfg.repository,calls=[],blobs=new Map(),trees=new Map(),commits=new Map(),branches=new Map();let counter=0,pr=null,checkState='success',denyMerge=false,time=Date.now(),deployed=false;
  const id=()=> (++counter).toString(16).padStart(40,'0'),main=id();branches.set('main',main);commits.set(main,{data:structuredClone(initial),parents:[]});
  const b64=s=>btoa(String.fromCharCode(...new TextEncoder().encode(s)));const json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
  const mock=async(url,options={})=>{
   const u=new URL(url),p=u.pathname,m=options.method||'GET',b=options.body?JSON.parse(options.body):null;calls.push({path:p,method:m,body:b,authorized:!!options.headers?.Authorization});
   if(p==='/user')return json({id:cfg.allowedUserId,login:'elidoggart'});
   if(p==='/repositories/'+cfg.repositoryId)return json({id:cfg.repositoryId,full_name:cfg.repository,private:false,permissions:{push:true}});
   const suffix=p.slice(root.length);
   if(m==='GET'&&suffix.startsWith('/branches/')){const ref=decodeURIComponent(suffix.slice(10));return branches.has(ref)?json({commit:{sha:branches.get(ref)}}):new Response('{}',{status:404});}
   if(m==='GET'&&suffix==='/contents/content/portfolio.json'){const data=commits.get(u.searchParams.get('ref'))?.data;return json({encoding:'base64',size:100000,content:b64(JSON.stringify({portfolio:data}))});}
   if(suffix==='/pulls'&&m==='GET')return json(pr?.state==='open'?[pr]:[]);
   if(m==='POST'&&suffix==='/git/blobs'){const hash=id();blobs.set(hash,b.content);return json({sha:hash});}
   if(m==='POST'&&suffix==='/git/trees'){const hash=id();trees.set(hash,b);return json({sha:hash});}
   if(m==='POST'&&suffix==='/git/commits'){const hash=id(),tree=trees.get(b.tree),file=tree.tree.find(x=>x.path==='content/portfolio.json');const data=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(blobs.get(file.sha)),c=>c.charCodeAt(0)))).portfolio;commits.set(hash,{data,parents:b.parents});return json({sha:hash});}
   if(m==='POST'&&suffix==='/git/refs'){const ref=b.ref.slice('refs/heads/'.length);if(branches.has(ref))return new Response('{}',{status:422});branches.set(ref,b.sha);return json({ref:b.ref,object:{sha:b.sha}});}
   if(m==='POST'&&suffix==='/pulls'){const ref=b.head.slice('elidoggart:'.length);pr={number:7,head:{ref,sha:branches.get(ref),repo:{id:cfg.repositoryId}},base:{ref:'main',repo:{id:cfg.repositoryId}},state:'open',labels:[],mergeable:true,mergeable_state:'clean',html_url:'https://github.com/'+cfg.repository+'/pull/7'};return json(pr);}
   if(m==='PUT'&&suffix==='/issues/7/labels'){pr.labels=b.labels.map(name=>({name}));return json(pr.labels);}
   if(m==='PATCH'&&suffix.startsWith('/git/refs/heads/')){const ref=decodeURIComponent(suffix.slice('/git/refs/heads/'.length));if(b.force||commits.get(b.sha).parents[0]!==branches.get(ref))return new Response('{}',{status:422});branches.set(ref,b.sha);pr.head.sha=b.sha;return json({object:{sha:b.sha}});}
   if(m==='GET'&&suffix.startsWith('/commits/')&&suffix.endsWith('/check-runs'))return json({check_runs:[{name:'validate',app:{slug:'github-actions'},head_sha:pr.head.sha,status:'completed',conclusion:checkState}]});
   if(m==='GET'&&suffix==='/pulls/7')return json(pr);
   if(m==='GET'&&suffix==='/pulls/7/files')return json([{filename:'content/portfolio.json',status:'modified'}]);
   if(m==='PUT'&&suffix==='/pulls/7/merge'){if(denyMerge)return new Response('{}',{status:405});if(b.sha!==pr.head.sha)return new Response('{}',{status:409});const merged=id();commits.set(merged,{data:commits.get(pr.head.sha).data,parents:[branches.get('main')]});branches.set('main',merged);pr.state='closed';return json({merged:true,sha:merged});}
   if(m==='GET'&&suffix==='/deployments')return json(deployed?[{id:5,sha:branches.get('main'),environment:'github-pages'}]:[]);
   if(m==='GET'&&suffix==='/deployments/5/statuses')return json([{state:'success',environment_url:'https://www.elidoggart.com'}]);
   throw Error('Unexpected mocked GitHub operation: '+m+' '+p);
  };
  const session=createRemote(cfg,{apiFactory:o=>new DecapAPI(o),fetcher:mock,now:()=>time});const credentials={token:'inert-contract-test-token',expiresAt:time+3600000};
  const state=await session.connect(credentials);session.adopt(state);const data=structuredClone(initial);data.site.name='Contract draft';
  const image=await (await fetch('/assets/images/nimbus-00.webp')).blob();const bytes=new Uint8Array(await image.arrayBuffer()),hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20),src='assets/images/upload-'+hash+'.webp';data.media.push({id:'upload-'+hash,src,width:1280,height:616});
  const first=await session.saveDraft(data,new Map([[src,image]]));const unchanged=commits.get(main).data.site.name===initial.site.name;data.site.profession='Updated second draft';const second=await session.saveDraft(data,new Map([[src,image]]));
  let blockedChecks=false;checkState='failure';try{await session.review(data);}catch{blockedChecks=true;}checkState='success';const reviewed=await session.review(data);
  denyMerge=true;let blockedMerge=false;const before=calls.length;try{await session.publish(data,reviewed);}catch(e){blockedMerge=e.message.includes('force merging is disabled');}const noForceFallback=calls.slice(before).every(c=>c.method!=='PATCH');denyMerge=false;
  const published=await session.publish(data,reviewed);const pending=await session.deployment(published.sha);deployed=true;const success=await session.deployment(published.sha);
  const next=await session.snapshot();session.adopt(next);data.site.name='Next publication';await session.saveDraft(data);const uniqueBranch=pr.head.ref!==first.branch;
  // Stale remote revision blocks mutation before any upload.
  pr.head.sha=id();commits.set(pr.head.sha,{data,parents:[]});const beforeConflict=calls.length;let conflict=false;try{await session.saveDraft(data);}catch(e){conflict=e.message.includes('another session');}const conflictReadOnly=calls.slice(beforeConflict).every(c=>c.method==='GET');
  time=credentials.expiresAt+1;let expired=false;try{await session.saveDraft(data);}catch(e){expired=e.message.includes('expired');}session.end();
  return {unchanged,uploaded:calls.some(c=>c.path.endsWith('/git/trees')&&c.body.tree.some(f=>f.path===src)),updated:first.head!==second.head,blockedChecks,blockedMerge,noForceFallback,merged:!!published.sha,pending:pending.state,success:success.state,uniqueBranch,conflict,conflictReadOnly,expired,forceWrites:calls.filter(c=>c.body?.force===true).length,mainWrites:calls.filter(c=>c.method==='PATCH'&&c.path.endsWith('/main')).length,publicChecksNoToken:calls.filter(c=>c.path.endsWith('/check-runs')).every(c=>!c.authorized),storedToken:Object.values(localStorage).some(v=>v.includes(credentials.token))};
 },portfolio);
 expect(result).toEqual({unchanged:true,uploaded:true,updated:true,blockedChecks:true,blockedMerge:true,noForceFallback:true,merged:true,pending:'pending',success:'success',uniqueBranch:true,conflict:true,conflictReadOnly:true,expired:true,forceWrites:0,mainWrites:0,publicChecksNoToken:true,storedToken:false});
});
