import {resumeForm} from './resume.mjs';
import {assetPaths,isResumeUpload,verifyResume} from '../lib/pdf.mjs';
import {schema,validate} from '../lib/schema.mjs';
import {createRemote,publishingReady} from './remote.mjs';
import {signIn} from './auth-client.mjs';
import {render} from '../lib/render.mjs';
import {element,mountForm,showErrors,describeError} from './form.mjs';
import {draftKey,getImages,putImage,optimizeImage,makeZip,readZip} from './drafts.mjs';
const $=s=>document.querySelector(s),clone=structuredClone;
let data,baseline,active='work',saved='',history=[],future=[],prior='',changeTimer,previewTimer,revision=0,draftRevision=0,urls=new Map(),images=new Map(),busy=false;
let publishing,remote,remoteState,remoteAdopted=false,reviewed,lastMerge;
const setupTitle=$('#publish-dialog h2').textContent,setupMessage=$('#publish-message').innerHTML;
function showSetup(){const enabled=publishingReady(publishing,location.origin);$('#publish-dialog h2').textContent=enabled?'Sign in to publish':setupTitle;if(enabled)$('#publish-message').replaceChildren(element('p',{text:'Sign in with GitHub, load or save the current public draft, then review it before publishing. Your local draft remains available.'}));else $('#publish-message').innerHTML=setupMessage;$('#confirm-publish').hidden=true;$('#publish-dialog').showModal();}
const status=(message,error=false)=>{$('#status').textContent=message;$('#status').classList.toggle('error',error);};
function valid(){
 const errors=validate(data);const root=$('#fields');showErrors(root,errors);root.querySelector('.validation')?.remove();
 if(errors.length){const list=element('ul');for(const error of errors.slice(0,8))list.append(element('li',{text:describeError(error,data)}));root.prepend(element('div',{class:'validation',role:'alert'},element('strong',{text:'Check these fields before saving:'}),list));}
 return errors;
}
function changed(){
 clearTimeout(changeTimer);changeTimer=setTimeout(()=>{history.push(prior);if(history.length>40)history.shift();future=[];prior=JSON.stringify(data);updateButtons();},350);
 revision++;status(remote?.isConnected()?'Unsaved changes. Save Draft to keep them locally and on the public GitHub draft.':'Unsaved changes. Save Draft to keep them in this browser.');clearTimeout(previewTimer);previewTimer=setTimeout(updatePreview,700);
}
function settleHistory(){if(changeTimer){clearTimeout(changeTimer);changeTimer=null;if(prior!==JSON.stringify(data)){history.push(prior);future=[];prior=JSON.stringify(data);}}updateButtons();}
function updateButtons(){$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;}
function form(){
 const root=$('#fields');root.replaceChildren();const heading=element('h2',{text:active==='site'?'Site & contact':active==='media'?'Media library':active[0].toUpperCase()+active.slice(1)});root.append(heading);
 if(active==='resume'){
  resumeForm(root,{site:data.site,url:src=>urls.get(src)||'../'+src,onChange:changed,status,setBusy:value=>{busy=value;},onAccept:async candidate=>{
   await putImage(candidate.src,candidate.blob);images.set(candidate.src,candidate.blob);if(urls.has(candidate.src))URL.revokeObjectURL(urls.get(candidate.src));urls.set(candidate.src,URL.createObjectURL(candidate.blob));
   settleHistory();data.site.resume=candidate.src;data.site.resumeFilename=candidate.filename;data.site.resumeLabel='Download resume, '+(candidate.pages===1?'one-page PDF':candidate.pages+'-page PDF');changed();form();updatePreview();status('Resume PDF added to the draft. Save Draft to keep it; Publish updates the live download.');
  }});return;
 }
 if(active==='media'){
  root.append(element('p',{class:'help',text:'Upload a JPEG, PNG or WebP (up to 12 MB / 40 megapixels). It is resized to 2400 px and converted to WebP with metadata removed. Add alt text and credits when placing it in an entry.'}));
  const upload=element('input',{type:'file',accept:'.jpg,.jpeg,.png,.webp','aria-label':'Upload image'});
  upload.addEventListener('change',async()=>{if(!upload.files[0])return;busy=true;try{
   const {record,blob}=await optimizeImage(upload.files[0]);await putImage(record.src,blob);images.set(record.src,blob);urls.set(record.src,URL.createObjectURL(blob));
   if(!data.media.some(m=>m.id===record.id))data.media.push(record);changed();form();status(`Image optimized: ${record.width} × ${record.height}, ${Math.round(blob.size/1024)} KB. Save your draft to retain its reference.`);
  }catch(e){status(e.message,true);}finally{busy=false;}});root.append(upload);
  const grid=element('div',{class:'media-grid'});data.media.forEach(m=>grid.append(element('div',{class:'media-card'},element('img',{src:urls.get(m.src)||'../'+m.src,alt:m.id,loading:'lazy'}),element('span',{text:m.id}))));root.append(grid);
  const edit=element('details',{class:'item'},element('summary',{text:'Media records'}));const body=element('div',{class:'item-body'});edit.append(body);edit.addEventListener('toggle',()=>{if(edit.open&&!body.children.length)mountForm(body,{data:data.media,def:schema.$defs.portfolio.properties.media,path:'portfolio.media',referenceData:data,onChange:changed});});root.append(edit);return;
 }
 const section=data.sections.find(s=>s.id===active);const value=section||data[active];const def=section?schema.$defs.section:schema.$defs.portfolio.properties[active];const path=section?`portfolio.sections[${data.sections.indexOf(section)}]`:`portfolio.${active}`;
 root.append(element('p',{class:'help',text:section?'Expand an entry to edit. Move up/down to reorder. Undo restores removed items. Stable IDs preserve existing links.':'Edit content fields below. The portfolio’s typography, colors and layout remain controlled by templates.'}));
 const body=element('div');root.append(body);mountForm(body,{data:value,def,path,referenceData:data,onChange:changed,omit:['portfolio.site.resume','portfolio.site.resumeFilename','portfolio.site.resumeLabel']});
}
function updatePreview(){
 clearTimeout(previewTimer);const errors=valid();
 if(errors.length){status(`${errors.length} validation issue${errors.length===1?'':'s'}: ${describeError(errors[0],data)}`,true);$('#preview-status').textContent='Showing the last valid preview. Fix validation errors to update it.';return;}
 const iframe=$('#preview');let route='#work',open=[],scroll=0;
 try{route=iframe.contentWindow.location.hash||route;open=[...iframe.contentDocument.querySelectorAll('[data-expand][aria-expanded=true]')].map(x=>x.dataset.expand);scroll=iframe.contentWindow.scrollY;}catch{}
 iframe.onload=()=>{const focused=document.activeElement;try{const doc=iframe.contentDocument,win=iframe.contentWindow;const section=route.slice(1).split('/')[0];if(section!=='work')doc.querySelector(`nav [data-section="${section}"]`)?.click();open.forEach(id=>{const btn=[...doc.querySelectorAll('[data-expand]')].find(b=>b.dataset.expand===id);if(btn?.getAttribute('aria-expanded')==='false')btn.click();});win.requestAnimationFrame(()=>win.scrollTo(0,scroll));}catch{}finally{if(focused&&focused!==iframe&&focused!==document.body)focused.focus({preventScroll:true});}};
 iframe.srcdoc=render(data,{base:new URL('../',location.href).href,mediaURL:src=>urls.get(src)||src});$('#preview-status').textContent='Preview is up to date. Navigate and expand entries inside it.';
}
async function save(){
 const button=$('#save');button.disabled=true;button.textContent='Saving…';
 try{if(navigator.locks)return await navigator.locks.request('portfolio-draft',saveLocked);return await saveLocked();}
 finally{button.disabled=false;button.textContent='Save Draft';}
}
async function saveLocked(){
 if(busy){status('Wait for the file operation to finish.',true);return;}
 const errors=valid();if(isResumeUpload(data.site.resume)&&data.site.resume!==baseline.site.resume&&!images.has(data.site.resume)){status('Resume PDF is missing from browser storage. Upload it again or load the GitHub draft.',true);return;}if(errors.length){status(`Draft not saved: ${describeError(errors[0],data)}`,true);return;}
 try{const current=localStorage.getItem(draftKey);if(current&&JSON.parse(current).draftRevision!==draftRevision){status('A newer draft was saved in another tab. Export your changes before reloading.',true);return;}
  const json=JSON.stringify({portfolio:data,draftRevision:Date.now(),savedAt:new Date().toISOString()});localStorage.setItem(draftKey,json);draftRevision=JSON.parse(json).draftRevision;saved=JSON.stringify(data);status('Draft saved in this browser. Nothing has been published.');
  if(remote?.isConnected()){try{if(!remoteAdopted)throw Error('Load the GitHub draft before saving remotely.');const result=await remote.saveDraft(data,images);showDraft(result);status('Draft saved to a public GitHub branch. The live site has not changed.');}catch(e){status('Saved locally. '+e.message,true);}}
 }catch{status('Browser storage is unavailable or full. Export your draft to keep a copy.',true);}
}
async function download(){
 if(busy){status('Wait for the file operation to finish.',true);return;}
 const errors=valid();if(errors.length){status('Export blocked: '+errors[0].message,true);return;}
 if(data.site.resume!==baseline.site.resume&&!images.has(data.site.resume)){status('Export blocked: resume PDF is missing. Upload it again or load the GitHub draft.',true);return;}
 const files=new Map([['content/portfolio.json',new Blob([JSON.stringify({portfolio:data},null,2)+'\n'],{type:'application/json'})]]);
 for(const src of assetPaths(data))if(images.has(src))files.set(src,images.get(src));
 const zip=await makeZip(files),url=URL.createObjectURL(zip),a=element('a',{href:url,download:'portfolio-draft.zip'});a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status('Exported content and uploaded files. Existing site assets remain referenced. Nothing has been published.');
}
$('#save').onclick=save;$('#export').onclick=()=>download().catch(e=>status(e.message,true));$('#publish').onclick=reviewPublish;$('#refresh').onclick=updatePreview;
$('#viewport').onchange=e=>$('#preview').classList.toggle('mobile',e.target.value==='mobile');
$('#undo').onclick=()=>{settleHistory();if(!history.length)return;future.push(JSON.stringify(data));data=JSON.parse(history.pop());prior=JSON.stringify(data);revision++;updateButtons();form();updatePreview();status('Undid the last change. Save Draft to retain this version.');};
$('#redo').onclick=()=>{if(!future.length)return;history.push(JSON.stringify(data));data=JSON.parse(future.pop());prior=JSON.stringify(data);revision++;updateButtons();form();updatePreview();status('Restored the next change.');};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{
 if(file.size>100_000_000)throw Error('Draft package is too large.');let next,files;
 if(file.name.endsWith('.zip')){files=await readZip(file);next=JSON.parse(await files.get('content/portfolio.json').text()).portfolio;}
 else{if(file.size>2_000_000)throw Error('Content JSON must be smaller than 2 MB.');next=JSON.parse(await file.text()).portfolio;}
 const errors=validate(next);if(errors.length)throw Error(errors[0].path+': '+errors[0].message);
 for(const m of next.media){if(!baseline.media.some(x=>x.src===m.src)&&!images.has(m.src)&&!files?.has(m.src))throw Error('Missing uploaded image '+m.src+'. Import the complete exported ZIP.');}
 if(next.site.resume!==baseline.site.resume&&!images.has(next.site.resume)&&!files?.has(next.site.resume))throw Error('Missing resume PDF. Import the complete exported ZIP.');
 if(files)for(const [p,blob] of files)if(p!=='content/portfolio.json'){
  if(isResumeUpload(p)){if(p!==next.site.resume)throw Error('Unreferenced resume PDF in draft package.');await verifyResume(p,blob);await putImage(p,blob);images.set(p,blob);urls.set(p,URL.createObjectURL(blob));continue;}
  if(blob.size>2_000_000)throw Error('Uploaded images must be smaller than 2 MB.');
  const bytes=new Uint8Array(await blob.arrayBuffer());const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);if(p!=='assets/images/upload-'+hash+'.webp'||String.fromCharCode(...bytes.slice(0,4))!=='RIFF'||String.fromCharCode(...bytes.slice(8,12))!=='WEBP')throw Error('Uploaded image does not match its stable filename or WebP format.');
  const bitmap=await createImageBitmap(blob);const record=next.media.find(m=>m.src===p);const ok=record&&bitmap.width===record.width&&bitmap.height===record.height&&bitmap.width<=2400&&bitmap.height<=2400;bitmap.close();if(!ok)throw Error('Image dimensions do not match the draft.');
  await putImage(p,blob);images.set(p,blob);urls.set(p,URL.createObjectURL(blob));
 }
 settleHistory();history.push(JSON.stringify(data));data=next;prior=JSON.stringify(data);future=[];revision++;form();updateButtons();updatePreview();status('Imported draft. Save Draft to keep it in this browser.');
 }catch(err){status('Import failed: '+err.message,true);}finally{e.target.value='';}};
window.addEventListener('beforeunload',event=>{if(data&&JSON.stringify(data)!==saved){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{if(event.key===draftKey)status('Another tab saved a draft. Export your changes before reloading.',true);});
try{
 publishing=await (await fetch('publishing.json')).json();$('#signin').textContent=publishingReady(publishing,location.origin)?'Sign in with GitHub':'GitHub setup';
 if(publishingReady(publishing,location.origin))$('#publish-note').textContent='Sign in with GitHub to save public drafts and publish validated changes. Until then, drafts save only in this browser.';
 const response=await fetch('../content/portfolio.json');if(!response.ok)throw Error('Could not load portfolio content.');baseline=(await response.json()).portfolio;data=clone(baseline);
 let draft;try{draft=localStorage.getItem(draftKey);}catch{status('Browser draft storage is unavailable. Use Export draft to keep your changes.',true);}
 if(draft){const stored=JSON.parse(draft);if(!validate(stored.portfolio).length){data=stored.portfolio;draftRevision=stored.draftRevision;status('Restored the draft saved in this browser. Nothing has been published.');}else status('Saved draft is invalid. Loaded the published content.',true);}else status('Ready. Changes stay in this browser until you save or export.');
 try{images=await getImages();}catch{status('Uploaded-file storage is unavailable in this browser. Existing content can still be edited and exported.',true);}
 for(const [src,blob] of images)urls.set(src,URL.createObjectURL(blob));saved=JSON.stringify(data);prior=saved;
 for(const key of ['work','projects','skills','passions','resume','site','education','media','resources']){
  const button=element('button',{text:key==='site'?'Site & contact':key[0].toUpperCase()+key.slice(1),'aria-current':key===active?'page':undefined,onclick:()=>{settleHistory();active=key;$('#editor-nav').querySelectorAll('button').forEach(b=>b.removeAttribute('aria-current'));button.setAttribute('aria-current','page');form();}});$('#editor-nav').append(button);
 }
 form();updatePreview();
}catch(error){status('Editor could not load: '+error.message,true);}

function showDraft(draft){const link=$('#draft-link');link.hidden=!draft;if(draft)link.href='https://github.com/'+publishing.repository+'/pull/'+draft.pr.number;}
function signedOut(){remoteAdopted=false;reviewed=null;$('#publish-dialog').close();$('#confirm-publish').hidden=true;$('#signin').hidden=false;$('#remote-tools').hidden=true;$('#mode-label').textContent='Local draft mode';$('#publish-note').textContent='Drafts save in this browser. GitHub credentials are not stored here. Repository drafts are public.';}
$('#signin').onclick=async()=>{
 if(!publishingReady(publishing,location.origin)){showSetup();return;}
 $('#signin').disabled=true;status('Complete GitHub sign-in in the popup. Your local draft stays here.');
 try{const credentials=await signIn(publishing.authOrigin);const {DecapAPI}=await import('./vendor/decap-api.mjs');remote?.end();remote=createRemote(publishing,{apiFactory:options=>new DecapAPI(options),onExpire:()=>{signedOut();status('GitHub sign-in expired. Your local draft is safe. Sign in again to continue.',true);}});remoteState=await remote.connect(credentials);
  $('#signin').hidden=true;$('#remote-tools').hidden=false;$('#mode-label').textContent='GitHub connected';$('#publish-note').textContent='Save Draft writes a public draft branch. Publish requires a reviewed draft and successful validation. Tokens stay in memory until sign-out or expiry.';showDraft(remoteState.draft);
  if(!remoteState.draft&&JSON.stringify(remoteState.published)===JSON.stringify(baseline)){remote.adopt(remoteState);remoteAdopted=true;status('Connected. Local edits can now be saved to a public GitHub draft.');}
  else{remoteAdopted=false;status('Connected. Export any local edits you want to keep, then Load GitHub draft to use the latest remote content.');}
 }catch(e){status(e.message,true);signedOut();}finally{$('#signin').disabled=false;}
};
$('#load-remote').onclick=async()=>{
 if(JSON.stringify(data)!==saved){status('Save or export your local edits before loading remote content.',true);return;}
 busy=true;try{remoteState=await remote.snapshot();const next=remoteState.draft?.data||remoteState.published;const assets=await remote.media(next,remoteState.draft?.head||remoteState.publishedHead);for(const [src,blob]of assets){await putImage(src,blob);images.set(src,blob);urls.set(src,URL.createObjectURL(blob));}
  settleHistory();history.push(JSON.stringify(data));data=structuredClone(remote.adopt(remoteState));baseline=structuredClone(remoteState.published);remoteAdopted=true;prior=JSON.stringify(data);future=[];form();updateButtons();updatePreview();showDraft(remoteState.draft);status('Loaded GitHub content. Review it, then Save Draft to keep further changes.');
 }catch(e){status(e.message,true);}finally{busy=false;}
};
$('#logout').onclick=()=>{remote?.end();signedOut();status('Signed out. Your local draft remains available.');};
async function reviewPublish(){
 if(!remote?.isConnected()){showSetup();return;}
 $('#publish').disabled=true;try{reviewed=await remote.review(data);$('#publish-dialog h2').textContent='Publish this reviewed draft?';$('#publish-message').replaceChildren(element('p',{text:'Validation passed for draft '+reviewed.head.slice(0,12)+'. Publishing merges this public draft into main. Deployment runs separately.'}),element('a',{href:reviewed.url,target:'_blank',rel:'noopener',text:'Review the GitHub pull request'}));$('#confirm-publish').hidden=false;$('#publish-dialog').showModal();}catch(e){status(e.message,true);}finally{$('#publish').disabled=false;}
}
$('#confirm-publish').onclick=async()=>{const button=$('#confirm-publish');button.disabled=true;try{lastMerge=await remote.publish(data,reviewed);$('#publish-dialog').close();$('#deployment').hidden=false;status('GitHub confirmed the merge. Live deployment has not yet been confirmed.');await refreshDeployment();}catch(e){status(e.message,true);}finally{button.disabled=false;}};
async function refreshDeployment(){try{const result=await remote.deployment(lastMerge.sha);if(result.state==='success')status('GitHub Pages reports a successful deployment of '+lastMerge.sha.slice(0,12)+'.');else if(['failure','error'].includes(result.state))status('The draft was merged, but GitHub Pages deployment failed. Review the deployment in GitHub.',true);else status('Draft merged; GitHub Pages deployment is '+result.state+'. Refresh status shortly.');}catch(e){status('Draft merged; deployment status could not be checked. '+e.message,true);}}
$('#deployment').onclick=refreshDeployment;
