import {schema,blank,validate} from '../lib/schema.mjs';
import {uniqueID} from './friendly.mjs';

export const templates={
 work:{name:'job',title:'Company or organization',summary:'Describe the company and your work',role:'Job title',date:'Dates of employment',details:'Describe your responsibilities, achievements or a work highlight'},
 projects:{name:'project',title:'Project name',summary:'Describe the project and its goal',role:'Your role or project type',date:'Project dates',details:'Describe your contribution, process and results'},
 skills:{name:'skill group',title:'Skill group name',summary:'List or describe the skills in this group',role:'Specialty or qualification',date:'Dates or experience',details:'Add examples, certifications or training'},
 passions:{name:'interest',title:'Interest name',summary:'Describe this interest or photo collection',role:'Collection or activity',date:'Dates',details:'Add a story, notes or context for your photographs'}
};
export function blankEntry(data){const entry=blank(schema.$defs.entry);entry.id=uniqueID(data,'entry');entry.roles[0].id=entry.id;return entry;}
export function readTemplateIDs(metadata){
 if(metadata===undefined)return new Set();
 if(!metadata||metadata.version!==1||!Array.isArray(metadata.templates)||metadata.templates.length>320||metadata.templates.some(id=>typeof id!=='string'||!/^entry-[a-z0-9-]{1,58}$/.test(id)))throw Error('This backup has unsupported draft information.');
 return new Set(metadata.templates);
}
export function templateMetadata(data,ids){return {version:1,templates:data.sections.flatMap(s=>s.entries).filter(e=>ids.has(e.id)).map(e=>e.id)};}
export function unfinishedEntries(data,ids){
 const result=[];
 if(!Array.isArray(data?.sections))return result;
 for(const [si,s] of data.sections.entries())if(Array.isArray(s.entries))for(const [ei,e] of s.entries.entries())if(ids.has(e?.id)){
  const missing=['title','intro'].filter(key=>typeof e[key]==='string'&&!e[key].trim());
  if(missing.length)result.push({id:e.id,section:s.id,path:`sections[${si}].entries[${ei}]`,name:e.title?.trim()||'Untitled '+templates[s.id]?.name,missing});
 }
 return result;
}
// The public schema and renderer stay strict. Only new, explicitly tracked
// templates may keep an empty name/summary in a local draft. A render-only copy
// supplies whitespace; the canvas replaces it with empty editable placeholders.
// Validate this copy in full, including references, rather than filtering errors.
export function editorData(data,ids,{visitor=false}={}){
 const copy=structuredClone(data),unfinished=unfinishedEntries(copy,ids);
 if(visitor){const omit=new Set(unfinished.map(e=>e.id));for(const s of copy.sections)s.entries=s.entries.filter(e=>!omit.has(e.id));}
 else for(const item of unfinished){const entry=copy.sections.flatMap(s=>s.entries).find(e=>e.id===item.id);for(const key of item.missing)entry[key]=' ';}
 return copy;
}
export function validateDraft(data,ids){return validate(editorData(data,ids));}
