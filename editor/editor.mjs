import {loadLocalDraft,missingDraftAssets} from './storage.mjs';
import {createRecovery,readableDraft,storageMessage} from './recovery.mjs';
import {createPublishProgress} from './publish-progress.mjs';
import {createForms} from './forms-first.mjs';
import {createCanvas,selectionForm,at} from './canvas.mjs';
import {resumeForm} from './resume.mjs';
import {assetPaths,matchesImageUpload,isResumeUpload,verifyResume} from '../lib/pdf.mjs';
import {schema,validate,validateLocalDraft} from '../lib/schema.mjs';
import {createRemote,publishingReady} from './remote.mjs';
import {signIn} from './auth-client.mjs';
import {render} from '../lib/render.mjs';
import {element,mountForm,showErrors,describeError,confirmChange} from './form.mjs';
import {itemName} from './friendly.mjs';
import {editorData,validateDraft,readTemplateIDs,templateMetadata,unfinishedEntries} from './templates.mjs';
import {draftKey,getImages,putImage,optimizeImage,makeZip,readZip} from './drafts.mjs';
const $=s=>document.querySelector(s),clone=structuredClone;
const publishedCacheKey='eli-portfolio-published-cache';
let data,baseline,active='work',saved='',history=[],future=[],prior='',changeTimer,previewTimer,revision=0,draftRevision=0,urls=new Map(),images=new Map(),busy=0;
let publishing,remote,remoteState,remoteAdopted=false,reviewed,lastMerge,preparingPublication=false;
let previewRendering=false,previewViewState;
let recovery,recoveryReady=false,recoveryRaw='',saving=false,operation='',operationControls=[];
const visual=document.body.classList.contains('visual-editor'),functional=document.body.classList.contains('forms-editor'),friendly=visual||functional;let canvas,forms,fieldSelection=null,templateIDs=new Set();
const publication=createPublishProgress({anchor:$('.notice'),checkDeployment:sha=>createRemote(publishing,{apiFactory:()=>{}}).deployment(sha)});
const setupTitle=$('#publish-dialog h2').textContent,setupMessage=$('#publish-message').innerHTML;
async function loadJSON(path,timeout){const controller=new AbortController();let timer;try{return await Promise.race([(async()=>{const response=await fetch(path,{signal:controller.signal});if(!response.ok)throw Error('The website could not return the requested content.');return response.json();})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('The connection timed out.'));},timeout);})]);}finally{clearTimeout(timer);}}
function showSetup(){const enabled=publishingReady(publishing,location.origin);$('#publish-dialog h2').textContent=enabled?'Sign in to publish':setupTitle;if(enabled)$('#publish-message').replaceChildren(element('p',{text:'Sign in with GitHub, load or save the current public draft, then review it before publishing. Your local draft remains available.'}));else $('#publish-message').innerHTML=setupMessage;$('#confirm-publish').hidden=true;$('#publish-dialog').showModal();}
const status=(message,error=false)=>{$('#status').textContent=message;$('#status').classList.toggle('error',error);updateSaveState();checkpoint();};
function checkpoint(){
 if(!recoveryReady||!recovery)return;
 try{const raw=JSON.stringify(data);if(raw===saved){recovery.clear();recoveryRaw='';return;}if(raw===recoveryRaw)return;
  recovery.write({portfolio:data,editor:templateMetadata(data,templateIDs),savedAt:new Date().toISOString()});recoveryRaw=raw;
  $('#recovery-warning')?.remove();
 }catch{if(!$('#recovery-warning'))$('.notice').after(element('p',{id:'recovery-warning',class:'notice',role:'alert',text:'Automatic recovery could not be saved. Keep this tab open and use Download backup to protect your edits.'}));}
}
function lockEditing(label){
 if(operation)return false;operation=label;
 operationControls=[...document.querySelectorAll('#save,#publish,#load-remote,#signin,#logout,#undo,#redo,#import,#editor-section,#open-preview,#export')].map(node=>[node,node.disabled]);
 operationControls.forEach(([node])=>{node.disabled=true;});document.querySelectorAll('#fields,#editor-nav,#preview,#canvas-toolbar,.preview-tools,.recovery-copies').forEach(node=>{node.inert=true;});return true;
}
function unlockEditing(){operation='';operationControls.forEach(([node,disabled])=>{node.disabled=disabled;});operationControls=[];document.querySelectorAll('#fields,#editor-nav,#preview,#canvas-toolbar,.preview-tools,.recovery-copies').forEach(node=>{node.inert=false;});if(friendly&&!publishingReady(publishing,location.origin))$('#publish').disabled=true;updateButtons();}
async function prepareImage(file,{signal}={}){
 busy++;let stop;
 try{
  signal?.throwIfAborted();
  const task=(async()=>{const {record,blob}=await optimizeImage(file);signal?.throwIfAborted();await putImage(record.src,blob);signal?.throwIfAborted();images.set(record.src,blob);if(urls.has(record.src))URL.revokeObjectURL(urls.get(record.src));urls.set(record.src,URL.createObjectURL(blob));return record;})();
  return await (signal?Promise.race([task,new Promise((_,reject)=>{stop=()=>reject(new DOMException('Image upload cancelled','AbortError'));signal.addEventListener('abort',stop,{once:true});})]):task);
 }finally{if(stop)signal.removeEventListener('abort',stop);busy--;}
}
function updateSaveState(){if(!friendly||!data)return;const dirty=JSON.stringify(data)!==saved;$('#draft-state').textContent=dirty?'Unsaved changes':'Saved in this browser';$('#draft-state').classList.toggle('unsaved',dirty);const missing=unfinishedEntries(data,templateIDs);const note=$('#draft-completeness');note.hidden=!missing.length;note.textContent=missing.length+' unfinished '+(missing.length===1?'item':'items')+'. Fill in the name and summary before publishing. Save Draft keeps your unfinished work.';}
function valid(){
 const errors=friendly?validateDraft(data,templateIDs):validate(data);const root=$('#fields');showErrors(root,errors);root.querySelector('.validation')?.remove();
 if(errors.length){const list=element('ul');for(const error of errors.slice(0,8))list.append(element('li',{},functional?element('button',{type:'button',class:'error-link',text:describeError(error,data,true),onclick:()=>revealError(error)}):describeError(error,data,friendly)));root.prepend(element('div',{class:'validation',role:'alert'},element('strong',{text:'Check these fields before publishing. Save Draft keeps your unfinished edits:'}),list));}
 return errors;
}
function changed(options={}){
 clearTimeout(changeTimer);changeTimer=setTimeout(()=>{history.push(prior);if(history.length>40)history.shift();future=[];prior=JSON.stringify(data);updateButtons();},350);
 revision++;updateButtons();status(remote?.isConnected()?'Unsaved changes. Save Draft to keep them locally and on the public GitHub draft.':'Unsaved changes. Save Draft to keep them in this browser.');clearTimeout(previewTimer);if(options.repaint!==false)previewTimer=setTimeout(updatePreview,700);
}
function settleHistory(){if(changeTimer){clearTimeout(changeTimer);changeTimer=null;if(prior!==JSON.stringify(data)){history.push(prior);future=[];prior=JSON.stringify(data);}}updateButtons();}
function updateButtons(){$('#undo').disabled=!!operation||!history.length&&!(changeTimer&&prior!==JSON.stringify(data));$('#redo').disabled=!!operation||!future.length;updateSaveState();}
function form(){
 if(functional&&forms?.render(active))return;
 const root=$('#fields');root.replaceChildren();if(visual)root.append(element('button',{class:'close-fields',text:'Close details',onclick:()=>{root.hidden=true;$('#edit-details')?.focus();}}));
 if(visual&&fieldSelection&&at(data,fieldSelection.path)){const value=at(data,fieldSelection.path);root.append(element('h2',{text:'Edit '+(fieldSelection.kind==='site'?'site & contact':fieldSelection.kind==='education'?'education':itemName(value))}));if(selectionForm(root.appendChild(element('div')),fieldSelection,data,changed))return;}
 const heading=element('h2',{text:active==='site'?'Site & contact':active==='media'?'Image library':friendly&&active==='resources'?'Links & downloads':active[0].toUpperCase()+active.slice(1)});root.append(heading);
 if(active==='resume'){
  resumeForm(root,{friendly,site:data.site,url:src=>urls.get(src)||'../'+src,onChange:changed,status,setBusy:value=>{busy+=value?1:-1;},onAccept:async candidate=>{
   await putImage(candidate.src,candidate.blob);images.set(candidate.src,candidate.blob);if(urls.has(candidate.src))URL.revokeObjectURL(urls.get(candidate.src));urls.set(candidate.src,URL.createObjectURL(candidate.blob));
   settleHistory();data.site.resume=candidate.src;data.site.resumeFilename=candidate.filename;data.site.resumeLabel='Download resume, '+(candidate.pages===1?'one-page PDF':candidate.pages+'-page PDF');changed();form();updatePreview();status('Resume PDF added to the draft. Save Draft to keep it; Publish updates the live download.');
  }});return;
 }
 if(active==='media'){
  root.append(element('p',{class:'help',text:functional?'Images already on your website are shown below. To add or replace a photo, open the job, project, skill group or interest and use its Upload image button.':visual?'Images already on your website are shown below. Select a company, role or photo on the page, then choose Add image or Replace image to use one or upload from your device.':'Upload a JPEG, PNG or WebP (up to 12 MB / 40 megapixels). It is resized to 2400 px and optimized as WebP or PNG. Add alt text and credits when placing it in an entry.'}));
  const upload=element('input',{type:'file',accept:'.jpg,.jpeg,.png,.webp','aria-label':'Upload image'});
  upload.addEventListener('change',async()=>{if(!upload.files[0])return;busy++;try{
   const {record,blob}=await optimizeImage(upload.files[0]);await putImage(record.src,blob);images.set(record.src,blob);urls.set(record.src,URL.createObjectURL(blob));
   if(!data.media.some(m=>m.id===record.id))data.media.push(record);changed();form();status(`Image optimized: ${record.width} × ${record.height}, ${Math.round(blob.size/1024)} KB. Save your draft to retain its reference.`);
  }catch(e){status(e.message,true);}finally{busy--;}});if(!friendly)root.append(upload);
  const placements=new Map();const collect=value=>{if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object'){if(value.media&&value.alt&&!placements.has(value.media))placements.set(value.media,value.caption||value.alt);Object.values(value).forEach(collect);}};if(friendly)collect(data.sections);const grid=element('div',{class:'media-grid'});data.media.forEach(m=>{const name=friendly?(placements.get(m.id)||'Uploaded image'):m.id;grid.append(element('div',{class:'media-card'},element('img',{src:urls.get(m.src)||'../'+m.src,alt:name,loading:'lazy'}),element('span',{text:name})));});root.append(grid);if(friendly)return;
  const edit=element('details',{class:'item'},element('summary',{text:'Media records'}));const body=element('div',{class:'item-body'});edit.append(body);edit.addEventListener('toggle',()=>{if(edit.open&&!body.children.length)mountForm(body,{data:data.media,def:schema.$defs.portfolio.properties.media,path:'portfolio.media',referenceData:data,onChange:changed});});root.append(edit);return;
 }
 const section=data.sections.find(s=>s.id===active);const value=section||data[active];const def=section?(visual?{type:'object',properties:{subtitle:schema.$defs.section.properties.subtitle}}:schema.$defs.section):schema.$defs.portfolio.properties[active];const path=section?`portfolio.sections[${data.sections.indexOf(section)}]`:`portfolio.${active}`;
 root.append(element('p',{class:'help',text:friendly?(active==='resources'?'Edit the links used on your page, or add a new link. To place one, open a role or details section and choose Add content → Link.':'Edit the fields below. Your website’s fonts, colors and layout are taken care of.'):(section?'Expand an entry to edit. Move up/down to reorder. Undo restores removed items. Stable IDs preserve existing links.':'Edit content fields below. The portfolio’s typography, colors and layout remain controlled by templates.')}));
 const body=element('div');root.append(body);mountForm(body,{data:value,def,path,referenceData:data,onChange:changed,friendly,labels:friendly&&active==='resources'?{label:'Link text'}:{},omit:['portfolio.site.resume','portfolio.site.resumeFilename','portfolio.site.resumeLabel']});
}
function updatePreview(){
 clearTimeout(previewTimer);const errors=valid();
 if(errors.length){if(!$('#preview').srcdoc)$('#preview').srcdoc=render(baseline,{base:new URL('../',location.href).href});status(friendly?'Before publishing, please check: '+describeError(errors[0],data,true)+' Save Draft keeps your unfinished edits.':`${errors.length} validation issue${errors.length===1?'':'s'}: ${describeError(errors[0],data)}`,true);$('#preview-status').textContent='Showing the last valid preview. Fix validation errors to update it.';return;}
 const renderRevision=revision,iframe=$('#preview');let route=functional&&['work','projects','skills','passions'].includes(active)?'#'+active:'#work',open=[],scroll=0;
 // A second edit can arrive while srcdoc is still loading. Preserve the last
 // usable view instead of reading the temporary, collapsed replacement DOM.
 if(previewRendering&&previewViewState){if(!functional)route=previewViewState.route;open=previewViewState.open;scroll=previewViewState.scroll;}
 else try{if(!functional)route=iframe.contentWindow.location.hash||route;open=[...iframe.contentDocument.querySelectorAll('[data-expand][aria-expanded=true]')].map(x=>x.dataset.expand);scroll=iframe.contentWindow.scrollY;}catch{}
 previewViewState={route,open,scroll};previewRendering=true;
 iframe.onload=()=>{if(revision!==renderRevision){updatePreview();return;}const focused=document.activeElement;try{const doc=iframe.contentDocument,win=iframe.contentWindow;const section=route.slice(1).split('/')[0];if(section!=='work')doc.querySelector(`nav [data-section="${section}"]`)?.click();open.forEach(id=>{const btn=[...doc.querySelectorAll('[data-expand]')].find(b=>b.dataset.expand===id);if(btn?.getAttribute('aria-expanded')==='false')btn.click();});win.requestAnimationFrame(()=>win.scrollTo(0,scroll));if(canvas)canvas.bind();}catch(e){if(canvas)status('The editor could not display this change. Try Undo or reload your saved draft.',true);}finally{previewRendering=false;if(focused&&focused!==iframe&&focused!==document.body)focused.focus({preventScroll:true});}};
 iframe.srcdoc=render(friendly?editorData(data,templateIDs,{visitor:functional||canvas?.isPreview()}):data,{base:new URL('../',location.href).href,mediaURL:src=>urls.get(src)||src});$('#preview-status').textContent='Preview is up to date. Navigate and expand entries inside it.';
}
function revealError(error){
 if(visual){fieldSelection=null;$('#fields').hidden=false;}
 const part=error.path.match(/^portfolio\.(sections\[(\d+)\]|site|education|resources)/);if(part)active=part[2]!==undefined?data.sections[Number(part[2])].id:part[1];forms?.openPath(error.path);if(functional)$('#editor-section').value=active;form();valid();
 $('#editor-nav').querySelectorAll('button').forEach(b=>{if(b.dataset.group===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 let attempts=0;
 const reveal=()=>{
  valid();const fields=$('#fields');
  for(const node of fields.querySelectorAll('details[data-path]'))if(error.path===node.dataset.path||error.path.startsWith(node.dataset.path+'.')||error.path.startsWith(node.dataset.path+'['))node.open=true;
  const field=[...fields.querySelectorAll('input,textarea,select')].find(n=>n.dataset.path===error.path);
  if(field){for(let node=field.parentElement;node&&node!==fields;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;field.focus();}
  else if(++attempts<16)requestAnimationFrame(reveal);
 };reveal();
}
async function save(options={}){
 if(saving||operation&&!options.localOnly)return;
 saving=true;
 const blocked=['#publish','#load-remote','#import'].map(selector=>[$(selector),$(selector).disabled]);blocked.forEach(([node])=>{node.disabled=true;});
 const button=$('#save');button.disabled=true;button.textContent='Saving…';
 try{
  const result=navigator.locks?await navigator.locks.request('portfolio-draft',{ifAvailable:true},lock=>{if(lock)return saveLocked();status('Another editor tab is saving a draft. Wait for it to finish, then click Save Draft again, or Download backup to keep this version. Your edits are still here.',true);return false;}):await saveLocked();
  if(result&&!options.localOnly&&remote?.isConnected()&&remoteAdopted){const snapshot=JSON.parse(saved);if(!validate(snapshot).length&&!unfinishedEntries(snapshot,templateIDs).length&&!missingDraftAssets(snapshot,baseline,images).length){
   try{const result=await remote.saveDraft(snapshot,images);showDraft(result);status(JSON.stringify(data)!==saved?'The earlier version is saved locally and on GitHub. You have newer unsaved edits; click Save Draft again.':'Draft saved to a public GitHub branch. The live site has not changed.'+(result.warning?' '+result.warning:''));}
   catch(e){status('The earlier version is saved locally. '+e.message+(JSON.stringify(data)!==saved?' You also have newer unsaved edits; click Save Draft again.':''),true);}
  }}
  return result;
 }
 finally{saving=false;blocked.forEach(([node,disabled])=>{node.disabled=disabled;});button.disabled=!!operation;button.textContent='Save Draft';}
}
async function saveLocked(){
 settleHistory();
 if(busy){status('Wait for the file operation to finish.',true);return;}
 const errors=valid(),structural=validateLocalDraft(data);if(structural.length){status('Draft could not be saved: '+describeError(structural[0],data,friendly),true);return;}
 try{const current=localStorage.getItem(draftKey);if(current&&JSON.parse(current).draftRevision!==draftRevision){
   if(!await confirmChange('Another tab saved a draft','Continue with the edits in this tab? A recovery copy of the other saved version will be kept in this browser. Cancel keeps both versions unchanged.','Use this tab’s edits')){status('Save cancelled. Your edits remain in this tab. Download backup keeps a separate copy.');return;}
   if(localStorage.getItem(draftKey)!==current)throw Error('Another tab changed the draft again. Close the other editor tab and retry.');
   localStorage.setItem('portfolio-before-local-overwrite',current);
  }
  const snapshot=clone(data),json=JSON.stringify({portfolio:snapshot,draftRevision:crypto.randomUUID(),savedAt:new Date().toISOString(),...(friendly?{editor:templateMetadata(snapshot,templateIDs)}:{})});localStorage.setItem(draftKey,json);draftRevision=JSON.parse(json).draftRevision;saved=JSON.stringify(snapshot);const unfinished=friendly&&unfinishedEntries(data,templateIDs).length;
  try{for(const copy of recovery?.list()||[])if(JSON.stringify(copy.value.portfolio)===saved)recovery.discard(copy);}catch{}
  const missing=missingDraftAssets(snapshot,baseline,images);
  if(errors.length&&!operation){if(functional)revealError(errors[0]);if(visual){fieldSelection=canvas.recordForPath(errors[0].path)||canvas.selection();form();valid();$('#fields').hidden=false;$('#fields').querySelector('[aria-invalid=true]')?.focus();}}
  status(errors.length?'Draft saved in this browser, including unfinished edits. Before publishing: '+describeError(errors[0],snapshot,friendly):unfinished?'Draft saved in this browser, including unfinished items. Fill in their names and summaries before publishing.':'Draft saved in this browser. Nothing has been published.');
  if(missing.length){status('Your text is saved in this browser, but '+missing.length+' uploaded file(s) are missing. Upload them again or use Load saved version to recover them from GitHub.',true);return true;}if(unfinished||errors.length)return true;
  return true;
 }catch(e){status(e?.name==='QuotaExceededError'||e?.name==='SecurityError'?storageMessage():e.message||storageMessage(),true);}
}
async function download(){
 if(busy){status('Wait for the file operation to finish.',true);return;}
 const errors=validateLocalDraft(data);if(errors.length){status('Backup could not be created: '+describeError(errors[0],data,friendly),true);return;}
 const missing=missingDraftAssets(data,baseline,images);if(missing.length){const url=URL.createObjectURL(new Blob([JSON.stringify({portfolio:data,editor:templateMetadata(data,templateIDs),recoveryOnly:true},null,2)],{type:'application/json'}));element('a',{href:url,download:'portfolio-text-recovery.json'}).click();setTimeout(()=>URL.revokeObjectURL(url),10000);status('Downloaded a text-only recovery copy. '+missing.length+' uploaded file(s) are missing from this browser and are NOT included. Your text and image references are preserved. Load saved version from GitHub or upload the missing files again for a complete backup.',true);return;}
 const files=new Map([['content/portfolio.json',new Blob([JSON.stringify({portfolio:data,...(friendly&&unfinishedEntries(data,templateIDs).length?{editor:templateMetadata(data,templateIDs)}:{})},null,2)+'\n'],{type:'application/json'})]]);
 for(const src of assetPaths(data))if(images.has(src))files.set(src,images.get(src));
 const zip=await makeZip(files),url=URL.createObjectURL(zip),a=element('a',{href:url,download:'portfolio-draft.zip'});a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);status(friendly?'Backup downloaded with your draft and uploaded files. Use Restore backup to open it on this or another computer.':'Exported content and uploaded files. Existing site assets remain referenced. Nothing has been published.');
}
$('#save').onclick=()=>save();$('#export').onclick=()=>download().catch(e=>status('Backup could not be downloaded. '+e.message,true));$('#publish').onclick=reviewPublish;$('#refresh').onclick=updatePreview;
if(functional){$('#open-preview').onclick=()=>{settleHistory();updatePreview();$('#website-preview').showModal();};$('#close-preview').onclick=()=>$('#website-preview').close();}
$('#viewport').onchange=e=>$('#preview').classList.toggle('mobile',e.target.value==='mobile');
$('#undo').onclick=()=>{settleHistory();if(!history.length)return;future.push(JSON.stringify(data));data=JSON.parse(history.pop());prior=JSON.stringify(data);revision++;updateButtons();form();updatePreview();status('Undid the last change. Save Draft to retain this version.');};
$('#redo').onclick=()=>{if(!future.length)return;history.push(JSON.stringify(data));data=JSON.parse(future.pop());prior=JSON.stringify(data);revision++;updateButtons();form();updatePreview();status('Restored the next change.');};
$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(busy||saving||operation){e.target.value='';status('Wait for the current save or upload to finish, then restore your backup.',true);return;}lockEditing('restore');try{
 if(file.size>100_000_000)throw Error('Draft package is too large.');let next,files,wrapper,nextTemplates;
 if(/\.zip$/i.test(file.name)){files=await readZip(file);wrapper=JSON.parse(await files.get('content/portfolio.json').text());next=wrapper.portfolio;}
 else{if(file.size>2_000_000)throw Error('Content JSON must be smaller than 2 MB.');wrapper=JSON.parse(await file.text());next=wrapper.portfolio;}
 nextTemplates=friendly?readTemplateIDs(wrapper.editor):new Set();const errors=validateLocalDraft(next);if(errors.length)throw Error(describeError(errors[0],next,friendly));
 for(const m of next.media){if(!wrapper.recoveryOnly&&!baseline.media.some(x=>x.src===m.src)&&!images.has(m.src)&&!files?.has(m.src))throw Error('Missing uploaded image '+m.src+'. Import the complete exported ZIP.');}
 if(!wrapper.recoveryOnly&&next.site.resume!==baseline.site.resume&&!images.has(next.site.resume)&&!files?.has(next.site.resume))throw Error('Missing resume PDF. Import the complete exported ZIP.');
 if(friendly&&!await confirmChange('Restore this backup?',(wrapper.recoveryOnly?'This is a text-only recovery copy. You may need to upload missing images or PDFs again. ':'')+'This replaces the draft you are editing. You can use Undo to return to it. The live website stays unchanged.','Restore backup'))return;
 if(files)for(const [p,blob] of files)if(p!=='content/portfolio.json'){
  if(isResumeUpload(p)){if(p!==next.site.resume)throw Error('Unreferenced resume PDF in draft package.');await verifyResume(p,blob);await putImage(p,blob);images.set(p,blob);urls.set(p,URL.createObjectURL(blob));continue;}
  if(blob.size>2_000_000)throw Error('Uploaded images must be smaller than 2 MB.');
  const bytes=new Uint8Array(await blob.arrayBuffer());const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,20);if(!matchesImageUpload(p,bytes,hash))throw Error('Uploaded image does not match its stable filename or image format.');
  const bitmap=await createImageBitmap(blob);const record=next.media.find(m=>m.src===p);const ok=record&&bitmap.width===record.width&&bitmap.height===record.height&&bitmap.width<=2400&&bitmap.height<=2400;bitmap.close();if(!ok)throw Error('Image dimensions do not match the draft.');
  await putImage(p,blob);images.set(p,blob);urls.set(p,URL.createObjectURL(blob));
 }
 settleHistory();history.push(JSON.stringify(data));data=next;for(const id of nextTemplates)templateIDs.add(id);prior=JSON.stringify(data);future=[];revision++;form();updateButtons();updatePreview();status(wrapper.recoveryOnly?'Text recovered. Save Draft to keep it. Missing images or PDFs must be uploaded again before publishing.':friendly?'Backup restored. Save Draft to keep it in this browser.':'Imported draft. Save Draft to keep it in this browser.');
 }catch(err){status(friendly?'Backup could not be restored. Your current draft is unchanged. '+(err instanceof SyntaxError?'Choose a backup downloaded from this editor.':/assets\/|stable filename|dimensions|WebP format/.test(err.message)?'The backup contains an incomplete or damaged image. Try the original backup file.':err.message):'Import failed: '+err.message,true);}finally{e.target.value='';unlockEditing();}};
window.addEventListener('beforeunload',event=>{checkpoint();if(operation||saving||busy||data&&JSON.stringify(data)!==saved){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',checkpoint);document.addEventListener('visibilitychange',()=>{if(document.hidden)checkpoint();});
window.addEventListener('storage',event=>{if(event.key===draftKey)status('Another tab saved a draft. Your edits are still here. Save Draft lets you choose which version to keep; Download backup keeps a separate copy.',true);});
try{
 lockEditing('loading');
 try{publishing=await loadJSON('publishing.json',5000);}catch{}if(publishingReady(publishing,location.origin))publication.resume();$('#signin').textContent=publishingReady(publishing,location.origin)?'Sign in with GitHub':'GitHub setup';
 if(publishingReady(publishing,location.origin))$('#publish-note').textContent='Click Publish when you are ready. It handles sign-in, saving and checks, then asks you to confirm.';
 if(friendly&&!publishingReady(publishing,location.origin)){$('#signin').hidden=true;$('#publish').disabled=true;$('#publish').title='Publishing is available at https://www.elidoggart.com/editor/.';$('#mode-label').textContent='Local preview';$('#publish-note').textContent='Save Draft keeps your work in this browser. The live website stays unchanged. To publish, open the editor at www.elidoggart.com.';}
 let cachedPublication=false;
 try{baseline=(await loadJSON('../content/portfolio.json',15000)).portfolio;if(validate(baseline).length)throw Error('The website returned unreadable content.');try{localStorage.setItem(publishedCacheKey,JSON.stringify({portfolio:baseline}));}catch{}}
 catch(error){let cached;try{cached=JSON.parse(localStorage.getItem(publishedCacheKey));}catch{}if(!cached||validate(cached.portfolio).length)throw error;baseline=cached.portfolio;cachedPublication=true;}
 data=clone(baseline);
 let local;try{local=loadLocalDraft(localStorage,readableDraft);}catch{local={warning:'Browser draft storage is unavailable. Download backup to keep your edits.'};}
 if(local.stored){const stored=local.stored;templateIDs=friendly?readTemplateIDs(stored.editor):new Set();data=stored.portfolio;draftRevision=stored.draftRevision;status('Restored the draft saved in this browser. Nothing has been published.');}
 else status(friendly?'Ready to edit. Save Draft keeps your changes on this computer.':'Ready. Changes stay in this browser until you save or export.');
 if(local.warning){const notice=element('p',{class:'notice',role:'alert',text:local.warning});if(local.recovery){notice.append(' ',element('button',{type:'button',text:'Download recovery copy',onclick:()=>{const url=URL.createObjectURL(new Blob([local.recovery],{type:'application/json'}));element('a',{href:url,download:'portfolio-draft-recovery.json'}).click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}));}$('.notice').after(notice);}
 if(cachedPublication)$('.notice').after(element('p',{class:'notice',role:'alert',text:'The latest website content could not be loaded. You can keep editing your saved draft using the last downloaded website copy. Some images may be unavailable until you reconnect. Publish will check GitHub for newer changes.'}));
 try{images=await getImages();}catch{status('Uploaded-file storage is unavailable in this browser. Existing content can still be edited and exported.',true);}
 if(images.unreadable)$('.notice').after(element('p',{class:'notice',role:'alert',text:'Some uploaded files could not be read from browser storage. Your text is still available. Load saved version from GitHub or upload missing files again before publishing.'}));
 for(const [src,blob] of images)urls.set(src,URL.createObjectURL(blob));saved=JSON.stringify(data);prior=saved;
 for(const key of ['work','projects','skills','passions','resume','site','education','media','resources']){
  if(functional&&['work','resume','media'].includes(key))$('#editor-nav').append(element('span',{class:'nav-label',text:{work:'Website sections',resume:'Profile',media:'Library'}[key]}));
  const button=element('button',{text:key==='site'?'Site & contact':friendly&&key==='media'?'Images':friendly&&key==='resources'?'Links & downloads':key[0].toUpperCase()+key.slice(1),'aria-current':key===active?'page':undefined,onclick:()=>{settleHistory();fieldSelection=null;if(visual)$('#fields').hidden=false;active=key;$('#editor-nav').querySelectorAll('button').forEach(b=>b.removeAttribute('aria-current'));button.setAttribute('aria-current','page');if(functional)$('#editor-section').value=key;form();}});button.dataset.group=key;$('#editor-nav').append(button);if(functional)$('#editor-section').append(element('option',{value:key,text:button.textContent}));
 }
 if(functional)$('#editor-section').onchange=event=>$('#editor-nav').querySelector('[data-group="'+event.target.value+'"]').click();
 if(visual){
  canvas=createCanvas({iframe:$('#preview'),getData:()=>data,isTemplate:id=>templateIDs.has(id),markTemplate:id=>templateIDs.add(id),changed,refresh:updatePreview,settle:settleHistory,status,showFields:record=>{fieldSelection=['resume','resources'].includes(record.kind)?null:record;if(['resume','resources'].includes(record.kind))active=record.kind;$('#fields').hidden=false;form();$('#fields').querySelector('input:not([readonly]),textarea,select')?.focus();},uploadImage:{url:src=>urls.get(src)||'../'+src,add:prepareImage}});
 }
 if(functional)forms=createForms({root:$('#fields'),getData:()=>data,changed,settle:settleHistory,status,markTemplate:id=>templateIDs.add(id),uploadImage:{url:src=>urls.get(src)||'../'+src,add:prepareImage}});
 form();updatePreview();updateSaveState();
 if(visual){const errors=validateDraft(data,templateIDs);if(errors.length)revealError(errors[0]);}
 try{recovery=createRecovery(localStorage);showRecoveries();recoveryReady=true;}catch{status(storageMessage(),true);}
 unlockEditing();
}catch(error){status('Editor could not load. Check your connection, then reload this page. '+error.message,true);}

function showRecoveries(){
 const copies=recovery.list().filter(copy=>JSON.stringify(copy.value.portfolio)!==saved);if(!copies.length)return;
 const box=element('details',{class:'notice recovery-copies',open:true}),body=element('div');box.append(element('summary',{text:'Recovered edits are available ('+copies.length+')'}),element('p',{text:'These copies were saved automatically while editing. Restore one to continue, or download it for safekeeping. Your saved draft stays unchanged until you click Save Draft.'}),body);$('.notice').after(box);
 for(const copy of copies){const row=element('div',{class:'recovery-copy'}),done=()=>{row.remove();if(!body.children.length)box.remove();};
  row.append(element('p',{text:(copy.value.portfolio.site.name||'Untitled draft')+' · '+new Date(copy.value.savedAt).toLocaleString()}),element('button',{type:'button',text:'Restore recovered edits',onclick:async()=>{
   if(operation||busy||saving)return;if(JSON.stringify(data)!==saved&&!await confirmChange('Restore recovered edits?','Your current edits will remain available with Undo. Nothing will be published.','Restore edits'))return;
   settleHistory();history.push(JSON.stringify(data));data=clone(copy.value.portfolio);for(const id of readTemplateIDs(copy.value.editor))templateIDs.add(id);prior=JSON.stringify(data);future=[];revision++;form();updateButtons();updatePreview();status('Recovered your edits. Review them and click Save Draft. Undo returns to the previous version.');done();
  }}),element('button',{type:'button',text:'Download recovery copy',onclick:()=>{const url=URL.createObjectURL(new Blob([copy.raw],{type:'application/json'}));element('a',{href:url,download:'portfolio-recovered-edits.json'}).click();setTimeout(()=>URL.revokeObjectURL(url),10000);status('Recovered text downloaded. Uploaded files stay in this browser; restore the copy and use Download backup to include them.');}}),element('button',{type:'button',text:'Dismiss for now',onclick:()=>{row.remove();if(!body.children.length)box.remove();}}));body.append(row);
 }
}

function showDraft(draft){const link=$('#draft-link');link.hidden=!draft;if(draft)link.href='https://github.com/'+publishing.repository+'/pull/'+draft.pr.number;}
function signedOut(){remoteAdopted=false;reviewed=null;$('#publish-dialog').close();$('#confirm-publish').hidden=true;$('#signin').hidden=false;$('#remote-tools').hidden=true;$('#mode-label').textContent='Local draft mode';$('#publish-note').textContent='Drafts save in this browser. GitHub credentials are not stored here. Repository drafts are public.';}
async function connectGitHub(){
 if(!publishingReady(publishing,location.origin)){showSetup();return false;}
 $('#signin').disabled=true;status('Complete GitHub sign-in in the popup. Your local draft stays here.');
 try{const credentials=await signIn(publishing.authOrigin);const {DecapAPI}=await import('./vendor/decap-api.mjs');remote?.end();remote=createRemote(publishing,{apiFactory:options=>new DecapAPI(options),onExpire:()=>{signedOut();status('GitHub sign-in expired. Your local draft is safe. Sign in again to continue.',true);}});remoteState=await remote.connect(credentials);
  $('#signin').hidden=true;$('#remote-tools').hidden=false;$('#mode-label').textContent='GitHub connected';$('#publish-note').textContent='Publish saves your changes, checks them, and asks you to confirm before updating the website.';showDraft(remoteState.draft);
  if(!remoteState.draft&&JSON.stringify(remoteState.published)===JSON.stringify(baseline)){remote.adopt(remoteState);remoteAdopted=true;status('Connected. Local edits can now be saved to a public GitHub draft.');}
  else{remoteAdopted=false;status('Connected. Click Publish to save and publish these edits. If GitHub has a different version, you can choose which to use.');}
  return true;
 }catch(e){signedOut();status(e.message,true);return false;}finally{$('#signin').disabled=false;}
}
$('#signin').onclick=connectGitHub;
async function chooseVersion(){
 return new Promise(resolve=>{
  let choice=null;const dialog=element('dialog',{'aria-labelledby':'version-title'}),finish=value=>{choice=value;dialog.close();};
  dialog.append(element('h2',{id:'version-title',text:'Which version do you want to use?'}),element('p',{text:'Your current edits differ from the version saved on GitHub. Choose what to publish. Nothing goes live until you confirm.'}),element('button',{class:'primary',text:'Keep my current edits',onclick:()=>finish('local')}),element('button',{text:'Load saved GitHub version',onclick:()=>finish('remote')}),element('button',{text:'Cancel',onclick:()=>finish(null)}));
  dialog.addEventListener('close',()=>{dialog.remove();resolve(choice);},{once:true});document.body.append(dialog);dialog.showModal();
 });
}
async function adoptRemote(state,load){
 const next=state.draft?.data||state.published;
 if(load){
  // Keep the displaced draft and its uploaded assets recoverable locally and with Undo.
  localStorage.setItem('portfolio-before-github-load',JSON.stringify({portfolio:data,editor:templateMetadata(data,templateIDs),savedAt:new Date().toISOString()}));
  const assets=await remote.media(next,state.draft?.head||state.publishedHead);for(const [src,blob]of assets){await putImage(src,blob);images.set(src,blob);urls.set(src,URL.createObjectURL(blob));}
  settleHistory();history.push(JSON.stringify(data));data=structuredClone(next);templateIDs=new Set();prior=JSON.stringify(data);future=[];revision++;form();updateButtons();updatePreview();
 }
 remote.adopt(state);baseline=structuredClone(state.published);remoteState=state;remoteAdopted=true;showDraft(state.draft);
}
$('#load-remote').textContent='Load saved version';
$('#load-remote').onclick=async()=>{
 if(busy||saving||operation)return;lockEditing('load');
 try{const state=await remote.snapshot();const next=state.draft?.data||state.published;
  if(JSON.stringify(data)!==JSON.stringify(next)&&!await confirmChange('Load saved GitHub version?','Your current edits will be kept in Undo. Download backup first if you want a separate copy.','Load saved version'))return;
  if(!await save({localOnly:true}))return;
  await adoptRemote(state,true);if(await save({localOnly:true}))status('Loaded your saved GitHub version. Edit it, then click Publish when ready. Undo restores the previous edits.');
 }catch(e){status('Saved version could not be loaded. Your current edits are still available. '+e.message,true);}finally{unlockEditing();}
};
$('#logout').onclick=()=>{remote?.end();signedOut();status('Signed out. Your local draft remains available.');};
async function reviewPublish(){
 if(operation||saving)return;
 if(publication.isPending()){publication.refresh();return;}
 if(busy){status('Wait for the file upload to finish, then click Publish.',true);return;}
 const incomplete=friendly?unfinishedEntries(data,templateIDs):[],errors=validate(data);
 if(incomplete.length||errors.length){if(errors.length&&functional)revealError(errors[0]);status(incomplete.length?'Not ready to publish: fill in the name and summary for '+incomplete[0].name+' before publishing.':'Not ready to publish: '+describeError(errors[0],data,true),true);return;}
 if(!publishingReady(publishing,location.origin)){showSetup();return;}
 preparingPublication=true;lockEditing('review');
 try{
  publication.note('Preparing to publish…','We will save your edits, check them, and ask you to confirm.');
  if(!remote?.isConnected()){publication.note('Sign in to continue','Complete GitHub sign-in in the popup. Then publishing will continue automatically.');if(!await connectGitHub()){publication.error('Sign-in was not completed. Your edits are safe. Click Publish to try again.');return;}}
  if(!await save({localOnly:true}))throw Error($('#status').textContent);
  const state=await remote.snapshot(),next=state.draft?.data||state.published;
  const same=JSON.stringify(data)===JSON.stringify(next),remoteUnchanged=JSON.stringify(next)===JSON.stringify(baseline);
  let load=false;
  if(!same&&!remoteUnchanged&&JSON.stringify(data)===JSON.stringify(baseline))load=true;
  else if(!same&&!remoteUnchanged){const choice=await chooseVersion();if(!choice){publication.cancel();return;}load=choice==='remote';}
  await adoptRemote(state,load);if(load&&!await save({localOnly:true}))throw Error($('#status').textContent);
  if(!state.draft&&JSON.stringify(data)===JSON.stringify(state.published)){status('These edits are already saved on GitHub. Checking whether the website has finished updating.');await publication.start(state.publishedHead);return;}
  if(!state.draft||JSON.stringify(data)!==JSON.stringify(state.draft.data)){publication.note('Saving your changes…','Saving a copy on GitHub before checking it. The live website has not changed yet.');showDraft(await remote.saveDraft(data,images));}
  publication.review();reviewed=await remote.review(data,{wait:true});publication.ready();
  $('#publish-dialog h2').textContent='Ready to update your website';$('#publish-message').replaceChildren(element('p',{text:'Your changes are saved and checks have passed. Confirm below to update the live website. Final checks and deployment can take several minutes; the progress tracker will tell you when it is live.'}));$('#confirm-publish').textContent='Publish now';$('#confirm-publish').hidden=false;$('#publish-dialog').showModal();
 }catch(e){if(e.pending)publication.note('Checks are still running',e.message);else publication.error(e.message);status(e.message,!e.pending);}finally{preparingPublication=false;unlockEditing();}
}
$('#confirm-publish').onclick=async()=>{if(operation||saving)return;lockEditing('publish');const button=$('#confirm-publish');button.disabled=true;$('#publish-dialog').close();publication.merging();try{const submitted=structuredClone(data);lastMerge=await remote.publish(submitted,reviewed);baseline=submitted;remoteAdopted=false;status('Draft published. Follow the website update in the progress tracker above.');$('#deployment').hidden=false;await publication.start(lastMerge.sha);}catch(e){publication.error(e.message);status(e.message,true);}finally{button.disabled=false;unlockEditing();}};
$('#deployment').onclick=()=>publication.refresh();
