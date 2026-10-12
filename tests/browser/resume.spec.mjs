import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {PDFDocument} from 'pdf-lib';
const original=fs.readFileSync('assets/documents/Eli-Doggart-Resume.pdf');
const source='assets/documents/Eli-Doggart-Resume.pdf';
const file=(buffer=original,name='New Resume.pdf')=>({name,mimeType:'application/pdf',buffer});
const resume=page=>page.getByRole('button',{name:'Resume',exact:true});
for(const editorPath of ['/editor/visual.html','/editor/'])test.describe(editorPath,()=>{
test('resume validation, cancellation, replacement, save/reload, ZIP, and undo preserve the live file',async({page})=>{
 const writes=[];page.on('request',r=>{if(r.method()!=='GET')writes.push(r.url());});
 await page.goto(editorPath);await resume(page).click();const upload=page.getByLabel('Upload resume PDF',{exact:true});
 await expect(page.getByRole('link',{name:'Review current resume PDF'})).toHaveAttribute('href','../'+source);
 await upload.setInputFiles(file(Buffer.from('<html>wrong</html>')));await expect(page.locator('#status')).toContainText('not a complete PDF');await expect(page.locator('dialog[open]')).toHaveCount(0);
 await upload.setInputFiles(file(Buffer.alloc(5_000_001),'Big.pdf'));await expect(page.locator('#status')).toContainText('5 MB');
 await upload.setInputFiles(file());await expect(page.getByRole('dialog')).toContainText('New-Resume.pdf · 1 page');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('link',{name:'Review current resume PDF'})).toHaveAttribute('href','../'+source);
 await upload.setInputFiles([]);await expect(page.locator('dialog[open]')).toHaveCount(0);
 await upload.setInputFiles(file());await page.getByRole('dialog').press('Escape');await expect(page.locator('dialog[open]')).toHaveCount(0);
 await upload.setInputFiles(file());await expect(page.getByRole('link',{name:'Open PDF preview'})).toHaveAttribute('href',/^blob:/);await page.getByRole('button',{name:'Use this PDF in draft'}).click();await expect(page.locator('#status')).toContainText('Resume PDF added to the draft');
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved in this browser');
 const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('eli-portfolio-draft-v1')).portfolio.site.resume);expect(first).toMatch(/^assets\/documents\/resume-[a-f0-9]{20}\.pdf$/);
 await page.reload();await resume(page).click();await expect(page.getByRole('link',{name:'Review current resume PDF'})).toHaveAttribute('href',/^blob:/);await expect(page.getByLabel('Downloaded PDF filename',{exact:true})).toHaveValue('New-Resume.pdf');
 if(editorPath==='/editor/')await page.getByRole('button',{name:'Preview website',exact:true}).click();const preview=page.frameLocator('#preview');await expect(preview.getByRole('link',{name:'Download resume, one-page PDF'})).toHaveAttribute('href',/^blob:/);if(editorPath==='/editor/')await page.getByRole('button',{name:'Back to forms',exact:true}).click();
 const other=await PDFDocument.load(original);other.setTitle('Local replacement test only');const second=Buffer.from(await other.save());
 await upload.setInputFiles(file(second,'Replacement.pdf'));await page.getByRole('button',{name:'Use this PDF in draft'}).click();await expect(page.getByLabel('Downloaded PDF filename',{exact:true})).toHaveValue('Replacement.pdf');
 await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByLabel('Downloaded PDF filename',{exact:true})).toHaveValue('New-Resume.pdf');await page.getByRole('button',{name:'Redo',exact:true}).click();
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved in this browser');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download backup',exact:true}).click();await (await download).saveAs('.local/resume-draft-test.zip');
 const result=await page.evaluate(async()=>{const d=JSON.parse(localStorage.getItem('eli-portfolio-draft-v1')).portfolio;const {getImages}=await import('/editor/drafts.mjs');const assets=await getImages();return {resume:d.site.resume,size:assets.get(d.site.resume).size};});expect(result.resume).not.toBe(first);expect(result.size).toBe(second.length);
 await page.getByLabel('Restore backup',{exact:true}).setInputFiles('.local/resume-draft-test.zip');await page.getByRole('dialog').getByRole('button',{name:'Restore backup',exact:true}).click();await expect(page.locator('#status')).toContainText('Backup restored');expect(writes).toEqual([]);expect(fs.readFileSync(source)).toEqual(original);
});
test('resume controls remain usable on a narrow viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(editorPath);await resume(page).click();await expect(page.getByLabel('Upload resume PDF',{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.getByLabel('Upload resume PDF',{exact:true}).setInputFiles(file());await expect(page.getByRole('dialog')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/resume-review-mobile.png'});await page.getByRole('button',{name:'Cancel',exact:true}).click();
});

});
