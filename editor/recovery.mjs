import {validateLocalDraft} from '../lib/schema.mjs';
import {readTemplateIDs} from './templates.mjs';

const prefix='eli-portfolio-unsaved-';
export function readableDraft(value){
 try{return value&&validateLocalDraft(value.portfolio).length===0&&!!readTemplateIDs(value.editor);}catch{return false;}
}
export function storageMessage(){return 'This browser could not save your draft (storage may be full or blocked). Your edits are still open. Download backup now, and keep this tab open until the download finishes.';}

// Each page gets its own checkpoint, so typing in one tab cannot overwrite
// another tab's unsaved work. No credentials or remote writes are involved.
export function createRecovery(storage){
 const key=prefix+crypto.randomUUID();let previous='';
 return {
  write(value){const raw=JSON.stringify(value);if(raw===previous)return;storage.setItem(key,raw);previous=raw;},
  clear(){storage.removeItem(key);previous='';},
  list(){const copies=[];for(let i=0;i<storage.length;i++){const name=storage.key(i);if(!name?.startsWith(prefix)&&!['portfolio-before-github-load','portfolio-before-local-overwrite'].includes(name))continue;const raw=storage.getItem(name);try{const value=JSON.parse(raw);if(readableDraft(value))copies.push({key:name,raw,value});}catch{}}
   return copies.sort((a,b)=>String(b.value.savedAt).localeCompare(String(a.value.savedAt)));
  },
  discard(copy){if(storage.getItem(copy.key)===copy.raw)storage.removeItem(copy.key);}
 };
}
