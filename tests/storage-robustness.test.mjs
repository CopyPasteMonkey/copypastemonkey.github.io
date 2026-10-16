import test from 'node:test';
import assert from 'node:assert/strict';
import {loadLocalDraft,missingDraftAssets,remoteVersion,sameRemoteVersion} from '../editor/storage.mjs';
import {draftKey,makeZip,readZip} from '../editor/drafts.mjs';
function storage(raw){const map=new Map(raw===undefined?[]:[[draftKey,raw]]);return {map,getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
test('damaged draft is preserved before fallback, without blocking next save',()=>{
 const s=storage('{broken'),loaded=loadLocalDraft(s,()=>true);assert.equal(loaded.recovery,'{broken');assert.match(loaded.warning,/preserved/);assert.equal(s.getItem(draftKey),null);assert.deepEqual([...s.map.values()],['{broken']);
});
test('storage-full recovery never removes the original draft',()=>{
 const s=storage('{broken');s.setItem=()=>{throw Error('quota');};const loaded=loadLocalDraft(s,()=>true);assert.equal(s.getItem(draftKey),'{broken');assert.equal(loaded.recovery,'{broken');assert.match(loaded.warning,/recovery copy/);
});
test('valid saved draft survives; invalid shape is quarantined',()=>{
 const raw=JSON.stringify({portfolio:{name:'Kept'},draftRevision:5});assert.deepEqual(loadLocalDraft(storage(raw),x=>x.portfolio.name==='Kept').stored,JSON.parse(raw));
 assert.ok(loadLocalDraft(storage('null'),()=>true).recovery);assert.ok(loadLocalDraft(storage('{}'),()=>false).recovery);
});
test('backup detects missing new images and resumes but allows published assets',()=>{
 const baseline={media:[{src:'published.png'}],site:{resume:'published.pdf'}},data={media:[{src:'published.png'},{src:'new.png'}],site:{resume:'new.pdf'}};
 assert.deepEqual(missingDraftAssets(data,baseline,new Map()),['new.png','new.pdf']);assert.deepEqual(missingDraftAssets(data,baseline,new Map([['new.png',new Blob()],['new.pdf',new Blob()]])),[]);
});
test('backup rejects a truncated or altered directory instead of silently accepting it',async()=>{
 const zip=await makeZip(new Map([['content/portfolio.json',new Blob(['{}'])]])),bytes=new Uint8Array(await zip.arrayBuffer());assert.equal((await readZip(zip)).size,1);
 for(const cut of [1,22,60])await assert.rejects(readZip(new Blob([bytes.slice(0,-cut)])),/Incomplete/);
 const changed=bytes.slice();changed[changed.length-6]^=1;await assert.rejects(readZip(new Blob([changed])),/directory/);
});
test('backup writer will not produce a package its reader rejects for size',async()=>{
 await assert.rejects(makeZip(new Map([['content/portfolio.json',new Blob([new Uint8Array(2_000_001)])]])),/allowed size/);
 const image=new Blob([new Uint8Array(2_000_000)]),files=new Map([['content/portfolio.json',new Blob(['{}'])]]);for(let i=0;i<50;i++)files.set('assets/images/upload-'+i.toString(16).padStart(20,'0')+'.png',image);
 await assert.rejects(makeZip(files),/100 MB/);
});

test('publishing recognizes its saved remote version across reloads but detects concurrent changes',()=>{
 const state={publishedHead:'main-1',draft:{head:'draft-1'}};
 const known=JSON.parse(JSON.stringify(remoteVersion(state)));
 assert.equal(sameRemoteVersion(known,state),true);
 assert.equal(sameRemoteVersion(known,{...state,draft:{head:'draft-2'}}),false);
 assert.equal(sameRemoteVersion(known,{...state,publishedHead:'main-2'}),false);
 assert.equal(sameRemoteVersion(known,{...state,draft:null}),false);
 assert.equal(sameRemoteVersion(null,state),false);
 const published={publishedHead:'main-1',draft:null};
 assert.equal(sameRemoteVersion(remoteVersion(published),published),true);
 assert.equal(sameRemoteVersion(remoteVersion(published),state),false);
});
