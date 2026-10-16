import {draftKey} from './drafts.mjs';
// Recover from a damaged saved draft without discarding the original bytes.
export function loadLocalDraft(storage,validate){
 let raw;
 try{raw=storage.getItem(draftKey);}catch{return {warning:'Browser draft storage is unavailable. Download backup to keep your edits.'};}
 if(!raw)return {};
 try{const stored=JSON.parse(raw);if(!stored||!validate(stored))throw Error('Invalid saved draft');return {stored};}
 catch{
  let archived=false;
  try{storage.setItem('portfolio-draft-recovery-'+crypto.randomUUID(),raw);storage.removeItem(draftKey);archived=true;}catch{}
  return {recovery:raw,warning:archived?'The saved draft could not be read. Its original data was preserved; the published version has been loaded.':'The saved draft could not be read. Download its recovery copy before making further changes; browser storage may be full.'};
 }
}
export function missingDraftAssets(data,baseline,images){
 const known=new Set([...baseline.media.map(m=>m.src),baseline.site.resume]);
 return [...new Set([...data.media.map(m=>m.src),data.site.resume])].filter(src=>!known.has(src)&&!images.has(src));
}

// A content edit is not a conflict when the remote revisions are still the
// ones this draft last loaded or saved. New remote revisions still need review.
export function remoteVersion(state){return {published:state.publishedHead,draft:state.draft?.head||null};}
export function sameRemoteVersion(known,state){return !!known&&known.published===state.publishedHead&&known.draft===(state.draft?.head||null);}
