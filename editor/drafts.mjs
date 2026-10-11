// Browser-local storage only. This module never calls a write API.
export const draftKey='eli-portfolio-draft-v1';
const database=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('eli-portfolio-media-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function putImage(path,blob){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(blob,path);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function getImages(){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('images','readonly');const map=new Map();const r=tx.objectStore('images').openCursor();r.onsuccess=()=>{const c=r.result;if(c){map.set(c.key,c.value);c.continue();}else resolve(map);};r.onerror=()=>reject(r.error);});}finally{db.close();}}
export async function optimizeImage(file){
 if(file.size>12_000_000)throw Error('Choose an image smaller than 12 MB.');
 if(!/^[A-Za-z0-9][A-Za-z0-9._ -]*\.(jpe?g|png|webp)$/i.test(file.name))throw Error('Use a JPEG, PNG or WebP filename with letters, numbers, spaces, dots, underscores or hyphens.');
 const sourceBytes=new Uint8Array(await file.arrayBuffer());const head=sourceBytes.slice(0,12);
 const format=head[0]===255&&head[1]===216?'jpeg':head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71?'png':String.fromCharCode(...head.slice(0,4))==='RIFF'&&String.fromCharCode(...head.slice(8,12))==='WEBP'?'webp':null;
 if(!format)throw Error('The file content is not a supported image. SVG and animated images are not accepted.');
 const view=new DataView(sourceBytes.buffer);
 if(format==='webp')for(let offset=12;offset+8<=sourceBytes.length;){const type=String.fromCharCode(...sourceBytes.slice(offset,offset+4));if(type==='ANIM'||type==='ANMF')throw Error('Use a still image; animated WebP is not supported.');const size=view.getUint32(offset+4,true);offset+=8+size+(size%2);}
 if(format==='png')for(let offset=8;offset+12<=sourceBytes.length;){const type=String.fromCharCode(...sourceBytes.slice(offset+4,offset+8));if(type==='acTL')throw Error('Use a still image; animated PNG is not supported.');offset+=12+view.getUint32(offset);}
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width*bitmap.height>40_000_000)throw Error('Use an image below 40 megapixels.');
  const scale=Math.min(1,2400/Math.max(bitmap.width,bitmap.height));const width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(bitmap,0,0,width,height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84));
  if(!blob||blob.type!=='image/webp'||blob.size>2_000_000)throw Error('Could not create a WebP smaller than 2 MB. Try a smaller image.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
  const id='upload-'+hash,src='assets/images/'+id+'.webp';return {record:{id,src,width,height},blob};
 }finally{bitmap.close();}
}
const utf8=new TextEncoder();
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function header(size,values){const bytes=new Uint8Array(size);const view=new DataView(bytes.buffer);for(const [offset,value,bits=32] of values)view['setUint'+bits](offset,value,true);return bytes;}
// A small deterministic ZIP writer, stored files only; no filesystem extraction.
export async function makeZip(files){
 const parts=[],central=[];let offset=0,total=0;
 for(const [path,blob] of files){const name=utf8.encode(path),data=new Uint8Array(await blob.arrayBuffer()),crc=crc32(data);
  const local=header(30,[[0,0x04034b50],[4,20,16],[6,0x800,16],[14,crc],[18,data.length],[22,data.length],[26,name.length,16]]);
  const directory=header(46,[[0,0x02014b50],[4,20,16],[6,20,16],[8,0x800,16],[16,crc],[20,data.length],[24,data.length],[28,name.length,16],[42,offset]]);
  parts.push(local,name,data);central.push(directory,name);offset+=local.length+name.length+data.length;total+=directory.length+name.length;
 }
 return new Blob([...parts,...central,header(22,[[0,0x06054b50],[8,files.size,16],[10,files.size,16],[12,total],[16,offset]])],{type:'application/zip'});
}
export async function readZip(file){
 if(file.size>100_000_000)throw Error('Draft package must be smaller than 100 MB.');
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let offset=0;const files=new Map();
 while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
  const flags=view.getUint16(offset+6,true),method=view.getUint16(offset+8,true),crc=view.getUint32(offset+14,true),size=view.getUint32(offset+18,true),unpacked=view.getUint32(offset+22,true),nameLen=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
  if(method!==0||(flags&9)||size!==unpacked||size>2_000_000)throw Error('Import an unmodified draft ZIP exported by this editor.');
  const start=offset+30+nameLen+extra;if(start+size>bytes.length)throw Error('Incomplete draft package.');
  const path=new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(offset+30,offset+30+nameLen));
  if(path!=='content/portfolio.json'&&!/^assets\/images\/upload-[a-f0-9]{20}\.webp$/.test(path))throw Error('Unexpected file in draft package.');
  if(files.has(path)||files.size>500)throw Error('Duplicate files or too many files in draft package.');
  const data=bytes.slice(start,start+size);if(crc32(data)!==crc)throw Error('Damaged draft package.');files.set(path,new Blob([data],{type:path.endsWith('.webp')?'image/webp':'application/json'}));offset=start+size;
 }
 if(!files.has('content/portfolio.json'))throw Error('Missing portfolio content in draft package.');return files;
}
