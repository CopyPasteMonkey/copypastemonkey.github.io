import {element} from './form.mjs';

// Uploads use the editor's existing optimizer/storage. Only the confirmed result
// is returned to the canvas; browsing, Back, Cancel and Escape never edit content.
export function chooseImage({media,sections,current,uploadImage,replace=false,initialFile}){
 return new Promise(resolve=>{
  const placements=new Map(),pending=new Map(),names=new Map();
  function collect(value){
   if(Array.isArray(value))value.forEach(collect);
   else if(value&&typeof value==='object'){
    if(value.media&&typeof value.alt==='string'&&!placements.has(value.media))placements.set(value.media,value);
    Object.values(value).forEach(collect);
   }
  }
  collect(sections);if(current)placements.set(current.media,current);
  let chosen=null,reviewing=false,busy=false,closed=false,result=null;
  const dialog=element('dialog',{class:'image-picker','aria-labelledby':'choose-image-title','aria-describedby':'choose-image-help'});
  const title=element('h2',{id:'choose-image-title',text:replace?'Replace image':'Add image'});
  const help=element('p',{id:'choose-image-help',class:'image-picker-help',text:'Choose an available image or upload one from your device.'});
  const upload=element('input',{type:'file',accept:'.jpg,.jpeg,.png,.webp',hidden:true,'aria-label':'Choose image file'});
  const uploadButton=element('button',{type:'button',text:'Upload from device',class:'image-upload',onclick:()=>upload.click()});
  const uploadHelp=element('span',{class:'image-upload-help',text:'JPEG, PNG or WebP · up to 12 MB. Images are optimized automatically.'});
  const message=element('p',{class:'image-picker-message',role:'status','aria-live':'polite'});
  const error=element('p',{class:'image-picker-error',role:'alert',hidden:true});
  const search=element('input',{type:'search',placeholder:'Search descriptions or filenames','aria-label':'Search available images'});
  const count=element('span',{class:'image-count',role:'status','aria-live':'polite'});
  const grid=element('div',{class:'image-choices','aria-label':'Available images'});
  const empty=element('p',{class:'image-empty',text:'No images match. Try another search or upload from your device.',hidden:true});
  const library=element('section',{class:'image-library','aria-labelledby':'image-library-title'},element('div',{class:'image-library-heading'},element('h3',{id:'image-library-title',text:'Available images'}),count),search,grid,empty);
  const back=element('button',{type:'button',text:'Back to library',onclick:()=>showLibrary()});
  const selectedTitle=element('h3',{id:'selected-image-title',text:'Selected image',tabindex:'-1'});
  const preview=element('img',{alt:''});
  const filename=element('span',{class:'image-filename'}),dimensions=element('span',{class:'image-dimensions'});
  const alt=element('input',{'aria-label':'Image description (alt text)',maxlength:1000,required:true,placeholder:'Describe what the image shows','aria-describedby':'image-alt-help'});
  const caption=element('input',{'aria-label':'Image caption',maxlength:2000});
  const credit=element('input',{'aria-label':'Image credit',maxlength:2000});
  const field=(label,input)=>element('label',{class:'field'},element('span',{text:label}),input);
  const review=element('section',{class:'image-review',hidden:true,'aria-labelledby':'selected-image-title'},
   element('div',{class:'image-review-heading'},back,selectedTitle),
   element('div',{class:'image-review-content'},
    element('figure',{class:'image-preview'},preview,element('figcaption',{},filename,dimensions)),
    element('div',{class:'image-description'},field('Image description (alt text) · required',alt),element('p',{id:'image-alt-help',class:'help',text:'Describe the image for people who cannot see it.'}),field('Caption',caption),field('Credit / attribution',credit))));
  const use=element('button',{type:'button',class:'primary',text:'Use image',disabled:true});
  const cancel=element('button',{type:'button',text:'Cancel',onclick:()=>dialog.close()});
  const footer=element('div',{class:'image-picker-footer'},element('span',{text:'Choose Use image to add it to your draft.'}),element('div',{class:'image-picker-actions'},cancel,use));
  const allMedia=()=>[...media,...[...pending.values()].filter(m=>!media.some(v=>v.id===m.id))];
  const description=m=>names.get(m.id)||placements.get(m.id)?.caption||placements.get(m.id)?.alt||m.id;
  function updateUse(){use.disabled=busy||!reviewing||!chosen||!alt.value.trim()||!error.hidden;}
  function clearMessages(){error.hidden=true;error.textContent='';message.textContent='';}
  function cards(){
   const query=search.value.trim().toLowerCase();
   const items=allMedia(),matches=items.filter(m=>[m.id,m.src,description(m),placements.get(m.id)?.alt,placements.get(m.id)?.credit].filter(Boolean).join(' ').toLowerCase().includes(query));
   grid.replaceChildren();
   for(const m of matches){
    const label=description(m);
    grid.append(element('button',{type:'button',class:'image-choice','aria-label':'Choose '+label,'aria-pressed':String(chosen?.id===m.id),'data-media':m.id,disabled:busy,onclick:()=>selectImage(m)},
     element('img',{src:uploadImage.url(m.src),alt:'',loading:'lazy',decoding:'async'}),
     element('span',{class:'image-choice-label',text:label}),element('span',{class:'image-choice-id',text:m.width+' × '+m.height})));
   }
   count.textContent=query?matches.length+' of '+items.length+' images':items.length+' images';empty.hidden=matches.length!==0;
  }
  function showLibrary(){
   reviewing=false;review.hidden=true;library.hidden=false;clearMessages();cards();updateUse();
   const card=[...grid.querySelectorAll('button')].find(b=>b.dataset.media===chosen?.id);(card||search).focus();
  }
  function selectImage(m){
   if(busy||closed)return;
   if(chosen?.id!==m.id){const placed=placements.get(m.id);alt.value=placed?.alt||'';caption.value=placed?.caption||'';credit.value=placed?.credit||'';}
   chosen=m;reviewing=true;clearMessages();library.hidden=true;review.hidden=false;
   preview.src=uploadImage.url(m.src);preview.alt=alt.value||'Preview of the selected image';
   filename.textContent=names.get(m.id)||description(m);dimensions.textContent=m.width+' × '+m.height+' pixels';
   updateUse();selectedTitle.focus();
  }
  search.oninput=cards;
  alt.oninput=()=>{preview.alt=alt.value||'Preview of the selected image';updateUse();};
  const prepare=async file=>{
   if(!file||busy)return;
   busy=true;uploadButton.disabled=true;back.disabled=true;search.disabled=true;clearMessages();message.textContent='Preparing image…';dialog.setAttribute('aria-busy','true');cards();updateUse();
   try{
    const m=await uploadImage.add(file);
    if(closed)return;
    pending.set(m.id,m);names.set(m.id,file.name);busy=false;selectImage(m);message.textContent='Image ready. Review its description before adding it.';
   }catch(e){
    if(closed)return;
    message.textContent='';error.textContent='Image was not added. '+e.message;error.hidden=false;
   }finally{
    busy=false;upload.value='';uploadButton.disabled=false;back.disabled=false;search.disabled=false;dialog.removeAttribute('aria-busy');
    if(!closed){cards();updateUse();}
   }
  };
  upload.onchange=()=>prepare(upload.files[0]);
  use.onclick=()=>{
   if(use.disabled)return;
   result={media:chosen,image:{media:chosen.id,alt:alt.value.trim(),caption:caption.value,credit:credit.value,linked:current?.linked??false,linkLabel:current?.media===chosen.id?current.linkLabel:'',lazy:current?.lazy??true}};dialog.close();
  };
  dialog.addEventListener('close',()=>{closed=true;dialog.remove();resolve(result);},{once:true});
  dialog.append(title,help,element('div',{class:'image-source'},uploadButton,upload,uploadHelp),message,error,library,review,footer);
  document.body.append(dialog);cards();dialog.showModal();if(initialFile)prepare(initialFile);search.focus();
 });
}
