import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {optimizeImage,makeZip,readZip} from '../editor/drafts.mjs';
import {matchesImageUpload,imageUploadType,isImageUpload} from '../lib/pdf.mjs';
const oversizedPNG=await sharp((await import('node:crypto')).randomBytes(1200*900*3),{raw:{width:1200,height:900,channels:3}}).png().toBuffer();
const source=await sharp({create:{width:920,height:514,channels:4,background:{r:20,g:80,b:140,alpha:.4}}}).png().toBuffer();
function canvasMock(t,type,{oversize=false,fail=false}={}){
 let closed=false,calls=0;
 t.mock.method(globalThis,'createImageBitmap',async()=>({width:920,height:514,close(){closed=true;}}));
 t.mock.method(globalThis.document,'createElement',()=>({width:0,height:0,getContext(){return {drawImage(){}};},toBlob(callback){
  calls++;if(fail)return callback(null);
  if(oversize&&calls===1)return callback(new Blob([oversizedPNG],{type}));
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
test('ordinary Unicode screenshot and camera filenames are accepted',async t=>{
 canvasMock(t,'image/png');const result=await optimizeImage(new File([source],'Screenshot 2026-10-13 at 8.12.13\u202fAM (copy) – 照片.png'));
 assert.match(result.record.src,/^assets\/images\/upload-[a-f0-9]{20}\.png$/);
});
test('strip PNG EXIF and text without changing pixels or transparency',async()=>{
 const {stripPNGMetadata}=await import('../editor/drafts.mjs');
 const encoded=await sharp(source).withExif({IFD0:{Artist:'Private test author'}}).png().toBuffer();assert.ok((await sharp(encoded).metadata()).exif);
 const clean=Buffer.from(await (await stripPNGMetadata(new Blob([encoded],{type:'image/png'}))).arrayBuffer());const metadata=await sharp(clean).metadata();assert.equal(metadata.exif,undefined);assert.equal(metadata.xmp,undefined);assert.equal(metadata.hasAlpha,true);
 assert.deepEqual(await sharp(clean).raw().toBuffer(),await sharp(encoded).raw().toBuffer());
 await assert.rejects(stripPNGMetadata(new Blob([encoded.subarray(0,-1)],{type:'image/png'})),/incomplete PNG/);
});
