import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {optimizeImage,makeZip,readZip} from '../editor/drafts.mjs';
import {matchesImageUpload,imageUploadType,isImageUpload} from '../lib/pdf.mjs';
const source=await sharp({create:{width:920,height:514,channels:4,background:{r:20,g:80,b:140,alpha:.4}}}).png().toBuffer();
function canvasMock(t,type,{oversize=false,fail=false}={}){
 let closed=false,calls=0;
 t.mock.method(globalThis,'createImageBitmap',async()=>({width:920,height:514,close(){closed=true;}}));
 t.mock.method(globalThis.document,'createElement',()=>({width:0,height:0,getContext(){return {drawImage(){}};},toBlob(callback){
  calls++;if(fail)return callback(null);
  if(oversize&&calls===1)return callback(new Blob([new Uint8Array(2_000_001)],{type}));
  sharp(source).resize(this.width,this.height).toFormat(type.split('/')[1]).toBuffer().then(bytes=>callback(new Blob([bytes],{type})));
 }}));
 return {closed:()=>closed,calls:()=>calls};
}
// Only browser primitives are replaced; real encoded bytes exercise ZIP and validation.
globalThis.createImageBitmap=()=>{};globalThis.document={createElement(){}};
for(const type of ['image/png','image/webp'])test('upload and backup round-trip with '+type,async t=>{
 const mock=canvasMock(t,type),result=await optimizeImage(new File([source],'photo.png',{type:'image/png'}));
 assert.ok(mock.closed());assert.equal(result.blob.type,type);assert.equal(result.record.width,920);assert.equal(result.record.height,514);
 const bytes=new Uint8Array(await result.blob.arrayBuffer()),hash=crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20);
 assert.ok(matchesImageUpload(result.record.src,bytes,hash));assert.ok(isImageUpload(result.record.src));assert.equal(imageUploadType(result.record.src),type);
 const meta=await sharp(bytes).metadata();assert.equal(meta.hasAlpha,true);assert.equal(meta.exif,undefined);
 const zip=await makeZip(new Map([['content/portfolio.json',new Blob(['{}'])],[result.record.src,result.blob]]));
 const restored=(await readZip(zip)).get(result.record.src);assert.equal(restored.type,type);assert.deepEqual(await restored.arrayBuffer(),await result.blob.arrayBuffer());
 assert.equal(matchesImageUpload(result.record.src,bytes,'0'.repeat(20)),false);
 assert.equal(matchesImageUpload(result.record.src,Uint8Array.of(1,2,3),hash),false);
 assert.equal(matchesImageUpload(result.record.src.replace(/\.(png|webp)$/,type==='image/png'?'.webp':'.png'),bytes,hash),false);
});
test('oversized fallback shrinks and records final dimensions',async t=>{
 const mock=canvasMock(t,'image/png',{oversize:true}),result=await optimizeImage(new File([source],'photo.png'));
 assert.equal(mock.calls(),2);assert.equal(result.record.width,690);assert.equal(result.record.height,386);assert.ok(result.blob.size<=2_000_000);assert.ok(mock.closed());
});
test('encoding failure is distinguished from size failure and releases bitmap',async t=>{
 const mock=canvasMock(t,'image/png',{fail:true});await assert.rejects(optimizeImage(new File([source],'photo.png')),/could not encode/);assert.ok(mock.closed());
});
