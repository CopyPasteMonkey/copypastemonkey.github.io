import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
const original=JSON.parse(await readFile('content/portfolio.json','utf8')).portfolio;
const frame=page=>page.frameLocator('#preview');
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('eli-portfolio-draft-v1')));
const edit=(scope,path)=>scope.locator('[data-edit-path="'+path+'"]');
async function save(page){await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved');}
async function add(page,category,label){await frame(page).getByRole('link',{name:category,exact:true}).click();await frame(page).getByRole('button',{name:label,exact:true}).click();const item=frame(page).locator('#view-'+category.toLowerCase()+' > .portfolio-entry').last();await expect(item.locator('.canvas-unfinished')).toBeVisible();return item;}

test('all existing jobs and projects expose populated or empty slots without changing source content',async({page})=>{
 await page.goto('/editor/visual.html');
 for(const [si,id] of [[0,'work'],[1,'projects']]){
  await frame(page).getByRole('link',{name:id==='work'?'Work':'Projects',exact:true}).click();
  for(const [ei,entry] of original.sections[si].entries.entries()){
   const item=frame(page).locator('#entry-'+entry.id),prefix=`sections[${si}].entries[${ei}]`;
   await expect(edit(item,prefix+'.title')).toHaveText(entry.title);await expect(edit(item,prefix+'.intro')).toHaveText(entry.intro);
   if(entry.image.length)await expect(item.locator(':scope > .entry-summary .entry-photo img')).toHaveAttribute('alt',entry.image[0].alt);else await expect(item.getByRole('button',{name:'Add image for '+entry.title,exact:true})).toBeVisible();
   if(id==='work')for(const [ri,role] of entry.roles.entries()){await expect(edit(item,prefix+`.roles[${ri}].role`)).toHaveText(role.role);await expect(edit(item,prefix+`.roles[${ri}].date`)).toHaveText(role.date);await expect(edit(item,prefix+`.roles[${ri}].label`)).toHaveText(role.label);}
  }
 }
 await save(page);expect((await saved(page)).portfolio).toEqual(original);await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(frame(page).locator('[data-editor-ui]')).toHaveCount(0);await expect(frame(page).locator('.canvas-image-slot')).toHaveCount(0);await expect(frame(page).locator('[data-placeholder]')).toHaveCount(0);
});

test('bottom Add job opens a complete blank layout, saves unfinished work, and completes inline with a library image',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/editor/visual.html');let item=await add(page,'Work','Add job');const p='sections[0].entries[8]';
 await expect(page.locator('#fields')).toBeHidden();await expect(edit(item,p+'.title')).toHaveText('');await expect(edit(item,p+'.intro')).toHaveText('');await expect(edit(item,p+'.roles[0].role')).toBeVisible();await expect(edit(item,p+'.roles[0].date')).toBeVisible();await expect(item.locator('.canvas-empty-details')).toBeVisible();await expect(item.getByRole('button',{name:'Add image for Untitled job'})).toBeVisible();
 await save(page);let data=await saved(page);expect(data.portfolio.sections[0].entries[8].title).toBe('');expect(data.portfolio.sections[0].entries[8].intro).toBe('');expect(data.editor.templates).toContain(data.portfolio.sections[0].entries[8].id);await expect(page.locator('#draft-completeness')).toContainText('1 unfinished');await page.reload();item=frame(page).locator('#entry-'+data.portfolio.sections[0].entries[8].id);await expect(item.locator('.canvas-empty-details')).toBeVisible();
 await edit(item,p+'.title').fill('Review Engineering');await edit(item,p+'.title').press('Tab');await expect(edit(item,p+'.intro')).toBeFocused();await edit(item,p+'.intro').fill('A real summary written for the review.');await edit(item,p+'.roles[0].role').fill('Mechanical engineer');await edit(item,p+'.roles[0].date').fill('2026–present');await item.locator('.canvas-empty-details').fill('Designed and tested a new fixture.');await item.getByRole('button',{name:/^Add image for/}).click();await page.locator('.image-choice[data-media=nimbus-12]').click();const selectedAlt=await page.getByRole('textbox',{name:'Image description (alt text)',exact:true}).inputValue();await page.getByRole('button',{name:'Use image',exact:true}).click();await save(page);
 data=await saved(page);expect(data.portfolio.sections[0].entries[8]).toMatchObject({title:'Review Engineering',intro:'A real summary written for the review.',roles:[{role:'Mechanical engineer',date:'2026–present',blocks:[{type:'text',text:'Designed and tested a new fixture.'}]}]});expect(data.portfolio.sections[0].entries[8].image[0].media).toBe('nimbus-12');await expect(page.locator('#draft-completeness')).toBeHidden();await page.reload();await expect(item.locator('.entry-summary img')).toHaveAttribute('alt',selectedAlt);expect(errors).toEqual([]);
});

test('project template supplies project metadata and details, accepts an uploaded image, and omits empty fields from visitor preview',async({page})=>{
 await page.goto('/editor/visual.html');const item=await add(page,'Projects','Add project'),p='sections[1].entries[2]';
 await expect(edit(item,p+'.role')).toBeVisible();await expect(edit(item,p+'.date')).toBeVisible();await edit(item,p+'.title').fill('Review project');await edit(item,p+'.intro').fill('Built a compact prototype.');await edit(item,p+'.role').fill('Design and testing');await edit(item,p+'.date').fill('2026');await item.locator('.canvas-empty-details').fill('Measured the prototype and refined its geometry.');await item.getByRole('button',{name:/^Add image for/}).click();
 const chooser=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Upload from device',exact:true}).click();await (await chooser).setFiles('assets/media/mott-permeability-chart.jpg');await expect(page.locator('.image-preview img')).toBeVisible();await page.getByRole('textbox',{name:'Image description (alt text)',exact:true}).fill('Measurements from the review prototype');await page.getByRole('button',{name:'Use image',exact:true}).click();await save(page);const data=(await saved(page)).portfolio;expect(data.sections[1].entries[2]).toMatchObject({role:'Design and testing',date:'2026'});expect(data.media).toHaveLength(original.media.length+1);
 await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(frame(page).locator('[data-editor-ui]')).toHaveCount(0);await expect(frame(page).locator('#entry-'+data.sections[1].entries[2].id+' img')).toHaveAttribute('alt','Measurements from the review prototype');await expect(frame(page).locator('body')).not.toContainText('For example, Current Work or Internship');
 await page.getByRole('button',{name:'Back to editing',exact:true}).click();await page.reload();await frame(page).getByRole('link',{name:'Projects',exact:true}).click();await expect(frame(page).locator('#entry-'+data.sections[1].entries[2].id+' img')).toHaveAttribute('alt','Measurements from the review prototype');
});

test('visible move buttons respect boundaries, retain keyboard focus and stable links, and support undo and reload',async({page})=>{
 await page.goto('/editor/visual.html');const first=frame(page).locator('#entry-nimbus'),last=frame(page).locator('#entry-first'),mott=frame(page).locator('#entry-mott');
 await expect(first.locator('[data-entry-move=up]')).toBeDisabled();await expect(frame(page).locator('#view-work > .portfolio-entry').last().locator('[data-entry-move=down]')).toBeDisabled();
 await mott.locator('[data-entry-move=up]').press('Enter');await expect(mott.locator('[data-entry-move=up]')).toBeFocused();await save(page);let entries=(await saved(page)).portfolio.sections[0].entries;expect(entries[2].id).toBe('mott');expect(entries[2].roles[0].id).toBe(original.sections[0].entries[3].roles[0].id);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await save(page);expect((await saved(page)).portfolio.sections[0].entries.map(e=>e.id)).toEqual(original.sections[0].entries.map(e=>e.id));await first.locator('[data-entry-move=down]').click();await save(page);await page.reload();entries=(await saved(page)).portfolio.sections[0].entries;expect(entries[1].id).toBe('nimbus');expect(entries[1].roles.map(r=>r.id)).toEqual(original.sections[0].entries[0].roles.map(r=>r.id));
});

test('unfinished templates survive a backup restore but cannot appear in visitor preview or the strict publication check',async({page,browser})=>{
 await page.goto('/editor/visual.html');await add(page,'Work','Add job');await save(page);const data=await saved(page),id=data.portfolio.sections[0].entries[8].id;
 await page.getByRole('button',{name:'Preview',exact:true}).click();await expect(frame(page).locator('#entry-'+id)).toHaveCount(0);await page.getByRole('button',{name:'Back to editing',exact:true}).click();await expect(frame(page).locator('#entry-'+id)).toBeVisible();
 // Exercise the real validation handler while publication is disabled for review.
 await page.locator('#publish').evaluate(button=>button.onclick());await expect(page.locator('#status')).toContainText('Not ready to publish');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();const bytes=await readFile(await (await download).path());const other=await browser.newPage();try{await other.goto('/editor/visual.html');await other.locator('#import').setInputFiles({name:'portfolio-draft.zip',mimeType:'application/zip',buffer:bytes});await other.getByRole('dialog').getByRole('button',{name:'Restore backup',exact:true}).click();await save(other);await other.reload();await expect(frame(other).locator('#entry-'+id+' .canvas-unfinished')).toBeVisible();expect((await saved(other)).portfolio.sections[0].entries[8].title).toBe('');}finally{await other.close();}
});

test('blank layouts stay usable on a phone and their labeled slots remain editor-only',async({page})=>{
 await page.goto('/editor/visual.html');const item=await add(page,'Work','Add job');await edit(item,'sections[0].entries[8].title').focus();await item.evaluate(node=>node.scrollIntoView({block:'start'}));await page.screenshot({path:'.local/template-job-desktop.png'});
 await page.setViewportSize({width:390,height:844});await item.locator('.canvas-image-slot').scrollIntoViewIfNeeded();await page.screenshot({path:'.local/template-job-phone.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await frame(page).locator('html').evaluate(e=>e.scrollWidth<=e.ownerDocument.defaultView.innerWidth)).toBe(true);await item.getByRole('button',{name:'Add image for Untitled job'}).press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await save(page);expect((await saved(page)).portfolio.media).toHaveLength(original.media.length);
});
