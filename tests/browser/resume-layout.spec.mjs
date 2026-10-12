import {test,expect} from '@playwright/test';

test('phone section selector retains edits, updates preview, and follows validation errors',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/editor/');
 const select=page.getByRole('combobox',{name:'Edit section',exact:true});
 await expect(select).toBeVisible();await select.selectOption('site');
 const name=page.getByRole('textbox',{name:'Name',exact:true});await name.fill('Phone review');
 await select.selectOption('education');await expect(page.getByRole('heading',{name:'Education',exact:true})).toBeVisible();
 await select.selectOption('site');await expect(name).toHaveValue('Phone review');
 await page.getByRole('button',{name:'Preview website',exact:true}).click();await expect(page.frameLocator('#preview').locator('.name')).toHaveText('Phone review');
 await page.getByRole('button',{name:'Back to forms',exact:true}).click();await name.fill('');await select.selectOption('education');
 await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(select).toHaveValue('site');await expect(name).toBeFocused();
 await name.fill('Phone review');await page.getByRole('button',{name:'Save Draft',exact:true}).click();await expect(page.locator('#status')).toContainText('Draft saved');await page.reload();
 await select.selectOption('site');await expect(name).toHaveValue('Phone review');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('resume layout and editor controls remain usable at narrow phone and laptop sizes',async({page})=>{
 for(const width of [320,390,640,768,1024,1440]){
  await page.setViewportSize({width,height:800});await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`site at ${width}`).toBe(true);
  if([390,1440].includes(width)){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'.local/resume-site-'+width+'.png'});}
  for(const hash of ['work/nimbus-internship','projects/mqp','skills','passions/film','contact']){
   await page.goto('/#'+hash);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${hash} at ${width}`).toBe(true);
  }
  await page.goto('/editor/');await expect(page.locator('#fields > h2')).toHaveText('Work');if([390,1440].includes(width))await page.screenshot({path:'.local/resume-editor-'+width+'.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`editor at ${width}`).toBe(true);
  await page.getByRole('button',{name:'Download backup',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Download backup',exact:true})).toBeInViewport();
 }
});
