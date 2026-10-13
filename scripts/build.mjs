import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {render} from '../lib/render.mjs';
import {assertValid,schema} from '../lib/schema.mjs';
import {validateAssets} from './assets.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const browserTest=process.argv.includes('--browser-test');
// UI examples must never replace the actual portfolio deployment artifact.
const input=browserTest?path.join(root,'tests/fixtures/editor-content.json'):process.env.PORTFOLIO_CONTENT||path.join(root,'content/portfolio.json');
const raw=await fs.readFile(input);if(raw.length>2_000_000)throw Error('Content file exceeds 2 MB.');
const wrapper=JSON.parse(raw);if(Object.keys(wrapper).join()!=='portfolio')throw Error('Content file must contain only portfolio.');
const data=assertValid(wrapper.portfolio);await validateAssets(data,root);
if(process.argv.includes('--validate')){console.log(`Validated ${data.sections.flatMap(s=>s.entries).length} entries, ${data.media.length} media, ${data.resources.length} resources.`);process.exit(0);}
const output=path.join(root,browserTest?'.local/browser-dist':'dist');await fs.rm(output,{recursive:true,force:true});await fs.mkdir(output,{recursive:true});
for(const f of ['assets','style.css','app.js','stats-client.mjs','l','CNAME','.nojekyll','README.txt','accelerate.html','mott.html','nimbus.html','favicon-flow.svg','favicon-32.png','favicon.ico','apple-touch-icon.png','editor','lib','content'])await fs.cp(path.join(root,f),path.join(output,f),{recursive:true});
await fs.writeFile(path.join(output,'content/portfolio.json'),raw);
await fs.writeFile(path.join(output,'index.html'),render(data,{stats:true}));
await fs.writeFile(path.join(output,'content/schema.json'),JSON.stringify(schema,null,2)+'\n');
// Build the narrow, pinned Decap backend from source; no prebuilt CMS bundle/CDN.
const {build}=await import('esbuild');
const bundled=await build({entryPoints:[path.join(root,'build/decap-api.mjs')],outfile:path.join(output,'editor/vendor/decap-api.mjs'),bundle:true,format:'esm',platform:'browser',minify:true,metafile:true,legalComments:'eof',define:{'process.env.NODE_ENV':'"production"'}});
await build({entryPoints:[path.join(root,'lib/pdf.mjs')],outfile:path.join(output,'lib/pdf.mjs'),bundle:true,format:'esm',platform:'browser',minify:true,legalComments:'eof'});
await fs.mkdir(path.join(root,'.local'),{recursive:true});
await fs.writeFile(path.join(root,'.local/backend-metafile.json'),JSON.stringify(bundled.metafile,null,2));
for(const banned of ['@platejs/','/trim/','/sprintf-js/','/uuid/','decap-cms-core/','decap-cms-lib-auth/','decap-cms-widget-'])if(Object.keys(bundled.metafile.inputs).some(p=>p.includes(banned)))throw Error('Unexpected editor dependency in backend bundle: '+banned);
await fs.writeFile(path.join(output,'build.json'),JSON.stringify({contentVersion:data.version,revision:process.env.GITHUB_SHA||'local-preview'})+'\n');
console.log('Built '+(browserTest?'.local/browser-dist/':'dist/')+' deterministically. No publication or Git writes.');
