import {inspectPDF,isResumeUpload,isImageUpload} from '../lib/pdf.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import crypto from 'node:crypto';
// Safari's canvas PNG encoder adds only ColorSpace, PixelXDimension and
// PixelYDimension in this canonical EXIF block. Permit that exact block;
// camera, GPS, author, timestamps and all other metadata remain rejected.
export function isCanvasPNGMetadata(meta){
 if(meta.format!=='png'||!meta.exif||meta.xmp||meta.iptc)return false;
 const expected=Buffer.from('4d4d002a00000008000187690004000000010000001a000000000003a00100030000000100010000a00200040000000100000000a0030004000000010000000000000000','hex');
 expected.writeUInt32BE(meta.width,48);expected.writeUInt32BE(meta.height,60);
 return expected.equals(meta.exif);
}
export async function validateAssets(data,root){
 const failures=[];const realRoot=await fs.realpath(root);
 async function file(src,max){
  try{const p=await fs.realpath(path.join(root,src));if(!p.startsWith(realRoot+path.sep))throw Error('outside site');const st=await fs.stat(p);if(!st.isFile()||st.size>max)throw Error(`file must be at most ${max/1e6} MB`);return p;}catch(e){failures.push(`${src}: missing or unsafe asset (${e.message})`);}
 }
 for(const m of data.media){
  const p=await file(m.src,2_000_000);if(!p)continue;
  if(m.id.startsWith('upload-')){const hash=crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex').slice(0,20);if(m.id!=='upload-'+hash||!isImageUpload(m.src)||path.basename(m.src,path.extname(m.src))!==m.id)failures.push(m.src+': upload ID and filename must match the image bytes');}
  try{const meta=await sharp(p,{limitInputPixels:40_000_000}).metadata();if(!['webp','jpeg','png'].includes(meta.format)||meta.pages>1)throw Error('use a static WebP, JPEG or PNG');const expected=m.src.endsWith('.webp')?'webp':m.src.endsWith('.png')?'png':'jpeg';if(meta.format!==expected)throw Error('extension does not match image bytes');if(m.id.startsWith('upload-')&&(meta.exif||meta.xmp||meta.iptc)&&!isCanvasPNGMetadata(meta))throw Error('strip metadata from uploaded images');if(meta.width!==m.width||meta.height!==m.height)throw Error('recorded dimensions do not match the image');if(meta.width>2400||meta.height>2400)throw Error('optimize to at most 2400 px');}catch(e){failures.push(`${m.src}: ${e.message}`);}
 }
 const resume=await file(data.site.resume,15_000_000);
 if(resume)try{const info=await inspectPDF(new Uint8Array(await fs.readFile(resume)));if(isResumeUpload(data.site.resume)&&info.src!==data.site.resume)throw Error('Resume bytes do not match their stable filename.');}catch(e){failures.push('Resume: '+e.message);}
 // Earlier replacements in the same public draft remain in Git history. Validate
 // every uploaded PDF, including versions no longer selected by the current draft.
 for(const name of await fs.readdir(path.join(root,'assets/documents'))){
  if(!name.startsWith('resume-'))continue;const src='assets/documents/'+name;
  if(!isResumeUpload(src)){failures.push('Invalid uploaded resume filename: '+name);continue;}
  if(src===data.site.resume)continue;const p=await file(src,5_000_000);if(!p)continue;
  try{const info=await inspectPDF(new Uint8Array(await fs.readFile(p)));if(info.src!==src)throw Error('Resume bytes do not match their stable filename.');}catch(e){failures.push(src+': '+e.message);}
 }
 for(const r of data.resources)if(r.url.startsWith('assets/'))await file(r.url,15_000_000);
 if(failures.length)throw Error(failures.join('\n'));
}
