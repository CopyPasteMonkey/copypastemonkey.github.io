import {test,expect} from '@playwright/test';
import {PDFDocument} from 'pdf-lib';
import fs from 'node:fs';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/editor-content.json')).portfolio;
const original=fs.readFileSync(fixture.site.resume);
async function openResource(page){await page.getByRole('button',{name:'Links & downloads',exact:true}).click();await page.locator('#fields > div .list > details').first().locator('summary').click();}
test('certificate replacement survives preview, save, reload, undo and a portable backup restored into empty storage',async({page,browser})=>{
 const pdf=await PDFDocument.load(original);pdf.setTitle('Certificate upload audit');const bytes=Buffer.from(await pdf.save());
 await page.goto('/editor/');await openResource(page);const upload=page.getByLabel('Upload PDF',{exact:true});
 await upload.setInputFiles({name:'Certificate.pdf',mimeType:'application/pdf',buffer:Buffer.from('invalid')});await expect(page.locator('#status')).toContainText('not a complete PDF');
 const file={name:'Certificate.pdf',mimeType:'application/pdf',buffer:bytes};await upload.setInputFiles(file);await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByLabel('Website address',{exact:true})).toHaveValue(fixture.resources[0].url);
 await upload.setInputFiles(file);await page.getByRole('button',{name:'Use this PDF in draft',exact:true}).click();await expect(page.locator('#status')).toContainText('PDF added');
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved');
 const data=await page.evaluate(()=>JSON.parse(localStorage.getItem('eli-portfolio-draft-v1')).portfolio);const src=data.resources[0].url;expect(src).toMatch(/^assets\/documents\/resume-[a-f0-9]{20}\.pdf$/);expect(data.site.resume).toBe(fixture.site.resume);
 // Renderer resolves draft PDF links without needing a deployed asset.
 const rendered=await page.evaluate(async()=>{const d=JSON.parse(localStorage.getItem('eli-portfolio-draft-v1')).portfolio;const {render}=await import('/lib/render.mjs');return render(d,{mediaURL:src=>src===d.resources[0].url?'blob:certificate-preview':src});});expect(rendered).toContain('href="blob:certificate-preview"');
 await page.reload();await openResource(page);await expect(page.getByRole('link',{name:'Open current link or PDF'})).toHaveAttribute('href',/^blob:/);
 await page.getByLabel('Website address',{exact:true}).fill('https://example.com/replacement');await page.getByRole('button',{name:'Undo',exact:true}).click();await openResourceAfterUndo(page);await expect(page.getByLabel('Website address',{exact:true})).toHaveValue(src);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();const download=await pending;const path=await download.path();
 const context=await browser.newContext();const fresh=await context.newPage();await fresh.goto('/editor/');await fresh.getByLabel('Restore backup',{exact:true}).setInputFiles({name:'portable.zip',mimeType:'application/zip',buffer:fs.readFileSync(path)});await fresh.getByRole('dialog').getByRole('button',{name:'Restore backup',exact:true}).click();await expect(fresh.locator('#status')).toContainText('Backup restored');await fresh.getByRole('button',{name:'Save Draft',exact:true}).click();
 expect(await fresh.evaluate(async src=>{const {getImages}=await import('/editor/drafts.mjs');return (await getImages()).get(src)?.size;},src)).toBe(bytes.length);await context.close();
});
async function openResourceAfterUndo(page){const details=page.locator('#fields > div .list > details').first();if(!await details.evaluate(e=>e.open))await details.locator('summary').click();}
test('new projects and skill details expose blank roles and dates, and PDF controls fit phones',async({page})=>{
 await page.goto('/editor/');for(const [section,add] of [['Projects','Add project'],['Skills','Add skill group']]){
  await page.getByRole('button',{name:section,exact:true}).click();await page.getByRole('button',{name:add,exact:true}).click();const entry=page.locator('.form-entry').last();await expect(entry.getByLabel('Role or description',{exact:true})).toBeVisible();await expect(entry.getByLabel('Dates',{exact:true})).toBeVisible();
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('combobox',{name:'Edit section',exact:true}).selectOption('resources');await page.locator('#fields > div .list > details').first().locator('summary').click();await expect(page.getByLabel('Upload PDF',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
