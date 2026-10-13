import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const original=JSON.parse(fs.readFileSync('tests/fixtures/editor-content.json')).portfolio;
const prefix='portfolio.sections[0].entries[0].roles[1].blocks';
const block=(page,index)=>page.locator('.content-node[data-path="'+prefix+'['+index+']"]');
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('eli-portfolio-draft-v1')).portfolio);
async function save(page){await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved');}

test('role and parent cues track edits, introduction controls remain keyboard accessible, and unchanged save is exact',async({page})=>{
 await page.goto('/editor/');const internship=page.locator('.role-fields').nth(1),skills=block(page,1),lab=block(page,2);
 await expect(internship.locator('legend')).toContainText('Internship');await expect(lab.locator(':scope > summary')).toContainText('Under Skills Developed');await expect(skills.locator(':scope > summary')).toContainText('3 subheadings');await expect(skills.locator('.heading-intro')).not.toHaveAttribute('open');await save(page);expect(await saved(page)).toEqual(original);
 await internship.getByRole('textbox',{name:'Role label · optional',exact:true}).fill('Earlier internship');await expect(internship.locator('legend')).toContainText('Earlier internship');await expect(page.locator('.entry-hint').first()).toContainText('Earlier internship');
 await skills.locator(':scope > .content-body > .heading-settings > summary').press('Enter');await skills.locator(':scope > .content-body > .heading-settings').getByRole('textbox',{name:'Heading text',exact:true}).fill('Technical skills');await expect(lab.locator(':scope > summary')).toContainText('Under Technical skills');
 const intro=skills.locator('.heading-intro');await intro.locator(':scope > summary').press('Enter');await intro.getByRole('button',{name:'Add content',exact:true}).press('Enter');await intro.getByRole('textbox',{name:'Text',exact:true}).fill('An introduction for the group.');await save(page);
 const data=await saved(page);expect(data.sections[0].entries[0].roles[1].blocks[1].blocks[0].text).toBe('An introduction for the group.');expect(data.sections[0].entries[0].roles[1].blocks[2]).toEqual(original.sections[0].entries[0].roles[1].blocks[2]);
 await page.getByRole('button',{name:'Preview website',exact:true}).click();const frame=page.frameLocator('#preview');await frame.getByRole('button',{name:/Expand Nimbus Power Systems.*Earlier internship/}).click();await expect(frame.getByRole('heading',{name:'Technical skills',exact:true,level:4})).toBeVisible();await expect(frame.getByText('An introduction for the group.',{exact:true})).toBeVisible();await expect(frame.getByRole('heading',{name:'LabView',exact:true,level:5})).toBeVisible();
});

test('explicitly collapsed groups stay closed when a neighboring heading moves',async({page})=>{
 await page.goto('/editor/');await block(page,1).locator(':scope > summary').press('Enter');await expect(block(page,1)).not.toHaveAttribute('open');
 await block(page,5).getByRole('button',{name:'Move Projects up',exact:true}).click();const skills=page.locator('.content-node').filter({has:page.locator(':scope > summary .content-title').filter({hasText:/^Skills Developed$/})}).first();await expect(skills).not.toHaveAttribute('open');await skills.locator(':scope > summary').press('Enter');await expect(skills).toHaveAttribute('open');
 await save(page);const blocks=(await saved(page)).sections[0].entries[0].roles[1].blocks;expect(blocks.find(b=>b.title==='LabView')).toEqual(original.sections[0].entries[0].roles[1].blocks[2]);
});

test('collapsed image thumbnails reflect replacements without losing image metadata and fit mobile',async({page})=>{
 await page.goto('/editor/');const lab=block(page,2);await lab.locator(':scope > summary').press('Enter');const gallery=page.locator('.content-node[data-path="'+prefix+'[2].blocks[1]"]');await expect(gallery.locator(':scope > summary img')).toHaveCount(3);await gallery.locator(':scope > summary').press('Enter');
 await gallery.locator('.photo-card').first().getByRole('button',{name:'Choose existing image',exact:true}).click();await page.locator('.image-choice[data-media="photo-00"]').click();await page.getByRole('button',{name:'Use image',exact:true}).click();await expect(gallery.locator(':scope > summary img').first()).toHaveAttribute('src','../'+original.media.find(m=>m.id==='photo-00').src);
 await save(page);const data=await saved(page);expect(data.sections[0].entries[0].roles[1].blocks[2].blocks[1].images[0].media).toBe('photo-00');expect(data.media).toEqual(original.media);await gallery.locator(':scope > summary').press('Enter');
 await page.setViewportSize({width:390,height:844});await lab.locator(':scope > summary').scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(gallery.locator(':scope > summary img').first()).toBeVisible();
});
