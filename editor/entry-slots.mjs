import {element} from './form.mjs';
import {templates} from './templates.mjs';

// Editor-only affordances added after the unchanged public DOM is bound.
export function entrySlots({doc,data,owner,text,isTemplate,select,addEntry,moveEntry,addImage,addLink,showFields,changed,dirty}){
 const makeButton=(label,action,props={})=>element('button',{type:'button',text:label,'data-editor-ui':'',onclick:action,...props});
 function slot(node,path,label,placeholder,optional=false){
  node.classList.add('canvas-text-slot');node.dataset.placeholder=placeholder+(optional?' (optional)':'');
  text(node,path);node.setAttribute('aria-label',label);node.setAttribute('aria-placeholder',node.dataset.placeholder);node.setAttribute('aria-multiline',String(node.tagName==='P'));
  node.before(element('span',{class:'canvas-field-label','data-editor-ui':'',text:label+(optional?' · optional':'')}));
 }
 for(const [si,section] of data.sections.entries()){
  const config=templates[section.id],view=doc.getElementById('view-'+section.id);
  for(const [ei,entry] of section.entries.entries()){
   const ep=`sections[${si}].entries[${ei}]`,node=doc.getElementById('entry-'+entry.id),name=entry.title||'Untitled '+config.name;
   const tools=element('div',{class:'canvas-entry-tools','data-editor-ui':'','aria-label':'Arrange '+name},
    element('span',{text:config.name[0].toUpperCase()+config.name.slice(1)+' '+(ei+1)+' of '+section.entries.length}),
    makeButton('Move up',()=>moveEntry(si,entry.id,-1),{disabled:ei===0,'aria-label':'Move '+name+' up','data-entry-move':'up'}),
    makeButton('Move down',()=>moveEntry(si,entry.id,1),{disabled:ei===section.entries.length-1,'aria-label':'Move '+name+' down','data-entry-move':'down'}));
   node.prepend(tools);
   if(isTemplate(entry.id)&&(!entry.title.trim()||!entry.intro.trim()))tools.prepend(element('strong',{class:'canvas-unfinished',text:'Unfinished draft'}));
   const title=doc.getElementById('title-'+entry.id),intro=node.querySelector('.entry-intro');
   if(!entry.title.trim())title.textContent='';if(!entry.intro.trim())intro.textContent='';
   slot(title,ep+'.title',config.title,config.title);slot(intro,ep+'.intro','Summary',config.summary);
   const summary=node.querySelector('.entry-summary'),companyLine=summary.querySelector('.company-line');
   if(section.id!=='work'){
    let role=summary.querySelector(':scope > div > .role');if(!role){role=element('p',{class:'role'});intro.before(role);}
    let date=companyLine.querySelector('.date');if(!date){date=element('span',{class:'date'});companyLine.append(date);}
    slot(role,ep+'.role',config.role,config.role,true);slot(date,ep+'.date',config.date,config.date,true);
   }
   let photo=summary.querySelector(':scope > .entry-photo');
   if(!photo){photo=element('div',{class:'entry-photo'});summary.classList.add('with-image');summary.append(photo);}
   if(!entry.image.length){
    photo.replaceChildren(makeButton('Add image',()=>addImage({path:ep,kind:'entry'}),{class:'canvas-image-slot','aria-label':'Add image for '+name}),element('p',{class:'canvas-slot-hint',text:'Choose from your library or upload a photo. Optional.'}));
   }else photo.append(makeButton('Replace image',()=>addImage({path:ep+'.image[0]',kind:'image'}),{class:'canvas-image-change','aria-label':'Replace image for '+name}));
   for(const [ri,role] of entry.roles.entries()){
    const rp=ep+`.roles[${ri}]`,control=doc.querySelector('[data-expand="'+role.id+'"]').parentElement,details=doc.getElementById('details-'+role.id);
    let meta=control.querySelector('.role-meta');if(!meta){meta=element('div',{class:'role-meta'});control.prepend(meta);control.classList.add('work-role-control');}
    let label=meta.querySelector('h4:not(.visually-hidden)');if(!label){label=element('h4',{text:role.label});meta.prepend(label);}
    slot(label,rp+'.label',section.id==='work'?'Role label':'Details heading',section.id==='work'?'For example, Current Work or Internship':'Details heading',true);
    if(section.id==='work'||role.role||role.date){
     let job=meta.querySelector('.role');if(!job){job=element('p',{class:'role',text:role.role});meta.append(job);}
     let date=meta.querySelector('.date');if(!date){date=element('span',{class:'date',text:role.date});meta.append(date);}
     slot(job,rp+'.role',section.id==='work'?'Job title':'Role description',section.id==='work'?'Job title':'Role description',true);
     slot(date,rp+'.date',config.date,config.date,true);
    }
    if(!role.blocks.length){
     const body=element('p',{class:'canvas-empty-details'});details.prepend(body);owner(body,rp,'role');slot(body,rp+'.blocks[0].text','Details',config.details,true);
     body.addEventListener('input',event=>{event.stopPropagation();const value=body.innerText.replace(/\r/g,'');role.blocks=value.trim()?[{type:'text',text:value,style:'body'}]:[];dirty();changed({repaint:false});});
    }
    const extra=element('div',{class:'canvas-detail-slots','data-editor-ui':''},
     makeButton('Add image to details',()=>addImage({path:rp,kind:'role'},section.id==='passions'),{class:'canvas-detail-image'}));
    const link=element('select',{'aria-label':'Add a link to '+(role.label||name)});link.append(element('option',{value:'',text:'Link or download · optional'}));
    for(const r of data.resources)link.append(element('option',{value:r.id,text:r.label}));
    link.onchange=()=>{if(link.value)addLink(rp,link.value);};
    extra.append(link,makeButton('Manage links',()=>showFields({path:'resources',kind:'resources'})));
    details.querySelector('.collapse-button').before(extra);
   }
  }
  const add=element('div',{class:'canvas-add-entry','data-editor-ui':''},makeButton('Add '+config.name,()=>addEntry(si),{'aria-label':'Add '+config.name,disabled:section.entries.length>=80}),element('p',{text:'Start with spaces for a name, summary, image and details.'}));
  const last=view.querySelector(':scope > .portfolio-entry:last-of-type');if(last)last.after(add);else view.querySelector(':scope > .section-heading')?.after(add);
 }
}
