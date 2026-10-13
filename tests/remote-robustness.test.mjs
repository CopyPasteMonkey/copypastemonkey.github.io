import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {createRemote} from '../editor/remote.mjs';
const original=JSON.parse(await fs.readFile('content/portfolio.json')).portfolio;
const resumeBytes=await fs.readFile(original.site.resume);
const cfg={enabled:true,repository:'elidoggart/elidoggart.github.io',branch:'main',repositoryId:1,allowedUserId:2,editorOrigin:'https://editor.test',authOrigin:'https://auth.test',requiredCheck:'validate'};
const main='1'.repeat(40),head='2'.repeat(40),blobSHA='3'.repeat(40),root='/repos/'+cfg.repository;
const encoded=bytes=>({encoding:'base64',size:bytes.length,content:Buffer.from(bytes).toString('base64')});
const json=value=>new Response(JSON.stringify(value));
const pr={number:7,state:'open',head:{ref:'cms/portfolio/portfolio-aabbcc',sha:head,repo:{id:1}},base:{ref:'main',repo:{id:1}},mergeable:true,mergeable_state:'clean'};
async function session(t,{data=original,draft=false,handle=()=>{},...options}={}){
 const previousBitmap=globalThis.createImageBitmap;
 globalThis.createImageBitmap=async blob=>{const m=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();return {width:m.width,height:m.height,close(){}};};
 t.after(()=>{if(previousBitmap)globalThis.createImageBitmap=previousBitmap;else delete globalThis.createImageBitmap;});
 const calls=[];
 const fetcher=async(url,opts={})=>{
  const u=new URL(url),p=u.pathname.slice(root.length);calls.push({url:u,method:opts.method||'GET',body:opts.body});
  const result=await handle(u,opts,p);if(result!==undefined)return result;
  if(u.pathname==='/user')return json({id:2});
  if(u.pathname==='/repositories/1')return json({id:1,full_name:cfg.repository,private:false,permissions:{push:true}});
  if(p==='/branches/main')return json({commit:{sha:main}});
  if(p==='/pulls')return json(draft?[pr]:[]);
  if(p==='/contents/'+original.site.resume)return json(encoded(resumeBytes));
   // Serve existing editor uploads as fixtures; test-specific handlers run first.
   if(p.startsWith('/contents/assets/images/'))return json(encoded(await fs.readFile(p.slice('/contents/'.length))));
  if(p==='/contents/content/portfolio.json')return json(encoded(Buffer.from(JSON.stringify({portfolio:data}))));
  if(p.startsWith('/compare/'))return json({behind_by:0});
  if(p.endsWith('/check-runs'))return json({check_runs:[{name:'validate',app:{slug:'github-actions'},head_sha:head,status:'completed',conclusion:'success'}]});
  if(p==='/pulls/7')return json(pr);
  if(p==='/pulls/7/files')return json([{filename:'content/portfolio.json',status:'modified'}]);
  throw Error('Unexpected mock request '+p);
 };
 const remote=createRemote(cfg,{apiFactory:()=>({}),fetcher,...options});t.after(()=>remote.end());
 const state=await remote.connect({token:'test-only',expiresAt:Date.now()+3600000});remote.adopt(state);return {remote,calls};
}
test('reload permitted images above GitHub Contents inline limit via blob API',async t=>{
 const bytes=await sharp(crypto.randomBytes(800*600*3),{raw:{width:800,height:600,channels:3}}).png().toBuffer();assert.ok(bytes.length>1_000_000&&bytes.length<2_000_000);
 const id='upload-'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20),src='assets/images/'+id+'.png',data=structuredClone(original);data.media.push({id,src,width:800,height:600});
 globalThis.createImageBitmap=async blob=>{const m=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();return {width:m.width,height:m.height,close(){}};};t.after(()=>delete globalThis.createImageBitmap);
 const {remote,calls}=await session(t,{data,handle:(u,o,p)=>p==='/contents/'+src?json({encoding:'none',size:bytes.length,sha:blobSHA}):p==='/git/blobs/'+blobSHA?json(encoded(bytes)):undefined});
 assert.deepEqual(Buffer.from(await (await remote.media(data,main)).get(src).arrayBuffer()),bytes);assert.ok(calls.some(c=>c.url.pathname.endsWith('/git/blobs/'+blobSHA)));
});
test('load content between 1 and 2 MB using blob fallback',async t=>{
 const bytes=Buffer.from(JSON.stringify({portfolio:original})+' '.repeat(1_100_000));
 const {remote}=await session(t,{handle:(u,o,p)=>p==='/contents/content/portfolio.json'?json({encoding:'none',size:bytes.length,sha:blobSHA}):p==='/git/blobs/'+blobSHA?json(encoded(bytes)):undefined});
 assert.deepEqual((await remote.snapshot()).published,original);
});
test('oversized content is blocked before GitHub write operations',async t=>{
 const data=structuredClone(original);for(let i=0;i<180;i++)data.sections[0].entries[0].roles[0].blocks.push({type:'text',text:'x'.repeat(10000),style:'body'});
 // Spread blocks across roles to stay within the schema's per-list limit.
 const blocks=data.sections[0].entries[0].roles[0].blocks.splice(0);data.sections[0].entries[0].roles=[];
 for(let i=0;i<blocks.length;i+=90)data.sections[0].entries[0].roles.push({id:'stress-role-'+i,label:'',role:'',date:'',blocks:blocks.slice(i,i+90)});
 while(Buffer.byteLength(JSON.stringify({portfolio:data},null,2))<=2_000_000)data.sections[0].entries[0].roles.at(-1).blocks.push({type:'text',text:'x'.repeat(1000),style:'body'});
 assert.ok(Buffer.byteLength(JSON.stringify(data))<2_000_000);
 const {remote,calls}=await session(t);await assert.rejects(remote.saveDraft(data),/2 MB/);assert.ok(calls.every(c=>c.method==='GET'));
});
test('review paginates drafts with at least 100 changed files',async t=>{
 const files=Array.from({length:100},(_,i)=>({filename:'assets/documents/resume-'+i.toString(16).padStart(20,'0')+'.pdf',status:'added'}));
 const {remote,calls}=await session(t,{draft:true,handle:(u,o,p)=>p==='/pulls/7/files'?json(u.searchParams.get('page')==='2'?[{filename:'content/portfolio.json',status:'modified'}]:files):undefined});
 assert.equal((await remote.review(original)).head,head);assert.ok(calls.some(c=>c.url.searchParams.get('page')==='2'));
});
test('timed-out reads terminate and release session for retry',async t=>{
 let hang=false;
 const {remote}=await session(t,{requestTimeout:10,readRetries:0,handle:async(u,o,p)=>{if(hang&&p==='/branches/main')return new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(o.signal.reason),{once:true}));}});
 hang=true;await assert.rejects(remote.snapshot(),/timed out/i);hang=false;assert.equal((await remote.snapshot()).publishedHead,main);
});
test('transient reads retry but an ambiguous merge is never replayed',async t=>{
 let reads=0,writes=0;
 const {remote}=await session(t,{draft:true,pause:async()=>{},handle:(u,o,p)=>{
  if(p==='/branches/main'&&++reads===1)return new Response('{}',{status:503});
  if(p==='/pulls/7/merge'){writes++;throw new TypeError('network interrupted');}
 }});
 const reviewed=await remote.review(original);await assert.rejects(remote.publish(original,reviewed),/may have reached GitHub/);assert.equal(writes,1);assert.ok(reads>=2);
});
test('saved draft remains usable if its cosmetic label update fails',async t=>{
 let revision=head,writes=0;
 const api={uploadBlob:async()=>{},updateTree:async()=>({}),commit:async()=>({sha:'4'.repeat(40)}),patchBranch:async()=>{revision='4'.repeat(40);writes++;},setPullRequestStatus:async()=>{throw Error('label denied');}};
 const {remote}=await session(t,{draft:true,apiFactory:()=>api,handle:(u,o,p)=>p==='/pulls'?json([{...pr,head:{...pr.head,sha:revision}}]):undefined});
 const first=await remote.saveDraft(original);assert.match(first.warning,/Draft saved/);await remote.saveDraft(original);assert.equal(writes,2);
});
test('unapproved files on a later review page still block publication',async t=>{
 const first=Array.from({length:100},(_,i)=>({filename:'assets/documents/resume-'+i.toString(16).padStart(20,'0')+'.pdf',status:'added'}));
 const {remote}=await session(t,{draft:true,handle:(u,o,p)=>p==='/pulls/7/files'?json(u.searchParams.get('page')==='2'?[{filename:'app.js',status:'modified'}]:first):undefined});
 await assert.rejects(remote.review(original),/outside the approved/);
});
test('large-file fallback does not bypass size or content hash checks',async t=>{
 const data=structuredClone(original),src='assets/images/upload-'+'a'.repeat(20)+'.png';data.media.push({id:'upload-'+'a'.repeat(20),src,width:2,height:2});
 const {remote}=await session(t,{handle:(u,o,p)=>p==='/contents/'+src?json({encoding:'none',size:1_100_000,sha:blobSHA}):p==='/git/blobs/'+blobSHA?json(encoded(Buffer.alloc(2_000_001))):undefined});
 await assert.rejects(remote.media(data,main),/Invalid uploaded image|allowed size/);
});
