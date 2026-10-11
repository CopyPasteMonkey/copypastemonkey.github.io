// Presentation-only names and automatic links. Stored content stays compatible
// with existing drafts; renaming and reordering never regenerate an ID.
export const contentNames={section:'Section',citation:'Citation',text:'Paragraph',gallery:'Photo gallery',figure:'Image',resources:'Links & downloads',resource:'Link',heading:'Heading',list:'Bullet list'};
export const entryNames={work:'company',projects:'project',skills:'skill group',passions:'interest'};
export const fieldNames={title:'Title',intro:'Summary',divider:'Heading above this item',role:'Job title / description',date:'Dates',label:'Name',blocks:'Content',roles:'Roles & details',entries:'Items',alt:'Image description (alt text)',placeholder:'Coming-soon image label',caption:'Caption',credit:'Credit / attribution',linked:'Open full-size image when clicked',linkLabel:'Description of the full-size link',items:'Bullet points',resource:'Link',url:'Website address',note:'Short note',newTab:'Open in a new tab',download:'Download filename',subtitle:'Short introduction',description:'Description for search results',profession:'Professional title',phone:'Phone number shown on the page',phoneLink:'Number to call',resumeFilename:'Downloaded PDF filename',resumeLabel:'Description of the resume link',footer:'Footer text',suffix:'Additional citation text'};
export function uniqueID(data,prefix='item'){
 const used=new Set();
 const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){if(typeof value.id==='string')used.add(value.id);Object.values(value).forEach(visit);}};visit(data);
 let id;do{id=prefix+'-'+crypto.randomUUID();}while(used.has(id));return id;
}
export function itemName(value,index=0){return typeof value==='string'?value:value?.title||value?.label||value?.alt||contentNames[value?.type]||'Item '+(index+1);}
