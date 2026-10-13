import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const portfolio=JSON.parse(fs.readFileSync('content/portfolio.json')).portfolio;
async function setup(page,{failure=false}={}){
 await page.route('**/editor/auth-client.mjs',route=>route.fulfill({contentType:'text/javascript',body:'export async function signIn(){return {}}'}));
 await page.route('**/editor/remote.mjs',route=>route.fulfill({contentType:'text/javascript',body:`
 export const publishingReady=()=>true;
 export function createRemote(){return {isConnected:()=>!!window.connected,connect:async()=>{window.connected=true;return {published:${JSON.stringify(portfolio)},draft:null}},adopt:()=>{},review:async()=>{await new Promise(r=>setTimeout(r,100));return {head:'a'.repeat(40),url:'https://github.com/elidoggart/elidoggart.github.io/pull/1'}},publish:async()=>{window.mergeCalls=(window.mergeCalls||0)+1;await new Promise(r=>setTimeout(r,100));${failure?"throw Error('GitHub blocked the merge. Please retry.');":"return {sha:'b'.repeat(40)};"}},deployment:async()=>{window.deploymentCalls=(window.deploymentCalls||0)+1;return {state:window.deploymentState||'pending'}},end:()=>{}}}` }));
 await page.goto('/editor/');await page.getByRole('button',{name:'Sign in with GitHub',exact:true}).click();
 await expect(page.getByText('GitHub connected',{exact:true})).toBeVisible();
}
test('publish gives immediate stages, polls automatically and confirms live without duplicate merge',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Publish…',exact:true}).click();
 const progress=page.getByRole('region',{name:'Publication progress'});
 await expect(progress).toContainText('Checking your draft');await expect(page.getByRole('dialog')).toBeVisible();
 await expect(progress).toContainText('Ready to publish');
 await page.getByRole('button',{name:'Publish reviewed draft',exact:true}).click();await expect(progress).toContainText('Publishing your draft');
 await expect(progress).toContainText('Updating your website');await expect(page.getByRole('dialog')).not.toBeVisible();await page.screenshot({path:'.local/publish-progress-desktop.png'});
 await page.getByRole('button',{name:'Publish…',exact:true}).click();expect(await page.evaluate(()=>window.mergeCalls)).toBe(1);
 await page.evaluate(()=>window.deploymentState='success');
 await expect(progress).toContainText('Your changes are live',{timeout:15000});await expect(progress.getByRole('link',{name:'Open live website'})).toBeVisible();
 expect(await page.evaluate(()=>sessionStorage.getItem('portfolio-pending-publication'))).toBeNull();
});
test('pending publication survives reload and reports failure with a retry',async({page})=>{
 await setup(page);await page.getByRole('button',{name:'Publish…',exact:true}).click();await page.getByRole('button',{name:'Publish reviewed draft',exact:true}).click();
 const progress=page.getByRole('region',{name:'Publication progress'});await expect(progress).toContainText('Updating your website');
 await page.reload();await expect(progress).toContainText('Updating your website');
 await page.evaluate(()=>window.deploymentState='failure');await expect(progress).toContainText('Website update needs attention',{timeout:15000});
 await expect(progress.getByRole('link',{name:'View deployment in GitHub'})).toBeVisible();
 await page.evaluate(()=>window.deploymentState='success');await progress.getByRole('button',{name:'Check again'}).click();await expect(progress).toContainText('Your changes are live');
});
test('merge rejection stays visible and allows another review',async({page})=>{
 await setup(page,{failure:true});await page.getByRole('button',{name:'Publish…',exact:true}).click();await page.getByRole('button',{name:'Publish reviewed draft',exact:true}).click();
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
