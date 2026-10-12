import {schema,blank,resolve} from '../lib/schema.mjs';
import {element,mountForm,confirmRemoval} from './form.mjs';
import {templates,blankEntry} from './templates.mjs';
import {uniqueID,contentNames} from './friendly.mjs';
import {chooseImage} from './image-picker.mjs';
import {createContentTree} from './content-tree.mjs';

// UI state only. All authored content stays in the existing portfolio schema.
export function createForms({root,getData,changed,settle,status,uploadImage,markTemplate}){
 const openEntries=new Set();let initialized=false;
 const titleCase=text=>text[0].toUpperCase()+text.slice(1);
 const button=(text,onclick,extra={})=>element('button',{type:'button',text,onclick,...extra});
 const changedValue=()=>changed({repaint:false});
 const mount=(host,data,def,path,options={})=>mountForm(host,{data,def,path,referenceData:getData(),onChange:changedValue,friendly:true,renderField:imageField,newItem:newContent,arrayLabels:{blocks:'Add content',items:'Add bullet point'},...options});
 const tree=createContentTree({getData,mount,imageEditor,photoList,prepareBlock,changed:changedValue,settle,status});
 function newContent({def}){const value=blank(def);if(value?.id!==undefined)value.id=uniqueID(getData(),'item');return value;}
 async function selectImage(current,apply,initialFile){
  const result=await chooseImage({media:getData().media,sections:getData().sections,current,uploadImage,replace:!!current,initialFile});
  if(!result)return;settle();const data=getData();if(!data.media.some(m=>m.id===result.media.id))data.media.push(result.media);apply(result.image);changedValue();status('Image added to the draft. Save Draft to keep it.');
 }
 function imageActions(current,apply){
  const input=element('input',{type:'file',accept:'.jpg,.jpeg,.png,.webp',hidden:true,'aria-label':'Choose image from device'});
  input.onchange=()=>{const file=input.files[0];input.value='';if(file)selectImage(current,apply,file);};
  return element('div',{class:'photo-buttons'},button(current?'Upload replacement':'Upload image',()=>input.click()),button('Choose existing image',()=>selectImage(current,apply)),input);
 }
 function imageEditor(value,path,replace){
  const host=element('div',{class:'form-photo','data-path':path});const draw=()=>{
   host.replaceChildren();const media=getData().media.find(m=>m.id===value.media);
   const image=element('img',{src:media?uploadImage.url(media.src):'',alt:value.alt||'Selected photo',loading:'lazy'});
   const preview=element('div',{class:'photo-preview'},image,imageActions(value,next=>{Object.assign(value,next);replace(value);draw();}));
   const fields=element('div',{class:'photo-fields'});mount(fields,value,{type:'object',properties:{alt:schema.$defs.image.properties.alt,caption:schema.$defs.image.properties.caption,credit:schema.$defs.image.properties.credit}},path,{onChange:()=>{image.alt=value.alt||'Selected photo';changedValue();}});
   const more=element('details',{class:'photo-options'},element('summary',{text:'Image link options'})),extra=element('div');more.append(extra);mount(extra,value,{type:'object',properties:{linked:schema.$defs.image.properties.linked,linkLabel:schema.$defs.image.properties.linkLabel}},path);
   host.append(preview,fields,more);
  };draw();return host;
 }
 function photoList(value,path,set,{max=100,min=0,onAdd}={}){
  const host=element('div',{class:'form-photos','data-path':path});
  const draw=()=>{
   host.replaceChildren();for(const [i,photo] of value.entries()){
    const card=element('section',{class:'photo-card','aria-label':'Photo '+(i+1)}),actions=element('div',{class:'item-actions'});
    const move=to=>{settle();[value[i],value[to]]=[value[to],value[i]];set(value);draw();host.querySelectorAll('.photo-card')[to]?.querySelector('button:not([disabled])')?.focus();};
    if(max>1)actions.append(element('strong',{text:'Photo '+(i+1)+' of '+value.length}),button('Move up',()=>move(i-1),{disabled:i===0,'aria-label':'Move photo '+(i+1)+' up'}),button('Move down',()=>move(i+1),{disabled:i===value.length-1,'aria-label':'Move photo '+(i+1)+' down'}));
    actions.append(button('Remove image',async()=>{if(!await confirmRemoval('this image'))return;settle();value.splice(i,1);set(value);draw();host.querySelector('button:not([disabled])')?.focus();},{disabled:value.length<=min}));
    card.append(actions,imageEditor(photo,path+'['+i+']',()=>set(value)));host.append(card);
   }
   if(value.length<max)host.append(imageActions(null,image=>{value.push(image);onAdd?.();set(value);draw();}));
   if(!value.length)host.prepend(element('p',{class:'help',text:'Optional. Upload a photo or choose one already on your website.'}));
  };draw();return host;
 }
 function imageField({value,def,path,key,set}){
  if(def.type==='object'&&def.properties?.media&&def.properties?.alt)return imageEditor(value,path,set);
  if(def.type==='array'&&resolve(def.items)?.properties?.media)return photoList(value,path,set,{max:def.maxItems,min:def.minItems||0});
 }
 function detailsContent(host,role,path,template){
  // The initial optional text area doesn't create an invalid empty public block.
  if(!role.blocks.length){
   const field=element('label',{class:'field'},element('span',{text:'Details · optional'})),input=element('textarea',{'aria-label':'Details',placeholder:template.details,maxlength:10000,'data-path':path+'.blocks[0].text'});let first;
   input.oninput=()=>{if(!first&&input.value){first={type:'text',style:'body',text:input.value};role.blocks.push(first);}else if(first){first.text=input.value;if(!input.value){role.blocks.splice(role.blocks.indexOf(first),1);first=null;}}changedValue();};field.append(input);host.append(field);
   const extras=element('div');host.append(extras);
   const add=element('select',{'aria-label':'Add more detail'});add.append(element('option',{value:'',text:'More detail…'}));for(const type of ['section','text','heading','list','gallery','figure','resource','citation'])add.append(element('option',{value:type,text:contentNames[type]}));
   add.onchange=async()=>{if(!add.value)return;const added=await addBlock(role.blocks,add.value);add.value='';if(!added)return;host.replaceChildren();detailsContent(host,role,path,template);const last=[...host.querySelectorAll(':scope > .content-node')].at(-1);if(last){last.open=true;last.querySelector('summary').focus();}};extras.append(button('Add heading',async()=>{await addBlock(role.blocks,'section');host.replaceChildren();detailsContent(host,role,path,template);const last=[...host.querySelectorAll(':scope > .content-node')].at(-1);if(last){last.open=true;last.querySelector('summary').focus();}}),add);
  }else{
   tree.list(host,role.blocks,path+'.blocks');
  }
 }
 async function prepareBlock(value){
  settle();
  if(value.type==='figure'||value.type==='gallery'){
   const result=await chooseImage({media:getData().media,sections:getData().sections,uploadImage});if(!result)return;
   if(!getData().media.some(m=>m.id===result.media.id))getData().media.push(result.media);if(value.type==='figure')value.image=result.image;else value.images=[result.image];
  }
  return value;
 }
 async function addBlock(blocks,type){
  const def=schema.$defs.block.oneOf.find(b=>b.properties.type.const===type);const next=blank(def);if(type==='section')next.chapter=true;const value=await prepareBlock(next);if(value){blocks.push(value);changedValue();return true;}
 }
 function rolesForm(host,entry,path,template,category){
  host.replaceChildren();const heading=category==='work'?'Roles':'Details sections';host.append(element('h3',{text:heading}));
  for(const [i,role] of entry.roles.entries()){
   const rolePath=path+'.roles['+i+']',group=element('fieldset',{class:'role-fields','data-path':rolePath});
   group.append(element('legend',{text:(category==='work'?'Role ':'Details section ')+(i+1)}));
   const controls=element('div',{class:'item-actions'});
   const move=to=>{settle();[entry.roles[i],entry.roles[to]]=[entry.roles[to],entry.roles[i]];changedValue();rolesForm(host,entry,path,template,category);host.querySelectorAll(':scope > fieldset')[to]?.querySelector('button:not([disabled])')?.focus();};
   controls.append(button('Move up',()=>move(i-1),{disabled:i===0,'aria-label':'Move role '+(i+1)+' up'}),button('Move down',()=>move(i+1),{disabled:i===entry.roles.length-1,'aria-label':'Move role '+(i+1)+' down'}),button('Remove '+(category==='work'?'role':'details section'),async()=>{if(!await confirmRemoval(role.label||'this '+(category==='work'?'role':'details section')))return;settle();entry.roles.splice(i,1);changedValue();rolesForm(host,entry,path,template,category);host.querySelectorAll(':scope > fieldset')[Math.min(i,entry.roles.length-1)]?.querySelector('input')?.focus();},{disabled:entry.roles.length===1}));group.append(controls);
   const metadata=element('div');group.append(metadata);
   const properties=category==='work'?{label:schema.$defs.role.properties.label,role:schema.$defs.role.properties.role,date:schema.$defs.role.properties.date}:{label:schema.$defs.role.properties.label,...(role.role||role.date?{role:schema.$defs.role.properties.role,date:schema.$defs.role.properties.date}:{})};
   mount(metadata,role,{type:'object',properties},rolePath,{labels:{label:category==='work'?'Role label · optional':'Details section name · optional',role:category==='work'?'Job title':'Role or description',date:category==='work'?'Dates of employment':'Dates'}});
   const content=element('div',{class:'role-content'});group.append(content);detailsContent(content,role,rolePath,template);host.append(group);
  }
  if(entry.roles.length<20)host.append(button(category==='work'?'Add role':'Add details section',()=>{settle();entry.roles.push({id:uniqueID(getData(),'role'),label:'',role:'',date:'',blocks:[]});changedValue();rolesForm(host,entry,path,template,category);const last=host.querySelectorAll('fieldset')[entry.roles.length-1];last.querySelector('input')?.focus();}));
 }
 function entryBody(host,entry,path,template,category,onTitle){
  const info=element('div');host.append(info);mount(info,entry,{type:'object',properties:{title:schema.$defs.entry.properties.title,intro:schema.$defs.entry.properties.intro,...(category==='work'?{}:{role:schema.$defs.entry.properties.role,date:schema.$defs.entry.properties.date})}},path,{labels:{title:template.title,intro:'Summary',role:template.role+' · optional',date:template.date+' · optional'},onChange:()=>{onTitle();changedValue();}});
  host.append(element('h3',{text:'Main image'}),photoList(entry.image,path+'.image',()=>{changedValue();renderOptions();},{max:1,onAdd:()=>{entry.placeholder='';}}));
  const roles=element('div',{class:'entry-roles'});host.append(roles);rolesForm(roles,entry,path,template,category);
  const options=element('details',{class:'entry-options'},element('summary',{text:'Other text options'})),extra=element('div');options.append(extra);function renderOptions(){mount(extra,entry,{type:'object',properties:{divider:schema.$defs.entry.properties.divider,...(!entry.image.length?{placeholder:schema.$defs.entry.properties.placeholder}:{})}},path);}renderOptions();host.append(options);
 }
 function sectionForm(section){
  const data=getData(),si=data.sections.indexOf(section),template=templates[section.id],prefix='portfolio.sections['+si+']';
  root.append(element('h2',{text:titleCase(section.id)}),element('p',{class:'help',text:'Fill in the fields below. Changes stay in your draft until you publish. Use Preview website to check the result.'}));
  const subtitle=element('div',{class:'section-intro'});root.append(subtitle);mount(subtitle,section,{type:'object',properties:{subtitle:schema.$defs.section.properties.subtitle}},prefix,{labels:{subtitle:'Section subtitle'}});
  const list=element('div',{class:'entry-list'});root.append(list);
  if(!initialized){if(section.entries[0])openEntries.add(section.entries[0].id);initialized=true;}
  const draw=focusID=>{
   list.replaceChildren();section.entries.forEach((entry,index)=>{
    const path=prefix+'.entries['+index+']',name=()=>entry.title.trim()||'Untitled '+template.name;
    const card=element('article',{class:'form-entry','data-entry-id':entry.id}),head=element('div',{class:'entry-heading'}),counter=element('strong',{text:titleCase(template.name)+' '+(index+1)+' of '+section.entries.length}),actions=element('div',{class:'entry-order'});
    const move=direction=>{const to=index+direction;if(to<0||to>=section.entries.length)return;settle();[section.entries[index],section.entries[to]]=[section.entries[to],section.entries[index]];changedValue();draw(entry.id);const moved=list.querySelector('[data-entry-id="'+entry.id+'"]');const control=moved.querySelector('[data-move="'+(direction<0?'up':'down')+'"]');(control.disabled?moved.querySelector('summary'):control).focus();};
    const up=button('Move up',()=>move(-1),{'data-move':'up',disabled:index===0}),down=button('Move down',()=>move(1),{'data-move':'down',disabled:index===section.entries.length-1}),remove=button('Remove',async()=>{if(!await confirmRemoval(name()))return;settle();section.entries.splice(index,1);openEntries.delete(entry.id);changedValue();draw();list.querySelector('summary')?.focus();});
    actions.append(up,down,remove);head.append(counter,actions);
    const details=element('details',{class:'entry-fields','data-path':path}),summary=element('summary'),body=element('div',{class:'entry-body'});
    const updateTitle=()=>{summary.textContent=name();for(const [b,verb] of [[up,'Move'],[down,'Move'],[remove,'Remove']])b.setAttribute('aria-label',verb+' '+name()+(b===up?' up':b===down?' down':''));};updateTitle();details.append(summary,body);let built=false;
    const fill=()=>{if(!built){built=true;entryBody(body,entry,path,template,section.id,updateTitle);}};
    details.addEventListener('toggle',()=>{if(details.open){openEntries.add(entry.id);fill();}else openEntries.delete(entry.id);});
    if(openEntries.has(entry.id)){details.open=true;fill();}card.append(head,details);list.append(card);
   });
   const add=button('Add '+template.name,()=>{if(section.entries.length>=80)return;settle();const entry=blankEntry(getData());markTemplate(entry.id);section.entries.push(entry);openEntries.add(entry.id);changedValue();draw(entry.id);list.querySelector('[data-entry-id="'+entry.id+'"] input')?.focus();},{class:'primary add-entry',disabled:section.entries.length>=80});list.append(element('div',{class:'add-entry-row'},add));
  };draw();
 }
 return {render(active){const section=getData().sections.find(s=>s.id===active);if(!section)return false;root.replaceChildren();sectionForm(section);return true;},openPath(path){const match=path.match(/^portfolio.sections\[(\d+)\]\.entries\[(\d+)\]/);if(match){const entry=getData().sections[Number(match[1])]?.entries[Number(match[2])];if(entry)openEntries.add(entry.id);}}};
}
