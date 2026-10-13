import {isResumeUpload,isImageUpload,imageUploadType,maxResumeBytes} from '../lib/pdf.mjs';
// Browser-local storage only. This module never calls a write API.
export const draftKey='eli-portfolio-draft-v1';
const database=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('eli-portfolio-media-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('images');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function putImage(path,blob){const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('images','readwrite');tx.objectStore('images').put(blob,path);tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(tx.error||Error('Uploaded-file storage could not finish saving. Download a backup or free browser storage.'));});}finally{db.close();}}
export async function getImages(){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('images','readonly');const map=new Map();const r=tx.objectStore('images').openCursor();r.onsuccess=()=>{const c=r.result;if(c){map.set(c.key,c.value);c.continue();}else resolve(map);};r.onerror=()=>reject(r.error);});}finally{db.close();}}
// Canvas encoders can add EXIF/text chunks. Remove those before hashing so
// upload, backup and publication all use the same metadata-free PNG bytes.
export async function stripPNGMetadata(blob){
 if(!blob||blob.type!=='image/png')return blob;
 const bytes=new Uint8Array(await blob.arrayBuffer()),view=new DataView(bytes.buffer),parts=[bytes.subarray(0,8)];let offset=8,changed=false,ended=false;
 if(![137,80,78,71,13,10,26,10].every((value,i)=>bytes[i]===value))throw Error('The browser returned an invalid PNG image.');
 while(offset+12<=bytes.length){
  const size=view.getUint32(offset),end=offset+12+size;if(end>bytes.length)throw Error('The browser returned an incomplete PNG image.');
  const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
  if(['eXIf','tEXt','zTXt','iTXt'].includes(type))changed=true;else parts.push(bytes.subarray(offset,end));
  offset=end;if(type==='IEND'){ended=true;break;}
 }
 if(!ended||offset!==bytes.length)throw Error('The browser returned an incomplete PNG image.');
 return changed?new Blob(parts,{type:'image/png'}):blob;
}
export async function optimizeImage(file){
 if(file.size>12_000_000)throw Error('Choose an image smaller than 12 MB.');
 if(typeof file.name!=='string'||! /\.(jpe?g|png|webp)$/i.test(file.name))throw Error('Choose a JPEG, PNG or WebP image.');
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
  let blob=await stripPNGMetadata(await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.84)));
  if(!blob||!['image/webp','image/png'].includes(blob.type))throw Error('Your browser could not encode this image. Try exporting it as JPEG or PNG.');
  // Keep transparency when WebP is unavailable. Reduce dimensions if needed.
  while(blob.size>2_000_000&&Math.max(canvas.width,canvas.height)>320){
   canvas.width=Math.max(1,Math.round(canvas.width*.75));canvas.height=Math.max(1,Math.round(canvas.height*.75));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   blob=await stripPNGMetadata(await new Promise(resolve=>canvas.toBlob(resolve,blob.type,.84)));
   if(!blob)throw Error('Your browser could not encode this image. Try exporting it as JPEG or PNG.');
  }
  if(blob.size>2_000_000)throw Error('The optimized image is still larger than 2 MB. Try a smaller image.');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);
  const id='upload-'+hash,src='assets/images/'+id+(blob.type==='image/png'?'.png':'.webp');return {record:{id,src,width:canvas.width,height:canvas.height},blob};
 }finally{bitmap.close();}
}
const utf8=new TextEncoder();
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;}
function header(size,values){const bytes=new Uint8Array(size);const view=new DataView(bytes.buffer);for(const [offset,value,bits=32] of values)view['setUint'+bits](offset,value,true);return bytes;}
// A small deterministic ZIP writer, stored files only; no filesystem extraction.
export async function makeZip(files){
 if(files.size>502)throw Error('Too many files in the backup.');
 let estimated=22;for(const [path,blob] of files){if(blob.size>(isResumeUpload(path)?maxResumeBytes:2_000_000))throw Error('A backup file exceeds its allowed size (2 MB for content/images, 5 MB for PDFs).');estimated+=76+2*utf8.encode(path).length+blob.size;}if(estimated>100_000_000)throw Error('Backup exceeds 100 MB. Reduce the uploaded files before exporting.');
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
 const bytes=new Uint8Array(await file.arrayBuffer()),view=new DataView(bytes.buffer);let offset=0;const files=new Map(),entries=[];
 const end=bytes.length-22;if(end<0||view.getUint32(end,true)!==0x06054b50||view.getUint16(end+20,true)!==0)throw Error('Incomplete draft package. Use the original downloaded ZIP.');
 while(offset+30<=bytes.length&&view.getUint32(offset,true)===0x04034b50){
  const flags=view.getUint16(offset+6,true),method=view.getUint16(offset+8,true),crc=view.getUint32(offset+14,true),size=view.getUint32(offset+18,true),unpacked=view.getUint32(offset+22,true),nameLen=view.getUint16(offset+26,true),extra=view.getUint16(offset+28,true);
  if(method!==0||(flags&9)||size!==unpacked||size>maxResumeBytes)throw Error('Import an unmodified draft ZIP exported by this editor.');
  const start=offset+30+nameLen+extra;if(start+size>bytes.length)throw Error('Incomplete draft package.');
  const path=new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(offset+30,offset+30+nameLen));
  if(path!=='content/portfolio.json'&&!isImageUpload(path)&&!isResumeUpload(path))throw Error('Unexpected file in draft package.');
  if(!isResumeUpload(path)&&size>2_000_000)throw Error('Content and image files must be smaller than 2 MB.');
  if(files.has(path)||files.size>=502)throw Error('Duplicate files or too many files in draft package.');
  const data=bytes.slice(start,start+size);if(crc32(data)!==crc)throw Error('Damaged draft package.');entries.push({path,offset,size,crc});files.set(path,new Blob([data],{type:isImageUpload(path)?imageUploadType(path):path.endsWith('.pdf')?'application/pdf':'application/json'}));offset=start+size;
 }
 const centralStart=offset;
 for(const entry of entries){
  if(offset+46>end||view.getUint32(offset,true)!==0x02014b50)throw Error('Incomplete draft package directory.');
  const nameLen=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true);
  if(offset+46+nameLen+extra+comment>end||view.getUint32(offset+16,true)!==entry.crc||view.getUint32(offset+20,true)!==entry.size||view.getUint32(offset+24,true)!==entry.size||view.getUint32(offset+42,true)!==entry.offset||new TextDecoder('utf-8',{fatal:true}).decode(bytes.slice(offset+46,offset+46+nameLen))!==entry.path)throw Error('Damaged draft package directory.');
  offset+=46+nameLen+extra+comment;
 }
 if(offset!==end||view.getUint16(end+4,true)!==0||view.getUint16(end+6,true)!==0||view.getUint16(end+8,true)!==entries.length||view.getUint16(end+10,true)!==entries.length||view.getUint32(end+12,true)!==end-centralStart||view.getUint32(end+16,true)!==centralStart)throw Error('Incomplete draft package directory.');
 if(!files.has('content/portfolio.json'))throw Error('Missing portfolio content in draft package.');return files;
}
