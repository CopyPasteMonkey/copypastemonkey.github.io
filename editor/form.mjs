import {schema,resolve,blank} from '../lib/schema.mjs';
const label=s=>s.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
const names={id:'Stable ID',intro:'Summary',blocks:'Content blocks',roles:'Roles & expandable details',media:'Image',linkLabel:'Full-size link description',lazy:'Load when near the screen',newTab:'Open in a new tab',src:'Image file',phoneLink:'Telephone link',resume:'Resume PDF file',divider:'Heading above this entry',label:'Label',credit:'Image credit / attribution'};
export function element(tag,props={},...children){const e=document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='text')e.textContent=v;else if(k==='class')e.className=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);else if(v!==undefined&&v!==false)e.setAttribute(k,v===true?'':v);}for(const c of children.flat())if(c)e.append(c);return e;}
const uid=prefix=>prefix+'-'+crypto.randomUUID().slice(0,8);
function newValue(def){
 const value=blank(def);const name=def.$ref?.split('/').at(-1);
 if(value&&typeof value==='object'&&!Array.isArray(value)&&'id' in value)value.id=uid(name||'item');
 if(name==='entry'){value.title='New entry';value.intro='Add a short summary.';value.roles[0]={id:value.id,label:'',role:'',date:'',blocks:[]};}
 if(name==='role'){value.label='New role';}
 if(value?.type==='section')value.title='New section';
 if(value?.type==='text')value.text='Add your text.';
 return value;
}
export function mountForm(container,{data,def,path='portfolio',onChange,referenceData=data,lockedIds=true,omit=[]}){
 container.replaceChildren();
 function field(value,d,p,set,key=''){
  d=resolve(d,value);
  if(d.type==='object'){
   const group=element('div');
   for(const [k,sub] of Object.entries(d.properties)){
    if(omit.includes(p+'.'+k)||k==='type'||k==='version'||(k==='id'&&sub.enum))continue;
    if(value.roles&&['role','date'].includes(k)&&referenceData.sections?.some(s=>s.id==='work'&&s.entries.includes(value)))continue;
    const sd=resolve(sub,value[k]);
    if(sd.type==='array'||sd.type==='object')group.append(element('h3',{class:'group-title',text:names[k]||label(k)}));
    group.append(field(value[k],sub,p+'.'+k,v=>{value[k]=v;set(value);},k));
   }
   return group;
  }
  if(d.type==='array'){
   const list=element('div',{class:'list','data-path':p});
   const refresh=()=>{
    const opened=new Set([...list.querySelectorAll(':scope > details[open]')].map(el=>el.dataset.itemKey));
    list.replaceChildren();
    value.forEach((item,i)=>{
     const itemKey=item?.id||String(i),title=typeof item==='string'?item:item.title||item.label||item.alt||item.id||item.type||'Item';
     const details=element('details',{class:'item','data-item-key':itemKey,'data-path':`${p}[${i}]`},element('summary',{text:title.slice(0,100)}));
     let built=false;
     const fill=()=>{
      if(built)return;built=true;
      const controls=element('div',{class:'item-actions'});
      const move=(to)=>{if(to<0||to>=value.length)return;[value[to],value[i]]=[value[i],value[to]];set(value);refresh();const moved=list.children[to];moved.open=true;moved.querySelector('summary').focus();};
      controls.append(element('button',{type:'button',text:'Move up','aria-label':'Move '+title+' up',disabled:i===0,onclick:()=>move(i-1)}),element('button',{type:'button',text:'Move down','aria-label':'Move '+title+' down',disabled:i===value.length-1,onclick:()=>move(i+1)}),element('button',{type:'button',text:'Remove','aria-label':'Remove '+title,onclick:()=>{value.splice(i,1);set(value);refresh();list.querySelector('summary,button')?.focus();}}));
      const body=element('div',{class:'item-body'},controls,field(item,d.items,`${p}[${i}]`,v=>{value[i]=v;set(value);const summary=details.querySelector('summary');summary.textContent=typeof v==='string'?v:v.title||v.label||v.alt||v.id||v.type||'Item';},key==='items'?'text':key));
      details.append(body);
     };
     details.addEventListener('toggle',()=>{if(details.open)fill();});list.append(details);if(opened.has(itemKey)){fill();details.open=true;}
    });
    if(value.length<d.maxItems){
     const row=element('div',{class:'add-row'});const itemDef=resolve(d.items);let select;
     if(itemDef.oneOf){select=element('select',{'aria-label':'Block type'});itemDef.oneOf.forEach(b=>select.append(element('option',{value:b.properties.type.const,text:label(b.properties.type.const)})));row.append(select);}
     row.append(element('button',{type:'button',text:'Add '+(key==='entries'?'entry':key==='roles'?'role':key==='images'?'image':key==='blocks'?'block':'item'),onclick:()=>{
      const use=select?itemDef.oneOf.find(b=>b.properties.type.const===select.value):d.items;
      value.push(newValue(use));set(value);refresh();const added=list.children[value.length-1];added.open=true;added.querySelector('summary').focus();
     }}));list.append(row);
    }
   };refresh();return list;
  }
  const title=names[key]||label(key);const wrapper=element('label',{class:'field'});wrapper.append(element('span',{text:title}));let input;
  if(d.enum||d['x-reference']){
   input=element('select');const options=d.enum||referenceData[d['x-reference']].map(x=>({value:x.id,label:x.label||x.id}));
   if(d['x-reference'])input.append(element('option',{value:'',text:'Choose an existing '+(key==='media'?'image':'resource')}));
   options.forEach(o=>input.append(element('option',{value:typeof o==='string'?o:o.value,text:typeof o==='string'?label(o):o.label})));
   input.value=value;
  }else if(d.type==='boolean'){input=element('input',{type:'checkbox'});input.checked=value;}
  else if(d.type==='integer'){input=element('input',{type:'number',min:d.minimum,max:d.maximum});input.value=value;}
  else {input=element(d.maxLength>1000?'textarea':'input',{type:d.maxLength>1000?undefined:'text',maxlength:d.maxLength,readonly:key==='id'&&lockedIds,spellcheck:key==='id'||key==='src'?'false':'true'});input.value=value;}
  input.dataset.path=p;input.setAttribute('aria-label',title);
  input.addEventListener(d.type==='boolean'||d.enum||d['x-reference']?'change':'input',()=>{set(d.type==='boolean'?input.checked:d.type==='integer'?Number(input.value):input.value);});
  wrapper.append(input);if(d.description)wrapper.append(element('small',{text:d.description}));return wrapper;
 }
 container.append(field(data,def,path,()=>onChange(data)));
 return ()=>container.replaceChildren();
}
export function showErrors(container,errors){
 container.querySelectorAll('[aria-invalid]').forEach(e=>e.removeAttribute('aria-invalid'));
 for(const e of container.querySelectorAll('[data-path]'))if(errors.some(x=>x.path===e.dataset.path))e.setAttribute('aria-invalid','true');
}

export function describeError(error,data){
 const tokens=error.path.replace(/^portfolio\.?/,'').match(/[A-Za-z][A-Za-z0-9]*|\d+/g)||[];let value=data;const labels=[];let previous='';
 for(const token of tokens){if(/^\d+$/.test(token)){value=value?.[Number(token)];labels.push(value?.title||value?.label||value?.id||(previous==='images'?'Image':previous==='blocks'?'Block':'Item')+' '+(Number(token)+1));}
 else{value=value?.[token];if(token!=='sections'&&token!=='entries'&&token!=='roles'&&token!=='blocks'&&token!=='images')labels.push(names[token]||label(token));previous=token;}}
 return labels.join(' › ')+': '+error.message;
}
