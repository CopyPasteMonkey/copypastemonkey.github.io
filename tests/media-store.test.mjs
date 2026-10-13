import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaStore} from '../editor/media-store.mjs';
test('blocked or unavailable media storage fails promptly and closes a late connection',async()=>{
 let request={},closed=0;const store=createMediaStore({factory:()=>({open:()=>{queueMicrotask(()=>request.onblocked());return request;}}),timeout:20});
 await assert.rejects(store.get(),/another editor tab/);request.result={close:()=>closed++};request.onsuccess();assert.equal(closed,1);
 const unavailable=createMediaStore({factory:()=>{throw Error('blocked')},timeout:20});await assert.rejects(unavailable.put('path',new Blob()),/Storage may be full or blocked/);
});
test('stalled database open times out and permits a later retry',async()=>{
 const requests=[],factory=()=>({open:()=>{const r={};requests.push(r);return r;}}),store=createMediaStore({factory,timeout:5});
 await assert.rejects(store.get(),/could not save or open/);await assert.rejects(store.get(),/could not save or open/);assert.equal(requests.length,2);
});
for(const fault of ['abort','error','stall'])test('media '+fault+' rejects both reads and writes instead of hanging',async()=>{
 let closes=0,aborts=0;
 const store=createMediaStore({timeout:5,factory:()=>({open:()=>{const r={result:{close:()=>closes++,transaction:()=>{
  const tx={objectStore:()=>({put(){},openCursor:()=>({})}),abort(){aborts++;tx.onabort();}};if(fault!=='stall')queueMicrotask(()=>tx['on'+fault]());return tx;
 }}};queueMicrotask(()=>r.onsuccess());return r;}})});
 await assert.rejects(store.get(),/Storage may be full or blocked/);await assert.rejects(store.put('path',new Blob()),/Storage may be full or blocked/);assert.equal(closes,2);if(fault==='stall')assert.equal(aborts,2);
});
test('existing Blob uploads and byte records remain readable; damaged records do not hide intact files',async()=>{
 const bytes=new Uint8Array([0,1,255,127]),legacy=new Blob([bytes],{type:'image/png'}),rows=[['legacy',legacy],['bytes',{version:1,type:'application/pdf',bytes:bytes.buffer}],['damaged',{version:9}]];let closes=0;
 const store=createMediaStore({factory:()=>({open:()=>{const r={result:{close:()=>closes++,transaction:()=>{
  let index=0;const tx={objectStore:()=>({openCursor:()=>{const cursorRequest={};const deliver=()=>{const row=rows[index++];cursorRequest.result=row?{key:row[0],value:row[1],continue:()=>queueMicrotask(deliver)}:null;cursorRequest.onsuccess();if(!row)queueMicrotask(()=>tx.oncomplete());};queueMicrotask(deliver);return cursorRequest;}})};return tx;
 }}};queueMicrotask(()=>r.onsuccess());return r;}})});
 const result=await store.get();assert.deepEqual(new Uint8Array(await result.get('legacy').arrayBuffer()),bytes);assert.deepEqual(new Uint8Array(await result.get('bytes').arrayBuffer()),bytes);assert.equal(result.get('bytes').type,'application/pdf');assert.equal(result.unreadable,1);assert.equal(result.size,2);assert.equal(closes,1);
});
