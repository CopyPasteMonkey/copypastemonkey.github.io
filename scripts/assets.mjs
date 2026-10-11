import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import crypto from 'node:crypto';
export async function validateAssets(data,root){
 const failures=[];const realRoot=await fs.realpath(root);
 async function file(src,max){
  try{const p=await fs.realpath(path.join(root,src));if(!p.startsWith(realRoot+path.sep))throw Error('outside site');const st=await fs.stat(p);if(!st.isFile()||st.size>max)throw Error(`file must be at most ${max/1e6} MB`);return p;}catch(e){failures.push(`${src}: missing or unsafe asset (${e.message})`);}
 }
 for(const m of data.media){
  const p=await file(m.src,2_000_000);if(!p)continue;
  if(m.id.startsWith('upload-')){const hash=crypto.createHash('sha256').update(await fs.readFile(p)).digest('hex').slice(0,20);if(m.id!=='upload-'+hash||m.src!=='assets/images/'+m.id+'.webp')failures.push(m.src+': upload ID and filename must match the image bytes');}
  try{const meta=await sharp(p,{limitInputPixels:40_000_000}).metadata();if(!['webp','jpeg','png'].includes(meta.format)||meta.pages>1)throw Error('use a static WebP, JPEG or PNG');const expected=m.src.endsWith('.webp')?'webp':m.src.endsWith('.png')?'png':'jpeg';if(meta.format!==expected)throw Error('extension does not match image bytes');if(m.id.startsWith('upload-')&&(meta.exif||meta.xmp||meta.iptc))throw Error('strip metadata from uploaded images');if(meta.width!==m.width||meta.height!==m.height)throw Error('recorded dimensions do not match the image');if(meta.width>2400||meta.height>2400)throw Error('optimize to at most 2400 px');}catch(e){failures.push(`${m.src}: ${e.message}`);}
 }
 const resume=await file(data.site.resume,15_000_000);
 if(resume){const bytes=await fs.readFile(resume);if(bytes.subarray(0,5).toString()!=='%PDF-')failures.push('Resume must be a PDF.');}
 for(const r of data.resources)if(r.url.startsWith('assets/'))await file(r.url,15_000_000);
 if(failures.length)throw Error(failures.join('\n'));
}
