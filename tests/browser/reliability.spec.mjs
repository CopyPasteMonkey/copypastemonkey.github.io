import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const original=JSON.parse(await fs.readFile('content/portfolio.json')).portfolio;
const key='eli-portfolio-draft-v1';
const name=page=>page.getByRole('textbox',{name:'Name',exact:true});
const save=async page=>{await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#save')).toBeEnabled();};
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
async function profile(page){await page.getByRole('button',{name:'Site & contact',exact:true}).click();}
async function backup(page){const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();return fs.readFile(await(await pending).path());}
async function remote(page,{different=false}={}){
 const other=structuredClone(original);if(different)other.site.name='GitHub version';
 await page.route('**/editor/auth-client.mjs',r=>r.fulfill({contentType:'text/javascript',body:'export async function signIn(){return {}}'}));
 await page.route('**/editor/remote.mjs',r=>r.fulfill({contentType:'text/javascript',body:`
 export const publishingReady=()=>true;
 const state={published:${JSON.stringify(original)},publishedHead:'a'.repeat(40),draft:${different?JSON.stringify({data:other,pr:{number:1},head:'b'.repeat(40)}):'null'}};
 const pause=async kind=>{if(window.hold===kind)await new Promise(resolve=>window.release=resolve);if(window.fail===kind)throw Error('Test connection interrupted. Click Publish to try again.');};
 export function createRemote(){return {isConnected:()=>!!window.connected,connect:async()=>{window.connected=true;return state},snapshot:async()=>{await pause('snapshot');return state},adopt(){},media:async()=>{await pause('media');return new Map()},saveDraft:async data=>{window.submitted=structuredClone(data);await pause('save');state.draft={data:window.submitted,pr:{number:1}};return state.draft},review:async()=>{await pause('review');if(window.waitForChecks){const e=Error('GitHub is still validating. Nothing has failed. Click Publish again shortly.');e.pending=true;throw e;}return {head:'b'.repeat(40),number:1}},publish:async()=>{window.merges=(window.merges||0)+1;await pause('merge');state.published=state.draft.data;state.draft=null;return {sha:'c'.repeat(40)}},deployment:async()=>({state:window.deployState||'pending'}),end:()=>{window.connected=false}}}
 `}));
 await page.goto('/editor/');await page.getByRole('button',{name:'Sign in with GitHub',exact:true}).click();await expect(page.locator('#mode-label')).toHaveText('GitHub connected');await profile(page);
}

test('unfinished fields save, reload and round-trip through backup without becoming publishable',async({page,browser})=>{
 await page.goto('/editor/');await profile(page);await name(page).fill('');await page.getByRole('textbox',{name:'Email',exact:true}).fill('half-written@');await save(page);
 await expect(page.locator('#status')).toContainText('Draft saved');expect((await saved(page)).portfolio.site.email).toBe('half-written@');await page.reload();await profile(page);await expect(name(page)).toHaveValue('');await expect(page.getByRole('textbox',{name:'Email',exact:true})).toHaveValue('half-written@');
 const bytes=await backup(page),other=await browser.newPage();try{await other.goto('/editor/');await other.locator('#import').setInputFiles({name:'unfinished.zip',mimeType:'application/zip',buffer:bytes});await other.getByRole('dialog').getByRole('button',{name:'Restore backup',exact:true}).click();await expect(other.locator('#status')).toContainText('Backup restored');await profile(other);await expect(name(other)).toHaveValue('');await other.locator('#publish').evaluate(button=>button.onclick());await expect(other.locator('#status')).toContainText('Not ready to publish');await name(other).fill('Recovered name');await other.getByRole('textbox',{name:'Email',exact:true}).fill('recovered@example.com');await save(other);await expect(other.locator('#draft-state')).toHaveText('Saved in this browser');}finally{await other.close();}
});

test('reload recovers the last unsaved keystroke and Undo restores the saved version',async({page})=>{
 await page.goto('/editor/');await profile(page);await name(page).fill('Saved name');await save(page);await name(page).fill('The last unsaved keystroke');
 const warning=page.waitForEvent('dialog');const reload=page.reload();const dialog=await warning;expect(dialog.type()).toBe('beforeunload');await dialog.accept();await reload;
 await expect(page.getByText(/Recovered edits are available/)).toBeVisible();await profile(page);await expect(name(page)).toHaveValue('Saved name');await page.getByRole('button',{name:'Restore recovered edits',exact:true}).click();await expect(name(page)).toHaveValue('The last unsaved keystroke');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(name(page)).toHaveValue('Saved name');
});

test('two tabs retain separate recoveries and a cancelled save conflict preserves both versions',async({page,context})=>{
 await page.goto('/editor/');await profile(page);await name(page).fill('Shared saved version');await save(page);
 const other=await context.newPage();await other.goto('/editor/');await profile(other);await name(page).fill('First unsaved tab');await name(other).fill('Second unsaved tab');
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('eli-portfolio-unsaved-')).length)).toBe(2);
 await save(other);await page.locator('#save').click();await expect(page.getByRole('dialog')).toContainText('Another tab saved a draft');await page.getByRole('button',{name:'Cancel',exact:true}).click();expect((await saved(page)).portfolio.site.name).toBe('Second unsaved tab');await expect(name(page)).toHaveValue('First unsaved tab');
 await page.locator('#save').click();await page.getByRole('button',{name:'Use this tab’s edits',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved');expect((await saved(page)).portfolio.site.name).toBe('First unsaved tab');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('portfolio-before-local-overwrite')).portfolio.site.name)).toBe('Second unsaved tab');await other.close();
});

test('full storage keeps the old saved draft and allows a backup of the current edits',async({page})=>{
 await page.goto('/editor/');await profile(page);await name(page).fill('Safe saved copy');await save(page);
 await page.evaluate(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('eli-portfolio-'))throw new DOMException('Quota exceeded','QuotaExceededError');return set.call(this,key,value)}});
 await name(page).fill('Keep this despite full storage');await save(page);await expect(page.locator('#status')).toContainText('Download backup now');await expect(page.locator('#draft-state')).toHaveText('Unsaved changes');expect((await saved(page)).portfolio.site.name).toBe('Safe saved copy');expect((await backup(page)).length).toBeGreaterThan(1000);await expect(name(page)).toHaveValue('Keep this despite full storage');
});

test('blocked browser storage does not prevent opening the editor or downloading a backup',async({page})=>{
 await page.addInitScript(()=>{for(const key of ['localStorage','sessionStorage'])Object.defineProperty(window,key,{get(){throw new DOMException('Blocked','SecurityError')}})});await page.goto('/editor/');await profile(page);await name(page).fill('Export without storage');await save(page);await expect(page.locator('#status')).toContainText('Download backup now');expect((await backup(page)).length).toBeGreaterThan(1000);
});

for(const editorPath of ['/editor/','/editor/visual.html'])test('a slow backup restore locks edits, cancellation is harmless, and a failed file can be retried: '+editorPath,async({page})=>{
 await page.goto(editorPath);await profile(page);await name(page).fill('Keep my existing edit');
 await page.evaluate(()=>{const read=File.prototype.text;File.prototype.text=async function(){await new Promise(resolve=>window.releaseRead=resolve);return read.call(this)}});
 const next=structuredClone(original);next.site.name='From the backup';const file={name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({portfolio:next}))};await page.locator('#import').setInputFiles(file);
 await expect(page.locator('#fields')).toHaveJSProperty('inert',true);await expect(page.locator('#preview')).toHaveJSProperty('inert',true);if(editorPath.includes('visual'))await expect(page.locator('#canvas-toolbar')).toHaveJSProperty('inert',true);await expect(page.locator('#save')).toBeDisabled();await expect(page.locator('#undo')).toBeDisabled();await page.evaluate(()=>window.releaseRead());await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(name(page)).toHaveValue('Keep my existing edit');await expect(page.locator('#save')).toBeEnabled();
 await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{damaged')});await page.evaluate(()=>window.releaseRead());await expect(page.locator('#status')).toContainText('Your current draft is unchanged');await expect(page.locator('#save')).toBeEnabled();
 await page.locator('#import').setInputFiles(file);await page.evaluate(()=>window.releaseRead());await page.getByRole('dialog').getByRole('button',{name:'Restore backup',exact:true}).click();await expect(name(page)).toHaveValue('From the backup');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(name(page)).toHaveValue('Keep my existing edit');
});

test('a slow GitHub save preserves newer edits and accurately identifies the saved version',async({page})=>{
 await remote(page);await name(page).fill('Version being saved');await page.evaluate(()=>window.hold='save');await page.locator('#save').click();await page.waitForFunction(()=>typeof window.release==='function');await expect(page.locator('#save')).toHaveText('Saving…');await expect(page.locator('#publish')).toBeDisabled();await name(page).fill('Newer edits while saving');await page.waitForFunction(()=>typeof window.release==='function');await page.evaluate(()=>window.release());await expect(page.locator('#status')).toContainText('newer unsaved edits');expect((await saved(page)).portfolio.site.name).toBe('Version being saved');await expect(name(page)).toHaveValue('Newer edits while saving');await page.evaluate(()=>window.hold=null);await save(page);expect((await saved(page)).portfolio.site.name).toBe('Newer edits while saving');await expect(page.locator('#draft-state')).toHaveText('Saved in this browser');
});

test('a failed GitHub save preserves the local copy and allows a successful retry',async({page})=>{
 await remote(page);await name(page).fill('Saved even when offline');await page.evaluate(()=>window.fail='save');await save(page);await expect(page.locator('#status')).toContainText('saved locally');expect((await saved(page)).portfolio.site.name).toBe('Saved even when offline');await expect(page.locator('#save')).toBeEnabled();await page.evaluate(()=>window.fail=null);await save(page);await expect(page.locator('#status')).toContainText('Draft saved to a public GitHub branch');
});

test('loading GitHub files locks mutation controls, preserves failed loads, and supports retry and Undo',async({page})=>{
 await remote(page,{different:true});await name(page).fill('My current edits');await page.evaluate(()=>{window.hold='media';window.fail='media'});await page.getByRole('button',{name:'Load saved version',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Load saved version',exact:true}).click();await expect(page.locator('#fields')).toHaveJSProperty('inert',true);await expect(page.locator('#import')).toBeDisabled();await page.waitForFunction(()=>typeof window.release==='function');await page.evaluate(()=>window.release());await expect(page.locator('#status')).toContainText('could not be loaded');await expect(name(page)).toHaveValue('My current edits');await expect(page.locator('#save')).toBeEnabled();
 await page.evaluate(()=>{window.hold=null;window.fail=null});await page.getByRole('button',{name:'Load saved version',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Load saved version',exact:true}).click();await expect(name(page)).toHaveValue('GitHub version');await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(name(page)).toHaveValue('My current edits');
});

test('waiting checks are not shown as failure and a slow merge prevents overlapping edits and duplicate publication',async({page})=>{
 await remote(page);await name(page).fill('Ready for publication');await page.evaluate(()=>window.waitForChecks=true);await page.locator('#publish').click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Checks are still running');await expect(page.locator('.publish-progress')).not.toHaveClass(/error/);await expect(page.locator('#save')).toBeEnabled();
 await page.evaluate(()=>{window.waitForChecks=false;window.hold='merge'});await page.locator('#publish').click();await page.getByRole('button',{name:'Publish now',exact:true}).click();await expect(page.locator('#fields')).toHaveJSProperty('inert',true);await expect(page.locator('#publish')).toBeDisabled();await expect(page.locator('#import')).toBeDisabled();await page.waitForFunction(()=>typeof window.release==='function');await page.evaluate(()=>window.release());await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Updating your website');await expect(page.locator('#save')).toBeEnabled();expect(await page.evaluate(()=>window.merges)).toBe(1);
});

test('published content with an interrupted response checks deployment instead of falsely claiming it is live',async({page})=>{
 await remote(page);await page.locator('#publish').click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Updating your website');await expect(page.getByRole('region',{name:'Publication progress'})).not.toContainText('Your changes are live');expect(await page.evaluate(()=>window.merges)).toBeUndefined();await page.evaluate(()=>window.deployState='success');await page.locator('#publish').click();await expect(page.getByRole('region',{name:'Publication progress'})).toContainText('Your changes are live');
});

test('a new deployment tracker supersedes an in-flight old check and recovers from failure',async({page})=>{
 await page.goto('/editor/');await page.evaluate(async()=>{document.querySelector('.publish-progress').remove();const {createPublishProgress}=await import('/editor/publish-progress.mjs');window.tracker=createPublishProgress({anchor:document.querySelector('.notice'),interval:20,checkDeployment:async sha=>{if(sha.startsWith('a'))return new Promise(resolve=>window.oldCheck=resolve);return {state:window.nextState||'failure'}}});window.tracker.start('a'.repeat(40));await window.tracker.start('b'.repeat(40));});
 const panel=page.getByRole('region',{name:'Publication progress'});await expect(panel).toContainText('Website update needs attention');await page.evaluate(()=>window.oldCheck({state:'success'}));await expect(panel).toContainText('Website update needs attention');await page.evaluate(()=>window.nextState='pending');await panel.getByRole('button',{name:'Check again'}).click();expect(await page.evaluate(()=>window.tracker.isPending())).toBe(true);await page.evaluate(()=>window.nextState='success');await expect(panel).toContainText('Your changes are live');
});

test('failed content loading uses the last downloaded website copy without losing a saved draft',async({page})=>{
 await page.goto('/editor/');await profile(page);await name(page).fill('Work kept through a connection failure');await save(page);
 await page.route('**/content/portfolio.json',route=>route.abort('internetdisconnected'));await page.reload();await expect(page.getByText(/latest website content could not be loaded/)).toBeVisible();await profile(page);await expect(name(page)).toHaveValue('Work kept through a connection failure');await name(page).fill('Continued editing with cached content');await save(page);expect((await saved(page)).portfolio.site.name).toBe('Continued editing with cached content');expect((await backup(page)).length).toBeGreaterThan(1000);
});

test('missing uploaded files still allow an honest, restorable text recovery download',async({page,browser})=>{
 const data=structuredClone(original);data.site.name='Text survives missing images';data.media.push({id:'upload-'+'a'.repeat(20),src:'assets/images/upload-'+'a'.repeat(20)+'.png',width:10,height:10});
 await page.addInitScript(data=>localStorage.setItem('eli-portfolio-draft-v1',JSON.stringify({portfolio:data})),data);await page.goto('/editor/');await profile(page);await save(page);await expect(page.locator('#status')).toContainText('uploaded file(s) are missing');const pending=page.waitForEvent('download');await page.locator('#export').click();const download=await pending;expect(download.suggestedFilename()).toBe('portfolio-text-recovery.json');const bytes=await fs.readFile(await download.path());expect(JSON.parse(bytes).portfolio.site.name).toBe(data.site.name);await expect(page.locator('#status')).toContainText('NOT included');
 const other=await browser.newPage();try{await other.goto('/editor/');await profile(other);await other.locator('#import').setInputFiles({name:'portfolio-text-recovery.json',mimeType:'application/json',buffer:bytes});await expect(other.getByRole('dialog')).toContainText('text-only recovery');await other.getByRole('dialog').getByRole('button',{name:'Restore backup',exact:true}).click();await expect(name(other)).toHaveValue(data.site.name);await expect(other.locator('#status')).toContainText('Text recovered');}finally{await other.close();}
});

test('image decoding errors explain how to recover, and the next image can still be used',async({page})=>{
 await page.goto('/editor/');const card=page.locator('[data-entry-id="nimbus"]');await card.getByLabel('Choose image from device',{exact:true}).setInputFiles({name:'damaged.jpg',mimeType:'image/jpeg',buffer:Buffer.from([255,216,0,0,0])});const dialog=page.getByRole('dialog',{name:'Replace image'});await expect(dialog.getByRole('alert')).toContainText('This image could not be opened');await expect(dialog.getByRole('alert')).toContainText('export a JPEG or PNG');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.locator('.image-picker')).toHaveCount(0);
 await card.getByLabel('Choose image from device',{exact:true}).setInputFiles('assets/media/mott-permeability-chart.jpg');await expect(page.locator('.image-picker-message')).toContainText('Image ready');await page.getByRole('dialog').getByRole('textbox',{name:'Image description (alt text)',exact:true}).fill('Successful retry after a damaged image');await page.getByRole('button',{name:'Use image',exact:true}).click();await save(page);expect((await saved(page)).portfolio.sections[0].entries[0].image[0].alt).toBe('Successful retry after a damaged image');
});

test('uploaded file bytes persist through browser storage and reload',async({page})=>{
 await page.goto('/editor/');await profile(page);const result=await page.evaluate(async()=>{const {putImage,getImages}=await import('/editor/media-store.mjs');const blob=await(await fetch('/assets/media/mott-permeability-chart.jpg')).blob();try{await putImage('audit-storage-fixture',blob);const stored=(await getImages()).get('audit-storage-fixture');return {size:stored.size,expected:blob.size}}catch(error){return {error:error.message,cause:error.cause?.name+': '+error.cause?.message}}});expect(result.error,result.cause).toBeUndefined();expect(result.size).toBe(result.expected);await page.reload();expect(await page.evaluate(async()=>{const {getImages}=await import('/editor/media-store.mjs');return (await getImages()).get('audit-storage-fixture').size})).toBe(result.expected);
});

test('a tab holding the draft lock cannot leave another tab stuck on Saving',async({page,context})=>{
 await page.goto('/editor/');await profile(page);await name(page).fill('Keep this draft');const other=await context.newPage();await other.goto('/editor/');await profile(other);await other.evaluate(()=>{navigator.locks.request('portfolio-draft',()=>new Promise(resolve=>window.releaseDraftLock=resolve))});await other.waitForFunction(()=>typeof window.releaseDraftLock==='function');await save(page);await expect(page.locator('#status')).toContainText('Another editor tab is saving');await expect(name(page)).toHaveValue('Keep this draft');expect((await backup(page)).length).toBeGreaterThan(1000);await other.evaluate(()=>window.releaseDraftLock());await save(page);expect((await saved(page)).portfolio.site.name).toBe('Keep this draft');await other.close();
});

test('an unfinished draft also reopens with usable correction fields in the visual editor',async({page})=>{
 const data=structuredClone(original);data.site.name='';await page.addInitScript(data=>{if(!localStorage.getItem('eli-portfolio-draft-v1'))localStorage.setItem('eli-portfolio-draft-v1',JSON.stringify({portfolio:data}));},data);await page.goto('/editor/visual.html');await expect(page.locator('#fields')).toBeVisible();await expect(name(page)).toHaveValue('');await name(page).fill('Recovered in visual editor');await save(page);await page.reload();await expect(page.frameLocator('#preview').locator('.name')).toHaveText('Recovered in visual editor');
});
