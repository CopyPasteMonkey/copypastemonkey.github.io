// Editing bindings for the controlled renderer. No heading matching, HTML input,
// or independent page template: the public DOM remains the canvas.
import {element,mountForm,confirmRemoval} from './form.mjs';
import {schema,resolve,blank} from '../lib/schema.mjs';
import {chooseImage as pickImage} from './image-picker.mjs';
import {blankEntry,templates} from './templates.mjs';
import {entrySlots} from './entry-slots.mjs';
import {contentNames,entryNames,fieldNames,uniqueID,itemName} from './friendly.mjs';
const parts=path=>path.match(/[a-zA-Z][a-zA-Z0-9]*|\d+/g)||[];
export const at=(data,path)=>parts(path).reduce((value,key)=>value?.[key],data);
function put(data,path,value){const keys=parts(path),last=keys.pop();keys.reduce((v,k)=>v[k],data)[last]=value;}
export function createCanvas({iframe,getData,isTemplate,markTemplate,changed,refresh,settle,status,showFields,uploadImage}){
 let doc,selected=null,preview=false,bindings=new Map(),dirtyInline=false;
 const toolbar=document.querySelector('#canvas-toolbar');
 const button=id=>toolbar.querySelector('#'+id);
 function owner(node,path,kind){if(!node)throw Error('Canvas template binding missing: '+path);node.dataset.canvasPath=path;node.dataset.canvasKind=kind;bindings.set(path,{path,kind});return node;}
 function text(node,path){if(!node)return;node.dataset.editPath=path;node.contentEditable='plaintext-only';const m=path.match(/^sections\[(\d+)\]\.entries\[(\d+)\](?:\.roles\[(\d+)\])?/);const entry=m?getData().sections[Number(m[1])].entries[Number(m[2])]:null;const context=entry?[entry.title,m[3]!==undefined?entry.roles[Number(m[3])].label:''].filter(Boolean).join(' — '):'';const key=path.split('.').at(-1).replace(/\[\d+\]/,'');node.setAttribute('aria-label','Edit '+(fieldNames[key]||key)+(context?' — '+context:''));node.setAttribute('role','textbox');node.spellcheck=true;}
 function image(node,value,path){owner(node,path,'image');node.tabIndex=0;node.setAttribute('role','button');node.setAttribute('aria-label','Edit image: '+value.alt);}
 function blockNodes(parent,items,path,offset=0){
  const children=[...parent.children].slice(offset).filter(n=>!n.matches('.collapse-button'));
  if(children.length!==items.length)throw Error('Canvas block structure changed: '+path);
  items.forEach((item,index)=>{const node=children[index],p=path+'['+index+']';owner(node,p,'block');
   switch(item.type){
    case 'section':text(node.children[0],p+'.title');blockNodes(node,item.blocks,p+'.blocks',1);break;
    case 'resources':blockNodes(node,item.blocks,p+'.blocks');break;
    case 'text':text(item.style==='italic'?node.querySelector('em'):node,p+'.text');break;
    case 'heading':text(node,p+'.title');break;
    case 'citation':text(node.querySelector('em'),p+'.title');break;
    case 'list':item.items.forEach((_,i)=>text(node.children[i],p+'.items['+i+']'));break;
    case 'figure':image(node.matches('figure')?node:node.querySelector('figure'),item.image,p+'.image');break;
    case 'gallery':item.images.forEach((v,i)=>image(node.children[i],v,p+'.images['+i+']'));break;
   }
  });
 }
 function context(){
  const data=getData(),p=selected?.path||'',match=p.match(/^sections\[(\d+)\](?:\.entries\[(\d+)\])?(?:\.roles\[(\d+)\])?/);
  const visible=doc?.querySelector('.view:not([hidden])')?.dataset.view;
  const si=match?Number(match[1]):data.sections.findIndex(s=>s.id===visible),section=data.sections[si];
  const ep=match?.[2]!==undefined?'sections['+si+'].entries['+match[2]+']':null,entry=ep?at(data,ep):null;
  const rp=match?.[3]!==undefined?ep+'.roles['+match[3]+']':entry?.roles.length===1?ep+'.roles[0]':null;
  return {data,p,si,section,ep,entry,rp,role:rp?at(data,rp):null,value:selected?at(data,p):null};
 }
 function arrayLocation(){const candidate=selected?.path.endsWith('.image')?selected.path.slice(0,-6):selected?.path;const match=candidate?.match(/^(.*)\[(\d+)\]$/);if(!match)return null;const array=at(getData(),match[1]);if(!Array.isArray(array))return null;return {path:match[1],array,index:Number(match[2]),suffix:candidate===selected.path?'':'.image'};}
 function removable(){const pos=arrayLocation();return !!pos&&!/^sections$/.test(pos.path)&&!((pos.path.endsWith('.roles')||pos.path.endsWith('.images'))&&pos.array.length<2);}
 function select(record){
  selected=record&&at(getData(),record.path)!==undefined?record:null;
  if(doc){doc.querySelectorAll('[data-selected]').forEach(n=>n.removeAttribute('data-selected'));if(selected)for(const node of doc.querySelectorAll('[data-canvas-path]'))if(node.dataset.canvasPath===selected.path)node.dataset.selected='true';}
  controls();
 }
 function controls(){
  const c=context(),value=c.value;const label=selected?(value?.title||value?.label||value?.alt||contentNames[value?.type]||({entry:'Untitled '+(templates[c.section?.id]?.name||'item'),role:'Details',section:c.section?.id,site:'Site & contact',education:'Education'}[selected.kind])):'Click text to edit, or choose an item below.';
  document.querySelector('#canvas-selection').textContent=preview?'Previewing your draft':label;
  const crumbs=document.querySelector('#canvas-parents');crumbs.replaceChildren();
  for(const [record,name] of [[{path:'sections['+c.si+']',kind:'section'},c.section?.id],[{path:c.ep,kind:'entry'},c.entry?.title],[{path:c.rp,kind:'role'},c.role?.label||'Details']])if(record.path&&name&&record.path!==selected?.path&&at(getData(),record.path))crumbs.append(element('button',{text:name,disabled:preview,onclick:()=>{select(record);focusSelection();}}));
  for(const match of c.p.matchAll(/\.blocks\[\d+\]/g)){const path=c.p.slice(0,match.index+match[0].length),value=at(getData(),path);if(path!==c.p&&['section','resources','gallery'].includes(value?.type))crumbs.append(element('button',{text:value.title||contentNames[value.type],disabled:preview,onclick:()=>{select({path,kind:'block'});focusSelection();}}));}
  const outline=document.querySelector('#canvas-outline');const choice=selected?.kind==='entry'?c.ep:c.rp||c.ep||'';outline.replaceChildren(element('option',{value:'',text:'Choose a company, project or role…'}));
  getData().sections.forEach((section,si)=>{const group=element('optgroup',{label:section.id[0].toUpperCase()+section.id.slice(1)});section.entries.forEach((entry,ei)=>{const ep='sections['+si+'].entries['+ei+']';group.append(element('option',{value:ep,text:entry.title||'Untitled '+templates[section.id].name}));entry.roles.forEach((role,ri)=>group.append(element('option',{value:ep+'.roles['+ri+']',text:'↳ '+(role.label||role.role||'Details')+' · '+(entry.title||'Untitled '+templates[section.id].name)})));});outline.append(group);});outline.value=choice;outline.disabled=preview;
  button('add-entry').textContent='Add '+(templates[c.section?.id]?.name||'item');button('add-role').textContent=c.section?.id==='work'?'Add role':'Add details section';
  button('add-entry').disabled=preview||!c.section;button('add-role').disabled=preview||!c.entry||c.entry.roles.length>=20;
  button('add-text').disabled=preview||!c.rp;button('add-image').disabled=preview||(!c.entry&&!c.rp);
  button('add-content').disabled=preview||!c.rp;
  button('edit-details').disabled=preview||!selected;
  const pos=arrayLocation();button('move-up').disabled=preview||!pos||pos.index===0||pos.path==='sections';button('move-down').disabled=preview||!pos||pos.index===pos.array.length-1||pos.path==='sections';button('remove-selection').disabled=preview||!removable();
  button('add-image').textContent=selected?.kind==='image'||(selected?.kind==='entry'&&c.entry?.image.length)?'Replace image':'Add image';
  document.querySelector('#canvas-hint').textContent=preview?'Visitor preview hides unfinished items and editing spaces. Back to editing returns to your draft.':!c.entry?'Click a field to edit it, or use Add '+(templates[c.section?.id]?.name||'item')+' at the bottom of the page.':!c.rp?'Choose a role, such as Current Work or Internship, to add text and images to it.':!(c.value?.blocks||c.role.blocks).length?'Fill the labeled spaces on the page. Images, dates and extra details are optional.':'Changes appear in your draft. Use Undo to reverse a change, then Save Draft to keep your work.';
  const protectedLast=!removable()&&arrayLocation();button('remove-selection').title=protectedLast?'Keep at least one role or image here. You can remove its parent item instead.':'';
 }
 function bind(){
  doc=iframe.contentDocument;bindings=new Map();dirtyInline=false;if(preview){controls();return;}
  const data=getData();
  doc.head.append(element('link',{rel:'stylesheet',href:new URL('entry-slots.css',location.href).href}));
  const style=doc.createElement('style');style.textContent=`[data-edit-path]{cursor:text;border-radius:2px}[data-edit-path]:hover{outline:1px dashed #ac2b3780;outline-offset:4px}[data-edit-path]:focus{outline:2px solid #ac2b37;outline-offset:5px;background:#fffafa}[data-canvas-kind=image]:hover{outline:1px dashed #ac2b3780;outline-offset:4px}[data-selected]{outline:2px solid #ac2b37;outline-offset:5px}[data-canvas-kind=image]{cursor:pointer}[data-canvas-kind=image]:focus-visible{outline:2px solid #ac2b37;outline-offset:5px}[contenteditable]{min-height:1em}`;doc.head.append(style);
  owner(doc.querySelector('.site-header'),'site','site');text(doc.querySelector('.name'),'site.name');text(doc.querySelector('.profession'),'site.profession');
  text(doc.querySelector('.introduction'),'site.introduction');owner(doc.querySelector('footer'),'site','site');text(doc.querySelector('footer p'),'site.footer');
  data.sections.forEach((section,si)=>{const p='sections['+si+']',view=owner(doc.getElementById('view-'+section.id),p,'section');text(view.querySelector(':scope > .section-heading > p'),p+'.subtitle');
   section.entries.forEach((entry,ei)=>{const ep=p+'.entries['+ei+']',node=owner(doc.getElementById('entry-'+entry.id),ep,'entry');text(doc.getElementById('title-'+entry.id),ep+'.title');text(node.querySelector('.entry-intro'),ep+'.intro');text(node.querySelector(':scope > .entry-summary .company-line .date'),ep+'.date');text(node.querySelector(':scope > .entry-summary .role'),ep+'.role');
    if(entry.divider)text(node.previousElementSibling?.querySelector('h3'),ep+'.divider');
    if(entry.image.length)image(node.querySelector(':scope > .entry-summary > .entry-photo > figure'),entry.image[0],ep+'.image[0]');
    entry.roles.forEach((role,ri)=>{const rp=ep+'.roles['+ri+']',control=doc.querySelector('[data-expand="'+role.id+'"]')?.parentElement;owner(control,rp,'role');
     if(role.label)text(control.querySelector('.role-meta h4:not(.visually-hidden)'),rp+'.label');text(control.querySelector('.role-meta .role'),rp+'.role');text(control.querySelector('.role-meta .date'),rp+'.date');
     const details=owner(doc.getElementById('details-'+role.id),rp,'role');blockNodes(details,role.blocks,rp+'.blocks');
    });
   });
  });
  const education=owner(doc.querySelector('.education'),'education','education');text(education.previousElementSibling.querySelector('h3'),'education.heading');text(education.querySelector('h4'),'education.school');text(education.querySelector('.date'),'education.date');text(education.querySelector('p'),'education.degree');
  const contact=owner(doc.querySelector('.contact-content'),'site','site');text(contact.querySelector('h3'),'site.name');text(contact.querySelector('p'),'site.profession');text(contact.querySelector('.contact-email'),'site.email');text(contact.querySelector('.contact-phone'),'site.phone');
  doc.addEventListener('click',event=>{const node=event.target.closest('[data-canvas-path]');if(node)select(bindings.get(node.dataset.canvasPath));if(event.target.closest('[data-edit-path]')||event.target.closest('[data-canvas-kind="image"]')||(event.target.closest('a')&&!event.target.closest('nav')&&!event.target.closest('.skip')))event.preventDefault();if(event.target.closest('.resume-download')){event.preventDefault();showFields({path:'resume',kind:'resume'});}},true);
  doc.addEventListener('focusin',event=>{const node=event.target.closest('[data-canvas-path]');if(node)select(bindings.get(node.dataset.canvasPath));});
  doc.addEventListener('dblclick',event=>{if(event.target.closest('[data-canvas-kind="image"]'))details();});
  doc.addEventListener('keydown',event=>{if(event.target.matches('[data-canvas-kind="image"]')&&['Enter',' '].includes(event.key)){event.preventDefault();details();}if(event.target.matches('[data-edit-path]')&&event.key==='Escape'){event.target.blur();}});
  doc.addEventListener('paste',event=>{if(event.target.closest('[data-edit-path]')){event.preventDefault();const text=event.clipboardData.getData('text/plain');const selection=doc.getSelection();if(!selection.rangeCount)return;const range=selection.getRangeAt(0);range.deleteContents();const node=doc.createTextNode(text);range.insertNode(node);range.setStartAfter(node);range.collapse(true);selection.removeAllRanges();selection.addRange(range);event.target.dispatchEvent(new Event('input',{bubbles:true}));}});
  doc.addEventListener('input',event=>{const node=event.target.closest('[data-edit-path]');if(!node)return;const raw=node.innerText.replace(/\r/g,'');const value=raw.trim()?raw:'';put(getData(),node.dataset.editPath,value);for(const other of doc.querySelectorAll('[data-edit-path]'))if(other!==node&&other.dataset.editPath===node.dataset.editPath)other.textContent=value;dirtyInline=true;changed({repaint:false});controls();});
  doc.addEventListener('focusout',event=>{if(dirtyInline&&event.target.matches('[data-edit-path]')&&event.relatedTarget?.ownerDocument!==doc){dirtyInline=false;settle();refresh();}});
  doc.defaultView.addEventListener('hashchange',()=>{const id=doc.querySelector('.view:not([hidden])')?.dataset.view;const si=getData().sections.findIndex(s=>s.id===id);const current=selected?.path.match(/^sections\[(\d+)\]/);if(current&&Number(current[1])===si)return;select(si<0?{path:'site',kind:'site'}:{path:'sections['+si+']',kind:'section'});});
  entrySlots({doc,data,owner,text,isTemplate,select,addEntry,moveEntry,addImage:(record,gallery)=>{select(record);if(gallery){const role=at(getData(),record.path),index=role.blocks.findIndex(b=>b.type==='gallery');if(index>=0){select({path:record.path+'.blocks['+index+']',kind:'block'});gallery=false;}}chooseImage(gallery).catch(e=>status(e.message,true));},addLink:(path,id)=>{const role=at(getData(),path);if(role.blocks.length>=100)return;const next={path:path+'.blocks['+role.blocks.length+']',kind:'block'};mutate(()=>role.blocks.push({type:'resource',resource:id}),next);revealSelection();},showFields,changed,dirty:()=>{dirtyInline=true;}});
  const restoreSelection=selected;for(const section of data.sections)for(const entry of section.entries)if(isTemplate(entry.id)&&(!entry.title.trim()||!entry.intro.trim()))for(const role of entry.roles){const control=doc.querySelector('[data-expand="'+role.id+'"]');if(control?.getAttribute('aria-expanded')==='false')control.click();}
  select(restoreSelection);
 }
 function details(){if(selected)showFields(selected);}
 function mutate(fn,next){settle();fn();selected=next===undefined?selected:next;changed();refresh();controls();}
 function blockTarget(){const c=context();if(c.value?.type==='section'||c.value?.type==='resources')return {path:c.p+'.blocks',index:c.value.blocks.length};const m=c.p.match(/^(.*\.blocks)\[(\d+)\]/);if(m)return {path:m[1],index:Number(m[2])+1};return c.rp?{path:c.rp+'.blocks',index:c.role.blocks.length}:null;}
 function addEntry(si,showPanel=false){
  const section=getData().sections[si];if(!section||section.entries.length>=80)return;
  const value=blankEntry(getData()),path='sections['+si+'].entries['+section.entries.length+']';markTemplate(value.id);document.querySelector('#fields').hidden=true;
  mutate(()=>section.entries.push(value),{path,kind:'entry'});if(showPanel)showFields(selected);revealSelection();status('New '+templates[section.id].name+' added. Fill in the spaces below; Save Draft keeps unfinished work.');
 }
 function moveEntry(si,id,delta){
  const entries=getData().sections[si].entries,index=entries.findIndex(e=>e.id===id),to=index+delta;if(index<0||to<0||to>=entries.length)return;
  document.querySelector('#fields').hidden=true;const next={path:'sections['+si+'].entries['+to+']',kind:'entry'};
  mutate(()=>{const [entry]=entries.splice(index,1);entries.splice(to,0,entry);},next);
  iframe.addEventListener('load',()=>afterLayout(()=>{const node=iframe.contentDocument.getElementById('entry-'+id);node?.scrollIntoView({block:'start'});const buttons=[...node.querySelectorAll('[data-entry-move]')];(buttons.find(b=>b.dataset.entryMove===(delta<0?'up':'down')&&!b.disabled)||buttons.find(b=>!b.disabled))?.focus({preventScroll:true});}),{once:true});
  status('Moved '+(entries[to].title||'the '+templates[getData().sections[si].id].name)+'. Undo restores its previous position.');
 }
 button('add-entry').onclick=()=>addEntry(context().si,true);
 button('add-role').onclick=()=>{const c=context();if(!c.entry||c.entry.roles.length>=20)return;const value=blank(schema.$defs.role);value.id=uniqueID(getData(),'role');value.label='';const path=c.ep+'.roles['+c.entry.roles.length+']';mutate(()=>c.entry.roles.push(value),{path,kind:'role'});showFields(selected);revealSelection();};
 button('add-text').onclick=()=>{const target=blockTarget();if(!target)return;const array=at(getData(),target.path);if(array.length>=100)return;const path=target.path+'['+target.index+']';mutate(()=>array.splice(target.index,0,{type:'text',text:'Add your text.',style:'body'}),{path,kind:'block'});revealSelection();};
 async function chooseImage(asGallery=false){
  const c=context();if(!c.entry)return;
  const result=await pickImage({media:getData().media,sections:getData().sections,current:asGallery?null:selected?.kind==='image'?c.value:selected?.kind==='entry'?c.entry.image[0]:null,uploadImage,replace:!asGallery&&(selected?.kind==='image'||(selected?.kind==='entry'&&!!c.entry.image.length))});
  if(!result)return;
  const {media:chosen,image:value}=result;
  const commitImage=(fn,next)=>mutate(()=>{if(!getData().media.some(m=>m.id===chosen.id))getData().media.push(chosen);fn();},next);
  if(asGallery){const target=blockTarget();if(!target)return;const array=at(getData(),target.path);if(array.length>=100)return;const path=target.path+'['+target.index+']';commitImage(()=>array.splice(target.index,0,{type:'gallery',layout:c.section.id==='passions'?'photos':'grid',images:[value]}),{path,kind:'block'});}
  else if(selected?.kind==='image'){const path=selected.path;commitImage(()=>put(getData(),path,value));}
  else if(c.value?.type==='gallery'){if(c.value.images.length>=100)return;const path=c.p+'.images['+c.value.images.length+']';commitImage(()=>c.value.images.push(value),{path,kind:'image'});}
  else if(selected?.kind==='entry'){const path=c.ep+'.image[0]';commitImage(()=>{c.entry.image=[value];c.entry.placeholder='';},{path,kind:'image'});}
  else{const target=blockTarget();if(!target)return;const array=at(getData(),target.path);if(array.length>=100)return;const path=target.path+'['+target.index+'].image';commitImage(()=>array.splice(target.index,0,{type:'figure',layout:'plain',image:value}),{path,kind:'image'});}
  status('Image added to the draft. Save Draft to keep it.');revealSelection();
 }
 function focusSelection(){if(!selected)return;const target=selected,c=context();if(c.section&&doc.querySelector('.view:not([hidden])')?.dataset.view!==c.section.id)doc.querySelector('nav [data-section="'+c.section.id+'"]').click();if(c.role&&target.path.includes('.roles[')){const control=doc.querySelector('[data-expand="'+c.role.id+'"]');if(control?.getAttribute('aria-expanded')==='false')control.click();}select(target);const node=[...doc.querySelectorAll('[data-canvas-path]')].find(n=>n.dataset.canvasPath===target.path);node?.scrollIntoView({block:'center'});}
 document.querySelector('#canvas-outline').onchange=event=>{const path=event.target.value;if(!path)return;const record={path,kind:path.includes('.roles[')?'role':'entry'};const si=Number(path.match(/^sections\[(\d+)\]/)[1]);doc.querySelector('nav [data-section="'+getData().sections[si].id+'"]').click();select(record);focusSelection();};
 button('add-content').onclick=()=>{
  const target=blockTarget();if(!target)return;const array=at(getData(),target.path);if(array.length>=100)return;
  const dialog=element('dialog',{'aria-labelledby':'add-content-title',class:'content-picker'}),cancel=element('button',{text:'Cancel',onclick:()=>dialog.close()});
  const options=[['heading','Heading','A short heading in the existing site style.'],['section','Section','A heading with room for more content.'],['list','Bullet list','Skills, certifications or other short points.'],['gallery','Photo gallery','A group of photos. Choose the first image to get started.'],['resource','Link','Choose an existing link or download.']];
  dialog.append(element('h2',{id:'add-content-title',text:'Add content'}),element('p',{text:'Add to '+(context().role?.label||context().entry?.title||'this section')+'.'}));
  for(const [type,title,description] of options)dialog.append(element('button',{class:'content-choice',text:title,disabled:type==='resource'&&!getData().resources.length,onclick:()=>{if(type==='gallery'){dialog.close();chooseImage(true).catch(e=>status(e.message,true));return;}const value=type==='heading'?{type,title:'New heading',level:5}:type==='section'?{type,title:'New section',level:4,chapter:false,blocks:[]}:type==='list'?{type,items:['New item']}:{type,resource:getData().resources[0].id};const path=target.path+'['+target.index+']';mutate(()=>array.splice(target.index,0,value),{path,kind:'block'});dialog.close();showFields(selected);revealSelection();}},element('small',{text:description})));
  dialog.append(element('p',{class:'help',text:'Manage website addresses in Links & downloads. Use Add image for photos.'}),cancel);dialog.addEventListener('close',()=>dialog.remove(),{once:true});document.body.append(dialog);dialog.showModal();
 };
 function afterLayout(fn){const link=iframe.contentDocument.querySelector('link[href$="entry-slots.css"]');const ready=link&&!link.sheet?new Promise(resolve=>{link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});}):Promise.resolve();ready.then(()=>iframe.contentWindow.requestAnimationFrame(fn));}
 function revealSelection(){const focusCanvas=document.querySelector('#fields').hidden;iframe.addEventListener('load',()=>{if(!selected)return;const target=selected;const c=context();if(c.role){const control=iframe.contentDocument.querySelector('[data-expand="'+c.role.id+'"]');if(control?.getAttribute('aria-expanded')==='false')control.click();}select(target);afterLayout(()=>{const node=[...iframe.contentDocument.querySelectorAll('[data-canvas-path]')].find(n=>n.dataset.canvasPath===target.path);node?.scrollIntoView({block:target.kind==='entry'?'start':'center'});if(focusCanvas&&document.querySelector('#fields').hidden)(node?.matches('[data-edit-path]')?node:node?.querySelector('[data-edit-path]'))?.focus({preventScroll:true});});},{once:true});}
 button('add-image').onclick=()=>chooseImage().catch(e=>status(e.message,true));button('edit-details').onclick=details;
 for(const [id,delta] of [['move-up',-1],['move-down',1]])button(id).onclick=()=>{const pos=arrayLocation();if(!pos||pos.index+delta<0||pos.index+delta>=pos.array.length)return;const next={...selected,path:pos.path+'['+(pos.index+delta)+']'+pos.suffix};mutate(()=>{const [item]=pos.array.splice(pos.index,1);pos.array.splice(pos.index+delta,0,item);},next);revealSelection();};
 button('remove-selection').onclick=async()=>{if(!removable())return;const pos=arrayLocation(),value=pos.array[pos.index];if(!await confirmRemoval(itemName(value),'This removes it'+(value.roles||value.blocks?' and its contents':'')+' from the draft. The live website stays unchanged. Undo restores it.'))return;mutate(()=>pos.array.splice(pos.index,1),bindings.get(pos.path.replace(/\.(entries|roles|blocks|images|image)$/,''))||null);status('Removed from the draft. Undo restores it.');};
 button('canvas-preview').onclick=()=>{preview=!preview;button('canvas-preview').textContent=preview?'Back to editing':'Preview';document.querySelector('#fields').hidden=true;refresh();};
 return {bind,selection:()=>selected,recordForPath:path=>[...bindings.values()].filter(record=>path==='portfolio.'+record.path||path.startsWith('portfolio.'+record.path+'.')||path.startsWith('portfolio.'+record.path+'[')).sort((a,b)=>b.path.length-a.path.length)[0],isPreview:()=>preview,select,controls};
}

export function selectionForm(root,record,data,onChange){
 const defs={entry:schema.$defs.entry,role:schema.$defs.role,block:schema.$defs.block,image:schema.$defs.image,section:schema.$defs.section,site:schema.$defs.portfolio.properties.site,education:schema.$defs.portfolio.properties.education};
 const value=at(data,record.path),def=defs[record.kind];if(!value||!def)return false;
 const prefix='portfolio.'+record.path;const omit=['portfolio.site.resume','portfolio.site.resumeFilename','portfolio.site.resumeLabel'];if(record.kind==='entry'&&value.image.length)omit.push(prefix+'.placeholder');
 for(const key of record.kind==='entry'?['roles','image']:record.kind==='role'?['blocks']:record.kind==='image'?['media']:record.kind==='section'?['entries']:record.kind==='block'?['blocks','images','image']:[])omit.push(prefix+'.'+key);
 const section=record.path.match(/^sections\[(\d+)\]/);const sectionID=section?data.sections[Number(section[1])].id:null;
 const labels=record.kind==='entry'?{title:{work:'Company or organization',projects:'Project name',skills:'Skill group name',passions:'Interest name'}[sectionID]||'Title'}:record.kind==='role'?{label:sectionID==='work'?'Role name':'Section name',role:sectionID==='work'?'Job title':'Description'}:{};
 mountForm(root,{data:value,def:resolve(def,value),path:prefix,referenceData:data,onChange,friendly:true,labels,omit});
 if(record.kind==='entry'||record.kind==='role'||value.blocks)root.append(element('p',{class:'help',text:'Select a role or section on the page, then use Add paragraph, Add image or Add content above.'}));
 if(record.kind==='image')root.append(element('p',{class:'help',text:'Use Replace image above to choose a different photo.'}));return true;
}
