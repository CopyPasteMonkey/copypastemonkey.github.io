import {prepareResume} from '../lib/pdf.mjs';
import {element,mountForm} from './form.mjs';
import {schema} from '../lib/schema.mjs';
export function resumeForm(root,{site,url,onAccept,onChange,status,setBusy}){
 root.append(element('p',{class:'help',text:'Upload the PDF exported from your LaTeX editor or word processor. Review it, add it to your draft, then Save Draft and Publish when ready. GitHub drafts and published PDFs are public.'}));
 root.append(element('p',{},element('a',{href:url(site.resume),target:'_blank',rel:'noopener',text:'Review current resume PDF'})));
 root.append(element('p',{class:'help',text:'Current download: '+site.resumeFilename}));
 const input=element('input',{type:'file',accept:'.pdf,application/pdf','aria-label':'Upload resume PDF'});
 root.append(element('label',{class:'field'},element('span',{text:'Upload resume PDF'}),input),element('p',{class:'help',text:'PDF only · up to 5 MB · 1–20 pages · no password, scripts, attachments, or forms. Your current PDF stays available until a replacement is published.'}));
 const settings=element('div');root.append(settings);mountForm(settings,{data:site,def:{type:'object',properties:{resumeFilename:schema.$defs.portfolio.properties.site.properties.resumeFilename,resumeLabel:schema.$defs.portfolio.properties.site.properties.resumeLabel}},path:'portfolio.site',onChange});
 input.onchange=async()=>{
  const file=input.files[0];if(!file)return;input.disabled=true;setBusy(true);
  try{
   const candidate=await prepareResume(file),preview=URL.createObjectURL(candidate.blob);
   const dialog=element('dialog',{'aria-labelledby':'resume-review-title'}),accept=element('button',{class:'primary',text:'Use this PDF in draft'}),cancel=element('button',{text:'Cancel'});
   dialog.append(element('h2',{id:'resume-review-title',text:'Review replacement resume'}),element('p',{text:candidate.filename+' · '+candidate.pages+' '+(candidate.pages===1?'page':'pages')+' · '+Math.ceil(candidate.blob.size/1024)+' KB'}),element('p',{},element('a',{href:preview,target:'_blank',rel:'noopener',text:'Open PDF preview'})),element('p',{text:'Check the PDF before using it. This changes the draft only; Save Draft and Publish remain separate steps.'}),accept,cancel);
   cancel.onclick=()=>dialog.close();dialog.addEventListener('close',()=>{URL.revokeObjectURL(preview);dialog.remove();input.value='';input.disabled=false;},{once:true});
   accept.onclick=async()=>{accept.disabled=true;cancel.disabled=true;setBusy(true);try{await onAccept(candidate);dialog.close();}catch(e){status(e.message,true);accept.disabled=false;cancel.disabled=false;}finally{setBusy(false);}};
   document.body.append(dialog);dialog.showModal();cancel.focus();
  }catch(e){status(e.message,true);input.value='';input.disabled=false;}finally{setBusy(false);}
 };
}
