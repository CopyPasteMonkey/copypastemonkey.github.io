import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const portfolio=JSON.parse(fs.readFileSync('content/portfolio.json')).portfolio;
test('remote sessions fail closed for wrong identity, missing expiry, denied access and revoked credentials',async({page})=>{
 await page.goto('/editor/');
 const result=await page.evaluate(async data=>{
  const {createRemote}=await import('/editor/remote.mjs');
  const cfg={enabled:true,repository:'elidoggart/elidoggart.github.io',branch:'main',repositoryId:1412250381,allowedUserId:183743177,editorOrigin:location.origin,authOrigin:'https://auth.example.test',requiredCheck:'validate'};
  let who=cfg.allowedUserId,push=true,reject=0,expiredEvents=0,calls=0;
  const mock=async url=>{calls++;if(reject)return new Response('{}',{status:reject});const path=new URL(url).pathname;let value;
   if(path==='/user')value={id:who};else if(path.startsWith('/repositories/'))value={id:cfg.repositoryId,full_name:cfg.repository,private:false,permissions:{push}};else if(path.endsWith('/branches/main'))value={commit:{sha:'1'.repeat(40)}};else if(path.endsWith('/pulls'))value=[];else value={encoding:'base64',size:100000,content:btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify({portfolio:data}))))};
   return new Response(JSON.stringify(value));};
  const session=createRemote(cfg,{apiFactory:()=>({}),fetcher:mock,onExpire:()=>expiredEvents++});const credentials={token:'inert-error-test-token',expiresAt:Date.now()+3600000};
  let wrongUser=false,readOnly=false,invalidExpiry=false,forbidden=false,revoked=false;
  who=5;try{await session.connect(credentials);}catch{wrongUser=!session.isConnected();}who=cfg.allowedUserId;push=false;try{await session.connect(credentials);}catch{readOnly=!session.isConnected();}push=true;
  const before=calls;try{await session.connect({...credentials,expiresAt:NaN});}catch{invalidExpiry=!session.isConnected()&&calls===before;}
  await session.connect(credentials);reject=403;try{await session.snapshot();}catch(e){forbidden=e.message.includes('no extra permission');}
  reject=401;try{await session.snapshot();}catch(e){revoked=e.message.includes('no longer valid')&&!session.isConnected();}session.end();
  return {wrongUser,readOnly,invalidExpiry,forbidden,revoked,expiredEvents};
 },portfolio);
 expect(result).toEqual({wrongUser:true,readOnly:true,invalidExpiry:true,forbidden:true,revoked:true,expiredEvents:1});
});

test('another-computer media reload verifies content hashes and dimensions before preview',async({page})=>{
 await page.goto('/editor/');const result=await page.evaluate(async original=>{
  const {createRemote}=await import('/editor/remote.mjs');const pdfBytes=new Uint8Array(await(await fetch('/'+original.site.resume)).arrayBuffer());const image=await (await fetch('/assets/images/nimbus-00.webp')).blob(),bytes=new Uint8Array(await image.arrayBuffer()),bitmap=await createImageBitmap(image);
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20),record={id:'upload-'+hash,src:'assets/images/upload-'+hash+'.webp',width:bitmap.width,height:bitmap.height};bitmap.close();
  const data=structuredClone(original);data.media.push(record);let tamper=false;const ref='1'.repeat(40),encode=b=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(s);};
  const cfg={enabled:true,repository:'elidoggart/elidoggart.github.io',branch:'main',repositoryId:1412250381,allowedUserId:183743177,editorOrigin:location.origin,authOrigin:'https://auth.example.test',requiredCheck:'validate'};
  const fetcher=async url=>{const path=new URL(url).pathname;let value;if(path==='/user')value={id:cfg.allowedUserId};else if(path.startsWith('/repositories/'))value={id:cfg.repositoryId,full_name:cfg.repository,private:false,permissions:{push:true}};else if(path.endsWith('/branches/main'))value={commit:{sha:ref}};else if(path.endsWith('/pulls'))value=[];else if(path.endsWith(original.site.resume))value={encoding:'base64',size:pdfBytes.length,content:encode(pdfBytes)};else if(path.endsWith(record.src))value={encoding:'base64',size:bytes.length,content:tamper?encode(bytes.slice(0,-1)):encode(bytes)};else if(path.includes('/contents/assets/images/')){const existing=new Uint8Array(await(await fetch('/'+path.split('/contents/')[1])).arrayBuffer());value={encoding:'base64',size:existing.length,content:encode(existing)};}else value={encoding:'base64',size:100000,content:encode(new TextEncoder().encode(JSON.stringify({portfolio:data})))};return new Response(JSON.stringify(value));};
  const session=createRemote(cfg,{apiFactory:()=>({}),fetcher});const state=await session.connect({token:'inert-image-test-token',expiresAt:Date.now()+3600000});session.adopt(state);const loaded=await session.media(state.published,ref);
  let badHash=false,badDimensions=false;tamper=true;try{await session.media(data,ref);}catch(e){badHash=e.message.includes('stable filename');}tamper=false;data.media.at(-1).width++;try{await session.media(data,ref);}catch(e){badDimensions=e.message.includes('dimensions');}session.end();return {loaded:loaded.get(record.src).size===bytes.length,badHash,badDimensions};
 },portfolio);expect(result).toEqual({loaded:true,badHash:true,badDimensions:true});
});
