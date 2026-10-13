import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const portfolio=JSON.parse(fs.readFileSync('content/portfolio.json')).portfolio;
async function setup(page,{failure=false,remoteName=null,noDraft=false,signInFirst=true,authFailure=false}={}){
 const remoteData=structuredClone(portfolio);if(remoteName)remoteData.site.name=remoteName;
 await page.route('**/editor/auth-client.mjs',route=>route.fulfill({contentType:'text/javascript',body:`export async function signIn(){window.signinCalls=(window.signinCalls||0)+1;${authFailure?"throw Error('Sign-in cancelled');":"return {}"}}`}));
 await page.route('**/editor/remote.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
 export const publishingReady=()=>true;
 const state={published:${JSON.stringify(portfolio)},draft:${noDraft?'null':JSON.stringify({data:remoteData,pr:{number:1}})}};
 export function createRemote(){return {isConnected:()=>!!window.connected,connect:async()=>{window.connected=true;return state},snapshot:async()=>state,media:async()=>new Map(),adopt:()=>{},saveDraft:async data=>{window.savedRemote=JSON.parse(JSON.stringify(data));state.draft={data:window.savedRemote,pr:{number:1}};return state.draft;},review:async()=>{await new Promise(r=>setTimeout(r,100));return {head:'a'.repeat(40),url:'https://github.com/elidoggart/elidoggart.github.io/pull/1'}},publish:async()=>{window.mergeCalls=(window.mergeCalls||0)+1;await new Promise(r=>setTimeout(r,100));${failure?"throw Error('GitHub blocked the merge. Please retry.');":"state.published=state.draft.data;state.draft=null;return {sha:'b'.repeat(40)};"}},deployment:async()=>{window.deploymentCalls=(window.deploymentCalls||0)+1;return {state:window.deploymentState||'pending'}},end:()=>{}}}` }));
 await page.goto('/editor/');if(signInFirst){await page.getByRole('button',{name:'Sign in with GitHub',exact:true}).click();await expect(page.getByText('GitHub connected',{exact:true})).toBeVisible();}
}
test('publish gives immediate stages, polls automatically and confirms live without duplicate merge',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Publish…',exact:true}).click();
 const progress=page.getByRole('region',{name:'Publication progress'});
 await expect(progress).toContainText('Checking your draft');await expect(page.getByRole('dialog')).toBeVisible();
 await expect(progress).toContainText('Ready to publish');
 await page.getByRole('button',{name:'Publish now',exact:true}).click();await expect(progress).toContainText('Publishing your draft');
 await expect(progress).toContainText('Updating your website');await expect(page.getByRole('dialog')).not.toBeVisible();await page.screenshot({path:'.local/publish-progress-desktop.png'});
 await page.getByRole('button',{name:'Publish…',exact:true}).click();expect(await page.evaluate(()=>window.mergeCalls)).toBe(1);
 await page.evaluate(()=>window.deploymentState='success');
 await expect(progress).toContainText('Your changes are live',{timeout:15000});await expect(progress.getByRole('link',{name:'Open live website'})).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('portfolio-pending-publication'))).toBeNull();
});
test('pending publication survives reload and reports failure with a retry',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Publish…',exact:true}).click();await page.getByRole('button',{name:'Publish now',exact:true}).click();
 const progress=page.getByRole('region',{name:'Publication progress'});await expect(progress).toContainText('Updating your website');
 await page.reload();await expect(progress).toContainText('Updating your website');
 await page.evaluate(()=>window.deploymentState='failure');await expect(progress).toContainText('Website update needs attention',{timeout:15000});
 await expect(progress.getByRole('link',{name:'View deployment in GitHub'})).toBeVisible();
 await page.evaluate(()=>window.deploymentState='success');await progress.getByRole('button',{name:'Check again'}).click();await expect(progress).toContainText('Your changes are live');
});
test('merge rejection stays visible and allows another review',async({page})=>{
 await setup(page,{failure:true});await page.getByRole('button',{name:'Publish…',exact:true}).click();await page.getByRole('button',{name:'Publish now',exact:true}).click();
 const progress=page.getByRole('region',{name:'Publication progress'});await expect(progress).toContainText('Publication could not continue');await expect(progress).toContainText('GitHub blocked');await expect(page.getByRole('button',{name:'Publish…',exact:true})).toBeEnabled();expect(await page.evaluate(()=>sessionStorage.getItem('portfolio-pending-publication'))).toBeNull();
});
test('network failure and long deployment offer manual retry without false success or overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/editor/');
 await page.evaluate(async()=>{document.querySelector('.publish-progress').remove();const {createPublishProgress}=await import('/editor/publish-progress.mjs');window.tracker=createPublishProgress({anchor:document.querySelector('.notice'),maxWait:0,checkDeployment:async()=>{if(!window.networkWorks)throw Error('offline');return {state:window.nextState||'pending'}}});await window.tracker.start('c'.repeat(40));});
 const progress=page.getByRole('region',{name:'Publication progress'});await expect(progress).toContainText('Unable to check');
 await page.evaluate(()=>window.networkWorks=true);await progress.getByRole('button',{name:'Check again'}).click();await expect(progress).toContainText('Taking longer than usual');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/publish-progress-phone.png'});
 await page.evaluate(()=>window.nextState='success');await progress.getByRole('button',{name:'Check again'}).click();await expect(progress).toContainText('Your changes are live');
});

for(const choice of ['Keep my current edits','Load saved GitHub version'])test('Publish reconciles an existing GitHub draft: '+choice,async({page})=>{
 await setup(page,{remoteName:'GitHub draft',signInFirst:false});await page.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('My current edits');
 await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Which version');expect(await page.evaluate(()=>window.savedRemote)).toBeUndefined();
 await page.getByRole('button',{name:choice,exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Ready to update your website');await page.screenshot({path:'.local/simple-publish-confirm.png'});
 const name=choice.startsWith('Keep')?'My current edits':'GitHub draft';await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue(name);expect(await page.evaluate(()=>window.signinCalls)).toBe(1);expect(await page.evaluate(()=>window.mergeCalls)).toBeUndefined();
 if(choice.startsWith('Load'))expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-before-github-load')).portfolio.site.name)).toBe('My current edits');
 await page.getByRole('button',{name:'Publish now',exact:true}).click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Updating your website');expect(await page.evaluate(()=>window.mergeCalls)).toBe(1);
});
test('Publish cancellation preserves local edits without overwriting the GitHub draft',async({page})=>{
 await setup(page,{remoteName:'Other saved draft',signInFirst:false});await page.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('My unsaved edits');await page.getByRole('button',{name:'Publish…',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('My unsaved edits');expect(await page.evaluate(()=>window.savedRemote)).toBeUndefined();expect(await page.evaluate(()=>window.mergeCalls)).toBeUndefined();await expect(page.getByRole('button',{name:'Publish…',exact:true})).toBeEnabled();
});
test('Publish handles no changes and a second publication in the same session',async({page})=>{
 await setup(page,{noDraft:true,signInFirst:false});await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('already up to date');expect(await page.evaluate(()=>window.savedRemote)).toBeUndefined();
 for(const name of ['First publication','Second publication']){await page.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill(name);await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Ready to update');await page.evaluate(()=>window.deploymentState='success');await page.getByRole('button',{name:'Publish now',exact:true}).click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Your changes are live');}
 expect(await page.evaluate(()=>window.mergeCalls)).toBe(2);
});
test('Publish sign-in cancellation keeps unsaved edits and permits retry',async({page})=>{
 await setup(page,{noDraft:true,signInFirst:false,authFailure:true});await page.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('Keep these edits');await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Sign-in was not completed');await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Keep these edits');await expect(page.getByRole('button',{name:'Publish…',exact:true})).toBeEnabled();
});

test('Publish protects another tab draft and permits an explicit choice to keep this tab',async({page})=>{
 await setup(page,{noDraft:true});await page.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('This tab version');
 await page.evaluate(async()=>{const {draftKey}=await import('/editor/drafts.mjs');localStorage.setItem(draftKey,JSON.stringify({draftRevision:123,portfolio:{site:{name:'Other tab version'}}}));});
 await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Another tab saved a draft');await page.getByRole('button',{name:'Use this tab’s edits',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Ready to update');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-before-local-overwrite')).portfolio.site.name)).toBe('Other tab version');expect(await page.evaluate(()=>window.savedRemote.site.name)).toBe('This tab version');
});
