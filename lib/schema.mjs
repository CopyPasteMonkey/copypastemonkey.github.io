// Shared by the form, browser preview, CLI and CI. No HTML or CSS fields.
const str=(maxLength=2000, minLength=0, extra={})=>({type:'string',maxLength,minLength,...extra});
const id=()=>str(64,1,{pattern:'^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',description:'Stable link ID. Existing IDs stay fixed when titles change.'});
const ref=name=>({$ref:'#/$defs/'+name});
const arr=(items,maxItems=100,minItems=0)=>({type:'array',items,maxItems,minItems});
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const choice=values=>({type:'string',enum:values});
const bool={type:'boolean'};
const int=(min=1,max=2400)=>({type:'integer',minimum:min,maximum:max});
const block=(type,props)=>obj({type:{const:type,type:'string'},...props});
export const schema={
 $schema:'https://json-schema.org/draft/2020-12/schema', title:'Eli Doggart portfolio content', ...ref('portfolio'),
 $defs:{
  image:obj({media:str(64,1,{'x-reference':'media'}),alt:str(1000,1),caption:str(),credit:str(),linked:bool,linkLabel:str(1200),lazy:bool}),
  media:obj({id:id(),src:str(200,1,{pattern:'^assets/(images|media)/[A-Za-z0-9][A-Za-z0-9._-]*\\.(webp|jpg|jpeg|png)$'}),width:int(),height:int()}),
  resource:obj({id:id(),url:str(2048,1,{'x-url':true}),label:str(500,1),note:str(2000),download:str(128,0,{pattern:'^$|^[A-Za-z0-9][A-Za-z0-9._-]*\\.(pdf|csv|webp|jpg|jpeg|png)$'}),newTab:bool}),
  block:{oneOf:[
   block('section',{title:str(200,1),level:int(4,6),chapter:bool,blocks:arr(ref('block'))}),
   block('citation',{title:str(2000,1),suffix:str(2000)}),
   block('text',{text:str(10000,1),style:choice(['body','note','source','context','italic'])}),
   block('gallery',{layout:choice(['grid','single','photos']),images:arr(ref('image'),100,1)}),
   block('figure',{layout:choice(['plain','chart','code']),image:ref('image')}),
   block('resources',{blocks:arr(ref('block'))}),
   block('resource',{resource:str(64,1,{'x-reference':'resources'})}),
   block('heading',{title:str(200,1),level:int(4,6)}),
   block('list',{items:arr(str(2000,1),100,1)})
  ]},
  role:obj({id:id(),label:str(200),role:str(300),date:str(100),blocks:arr(ref('block'),100,0)}),
  entry:obj({id:id(),title:str(300,1),intro:str(3000,1),divider:str(200),role:str(300),date:str(100),image:arr(ref('image'),1),placeholder:str(100),roles:arr(ref('role'),20,1)}),
  section:obj({id:choice(['work','projects','skills','passions']),subtitle:str(300),entries:arr(ref('entry'),80)}),
  portfolio:obj({version:{type:'integer',const:1},site:obj({name:str(100,1),profession:str(300,1),description:str(400,1),introduction:str(3000,1),resume:str(200,1,{pattern:'^assets/documents/[A-Za-z0-9][A-Za-z0-9._-]*\\.pdf$'}),resumeFilename:str(128,1,{pattern:'^[A-Za-z0-9][A-Za-z0-9._-]*\\.pdf$'}),resumeLabel:str(200,1),email:str(254,1,{pattern:'^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$'}),phone:str(80,1),phoneLink:str(32,1,{pattern:'^tel:\\+[0-9]{7,15}$'}),footer:str(300,1)}),sections:arr(ref('section'),4,4),education:obj({heading:str(200,1),school:str(300,1),date:str(100,1),degree:str(300,1)}),media:arr(ref('media'),500,0),resources:arr(ref('resource'),200,0)})
 }
};
export function resolve(def,value){
 if(def.$ref)def=schema.$defs[def.$ref.split('/').at(-1)];
 if(def.oneOf)def=def.oneOf.find(x=>x.properties.type.const===value?.type)||def;
 return def;
}
export function safeURL(value){
 if(typeof value!=='string'||/[\s\\<>\u0000-\u001f\u007f]/.test(value))return false;
 if(/^assets\/(documents|media)\/[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|csv|webp|jpg|jpeg|png)$/.test(value))return true;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;}catch{return false;}
}
export function validate(data){
 const errors=[];
 const error=(path,message)=>{if(errors.length<80)errors.push({path,message});};
 function walk(value,def,path,depth=0){
  if(depth>18){error(path,'Nesting is limited to 18 levels.');return;}
  def=resolve(def,value);
  if(def.oneOf){error(path,'Choose an approved content block.');return;}
  if(def.const!==undefined&&value!==def.const)error(path,`Must be ${def.const}.`);
  if(def.type==='object'){
   if(!value||Array.isArray(value)||typeof value!=='object'){error(path,'Expected a group of fields.');return;}
   for(const key of Object.keys(value))if(!Object.hasOwn(def.properties,key))error(path+'.'+key,'This field is not allowed.');
   for(const key of def.required||[])if(!Object.hasOwn(value,key))error(path+'.'+key,'This field is required.');
   for(const [key,child] of Object.entries(def.properties))if(Object.hasOwn(value,key))walk(value[key],child,path+'.'+key,depth+1);
  }else if(def.type==='array'){
   if(!Array.isArray(value)){error(path,'Expected a list.');return;}
   if(value.length<(def.minItems||0)||value.length>def.maxItems)error(path,`Use ${def.minItems||0}–${def.maxItems} items.`);
   value.slice(0,def.maxItems).forEach((v,i)=>walk(v,def.items,`${path}[${i}]`,depth+1));
  }else if(def.type==='string'){
   if(typeof value!=='string'){error(path,'Expected text.');return;}
   if(value.length<(def.minLength||0)||value.length>(def.maxLength||10000))error(path,`Use ${def.minLength||0}–${def.maxLength||10000} characters.`);
   if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))error(path,'Control characters are not allowed.');
   if(def.pattern&&!new RegExp(def.pattern).test(value))error(path,'Use a valid '+path.split('.').at(-1)+' (no spaces or unsafe path characters).');
   if(def.enum&&!def.enum.includes(value))error(path,'Choose one of: '+def.enum.join(', '));
   if(def['x-url']&&!safeURL(value))error(path,'Use an HTTPS URL or a local assets/documents or assets/media file.');
  }else if(def.type==='integer'){
   if(!Number.isSafeInteger(value)||(def.minimum!==undefined&&value<def.minimum)||(def.maximum!==undefined&&value>def.maximum))error(path,`Use a whole number between ${def.minimum??0} and ${def.maximum??1}.`);
  }else if(def.type==='boolean'&&typeof value!=='boolean')error(path,'Expected true or false.');
 }
 walk(data,schema,'portfolio');
 if(errors.length)return errors;
 const unique=(items,label)=>{const seen=new Set();for(const i of items){if(seen.has(i.id))error(label,`Duplicate ID: ${i.id}`);seen.add(i.id);}return seen;};
 const mids=unique(data.media,'media');const rids=unique(data.resources,'resources');
 unique(data.sections,'sections');const entries=data.sections.flatMap(s=>s.entries);unique(entries,'entries');unique(entries.flatMap(e=>e.roles),'roles');
 const reserved=new Set(['work','projects','skills','passions','contact','main','section-select']);
 for(const section of data.sections)if(section.id==='work')for(const e of section.entries)if(e.role||e.date)error('entries.'+e.id,'Work titles and dates belong in the role controls.');
 for(const e of entries){if(reserved.has(e.id))error('entries.'+e.id,'This ID is reserved for navigation.');
  for(const r of e.roles)if(r.id!==e.id&&entries.some(other=>other.id===r.id))error('roles.'+r.id,'Role ID conflicts with an entry ID.');
  if(e.image.length&&e.placeholder)error('entries.'+e.id,'Choose a photo or a placeholder, not both.');
 }
 function refs(v,path='portfolio'){
  if(Array.isArray(v))return v.forEach((x,i)=>refs(x,`${path}[${i}]`));
  if(!v||typeof v!=='object')return;
  if(typeof v.media==='string'&&!mids.has(v.media))error(path+'.media',`Unknown media ID: ${v.media}`);
  if(v.type==='resource'&&!rids.has(v.resource))error(path+'.resource',`Unknown resource ID: ${v.resource}`);
  for(const [k,x] of Object.entries(v))refs(x,path+'.'+k);
 }
 refs(data);
 if(new TextEncoder().encode(JSON.stringify(data)).length>2_000_000)error('portfolio','Content must be smaller than 2 MB.');
 return errors;
}
export function assertValid(data){const errors=validate(data);if(errors.length)throw new Error(errors.map(e=>e.path+': '+e.message).join('\n'));return data;}
export function blank(def){
 def=resolve(def);if(def.oneOf)def=def.oneOf[0];if(def.const!==undefined)return def.const;
 if(def.type==='object')return Object.fromEntries(Object.entries(def.properties).map(([k,d])=>[k,blank(d)]));
 if(def.type==='array')return Array.from({length:def.minItems||0},()=>blank(def.items));
 if(def.type==='boolean')return false;if(def.type==='integer')return def.minimum??1;
 return def.enum?.[0]||'';
}
