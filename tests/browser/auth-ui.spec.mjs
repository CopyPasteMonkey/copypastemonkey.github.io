import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const original=JSON.parse(fs.readFileSync('tests/fixtures/editor-content.json')).portfolio;

for(const editorPath of ['/editor/visual.html','/editor/'])test.describe(editorPath,()=>{
test('one editor signs in, saves a public draft, explicitly publishes, checks deployment and signs out',async({page,context})=>{
 const config={enabled:true,repository:'elidoggart/elidoggart.github.io',branch:'main',repositoryId:1412250381,allowedUserId:183743177,editorOrigin:'http://127.0.0.1:4175',authOrigin:'https://auth.example.test',requiredCheck:'validate'};
 const main='1'.repeat(40),head='2'.repeat(40),merge='3'.repeat(40);let draft=null,content=original,uploaded='',pr=null,mergeCalls=0;const writes=[];
 await context.route('**/editor/publishing.json',r=>r.fulfill({json:config}));
 // The real popup handshake executes on a distinct origin; no credentials or accounts are used.
 await context.route('https://auth.example.test/auth',r=>r.fulfill({contentType:'text/html',body:`<script>const parent=window.opener;addEventListener('message',e=>{if(e.source===parent&&e.origin==='http://127.0.0.1:4175'&&e.data.type==='portfolio:ack'){parent.postMessage({type:'portfolio:authorized',provider:'github',token:'inert-ui-test-token',expiresAt:Date.now()+3600000},e.origin);window.close();}});parent.postMessage({type:'portfolio:ready'},'http://127.0.0.1:4175');</script>`}));
 await context.route('https://api.github.com/**',async route=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname.replace('/repos/'+config.repository,''),method=request.method(),body=request.postDataJSON();const json=value=>route.fulfill({json:value});
  if(method!=='GET')writes.push({path,method,body});
  if(url.pathname==='/user')return json({id:config.allowedUserId,login:'elidoggart'});
  if(url.pathname==='/repositories/'+config.repositoryId)return json({id:config.repositoryId,full_name:config.repository,private:false,permissions:{push:true}});
  if(path.startsWith('/branches/'))return json({commit:{sha:main}});
  if(path==='/contents/content/portfolio.json')return json({encoding:'base64',size:100000,content:Buffer.from(JSON.stringify({portfolio:url.searchParams.get('ref')===head?content:original})).toString('base64')});
  if(path==='/pulls'&&method==='GET')return json(pr?.state==='open'?[pr]:[]);
  if(path==='/git/blobs'){uploaded=body.content;return json({sha:'4'.repeat(40)});}
  if(path==='/git/trees')return json({sha:'5'.repeat(40)});
  if(path==='/git/commits'){content=JSON.parse(Buffer.from(uploaded,'base64').toString()).portfolio;return json({sha:head});}
  if(path==='/git/refs'){draft=body.ref.slice('refs/heads/'.length);return json({object:{sha:head}});}
  if(path==='/pulls'&&method==='POST'){pr={number:9,head:{ref:draft,sha:head,repo:{id:config.repositoryId}},base:{ref:'main',repo:{id:config.repositoryId}},labels:[],state:'open',mergeable:true,mergeable_state:'clean'};return json(pr);}
  if(path==='/issues/9/labels'){pr.labels=body.labels.map(name=>({name}));return json(pr.labels);}
  if(path==='/pulls/9/files')return json([{filename:'content/portfolio.json',status:'modified'}]);
  if(path.includes('/check-runs'))return json({check_runs:[{name:'validate',app:{slug:'github-actions'},head_sha:head,status:'completed',conclusion:'success'}]});
  if(path==='/pulls/9')return json(pr);
  if(path==='/pulls/9/merge'){mergeCalls++;expect(body.sha).toBe(head);pr.state='closed';return json({merged:true,sha:merge});}
  if(path.startsWith('/compare/'))return json({behind_by:0});
  if(path==='/deployments')return json([]);
  throw Error('Unexpected GitHub UI request '+method+' '+path);
 });
 await page.goto(editorPath);
 await page.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('Remote UI draft');expect(original.site.name).toBe('Eli Doggart');expect(mergeCalls).toBe(0);
 await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Your changes are saved and checks have passed');expect(content.site.name).toBe('Remote UI draft');expect(mergeCalls).toBe(0);
 await page.getByRole('button',{name:'Publish now',exact:true}).click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Updating your website');expect(mergeCalls).toBe(1);
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.locator('#mode-label')).toHaveText('Local draft mode');await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Updating your website');expect(mergeCalls).toBe(1);
 expect(writes.some(w=>w.path.endsWith('/main')||w.body?.force===true)).toBe(false);expect(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('inert-ui-test-token')))).toBe(false);
});

test('closing the sign-in popup leaves a recoverable local draft',async({page,context})=>{
 await context.route('**/editor/publishing.json',r=>r.fulfill({json:{enabled:true,repository:'elidoggart/elidoggart.github.io',branch:'main',repositoryId:1412250381,allowedUserId:183743177,editorOrigin:'http://127.0.0.1:4175',authOrigin:'https://auth.example.test',requiredCheck:'validate'}}));
 await context.route('https://auth.example.test/auth',r=>r.fulfill({contentType:'text/html',body:'<p>Mock sign-in cancellation</p>'}));
 await page.goto(editorPath);await page.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('Recoverable draft');
 const popupPromise=page.waitForEvent('popup');await page.getByRole('button',{name:'Sign in with GitHub',exact:true}).click();const popup=await popupPromise;
 // Exercise closing a visible sign-in page without racing initial navigation and the automation target's creation.
 await expect(popup.getByText('Mock sign-in cancellation',{exact:true})).toBeVisible();
 await popup.close();expect(popup.isClosed()).toBe(true);
 await expect(page.locator('#status')).toContainText('cancelled');await expect(page.getByRole('button',{name:'Sign in with GitHub',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved in this browser');
 await page.reload();await page.getByRole('button',{name:'Site & contact',exact:true}).click();await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Recoverable draft');
});

});
