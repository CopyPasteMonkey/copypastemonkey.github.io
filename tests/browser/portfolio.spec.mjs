import {test,expect} from '@playwright/test';
import fs from 'node:fs';
test('desktop routing, keyboard, repeated navigation and direct links',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Expand Nimbus Power Systems — Current Work',exact:false}).focus();await page.keyboard.press('Enter');await expect(page.locator('#details-nimbus-current')).toBeVisible();
 await page.getByRole('button',{name:'Collapse Current Work details',exact:true}).click();await expect(page.locator('[data-expand="nimbus-current"]')).toBeFocused();
 for(const section of ['projects','skills','passions','contact','work','work']){await page.locator(`nav [data-section=${section}]`).click();await expect(page.locator(`#view-${section}`)).toBeVisible();}
 await page.goto('/#work/nimbus-internship');await expect(page.locator('#details-nimbus-internship')).toBeVisible();await expect(page.locator('#details-nimbus-current')).toBeHidden();
 await page.locator('nav [data-section=projects]').click();await page.goBack();await expect(page.locator('#view-work')).toBeVisible();
 await page.goto('/#invalid/nope');await expect(page.locator('#view-work')).toBeVisible();expect(errors).toEqual([]);
});
test('all eighteen disclosures open, collapse and return focus',async({page})=>{
 await page.goto('/');const sections=['work','projects','skills','passions'];
 for(const s of sections){await page.locator(`nav [data-section=${s}]`).click();const buttons=page.locator(`#view-${s} [data-expand]`);for(let i=0;i<await buttons.count();i++){const b=buttons.nth(i),id=await b.getAttribute('data-expand');await b.click();await expect(page.locator('#details-'+id)).toBeVisible();await page.locator(`[data-collapse="${id}"]`).click();await expect(b).toBeFocused();await expect(page.locator('#details-'+id)).toBeHidden();}}
});
test('mobile navigation, resume access and no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 for(const s of ['work','projects','skills','passions','contact']){await page.locator('#section-select').selectOption(s);await expect(page.locator('#view-'+s)).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('link',{name:'Download resume, one-page PDF'})).toBeVisible();}
 await page.goto('/#work/nimbus-internship');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'.local/portfolio-mobile.png',fullPage:false});
});
test('editor save/reload, undo, validation, import/export and faithful interactive preview',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/editor/');await expect(page.locator('#status')).toContainText('Ready');
 await page.getByRole('button',{name:'Site & contact',exact:true}).click();const name=page.getByRole('textbox',{name:'Name',exact:true});await name.fill('Eli Draft Test');await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved');await page.reload();await expect(page.locator('#status')).toContainText('Restored');
 await page.getByRole('button',{name:'Site & contact',exact:true}).click();await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Eli Draft Test');
 await page.getByRole('textbox',{name:'Name',exact:true}).fill('Second name');await page.waitForTimeout(450);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Eli Draft Test');
 await page.getByRole('textbox',{name:'Name',exact:true}).fill('');await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('not saved');await page.getByRole('textbox',{name:'Name',exact:true}).fill('Eli Draft Test');await page.getByRole('button',{name:'Refresh',exact:true}).click();
 const frame=page.frameLocator('#preview');await expect(frame.locator('.name')).toHaveText('Eli Draft Test');await frame.locator('nav [data-section=projects]').click();await expect(frame.locator('#view-projects')).toBeVisible();
 const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export draft',exact:true}).click();const file=await downloaded;await file.saveAs('.local/draft.zip');expect(fs.statSync('.local/draft.zip').size).toBeGreaterThan(1000);
 await page.locator('#import').setInputFiles('.local/draft.zip');await expect(page.locator('#status')).toContainText('Imported draft');await page.getByRole('button',{name:'Publish…',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('No GitHub login or publication');await page.getByRole('button',{name:'Back to editing'}).click();
 await page.screenshot({path:'.local/editor-desktop.png',fullPage:false});expect(errors).toEqual([]);
});
test('entry removal undo, reorder and stable ID',async({page})=>{
 await page.goto('/editor/');const summaries=page.locator('#fields > div > div > .list > details > summary');await expect(page.locator('#fields summary').first()).toHaveText('Nimbus Power Systems');
 await page.locator('#fields summary').first().click();await page.getByRole('button',{name:'Move Nimbus Power Systems down',exact:true}).click();await expect(page.locator('#fields summary').first()).toHaveText('Accelerate Design LLC');
 await page.getByRole('button',{name:'Remove Nimbus Power Systems',exact:true}).click();await expect(page.locator('#fields summary').filter({hasText:'Nimbus Power Systems'})).toHaveCount(0);await page.waitForTimeout(400);await page.getByRole('button',{name:'Undo',exact:true}).click();await expect(page.locator('#fields summary').filter({hasText:'Nimbus Power Systems'})).toHaveCount(1);
});
test('image upload creates optimized stable media and draft package',async({page})=>{
 await page.goto('/editor/');await page.getByRole('button',{name:'Media',exact:true}).click();await page.getByLabel('Upload image').setInputFiles('assets/media/mott-permeability-chart.jpg');await expect(page.locator('#status')).toContainText('Image optimized');await expect(page.locator('.media-card').filter({hasText:'upload-'})).toHaveCount(1);
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export draft',exact:true}).click();await (await download).saveAs('.local/with-image.zip');await page.reload();await page.getByRole('button',{name:'Media',exact:true}).click();await expect(page.locator('.media-card').filter({hasText:'upload-'})).toHaveCount(1);
});
test('one editor keeps GitHub setup gated and redirects the retired demo',async({page})=>{
 await page.goto('/editor/cms.html');await expect(page).toHaveURL(/\/editor\/$/);await page.getByRole('button',{name:'GitHub setup',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('GitHub App installed only on elidoggart/elidoggart.github.io');
});

test('editor keyboard focus survives automatic preview updates and mobile editing fits',async({page})=>{
 await page.goto('/editor/');await page.getByRole('button',{name:'Site & contact',exact:true}).click();const name=page.getByRole('textbox',{name:'Name',exact:true});await name.fill('Typing here');await page.waitForTimeout(1000);await expect(name).toBeFocused();
 await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'.local/editor-mobile.png',fullPage:false});
});
test('two open editor tabs detect stale draft saves instead of overwriting',async({page,context})=>{
 await page.goto('/editor/');const other=await context.newPage();await other.goto('/editor/');await page.getByRole('button',{name:'Site & contact',exact:true}).click();await other.getByRole('button',{name:'Site & contact',exact:true}).click();await page.getByRole('textbox',{name:'Name',exact:true}).fill('First tab');await other.getByRole('textbox',{name:'Name',exact:true}).fill('Second tab');await page.getByRole('button',{name:'Save Draft',exact:true}).click();await other.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(other.locator('#status')).toContainText('newer draft');expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('eli-portfolio-draft-v1')).portfolio.site.name)).toBe('First tab');
});
test('invalid image and draft paths are refused without changing content',async({page})=>{
 await page.goto('/editor/');await page.getByRole('button',{name:'Media',exact:true}).click();await page.getByLabel('Upload image').setInputFiles({name:'fake.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"></svg>')});await expect(page.locator('#status')).toContainText('not a supported image');
 await page.locator('#import').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"portfolio":{"html":"<script>bad</script>"}}')});await expect(page.locator('#status')).toContainText('Import failed');
});

test('built site screenshots exactly match approved HTML with approved border CSS',async({page})=>{
 fs.copyFileSync('tests/fixtures/published.html','dist/approved-baseline.html');
 try{for(const width of [1440,390]){await page.setViewportSize({width,height:width===390?844:1000});for(const hash of ['work','work/nimbus-internship','projects/mqp','passions/film','contact']){
  await page.goto('/approved-baseline.html#'+hash);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.top<innerHeight&&r.bottom>0;}).map(i=>i.decode().catch(()=>{})));});await page.waitForTimeout(80);
  const baselinePosition=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  const baseline=await page.screenshot({path:'.local/parity-baseline.png'});
  await page.goto('/#'+hash);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.top<innerHeight&&r.bottom>0;}).map(i=>i.decode().catch(()=>{})));});await page.waitForTimeout(80);
  const generatedPosition=await page.evaluate(()=>({x:scrollX,y:scrollY}));
  // Initial font loading can round the existing hash scroll by one pixel.
  // Check navigation separately, then compare the exact same viewport pixels.
  expect(generatedPosition.x).toBe(baselinePosition.x);
  expect(Math.abs(generatedPosition.y-baselinePosition.y),`${width}px ${hash} scroll parity`).toBeLessThanOrEqual(1);
  await page.evaluate(async position=>{scrollTo({left:position.x,top:position.y,behavior:'instant'});await new Promise(requestAnimationFrame);},baselinePosition);
  const generated=await page.screenshot({path:'.local/parity-generated.png'});expect(generated.equals(baseline),`${width}px ${hash} visual parity`).toBe(true);
  if(hash==='work')await page.screenshot({path:'.local/portfolio-'+(width===390?'mobile':'desktop')+'.png'});
 }}}finally{fs.unlinkSync('dist/approved-baseline.html');}
});
