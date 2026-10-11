import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';
const input=process.argv[2];if(!input)throw Error('Usage: npm run media -- /path/to/image.jpg');
if(!/^[A-Za-z0-9][A-Za-z0-9._ -]*\.(jpe?g|png|webp)$/i.test(path.basename(input)))throw Error('Use a simple JPEG, PNG or WebP filename.');
const stat=await fs.stat(input);if(stat.size>12_000_000)throw Error('Image must be below 12 MB.');
const source=sharp(input,{limitInputPixels:40_000_000});const meta=await source.metadata();if(!['jpeg','png','webp'].includes(meta.format)||meta.pages>1)throw Error('Use a static JPEG, PNG or WebP.');
const {data,info}=await source.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:84}).toBuffer({resolveWithObject:true});if(data.length>2_000_000)throw Error('Optimized image exceeds 2 MB.');
const id='upload-'+crypto.createHash('sha256').update(data).digest('hex').slice(0,20),src='assets/images/'+id+'.webp';
try{await fs.writeFile(src,data,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
console.log(JSON.stringify({id,src,width:info.width,height:info.height},null,2));
console.log('Optimized image saved locally. Add this record in Media, then place it with alt text and optional credit. No Git writes or publication.');
