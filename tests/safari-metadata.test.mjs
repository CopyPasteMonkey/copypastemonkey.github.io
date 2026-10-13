import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import {isCanvasPNGMetadata,validateAssets} from '../scripts/assets.mjs';
// Actual EXIF structure emitted by Safari canvas for a 920 x 514 PNG.
const exif=Buffer.from('4d4d002a00000008000187690004000000010000001a000000000003a00100030000000100010000a00200040000000100000398a0030004000000010000020200000000','hex');
const meta={format:'png',width:920,height:514,exif};
test('allow only exact Safari canvas color-space and dimension metadata',()=>{
 assert.ok(isCanvasPNGMetadata(meta));
 for(const changes of [{format:'jpeg'},{width:921},{height:515},{xmp:Buffer.from('author')},{iptc:Buffer.from('author')},{exif:Buffer.concat([exif,Buffer.from('private')])},{exif:exif.subarray(0,-1)}])assert.equal(isCanvasPNGMetadata({...meta,...changes}),false);
 for(let i=0;i<exif.length;i++){const changed=Buffer.from(exif);changed[i]^=1;assert.equal(isCanvasPNGMetadata({...meta,exif:changed}),false,'changed byte '+i);}
});
function crc32(bytes){let n=0xffffffff;for(const b of bytes){n^=b;for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;}return (n^0xffffffff)>>>0;}
function withExif(png,metadata){const chunk=Buffer.alloc(metadata.length+12);chunk.writeUInt32BE(metadata.length);chunk.write('eXIf',4);metadata.copy(chunk,8);chunk.writeUInt32BE(crc32(chunk.subarray(4,-4)),chunk.length-4);return Buffer.concat([png.subarray(0,33),chunk,png.subarray(33)]);}
test('full publish validation accepts Safari PNG but rejects private EXIF',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'safari-metadata-'));
 try{
  await fs.mkdir(path.join(root,'assets/images'),{recursive:true});await fs.mkdir(path.join(root,'assets/documents'),{recursive:true});
  await fs.copyFile('assets/documents/Eli-Doggart-Resume.pdf',path.join(root,'assets/documents/resume.pdf'));
  const png=await sharp({create:{width:920,height:514,channels:4,background:'#3698'}}).png().toBuffer();
  async function validate(metadata){const bytes=withExif(png,metadata),id='upload-'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20),src='assets/images/'+id+'.png';await fs.writeFile(path.join(root,src),bytes);await validateAssets({media:[{id,src,width:920,height:514}],site:{resume:'assets/documents/resume.pdf'},resources:[]},root);}
  await validate(exif);
  // Add a private payload; even trailing unrecognized metadata is not allowed.
  await assert.rejects(validate(Buffer.concat([exif,Buffer.from('Private author')])),/strip metadata/);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
