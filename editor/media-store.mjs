const message='This browser could not save or open uploaded files. Storage may be full or blocked. Your existing draft is unchanged; free some browser storage or try another browser, then upload the file again.';
export function createMediaStore({factory=()=>indexedDB,timeout=10000}={}){
 async function open(){return new Promise((resolve,reject)=>{
  let request,done=false;const timer=setTimeout(()=>finish(Error(message)),timeout);
  function finish(error,db){if(done){db?.close();return;}done=true;clearTimeout(timer);error?reject(error):resolve(db);}
  try{request=factory().open('eli-portfolio-media-v1',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('images');
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();finish(null,db);};
   request.onerror=()=>finish(Error(message,{cause:request.error}));
   request.onblocked=()=>finish(Error('Uploaded-file storage is waiting for another editor tab. Close the other editor tabs and try the upload again. Your draft is unchanged.'));
  }catch(error){finish(Error(message,{cause:error}));}
 });}
 async function transaction(mode,action){const db=await open();try{return await new Promise((resolve,reject)=>{
  let tx,result,done=false;const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(Error(message));},timeout);
  function finish(error){if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(result);}
  try{tx=db.transaction('images',mode);tx.oncomplete=()=>finish();tx.onerror=tx.onabort=()=>finish(Error(message,{cause:tx.error}));result=action(tx.objectStore('images'));}catch(error){finish(Error(message,{cause:error}));}
 });}finally{db.close();}}
 return {
  // WebKit ephemeral/private sessions can reject Blob records in IndexedDB.
  // Store the exact bytes plus MIME type; continue reading older Blob records.
  put:async(path,blob)=>{const value={version:1,type:blob.type,bytes:await blob.arrayBuffer()};return transaction('readwrite',store=>{store.put(value,path);});},
  get:()=>transaction('readonly',store=>{const map=new Map();map.unreadable=0;const request=store.openCursor();request.onsuccess=()=>{const cursor=request.result;if(cursor){const value=cursor.value;if(value instanceof Blob)map.set(cursor.key,value);else if(value?.version===1&&value.bytes instanceof ArrayBuffer&&typeof value.type==='string')map.set(cursor.key,new Blob([value.bytes],{type:value.type}));else map.unreadable++;cursor.continue();}};return map;})
 };
}
const store=createMediaStore();
export const putImage=(path,blob)=>store.put(path,blob);
export const getImages=()=>store.get();
