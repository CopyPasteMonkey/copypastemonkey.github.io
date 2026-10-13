import {isResumeUpload,verifyResume} from '../lib/pdf.mjs';
// Review first. --apply affects local content and new upload files only, never Git/remotes.
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
import {readZip} from '../editor/drafts.mjs';import {assertValid} from '../lib/schema.mjs';import {validateAssets} from './assets.mjs';
const input=process.argv[2];if(!input)throw Error('Usage: node scripts/import-draft.mjs portfolio-draft.zip [--apply]');
const stat=await fs.stat(input);if(stat.size>100_000_000)throw Error('Draft package exceeds 100 MB.');
const files=await readZip(new Blob([await fs.readFile(input)]));const content=await files.get('content/portfolio.json').text();const wrapper=JSON.parse(content);if(Object.keys(wrapper).join()!=='portfolio')throw Error('Unexpected content wrapper.');const data=assertValid(wrapper.portfolio);
await fs.mkdir('.local',{recursive:true});const staging=await fs.mkdtemp(path.resolve('.local/import-'));
try{
 await fs.cp('assets',path.join(staging,'assets'),{recursive:true});
 for(const [p,blob] of files){if(p==='content/portfolio.json')continue;const bytes=Buffer.from(await blob.arrayBuffer());if(isResumeUpload(p)){if(p!==data.site.resume)throw Error('Unreferenced resume in draft package.');await verifyResume(p,blob);}else if(crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20)!==path.basename(p,path.extname(p)).slice(7))throw Error('Uploaded image hash does not match its stable filename.');await fs.writeFile(path.join(staging,p),bytes);}
 await validateAssets(data,staging);
 console.log(`Validated draft: ${data.sections.flatMap(s=>s.entries).length} entries and ${files.size-1} uploaded assets.`);
 if(process.argv.includes('--apply')){
  for(const [p,blob] of files){if(p==='content/portfolio.json')continue;try{await fs.writeFile(p,Buffer.from(await blob.arrayBuffer()),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;const existing=await fs.readFile(p);if(!existing.equals(Buffer.from(await blob.arrayBuffer())))throw Error('Refusing to overwrite existing asset '+p);}}
  const temp='.local/content-next.json';await fs.writeFile(temp,JSON.stringify({portfolio:data},null,2)+'\n');await fs.rename(temp,'content/portfolio.json');console.log('Applied locally. Review git diff and run npm run build. No commit, push or publication.');
 }else console.log('Review only: no source files changed. Pass --apply to apply this draft locally.');
}finally{await fs.rm(staging,{recursive:true,force:true});}
