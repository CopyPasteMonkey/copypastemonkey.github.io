import {test,expect} from '@playwright/test';
import fs from 'node:fs';

async function setup(context,{wrongUser=false}={}){
 const site='https://www.elidoggart.com',auth='https://portfolio-editor-auth.elidoggart.workers.dev';
 const requests=[];
 await context.route(site+'/**',route=>{
  const pathname=new URL(route.request().url()).pathname;
  const sources={'/editor/auth-check.html':['docs/examples/auth-check.html','text/html'],'/editor/auth-check.mjs':['docs/examples/auth-check.mjs','text/javascript'],'/editor/auth-client.mjs':['editor/auth-client.mjs','text/javascript']};
  if(pathname==='/style.css')return route.fulfill({contentType:'text/css',body:''});
  const source=sources[pathname];
  return source?route.fulfill({contentType:source[1],body:fs.readFileSync(source[0])}):route.abort();
 });
 await context.route(auth+'/auth',route=>route.fulfill({contentType:'text/html',body:`<script>const parent=window.opener;addEventListener('message',e=>{if(e.source===parent&&e.origin===${JSON.stringify(site)}&&e.data.type==='portfolio:ack'){parent.postMessage({type:'portfolio:authorized',provider:'github',token:'inert-auth-check-token',expiresAt:Date.now()+3600000},e.origin);window.close();}});parent.postMessage({type:'portfolio:ready'},${JSON.stringify(site)});</script>`}));
 await context.route('https://api.github.com/**',route=>{
  const request=route.request(),pathname=new URL(request.url()).pathname;
  requests.push({method:request.method(),path:pathname});
  expect(request.method()).toBe('GET');
  if(pathname==='/user')return route.fulfill({json:{id:wrongUser?999:183743177}});
  if(pathname==='/repositories/1412250381')return route.fulfill({json:{id:1412250381,full_name:'elidoggart/elidoggart.github.io',private:false,permissions:{push:true}}});
  throw Error('Unexpected diagnostic request');
 });
 return {url:site+'/editor/auth-check.html',requests};
}

test('temporary production-origin check completes the real popup handshake with read-only mocked API access',async({page,context})=>{
 const {url,requests}=await setup(context);
 await page.goto(url);
 await page.getByRole('button',{name:'Run sign-in check',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Sign-in completed.');
 await expect(page.getByRole('status')).toContainText('temporary session has been discarded');
 expect(requests).toEqual([{method:'GET',path:'/user'},{method:'GET',path:'/repositories/1412250381'}]);
 expect(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie}))).toEqual({local:0,session:0,cookies:''});
 await expect(page.locator('body')).not.toContainText('inert-auth-check-token');
 await expect(page.getByRole('button',{name:'Run sign-in check',exact:true})).toBeEnabled();
});

test('temporary sign-in check rejects the wrong identity before reading the repository',async({page,context})=>{
 const {url,requests}=await setup(context,{wrongUser:true});
 await page.goto(url);
 await page.getByRole('button',{name:'Run sign-in check',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('The check did not complete.');
 expect(requests).toEqual([{method:'GET',path:'/user'}]);
 await expect(page.locator('body')).not.toContainText('inert-auth-check-token');
});
